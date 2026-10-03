import assert from 'node:assert/strict';
import {
  createEmptyProjectDocument,
  parseProjectDocumentJson,
  serializeProjectDocument,
  type ProjectDocumentV1,
} from '../src/project/projectDocument';
import {
  createProjectHistory,
  executeProjectCommand,
} from '../src/project/projectHistory';
import {
  ProjectPersistence,
  ProjectStorageError,
  type PersistenceScheduler,
  type ProjectStorageAdapter,
} from '../src/project/projectPersistence';

const time = '2026-09-27T00:00:00.000Z';
const later = '2026-09-27T00:00:01.000Z';
const fresh = () => createEmptyProjectDocument({ id: 'fresh-project', createdAt: time });
const edit = (document: ProjectDocumentV1) => executeProjectCommand(
  createProjectHistory(document), { type: 'createPoint', coordinates: [100.5, 13.75] }, later,
).present;

class Scheduler implements PersistenceScheduler {
  private nextId = 0;
  tasks = new Map<number, { callback: () => void; delay: number }>();
  set(callback: () => void, delay: number): number {
    const id = ++this.nextId;
    this.tasks.set(id, { callback, delay });
    return id;
  }
  clear(handle: unknown): void { this.tasks.delete(handle as number); }
  fire(): void {
    const task = [...this.tasks.values()][0];
    assert.ok(task);
    assert.equal(task.delay, 500);
    this.tasks.clear();
    task.callback();
  }
}

class Storage implements ProjectStorageAdapter {
  writes: string[] = [];
  constructor(public record: string | null = null) {}
  async load(): Promise<string | null> { return this.record; }
  async save(text: string): Promise<void> { this.writes.push(text); this.record = text; }
}

const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

