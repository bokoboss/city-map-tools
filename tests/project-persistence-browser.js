// Production-preview browser evidence for Project Document v1 persistence and #5D recovery.
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
  const readActive = () => page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('city-map-tools', 1);
    request.onerror = () => reject(new Error('test IndexedDB open failed'));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('project-state', 'readonly');
      const store = tx.objectStore('project-state');
      let projectId;
      let record;
      store.get('active-project-id').onsuccess = event => {
        projectId = event.target.result;
        if (typeof projectId === 'string') {
          store.get(`project:${projectId}`).onsuccess = projectEvent => { record = projectEvent.target.result; };
        }
      };
      tx.oncomplete = () => { db.close(); resolve({ projectId, record }); };
      tx.onerror = () => { db.close(); reject(new Error('test IndexedDB read failed')); };
    };
  }));
  const readEntry = key => page.evaluate(recordKey => new Promise((resolve, reject) => {
    const request = indexedDB.open('city-map-tools', 1);
    request.onerror = () => reject(new Error('test IndexedDB open failed'));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('project-state', 'readonly');
      const store = tx.objectStore('project-state');
      let value;
      let count;
      store.get(recordKey).onsuccess = event => { value = event.target.result; };
      store.count(recordKey).onsuccess = event => { count = event.target.result; };
      tx.oncomplete = () => { db.close(); resolve({ exists: count > 0, value }); };
      tx.onerror = () => { db.close(); reject(new Error('test IndexedDB read failed')); };
    };
  }), key);
  const readRecord = async () => (await readActive()).record;
  const writeRecord = (projectId, record) => page.evaluate(({ id, value }) => new Promise((resolve, reject) => {
    const request = indexedDB.open('city-map-tools', 1);
    request.onerror = () => reject(new Error('test IndexedDB open failed'));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('project-state', 'readwrite');
      tx.objectStore('project-state').put(value, `project:${id}`);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(new Error('test IndexedDB write failed')); };
    };
  }), { id: projectId, value: record });
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

  let recoveryIndex = 0;
  for (const invalid of ['{bad', JSON.stringify({ ...savedDocument, schemaVersion: 2 }), { corrupt: true }, undefined]) {
    const invalidProjectId = (await readActive()).projectId;
    const invalidKey = `project:${invalidProjectId}`;
    await writeRecord(invalidProjectId, invalid);
    await page.reload();
    await page.getByRole('region', { name: 'Browser-local project recovery' }).waitFor({ timeout: 10000 });
    check((await page.locator('.project-recovery-panel').innerText()).includes('not overwritten or deleted'), 'recovery explains that the unreadable record is preserved');
    const preserved = await readEntry(invalidKey);
    check(preserved.exists, 'unreadable project key remains present');
    check(JSON.stringify(preserved.value) === JSON.stringify(invalid), 'invalid project value is not overwritten');
    const newName = `Recovery project ${++recoveryIndex}`;
    await page.getByLabel('New local project name', { exact: true }).fill(newName);
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await ready();
    await saved();
    check(await page.getByLabel('Current project name').innerText() === newName, 'explicit recovery New starts a usable local project');
    const afterRecovery = await readEntry(invalidKey);
    check(afterRecovery.exists && JSON.stringify(afterRecovery.value) === JSON.stringify(invalid), 'explicit New preserves the unreadable project record');
  }

  check(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`);
  check(consoleProblems.length === 0, `console problems: ${consoleProblems.join('; ')}`);
  return { result: 'PASS', pageErrors, consoleProblems, scenarios: [
    'fresh IndexedDB record, committed edits, visible Saved, and canonical v1 payload',
    'reload restores feature/layer/PointPresentation with empty history and transient defaults',
    'malformed, future, object, and undefined project records enter explicit recovery and remain preserved after New',
  ] };
}
