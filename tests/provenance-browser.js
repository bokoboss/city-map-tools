// Production-preview provenance truth evidence via playwright-cli run-code --filename tests/provenance-browser.js
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
  const pointDocument = JSON.stringify({
    type: 'FeatureCollection',
    metadata: { format: 'city-map-tools.geojson', version: 1, generator: 'City Map Tools' },
    features: [{
      type: 'Feature',
      id: 'source-units',
      geometry: { type: 'Point', coordinates: [100.5, 13.75] },
      properties: {
        name: 'Measured point',
        provenance: {
          method: 'Survey fixture',
          source: 'Survey source record',
          units: 'EPSG:4326 degrees',
          limitations: 'Not engineering validated',
        },
      },
    }],
  });
  const upload = async text => {
    const status = page.locator('.import-status');
    const previous = await status.innerText();
    const completion = page.waitForFunction(previousStatus => {
      const current = document.querySelector('.import-status')?.textContent || '';
      return current !== previousStatus && current.startsWith('Imported ');
    }, previous);
    await page.locator('input[type=file]').evaluate((input, value) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([value], 'provenance.geojson', { type: 'application/geo+json' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, text);
    await completion;
  };
  const featureProvenance = () => page.getByLabel('Feature provenance');
  const sourceProvenance = () => page.getByLabel('Source provenance');
  const sourceValues = async () => ({
    method: await sourceProvenance().getByLabel('Source method').innerText(),
    source: await sourceProvenance().getByLabel('Source source').innerText(),
    units: await sourceProvenance().getByLabel('Source units').innerText(),
    limitations: await sourceProvenance().getByLabel('Source limitations').innerText(),
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:4173/city-map-tools/');
  await ready();
  await upload(pointDocument);
  await page.getByRole('button', { name: 'Measured point imported', exact: true }).click();
  check(await featureProvenance().getByLabel('Method').innerText() === 'Survey fixture', 'imported feature method is visible');
  check(await featureProvenance().getByLabel('Source').innerText() === 'Survey source record', 'imported feature source is visible');
  check(await featureProvenance().getByLabel('Units').innerText() === 'EPSG:4326 degrees', 'imported feature units are visible');
  check((await featureProvenance().getByLabel('Limitations').innerText()).includes('Not engineering validated'), 'imported feature limitations are visible');

  await page.getByLabel('Buffer radius (metres)', { exact: true }).fill('55');
  await page.getByRole('button', { name: 'Create derived buffer', exact: true }).click();
  await page.getByRole('button', { name: 'Measured point buffer derived', exact: true }).click();
  const derivation = page.locator('.inspector-field').filter({ hasText: 'Buffer derivation' });
  check((await derivation.innerText()).includes('55 meters'), 'buffer radius remains explicitly in meters');
  check((await page.getByLabel('Source validation status').innerText()).includes('Functional but unvalidated'), 'source validation status remains visible');
  const snapshot = await page.getByLabel('Stored source geometry snapshot').innerText();
  const historical = await sourceValues();
  check(historical.method === 'Survey fixture', 'stored source method is visible');
  check(historical.source === 'Survey source record', 'stored source string is visible');
  check(historical.units === 'EPSG:4326 degrees', 'stored source units are distinct from meters');
  check(historical.limitations.includes('Not engineering validated'), 'stored source limitations are visible');

  await page.getByRole('button', { name: 'Measured point imported', exact: true }).click();
  await page.getByRole('button', { name: 'Delete feature', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await page.getByRole('button', { name: 'Measured point buffer derived', exact: true }).click();
  const derivedSource = page.locator('.inspector-field').filter({ hasText: 'Derived source' });
  check((await derivedSource.innerText()).includes('Measured point') && (await derivedSource.innerText()).includes('orphaned'), 'orphaned source identity remains reviewable');
  check(await page.getByLabel('Source geometry type').innerText() === 'Geometry type: Point', 'orphaned source type remains reviewable');
  check((await page.locator('.inspector-field').filter({ hasText: 'Validation status' }).first().innerText()).includes('Stale'), 'orphaned buffer remains stale');
  check(await page.getByLabel('Stored source geometry snapshot').innerText() === snapshot, 'orphaned source geometry snapshot is unchanged');
  check(JSON.stringify(await sourceValues()) === JSON.stringify(historical), 'orphaned source provenance remains byte-equivalent');

  check(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`);
  check(consoleProblems.length === 0, `console problems: ${consoleProblems.join('; ')}`);
  return {
    result: 'PASS',
    pageErrors,
    consoleProblems,
    scenarios: [
      'imported feature exposes method/source/units/limitations',
      'buffer radius units remain distinct from source provenance units',
      'orphaned buffer preserves source ID/name/type/validation/snapshot/provenance',
    ],
  };
}
