import { expect, test, type Page, type Request } from '@playwright/test';
import { createEmptyProjectDocument, serializeProjectDocument } from '../src/project/projectDocument';
import {
  readActiveProjectRecord,
  readProjectRecord,
  readProjectRecords,
  writeProjectRecord,
} from './project-browser-helpers';

const previewOrigin = 'http://127.0.0.1:4173';
const fixtureUrl = `${previewOrigin}/city-map-tools/__5d_idb_fixture__`;
const appUrl = `${previewOrigin}/city-map-tools/`;
const tileServerUrl = 'http://127.0.0.1:4175/tile.png';
const cartoHosts = new Set([
  'basemaps.cartocdn.com',
  'tiles.basemaps.cartocdn.com',
  'a.basemaps.cartocdn.com',
  'b.basemaps.cartocdn.com',
  'c.basemaps.cartocdn.com',
  'd.basemaps.cartocdn.com',
]);

function serializedProject(id: string, name: string): string {
  return serializeProjectDocument(createEmptyProjectDocument({
    id,
    name,
    createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-03T00:00:00.000Z',
  }));
}

async function routeLocalProviders(page: Page, request: Request): Promise<void> {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'tile.openstreetmap.org') {
      const tile = await request.get(tileServerUrl);
      await route.fulfill({ status: tile.status(), contentType: 'image/png', body: await tile.body() });
    } else if (cartoHosts.has(url.hostname)) {
      if (url.pathname.endsWith('.pbf')) {
        await route.fulfill({ status: 200, contentType: 'application/x-protobuf', body: Buffer.alloc(0) });
      } else if (url.pathname.endsWith('/sprite.png')) {
        const tile = await request.get(tileServerUrl);
        await route.fulfill({ status: tile.status(), contentType: 'image/png', body: await tile.body() });
      } else if (url.pathname.endsWith('/sprite.json')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [] }) });
      }
    } else if (['127.0.0.1', 'localhost'].includes(url.hostname) || ['data:', 'blob:'].includes(url.protocol)) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  await page.route(fixtureUrl, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>IndexedDB fixture</title>' }));
}

async function seedIndexedDb(page: Page, records: Array<[string, unknown]>): Promise<void> {
  await page.goto(fixtureUrl);
  for (const [key, value] of records) await writeProjectRecord(page, key, value);
}

async function loadApp(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(appUrl);
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
}

async function createNamedPoint(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Point tool', exact: true }).click();
  const canvas = await page.locator('.maplibregl-canvas').boundingBox();
  expect(canvas).not.toBeNull();
  await page.mouse.click(canvas!.x + canvas!.width * 0.48, canvas!.y + canvas!.height * 0.48);
  await expect(page.locator('.feature-row')).toHaveCount(1);
  const nameInput = page.getByLabel('Name', { exact: true });
  await nameInput.fill(name);
  await nameInput.press('Enter');
  await expect(page.locator('.feature-row-name')).toHaveText(name);
}

test('legacy #5C document migrates exactly through one atomic browser-local transaction', async ({ page, request }) => {
  await routeLocalProviders(page, request);
  const original = serializedProject('legacy-project-5c', 'Legacy project from #5C');
  await seedIndexedDb(page, [['last-accepted-project', original]]);

  await loadApp(page);
  await expect(page.getByLabel('Current project name')).toHaveText('Legacy project from #5C');
  const active = await readActiveProjectRecord(page);
  expect(active.projectId).toBe('legacy-project-5c');
  expect(active.value).toBe(original);
  expect(await readProjectRecord(page, 'project:legacy-project-5c')).toBe(original);
  expect(await readProjectRecord(page, 'active-project-id')).toBe('legacy-project-5c');
  expect(await readProjectRecord(page, 'last-accepted-project')).toBeUndefined();

  const databaseShape = await page.evaluate(() => new Promise<{ version: number; stores: string[]; indexes: number }>((resolve, reject) => {
    const open = indexedDB.open('city-map-tools', 1);
    open.onerror = () => reject(new Error('Could not inspect the project database.'));
    open.onsuccess = () => {
      const database = open.result;
      const stores = Array.from(database.objectStoreNames);
      const transaction = database.transaction('project-state', 'readonly');
      const indexes = transaction.objectStore('project-state').indexNames.length;
      transaction.oncomplete = () => { database.close(); resolve({ version: database.version, stores, indexes }); };
      transaction.onerror = () => reject(new Error('Could not inspect the existing project object store.'));
    };
  }));
  expect(databaseShape).toEqual({ version: 1, stores: ['project-state'], indexes: 0 });
});

