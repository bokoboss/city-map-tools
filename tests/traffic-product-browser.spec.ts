import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
import { readActiveProjectRecord, writeProjectRecord, readProjectRecords } from './project-browser-helpers';
import { createAuthoredLineString } from '../src/features/featureModel';
import { DEFAULT_TRAFFIC_MOVEMENT_STYLE } from '../src/project/trafficMovement';
import { createProjectDocument as createV1, serializeProjectDocument as serializeV1 } from '../src/project/projectDocumentV1';

const tracksId = 'city-map-directional-tracks';
const arrowsId = 'city-map-directional-arrows';
const genericId = 'city-map-committed-geometry';

async function start(page: Page, request: APIRequestContext, readyTimeout = 30000) {
  const problems: string[] = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
  Object.assign(page, { trafficProblems: problems });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (route.request().resourceType() === 'document' && url.pathname === '/city-map-tools/') {
      const response = await route.fetch();
      const html = (await response.text()).replace(/<script type="module"[^>]*src="[^"]*app.js"[^>]*><\/script>/,
        '<script type="module">import "./__traffic_probe.js"; await import("./app.js");</script>');
      await route.fulfill({ response, body: html });
    } else if (url.hostname === 'tile.openstreetmap.org') {
      const tile = await request.get('http://127.0.0.1:4175/tile.png');
      await route.fulfill({ contentType: 'image/png', body: await tile.body() });
    } else if (url.hostname === 'basemaps.cartocdn.com') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {},
        layers: [{ id: 'local-background', type: 'background', paint: { 'background-color': '#f3f5f7' } }] }) });
    } else if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) await route.continue();
    else await route.abort();
  });
  await page.goto('./');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: readyTimeout });
}

async function stored(page: Page) { return JSON.parse((await readActiveProjectRecord(page)).value as string); }
async function source(page: Page, id: string): Promise<any[]> {
  return page.evaluate(async id => (await (window as any).trafficProbe.source(id)).features, id);
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Save now', exact: true }).click();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
}
async function numeric(page: Page, name: string, value: string) {
  await page.getByLabel(name, { exact: true }).fill(value);
  await page.getByLabel(name, { exact: true }).press('Enter');
}
async function rendered(page: Page) {
  await expect.poll(() => source(page, tracksId).then(f => f.length)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(async () => {
    const p = (window as any).trafficProbe;
    const map = p.map();
    const arrows = (await p.source('city-map-directional-arrows')).features;
    return arrows.length > 0 && arrows.every((arrow: any) => {
      const pos = map.project(arrow.geometry.coordinates);
      return map.queryRenderedFeatures([[pos.x - 2, pos.y - 2], [pos.x + 2, pos.y + 2]],
        { layers: ['city-map-directional-line'] }).some((hit: any) => hit.properties.movementId === arrow.properties.movementId);
    });
  })).toBe(true);
}

