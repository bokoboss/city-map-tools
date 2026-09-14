// Production-preview lifecycle evidence via playwright-cli run-code --filename tests/map-lifecycle-browser.js
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const pageErrors = [];
  const consoleProblems = [];
  let expectedProviderFailure = false;
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (!expectedProviderFailure && (message.type() === 'error' || message.type() === 'warning')) {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });

  const status = page.locator('.map-status strong');
  const ready = async (stage = 'map') => {
    const isReady = await status.filter({ hasText: /^Ready$/ }).waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
    if (isReady) return;
    const [provider, currentStatus, buildingReason] = await Promise.all([
      page.getByLabel('Provider', { exact: true }).inputValue(),
      page.locator('.map-status').innerText(),
      page.locator('#building-reason').innerText(),
    ]);
    throw new Error(`${stage}: map did not become Ready (provider ${provider}; ${currentStatus}; ${buildingReason})`);
  };
  const loading = () => status.filter({ hasText: /^Loading$/ }).waitFor({ timeout: 5000 });
  const completeTransition = async (enteredLoading, stage, expectReady = true) => {
    // The loopback OSM fixture may finish a style swap between browser DOM
    // polling turns. In that fast path, give MapLibre a bounded turn to settle
    // and then require Ready; provider failure still produces ready()'s
    // diagnostic instead of being treated as a successful transition.
    const sawLoading = await Promise.race([
      enteredLoading,
      page.waitForTimeout(350).then(() => false),
    ]);
    if (!sawLoading) await page.waitForTimeout(250);
    if (expectReady) await ready(stage);
  };
  const switchBasemap = async id => {
    const enteredLoading = loading().then(() => true).catch(() => false);
    await page.getByLabel('Provider', { exact: true }).selectOption(id);
    check(await page.getByLabel('Provider', { exact: true }).inputValue() === id, `${id} provider selection applied`);
    await completeTransition(enteredLoading, `after ${id} style replacement`);
  };
  const reloadMap = async (expectReady = true) => {
    const enteredLoading = loading().then(() => true).catch(() => false);
    await page.getByRole('button', { name: 'Reload map', exact: true }).click();
    await completeTransition(enteredLoading, 'after map remount', expectReady);
  };
  const mapClick = async (xRatio, yRatio) => {
    const box = await page.locator('.maplibregl-canvas').boundingBox();
    if (!box) throw new Error('Map canvas has no bounds.');
    await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
  };
  const drawLine = async () => {
    const line = { startX: 0.38, startY: 0.5, endX: 0.62, endY: 0.62 };
    await page.getByRole('button', { name: 'Line tool', exact: true }).click();
    await mapClick(line.startX, line.startY);
    await mapClick(line.endX, line.endY);
    await page.keyboard.press('Enter');
    return line;
  };

  // Geometry and marker fixtures exercise live OSM/CARTO. This fixture controls
  // the normal OSM payload so its error/recovery assertions do not depend on a
  // public tile provider's momentary rate limit or availability.
  await page.unroute('https://tile.openstreetmap.org/**');
  const tileResponse = await page.request.get('http://127.0.0.1:4175/tile.png');
  check(tileResponse.ok(), 'local lifecycle tile fixture is available');
  await page.route('https://tile.openstreetmap.org/**', async route => {
    // Fetch a fresh response for every tile. A single APIResponse body is
    // consumed by the first style and cannot be reused across remounts.
    const response = await page.request.get('http://127.0.0.1:4175/tile.png');
    await route.fulfill({ status: response.status(), contentType: 'image/png', body: await response.body() });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:4173/city-map-tools/');
  await ready('initial OSM load');
  check(await page.getByLabel('Provider', { exact: true }).inputValue() === 'osm', 'initial provider is OSM');
  const buildings = page.locator('.building-control button');
  check(await buildings.isDisabled(), 'raster OSM keeps 3D control disabled');
  check((await page.locator('#building-reason').innerText()).includes('3D unavailable'), 'OSM reports why 3D is unavailable');

  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  await mapClick(0.54, 0.54);
  await page.getByLabel('Name', { exact: true }).fill('Lifecycle point');
  const line = await drawLine();
  check(await page.locator('.inspector-id').innerText() === 'line-1', 'drawn LineString is selected before lifecycle checks');

  await switchBasemap('voyager');
  check(await page.getByLabel('Provider', { exact: true }).inputValue() === 'voyager', 'CARTO provider applies after loading');
  const marker = page.locator('.point-marker');
  check(await marker.count() === 1, 'point marker survives OSM to CARTO replacement');
  await marker.click();
  check(await page.locator('.inspector-id').innerText() === 'point-1', 'surviving marker still selects its Point');
  await mapClick(line.endX, line.endY);
  check(await page.locator('.inspector-id').innerText() === 'line-1', 'committed LineString survives OSM to CARTO replacement');

  if (await buildings.isDisabled()) {
    check((await page.locator('#building-reason').innerText()).includes('3D unavailable'), 'CARTO explains unavailable 3D when no compatible buildings exist');
  } else {
    check(await buildings.getAttribute('aria-pressed') === 'false', 'available CARTO 3D starts off');
    await buildings.click();
    check(await buildings.getAttribute('aria-pressed') === 'true', 'available CARTO 3D turns on');
    await buildings.click();
    check(await buildings.getAttribute('aria-pressed') === 'false', 'available CARTO 3D turns back off');
  }

  await switchBasemap('osm');
  check(await marker.count() === 1, 'point marker survives CARTO to OSM replacement');
  await mapClick(line.endX, line.endY);
  check(await page.locator('.inspector-id').innerText() === 'line-1', 'LineString survives CARTO to OSM replacement');

  await reloadMap();
  check(await marker.count() === 1, 'point marker survives a map remount');
  await marker.click();
  check(await page.locator('.inspector-id').innerText() === 'point-1', 'point remains interactive after a map remount');
  await mapClick(line.endX, line.endY);
  check(await page.locator('.inspector-id').innerText() === 'line-1', 'LineString remains interactive after a map remount');

  expectedProviderFailure = true;
  await page.unroute('https://tile.openstreetmap.org/**');
  await page.route('https://tile.openstreetmap.org/**', route => route.abort('failed'));
  await reloadMap(false);
  await status.filter({ hasText: /^Map unavailable$/ }).waitFor({ timeout: 10000 });
  check(await buildings.isDisabled(), 'provider failure disables 3D control');
  check((await page.locator('#building-reason').innerText()).includes('3D unavailable'), 'provider failure has a visible 3D limitation');
  await page.unroute('https://tile.openstreetmap.org/**');
  expectedProviderFailure = false;
  await switchBasemap('voyager');
  check(await marker.count() === 1, 'point marker survives provider-failure recovery via an alternate basemap');
  await marker.click();
  check(await page.locator('.inspector-id').innerText() === 'point-1', 'point remains selectable after alternate-basemap recovery');
  await page.screenshot({ path: '.playwright-cli/r1a3-map-lifecycle-recovered.png', fullPage: false });

  check(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`);
  check(consoleProblems.length === 0, `console problems outside expected provider failure: ${consoleProblems.join('; ')}`);
  return {
    result: 'PASS',
    pageErrors,
    consoleProblems,
    scenarios: [
      'OSM ready and explicit unavailable 3D state',
      'CARTO ready with 3D off/on/off or explicit unavailable state',
      'OSM/CARTO/OSM committed Point and LineString persistence',
      'map remount preserves interactive committed features',
      'intentional OSM provider failure reaches visible error state and recovers through CARTO',
    ],
  };
}
