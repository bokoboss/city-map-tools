// Production-preview Issue #5B project history evidence via
// playwright-cli run-code --filename tests/project-history-browser.js
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
  const undo = () => page.getByRole('button', { name: 'Undo project edit', exact: true });
  const redo = () => page.getByRole('button', { name: 'Redo project edit', exact: true });
  const waitForFeatureCount = async expected => {
    await page.waitForFunction(count => document.querySelectorAll('.feature-row').length === count, expected, { timeout: 5000 });
    return true;
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:4173/city-map-tools/');
  await ready();
  check(await undo().isDisabled(), 'Undo is disabled before the first project edit');
  check(await redo().isDisabled(), 'Redo is disabled before the first project edit');

  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  await mapClick(0.48, 0.48);
  await page.getByLabel('Name', { exact: true }).waitFor();
  check(await waitForFeatureCount(1), 'Point creation adds one project feature');
  check(!(await undo().isDisabled()), 'Point creation enables Undo');

  const nameInput = page.getByLabel('Name', { exact: true });
  await nameInput.fill('History point');
  check(await page.locator('.stored-value').innerText() === 'Stored value: Point 1', 'typing a rename draft does not change stored project state');
  await nameInput.press('Enter');
  await page.getByText('Stored value: History point', { exact: true }).waitFor({ timeout: 5000 });
  check(await page.locator('.feature-row-name').innerText() === 'History point', 'Enter commits one feature rename');
  await undo().click();
  await page.getByText('Stored value: Point 1', { exact: true }).waitFor({ timeout: 5000 });
  check(await page.locator('.feature-row-name').innerText() === 'Point 1', 'one Undo restores the pre-rename value');
  await redo().click();
  await page.getByText('Stored value: History point', { exact: true }).waitFor({ timeout: 5000 });

  const markerKind = page.getByLabel('Marker type', { exact: true });
  await markerKind.selectOption('pin');
  check(await markerKind.inputValue() === 'pin', 'PointPresentation update is visible');
  await undo().click();
  check(await markerKind.inputValue() === 'dot', 'Undo restores the previous PointPresentation');
  await redo().click();
  check(await markerKind.inputValue() === 'pin', 'Redo restores the PointPresentation update');

  const pointLayerVisibility = page.getByRole('button', { name: 'Hide Points layer', exact: true });
  await pointLayerVisibility.click();
  check(await page.getByRole('button', { name: 'Show Points layer', exact: true }).getAttribute('aria-pressed') === 'false', 'layer visibility edit is committed');
  await undo().click();
  check(await page.getByRole('button', { name: 'Hide Points layer', exact: true }).getAttribute('aria-pressed') === 'true', 'Undo restores layer visibility');
  await redo().click();
  check(await page.getByRole('button', { name: 'Show Points layer', exact: true }).getAttribute('aria-pressed') === 'false', 'Redo restores the layer visibility edit');
  await undo().click();

  const featureVisibility = page.locator('.feature-visibility').first();
  await featureVisibility.click();
  check(await page.locator('.feature-visibility').first().getAttribute('aria-pressed') === 'false', 'feature visibility edit is committed');
  await undo().click();
  check(await page.locator('.feature-visibility').first().getAttribute('aria-pressed') === 'true', 'Undo restores feature visibility');
  await redo().click();
  check(await page.locator('.feature-visibility').first().getAttribute('aria-pressed') === 'false', 'Redo restores the feature visibility edit');

  await page.getByRole('button', { name: 'Create derived buffer', exact: true }).click();
  check(await waitForFeatureCount(2), 'buffer creation adds one derived feature');
  check((await page.locator('.inspector-field').allInnerTexts()).join(' ').replace(/\s+/g, ' ').includes('Validation status Functional but unvalidated'), 'buffer remains unvalidated');
  check(await page.getByRole('button', { name: 'Edit geometry', exact: true }).count() === 0, 'derived buffer stays read-only');
  await undo().click();
  check(await waitForFeatureCount(1), 'Undo removes the created buffer');
  await redo().click();
  check(await waitForFeatureCount(2), 'Redo restores the created buffer');

  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  check(await undo().isDisabled() && await redo().isDisabled(), 'active drawing disables Undo and Redo');
  await mapClick(0.38, 0.4);
  await mapClick(0.58, 0.57);
  check(await page.getByRole('button', { name: 'Cancel', exact: true }).isVisible(), 'drawing draft remains active after history controls are checked');
  await page.keyboard.press('Enter');
  await page.getByText('LineString created as authored, Functional but unvalidated WGS84 geometry.', { exact: true }).waitFor({ timeout: 5000 });
  check(await waitForFeatureCount(3), 'LineString draft remains intact and commits normally');

  await page.getByRole('button', { name: 'Polygon tool', exact: true }).click();
  await mapClick(0.64, 0.38);
  await mapClick(0.76, 0.47);
  await mapClick(0.67, 0.65);
  await page.keyboard.press('Enter');
  check(await waitForFeatureCount(4), 'Polygon creation commits through project history');
  check(!(await undo().isDisabled()), 'completed geometry edit enables Undo');

  check(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`);
  check(consoleProblems.length === 0, `console problems: ${consoleProblems.join('; ')}`);
  return {
    result: 'PASS',
    pageErrors,
    consoleProblems,
    scenarios: [
      'Point create and feature rename commit-on-Enter with one-step Undo/Redo',
      'PointPresentation Undo/Redo',
      'layer and feature visibility Undo/Redo',
      'derived buffer create Undo/Redo and read-only behavior',
      'active drawing disables history controls and retains the draft through normal commit',
      'Point, LineString, and Polygon creation remain available',
    ],
  };
}