async function runPersistenceTests(): Promise<void> {
{
  const scheduler = new Scheduler();
  let finishLoad!: (record: string | null) => void;
  const storage: ProjectStorageAdapter = {
    load: () => new Promise(resolve => { finishLoad = resolve; }),
    save: async () => { throw new Error('unexpected save'); },
  };
  const persistence = new ProjectPersistence(fresh(), storage, scheduler);
  const loading = persistence.bootstrap();
  assert.equal(persistence.getStatus().state, 'Loading');
  assert.throws(() => persistence.commit(edit(fresh())), /restoration finishes/);
  assert.equal(scheduler.tasks.size, 0, 'bootstrap cannot schedule a fallback write');
  finishLoad(serializeProjectDocument(fresh()));
  await loading;
  assert.equal(persistence.getStatus().state, 'Saved');
}

for (const code of ['unavailable', 'blocked', 'open', 'read', 'invalid-record'] as const) {
  const scheduler = new Scheduler();
  const persistence = new ProjectPersistence(fresh(), {
    load: async () => { throw new ProjectStorageError(code); },
    save: async () => { throw new Error('unexpected save'); },
  }, scheduler);
  await persistence.bootstrap();
  assert.equal(persistence.getStatus().state, 'Error');
  assert.equal(scheduler.tasks.size, 0);
}

{
  const original = edit(fresh());
  const storage = new Storage(serializeProjectDocument(original));
  const scheduler = new Scheduler();
  const persistence = new ProjectPersistence(fresh(), storage, scheduler);
  const restored = await persistence.bootstrap();
  assert.deepEqual(restored, original, 'valid v1 data restores exactly');
  assert.deepEqual(createProjectHistory(restored).past, [], 'reload starts with empty history');
  assert.deepEqual(createProjectHistory(restored).future, [], 'reload has no redo stack');
  assert.equal(persistence.getStatus().state, 'Saved');
  assert.equal(scheduler.tasks.size, 0, 'valid restore does not rewrite storage');
}

for (const record of [
  '{bad',
  JSON.stringify({ ...fresh(), schemaVersion: 2 }),
  JSON.stringify({ ...fresh(), past: [{ secret: 'must not load' }] }),
]) {
  const storage = new Storage(record);
  const persistence = new ProjectPersistence(fresh(), storage, new Scheduler());
  assert.equal((await persistence.bootstrap()).metadata.id, 'fresh-project');
  assert.equal(persistence.getStatus().state, 'Error');
  assert.equal(storage.record, record, 'invalid record remains available for recovery');
  persistence.commit(edit(persistence.getCurrent()));
  assert.equal(storage.writes.length, 0, 'edits after failed restore remain memory-only');
}

{
  const scheduler = new Scheduler();
  const storage = new Storage();
  const persistence = new ProjectPersistence(fresh(), storage, scheduler);
  await persistence.bootstrap();
  assert.equal(persistence.getStatus().state, 'Unsaved');
  assert.equal(storage.writes.length, 0);
  scheduler.fire();
  assert.equal(persistence.getStatus().state, 'Saving');
  await settle();
  assert.equal(persistence.getStatus().state, 'Saved');
  assert.equal(storage.record, serializeProjectDocument(persistence.getCurrent()));
}

{
  const scheduler = new Scheduler();
  const storage = new Storage(serializeProjectDocument(fresh()));
  const persistence = new ProjectPersistence(fresh(), storage, scheduler);
  await persistence.bootstrap();
  const first = edit(persistence.getCurrent());
  persistence.commit(first);
  assert.equal(persistence.getStatus().state, 'Unsaved');
  const second = executeProjectCommand(
    createProjectHistory(first), { type: 'renameFeature', id: 'point-1', name: 'Newest' },
    '2026-09-27T00:00:02.000Z',
  ).present;
  persistence.commit(second);
  assert.equal(scheduler.tasks.size, 1, 'edits inside debounce coalesce');
  scheduler.fire();
  await settle();
  assert.deepEqual(storage.writes, [serializeProjectDocument(second)]);
  assert.equal(persistence.getStatus().state, 'Saved');
  persistence.commit(second);
  assert.equal(scheduler.tasks.size, 0, 'no-op does not schedule a write');
}

{
  const scheduler = new Scheduler();
  const baseline = fresh();
  const storage = new Storage(serializeProjectDocument(baseline));
  const persistence = new ProjectPersistence(baseline, storage, scheduler);
  await persistence.bootstrap();
  const newest = edit(baseline);
  persistence.commit(newest);
  assert.equal(scheduler.tasks.size, 1, 'committed edits still use the existing debounce');
  await persistence.flushNow();
  assert.equal(scheduler.tasks.size, 0, 'Save now cancels the pending debounce');
  assert.equal(storage.record, serializeProjectDocument(newest));
  assert.equal(storage.writes.length, 1, 'Save now uses the same project persistence path');
  assert.equal(persistence.getStatus().state, 'Saved');
}

{
  const scheduler = new Scheduler();
  const baseline = fresh();
  const saves: { text: string; resolve: () => void; reject: (error: Error) => void }[] = [];
  const storage: ProjectStorageAdapter = {
    load: async () => serializeProjectDocument(baseline),
    save: text => new Promise((resolve, reject) => saves.push({ text, resolve, reject })),
  };
  const persistence = new ProjectPersistence(baseline, storage, scheduler);
  await persistence.bootstrap();
  const first = edit(baseline);
  persistence.commit(first);
  scheduler.fire();
  assert.equal(persistence.getStatus().state, 'Saving');
  const second = executeProjectCommand(
    createProjectHistory(first), { type: 'renameFeature', id: 'point-1', name: 'After in-flight save' },
    '2026-09-27T00:00:02.000Z',
  ).present;
  persistence.commit(second);
  assert.equal(persistence.getStatus().state, 'Unsaved');
  scheduler.fire();
  assert.equal(saves.length, 1, 'new save waits for old transaction');
  saves[0]!.resolve();
  await settle();
  assert.equal(saves.length, 2, 'newer revision saves after old transaction');
  assert.equal(persistence.getStatus().state, 'Saving');
  assert.equal(saves[1]!.text, serializeProjectDocument(second));
  saves[1]!.resolve();
  await settle();
  assert.equal(persistence.getStatus().state, 'Saved');
}

{
  const scheduler = new Scheduler();
  const baseline = fresh();
  const saves: { text: string; resolve: () => void; reject: (error: Error) => void }[] = [];
  const storage: ProjectStorageAdapter = {
    load: async () => serializeProjectDocument(baseline),
    save: text => new Promise((resolve, reject) => saves.push({ text, resolve, reject })),
  };
  const persistence = new ProjectPersistence(baseline, storage, scheduler);
  await persistence.bootstrap();
  persistence.commit(edit(baseline));
  scheduler.fire();
  assert.equal(saves.length, 1);
  const flushing = persistence.flushNow();
  const newest = executeProjectCommand(
    createProjectHistory(edit(baseline)), { type: 'renameFeature', id: 'point-1', name: 'Committed during Save now' },
    '2026-09-27T00:00:03.000Z',
  ).present;
  persistence.commit(newest);
  saves[0]!.resolve();
  await settle();
  assert.equal(saves.length, 2, 'Save now waits for an in-flight save and follows it with the newest committed revision');
  assert.equal(saves[1]!.text, serializeProjectDocument(newest));
  saves[1]!.resolve();
  await flushing;
  assert.equal(persistence.getStatus().state, 'Saved');
}

{
  const scheduler = new Scheduler();
  const baseline = fresh();
  const storage = new Storage(serializeProjectDocument(baseline));
  const persistence = new ProjectPersistence(baseline, {
    load: async () => storage.record,
    save: async text => { throw new ProjectStorageError('quota'); },
  }, scheduler);
  await persistence.bootstrap();
  persistence.commit(edit(baseline));
  await assert.rejects(persistence.flushNow(), /Project storage quota failure/);
  assert.equal(persistence.getStatus().state, 'Error', 'failed Save now reports Error');
  assert.equal(persistence.getStatus().message.includes('quota'), true);
  assert.equal(persistence.getCurrent().features.length, 1, 'failed Save now retains committed work in memory');
}

{
  const baselineA = createEmptyProjectDocument({ id: 'project-a', createdAt: time });
  const baselineB = createEmptyProjectDocument({ id: 'project-b', createdAt: time });
  const records = new Map([
    ['project:project-a', serializeProjectDocument(baselineA)],
    ['project:project-b', serializeProjectDocument(baselineB)],
  ]);
  const writes: { key: string; text: string; resolve: () => void }[] = [];
  const adapter = (key: string): ProjectStorageAdapter => ({
    load: async () => records.get(key) ?? null,
    save: text => new Promise(resolve => writes.push({
      key,
      text,
      resolve: () => { records.set(key, text); resolve(); },
    })),
  });
  const schedulerA = new Scheduler();
  const schedulerB = new Scheduler();
  const persistenceA = new ProjectPersistence(baselineA, adapter('project:project-a'), schedulerA);
  const persistenceB = new ProjectPersistence(baselineB, adapter('project:project-b'), schedulerB);
  await Promise.all([persistenceA.bootstrap(), persistenceB.bootstrap()]);
  const editedA = edit(baselineA);
  persistenceA.commit(editedA);
  schedulerA.fire();
  const flushA = persistenceA.flushNow();
  const editedB = executeProjectCommand(
    createProjectHistory(baselineB), { type: 'createPoint', coordinates: [100.6, 13.76] }, later,
  ).present;
  persistenceB.commit(editedB);
  schedulerB.fire();
  assert.equal(writes[0]?.key, 'project:project-a');
  assert.equal(writes[1]?.key, 'project:project-b');
  writes[1]!.resolve();
  writes[0]!.resolve();
  await flushA;
  assert.equal(records.get('project:project-a'), serializeProjectDocument(editedA));
  assert.equal(records.get('project:project-b'), serializeProjectDocument(editedB));
}

{
  const stored = serializeProjectDocument(fresh());
  let reads = 0;
  const persistence = new ProjectPersistence(fresh(), {
    load: async () => { reads += 1; return null; },
    save: async () => { throw new Error('unexpected save'); },
  }, new Scheduler());
  assert.deepEqual(persistence.restoreStored(stored), fresh());
  assert.equal(persistence.getStatus().state, 'Saved');
  assert.deepEqual(await persistence.bootstrap(), fresh());
  assert.equal(reads, 0, 'catalogue-validated opens do not need a second fallible storage read');
}

{
  const scheduler = new Scheduler();
  const baseline = fresh();
  let fail = true;
  const writes: string[] = [];
  const storage: ProjectStorageAdapter = {
    load: async () => serializeProjectDocument(baseline),
    save: async text => {
      writes.push(text);
      if (fail) throw new ProjectStorageError('quota');
    },
  };
  const persistence = new ProjectPersistence(baseline, storage, scheduler);
  await persistence.bootstrap();
  const first = edit(baseline);
  persistence.commit(first);
  scheduler.fire();
  await settle();
  assert.equal(persistence.getStatus().state, 'Error');
  assert.match(persistence.getStatus().message, /quota/);
  assert.deepEqual(persistence.getCurrent(), first, 'failed write preserves memory project');
  assert.equal(scheduler.tasks.size, 0, 'no tight automatic retry');
  fail = false;
  const second = executeProjectCommand(
    createProjectHistory(first), { type: 'renameFeature', id: 'point-1', name: 'Retry edit' },
    '2026-09-27T00:00:02.000Z',
  ).present;
  persistence.commit(second);
  scheduler.fire();
  await settle();
  assert.equal(writes.length, 2);
  assert.equal(persistence.getStatus().state, 'Saved');
}

{
  const scheduler = new Scheduler();
  const storage = new Storage(serializeProjectDocument(fresh()));
  const persistence = new ProjectPersistence(fresh(), storage, scheduler);
  await persistence.bootstrap();
  const history = executeProjectCommand(
    createProjectHistory(fresh()), { type: 'createPoint', coordinates: [100.5, 13.75] }, later,
  );
  persistence.commit(history.present);
  scheduler.fire();
  await settle();
  assert.deepEqual(parseProjectDocumentJson(storage.writes[0]!), history.present);
  assert.equal(JSON.stringify(storage.writes).includes('past'), false, 'history is excluded');
  assert.equal(JSON.stringify(storage.writes).includes('transaction'), false, 'drafts are excluded');
  assert.equal(JSON.stringify(storage.writes).includes('selectedFeatureId'), false, 'selection is excluded');
  assert.equal(JSON.stringify(storage.writes).includes('apiKey'), false, 'credentials are excluded');
}

console.log('project persistence: PASS');
}

void runPersistenceTests().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
