// Production-preview security regression via playwright-cli run-code --filename tests/malicious-id-browser.js
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const pageErrors = [];
  const consoleProblems = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  const ready = () => page.locator('.map-status strong').filter({ hasText: /^Ready$/ }).waitFor({ timeout: 30000 });
  const point = id => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: [100.5, 13.75] }, properties: { name: `Special ${id}` } });
  const collection = features => ({ type: 'FeatureCollection', metadata: { format: 'city-map-tools.geojson', version: 1, generator: 'City Map Tools' }, features });
  const upload = async document => {
    const status = page.locator('.import-status');
    const previous = await status.innerText();
    const priorCount = await page.locator('.feature-row').count();
    const completion = page.waitForFunction(({ previousStatus, expectedCount }) => {
      const current = document.querySelector('.import-status').textContent;
      return current !== previousStatus || document.querySelectorAll('.feature-row').length === expectedCount;
    }, { previousStatus: previous, expectedCount: priorCount + document.features.length });
    await page.locator('input[type=file]').evaluate((input, text) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([text], 'special-id.geojson', { type: 'application/geo+json' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, JSON.stringify(document));
    await completion;
    check((await status.innerText()).startsWith('Imported '), `special ID import succeeded: ${await status.innerText()}`);
  };
  const exported = async () => {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Points GeoJSON' }).click();
    const download = await pending;
    const stream = await download.createReadStream();
    let text = '';
    for await (const chunk of stream) text += chunk.toString('utf8');
    return JSON.parse(text);
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:4173/city-map-tools/');
  await ready();
  for (const featureId of ['__proto__', 'constructor', 'prototype']) {
    await upload(collection([point(featureId)]));
    check(await page.locator('.feature-row').count() === 1, `${featureId} imports exactly one Point`);
    check(await page.locator('.point-marker').count() === 1, `${featureId} renders exactly one marker`);
    await page.locator('.point-marker').click();
    check((await page.locator('.inspector-id').innerText()) === featureId, `${featureId} remains selectable`);
    check(await page.locator('#point-marker-kind').inputValue() === 'dot', `${featureId} starts with default marker`);
    await page.locator('#point-marker-kind').selectOption('pin');
    await page.locator('#point-marker-size').selectOption('32');
    await page.locator('#point-label-visible').uncheck();
    await page.locator('#point-label-position').selectOption('top-left');
    check(await page.locator('.point-marker').getAttribute('data-marker-kind') === 'pin', `${featureId} marker type update is safe`);
    check(await page.locator('.point-marker').getAttribute('data-label-position') === 'top-left', `${featureId} label update is safe`);
    check(await page.locator('.point-marker').evaluate(element => getComputedStyle(element).getPropertyValue('--point-marker-size').trim()) === '32px', `${featureId} size update is safe`);
    const data = await exported();
    check(data.features[0].id === featureId, `${featureId} export preserves identity`);
    check(!Object.prototype.polluted, 'Object.prototype remains unpolluted');
    await page.getByRole('button', { name: 'Delete feature', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
    check(await page.locator('.feature-row').count() === 0, `${featureId} deletion removes the Point`);
    check(await page.locator('.point-marker').count() === 0, `${featureId} deletion removes the marker`);
    check(await page.evaluate(() => Object.prototype.polluted === undefined), 'deletion does not pollute Object.prototype');
  }

  await upload(collection([point('__proto__'), point('constructor')]));
  check(await page.locator('.feature-row').count() === 2, 'special-ID re-import is deterministic');
  check((await page.locator('.feature-row').allInnerTexts()).some(text => text.includes('__proto__')), '__proto__ remains visible as literal data');
  check((await page.locator('.feature-row').allInnerTexts()).some(text => text.includes('constructor')), 'constructor remains visible as literal data');
  await upload(collection([point('__proto__'), point('constructor')]));
  const collisionIds = (await exported()).features.map(feature => feature.id);
  check(JSON.stringify(collisionIds) === JSON.stringify(['__proto__', 'constructor', '__proto__-2', 'constructor-2']), 'special-ID collision remapping remains deterministic');
  check(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`);
  check(consoleProblems.length === 0, `console problems: ${consoleProblems.join('; ')}`);
  return { result: 'PASS', pageErrors, consoleProblems, scenarios: ['__proto__/constructor/prototype Point import and rendering', 'safe marker type/label/size updates', 'safe deletion and no prototype pollution', 'deterministic special-ID re-import'] };
}
