// Production-preview import lifecycle evidence via playwright-cli run-code --filename tests/import-lifecycle-browser.js
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const pageErrors = [];
  const consoleProblems = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  const ready = () => page.locator('.map-status strong').filter({ hasText: /^Ready$/ }).waitFor({ timeout: 30000 });
  const mapClick = async (xRatio, yRatio) => {
    const box = await page.locator('.maplibregl-canvas').boundingBox();
    if (!box) throw new Error('Map canvas has no bounds.');
    await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
  };
  const pointDocument = (id = 'imported-point') => JSON.stringify({
    type: 'FeatureCollection',
    metadata: { format: 'city-map-tools.geojson', version: 1, generator: 'City Map Tools' },
    features: [{ type: 'Feature', id, geometry: { type: 'Point', coordinates: [100.5, 13.75] }, properties: {} }],
  });
  const upload = async (text, waitForPending = false) => {
    const input = page.locator('input[type=file]');
    await input.evaluate((element, value) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([value], 'import.geojson', { type: 'application/geo+json' }));
      element.files = transfer.files;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, text);
    if (waitForPending) await page.waitForFunction(() => window.__issue20PendingImportReads === 1, null, { timeout: 5000 });
  };
  const installDelayedFileText = async () => {
    await page.evaluate(() => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(Blob.prototype, 'text');
      if (!originalDescriptor?.value) throw new Error('File.text is unavailable for the delayed import fixture.');
      const pending = [];
      Object.defineProperty(File.prototype, 'text', {
        configurable: true,
        value() {
          return new Promise(resolve => {
            pending.push({ file: this, resolve });
            window.__issue20PendingImportReads = pending.length;
          });
        },
      });
      window.__issue20PendingImportReads = 0;
      window.__issue20ReleaseImportRead = async () => {
        const task = pending.shift();
        if (!task) throw new Error('No delayed import read is pending.');
        window.__issue20PendingImportReads = pending.length;
        task.resolve(await originalDescriptor.value.call(task.file));
      };
      window.__issue20PendingImportReads = pending.length;
    });
  };
  const releaseDelayedFileText = () => page.evaluate(() => window.__issue20ReleaseImportRead());
  const importInput = () => page.locator('input[type=file]');
  const importReason = () => page.locator('#import-reason');
  const geometryField = () => page.locator('.inspector-field').filter({ hasText: 'Geometry' }).innerText();
  const drawLine = async () => {
    await page.getByRole('button', { name: 'Line tool', exact: true }).click();
    await mapClick(0.35, 0.42);
    await mapClick(0.55, 0.58);
    await page.keyboard.press('Enter');
  };
  const drawPolygon = async () => {
    await page.getByRole('button', { name: 'Polygon tool', exact: true }).click();
    await mapClick(0.62, 0.4);
    await mapClick(0.76, 0.48);
    await mapClick(0.69, 0.66);
    await page.keyboard.press('Enter');
  };
  const assertImportBlocked = async scenario => {
    check(await importInput().isDisabled(), `${scenario}: import input is disabled`);
    check(await page.locator('.file-button').getAttribute('aria-disabled') === 'true', `${scenario}: import label is visibly disabled`);
    check(await importReason().isVisible(), `${scenario}: visible import explanation`);
    check((await importReason().innerText()).includes('Finish or cancel'), `${scenario}: import explanation is actionable`);
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:4173/city-map-tools/');
  await ready();

  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await mapClick(0.35, 0.42);
  await assertImportBlocked('Line draft');
  check(await page.locator('.feature-row').count() === 0, 'Line draft has no committed feature before cancellation');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  check(!(await importInput().isDisabled()), 'import is available after cancelling Line draft');

  await page.getByRole('button', { name: 'Polygon tool', exact: true }).click();
  await mapClick(0.62, 0.4);
  await assertImportBlocked('Polygon draft');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  check(!(await importInput().isDisabled()), 'import is available after cancelling Polygon draft');

  await drawLine();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await assertImportBlocked('Line edit');
  check(await page.getByRole('button', { name: 'Cancel edit', exact: true }).isVisible(), 'Line edit session remains active');
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click();
  check(!(await importInput().isDisabled()), 'import is available after cancelling Line edit');

  await drawPolygon();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await assertImportBlocked('Polygon edit');
  check(await page.getByRole('button', { name: 'Cancel edit', exact: true }).isVisible(), 'Polygon edit session remains active');
  await page.getByRole('button', { name: 'Apply geometry', exact: true }).click();
  check(!(await importInput().isDisabled()), 'import is available after applying Polygon edit');

  await page.reload();
  await ready();
  await installDelayedFileText();
  await upload(pointDocument('draw-race-point'), true);
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await mapClick(0.3, 0.32);
  await releaseDelayedFileText();
  await page.getByText('Import was not applied because a geometry interaction became active while the file was being read.', { exact: true }).waitFor({ timeout: 5000 });
  check(await page.locator('.feature-row').count() === 0, 'aborted draw-race import adds no Point');
  check(await page.locator('.inspector-id').count() === 0, 'aborted draw-race import preserves null selection');
  check(await page.getByRole('button', { name: 'Line tool', exact: true }).getAttribute('aria-pressed') === 'true', 'draw-race preserves Line mode');
  check(await page.getByRole('button', { name: 'Cancel', exact: true }).isVisible(), 'draw-race preserves unfinished Line draft');
  await mapClick(0.55, 0.58);
  await page.keyboard.press('Enter');
  check(await page.locator('.feature-row').count() === 1, 'user can finish the preserved Line draft after aborted import');

  await page.reload();
  await ready();
  await drawLine();
  const committedLineGeometry = await geometryField();
  await installDelayedFileText();
  await upload(pointDocument('edit-race-point'), true);
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  const box = await page.locator('.maplibregl-canvas').boundingBox();
  if (!box) throw new Error('Map canvas has no bounds for edit race.');
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.6, { steps: 4 });
  await page.mouse.up();
  await releaseDelayedFileText();
  await page.getByText('Import was not applied because a geometry interaction became active while the file was being read.', { exact: true }).waitFor({ timeout: 5000 });
  check(await page.locator('.feature-row').count() === 1, 'aborted edit-race import preserves feature count');
  check(await page.locator('.inspector-id').innerText() === 'line-1', 'aborted edit-race import preserves selected source');
  check(await page.getByRole('button', { name: 'Cancel edit', exact: true }).isVisible(), 'edit-race preserves active edit session');
  check(await geometryField() === committedLineGeometry, 'edit-race preserves committed source geometry until explicit Apply');
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click();
  check(!(await importInput().isDisabled()), 'import is available after cancelling edit-race session');

  check(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`);
  check(consoleProblems.length === 0, `console problems: ${consoleProblems.join('; ')}`);
  return {
    result: 'PASS',
    pageErrors,
    consoleProblems,
    scenarios: [
      'Line/Polygon draft import guard and cancellation recovery',
      'Line/Polygon edit import guard and Apply/Cancel recovery',
      'delayed File.text draw race aborts transactionally without cancelling draft',
      'delayed File.text edit race aborts transactionally without changing committed geometry',
    ],
  };
}