test('New, Open, Save now, reload, interaction protection, and provider-key isolation work across local projects', async ({ page, request }) => {
  const pageErrors: string[] = [];
  const consoleProblems: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'warning' || message.type() === 'error') consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  await routeLocalProviders(page, request);
  await seedIndexedDb(page, [['last-accepted-project', serializedProject('legacy-starter', 'Legacy starter')]]);
  await loadApp(page);
  await expect(page.getByLabel('Current project name')).toHaveText('Legacy starter');

  await page.getByRole('button', { name: 'Projects…', exact: true }).click();
  await page.getByLabel('New local project name', { exact: true }).fill('Project A');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.getByLabel('Current project name')).toHaveText('Project A');
  await createNamedPoint(page, 'Project A recognisable point');
  await page.getByRole('button', { name: 'Save now', exact: true }).click();
  await expect(page.locator('.project-feedback')).toHaveText('The current browser-local project is saved.');
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const projectA = await readActiveProjectRecord(page);
  const projectAText = projectA.value;
  expect(typeof projectAText).toBe('string');
  const projectADocument = JSON.parse(projectAText as string);

  await page.getByRole('button', { name: 'Projects…', exact: true }).click();
  await expect(page.locator('.local-project-list li.active-project time')).toHaveAttribute('datetime', projectADocument.metadata.updatedAt);
  await page.getByLabel('New local project name', { exact: true }).fill('Project B');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.getByLabel('Current project name')).toHaveText('Project B');
  await expect(page.locator('.feature-row')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Undo project edit', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo project edit', exact: true })).toBeDisabled();
  await createNamedPoint(page, 'Project B recognisable point');
  await page.getByRole('button', { name: 'Save now', exact: true }).click();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const projectB = await readActiveProjectRecord(page);
  expect(projectB.projectId).not.toBe(projectA.projectId);
  expect(projectB.value).not.toBe(projectAText);
  expect(JSON.parse(projectB.value as string).features.map((feature: { name: string }) => feature.name)).toEqual(['Project B recognisable point']);
  expect(await readProjectRecord(page, `project:${projectA.projectId}`)).toBe(projectAText);

  await page.getByRole('button', { name: 'Projects…', exact: true }).click();
  await page.getByRole('button', { name: 'Open project Project A', exact: true }).click();
  await expect(page.getByLabel('Current project name')).toHaveText('Project A');
  await expect(page.locator('.feature-row-name')).toHaveText('Project A recognisable point');
  await expect(page.getByRole('button', { name: 'Undo project edit', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo project edit', exact: true })).toBeDisabled();
  expect((await readActiveProjectRecord(page)).value).toBe(projectAText);

  await page.reload();
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  await expect(page.getByLabel('Current project name')).toHaveText('Project A');
  await expect(page.locator('.feature-row-name')).toHaveText('Project A recognisable point');
  await expect(page.getByRole('button', { name: 'Undo project edit', exact: true })).toBeDisabled();
  expect((await readActiveProjectRecord(page)).projectId).toBe(projectA.projectId);

  const savedA = await readActiveProjectRecord(page);
  const canvas = await page.locator('.maplibregl-canvas').boundingBox();
  expect(canvas).not.toBeNull();
  await page.getByRole('button', { name: 'Line tool', exact: true }).click();
  await page.mouse.click(canvas!.x + canvas!.width * 0.42, canvas!.y + canvas!.height * 0.42);
  await page.mouse.click(canvas!.x + canvas!.width * 0.54, canvas!.y + canvas!.height * 0.51);
  await expect(page.getByRole('button', { name: 'Line tool', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Save now', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Projects…', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.project-action-reason')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New project', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Open project Project B', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Close projects', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Line tool', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect((await readActiveProjectRecord(page)).value).toBe(savedA.value);
  await page.locator('.maplibregl-canvas').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.feature-row')).toHaveCount(2);
  await expect(page.locator('.project-save-state strong')).toHaveText('Unsaved');
  await page.getByRole('button', { name: 'Save now', exact: true }).click();
  await expect(page.locator('.project-save-state strong')).toHaveText('Saved');
  const committedA = await readProjectRecord(page, `project:${projectA.projectId}`);
  expect(JSON.parse(committedA as string).features.map((feature: { type: string }) => feature.type)).toEqual(['Point', 'LineString']);
  expect(await readProjectRecord(page, `project:${projectB.projectId}`)).toBe(projectB.value);

  const syntheticKey = 'synthetic-5d-runtime-only-key';
  await page.getByLabel('CARTO Basemaps API key', { exact: true }).fill(syntheticKey);
  await page.getByRole('button', { name: 'Use key and switch to Voyager', exact: true }).click();
  await expect(page.getByLabel('Provider', { exact: true })).toHaveValue('voyager');
  await expect(page.locator('.map-status strong')).toHaveText('Ready', { timeout: 30_000 });
  const allStored = await readProjectRecords(page);
  expect(JSON.stringify(allStored)).not.toContain(syntheticKey);
  expect(Object.keys(allStored).sort()).toEqual([
    `project:${projectA.projectId}`,
    `project:${projectB.projectId}`,
    'project:legacy-starter',
    'active-project-id',
  ].sort());
  await expect(page.getByLabel('CARTO Basemaps API key', { exact: true })).toBeEmpty();
  expect(pageErrors).toEqual([]);
  expect(consoleProblems.some(message => message.includes(syntheticKey))).toBe(false);
});

test('an aborted migration leaves the exact legacy value and creates no partial namespaced state', async ({ page, request }) => {
  await page.addInitScript(() => {
    const originalDelete = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (key: IDBValidKey | IDBKeyRange) {
      const request = originalDelete.call(this, key);
      const state = window as typeof window & { __abort5dMigration?: boolean };
      if (state.__abort5dMigration && key === 'last-accepted-project' && this.transaction.mode === 'readwrite') {
        state.__abort5dMigration = false;
        this.transaction.abort();
      }
      return request;
    };
    (window as typeof window & { __abort5dMigration?: boolean }).__abort5dMigration = true;
  });
  await routeLocalProviders(page, request);
  const original = serializedProject('legacy-abort-fixture', 'Migration abort fixture');
  await seedIndexedDb(page, [['last-accepted-project', original]]);
  await page.goto(appUrl);
  await expect(page.getByRole('region', { name: 'Browser-local project storage error' })).toBeVisible();
  const records = await readProjectRecords(page);
  expect(records).toEqual({ 'last-accepted-project': original });
});

test('malformed legacy and future active project records stay intact through explicit recovery New', async ({ page, request }) => {
  await routeLocalProviders(page, request);
  const invalidLegacy = '{malformed legacy recovery bytes';
  await seedIndexedDb(page, [['last-accepted-project', invalidLegacy]]);
  await page.goto(appUrl);
  await expect(page.getByRole('region', { name: 'Browser-local project recovery' })).toBeVisible();
  await expect(page.locator('.project-recovery-panel')).toContainText(/not overwritten or deleted/i);
  await page.getByLabel('New local project name', { exact: true }).fill('Legacy recovery project');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.getByLabel('Current project name')).toHaveText('Legacy recovery project');
  expect(await readProjectRecord(page, 'last-accepted-project')).toBe(invalidLegacy);
  const newProject = await readActiveProjectRecord(page);
  expect(newProject.value).toEqual(expect.any(String));

  const futureProject = JSON.stringify({ ...createEmptyProjectDocument({
    id: 'future-active-project',
    name: 'Future active project',
    createdAt: '2026-10-03T00:00:00.000Z',
  }), schemaVersion: 2 });
  await writeProjectRecord(page, 'project:future-active-project', futureProject);
  await writeProjectRecord(page, 'active-project-id', 'future-active-project');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Browser-local project recovery' })).toBeVisible();
  await expect(page.getByText('Unavailable project (future-active-project)')).toBeVisible();
  await expect(page.locator('.project-recovery-panel')).toContainText(/not overwritten or deleted/i);
  await page.getByLabel('New local project name', { exact: true }).fill('Future recovery project');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(page.getByLabel('Current project name')).toHaveText('Future recovery project');
  expect(await readProjectRecord(page, 'project:future-active-project')).toBe(futureProject);
  expect(await readProjectRecord(page, 'last-accepted-project')).toBe(invalidLegacy);
  expect((await readActiveProjectRecord(page)).projectId).not.toBe('future-active-project');
});
