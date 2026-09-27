import { expect, test } from '@playwright/test';

const tileServerUrl = 'http://127.0.0.1:4175/tile.png';
const tileHost = 'tile.openstreetmap.org';

test('hosted app preserves project history and recovery across reload', async ({ page, request }) => {
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  const unexpectedExternalRequests: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'warning' || message.type() === 'error') {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === tileHost && url.protocol === 'https:') {
      const tile = await request.get(tileServerUrl);
      await route.fulfill({ status: tile.status(), contentType: 'image/png', body: await tile.body() });
      return;
    }
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)) {
      await route.continue();
      return;
    }
    if (url.protocol === 'data:' || url.protocol === 'blob:') {
      await route.continue();
      return;
    }
    unexpectedExternalRequests.push(url.href);
    await route.abort();
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  await expect(page).toHaveURL('http://127.0.0.1:4173/city-map-tools/');

  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  const canvas = page.locator('.maplibregl-canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.click(bounds!.x + bounds!.width * 0.48, bounds!.y + bounds!.height * 0.48);
  await expect(page.locator('.feature-row')).toHaveCount(1);

  const undo = page.getByRole('button', { name: 'Undo project edit', exact: true });
  const redo = page.getByRole('button', { name: 'Redo project edit', exact: true });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(page.locator('.feature-row')).toHaveCount(0);
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(page.locator('.feature-row')).toHaveCount(1);
  await expect(undo).toBeEnabled();
  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');

  await page.reload();
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  await expect(page.locator('.feature-row')).toHaveCount(1);
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Select tool', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Point tool', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('region', { name: 'Feature inspector' })).toHaveCount(0);

  const readStoredProject = () => page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const open = indexedDB.open('city-map-tools', 1);
    open.onerror = () => reject(new Error('Could not open the project database.'));
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('project-state', 'readonly');
      const get = transaction.objectStore('project-state').get('last-accepted-project');
      get.onsuccess = () => resolve(get.result);
      transaction.onerror = () => reject(new Error('Could not read the stored project.'));
      transaction.oncomplete = () => database.close();
    };
  }));
  const writeStoredProject = (record: unknown) => page.evaluate(value => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('city-map-tools', 1);
    open.onerror = () => reject(new Error('Could not open the project database for the recovery fixture.'));
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('project-state', 'readwrite');
      transaction.objectStore('project-state').put(value, 'last-accepted-project');
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(new Error('Could not write the recovery fixture.')); };
      transaction.onabort = () => { database.close(); reject(new Error('Recovery fixture write was aborted.')); };
    };
  }), record);

  const savedRecord = await readStoredProject();
  expect(typeof savedRecord).toBe('string');
  const corruptRecords = [
    '{corrupt project',
    JSON.stringify({ ...(JSON.parse(savedRecord as string) as object), schemaVersion: 2 }),
  ];
  for (const invalidRecord of corruptRecords) {
    await writeStoredProject(invalidRecord);
    await page.reload();
    await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
    await expect(page.locator('.project-save-state strong')).toHaveText('Error');
    await expect(page.locator('.feature-row')).toHaveCount(0);

    await page.getByRole('button', { name: 'Point tool', exact: true }).click();
    const currentBounds = await canvas.boundingBox();
    expect(currentBounds).not.toBeNull();
    await page.mouse.click(currentBounds!.x + currentBounds!.width * 0.48, currentBounds!.y + currentBounds!.height * 0.48);
    await expect(page.locator('.feature-row')).toHaveCount(1);
    await page.waitForTimeout(700);
    await expect(page.locator('.project-save-state strong')).toHaveText('Error');
    expect(await readStoredProject()).toBe(invalidRecord);
  }

  expect(unexpectedExternalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleProblems).toEqual([]);
});
