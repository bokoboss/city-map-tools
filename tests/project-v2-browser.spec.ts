import { expect, test, type Page } from '@playwright/test';
import { createProjectDocument, serializeProjectDocument } from '../src/project/projectDocumentV1';
import { createAuthoredLineString, createDefaultLayers } from '../src/features/featureModel';
import { readProjectRecords, writeProjectRecord } from './project-browser-helpers';

const origin = 'http://127.0.0.1:4173';
const fixtureUrl = `${origin}/city-map-tools/__t2a_fixture__`;
const rawV1 = JSON.stringify(JSON.parse(serializeProjectDocument(createProjectDocument({
  metadata: { id: 'a', name: 'Legacy A', createdAt: '2026-10-18T00:00:00.000Z', updatedAt: '2026-10-18T00:00:00.000Z' },
  layers: createDefaultLayers(), features: [createAuthoredLineString('__proto__', [[100.5, 13.75], [100.51, 13.76]], 1)],
}))), null, 2);

async function start(page: Page, legacy = false): Promise<void> {
  await page.route(fixtureUrl, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>T2A storage regression</title>' }));
  await page.goto(fixtureUrl);
  if (legacy) await writeProjectRecord(page, 'last-accepted-project', rawV1);
  else {
    await writeProjectRecord(page, 'project:a', rawV1);
    await writeProjectRecord(page, 'active-project-id', 'a');
  }
  await page.evaluate(async () => {
    const api = await import(/* @vite-ignore */ '/city-map-tools/__project_v2_probe.mjs');
    const catalog = new api.ProjectCatalog(new api.IndexedDbProjectCatalogStorage());
    const stored = await catalog.bootstrap();
    if (stored.kind !== 'ready') throw new Error('fixture did not bootstrap');
    const persistence = new api.ProjectPersistence(stored.document, new api.IndexedDbProjectStorage('a'));
    persistence.restoreStored(stored.serialized);
    (window as any).t2a = { api, catalog, persistence, history: api.createProjectHistory(stored.document), tick: 0 };
  });
}

async function edit(page: Page, type = 'convertToTrafficMovement'): Promise<void> {
  await page.evaluate(commandType => {
    const state = (window as any).t2a;
    state.history = state.api.executeProjectCommand(state.history,
      { type: commandType, id: '__proto__', direction: 'reverse', name: 'Edited line' },
      new Date(Date.parse('2026-10-18T00:00:00.000Z') + ++state.tick * 1000).toISOString());
    state.persistence.commit(state.history.present);
  }, type);
}

async function flush(page: Page): Promise<string> {
  return page.evaluate(async () => {
    try { await (window as any).t2a.persistence.flushNow(); return 'saved'; }
    catch (error) { return (error as { code: string }).code; }
  });
}

test('v1 open/list/Save-now preserve bytes; legacy migration and first edit backup are atomic, undo/reload stay v2', async ({ page }) => {
  await start(page, true);
  expect(await readProjectRecords(page)).toEqual({ 'project:a': rawV1, 'active-project-id': 'a' });
  await page.evaluate(async () => {
    const { catalog, persistence } = (window as any).t2a;
    await catalog.listProjects('a');
    await catalog.openProject('a', () => persistence.flushNow());
  });
  expect(await flush(page)).toBe('saved');
  expect(await readProjectRecords(page)).toEqual({ 'project:a': rawV1, 'active-project-id': 'a' });
  await edit(page);
  expect(await flush(page)).toBe('saved');
  const upgraded = await readProjectRecords(page);
  expect(upgraded['migration-backup:v1:a']).toBe(rawV1);
  expect(upgraded['active-project-id']).toBe('a');
  expect(upgraded['last-accepted-project']).toBeUndefined();
  expect(JSON.parse(upgraded['project:a'] as string).trafficMovements['__proto__'].direction).toBe('forward');
  expect(JSON.parse(upgraded['project:a'] as string).schemaVersion).toBe(2);
  await edit(page, 'setTrafficMovementDirection');
  expect(await flush(page)).toBe('saved');
  await page.evaluate(async () => {
    const state = (window as any).t2a;
    state.history = state.api.undoProject(state.history, '2026-10-18T00:00:05.000Z');
    state.persistence.commit(state.history.present);
    await state.persistence.flushNow();
    state.history = state.api.redoProject(state.history, '2026-10-18T00:00:06.000Z');
    state.persistence.commit(state.history.present);
    await state.persistence.flushNow();
  });
  const records = await readProjectRecords(page);
  expect(records['migration-backup:v1:a']).toBe(rawV1);
  expect(JSON.parse(records['project:a'] as string).trafficMovements['__proto__'].direction).toBe('reverse');
  await page.reload();
  const reopened = await page.evaluate(async () => {
    const api = await import(/* @vite-ignore */ '/city-map-tools/__project_v2_probe.mjs');
    const catalog = new api.ProjectCatalog(new api.IndexedDbProjectCatalogStorage());
    const stored = await catalog.bootstrap();
    const history = api.createProjectHistory(stored.document);
    const list = await catalog.listProjects('a');
    return { version: stored.document.schemaVersion, direction: stored.document.trafficMovements['__proto__'].direction,
      past: history.past.length, projects: list.projects.map((item: { id: string }) => item.id) };
  });
  expect(reopened.version).toBe(2);
  expect(reopened.direction).toBe('reverse');
  expect(reopened.past).toBe(0);
  expect(reopened.projects).toEqual(['a']);
  const shape = await page.evaluate(() => new Promise(resolve => {
    const open = indexedDB.open('city-map-tools', 1);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('project-state');
      const shape = { version: db.version, stores: [...db.objectStoreNames], indexes: [...tx.objectStore('project-state').indexNames] };
      tx.oncomplete = () => { db.close(); resolve(shape); };
    };
  }));
  expect(shape).toEqual({ version: 1, stores: ['project-state'], indexes: [] });
});

