// Vite-dev compatibility evidence via playwright-cli run-code --filename tests/terradraw-compat-browser.js
async (page) => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const pageErrors = [];
  const consoleProblems = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  const log = async () => JSON.parse(await page.locator('#events').innerText());
  const mapClick = async (xRatio, yRatio) => {
    const box = await page.locator('#map').boundingBox();
    if (!box) throw new Error('Compatibility map has no bounds.');
    await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
  };

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:4174/city-map-tools/tests/terradraw-compat.html');
  await page.getByText('Ready: MapLibre 6.9 + Terra Draw adapter started.', { exact: true }).waitFor({ timeout: 30000 });
  check((await log()).events.some(event => event.event === 'ready'), 'Terra Draw emits ready on MapLibre 6');

  await page.getByRole('button', { name: 'Draw line', exact: true }).click();
  await mapClick(0.35, 0.45);
  await mapClick(0.55, 0.58);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const button = document.querySelector('#edit-line');
    return button instanceof HTMLButtonElement && !button.disabled;
  }, { timeout: 5000 });
  let snapshot = await log();
  check(snapshot.committed.filter(feature => feature.geometry.type === 'LineString').length === 1, 'LineString drawing commits exactly one transient-free feature');
  check(snapshot.events.some(event => event.event === 'finish' && event.mode === 'linestring'), 'LineString finish event is emitted');

  await page.getByRole('button', { name: 'Edit first line coordinates', exact: true }).click();
  snapshot = await log();
  check(snapshot.events.some(event => event.event === 'edit-coordinate'), `real coordinate update is accepted: ${JSON.stringify(snapshot.events)}`);
  check(snapshot.events.some(event => event.event === 'change'), 'editor emits change events');

  await page.getByRole('button', { name: 'Draw polygon', exact: true }).click();
  await mapClick(0.62, 0.4);
  await mapClick(0.76, 0.48);
  await mapClick(0.69, 0.66);
  await page.keyboard.press('Enter');
  snapshot = await log();
  check(snapshot.committed.filter(feature => feature.geometry.type === 'Polygon').length === 1, 'Polygon drawing commits exactly one transient-free feature');
  check(snapshot.events.some(event => event.event === 'finish' && event.mode === 'polygon'), 'Polygon finish event is emitted');

  await page.getByRole('button', { name: 'Draw line', exact: true }).click();
  await mapClick(0.25, 0.3);
  await page.keyboard.press('Escape');
  snapshot = await log();
  check(snapshot.committed.length === 2, 'Escape removes incomplete transient geometry without changing committed snapshots');

  await page.getByRole('button', { name: 'Clear transient/store', exact: true }).click();
  snapshot = await log();
  check(snapshot.committed.length === 0, 'clear produces an empty committed snapshot');
  await page.getByRole('button', { name: 'Stop and remove map', exact: true }).click();
  check(await page.locator('#status').innerText() === 'Stopped and removed cleanly.', 'draw.stop and map.remove complete cleanly');
  check((await log()).events.some(event => event.event === 'cleanup'), 'cleanup is recorded');
  check(pageErrors.length === 0, `page errors: ${pageErrors.join('; ')}`);
  check(consoleProblems.length === 0, `console problems: ${consoleProblems.join('; ')}`);
  return {
    result: 'PASS',
    pageErrors,
    consoleProblems,
    scenarios: [
      'MapLibre 6 worker plus Terra Draw adapter starts',
      'LineString and Polygon create/change/finish',
      'Escape leaves no committed transient geometry',
      'clear and draw.stop/map.remove teardown',
    ],
  };
}
