// Production-preview smoke via playwright-cli run-code --filename tests/geojson-browser.js
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const ready = () => page.locator('.map-status strong').filter({ hasText: /^Ready$/ }).waitFor({ timeout: 30000 });
  const count = () => page.locator('.feature-row').count();
  const point = (id, properties = {}) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: [100.5, 13.75] }, properties });
  const provenance = { method: 'Fixture', source: 'Untrusted file', units: 'WGS84 longitude/latitude', limitations: 'Unvalidated' };
  const collection = features => ({ type: 'FeatureCollection', metadata: { format: 'city-map-tools.geojson', version: 1, generator: 'City Map Tools' }, features });
  const upload = async document => {
    await page.locator('input[type=file]').evaluate((input, text) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([text], 'fixture.geojson', { type: 'application/geo+json' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, JSON.stringify(document));
    await page.waitForFunction(() => /^(Imported |Import rejected:)/.test(document.querySelector('.import-status').textContent));
  };
  const exported = async () => {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export GeoJSON' }).click();
    const download = await pending;
    const stream = await download.createReadStream();
    let text = '';
    for await (const chunk of stream) text += chunk.toString('utf8');
    return JSON.parse(text);
  };
  const rejectUnchanged = async (document, expected) => {
    const before = await exported();
    const selected = await page.locator('.inspector-id').innerText();
    const priorCount = await count();
    await upload(document);
    const message = await page.locator('.import-status').innerText();
    check(message.startsWith('Import rejected:') && message.includes(expected), `visible rejection: ${message}`);
    check(await count() === priorCount, 'rejection preserves feature count');
    check(await page.locator('.inspector-id').innerText() === selected, 'rejection preserves selection');
    check(JSON.stringify(await exported()) === JSON.stringify(before), 'rejection preserves complete feature data');
  };
  await page.reload();
  await ready();
  await page.getByRole('button', { name: 'Create point', exact: true }).click();
  const box = await page.locator('.maplibregl-canvas').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  check(await count() === 1, 'point creation');
  await page.getByLabel('Name', { exact: true }).fill('Local <point>');
  check(await page.locator('.stored-value').innerText() === 'Stored value: Local <point>', 'rename exact value');
  const authoredExport = await exported();
  check(authoredExport.features[0].properties.lineage === 'authored', 'local creation remains authored');
  await upload(authoredExport);
  check(await page.locator('.inspector-id').innerText() === 'point-1-2', 'current-state collision selects inserted ID');
  let data = await exported();
  check(data.features[1].properties.lineage === 'imported', 'genuine export imports as imported');
  check(data.features[1].properties.provenance.sourceLineageClaim.trust === 'untrusted', 'genuine export retains untrusted claim');
  await page.getByRole('button', { name: 'Local <point> authored', exact: true }).click();
  check(await page.locator('.inspector-id').innerText() === 'point-1', 'select existing Point');
  await page.getByRole('button', { name: 'Hide Points layer' }).click();
  check(await page.locator('.point-marker').count() === 0, 'layer hidden');
  await page.getByRole('button', { name: 'Show Points layer' }).click();
  check(await page.locator('.point-marker').count() === 2, 'layer shown');
  await page.getByLabel('Provider', { exact: true }).selectOption('voyager');
  await ready();
  check(await page.locator('.point-marker').count() === 2, 'basemap preserves Points');

  await upload(collection([
    point('point-1', { name: 'Forged authored', lineage: 'authored', validationStatus: 'Validated' }),
    point('child', { name: 'Forged derived', lineage: 'derived', provenance: { ...provenance, derivedFrom: { id: 'point-1' } } }),
  ]));
  data = await exported();
  const source = data.features.find(f => f.properties.name === 'Forged authored');
  const child = data.features.find(f => f.id === 'child');
  check(source.properties.lineage === 'imported' && child.properties.lineage === 'imported', 'forged authored/derived stay imported');
  check(source.properties.validationStatus === 'Functional but unvalidated', 'Validated demotion');
  check(child.properties.provenance.derivedFrom.id === source.id && source.id === 'point-1-3', 'derivedFrom collision mapping');
  check(child.properties.provenance.sourceLineageClaim.lineage === 'derived' && child.properties.provenance.sourceLineageClaim.trust === 'untrusted', 'typed untrusted claim');
  await page.getByRole('button', { name: 'Forged derived imported', exact: true }).click();
  check(await page.getByText('Source lineage claim (untrusted)', { exact: true }).isVisible(), 'claim visibly untrusted');

  const malicious = '<img src=x onerror=window.__issue19Xss=1>';
  const script = '<script>window.__issue19Xss=2</script>';
  await upload(collection([point('malicious', { name: malicious, description: script })]));
  check(await page.locator('.stored-value').innerText() === `Stored value: ${malicious}`, 'malicious name literal');
  check(await page.getByText(script, { exact: true }).isVisible(), 'script literal');
  check(await page.evaluate(() => window.__issue19Xss === undefined), 'XSS inert');
  check(await page.locator('script').count() === 1, 'no injected script');

  await rejectUnchanged(collection([point('dup'), point('dup')]), 'duplicated');
  await rejectUnchanged(collection([{ ...point('bad'), geometry: { type: 'Point', coordinates: [181, 13] } }]), 'invalid Point coordinates');
  await rejectUnchanged(collection([{ ...point('bad'), geometry: { type: 'Polygon', coordinates: [] } }]), 'unsupported geometry');
  await rejectUnchanged(collection(Array.from({ length: 501 }, (_, i) => point(`large-${i}`))), '500-Point import limit');

  await upload(collection([point('max', { provenance: { ...provenance, limitations: 'x'.repeat(500) } })]));
  const first = await exported();
  await page.reload();
  await ready();
  await upload(first);
  const second = await exported();
  await page.reload();
  await ready();
  await upload(second);
  const third = await exported();
  check(second.features.every(f => f.properties.lineage === 'imported'), 'all reimported active lineage imported');
  const stable = doc => doc.features.map(f => ({ ...f, properties: { ...f.properties, provenance: { ...f.properties.provenance, importChain: undefined } } }));
  check(JSON.stringify(stable(second)) === JSON.stringify(stable(third)), 'normalized round-trip stable except import history');
  check(third.features.find(f => f.id === 'max').properties.provenance.limitations.length <= 500, 'max limitations bound');

  await page.reload();
  await ready();
  await upload(collection(Array.from({ length: 500 }, (_, i) => point(`limit-${i}`))));
  check(await count() === 500 && await page.locator('.point-marker').count() === 500, 'at-limit Points render');
  await rejectUnchanged(collection(Array.from({ length: 501 }, (_, i) => point(`excess-${i}`))), '500-Point import limit');
  check(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`);
  return { result: 'PASS', countAtLimit: await count(), pageErrors, scenarios: ['local Point/select/rename/layer/basemap', 'genuine and forged import trust', 'untrusted source claim UI and round-trip', 'Validated demotion', 'derivedFrom remapping', 'XSS inert', 'duplicate/malformed/unsupported transactional rejection', '500 accepted, 501 rejected with identical data and selection', 'max limitations and normal round-trip'] };
}
