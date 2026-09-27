// Production-preview #5C evidence via playwright-cli run-code --filename tests/project-persistence-browser.js
// Run node tests/map-tile-server.cjs first for deterministic OSM tiles.
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const pageErrors = [];
  const consoleProblems = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  const url = 'http://127.0.0.1:4173/city-map-tools/';
  const saved = () => page.locator('.project-save-state strong').filter({ hasText: /^Saved$/ }).waitFor({ timeout: 10000 });
  const ready = () => page.locator('.map-status strong').filter({ hasText: /^Ready$/ }).waitFor({ timeout: 30000 });
  const readRecord = () => page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('city-map-tools', 1);
    request.onerror = () => reject(new Error('test IndexedDB open failed'));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('project-state', 'readonly');
      const get = tx.objectStore('project-state').get('last-accepted-project');
      let record;
      get.onsuccess = () => { record = get.result; };
      tx.oncomplete = () => { db.close(); resolve(record); };
      tx.onerror = () => { db.close(); reject(new Error('test IndexedDB read failed')); };
    };
  }));
  const writeRecord = record => page.evaluate(value => new Promise((resolve, reject) => {
    const request = indexedDB.open('city-map-tools', 1);
    request.onerror = () => reject(new Error('test IndexedDB open failed'));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('project-state', 'readwrite');
      tx.objectStore('project-state').put(value, 'last-accepted-project');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(new Error('test IndexedDB write failed')); };
    };
  }), record);
  const clearDatabase = () => page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('city-map-tools');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('test database deletion failed'));
    request.onblocked = () => reject(new Error('test database deletion blocked'));
  }));
  const mapClick = async () => {
    const box = await page.locator('.maplibregl-canvas').boundingBox();
    if (!box) throw new Error('map has no bounds');
    await page.mouse.click(box.x + box.width * 0.48, box.y + box.height * 0.48);
  };

  await page.unroute('https://tile.openstreetmap.org/**');
  await page.route('https://tile.openstreetmap.org/**', async route => {
    const response = await page.request.get('http://127.0.0.1:4175/tile.png');
    await route.fulfill({ status: response.status(), contentType: 'image/png', body: await response.body() });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await page.locator('.project-save-state strong').filter({ hasText: /^(Saved|Error)$/ }).waitFor({ timeout: 10000 });
  await clearDatabase();
  await page.reload();
  await ready();
  await saved();
  check(await page.locator('.feature-row').count() === 0, 'cleared database starts a fresh project');

  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  await mapClick();
  await page.getByLabel('Name', { exact: true }).fill('Persistence point');
  await page.getByLabel('Name', { exact: true }).press('Enter');
  await page.getByLabel('Marker type', { exact: true }).selectOption('pin');
  await page.getByRole('button', { name: 'Hide Points layer', exact: true }).click();
  await saved();
  const savedText = await readRecord();
  const savedDocument = JSON.parse(savedText);
  check(savedDocument.features[0].name === 'Persistence point', 'feature rename is stored');
  check(savedDocument.presentation.points['point-1'].marker === 'pin', 'PointPresentation is stored');
  check(savedDocument.layers.find(layer => layer.id === 'layer-points').visible === false, 'layer edit is stored');
  check(!('past' in savedDocument) && !('future' in savedDocument) && !('transaction' in savedDocument), 'history and drafts are absent from storage');
  check(!('selectedFeatureId' in savedDocument) && !('mode' in savedDocument), 'transient UI is absent from storage');
  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  await page.reload();
  await ready();
  await saved();
  check(await readRecord() === savedText, 'reload does not rewrite the saved document');
  check(await page.locator('.feature-row-name').innerText() === 'Persistence point', 'saved feature is restored');
  check(await page.getByRole('button', { name: 'Show Points layer', exact: true }).getAttribute('aria-pressed') === 'false', 'saved layer edit is restored');
  check(await page.getByRole('button', { name: 'Undo project edit', exact: true }).isDisabled(), 'Undo history resets on reload');
  check(await page.getByRole('button', { name: 'Redo project edit', exact: true }).isDisabled(), 'Redo history resets on reload');
  check(await page.getByRole('button', { name: 'Select tool', exact: true }).getAttribute('aria-pressed') === 'true', 'tool resets on reload');
  check(await page.getByRole('region', { name: 'Feature inspector' }).count() === 0, 'selection resets on reload');
  await page.locator('.feature-row').first().click();
  check(await page.getByLabel('Marker type', { exact: true }).inputValue() === 'pin', 'saved PointPresentation is restored');

  for (const invalid of ['{bad', JSON.stringify({ ...savedDocument, schemaVersion: 2 }), { corrupt: true }, undefined]) {
    await writeRecord(invalid);
    await page.reload();
    await page.locator('.project-save-state strong').filter({ hasText: /^Error$/ }).waitFor({ timeout: 10000 });
    check(await page.locator('.feature-row').count() === 0, 'invalid project is not partially loaded');
    check((await page.locator('.project-save-state').innerText()).includes('Autosave is paused'), 'recovery error is visible');
    await ready();
    await page.getByRole('button', { name: 'Point tool', exact: true }).click();
    await mapClick();
    check(await page.locator('.feature-row').count() === 1, 'fresh in-memory session remains usable');
    check((await page.locator('.project-save-state strong').innerText()) === 'Error', 'editing does not conceal paused autosave');
    await page.waitForTimeout(800);
    check(JSON.stringify(await readRecord()) === JSON.stringify(invalid), 'invalid recovery record is not overwritten');
  }

  check(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`);
  check(consoleProblems.length === 0, `console problems: ${consoleProblems.join('; ')}`);
  return { result: 'PASS', pageErrors, consoleProblems, scenarios: [
    'fresh IndexedDB record, committed edits, visible Saved, and canonical v1 payload',
    'reload restores feature/layer/PointPresentation with empty history and transient defaults',
    'malformed, future, object, and undefined records show Error and are preserved without overwrite',
  ] };
}
