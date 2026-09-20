// Production-preview LineString hit-order evidence via playwright-cli run-code --filename tests/line-overlap-browser.js
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
  const settle = () => page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const drawLine = async (startX, startY, endX, endY, name) => {
    await page.getByRole('button', { name: 'Line tool', exact: true }).click();
    await mapClick(startX, startY);
    await mapClick(endX, endY);
    await page.keyboard.press('Enter');
    await page.getByLabel('Name', { exact: true }).fill(name);
    check(await page.locator('.stored-value').innerText() === `Stored value: ${name}`, `${name} was authored`);
  };
  const selectedId = async scenario => {
    const id = await page.locator('.inspector-id').innerText({ timeout: 5000 }).catch(() => null);
    if (id !== null) return id;
    throw new Error(`${scenario}: map selection did not reach the inspector`);
  };
  const expectSelected = async (id, scenario, x = 0.5, y = 0.5) => {
    let actual = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await settle();
      await mapClick(x, y);
      actual = await selectedId(scenario);
      if (actual === id) break;
      await page.waitForTimeout(200);
    }
    check(actual === id, `${scenario}: expected ${id}, got ${actual}`);
    check(await page.locator('.feature-row.selected .feature-row-name').innerText() !== '', `${scenario}: Layers selection is synchronized`);
  };
  const switchBasemap = async id => {
    const enteredLoading = page.locator('.map-status strong').filter({ hasText: /^Loading$/ }).waitFor({ timeout: 5000 });
    await page.getByLabel('Provider', { exact: true }).selectOption(id);
    await enteredLoading;
    await ready();
  };
  const hideOrShow = async (name, visible) => {
    const label = `${visible ? 'Show' : 'Hide'} ${name}`;
    await page.getByRole('button', { name: label, exact: true }).click();
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:4173/city-map-tools/');
  await ready();

  // Later coincident lines are visually topmost, and visibility exposes the
  // next rendered line in order.
  await drawLine(0.32, 0.5, 0.68, 0.5, 'Line A');
  await drawLine(0.32, 0.5, 0.68, 0.5, 'Line B');
  await drawLine(0.32, 0.5, 0.68, 0.5, 'Line C');
  check(await page.locator('.feature-row').count() === 3, 'three overlapping LineStrings exist');
  await expectSelected('line-3', 'C wins shared overlap');
  await hideOrShow('Line C', false);
  await expectSelected('line-2', 'hiding C exposes B');
  await hideOrShow('Line B', false);
  await expectSelected('line-1', 'hiding B exposes A');
  await hideOrShow('Line B', true);
  await hideOrShow('Line C', true);
  await expectSelected('line-3', 'showing B and C restores C');

  // A later Far line is within the interaction tolerance but materially farther
  // from the click than Near, so nearest-stroke priority remains authoritative.
  await drawLine(0.32, 0.62, 0.68, 0.62, 'Line Near');
  await drawLine(0.32, 0.624, 0.68, 0.624, 'Line Far');
  await expectSelected('line-4', 'nearer line beats later farther line', 0.5, 0.62);

  // At a crossing the later line wins; on an earlier-only portion the earlier
  // line remains selectable.
  await drawLine(0.3, 0.72, 0.7, 0.72, 'Cross A');
  await drawLine(0.5, 0.64, 0.5, 0.8, 'Cross B');
  await expectSelected('line-7', 'later line wins crossing', 0.5, 0.72);
  await expectSelected('line-6', 'earlier line remains selectable on unique portion', 0.35, 0.72);
  await hideOrShow('Cross B', false);
  await expectSelected('line-6', 'hidden topmost line cannot win', 0.5, 0.72);
  await hideOrShow('Cross B', true);

  // Hidden layer and active drafts do not create committed map hits.
  await page.getByRole('button', { name: 'Hide Lines layer', exact: true }).click();
  await settle();
  await mapClick(0.5, 0.72);
  check(await page.locator('.inspector-id').count() === 0, 'hidden LineString layer cannot win selection');
  await page.getByRole('button', { name: 'Show Lines layer', exact: true }).click();
  await expectSelected('line-7', 'showing LineString layer restores crossing selection', 0.5, 0.72);

  const featureCountBeforeDraft = await page.locator('.feature-row').count();
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await mapClick(0.25, 0.35);
  await mapClick(0.5, 0.72);
  check(await page.locator('.feature-row').count() === featureCountBeforeDraft, 'transient LineString draft is not committed or selectable');
  await page.keyboard.press('Escape');
  await expectSelected('line-7', 'cancelled draft restores normal topmost selection', 0.5, 0.72);

  // Editing Cross A excludes its committed source until cancellation restores
  // the normal rendered-order contract.
  await page.getByRole('button', { name: 'Cross A authored', exact: true }).click();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  check(await page.getByRole('button', { name: 'Cancel edit', exact: true }).isVisible(), 'Cross A edit session starts');
  await page.getByRole('button', { name: 'Cancel edit', exact: true }).click();
  await expectSelected('line-7', 'cancelled edit restores later crossing line', 0.5, 0.72);

  // Rendered order survives OSM -> Voyager -> OSM style rehydration.
  await switchBasemap('voyager');
  await expectSelected('line-7', 'Cross B survives OSM to Voyager', 0.5, 0.72);
  await expectSelected('line-6', 'unique Cross A survives OSM to Voyager', 0.35, 0.72);
  await switchBasemap('osm');
  await expectSelected('line-7', 'Cross B survives Voyager to OSM', 0.5, 0.72);

  // LineString-first precedence remains intact when a derived Polygon buffer
  // overlaps its source stroke.
  await page.getByRole('button', { name: 'Cross A authored', exact: true }).click();
  await page.getByLabel('Buffer radius (metres)', { exact: true }).fill('10000');
  await page.getByRole('button', { name: 'Create derived buffer', exact: true }).click();
  await expectSelected('line-6', 'LineString beats overlapping derived buffer', 0.35, 0.72);

  check(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`);
  check(consoleProblems.length === 0, `console problems: ${consoleProblems.join('; ')}`);
  return {
    result: 'PASS',
    pageErrors,
    consoleProblems,
    scenarios: [
      'three coincident LineStrings select later/topmost C, then B, then A under visibility changes',
      'nearer LineString beats later farther LineString within the hit tolerance',
      'crossing tie selects later LineString while unique earlier segment remains selectable',
      'hidden feature/layer, transient draft, and edit cancellation preserve committed selection truth',
      'OSM to Voyager to OSM style replacement preserves rendered-order selection',
      'LineString remains higher priority than an overlapping derived Polygon buffer',
    ],
  };
}