for (const failure of ['abort', 'quota', 'write'] as const) {
  test(`first upgrade ${failure} rolls back backup and project; retains unsaved edit and retries safely`, async ({ page }) => {
    await start(page);
    await page.evaluate(mode => {
      const original = IDBObjectStore.prototype.put;
      let inject = true;
      IDBObjectStore.prototype.put = function(value, key) {
        if (inject && key === 'project:a') {
          inject = false;
          if (mode === 'quota') throw new DOMException('injected quota', 'QuotaExceededError');
          if (mode === 'write') throw new DOMException('injected write failure', 'DataError');
          const result = original.call(this, value, key);
          this.transaction.abort();
          return result;
        }
        return original.call(this, value, key);
      };
    }, failure);
    await edit(page);
    expect(await flush(page)).toBe(failure);
    expect(await readProjectRecords(page)).toEqual({ 'project:a': rawV1, 'active-project-id': 'a' });
    const status = await page.evaluate(() => {
      const { persistence } = (window as any).t2a;
      return { status: persistence.getStatus(), movementIds: Object.keys(persistence.getCurrent().trafficMovements) };
    });
    expect(status.status.state).toBe('Error');
    expect(status.movementIds).toEqual(['__proto__']);
    expect(await flush(page)).toBe('saved');
    expect((await readProjectRecords(page))['migration-backup:v1:a']).toBe(rawV1);
  });
}

for (const backup of ['unknown raw backup', { corrupt: true }, undefined]) {
  test(`backup collision (${typeof backup}) preserves every record`, async ({ page }) => {
    await start(page);
    await writeProjectRecord(page, 'migration-backup:v1:a', backup);
    const before = await readProjectRecords(page);
    await edit(page);
    expect(await flush(page)).toBe('backup-exists');
    expect(await readProjectRecords(page)).toEqual(before);
  });
}

