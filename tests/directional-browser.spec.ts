import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

async function setup(page: Page, request: import('@playwright/test').APIRequestContext) {
  const problems: string[] = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
  await page.setViewportSize({ width: 800, height: 680 });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'tile.openstreetmap.org') {
      const tile = await request.get('http://127.0.0.1:4175/tile.png');
      await route.fulfill({ status: 200, contentType: 'image/png', body: await tile.body() });
    } else if (url.hostname === 'basemaps.cartocdn.com') {
      // Genuine full external style replacement, deterministic resources, no real credential.
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 8,
        sources: {}, layers: [{ id: 'synthetic-background', type: 'background', paint: { 'background-color': '#f3f5f7' } }] }) });
    } else if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) await route.continue();
    else await route.abort();
  });
  await page.goto('./');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30000 });
  await page.evaluate(async () => {
    const module = await import('/city-map-tools/__directional_probe.mjs');
    const root = document.createElement('div');
    root.id = 'directional-proof';
    root.innerHTML = '<p style="margin:8px;font:16px sans-serif">T1A synthetic renderer proof · blue forward / orange reverse · explicit display tracks</p><div id="proof-map" style="width:760px;height:600px"></div>';
    // Keep the production map mounted to detect interference; hide its UI for inspection.
    document.getElementById('root')!.style.display = 'none';
    document.body.append(root);
    (window as any).proofModule = module;
    (window as any).proof = module.mountDirectionalProof(document.getElementById('proof-map'));
  });
  await expect.poll(() => page.evaluate(() => (window as any).proof.state())).toBe('ready');
  expect(await page.evaluate(() => (window as any).proof.install())).toMatchObject({ ok: true });
  await expect.poll(() => page.evaluate(() => (window as any).proof.diagnostics().layers)).toBe(2);
  return problems;
}

async function alignment(page: Page) {
  await expect.poll(async () => page.evaluate(async () => {
    const hits = await (window as any).proof.renderedAlignment();
    return hits.length > 15 && hits.every((hit: any) => hit.line && hit.symbol);
  }), { timeout: 10000 }).toBe(true);
}

