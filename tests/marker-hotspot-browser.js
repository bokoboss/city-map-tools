// Production-preview marker hotspot evidence via playwright-cli run-code --filename tests/marker-hotspot-browser.js
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const pageErrors = [];
  const consoleProblems = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  const ready = () => page.locator('.map-status strong').filter({ hasText: /^Ready$/ }).waitFor({ timeout: 30000 });
  const switchBasemap = async id => {
    const enteredLoading = page.locator('.map-status strong').filter({ hasText: /^Loading$/ }).waitFor({ timeout: 5000 });
    await page.getByLabel('Provider', { exact: true }).selectOption(id);
    await enteredLoading;
    await ready();
  };
  const close = (actual, expected, message) => check(Math.abs(actual - expected) <= 1, `${message}: ${actual} vs ${expected}`);
  const mapClick = async (xRatio, yRatio) => {
    const box = await page.locator('.maplibregl-canvas').boundingBox();
    if (!box) throw new Error('Map canvas has no bounds.');
    await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
  };
  const markerMetrics = async () => page.locator('.point-marker-root').evaluate(root => {
    const rootRect = root.getBoundingClientRect();
    const marker = root.querySelector('.point-marker');
    const dot = root.querySelector('.point-marker-dot');
    const pin = root.querySelector('.point-marker-pin');
    const label = root.querySelector('.point-marker-label');
    if (!marker || !dot || !pin || !label) throw new Error('Marker presentation DOM is incomplete.');
    const dotRect = dot.getBoundingClientRect();
    const pinRect = pin.getBoundingClientRect();
    return {
      hotspot: root.dataset.hotspot,
      markerKind: marker.dataset.markerKind,
      rootX: rootRect.left,
      rootY: rootRect.top,
      dotX: dotRect.left + dotRect.width / 2,
      dotY: dotRect.top + dotRect.height / 2,
      pinTipX: pinRect.left + pinRect.width / 2,
      pinTipY: pinRect.bottom,
      labelHidden: label.hidden,
    };
  });
  const canonicalGeometry = async () => page.locator('.inspector-field').first().innerText();
  const assertRootStable = async (baseline, geometry, scenario) => {
    const current = await markerMetrics();
    close(current.rootX, baseline.rootX, `${scenario} preserves hotspot x`);
    close(current.rootY, baseline.rootY, `${scenario} preserves hotspot y`);
    check(await canonicalGeometry() === geometry, `${scenario} preserves canonical Point geometry`);
    return current;
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:4173/city-map-tools/');
  await ready();
  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  await mapClick(0.54, 0.54);
  await page.getByLabel('Name', { exact: true }).fill('Point');
  await page.getByLabel('Buffer radius (metres)', { exact: true }).fill('55');
  await page.getByRole('button', { name: 'Create derived buffer', exact: true }).click();
  await page.getByRole('button', { name: 'Point authored', exact: true }).click();

  const baseline = await markerMetrics();
  const baselineGeometry = await canonicalGeometry();
  check(baseline.hotspot === 'center' && baseline.markerKind === 'dot', 'dot declares center hotspot');
  close(baseline.dotX, baseline.rootX, 'dot center aligns with hotspot x');
  close(baseline.dotY, baseline.rootY, 'dot center aligns with hotspot y');

  await page.getByLabel('Show point label', { exact: true }).uncheck();
  check((await assertRootStable(baseline, baselineGeometry, 'label off')).labelHidden, 'label can be hidden without moving hotspot');
  await page.getByLabel('Show point label', { exact: true }).check();
  check(!(await assertRootStable(baseline, baselineGeometry, 'label on')).labelHidden, 'label can be restored without moving hotspot');

  for (const position of ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']) {
    await page.getByLabel('Label position', { exact: true }).selectOption(position);
    await assertRootStable(baseline, baselineGeometry, `label ${position}`);
  }

  await page.getByLabel('Name', { exact: true }).fill('A deliberately much longer point label must remain presentation only');
  await assertRootStable(baseline, baselineGeometry, 'long label');
  await page.getByLabel('Name', { exact: true }).fill('Point');
  await assertRootStable(baseline, baselineGeometry, 'short label restored');

  await page.getByLabel('Marker size', { exact: true }).selectOption('32');
  const largerDot = await assertRootStable(baseline, baselineGeometry, 'marker size change');
  close(largerDot.dotX, largerDot.rootX, 'larger dot center aligns with hotspot x');
  close(largerDot.dotY, largerDot.rootY, 'larger dot center aligns with hotspot y');

  await page.getByLabel('Marker type', { exact: true }).selectOption('pin');
  const pin = await assertRootStable(baseline, baselineGeometry, 'dot to pin switch');
  check(pin.hotspot === 'bottom-center' && pin.markerKind === 'pin', 'pin declares tip hotspot');
  close(pin.pinTipX, pin.rootX, 'pin tip aligns with hotspot x');
  close(pin.pinTipY, pin.rootY, 'pin tip aligns with hotspot y');
  await page.screenshot({ path: '.playwright-cli/r1a3-marker-pin.png', fullPage: false });

  await page.getByLabel('Marker type', { exact: true }).selectOption('dot');
  const dotAgain = await assertRootStable(baseline, baselineGeometry, 'pin to dot switch');
  close(dotAgain.dotX, dotAgain.rootX, 'restored dot center aligns with hotspot x');
  close(dotAgain.dotY, dotAgain.rootY, 'restored dot center aligns with hotspot y');
  await page.screenshot({ path: '.playwright-cli/r1a3-marker-dot.png', fullPage: false });

  const marker = page.locator('.point-marker');
  await marker.click();
  check(await page.locator('.inspector-id').innerText() === 'point-1', 'hotspot-rooted marker click selects Point');
  await marker.focus();
  check(await marker.evaluate(element => document.activeElement === element), 'hotspot-rooted marker remains keyboard focusable');

  await switchBasemap('voyager');
  const cartoDot = await assertRootStable(baseline, baselineGeometry, 'OSM to CARTO style replacement');
  close(cartoDot.dotX, cartoDot.rootX, 'CARTO dot center aligns with hotspot x');
  close(cartoDot.dotY, cartoDot.rootY, 'CARTO dot center aligns with hotspot y');
  await switchBasemap('osm');
  const osmDot = await assertRootStable(baseline, baselineGeometry, 'CARTO to OSM style replacement');
  close(osmDot.dotX, osmDot.rootX, 'restored OSM dot center aligns with hotspot x');
  close(osmDot.dotY, osmDot.rootY, 'restored OSM dot center aligns with hotspot y');

  check(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`);
  check(consoleProblems.length === 0, `console problems: ${consoleProblems.join('; ')}`);
  return {
    result: 'PASS',
    pageErrors,
    consoleProblems,
    scenarios: [
      'dot center and pin tip align with hotspot-root',
      'label visibility/text/all eight positions preserve hotspot and canonical geometry',
      'marker size and dot/pin switches preserve hotspot and canonical geometry',
      'marker selection/focus and OSM/CARTO/OSM persistence',
    ],
  };
}