test('production author draws, converts and reverses a movement without changing WGS84', async ({ page, request }) => {
  await start(page, request);
  const box = (await page.locator('.maplibregl-canvas').boundingBox())!;
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await page.mouse.click(box.x + 180, box.y + 250);
  await page.mouse.click(box.x + 480, box.y + 250);
  await page.mouse.click(box.x + 550, box.y + 360);
  await page.keyboard.press('Enter');
  await expect(page.locator('.feature-row')).toHaveCount(1);
  await page.mouse.click(box.x + 300, box.y + 250);
  await expect(page.getByRole('region', { name: 'Feature inspector' })).toBeVisible();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const before = await stored(page);
  await page.getByRole('button', { name: 'Convert to Traffic Movement', exact: true }).click();
  await page.getByLabel('Movement direction', { exact: true }).selectOption('reverse');
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const after = await stored(page);
  expect(after.features).toEqual(before.features);
  expect(after.trafficMovements[before.features[0].id].direction).toBe('reverse');
  await rendered(page);
  expect(await source(page, genericId)).toHaveLength(0);
  const arrows = await source(page, arrowsId);
  await expect.poll(() => source(page, arrowsId).then(f => JSON.stringify(f))).not.toBe(JSON.stringify(arrows));

  await page.getByLabel('Movement color', { exact: true }).fill('#ee4400');
  await numeric(page, 'Opacity', '0.8');
  await numeric(page, 'Line width (display px)', '5');
  await numeric(page, 'Arrow size (display px)', '30');
  await numeric(page, 'Visual arrow spacing (display px)', '60');
  await numeric(page, 'Visual display offset (px)', '25');
  await numeric(page, 'Visual layout order', '-2');
  await page.getByLabel('Visual animation rate', { exact: true }).selectOption('slow');
  await page.getByLabel('Automatic visual track layout', { exact: true }).uncheck();
  await save(page);
  const styled = await stored(page);
  expect(styled.trafficMovements[before.features[0].id].style).toEqual({
    color: '#ee4400', opacity: 0.8, lineWidthPixels: 5, arrowSizePixels: 30, arrowSpacingPixels: 60,
    displayOffsetPixels: 25, layoutOrder: -2, animationEnabled: true, animationRate: 'slow', autoLayout: false,
  });
  await numeric(page, 'Visual layout order', '25');
  await expect(page.getByRole('alert')).toContainText('must be between');
  expect(await stored(page)).toEqual(styled);

  // Pause changes neither bytes nor history. Undo still reverses the last style action.
  const raw = (await readActiveProjectRecord(page)).value;
  await page.getByRole('button', { name: 'Pause animated arrows', exact: true }).click();
  const paused = await source(page, arrowsId);
  await page.waitForTimeout(160);
  expect(await source(page, arrowsId)).toEqual(paused);
  expect((await readActiveProjectRecord(page)).value).toBe(raw);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  await page.getByRole('button', { name: 'Undo project edit', exact: true }).click();
  await expect(page.getByLabel('Automatic visual track layout', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Redo project edit', exact: true }).click();
  await expect(page.getByLabel('Automatic visual track layout', { exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Resume animated arrows', exact: true }).click();
  await page.getByLabel('Animation enabled', { exact: true }).uncheck();
  await rendered(page);
  const staticArrows = await source(page, arrowsId);
  await page.waitForTimeout(160);
  expect(await source(page, arrowsId)).toEqual(staticArrows);
  await save(page);
  const saved = await stored(page);
  await page.reload();
  await expect(page.locator('.map-status strong')).toHaveText('Ready');
  await page.locator('.feature-row').first().click();
  await expect(page.getByLabel('Movement direction', { exact: true })).toHaveValue('reverse');
  expect(await stored(page)).toEqual(saved);
  await rendered(page);
  await page.getByRole('button', { name: 'Unconvert to LineString', exact: true }).click();
  await save(page);
  expect((await stored(page)).features).toEqual(before.features);
  expect((await stored(page)).trafficMovements).toEqual({});
  await expect.poll(() => source(page, tracksId).then(f => f.length)).toBe(0);
  await expect.poll(() => source(page, genericId).then(f => f.length)).toBe(1);
  await page.mouse.click(box.x + 300, box.y + 250);
  await expect(page.getByRole('button', { name: 'Convert to Traffic Movement', exact: true })).toBeVisible();
  expect((page as any).trafficProblems).toEqual([]);
});

async function seedMovements(page: Page) {
  const doc = await stored(page);
  const paths = await page.evaluate(() => {
    const map = (window as any).trafficProbe.map();
    return [
      [[160, 250], [450, 250], [520, 180]], // left
      [[160, 250], [450, 250], [700, 250]], // through
      [[160, 250], [450, 250], [510, 290], [510, 340], [450, 380], [300, 380]], // U-turn
      [[580, 130], [580, 410]], // true crossing
      [[650, 330], [730, 330], [770, 400]], // right
      [[100, 440], [240, 440]], // ordinary line
    ].map(path => path.map(([x, y]) => { const p = map.unproject([x, y]); return [p.lng, p.lat]; }));
  });
  doc.features = paths.map((path: [number, number][], i: number) => createAuthoredLineString(`move-${i}`, path, i + 1));
  doc.trafficMovements = Object.fromEntries(doc.features.slice(0, 5).map((f: any, i: number) => [f.id, {
    direction: i === 1 ? 'reverse' : 'forward', style: { ...DEFAULT_TRAFFIC_MOVEMENT_STYLE,
      color: ['#2563eb', '#dd4400', '#009944', '#9933aa', '#222222'][i] },
  }]));
  await writeProjectRecord(page, `project:${doc.metadata.id}`, JSON.stringify(doc));
  await page.reload();
  await expect(page.locator('.map-status strong')).toHaveText('Ready');
  return doc;
}

test('production shared tracks pick the displayed ID, preserve crossings and survive editor/style/project lifecycles', async ({ page, request }) => {
  await start(page, request);
  const doc = await seedMovements(page);
  await page.getByRole('button', { name: 'Pause animated arrows', exact: true }).click();
  await rendered(page);
  const tracks = await source(page, tracksId);
  expect(tracks).toHaveLength(5);
  expect((await source(page, genericId)).map(f => f.id)).toEqual(['move-5']);
  const canvas = page.locator('.maplibregl-canvas');
  const box = (await canvas.boundingBox())!;
  for (const id of ['move-0', 'move-1', 'move-2']) {
    const pos = await page.evaluate(async id => {
      const p = (window as any).trafficProbe;
      const f = (await p.source('city-map-directional-tracks')).features.find((f: any) => f.id === id);
      const coords = f.geometry.coordinates;
      const positions = coords.map((c: number[]) => p.map().project(c)).filter((p: any) => Math.abs(p.y - 250) <= 15.1);
      return positions.reduce((a: any, b: any) => Math.abs(b.x - 300) < Math.abs(a.x - 300) ? b : a);
    }, id);
    expect(Math.abs(pos.y - 250)).toBeLessThanOrEqual(15);
    await page.mouse.click(box.x + pos.x, box.y + pos.y);
    await expect(page.locator('.inspector-id')).toHaveText(id);
  }
  const crossing = tracks.find(f => f.id === 'move-3');
  expect(crossing.geometry.coordinates).toHaveLength(doc.features[3].coordinates.length);
  // Display tracks pass through MapLibre project/unproject; Linux/Windows can
  // differ at the last few floating-point bits. Canonical storage stays exact.
  const crossingPixelError = await page.evaluate(({ display, canonical }) => {
    const map = (window as any).trafficProbe.map();
    return Math.max(...display.map((coordinate: number[], i: number) => {
      const a = map.project(coordinate), b = map.project(canonical[i]);
      return Math.hypot(a.x - b.x, a.y - b.y);
    }));
  }, { display: crossing.geometry.coordinates, canonical: doc.features[3].coordinates });
  expect(crossingPixelError).toBeLessThan(0.00001);
  expect((await stored(page)).features).toEqual(doc.features);
  await page.mouse.click(box.x + 160, box.y + 440);
  await expect(page.locator('.inspector-id')).toHaveText('move-5');

  // Move a real Terra Draw vertex; renderer and storage retain committed geometry.
  await page.locator('.feature-row').filter({ hasText: 'Line 1' }).click();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unconvert to LineString', exact: true })).toBeDisabled();
  const beforeEdit = await source(page, tracksId);
  await page.mouse.move(box.x + 520, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 540, box.y + 135, { steps: 8 });
  await page.mouse.up();
  expect(await source(page, tracksId)).toEqual(beforeEdit);
  expect((await stored(page)).features).toEqual(doc.features);
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click();
  expect(await source(page, tracksId)).toEqual(beforeEdit);
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await page.mouse.move(box.x + 520, box.y + 180);
  await page.mouse.down();
  await page.mouse.move(box.x + 540, box.y + 135, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Apply geometry', exact: true }).click();
  await save(page);
  expect((await stored(page)).features[0].coordinates).not.toEqual(doc.features[0].coordinates);
  await expect.poll(() => source(page, tracksId)).not.toEqual(beforeEdit);
  await rendered(page);
  await page.getByRole('button', { name: 'Hide Line 1', exact: true }).click();
  await expect.poll(() => source(page, tracksId).then(f => f.length)).toBe(4);
  await page.getByRole('button', { name: 'Show Line 1', exact: true }).click();
  const lineLayer = doc.layers.find((l: any) => l.id === doc.features[0].layerId);
  await page.getByRole('button', { name: `Hide ${lineLayer.name} layer`, exact: true }).click();
  await expect.poll(() => source(page, tracksId).then(f => f.length)).toBe(0);
  await page.getByRole('button', { name: `Show ${lineLayer.name} layer`, exact: true }).click();
  await expect.poll(() => source(page, tracksId).then(f => f.length)).toBe(5);
  await page.getByRole('button', { name: 'Delete feature', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await expect.poll(() => source(page, tracksId).then(f => f.length)).toBe(4);
  await page.getByRole('button', { name: 'Undo project edit', exact: true }).click();
  await expect.poll(() => source(page, tracksId).then(f => f.length)).toBe(5);
  for (let i = 0; i < 2; i++) {
    await page.getByLabel('CARTO Basemaps API key', { exact: true }).fill('local-test-placeholder');
    await page.getByRole('button', { name: 'Use key and switch to Voyager', exact: true }).click();
    await expect(page.locator('.map-status strong')).toHaveText('Ready');
    await rendered(page);
    await page.getByLabel('Provider', { exact: true }).selectOption('osm');
    await expect(page.locator('.map-status strong')).toHaveText('Ready');
    await rendered(page);
  }
  await page.getByRole('button', { name: 'Reload map', exact: true }).click();
  await expect(page.locator('.map-status strong')).toHaveText('Ready');
  await rendered(page);
  await expect(page.getByRole('button', { name: 'Resume animated arrows', exact: true })).toBeVisible();
  expect(await page.evaluate(() => {
    const p = (window as any).trafficProbe;
    return { oldRemoved: p.maps.slice(0, -1).every((m: any) => m._removed),
      layers: p.map().getStyle().layers.filter((l: any) => l.id.startsWith('city-map-directional-')).length,
      sources: Object.keys(p.map().getStyle().sources).filter(id => id.startsWith('city-map-directional-')).length };
  })).toEqual({ oldRemoved: true, layers: 2, sources: 2 });
  await save(page);
  const current = await stored(page);
  await page.getByRole('button', { name: 'Projects…', exact: true }).click();
  await page.getByLabel('New local project name', { exact: true }).fill('Empty traffic project');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect.poll(() => source(page, tracksId).then(f => f.length)).toBe(0);
  await expect(page.getByRole('button', { name: 'Pause animated arrows', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo project edit', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Projects…', exact: true }).click();
  await page.getByRole('button', { name: `Open project ${current.metadata.name}`, exact: true }).click();
  await rendered(page);
  expect((await stored(page)).features).toEqual(current.features);
  await page.locator('.feature-row').first().click();
  await page.getByRole('region', { name: 'Traffic Movement inspector', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/traffic-product-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Movement direction', { exact: true }).focus();
  await page.getByLabel('Movement direction', { exact: true }).press('ArrowDown');
  await page.getByLabel('Movement direction', { exact: true }).press('Tab');
  await expect(page.getByLabel('Movement color', { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'output/playwright/traffic-product-narrow.png' });
  expect((page as any).trafficProblems).toEqual([]);
});

test('production conversion cap is explained without a partial edit', async ({ page, request }) => {
  await start(page, request);
  const doc = await stored(page);
  doc.features = Array.from({ length: 25 }, (_, i) => createAuthoredLineString(`cap-${i}`, [[100.5, 13.75], [100.51, 13.75]], i + 1));
  doc.trafficMovements = Object.fromEntries(doc.features.slice(0, 24).map((f: any) => [f.id, {
    direction: 'forward', style: { ...DEFAULT_TRAFFIC_MOVEMENT_STYLE },
  }]));
  await writeProjectRecord(page, `project:${doc.metadata.id}`, JSON.stringify(doc));
  await page.reload();
  await expect(page.locator('.map-status strong')).toHaveText('Ready');
  await page.getByRole('button', { name: 'Line 25 authored', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Convert to Traffic Movement', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Traffic Movement inspector', exact: true })).toContainText('already has 24');
  await save(page);
  expect((await stored(page)).trafficMovements).toEqual(doc.trafficMovements);
  await expect(page.getByRole('button', { name: 'Undo project edit', exact: true })).toBeDisabled();
});

test('production style and canonical snapping become ready without controller idle delivery', async ({ page, request }) => {
  await page.addInitScript(() => { (window as any).trafficSuppressIdle = true; });
  await start(page, request, 5000);
  await seedMovements(page);
  await rendered(page);
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await expect(page.locator('.snap-indicator')).toHaveAttribute('data-index', 'ready');
  const box = (await page.locator('.maplibregl-canvas').boundingBox())!;
  await page.mouse.move(box.x + 160, box.y + 250);
  await expect(page.locator('.editor-status')).toContainText('Vertex snap');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.map-status strong')).toHaveText('Ready');
});

test('production color picker input stream commits one history action at finalization', async ({ page, request }) => {
  await start(page, request);
  await seedMovements(page);
  await page.locator('.feature-row').first().click();
  const color = page.getByLabel('Movement color', { exact: true });
  const raw = (await readActiveProjectRecord(page)).value;
  await color.focus();
  await color.evaluate(input => {
    for (const value of ['#110000', '#220000', '#330000', '#440000']) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await expect(page.getByRole('button', { name: 'Undo project edit', exact: true })).toBeDisabled();
  expect((await readActiveProjectRecord(page)).value).toBe(raw);
  await color.press('Tab');
  await save(page);
  expect((await stored(page)).trafficMovements['move-0'].style.color).toBe('#440000');
  await page.getByRole('button', { name: 'Undo project edit', exact: true }).click();
  await expect(color).toHaveValue('#2563eb');
  await expect(page.getByRole('button', { name: 'Undo project edit', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Redo project edit', exact: true }).click();
  await expect(color).toHaveValue('#440000');
});

test('production exact-crossing selection and directional layer order survive full style replacement', async ({ page, request }) => {
  await start(page, request);
  const doc = await stored(page);
  const paths = await page.evaluate(() => {
    const map = (window as any).trafficProbe.map();
    return [[[200, 300], [600, 300]], [[400, 180], [400, 420]]].map(path => path.map(([x, y]) => {
      const p = map.unproject([x, y]); return [p.lng, p.lat];
    }));
  });
  doc.features = paths.map((path: [number, number][], i: number) => createAuthoredLineString(`cross-${i}`, path, i + 1));
  await writeProjectRecord(page, `project:${doc.metadata.id}`, JSON.stringify(doc));
  await page.reload();
  await expect(page.locator('.map-status strong')).toHaveText('Ready');
  await page.locator('.feature-row').first().click();
  await page.getByRole('button', { name: 'Convert to Traffic Movement', exact: true }).click();
  await page.getByRole('button', { name: 'Pause animated arrows', exact: true }).click();
  const verify = async () => {
    await rendered(page);
    const box = (await page.locator('.maplibregl-canvas').boundingBox())!;
    await expect.poll(() => page.evaluate(() => {
      const map = (window as any).trafficProbe.map();
      return map.queryRenderedFeatures([400, 300], { layers: ['city-map-lines', 'city-map-directional-line'] }).length;
    })).toBe(2);
    await page.mouse.click(box.x + 400, box.y + 300);
    await expect(page.locator('.inspector-id')).toHaveText('cross-0');
    const order = await page.evaluate(() => (window as any).trafficProbe.map().getStyle().layers.map((l: any) => l.id));
    expect(order.indexOf('city-map-directional-line')).toBeGreaterThan(order.indexOf('city-map-lines'));
    expect(order.indexOf('city-map-directional-line')).toBeGreaterThan(order.indexOf('city-map-polygons-fill'));
    expect(order.indexOf('city-map-directional-symbol')).toBeGreaterThan(order.indexOf('city-map-directional-line'));
  };
  await verify();
  await page.getByLabel('CARTO Basemaps API key', { exact: true }).fill('local-test-placeholder');
  await page.getByRole('button', { name: 'Use key and switch to Voyager', exact: true }).click();
  await expect(page.locator('.map-status strong')).toHaveText('Ready');
  await verify();
  await page.getByLabel('Provider', { exact: true }).selectOption('osm');
  await expect(page.locator('.map-status strong')).toHaveText('Ready');
  await verify();
});

test('production reduced motion, hidden page and global pause are transient with no React frame churn', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page, request);
  await seedMovements(page);
  await rendered(page);
  const staticArrows = await source(page, arrowsId);
  await page.waitForTimeout(180);
  expect(await source(page, arrowsId)).toEqual(staticArrows);
  const raw = (await readActiveProjectRecord(page)).value;
  // Headless media event delivery can lag; reloading also proves initial native preference.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  await expect(page.locator('.map-status strong')).toHaveText('Ready');
  await rendered(page);
  await page.evaluate(() => {
    (window as any).trafficMutations = 0;
    const observer = new MutationObserver(records => { (window as any).trafficMutations += records.length; });
    observer.observe(document.querySelector('.map-controls')!, { childList: true, subtree: true, attributes: true, characterData: true });
    (window as any).trafficObserver = observer;
  });
  const animated = await source(page, arrowsId);
  await expect.poll(() => source(page, arrowsId).then(f => JSON.stringify(f))).not.toBe(JSON.stringify(animated));
  expect(await page.evaluate(() => (window as any).trafficMutations)).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hidden = await source(page, arrowsId);
  await page.waitForTimeout(180);
  expect(await source(page, arrowsId)).toEqual(hidden);
  await page.getByRole('button', { name: 'Pause animated arrows', exact: true }).click();
  await page.evaluate(() => {
    delete (document as any).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const stillPaused = await source(page, arrowsId);
  await page.waitForTimeout(180);
  expect(await source(page, arrowsId)).toEqual(stillPaused);
  await page.getByRole('button', { name: 'Resume animated arrows', exact: true }).click();
  await expect.poll(() => source(page, arrowsId).then(f => JSON.stringify(f))).not.toBe(JSON.stringify(stillPaused));
  expect((await readActiveProjectRecord(page)).value).toBe(raw);
  await expect(page.getByRole('button', { name: 'Undo project edit', exact: true })).toBeDisabled();
  expect((page as any).trafficProblems).toEqual([]);
});

test('production legacy Convert preserves exact backup and local display failures preserve valid movements', async ({ page, request }) => {
  await start(page, request);
  const doc = await seedMovements(page);
  const legacy = serializeV1(createV1({ metadata: doc.metadata, layers: doc.layers, features: doc.features,
    presentation: doc.presentation }));
  await writeProjectRecord(page, `project:${doc.metadata.id}`, legacy);
  await page.reload();
  await expect(page.locator('.map-status strong')).toHaveText('Ready');
  await save(page);
  expect((await readActiveProjectRecord(page)).value).toBe(legacy);
  await page.locator('.feature-row').first().click();
  await page.getByRole('button', { name: 'Convert to Traffic Movement', exact: true }).click();
  await save(page);
  const records = await readProjectRecords(page);
  expect(records[`migration-backup:v1:${doc.metadata.id}`]).toBe(legacy);
  const converted = await stored(page);
  expect(converted.features).toEqual(doc.features);
  await rendered(page);
  // Valid WGS84 outside the accepted Web Mercator display contract is retained,
  // diagnosed locally, and never silently painted as a generic movement stroke.
  converted.features.push(createAuthoredLineString('polar', [[100, 86], [101, 87]], 7));
  converted.trafficMovements.polar = { direction: 'forward', style: { ...DEFAULT_TRAFFIC_MOVEMENT_STYLE } };
  const imported = createAuthoredLineString('imported', [[100.5, 13.75], [100.51, 13.75]], 8);
  converted.features.push({ ...imported, lineage: 'imported' });
  await writeProjectRecord(page, `project:${doc.metadata.id}`, JSON.stringify(converted));
  await page.reload();
  await expect(page.locator('.map-status strong')).toHaveText('Ready');
  await expect(page.locator('.movement-notice')).toContainText('polar');
  await expect(page.locator('.movement-notice')).toContainText('Web Mercator');
  await rendered(page);
  expect((await source(page, tracksId)).map(f => f.id)).toEqual(['move-0']);
  expect((await source(page, genericId)).map(f => f.id)).not.toContain('polar');
  await page.getByRole('button', { name: 'Line 8 imported', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Convert to Traffic Movement', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Traffic Movement inspector', exact: true })).toContainText('Only authored');
  expect((page as any).trafficProblems).toEqual([]);
});