test('T1A actual line/static/animated tracks, local bearings, crossing and immutable WGS84 fixtures', async ({ page, request }, testInfo) => {
  const problems = await setup(page, request);
  await page.evaluate(() => (window as any).proof.static(true));
  await alignment(page);
  const actual = await page.evaluate(async () => {
    const p = (window as any).proof;
    const data = await p.data();
    const lines = data.lines.features.map((f: any) => ({ id: f.id, points: f.geometry.coordinates.map((c: any) => p.project(c)) }));
    const arrows = data.arrows.features.map((f: any) => ({ id: f.properties.movementId, bearing: f.properties.bearing, ...p.project(f.geometry.coordinates) }));
    return { lines, arrows, diagnostics: p.diagnostics(), unchanged: p.unchanged() };
  });
  expect(actual.unchanged).toBe(true);
  expect(actual.diagnostics.running).toBe(false);
  for (const [id, y, bearing] of [['straight-forward', 106, 90], ['straight-reverse', 134, 270]] as const) {
    const line = actual.lines.find((line: any) => line.id === id);
    expect(line.points).toHaveLength(3);
    for (const point of line.points) expect(Math.abs(point.y - y)).toBeLessThan(0.01);
    for (const arrow of actual.arrows.filter((arrow: any) => arrow.id === id)) {
      expect(Math.abs(arrow.y - y)).toBeLessThan(0.01);
      expect(Math.abs(arrow.bearing - bearing)).toBeLessThan(0.01);
    }
  }
  // Crossings retain both exact through paths, with no gap, bridge or automatic offset.
  expect(actual.lines.find((line: any) => line.id === 'cross-east').points.map((p: any) => Math.round(p.y))).toEqual([500, 500]);
  expect(actual.lines.find((line: any) => line.id === 'cross-north').points.map((p: any) => Math.round(p.x))).toEqual([540, 540]);
  const uturn = actual.arrows.filter((arrow: any) => arrow.id === 'uturn');
  expect(uturn.some((p: any) => p.bearing > 80 && p.bearing < 100)).toBe(true);
  expect(uturn.some((p: any) => p.bearing > 260 && p.bearing < 280)).toBe(true);
  expect(new Set(actual.arrows.filter((p: any) => p.id.startsWith('curve')).map((p: any) => Math.round(p.bearing))).size).toBeGreaterThan(4);
  await page.screenshot({ path: testInfo.outputPath('t1a-static.png') });
  await page.evaluate(() => (window as any).proof.static(false));
  await alignment(page);
  const arrowsBefore = await page.evaluate(async () => (await (window as any).proof.data()).arrows.features);
  const before = await page.evaluate(() => (window as any).proof.diagnostics());
  await page.waitForTimeout(1050);
  const after = await page.evaluate(() => (window as any).proof.diagnostics());
  const deltas = await page.evaluate(async previous => {
    const p = (window as any).proof;
    const current = (await p.data()).arrows.features;
    return ['straight-forward:0', 'straight-reverse:0'].map(id => {
      const a = previous.find((f: any) => f.id === id);
      const b = current.find((f: any) => f.id === id);
      return p.project(b.geometry.coordinates).x - p.project(a.geometry.coordinates).x;
    });
  }, arrowsBefore);
  expect(deltas[0]).toBeGreaterThan(15); expect(deltas[0]).toBeLessThan(80);
  expect(deltas[1]).toBeLessThan(-15); expect(deltas[1]).toBeGreaterThan(-80);
  expect(after.updates - before.updates).toBeGreaterThan(5);
  expect(after.updates - before.updates).toBeLessThanOrEqual(28);
  expect(after.inputRebuilds).toBe(before.inputRebuilds);
  expect(after.projectionRebuilds).toBe(before.projectionRebuilds);
  expect(after.pendingFrames).toBe(1);
  expect(after.arrowFeatures).toBeLessThanOrEqual(512);
  expect(await page.locator('#proof-map .maplibregl-marker').count()).toBe(0);
  expect(await page.evaluate(() => (window as any).proof.reuse())).toMatchObject({ ok: true });
  expect((await page.evaluate(() => (window as any).proof.diagnostics())).inputRebuilds).toBe(after.inputRebuilds);
  await page.evaluate(() => (window as any).proof.camera());
  await alignment(page);
  expect(await page.evaluate(() => (window as any).proof.unchanged())).toBe(true);
  await testInfo.attach('architecture-diagnostics', { body: JSON.stringify({ before, after }), contentType: 'application/json' });
  await writeFile(testInfo.outputPath('architecture-diagnostics.json'), JSON.stringify({ before, after }, null, 2));
  await page.evaluate(() => (window as any).proof.destroy());
  expect(problems).toEqual([]);
});

