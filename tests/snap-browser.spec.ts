import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('hosted CAD snapping preserves exact WGS84 vertices while drawing', async ({ page, request }) => {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'tile.openstreetmap.org') {
      const tile = await request.get('http://127.0.0.1:4175/tile.png');
      await route.fulfill({ status: tile.status(), contentType: 'image/png', body: await tile.body() });
    } else if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) {
      await route.continue();
    } else await route.abort();
  });
  const readProject = () => page.evaluate(() => new Promise<{
    features: Array<{ type: string; coordinates: number[] | number[][] | number[][][] }>;
  }>((resolve, reject) => {
    const open = indexedDB.open('city-map-tools', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction('project-state', 'readonly');
      const get = transaction.objectStore('project-state').get('last-accepted-project');
      get.onsuccess = () => resolve(JSON.parse(get.result));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * 0.5;
  const y = box!.y + box!.height * 0.5;
  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  await page.mouse.click(x, y);
  await expect(page.locator('.feature-row')).toHaveCount(1);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const point = (await readProject()).features.find(feature => feature.type === 'Point')!;

  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await expect(page.locator('.snap-indicator')).toHaveAttribute('data-index', 'ready');
  await page.mouse.click(x + 110, y + 75);
  await page.mouse.move(x + 11, y);
  await expect(page.locator('.editor-status')).toContainText('Vertex snap');
  await page.mouse.click(x + 11, y);
  await page.keyboard.press('Enter');
  await expect(page.locator('.feature-row')).toHaveCount(2);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const line = (await readProject()).features.find(feature => feature.type === 'LineString')!;
  expect((line.coordinates as number[][])[1]).toEqual(point.coordinates);

  // A 14 px offset on the opposite side of the point is outside both the
  // vertex tolerance and the committed line's segment tolerance.
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await expect(page.locator('.snap-indicator')).toHaveAttribute('data-index', 'ready');
  await page.mouse.click(x - 100, y - 90);
  await page.mouse.move(x - 14, y);
  await expect(page.locator('.snap-indicator')).toBeHidden();
  await page.mouse.click(x - 14, y);
  await page.keyboard.press('Enter');
  await expect(page.locator('.feature-row')).toHaveCount(3);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const noSnapLine = (await readProject()).features.filter(feature => feature.type === 'LineString')[1]!;
  expect((noSnapLine.coordinates as number[][])[1]).not.toEqual(point.coordinates);

  // The displayed segment is a valid CAD target away from either endpoint.
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await expect(page.locator('.snap-indicator')).toHaveAttribute('data-index', 'ready');
  await page.mouse.click(x + 190, y + 130);
  await page.mouse.move(x + 49, y + 46);
  await expect(page.locator('.editor-status')).toContainText('Segment snap');
  await page.mouse.click(x + 49, y + 46);
  await page.keyboard.press('Enter');
  await expect(page.locator('.feature-row')).toHaveCount(4);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const segmentLine = (await readProject()).features.filter(feature => feature.type === 'LineString')[2]!;
  const [start, end] = line.coordinates as number[][];
  const snapped = (segmentLine.coordinates as number[][])[1]!;
  const mercatorY = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360));
  const longitudeFraction = (snapped[0]! - start![0]!) / (end![0]! - start![0]!);
  const mercatorFraction = (mercatorY(snapped[1]!) - mercatorY(start![1]!)) /
    (mercatorY(end![1]!) - mercatorY(start![1]!));
  expect(Math.abs(longitudeFraction - mercatorFraction)).toBeLessThan(1e-5);
  expect(longitudeFraction).toBeGreaterThan(0);
  expect(longitudeFraction).toBeLessThan(1);

  await page.getByRole('button', { name: 'Polygon tool', exact: true }).click();
  await expect(page.locator('.snap-indicator')).toHaveAttribute('data-index', 'ready');
  await page.mouse.click(x - 150, y + 90);
  await page.mouse.move(x + 11, y);
  await expect(page.locator('.editor-status')).toContainText('Vertex snap');
  await page.mouse.click(x + 11, y);
  await page.mouse.click(x - 80, y + 160);
  await page.keyboard.press('Enter');
  await expect(page.locator('.feature-row')).toHaveCount(5);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const polygon = (await readProject()).features.find(feature => feature.type === 'Polygon')!;
  const ring = (polygon.coordinates as number[][][])[0]!;
  expect(ring.slice(0, -1)).toContainEqual(point.coordinates);
  expect(ring.at(-1)).toEqual(ring[0]);

  // Coordinate editing uses the SelectMode public custom-snap flag. Apply
  // must keep the exact target, while a later Escape leaves it unchanged.
  await page.getByRole('button', { name: 'Line 2 authored', exact: true }).click();
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await page.mouse.move(x - 100, y - 90);
  await page.mouse.down();
  await page.mouse.move(x + 11, y, { steps: 8 });
  await expect(page.locator('.editor-status')).toContainText('Vertex snap');
  await page.mouse.up();
  await page.getByRole('button', { name: 'Apply geometry', exact: true }).click();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const applied = (await readProject()).features.filter(feature => feature.type === 'LineString')[1]!;
  expect((applied.coordinates as number[][])[0]).toEqual(point.coordinates);
  await page.getByRole('button', { name: 'Edit geometry', exact: true }).click();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 40, y - 35, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  const afterCancel = (await readProject()).features.filter(feature => feature.type === 'LineString')[1]!;
  expect(afterCancel.coordinates).toEqual(applied.coordinates);
});

