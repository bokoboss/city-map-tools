import assert from 'node:assert/strict';
import { createEmptyProjectDocument, parseProjectDocumentJson, serializeProjectDocument } from '../src/project/projectDocument';
import {
  ACTIVE_PROJECT_ID_KEY,
  LEGACY_PROJECT_RECORD_KEY,
  ProjectCatalog,
  projectRecordKey,
  type ProjectCatalogStorageAdapter,
} from '../src/project/projectCatalog';

const time = '2026-10-03T00:00:00.000Z';
const doc = (id: string, name = id) => createEmptyProjectDocument({ id, name, createdAt: time });
const text = (id: string, name = id) => serializeProjectDocument(doc(id, name));

class MemoryCatalogStorage implements ProjectCatalogStorageAdapter {
  records: Map<string, unknown>;
  failMigration = false;
  failCreate = false;
  readDelayMs = 0;
  events: string[] = [];

  constructor(records: Iterable<readonly [string, unknown]> = []) {
    this.records = new Map(records);
  }

  async readAll(): Promise<ReadonlyMap<string, unknown>> {
    this.events.push('read');
    const snapshot = new Map(this.records);
    if (this.readDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.readDelayMs));
    }
    return snapshot;
  }

  async migrateLegacy(serializedProject: string, projectId: string): Promise<boolean> {
    this.events.push('migrate');
    if (this.failMigration) throw new Error('transaction aborted');
    if ([...this.records.keys()].some(key => key.startsWith('project:')) ||
        this.records.get(LEGACY_PROJECT_RECORD_KEY) !== serializedProject) return false;
    const next = new Map(this.records);
    next.set(projectRecordKey(projectId), serializedProject);
    next.set(ACTIVE_PROJECT_ID_KEY, projectId);
    next.delete(LEGACY_PROJECT_RECORD_KEY);
    this.records = next;
    return true;
  }

  async createAndActivate(projectId: string, serializedProject: string): Promise<void> {
    this.events.push('create');
    if (this.failCreate) throw new Error('transaction aborted');
    const key = projectRecordKey(projectId);
    if (this.records.has(key)) throw new Error('project id already exists');
    const next = new Map(this.records);
    next.set(key, serializedProject);
    next.set(ACTIVE_PROJECT_ID_KEY, projectId);
    this.records = next;
  }

  async activateProject(projectId: string, expectedSerializedProject: string): Promise<void> {
    this.events.push('activate');
    if (this.records.get(projectRecordKey(projectId)) !== expectedSerializedProject) {
      throw new Error('target changed');
    }
    const next = new Map(this.records);
    next.set(ACTIVE_PROJECT_ID_KEY, projectId);
    this.records = next;
  }
}

function catalog(storage: MemoryCatalogStorage, ids: string[] = ['generated'], now = time): ProjectCatalog {
  return new ProjectCatalog(storage, {
    createId: () => ids.shift() ?? 'generated-next',
    now: () => now,
  });
}