test('T1B rendered partial-corridor tracks, taper, crossings, ordering, immutable inputs and bounded frame work', async ({ page, request }, testInfo) => {
  const problems = await setup(page, request);
  expect(await page.evaluate(() => (window as any).proof.installLayout())).toMatchObject({ ok: true });
  await page.evaluate(() => (window as any).proof.static(true));
  await alignment(page);
  const tracks = () => page.evaluate(async () => {
    const p = (window as any).proof;
    return (await p.data()).lines.features.map((f: any) => ({ id: f.id, points: f.geometry.coordinates.map((c: any) => p.project(c)) }));
  });
  const lines = await tracks();
  const approach = (id: string, x: number) => lines.find((line: any) => line.id === id).points.find((p: any) => Math.abs(p.x - x) < 0.05);
  expect(approach('approach-a', 160).y).toBeCloseTo(106, 1);
  expect(approach('approach-b', 160).y).toBeCloseTo(120, 1);
  expect(approach('approach-c', 160).y).toBeCloseTo(134, 1);
  expect(approach('approach-b', 480).y).toBeCloseTo(120, 1);
  const tapered = lines.find((line: any) => line.id === 'approach-a').points.filter((p: any) => p.x > 300 && p.x < 332);
  expect(tapered.length).toBeGreaterThan(2);
  expect(tapered.every((p: any) => p.y > 106 && p.y < 120)).toBe(true);
  expect(await page.evaluate(() => (window as any).proof.renderedCrossing())).toEqual(['cross-east', 'cross-north']);
  await page.screenshot({ path: testInfo.outputPath('t1b-static.png') });
  await page.evaluate(() => (window as any).proof.reverseLayout());
  await alignment(page);
  expect(await tracks()).toEqual(lines);
  await page.evaluate(() => (window as any).proof.static(false));
  await alignment(page);
  const before = await page.evaluate(() => (window as any).proof.diagnostics());
  await page.waitForTimeout(1050);
  const after = await page.evaluate(() => (window as any).proof.diagnostics());
  expect(after.updates - before.updates).toBeGreaterThan(5);
  expect(after.layoutRebuilds).toBe(before.layoutRebuilds);
  expect(after.layout).toEqual(before.layout);
  expect(after.layout.sharedRuns).toBeGreaterThanOrEqual(5);
  expect(after.layout.sampleCount).toBeLessThanOrEqual(8192);
  expect(after.layout.candidateChecks).toBeLessThanOrEqual(131072);
  expect(after.layout.profileChecks).toBeLessThanOrEqual(131072);
  expect(after.layout.fallback).toBe(false);
  expect(after).toMatchObject({ sources: 2, layers: 2, pendingFrames: 1, ownedListeners: 4 });
  await page.evaluate(() => (window as any).proof.static(true));
  const ordering = () => page.evaluate(async () => {
    const p = (window as any).proof, data = await p.data();
    return data.lines.features.filter((f: any) => f.id.startsWith('approach')).map((f: any) => ({ id: f.id, y: p.project(f.geometry.coordinates[0]).y })).sort((a: any, b: any) => a.y - b.y).map((f: any) => f.id);
  });
  expect(await ordering()).toEqual(['approach-a', 'approach-b', 'approach-c']);
  await page.evaluate(() => (window as any).proof.panZoom());
  await alignment(page);
  expect(await ordering()).toEqual(['approach-a', 'approach-b', 'approach-c']);
  for (const voyager of [true, false]) {
    expect(await page.evaluate(v => (window as any).proof.switchStyle(v), voyager)).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as any).proof.state())).toBe('ready');
    await alignment(page);
    expect(await ordering()).toEqual(['approach-a', 'approach-b', 'approach-c']);
  }
  await page.evaluate(() => (window as any).proof.manualLayout());
  await alignment(page);
  expect(await ordering()).toEqual(['approach-b', 'approach-c', 'approach-a']);
  expect(await page.evaluate(() => (window as any).proof.unchanged())).toBe(true);
  await writeFile(testInfo.outputPath('t1b-diagnostics.json'), JSON.stringify({ before, after }, null, 2));
  await testInfo.attach('t1b-diagnostics', { body: JSON.stringify({ before, after }), contentType: 'application/json' });
  await page.evaluate(() => (window as any).proof.destroy());
  expect(problems).toEqual([]);
});