test('authored Point drag shares snap policy and commits only on release', async ({ page, request }) => {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'tile.openstreetmap.org') {
      const tile = await request.get('http://127.0.0.1:4175/tile.png');
      await route.fulfill({ status: tile.status(), contentType: 'image/png', body: await tile.body() });
    } else if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) {
      await route.continue();
    } else await route.abort();
  });
  const readProject = () => page.evaluate(() => new Promise<{ features: Array<{ name: string; coordinates: number[] }> }>((resolve, reject) => {
    const open = indexedDB.open('city-map-tools', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction('project-state', 'readonly');
      const get = transaction.objectStore('project-state').get('last-accepted-project');
      get.onsuccess = () => resolve(JSON.parse(get.result));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  const box = await page.locator('.maplibregl-canvas').boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * 0.5;
  const y = box!.y + box!.height * 0.5;
  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  await page.mouse.click(x - 80, y - 50);
  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  await page.mouse.click(x + 80, y + 50);
  await expect(page.locator('.feature-row')).toHaveCount(2);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const baseline = await readProject();
  const first = baseline.features.find(feature => feature.name === 'Point 1')!;
  const target = baseline.features.find(feature => feature.name === 'Point 2')!;
  const markers = page.locator('.point-marker');
  const startBox = await markers.nth(0).boundingBox();
  const targetBox = await markers.nth(1).boundingBox();
  expect(startBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  const startX = startBox!.x + startBox!.width / 2;
  const startY = startBox!.y + startBox!.height / 2;
  const endX = targetBox!.x + targetBox!.width / 2 + 11;
  const endY = targetBox!.y + targetBox!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 8 });
  await expect(page.locator('.editor-status')).toContainText('Vertex snap');
  expect((await readProject()).features.find(feature => feature.name === 'Point 1')!.coordinates).toEqual(first.coordinates);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Points GeoJSON', exact: true })
    .evaluate(button => (button as HTMLButtonElement).click());
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8')) as {
    features: Array<{ properties: { name: string }; geometry: { coordinates: number[] } }>;
  };
  expect(exported.features.find(feature => feature.properties.name === 'Point 1')?.geometry.coordinates)
    .toEqual(first.coordinates);
  await page.mouse.up();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const committed = await readProject();
  expect(committed.features.find(feature => feature.name === 'Point 1')!.coordinates).toEqual(target.coordinates);
  await page.getByRole('button', { name: 'Undo project edit', exact: true }).click();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  expect((await readProject()).features.find(feature => feature.name === 'Point 1')!.coordinates).toEqual(first.coordinates);
  await expect(page.locator('.feature-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Redo project edit', exact: true }).click();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  expect((await readProject()).features.find(feature => feature.name === 'Point 1')!.coordinates).toEqual(target.coordinates);

  await page.getByRole('button', { name: 'Undo project edit', exact: true }).click();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');

  const cancelledBox = await markers.nth(0).boundingBox();
  expect(cancelledBox).not.toBeNull();
  await page.mouse.move(cancelledBox!.x + cancelledBox!.width / 2, cancelledBox!.y + cancelledBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(cancelledBox!.x + cancelledBox!.width / 2 - 70,
    cancelledBox!.y + cancelledBox!.height / 2 - 45, { steps: 6 });
  await expect(page.getByRole('button', { name: 'Undo project edit', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect((await readProject()).features.find(feature => feature.name === 'Point 1')!.coordinates).toEqual(first.coordinates);
});

test('hidden, imported, derived, and self geometry cannot snap; camera and style rebuild the index', async ({ page, request }) => {
  test.setTimeout(60_000);
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'tile.openstreetmap.org') {
      const tile = await request.get('http://127.0.0.1:4175/tile.png');
      await route.fulfill({ status: tile.status(), contentType: 'image/png', body: await tile.body() });
    } else if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) {
      await route.continue();
    } else await route.abort();
  });
  const readProject = () => page.evaluate(() => new Promise<{
    features: Array<{ name: string; type: string; coordinates: number[] | number[][] }>;
  }>((resolve, reject) => {
    const open = indexedDB.open('city-map-tools', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction('project-state', 'readonly');
      const get = transaction.objectStore('project-state').get('last-accepted-project');
      get.onsuccess = () => resolve(JSON.parse(get.result));
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => reject(transaction.error);
    };
  }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * 0.5;
  const y = box!.y + box!.height * 0.5;
  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  await page.mouse.click(x, y);
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const original = (await readProject()).features.find(feature => feature.name === 'Point 1')!.coordinates as number[];

  // The moving authored Point must not see its committed starting vertex as a target.
  const marker = page.locator('.point-marker').first();
  const markerBox = await marker.boundingBox();
  expect(markerBox).not.toBeNull();
  const markerX = markerBox!.x + markerBox!.width / 2;
  const markerY = markerBox!.y + markerBox!.height / 2;
  await page.mouse.move(markerX, markerY);
  await page.mouse.down();
  await page.mouse.move(markerX + 11, markerY, { steps: 5 });
  await expect(page.locator('.snap-indicator')).toBeHidden();
  await page.mouse.up();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  expect((await readProject()).features.find(feature => feature.name === 'Point 1')!.coordinates).not.toEqual(original);
  await page.getByRole('button', { name: 'Undo project edit', exact: true }).click();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');

  await page.getByRole('button', { name: 'Point 1 authored', exact: true }).click();
  await page.getByLabel('Buffer radius (metres)', { exact: true }).fill('55');
  await page.getByRole('button', { name: 'Create derived buffer', exact: true }).click();
  await expect(page.locator('.feature-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Hide Point 1', exact: true }).click();
  const importedGeoJson = JSON.stringify({ type: 'FeatureCollection', features: [{
    type: 'Feature', properties: { name: 'Imported control' },
    geometry: { type: 'Point', coordinates: original },
  }] });
  await page.locator('input[type=file]').evaluate((input, text) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([text], 'imported-point.geojson', { type: 'application/geo+json' }));
    (input as HTMLInputElement).files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, importedGeoJson);
  await expect(page.locator('.feature-row')).toHaveCount(3);
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await expect(page.locator('.snap-indicator')).toHaveAttribute('data-index', 'ready');
  await page.mouse.click(x + 130, y + 100);
  await page.mouse.move(x + 11, y);
  await expect(page.locator('.snap-indicator')).toBeHidden();
  await page.keyboard.press('Escape');

  await page.getByLabel('CARTO Basemaps API key').fill('synthetic-carto-snap-test-only');
  await page.getByRole('button', { name: 'Use key and switch to Voyager' }).click();
  await expect(page.locator('.snap-indicator')).toHaveAttribute('data-index', 'invalidated');
  await expect(page.locator('.map-status strong')).toHaveText('Map unavailable', { timeout: 30_000 });
  await page.getByLabel('Provider', { exact: true }).selectOption('osm');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  await expect(page.locator('.snap-indicator')).toHaveAttribute('data-index', 'ready');

  await page.getByRole('button', { name: 'Show Point 1', exact: true }).click();
  await expect(page.locator('.point-marker')).toHaveCount(2);
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, -330);
  await expect(page.locator('.snap-indicator')).toHaveAttribute('data-index', 'invalidated');
  await expect(page.locator('.snap-indicator')).toHaveAttribute('data-index', 'ready', { timeout: 10_000 });
  const pointBox = await page.locator('.point-marker').first().boundingBox();
  expect(pointBox).not.toBeNull();
  const px = pointBox!.x + pointBox!.width / 2;
  const py = pointBox!.y + pointBox!.height / 2;
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await expect(page.locator('.snap-indicator')).toHaveAttribute('data-index', 'ready');
  await page.mouse.click(px + 100, py + 80);
  await page.mouse.move(px - 14, py);
  await expect(page.locator('.snap-indicator')).toBeHidden();
  await page.mouse.move(px + 11, py);
  await expect(page.locator('.editor-status')).toContainText('Vertex snap');
  await page.mouse.click(px + 11, py);
  await page.keyboard.press('Enter');
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const snappedLine = (await readProject()).features.find(feature => feature.type === 'LineString')!;
  expect((snappedLine.coordinates as number[][])[1]).toEqual(original);
});
