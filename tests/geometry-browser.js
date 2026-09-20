// Production-preview smoke via playwright-cli run-code --filename tests/geometry-browser.js
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
    // A pre-existing Ready status must not satisfy this wait while MapLibre is
    // replacing the style. Observe the new loading cycle before asserting that
    // committed geometry survives the replacement.
    await enteredLoading;
    await ready();
  };
  const mapBox = async () => {
    const box = await page.locator('.maplibregl-canvas').boundingBox();
    if (!box) throw new Error('Map canvas has no bounds.');
    return box;
  };
  const mapClick = async (xRatio, yRatio) => {
    const box = await mapBox();
    await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
  };
  const settleMapInput = () => page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const drawLine = async (startX = 0.42, startY = 0.53, endX = 0.58, endY = 0.61) => {
    await page.getByRole('button', { name: 'Line tool', exact: true }).click();
    await mapClick(startX, startY);
    await mapClick(endX, endY);
    await page.keyboard.press('Enter');
    return { startX, startY, endX, endY };
  };
  const drawPolygon = async () => {
    await page.getByRole('button', { name: 'Polygon tool', exact: true }).click();
    await mapClick(0.62, 0.42);
    await mapClick(0.75, 0.5);
    await mapClick(0.67, 0.67);
    await page.keyboard.press('Enter');
  };
  const renameSelected = async name => {
    await page.getByLabel('Name', { exact: true }).fill(name);
    check(await page.locator('.stored-value').innerText() === `Stored value: ${name}`, `rename ${name}`);
  };
  const selectFeature = async (name, lineage = 'authored') => {
    await page.getByRole('button', { name: `${name} ${lineage}`, exact: true }).click();
  };
  const selectedInspectorId = async scenario => {
    const id = await page.locator('.inspector-id').innerText({ timeout: 5000 }).catch(() => null);
    if (id !== null) return id;
    const [provider, mapStatus, editorStatus, rows] = await Promise.all([
      page.getByLabel('Provider', { exact: true }).inputValue(),
      page.locator('.map-status').innerText(),
      page.locator('.editor-status').innerText(),
      page.locator('.feature-row').allInnerTexts(),
    ]);
    throw new Error(`${scenario}: no selected inspector (provider ${provider}; ${mapStatus}; ${editorStatus}; features ${rows.join(' | ')})`);
  };
  const inspectorText = async () => (await page.locator('.inspector-field').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
  const geometryField = async () => page.locator('.inspector-field').evaluateAll(fields => {
    const field = fields.find(candidate => candidate.firstElementChild?.textContent === 'Geometry');
    if (!field) throw new Error('Geometry inspector field is missing.');
    return field.innerText;
  });
  const dragMapPoint = async (xRatio, yRatio, nextXRatio, nextYRatio) => {
    const box = await mapBox();
    await page.mouse.move(box.x + box.width * xRatio, box.y + box.height * yRatio);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * nextXRatio, box.y + box.height * nextYRatio, { steps: 4 });
    await page.mouse.up();
  };
  const createBuffer = async radius => {
    await page.getByLabel('Buffer radius (metres)', { exact: true }).fill(String(radius));
    await page.getByRole('button', { name: 'Create derived buffer', exact: true }).click();
    const text = await inspectorText();
    check(text.includes(`Buffer derivation ${radius} meters; @turf/buffer@7.4.0; 8 steps`), 'explicit buffer provenance');
    check(text.includes('Validation status Functional but unvalidated'), 'buffer is never Validated');
  };
  const assertReloadBlocked = async scenario => {
    const reload = page.getByRole('button', { name: 'Reload map', exact: true });
    check(await reload.isDisabled(), `${scenario} disables Reload map`);
    check(await page.getByText('Reload map is unavailable while an active geometry draft is open. Finish or cancel it before reloading.', { exact: true }).isVisible(), `${scenario} has a visible reload explanation`);
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:4173/city-map-tools/');
  await ready();

  // Reload must not silently destroy an active LineString or Polygon draft.
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await mapClick(0.3, 0.32);
  await assertReloadBlocked('Line draft');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Polygon tool', exact: true }).click();
  await mapClick(0.3, 0.32);
  await assertReloadBlocked('Polygon draft');
  await page.keyboard.press('Escape');

  // Invalid structural output must stay out of workspace state with a visible reason.
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await mapClick(0.3, 0.32);
  await settleMapInput();
  await page.keyboard.press('Enter');
  await page.locator('.editor-status').filter({ hasText: 'Geometry was not committed' }).waitFor({ timeout: 5000 });
  await settleMapInput();
  check((await page.locator('.editor-status').innerText()).includes('Geometry was not committed'), 'invalid LineString error remains visible after Select reset');
  check(await page.locator('.feature-row').count() === 0, 'invalid LineString remains transactional');
  check(await page.getByRole('button', { name: 'Select tool', exact: true }).getAttribute('aria-pressed') === 'true', 'invalid LineString returns Select mode');

  // An incomplete drawing blocks style replacement and Escape leaves no authored feature.
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await mapClick(0.35, 0.4);
  await page.getByLabel('Provider', { exact: true }).selectOption('voyager');
  check(await page.getByLabel('Provider', { exact: true }).inputValue() === 'osm', 'active draft blocks basemap switch');
  check((await page.locator('.editor-status').innerText()).includes('Finish or cancel'), 'visible basemap block reason');
  await page.keyboard.press('Escape');
  check(await page.locator('.feature-row').count() === 0, 'Escape leaves no orphan LineString feature');
  check(await page.getByRole('button', { name: 'Select tool', exact: true }).getAttribute('aria-pressed') === 'true', 'Escape returns Select mode');
  await page.getByRole('button', { name: 'Polygon tool', exact: true }).click();
  await mapClick(0.35, 0.4);
  await page.keyboard.press('Escape');
  check(await page.locator('.feature-row').count() === 0, 'Escape leaves no orphan Polygon feature');

  // Point remains a direct map tool and serves as the first buffer source.
  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  await mapClick(0.48, 0.48);
  await renameSelected('Buffer point');
  const featureCountBeforeBadBuffer = await page.locator('.feature-row').count();
  await page.getByLabel('Buffer radius (metres)', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Create derived buffer', exact: true }).click();
  check((await page.locator('.editor-status').innerText()).includes('Buffer radius must be between 1 and 10000 meters'), 'invalid buffer has a visible reason');
  check(await page.locator('.feature-row').count() === featureCountBeforeBadBuffer, 'invalid buffer is transactional');
  check(await selectedInspectorId('invalid buffer') === 'point-1', 'invalid buffer preserves selection');
  await createBuffer(45);
  await selectFeature('Buffer point');
  await page.locator('.point-marker').click();
  check(await selectedInspectorId('point marker click') === 'point-1', 'point marker selection synchronizes with inspector');
  check(await page.getByRole('button', { name: 'Buffer point authored', exact: true }).evaluate(element => element.classList.contains('selected')), 'point marker selection synchronizes with layer list');
  await selectFeature('Buffer point buffer', 'derived');
  check(await page.getByText('Derived buffer geometry is read-only. Delete it or regenerate it from a current authored source.', { exact: true }).isVisible(), 'derived buffer is visibly read-only');
  check(await page.getByRole('button', { name: 'Edit geometry', exact: true }).count() === 0, 'derived buffer has no geometry edit action');

  // Authored LineString: create, map-select, edit/apply, stale buffer, edit/cancel, delete confirmation.
  const line = await drawLine();
  await renameSelected('Buffer line');
  await createBuffer(70);
  await selectFeature('Buffer line buffer', 'derived');
  const originalLineSourceSnapshot = await page.getByLabel('Stored source geometry snapshot', { exact: true }).innerText();
  check(originalLineSourceSnapshot.includes('LineString'), 'buffer inspector exposes the exact LineString source snapshot');
  check((await page.getByLabel('Source validation status', { exact: true }).innerText()).includes('Functional but unvalidated'), 'buffer inspector exposes source validation status');
  check((await page.getByLabel('Source provenance', { exact: true }).innerText()).includes('User-authored'), 'buffer inspector exposes source provenance');

  await drawLine(0.7, 0.46, 0.82, 0.54);
  await renameSelected('Buffer line B');
  await createBuffer(75);
  await selectFeature('Buffer line B buffer', 'derived');
  const lineBSourceSnapshot = await page.getByLabel('Stored source geometry snapshot', { exact: true }).innerText();
  await selectFeature('Buffer line');

  // Apply must stay bound to Line A even if the Layers surface selects Line B.
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await assertReloadBlocked('Line edit');
  await selectFeature('Buffer line B');
  const lineBBox = await mapBox();
  await page.mouse.move(lineBBox.x + lineBBox.width * line.startX, lineBBox.y + lineBBox.height * line.startY);
  await page.mouse.down();
  await page.mouse.move(lineBBox.x + lineBBox.width * (line.startX + 0.025), lineBBox.y + lineBBox.height * (line.startY + 0.015), { steps: 4 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Apply geometry', exact: true }).click();
  await selectFeature('Buffer line buffer', 'derived');
  check((await inspectorText()).includes('Validation status Stale'), 'Line A edit makes only Line A buffer Stale');
  check(await page.getByLabel('Stored source geometry snapshot', { exact: true }).innerText() === originalLineSourceSnapshot, 'Line A buffer retains its original source snapshot after source edit');
  await selectFeature('Buffer line B buffer', 'derived');
  check((await inspectorText()).includes('Validation status Functional but unvalidated'), 'Line B buffer remains current after Line A edit');
  check(await page.getByLabel('Stored source geometry snapshot', { exact: true }).innerText() === lineBSourceSnapshot, 'Line B geometry and source snapshot remain unchanged after Line A edit');

  await selectFeature('Buffer line');
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  const lineBox = await mapBox();
  await page.mouse.move(lineBox.x + lineBox.width * line.startX, lineBox.y + lineBox.height * line.startY);
  await page.mouse.down();
  await page.mouse.move(lineBox.x + lineBox.width * (line.startX + 0.03), lineBox.y + lineBox.height * (line.startY + 0.02), { steps: 4 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Apply geometry', exact: true }).click();
  await selectFeature('Buffer line buffer', 'derived');
  check((await inspectorText()).includes('Validation status Stale'), 'line edit makes dependent buffer Stale');
  await selectFeature('Buffer line');
  const beforeCancel = await page.locator('.inspector-field').allInnerTexts();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click();
  check(!(await page.getByRole('button', { name: 'Reload map', exact: true }).isDisabled()), 'Reload is enabled after cancelling an edit');
  await page.getByRole('button', { name: 'Reload map', exact: true }).click();
  await ready();
  check(JSON.stringify(await page.locator('.inspector-field').allInnerTexts()) === JSON.stringify(beforeCancel), 'LineString cancel restores exact committed inspector state');
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await page.getByLabel('Provider', { exact: true }).selectOption('voyager');
  check(await page.getByLabel('Provider', { exact: true }).inputValue() === 'osm', 'active edit blocks basemap switch');
  check((await page.locator('.editor-status').innerText()).includes('Finish or cancel'), 'visible basemap block during edit');
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click();

  // Map selection and full style replacement preserve the committed LineString.
  await mapClick(line.endX, line.endY);
  const selectedLineId = await selectedInspectorId('initial LineString map click');
  check(selectedLineId === 'line-1', `map click selects committed LineString (selected ${selectedLineId})`);
  check(await page.getByRole('button', { name: 'Buffer line authored', exact: true }).evaluate(element => element.classList.contains('selected')), 'LineString map selection synchronizes with layer list');
  const lineMapPosition = await page.getByLabel('Map position').innerText();
  await switchBasemap('voyager');
  check(await page.getByLabel('Map position').innerText() === lineMapPosition, 'style replacement preserves the map camera');
  await page.screenshot({ path: '.playwright-cli/r1a3-carto-linestring.png' });
  await mapClick(line.endX, line.endY);
  check(await selectedInspectorId('CARTO LineString map click') === 'line-1', 'LineString survives OSM to CARTO style replacement');
  await switchBasemap('osm');

  // Authored Polygon: create, select, edit/cancel, edit/apply, and buffer source.
  await drawPolygon();
  await renameSelected('Buffer polygon');
  await mapClick(0.67, 0.52);
  check(await selectedInspectorId('Polygon map click') === 'polygon-1', 'map click selects committed Polygon');
  await createBuffer(90);
  await selectFeature('Buffer polygon');
  const polygonBeforeCancel = await page.locator('.inspector-field').allInnerTexts();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await assertReloadBlocked('Polygon edit');
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click();
  check(JSON.stringify(await page.locator('.inspector-field').allInnerTexts()) === JSON.stringify(polygonBeforeCancel), 'Polygon cancel restores exact committed inspector state');
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await page.getByRole('button', { name: 'Apply geometry', exact: true }).click();
  await page.locator('.editor-status').filter({ hasText: 'Polygon geometry applied' }).waitFor({ timeout: 5000 });
  check(await page.getByRole('button', { name: 'Select tool', exact: true }).getAttribute('aria-pressed') === 'true', 'Polygon Apply returns Select tool state');
  await selectFeature('Buffer polygon buffer', 'derived');
  check((await inspectorText()).includes('Validation status Stale'), 'polygon edit makes dependent buffer Stale');

  // Switching directly from an edit into a draw must close the edit through
  // the controller boundary, restoring the committed source before drawing.
  const lineOriginalGeometry = await (async () => {
    await selectFeature('Buffer line');
    return geometryField();
  })();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await dragMapPoint(line.endX, line.endY, line.endX + 0.025, line.endY + 0.015);
  check(await selectedInspectorId('Line edit before Line draw') === 'line-1', 'Line edit keeps deterministic selection before draw switch');
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  check(await selectedInspectorId('Line edit to Line draw') === 'line-1', 'Line source remains selected during replacement draw');
  await mapClick(0.2, 0.28);
  await mapClick(0.3, 0.36);
  await page.keyboard.press('Enter');
  await mapClick(line.endX, line.endY);
  check(await selectedInspectorId('Line source after Line draw') === 'line-1', 'Line source reappears after Line draw finishes');
  check(await geometryField() === lineOriginalGeometry, 'Line source canonical geometry is unchanged after edit-to-Line switch');

  const polygonOriginalGeometry = await (async () => {
    await selectFeature('Buffer polygon');
    return geometryField();
  })();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await dragMapPoint(0.62, 0.42, 0.645, 0.435);
  check(await selectedInspectorId('Polygon edit before Polygon draw') === 'polygon-1', 'Polygon edit keeps deterministic selection before draw switch');
  await page.getByRole('button', { name: 'Polygon tool', exact: true }).click();
  check(await selectedInspectorId('Polygon edit to Polygon draw') === 'polygon-1', 'Polygon source remains selected during replacement draw');
  await mapClick(0.24, 0.28);
  await page.keyboard.press('Escape');
  await mapClick(0.67, 0.52);
  check(await selectedInspectorId('topmost Polygon after Polygon cancel') === 'buffer-4', 'topmost Polygon buffer remains selectable after Polygon draw cancellation');
  await selectFeature('Buffer polygon');
  check(await geometryField() === polygonOriginalGeometry, 'Polygon source canonical geometry is unchanged after edit-to-Polygon switch');

  await selectFeature('Buffer line');
  const lineCrossTypeGeometry = await geometryField();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await dragMapPoint(line.endX, line.endY, line.endX + 0.02, line.endY + 0.01);
  await page.getByRole('button', { name: 'Polygon tool', exact: true }).click();
  await mapClick(0.18, 0.72);
  await mapClick(0.28, 0.78);
  await mapClick(0.24, 0.88);
  await page.keyboard.press('Enter');
  await mapClick(line.endX, line.endY);
  check(await selectedInspectorId('Line source after Polygon draw') === 'line-1', 'Line source reappears after cross-type Polygon draw');
  check(await geometryField() === lineCrossTypeGeometry, 'Line source geometry survives cross-type draw switch');

  await selectFeature('Buffer polygon');
  const polygonCrossTypeGeometry = await geometryField();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await dragMapPoint(0.62, 0.42, 0.64, 0.44);
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await mapClick(0.82, 0.76);
  await mapClick(0.9, 0.84);
  await page.keyboard.press('Enter');
  await mapClick(0.67, 0.52);
  check(await selectedInspectorId('topmost Polygon after Line draw') === 'buffer-4', 'topmost Polygon buffer remains selectable after cross-type Line draw');
  await selectFeature('Buffer polygon');
  check(await geometryField() === polygonCrossTypeGeometry, 'Polygon source geometry survives cross-type draw switch');

  // Layer visibility stays truthful for committed geometry, and deleting a source preserves buffer traceability.
  await page.getByRole('button', { name: 'Hide Lines layer', exact: true }).click();
  check(await page.getByRole('button', { name: 'Show Lines layer', exact: true }).isVisible(), 'Line layer can be hidden');
  await page.getByRole('button', { name: 'Show Lines layer', exact: true }).click();
  await selectFeature('Buffer line');
  await page.getByRole('button', { name: 'Delete feature', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await selectFeature('Buffer line buffer', 'derived');
  check((await inspectorText()).includes('orphaned'), 'source delete makes dependent buffer visibly orphaned');
  check(await page.getByLabel('Stored source geometry snapshot', { exact: true }).innerText() === originalLineSourceSnapshot, 'orphaned Line A buffer retains its original source snapshot');
  await selectFeature('Buffer polygon');
  await page.getByRole('button', { name: 'Delete feature', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await selectFeature('Buffer polygon buffer', 'derived');
  check((await inspectorText()).includes('orphaned'), 'Polygon delete keeps its derived buffer visibly orphaned');

  // Narrow viewport preserves the map-oriented toolbar and focusable controls.
  await page.setViewportSize({ width: 390, height: 844 });
  check(await page.getByRole('toolbar', { name: 'Spatial tools' }).isVisible(), 'narrow viewport toolbar remains visible');
  await page.getByRole('button', { name: 'Select tool', exact: true }).focus();
  check(await page.getByRole('button', { name: 'Select tool', exact: true }).evaluate(element => document.activeElement === element), 'toolbar control receives keyboard focus');

  check(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`);
  check(consoleProblems.length === 0, `console problems: ${consoleProblems.join('; ')}`);
  return {
    result: 'PASS',
    pageErrors,
    consoleProblems,
    scenarios: [
      'invalid structural geometry has a visible transactional failure',
      'draft blocks basemap replacement and Escape cancellation',
      'Point/LineString/Polygon buffer provenance',
      'Point/LineString/Polygon map and list selection synchronization',
      'LineString map selection, edit/apply/cancel/delete',
      'Polygon edit/cancel/apply/delete',
      'Line edit to Line draw finish restores exact committed source',
      'Polygon edit to Polygon draw cancel restores exact committed source',
      'Line edit to Polygon draw and Polygon edit to Line draw preserve sources',
      'layer visibility and OSM/CARTO style replacement',
      'Stale/orphan derived buffer state',
      'narrow toolbar and keyboard focus',
    ],
  };
}