test('stale v1 and subsequent v2 sessions fail CAS without changing project/backup/pointer', async ({ page }) => {
  await start(page);
  const foreign = rawV1 + '\n';
  await writeProjectRecord(page, 'project:a', foreign);
  await edit(page);
  expect(await flush(page)).toBe('conflict');
  expect(await readProjectRecords(page)).toEqual({ 'project:a': foreign, 'active-project-id': 'a' });
  // A deliberate new session observes the new raw; the failed session is never silently rebased.
  await page.evaluate(async () => {
    const state = (window as any).t2a;
    state.persistence.dispose();
    const raw = await new state.api.IndexedDbProjectStorage('a').load();
    state.persistence = new state.api.ProjectPersistence(state.api.parseProjectDocumentJson(raw), new state.api.IndexedDbProjectStorage('a'));
    state.persistence.restoreStored(raw);
    state.history = state.api.createProjectHistory(state.api.parseProjectDocumentJson(raw));
  });
  await edit(page);
  expect(await flush(page)).toBe('saved');
  await edit(page, 'setTrafficMovementDirection');
  expect(await flush(page)).toBe('saved');
  const before = await readProjectRecords(page);
  const changedV2 = (before['project:a'] as string) + '\n';
  await writeProjectRecord(page, 'project:a', changedV2);
  await edit(page, 'renameFeature');
  expect(await flush(page)).toBe('conflict');
  expect(await readProjectRecords(page)).toEqual({ ...before, 'project:a': changedV2 });
  expect((await readProjectRecords(page))['migration-backup:v1:a']).toBe(foreign);
});

for (const transition of ['new', 'open'] as const) for (const abort of [false, true]) {
  test(`in-flight autosave then ${transition}, abort=${abort}: transition waits and failed flush preserves active project/work`, async ({ page }) => {
    await start(page);
    const b = rawV1.replaceAll('"a"', '"b"').replace('Legacy A', 'Project B');
    await writeProjectRecord(page, 'project:b', b);
    await page.evaluate(() => {
      const state = (window as any).t2a;
      const original = IDBObjectStore.prototype.put;
      state.hold = true;
      IDBObjectStore.prototype.put = function(value, key) {
        const result = original.call(this, value, key);
        if (key === 'project:a' && state.hold) {
          state.heldTransaction = this.transaction;
          const store = this;
          const pump = () => { if (state.hold) store.get('project:a').onsuccess = pump; };
          pump();
        }
        return result;
      };
    });
    await edit(page);
    await expect.poll(() => page.evaluate(() => Boolean((window as any).t2a.heldTransaction))).toBe(true);
    await page.evaluate(action => {
      const state = (window as any).t2a;
      state.switched = false;
      const operation = action === 'new'
        ? state.catalog.createProject('New v2', () => state.persistence.flushNow())
        : state.catalog.openProject('b', () => state.persistence.flushNow());
      state.switchPromise = operation.then((stored: any) => { state.switched = true; return stored.document; },
        (error: any) => { state.switchError = error.code; return null; });
    }, transition);
    expect(await page.evaluate(() => (window as any).t2a.switched)).toBe(false);
    await page.evaluate(fail => {
      const state = (window as any).t2a;
      state.hold = false;
      if (fail) state.heldTransaction.abort();
    }, abort);
    const result = await page.evaluate(async () => {
      const state = (window as any).t2a;
      const document = await state.switchPromise;
      return { document, error: state.switchError, status: state.persistence.getStatus(), movementIds: Object.keys(state.persistence.getCurrent().trafficMovements) };
    });
    const records = await readProjectRecords(page);
    if (abort) {
      expect(result.document).toBeNull();
      expect(result.error).toBe('abort');
      expect(result.status.state).toBe('Error');
      expect(result.movementIds).toEqual(['__proto__']);
      expect(records).toEqual({ 'project:a': rawV1, 'project:b': b, 'active-project-id': 'a' });
    } else {
      expect(result.document.schemaVersion).toBe(2);
      expect(Object.keys(result.document.trafficMovements)).toEqual([]);
      expect(records['active-project-id']).toBe(result.document.metadata.id);
      expect(records['migration-backup:v1:a']).toBe(rawV1);
      expect(JSON.parse(records['project:a'] as string).trafficMovements['__proto__']).toBeDefined();
    }
  });
}
