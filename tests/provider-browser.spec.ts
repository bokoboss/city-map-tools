import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const syntheticKey = 'synthetic-carto-browser-key-only';
const tileServerUrl = 'http://127.0.0.1:4175/tile.png';
const cartoHost = 'basemaps.cartocdn.com';

async function storedProject(page: import('@playwright/test').Page): Promise<unknown> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('city-map-tools', 1);
    open.onerror = () => reject(new Error('Project database unavailable.'));
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('project-state', 'readonly');
      const get = transaction.objectStore('project-state').get('last-accepted-project');
      get.onsuccess = () => resolve(get.result);
      transaction.onerror = () => reject(new Error('Project record unavailable.'));
      transaction.oncomplete = () => database.close();
    };
  }));
}

test('Voyager requires runtime BYOK and never saves the synthetic credential', async ({ page, request }) => {
  const cartoRequests: string[] = [];
  const consoleText: string[] = [];
  page.on('console', message => consoleText.push(message.text()));
  page.on('pageerror', error => consoleText.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'tile.openstreetmap.org') {
      const tile = await request.get(tileServerUrl);
      await route.fulfill({ status: tile.status(), contentType: 'image/png', body: await tile.body() });
      return;
    }
    if (url.hostname === cartoHost) {
      cartoRequests.push(url.pathname + url.search);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [] }) });
      return;
    }
    if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) {
      await route.continue();
      return;
    }
    await route.abort();
  });

  await page.goto('/');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Point tool' }).click();
  const box = await page.locator('.maplibregl-canvas').boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.locator('.feature-row')).toHaveCount(1);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const before = await storedProject(page);
  await page.getByLabel('Provider', { exact: true }).selectOption('voyager');
  await expect(page.getByLabel('Provider', { exact: true })).toHaveValue('osm');
  await expect(page.locator('.provider-notice')).toContainText('requires your runtime CARTO Basemaps API key');
  expect(cartoRequests).toHaveLength(0);
  expect(await storedProject(page)).toBe(before);

  await page.getByLabel('CARTO Basemaps API key').fill(syntheticKey);
  await page.getByRole('button', { name: 'Use key and switch to Voyager' }).click();
  await expect(page.getByLabel('Provider', { exact: true })).toHaveValue('voyager');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  expect(cartoRequests.length).toBeGreaterThan(0);
  expect(cartoRequests.every(path => new URL(path, `https://${cartoHost}`).searchParams.get('key') === syntheticKey)).toBe(true);
  await expect(page.locator('.building-control button')).toBeDisabled();
  await expect(page.locator('#building-reason')).toContainText('3D unavailable');
  expect(await storedProject(page)).toBe(before);
  expect(JSON.stringify(await storedProject(page)).includes(syntheticKey)).toBe(false);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Points GeoJSON' }).click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).not.toBeNull();
  expect((await readFile(path!, 'utf8')).includes(syntheticKey)).toBe(false);
  expect((await page.locator('body').innerText()).includes(syntheticKey)).toBe(false);
  expect((await page.getByLabel('CARTO Basemaps API key').inputValue()).includes(syntheticKey)).toBe(false);
  expect(page.url().includes(syntheticKey)).toBe(false);
  const browserState = await page.evaluate(() => JSON.stringify({
    local: { ...localStorage }, session: { ...sessionStorage }, history: history.state,
  }));
  expect(browserState.includes(syntheticKey)).toBe(false);
  expect(consoleText.some(message => message.includes(syntheticKey))).toBe(false);

  await page.getByRole('button', { name: 'Clear runtime key' }).click();
  await expect(page.getByLabel('Provider', { exact: true })).toHaveValue('osm');
  const requestCount = cartoRequests.length;
  await page.getByLabel('Provider', { exact: true }).selectOption('voyager');
  await expect(page.getByLabel('Provider', { exact: true })).toHaveValue('osm');
  expect(cartoRequests).toHaveLength(requestCount);
});

