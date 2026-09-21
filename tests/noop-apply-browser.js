// Production-preview no-op Apply provenance evidence via playwright-cli run-code --filename tests/noop-apply-browser.js
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
  const dragMapPoint = async (xRatio, yRatio, nextXRatio, nextYRatio) => {
    const box = await mapBox();
    await page.mouse.move(box.x + box.width * xRatio, box.y + box.height * yRatio);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * nextXRatio, box.y + box.height * nextYRatio, { steps: 4 });
    await page.mouse.up();
  };
  const renameSelected = async name => {
    await page.getByLabel('Name', { exact: true }).fill(name);
    check(await page.locator('.stored-value').innerText() === `Stored value: ${name}`, `${name} was authored`);
  };
  const drawLine = async () => {
    await page.getByRole('button', { name: 'Line tool', exact: true }).click();
    await mapClick(0.34, 0.42);
    await mapClick(0.66, 0.58);
    await page.keyboard.press('Enter');
  };
  const drawPolygon = async () => {
    await page.getByRole('button', { name: 'Polygon tool', exact: true }).click();
    await mapClick(0.68, 0.38);
    await mapClick(0.82, 0.48);
    await mapClick(0.74, 0.66);
    await page.keyboard.press('Enter');
  };
  const createBuffer = async radius => {
    await page.getByLabel('Buffer radius (metres)', { exact: true }).fill(String(radius));
    await page.getByRole('button', { name: 'Create derived buffer', exact: true }).click();
  };
  const fields = () => page.locator('.inspector-field').allInnerTexts();
  const expectCurrentBuffer = async (before, snapshot, provenance, label) => {
    check(JSON.stringify(await fields()) === JSON.stringify(before), `${label}: buffer inspector is unchanged`);
    check((await page.locator('.inspector-field').filter({ hasText: 'Validation status' }).first().innerText()).includes('Functional but unvalidated'), `${label}: buffer remains current`);
    check(!(await page.locator('.inspector-field').allInnerTexts()).join(' ').includes('Source geometry changed'), `${label}: no false source-change limitation`);
    check(await page.getByLabel('Stored source geometry snapshot', { exact: true }).innerText() === snapshot, `${label}: historical source snapshot unchanged`);
    check(await page.getByLabel('Source provenance', { exact: true }).innerText() === provenance, `${label}: historical source provenance unchanged`);
  };
  const expectStaleBuffer = async (snapshot, provenance, label) => {
    const text = (await page.locator('.inspector-field').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
    check(text.includes('Validation status Stale'), `${label}: buffer becomes Stale after a real edit`);
    check(text.includes('Source geometry changed'), `${label}: real edit records the source-change limitation`);
    check(await page.getByLabel('Stored source geometry snapshot', { exact: true }).innerText() === snapshot, `${label}: derivation-time snapshot remains immutable`);
    check(await page.getByLabel('Source provenance', { exact: true }).innerText() === provenance, `${label}: derivation-time provenance remains immutable`);
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:4173/city-map-tools/');
  await ready();

  // LineString no-op Apply leaves every dependent buffer value unchanged.
  await drawLine();
  await renameSelected('No-op line');
  await createBuffer(70);
  await page.getByRole('button', { name: 'No-op line buffer derived', exact: true }).click();
  const lineSnapshot = await page.getByLabel('Stored source geometry snapshot', { exact: true }).innerText();
  const lineProvenance = await page.getByLabel('Source provenance', { exact: true }).innerText();
  const lineBufferBeforeNoOp = await fields();
  await page.getByRole('button', { name: 'No-op line authored', exact: true }).click();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await page.getByRole('button', { name: 'Apply geometry', exact: true }).click();
  const lineNoOpMessage = await page.locator('.editor-status').innerText();
  check(lineNoOpMessage.includes('LineString geometry unchanged'), 'Line no-op Apply reports unchanged geometry');
  check(!lineNoOpMessage.includes('marked Stale'), 'Line no-op Apply does not report Stale buffers');
  check(await page.locator('.inspector-id').innerText() === 'line-1', 'Line no-op Apply preserves deterministic source selection');
  await page.getByRole('button', { name: 'No-op line buffer derived', exact: true }).click();
  await expectCurrentBuffer(lineBufferBeforeNoOp, lineSnapshot, lineProvenance, 'Line no-op Apply');

  // A real line edit still stales the dependent exactly as before.
  await page.getByRole('button', { name: 'No-op line authored', exact: true }).click();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await dragMapPoint(0.66, 0.58, 0.69, 0.6);
  await page.getByRole('button', { name: 'Apply geometry', exact: true }).click();
  const lineRealEditMessage = await page.locator('.editor-status').innerText();
  check(lineRealEditMessage.includes('LineString geometry applied'), 'Line real edit reports applied geometry');
  check(lineRealEditMessage.includes('marked Stale'), 'Line real edit reports Stale dependent buffers');
  await page.getByRole('button', { name: 'No-op line buffer derived', exact: true }).click();
  await expectStaleBuffer(lineSnapshot, lineProvenance, 'Line real edit');
  const staleLineBeforeRepeat = await fields();
  await page.getByRole('button', { name: 'No-op line authored', exact: true }).click();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await page.getByRole('button', { name: 'Apply geometry', exact: true }).click();
  const repeatedLineMessage = await page.locator('.editor-status').innerText();
  check(repeatedLineMessage.includes('LineString geometry unchanged'), 'Repeated Line Apply reports unchanged geometry');
  check(!repeatedLineMessage.includes('marked Stale'), 'Repeated Line Apply does not report Stale buffers');
  await page.getByRole('button', { name: 'No-op line buffer derived', exact: true }).click();
  check(JSON.stringify(await fields()) === JSON.stringify(staleLineBeforeRepeat), 'repeated Line Apply does not append or mutate stale provenance');

  // Polygon no-op and real Apply paths use the same canonical comparison.
  await drawPolygon();
  await renameSelected('No-op polygon');
  await createBuffer(80);
  await page.getByRole('button', { name: 'No-op polygon buffer derived', exact: true }).click();
  const polygonSnapshot = await page.getByLabel('Stored source geometry snapshot', { exact: true }).innerText();
  const polygonProvenance = await page.getByLabel('Source provenance', { exact: true }).innerText();
  const polygonBufferBeforeNoOp = await fields();
  await page.getByRole('button', { name: 'No-op polygon authored', exact: true }).click();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await page.getByRole('button', { name: 'Apply geometry', exact: true }).click();
  const polygonNoOpMessage = await page.locator('.editor-status').innerText();
  check(polygonNoOpMessage.includes('Polygon geometry unchanged'), 'Polygon no-op Apply reports unchanged geometry');
  check(!polygonNoOpMessage.includes('marked Stale'), 'Polygon no-op Apply does not report Stale buffers');
  check(await page.locator('.inspector-id').innerText() === 'polygon-1', 'Polygon no-op Apply preserves deterministic source selection');
  await page.getByRole('button', { name: 'No-op polygon buffer derived', exact: true }).click();
  await expectCurrentBuffer(polygonBufferBeforeNoOp, polygonSnapshot, polygonProvenance, 'Polygon no-op Apply');

  await page.getByRole('button', { name: 'No-op polygon authored', exact: true }).click();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await dragMapPoint(0.68, 0.38, 0.7, 0.39);
  await page.getByRole('button', { name: 'Apply geometry', exact: true }).click();
  const polygonRealEditMessage = await page.locator('.editor-status').innerText();
  check(polygonRealEditMessage.includes('Polygon geometry applied'), 'Polygon real edit reports applied geometry');
  check(polygonRealEditMessage.includes('marked Stale'), 'Polygon real edit reports Stale dependent buffers');
  await page.getByRole('button', { name: 'No-op polygon buffer derived', exact: true }).click();
  await expectStaleBuffer(polygonSnapshot, polygonProvenance, 'Polygon real edit');

  check(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`);
  check(consoleProblems.length === 0, `console problems: ${consoleProblems.join('; ')}`);
  return {
    result: 'PASS',
    pageErrors,
    consoleProblems,
    scenarios: [
      'LineString no-op Apply preserves current dependent buffer and selection',
      'LineString real edit stales dependent and preserves historical snapshot/provenance',
      'LineString no-op and real-edit messages distinguish unchanged from Stale state',
      'repeated LineString Apply is provenance-neutral and reports unchanged',
      'Polygon no-op Apply preserves current dependent buffer and selection',
      'Polygon real edit stales dependent and preserves historical snapshot/provenance',
      'Polygon no-op and real-edit messages distinguish unchanged from Stale state',
    ],
  };
}