async function runCatalogTests(): Promise<void> {
  {
    const storage = new MemoryCatalogStorage();
    storage.readDelayMs = 10;
    const sharedCatalog = catalog(storage, ['strict-mode-first', 'strict-mode-second']);
    const firstCall = sharedCatalog.bootstrap();
    const secondCall = sharedCatalog.bootstrap();
    assert.equal(firstCall, secondCall, 'concurrent startup callers share the in-flight bootstrap operation');

    const [first, second] = await Promise.all([firstCall, secondCall]);
    assert.equal(first, second, 'concurrent callers resolve to the same initial project');
    assert.equal(first.kind, 'ready');
    if (first.kind !== 'ready') throw new Error('empty catalogue bootstrap did not create a project');
    const projectKeys = [...storage.records.keys()].filter(key => key.startsWith('project:'));
    assert.deepEqual(projectKeys, ['project:strict-mode-first'], 'empty startup creates exactly one namespaced project');
    assert.equal(storage.records.get(ACTIVE_PROJECT_ID_KEY), 'strict-mode-first');
    assert.equal([...storage.records.keys()].filter(key => key === ACTIVE_PROJECT_ID_KEY).length, 1);
    assert.equal(first.activeProjectId, 'strict-mode-first');
    const stored = storage.records.get(projectRecordKey(first.activeProjectId));
    assert.equal(typeof stored, 'string');
    const document = parseProjectDocumentJson(stored as string);
    assert.equal(document.metadata.id, first.activeProjectId, 'created Project Document v1 is valid and matches its key');
    assert.equal(document.metadata.name, 'Untitled project', 'the single startup project is the only Untitled project');
    assert.equal(storage.records.has(LEGACY_PROJECT_RECORD_KEY), false, 'empty bootstrap does not create a legacy record');
    assert.equal(storage.events.filter(event => event === 'read').length, 1);
    assert.equal(storage.events.filter(event => event === 'create').length, 1);
    assert.equal(storage.events.includes('migrate'), false);

    const later = await sharedCatalog.bootstrap();
    assert.equal(later.kind, 'ready');
    if (later.kind !== 'ready') throw new Error('completed bootstrap prevented a later catalogue read');
    assert.equal(later.activeProjectId, first.activeProjectId);
    assert.equal(storage.events.filter(event => event === 'read').length, 2, 'completed bootstrap is not permanently cached');
    assert.equal(storage.events.filter(event => event === 'create').length, 1, 'later reads do not create another startup project');
  }

  {
    const storage = new MemoryCatalogStorage();
    storage.failCreate = true;
    const retryableCatalog = catalog(storage, ['failed-attempt', 'retry-project']);
    await assert.rejects(retryableCatalog.bootstrap(), /transaction aborted/);
    assert.equal(storage.records.size, 0, 'failed initial creation leaves the empty catalogue intact');

    storage.failCreate = false;
    const retried = await retryableCatalog.bootstrap();
    assert.equal(retried.kind, 'ready', 'a rejected bootstrap does not poison a later retry');
    if (retried.kind !== 'ready') throw new Error('retry after failed bootstrap did not create a project');
    assert.equal(retried.activeProjectId, 'retry-project');
    assert.deepEqual([...storage.records.keys()].filter(key => key.startsWith('project:')), ['project:retry-project']);
    assert.equal(storage.records.get(ACTIVE_PROJECT_ID_KEY), 'retry-project');
    assert.equal(storage.records.has(LEGACY_PROJECT_RECORD_KEY), false);
    assert.equal(storage.events.filter(event => event === 'read').length, 2);
    assert.equal(storage.events.filter(event => event === 'create').length, 2);
  }

  {
    const original = text('legacy-project', 'Project A');
    const storage = new MemoryCatalogStorage([[LEGACY_PROJECT_RECORD_KEY, original]]);
    const result = await catalog(storage).bootstrap();
    assert.equal(result.kind, 'ready');
    if (result.kind !== 'ready') throw new Error('valid legacy project did not migrate');
    assert.equal(result.document.metadata.id, 'legacy-project');
    assert.equal(result.document.metadata.name, 'Project A');
    assert.equal(result.serialized, original, 'migration adopts the exact legacy document text');
    assert.deepEqual(result.projects.find(project => project.id === 'legacy-project'), {
      id: 'legacy-project',
      name: 'Project A',
      openable: true,
      active: true,
      createdAt: time,
      updatedAt: time,
    }, 'catalogue identity and timestamps come from the validated v1 document');
    assert.equal(storage.records.get(projectRecordKey('legacy-project')), original);
    assert.equal(storage.records.get(ACTIVE_PROJECT_ID_KEY), 'legacy-project');
    assert.equal(storage.records.has(LEGACY_PROJECT_RECORD_KEY), false, 'legacy key is removed after migration commits');
    assert.deepEqual(storage.events, ['read', 'migrate']);
  }

  {
    const original = text('legacy-aborted');
    const storage = new MemoryCatalogStorage([[LEGACY_PROJECT_RECORD_KEY, original]]);
    storage.failMigration = true;
    const before = new Map(storage.records);
    await assert.rejects(catalog(storage).bootstrap(), /transaction aborted/);
    assert.deepEqual(storage.records, before, 'aborted migration accepts no partial write and preserves legacy bytes');
  }

  for (const invalid of [
    '{malformed',
    JSON.stringify({ ...doc('future'), schemaVersion: 2 }),
    { not: 'a string' },
  ]) {
    const storage = new MemoryCatalogStorage([[LEGACY_PROJECT_RECORD_KEY, invalid]]);
    const before = new Map(storage.records);
    const result = await catalog(storage, ['rescue']).bootstrap();
    assert.equal(result.kind, 'recovery');
    assert.deepEqual(storage.records, before, 'invalid legacy value is preserved and not auto-overwritten');
    assert.equal(storage.events.includes('create'), false, 'invalid legacy data never causes automatic project creation');

    const rescue = await catalog(storage, ['rescue']).createProject('Rescue project');
    assert.equal(rescue.activeProjectId, 'rescue');
    assert.deepEqual(storage.records.get(LEGACY_PROJECT_RECORD_KEY), invalid, 'explicit recovery project leaves the legacy value unchanged');
    assert.equal(storage.records.get(ACTIVE_PROJECT_ID_KEY), 'rescue');
  }

  {
    const leftoverLegacy = text('old-project');
    const active = text('active-project', 'Current project');
    const storage = new MemoryCatalogStorage([
      [projectRecordKey('active-project'), active],
      [ACTIVE_PROJECT_ID_KEY, 'active-project'],
      [LEGACY_PROJECT_RECORD_KEY, leftoverLegacy],
    ]);
    const result = await catalog(storage).bootstrap();
    assert.equal(result.kind, 'ready');
    if (result.kind !== 'ready') throw new Error('namespaced active project was not selected');
    assert.equal(result.document.metadata.id, 'active-project');
    assert.equal(storage.records.get(LEGACY_PROJECT_RECORD_KEY), leftoverLegacy, 'namespaced catalogue prevents repeat migration');
    assert.equal(storage.events.includes('migrate'), false);
  }

  {
    const active = text('valid');
    const invalid = JSON.stringify({ ...doc('unreadable'), schemaVersion: 2 });
    const storage = new MemoryCatalogStorage([
      [projectRecordKey('valid'), active],
      [projectRecordKey('unreadable'), invalid],
      [ACTIVE_PROJECT_ID_KEY, 'valid'],
    ]);
    const result = await catalog(storage).bootstrap();
    assert.equal(result.kind, 'ready');
    if (result.kind !== 'ready') throw new Error('valid active project was not selected');
    const unreadable = result.projects.find(project => project.id === 'unreadable');
    const listed = result.projects.find(project => project.id === 'valid');
    assert.deepEqual(listed, {
      id: 'valid',
      name: 'valid',
      openable: true,
      active: true,
      createdAt: time,
      updatedAt: time,
    }, 'valid catalogue rows are derived from document metadata');
    assert.equal(unreadable?.openable, false);
    assert.equal(storage.records.get(projectRecordKey('unreadable')), invalid, 'unreadable namespaced record remains untouched');
  }

  {
    const original = text('legacy-create-failure');
    const storage = new MemoryCatalogStorage([[LEGACY_PROJECT_RECORD_KEY, original]]);
    storage.failCreate = true;
    const before = new Map(storage.records);
    await assert.rejects(catalog(storage, ['new-id']).createProject('New project'), /transaction aborted/);
    assert.deepEqual(storage.records, before, 'failed create-and-activate accepts neither half');
  }

  {
    const current = text('current');
    const target = text('target');
    const storage = new MemoryCatalogStorage([
      [projectRecordKey('current'), current],
      [projectRecordKey('target'), target],
      [ACTIVE_PROJECT_ID_KEY, 'current'],
    ]);
    const before = new Map(storage.records);
    await assert.rejects(
      catalog(storage).openProject('target', async () => { throw new Error('current flush failed'); }),
      /current flush failed/,
    );
    assert.deepEqual(storage.records, before, 'failed current flush leaves the active pointer and both projects unchanged');
    assert.equal(storage.events.includes('activate'), false);

    const invalidTarget = JSON.stringify({ ...doc('target'), schemaVersion: 2 });
    storage.records.set(projectRecordKey('target'), invalidTarget);
    const beforeInvalidOpen = new Map(storage.records);
    await assert.rejects(catalog(storage).openProject('target', async () => undefined), /schema version/i);
    assert.deepEqual(storage.records, beforeInvalidOpen, 'invalid target is rejected before pointer activation');
  }

  {
    const active = text('active');
    const target = text('target', 'Target');
    const storage = new MemoryCatalogStorage([
      [projectRecordKey('active'), active],
      [projectRecordKey('target'), target],
      [ACTIVE_PROJECT_ID_KEY, 'active'],
    ]);
    const order: string[] = [];
    const result = await catalog(storage).openProject('target', async () => { order.push('flush'); });
    assert.deepEqual(order, ['flush']);
    assert.equal(storage.records.get(ACTIVE_PROJECT_ID_KEY), 'target');
    assert.equal(result.document.metadata.name, 'Target');
    assert.ok(storage.events.indexOf('read') > -1 && storage.events.indexOf('activate') > storage.events.indexOf('read'));
  }

  {
    const storage = new MemoryCatalogStorage();
    storage.failCreate = true;
    const before = new Map(storage.records);
    await assert.rejects(
      catalog(storage).createProject('New project', async () => { throw new Error('flush failed'); }),
      /flush failed/,
    );
    assert.deepEqual(storage.records, before, 'New does not create a project when flushing current work fails');
    assert.equal(storage.events.includes('create'), false);
  }
}

void runCatalogTests().then(() => {
  console.log('project catalog: PASS');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