test('clearing a runtime key preserves an active draft and blocks later CARTO requests', async ({ page, request }) => {
  const cartoRequests: string[] = [];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'tile.openstreetmap.org') {
      const tile = await request.get(tileServerUrl);
      await route.fulfill({ status: tile.status(), contentType: 'image/png', body: await tile.body() });
    } else if (url.hostname === cartoHost || url.hostname === `tiles.${cartoHost}`) {
      cartoRequests.push(url.toString());
      expect(url.searchParams.get('key')).toBe(syntheticKey);
      if (url.pathname.endsWith('.pbf')) {
        await route.fulfill({ status: 200, contentType: 'application/x-protobuf', body: Buffer.alloc(0) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          version: 8,
          sources: { tiles: { type: 'vector', tiles: [`https://tiles.${cartoHost}/tiles/{z}/{x}/{y}.pbf`] } },
          layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#eee' } },
            { id: 'tile-fixture', type: 'fill', source: 'tiles', 'source-layer': 'fixture', paint: { 'fill-color': '#ddd' } },
          ],
        }) });
      }
    } else if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) {
      await route.continue();
    } else {
      await route.abort();
    }
  });

  await page.goto('/');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const before = await storedProject(page);
  await page.getByLabel('CARTO Basemaps API key').fill(syntheticKey);
  await page.getByRole('button', { name: 'Use key and switch to Voyager' }).click();
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  expect(cartoRequests.length).toBeGreaterThan(0);
  expect(cartoRequests.some(url => new URL(url).hostname === `tiles.${cartoHost}`)).toBe(true);

  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await page.mouse.click(box!.x + box!.width * 0.4, box!.y + box!.height * 0.4);
  await page.getByRole('button', { name: 'Clear runtime key' }).click();
  await expect(page.getByLabel('Provider', { exact: true })).toHaveValue('voyager');
  await expect(page.locator('.provider-notice')).toContainText('key cleared. Finish or cancel the active geometry draft');
  await expect(page.locator('.provider-notice')).toContainText('CARTO requests are blocked');
  await expect(page.getByRole('button', { name: 'Line tool', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#carto-key-help')).toContainText('Voyager requires your own runtime key');
  await expect(page.getByLabel('CARTO Basemaps API key')).toBeEmpty();
  expect(await storedProject(page)).toBe(before);

  const requestCount = cartoRequests.length;
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.waitForTimeout(300);
  expect(cartoRequests).toHaveLength(requestCount);
  await page.mouse.click(box!.x + box!.width * 0.6, box!.y + box!.height * 0.6);
  await page.keyboard.press('Enter');
  await expect(page.locator('.feature-row')).toHaveCount(1);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  expect(JSON.stringify(await storedProject(page)).includes(syntheticKey)).toBe(false);
  await page.getByLabel('Provider', { exact: true }).selectOption('osm');
  await expect(page.getByLabel('Provider', { exact: true })).toHaveValue('osm');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  expect(cartoRequests).toHaveLength(requestCount);
});

test('failing CARTO style stays unavailable without leaking the runtime key', async ({ page, request }) => {
  const consoleText: string[] = [];
  page.on('console', message => consoleText.push(message.text()));
  page.on('pageerror', error => consoleText.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'tile.openstreetmap.org') {
      const tile = await request.get(tileServerUrl);
      await route.fulfill({ status: tile.status(), contentType: 'image/png', body: await tile.body() });
    } else if (url.hostname === cartoHost) {
      await route.fulfill({ status: 429, contentType: 'text/plain', body: 'Rate limited' });
    } else if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  await page.goto('/');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  await page.getByLabel('CARTO Basemaps API key').fill(syntheticKey);
  await page.getByRole('button', { name: 'Use key and switch to Voyager' }).click();
  await expect(page.locator('.map-status strong')).toHaveText('Map unavailable', { timeout: 30_000 });
  await expect(page.locator('.building-control button')).toBeDisabled();
  expect((await page.locator('body').innerText()).includes(syntheticKey)).toBe(false);
  expect(consoleText.some(message => message.includes(syntheticKey))).toBe(false);
});

test('3D requires a compatible building layer in the actually loaded keyed style', async ({ page, request }) => {
  let keyedTileRequests = 0;
  let keyedSpriteRequests = 0;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'tile.openstreetmap.org') {
      const tile = await request.get(tileServerUrl);
      await route.fulfill({ status: tile.status(), contentType: 'image/png', body: await tile.body() });
    } else if ([cartoHost, `tiles.${cartoHost}`, `a.${cartoHost}`].includes(url.hostname)) {
      expect(url.searchParams.get('key') === syntheticKey).toBe(true);
      if (url.pathname.endsWith('.pbf')) {
        keyedTileRequests += 1;
        await route.fulfill({ status: 200, contentType: 'application/x-protobuf', body: Buffer.alloc(0) });
      } else if (url.pathname.endsWith('/sprite.json')) {
        keyedSpriteRequests += 1;
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      } else if (url.pathname.endsWith('/sprite.png')) {
        keyedSpriteRequests += 1;
        const tile = await request.get(tileServerUrl);
        await route.fulfill({ status: tile.status(), contentType: 'image/png', body: await tile.body() });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          version: 8,
          sprite: 'https://a.basemaps.cartocdn.com/gl/voyager-gl-style/sprite',
          glyphs: 'https://b.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf',
          sources: { providerBuildings: { type: 'vector', tiles: ['https://tiles.basemaps.cartocdn.com/tiles/{z}/{x}/{y}.pbf'], attribution: '© OpenStreetMap contributors, © CARTO' } },
          layers: [{ id: 'provider-building', type: 'fill', source: 'providerBuildings', 'source-layer': 'building', paint: { 'fill-color': '#aaa' } }],
        }) });
      }
    } else if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  await page.goto('/');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  await expect(page.locator('.building-control button')).toBeDisabled();
  await page.getByLabel('CARTO Basemaps API key').fill(syntheticKey);
  await page.getByRole('button', { name: 'Use key and switch to Voyager' }).click();
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  expect(keyedTileRequests).toBeGreaterThan(0);
  expect(keyedSpriteRequests).toBeGreaterThan(0);
  const buildings = page.locator('.building-control button');
  await expect(buildings).toBeEnabled();
  await expect(buildings).toHaveAttribute('aria-pressed', 'false');
  await buildings.click();
  await expect(buildings).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.maplibregl-ctrl-attrib')).toContainText('CARTO');
});