test('T1A reduced motion, owned visibility lifecycle, full style replacements and destroy/remount', async ({ page, request }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const problems = await setup(page, request);
  await expect.poll(() => page.evaluate(() => ({ diagnostics: (window as any).proof.diagnostics(), listeners: (window as any).proof.listenerEvidence() }))).toMatchObject({ diagnostics: { running: false, reducedMotion: true }, listeners: { registered: 4, removed: 0 } });
  await alignment(page);
  const reduced = await page.evaluate(() => (window as any).proof.diagnostics());
  await page.waitForTimeout(200);
  expect((await page.evaluate(() => (window as any).proof.diagnostics())).updates).toBe(reduced.updates);
  await page.screenshot({ path: testInfo.outputPath('t1a-reduced-motion.png') });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // Chromium headless exposes matches reliably; explicit change notification avoids native event-delivery races.
  await page.evaluate(() => (window as any).proof.notifyMotion());
  await expect.poll(() => page.evaluate(() => (window as any).proof.diagnostics().running)).toBe(true);
  // Deterministic Page Visibility event harness; the production document listener handles it.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = await page.evaluate(() => (window as any).proof.diagnostics());
  expect(hidden.running).toBe(false); expect(hidden.pendingFrames).toBe(0);
  await page.waitForTimeout(300);
  expect((await page.evaluate(() => (window as any).proof.diagnostics())).updates).toBe(hidden.updates);
  await page.evaluate(() => { delete (document as any).hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(160);
  const visible = await page.evaluate(() => (window as any).proof.diagnostics());
  expect(visible.running).toBe(true); expect(visible.pendingFrames).toBe(1);
  expect(visible.updates - hidden.updates).toBeLessThanOrEqual(5);
  for (const voyager of [true, false, true, false]) {
    expect(await page.evaluate(v => (window as any).proof.switchStyle(v), voyager)).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as any).proof.state())).toBe('ready');
    await alignment(page);
    expect(await page.evaluate(() => (window as any).proof.resourceIds())).toEqual({
      sources: ['city-map-directional-tracks', 'city-map-directional-arrows'],
      layers: ['city-map-directional-line', 'city-map-directional-symbol'],
    });
    expect((await page.evaluate(() => (window as any).proof.diagnostics())).ownedListeners).toBe(4);
  }
  await page.evaluate(() => (window as any).proof.destroy());
  const destroyed = await page.evaluate(() => (window as any).proof.diagnostics());
  expect(await page.evaluate(() => (window as any).proof.listenerEvidence())).toEqual({ registered: 4, removed: 4 });
  expect(destroyed).toMatchObject({ destroyed: true, running: false, pendingFrames: 0, sources: 0, layers: 0, ownedListeners: 0, arrowFeatures: 0 });
  await page.waitForTimeout(160);
  expect((await page.evaluate(() => (window as any).proof.diagnostics())).updates).toBe(destroyed.updates);
  expect(await page.evaluate(() => (window as any).proof.unchanged())).toBe(true);
  await page.evaluate(() => { (window as any).oldProof = (window as any).proof; (window as any).proof = (window as any).proofModule.mountDirectionalProof(document.getElementById('proof-map')); });
  await expect.poll(() => page.evaluate(() => (window as any).proof.state())).toBe('ready');
  await page.evaluate(() => (window as any).proof.install());
  await alignment(page);
  expect((await page.evaluate(() => (window as any).proof.diagnostics())).pendingFrames).toBe(1);
  expect((await page.evaluate(() => (window as any).oldProof.diagnostics())).updates).toBe(destroyed.updates);
  await page.evaluate(() => (window as any).proof.destroy());
  expect(problems).toEqual([]);
});

test('T1A local input rejection and bounded maximum workload', async ({ page, request }, testInfo) => {
  const problems = await setup(page, request);
  const before = await page.evaluate(() => (window as any).proof.diagnostics());
  expect(await page.evaluate(() => (window as any).proof.invalid())).toMatchObject({ ok: false });
  expect(await page.evaluate(() => (window as any).proof.overCap())).toMatchObject({ ok: false });
  expect((await page.evaluate(() => (window as any).proof.diagnostics())).inputRebuilds).toBe(before.inputRebuilds);
  expect(await page.evaluate(() => (window as any).proof.atCap())).toMatchObject({ ok: true });
  const cap = await page.evaluate(() => (window as any).proof.diagnostics());
  expect(cap.inputs).toBe(24);
  expect(cap.arrowFeatures).toBe(504);
  expect(cap.limitations.join(' ')).toContain('display spacing increased');
  expect(cap.sources).toBe(2); expect(cap.layers).toBe(2);
  await page.waitForTimeout(1000);
  const end = await page.evaluate(() => (window as any).proof.diagnostics());
  expect(end.updates - cap.updates).toBeGreaterThan(0);
  expect(end.updates - cap.updates).toBeLessThanOrEqual(26);
  expect(end.projectionRebuilds).toBe(cap.projectionRebuilds);
  expect(end.pendingFrames).toBe(1);
  await testInfo.attach('maximum-workload', { body: JSON.stringify({ cap, end }), contentType: 'application/json' });
  await writeFile(testInfo.outputPath('maximum-workload.json'), JSON.stringify({ cap, end }, null, 2));
  await page.evaluate(() => (window as any).proof.destroy());
  expect(problems).toEqual([]);
});
