// Production-preview polygon ordering evidence via playwright-cli run-code --filename tests/polygon-overlap-browser.js
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const pageErrors = [];
  const consoleProblems = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  const ready = () => page.locator('.map-status strong').filter({ hasText: /^Ready$/ }).waitFor({ timeout: 30000 });
  const mapBox = async () => {
    const box = await page.locator('.maplibregl-canvas').boundingBox();
    if (!box) throw new Error('Map canvas has no bounds.');
    return box;
  };
  const mapClick = async (xRatio, yRatio) => {
    const box = await mapBox();
    await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
  };
  const settleMap = () => page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const drawPolygon = async (vertices) => {
    await page.getByRole('button', { name: 'Polygon tool', exact: true }).click();
    for (const [x, y] of vertices) await mapClick(x, y);
    await page.keyboard.press('Enter');
  };
  const rename = async name => {
    await page.getByLabel('Name', { exact: true }).fill(name);
    check(await page.locator('.stored-value').innerText() === `Stored value: ${name}`, `${name} was authored`);
  };
  const selectedId = async scenario => {
    const id = await page.locator('.inspector-id').innerText({ timeout: 5000 }).catch(() => null);
    if (id !== null) return id;
    throw new Error(`${scenario}: map selection did not reach the inspector`);
  };
  const expectMapSelection = async (id, scenario, x = 0.55, y = 0.55) => {
    let actual = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await settleMap();
      await mapClick(x, y);
      actual = await selectedId(scenario);
      if (actual === id) break;
      await page.waitForTimeout(250);
    }
    check(actual === id, `${scenario}: expected ${id}`);
    check(await page.locator('.feature-row.selected .feature-row-name').innerText() !== '', `${scenario}: layer selection is synchronized`);
  };
  const switchBasemap = async id => {
    const loading = page.locator('.map-status strong').filter({ hasText: /^Loading$/ }).waitFor({ timeout: 5000 });
    await page.getByLabel('Provider', { exact: true }).selectOption(id);
    await loading;
    await ready();
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:4173/city-map-tools/');
  await ready();

  // A, B, and C overlap at (0.55, 0.55); later source features are the
  // intended topmost rendered polygons.
  await drawPolygon([[0.22, 0.22], [0.78, 0.22], [0.78, 0.78], [0.22, 0.78]]);
  await rename('Polygon A');
  await settleMap();
  await drawPolygon([[0.38, 0.38], [0.64, 0.38], [0.64, 0.64], [0.38, 0.64]]);
  await rename('Polygon B');
  await settleMap();
  await drawPolygon([[0.48, 0.48], [0.72, 0.48], [0.72, 0.72], [0.48, 0.72]]);
  await rename('Polygon C');
  await settleMap();
  check(await page.locator('.feature-row').count() === 3, 'three authored overlapping Polygons exist');

  await expectMapSelection('polygon-3', 'C wins shared overlap');
  await page.getByRole('button', { name: 'Hide Polygon C', exact: true }).click();
  await expectMapSelection('polygon-2', 'hiding C exposes B');
  await page.getByRole('button', { name: 'Hide Polygon B', exact: true }).click();
  await expectMapSelection('polygon-1', 'hiding B exposes A');
  await page.getByRole('button', { name: 'Show Polygon B', exact: true }).click();
  await page.getByRole('button', { name: 'Show Polygon C', exact: true }).click();
  await expectMapSelection('polygon-3', 'showing B and C restores C');
  await mapClick(0.29, 0.29);
  check(await selectedId('outer-only click') === 'polygon-1', 'A wins outside inner polygons');

  // A hidden editing source is absent from committed rendering and cannot win
  // a subsequent committed selection after the edit is cancelled.
  await page.getByRole('button', { name: 'Polygon C authored', exact: true }).click();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  check(await page.getByRole('button', { name: 'Cancel edit', exact: true }).isVisible(), 'C edit session starts');
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click();
  await expectMapSelection('polygon-3', 'cancelled C edit restores normal topmost selection');

  // The layer-level visibility contract hides all polygons from map hit tests.
  await page.getByRole('button', { name: 'Hide Polygons layer', exact: true }).click();
  check(await page.getByRole('button', { name: 'Show Polygons layer', exact: true }).isVisible(), 'Polygon layer can be hidden');
  await settleMap();
  await mapClick(0.55, 0.55);
  check(await page.locator('.inspector-id').count() === 0, 'hidden Polygon layer cannot win selection');
  await page.getByRole('button', { name: 'Show Polygons layer', exact: true }).click();
  await expectMapSelection('polygon-3', 'showing Polygon layer restores topmost selection');

  // Rendered order survives full style replacement and rehydration.
  await switchBasemap('voyager');
  await expectMapSelection('polygon-3', 'C survives OSM to Voyager', 0.55, 0.55);
  await mapClick(0.29, 0.29);
  check(await selectedId('A survives OSM to Voyager') === 'polygon-1', 'A survives OSM to Voyager outside overlap');
  await switchBasemap('osm');
  await expectMapSelection('polygon-3', 'C survives Voyager to OSM', 0.55, 0.55);

  // Preserve LineString-first precedence where a derived Polygon buffer covers
  // the source stroke.
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await mapClick(0.3, 0.3);
  await mapClick(0.7, 0.7);
  await page.keyboard.press('Enter');
  check(await selectedId('Line is selected after commit') === 'line-1', 'LineString is selected after commit');
  await page.getByLabel('Buffer radius (metres)', { exact: true }).fill('10000');
  await page.getByRole('button', { name: 'Create derived buffer', exact: true }).click();
  await mapClick(0.5, 0.5);
  check(await selectedId('Line stroke wins over overlapping buffer') === 'line-1', 'LineString stroke retains priority over Polygon buffer');

  check(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`);
  check(consoleProblems.length === 0, `console problems: ${consoleProblems.join('; ')}`);
  return {
    result: 'PASS',
    pageErrors,
    consoleProblems,
    scenarios: [
      'three overlapping authored Polygons select later/topmost rendered feature',
      'hiding C exposes B, hiding B exposes A, and visibility restores C',
      'hidden Polygon layer cannot win selection',
      'editing/cancel restores normal committed selection',
      'OSM to Voyager to OSM style replacement preserves overlap selection',
      'LineString stroke remains higher priority than overlapping derived Polygon buffer',
    ],
  };
}
