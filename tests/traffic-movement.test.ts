import assert from 'node:assert/strict';
import { createEmptyProjectDocument, createProjectDocument, decodeProjectDocument, parseProjectDocumentJson, serializeProjectDocument, parseProjectDocumentV1Json } from '../src/project/projectDocument';
import { createAuthoredLineString, createAuthoredPoint, createDefaultLayers } from '../src/features/featureModel';
import { deriveBufferFeature } from '../src/features/buffer';
import { DEFAULT_TRAFFIC_MOVEMENT_STYLE } from '../src/project/trafficMovement';
import { trafficMovementInputs } from '../src/project/trafficMovementInputs';
import { createProjectHistory, executeProjectCommand, undoProject, redoProject, beginProjectTransaction, applyProjectTransactionCommand, cancelProjectTransaction, type ProjectCommand } from '../src/project/projectHistory';
import { exactBoundaryText } from './project-document.test';
import { ProjectPersistence } from '../src/project/projectPersistence';

async function run(): Promise<void> {
const createdAt = '2026-10-18T00:00:00.000Z';
const base = createEmptyProjectDocument({ id: 't2a-project', createdAt });
const rawV1 = JSON.stringify({ ...base, schemaVersion: 1 }, (key, value) => key === 'trafficMovements' ? undefined : value, 2);
const logical = parseProjectDocumentJson(rawV1);
assert.equal(logical.schemaVersion, 2, 'v1 opens as detached logical v2');
assert.deepEqual(Object.keys(logical.trafficMovements), []);
let writes = 0;
const persistence = new ProjectPersistence(logical, {
  load: async () => rawV1,
  save: async () => { writes += 1; },
});
persistence.restoreStored(rawV1);
persistence.commit(logical);
await persistence.flushNow();
assert.equal(writes, 0, 'logical upgrade and Save-now must not rewrite raw v1');
assert.equal(persistence.getStatus().state, 'Saved');
assert.equal(JSON.parse(serializeProjectDocument(logical)).schemaVersion, 2);
console.log('PASS T2A v1 logical upgrade is saved without writing');

const saves: Array<{ text: string; expected: string | null }> = [];
const scheduled = new Map<object, () => void>();
const bootstrapped = new ProjectPersistence(logical, {
  load: async () => rawV1,
  save: async (text, expected) => { saves.push({ text, expected }); },
}, {
  set: callback => { const id = {}; scheduled.set(id, callback); return id; },
  clear: handle => { scheduled.delete(handle as object); },
});
await bootstrapped.bootstrap();
assert.equal(bootstrapped.getStatus().state, 'Saved');
assert.equal(scheduled.size, 0);
await bootstrapped.flushNow();
assert.equal(saves.length, 0);
let persistedHistory = executeProjectCommand(createProjectHistory(logical), { type: 'createPoint', coordinates: [100, 13] }, '2026-10-18T00:00:01.000Z');
bootstrapped.commit(persistedHistory.present);
await bootstrapped.flushNow();
assert.equal(saves[0]!.expected, rawV1, 'CAS sees exact raw v1, including whitespace');
persistedHistory = undoProject(persistedHistory, '2026-10-18T00:00:02.000Z');
bootstrapped.commit(persistedHistory.present);
await bootstrapped.flushNow();
assert.equal(saves[1]!.expected, saves[0]!.text, 'CAS expectation advances only after successful save');
assert.equal(JSON.parse(saves[1]!.text).schemaVersion, 2, 'Undo cannot downgrade storage');

const atLimit = parseProjectDocumentJson(exactBoundaryText);
const upgradedText = serializeProjectDocument(atLimit);
assert.ok(upgradedText.length > 2_000_000 && upgradedText.length <= 2_500_000);
assert.deepEqual(parseProjectDocumentJson(upgradedText), atLimit);
assert.throws(() => parseProjectDocumentJson(' '.repeat(2_500_001)), /2500000/);
assert.throws(() => parseProjectDocumentJson(rawV1 + ' '.repeat(2_000_001 - rawV1.length)), /2000000/);
console.log('PASS T2A exact v1 size boundary upgrades and reopens within separate v2 cap');

const line = createAuthoredLineString('__proto__', [[100.5, 13.75], [100.51, 13.76]], 1);
const point = createAuthoredPoint('constructor', [100.5, 13.75], 1);
const imported = { ...createAuthoredLineString('imported', line.coordinates, 2), lineage: 'imported' as const };
const buffer = deriveBufferFeature(line, 'line-buffer', 50);
const initial = createProjectDocument({ metadata: base.metadata, layers: createDefaultLayers(),
  features: [line, point, imported, buffer],
  pointPresentations: { constructor: { marker: 'pin', markerSize: 32, labelVisible: true, labelPosition: 'top-left' } },
});
const v1Text = JSON.stringify({ ...initial, schemaVersion: 1 }, (key, value) => key === 'trafficMovements' ? undefined : value);
const v1 = parseProjectDocumentV1Json(v1Text);
const detached = parseProjectDocumentJson(v1Text);
for (const field of ['metadata', 'spatialReference', 'layers', 'features', 'presentation'] as const) assert.deepEqual(detached[field], v1[field]);
detached.features[0]!.name = 'detached mutation';
assert.notEqual(detached.features[0]!.name, v1.features[0]!.name);
assert.deepEqual(Object.keys(parseProjectDocumentJson(v1Text).trafficMovements), []);
assert.throws(() => parseProjectDocumentV1Json(serializeProjectDocument(initial)), /unsupported|future/);

let clock = 0;
const time = () => new Date(Date.parse(createdAt) + ++clock * 1000).toISOString();
let history = createProjectHistory(initial);
const command = (edit: ProjectCommand) => { history = executeProjectCommand(history, edit, time()); };
const unchangedGeometry = JSON.stringify(initial.features);
for (const id of ['constructor', 'imported', 'line-buffer', 'missing']) {
  assert.throws(() => command({ type: 'convertToTrafficMovement', id }));
  assert.equal(history.past.length, 0);
}
command({ type: 'convertToTrafficMovement', id: '__proto__' });
assert.equal(Object.getPrototypeOf(history.present.trafficMovements), null);
assert.ok(Object.hasOwn(history.present.trafficMovements, '__proto__'));
assert.deepEqual(history.present.trafficMovements['__proto__'], { direction: 'forward', style: DEFAULT_TRAFFIC_MOVEMENT_STYLE });
assert.throws(() => command({ type: 'convertToTrafficMovement', id: '__proto__' }));
command({ type: 'setTrafficMovementDirection', id: '__proto__', direction: 'reverse' });
command({ type: 'updateTrafficMovementStyle', id: '__proto__', patch: { color: '#abcdef', animationRate: 'fast' } });
assert.equal(JSON.stringify(history.present.features), unchangedGeometry);
assert.equal(history.past.length, 3);
const styled = history.present;
history = undoProject(history, time());
assert.equal(history.present.trafficMovements['__proto__']!.style.color, '#2563eb');
history = redoProject(history, time());
assert.deepEqual(history.present.trafficMovements, styled.trafficMovements);
const beforeNoop = history;
command({ type: 'updateTrafficMovementStyle', id: '__proto__', patch: {} });
assert.equal(history, beforeNoop);
command({ type: 'unconvertTrafficMovement', id: '__proto__' });
assert.equal(JSON.stringify(history.present.features), unchangedGeometry);
const unconverted = history;
command({ type: 'unconvertTrafficMovement', id: '__proto__' });
assert.equal(history, unconverted, 'unconvert existing non-movement is idempotent');
history = undoProject(history, time());
command({ type: 'deleteFeature', id: '__proto__' });
assert.equal(Object.hasOwn(history.present.trafficMovements, '__proto__'), false);
history = undoProject(history, time());
assert.deepEqual(history.present.trafficMovements, styled.trafficMovements);
assert.equal(JSON.stringify(history.present.features), unchangedGeometry);

const transaction = beginProjectTransaction(history);
const editedDraft = applyProjectTransactionCommand(transaction, { type: 'applyGeometry', id: '__proto__',
  geometry: { type: 'LineString', coordinates: [[100.5, 13.75], [100.52, 13.77]] } });
assert.equal(editedDraft.transaction!.draft.features.find(feature => feature.id === 'line-buffer')!.validationStatus, 'Stale');
assert.deepEqual(editedDraft.transaction!.draft.trafficMovements, styled.trafficMovements);
assert.equal(cancelProjectTransaction(editedDraft).present, history.present);
command({ type: 'applyGeometry', id: '__proto__', geometry: { type: 'LineString', coordinates: [[100.5, 13.75], [100.52, 13.77]] } });
assert.deepEqual(history.present.trafficMovements, styled.trafficMovements);
assert.deepEqual(history.present.features.find(feature => feature.id === 'line-buffer')!.provenance.derivedFrom, buffer.provenance.derivedFrom);
assert.deepEqual(history.present.features.find(feature => feature.id === 'line-buffer')!.provenance.buffer, buffer.provenance.buffer);
assert.equal(history.present.features.find(feature => feature.id === 'line-buffer')!.validationStatus, 'Stale');

const bounds = { opacity: [0, 1], lineWidthPixels: [1, 16], arrowSizePixels: [8, 48], arrowSpacingPixels: [24, 256], displayOffsetPixels: [-64, 64], layoutOrder: [-24, 24] };
for (const [key, [min, max]] of Object.entries(bounds)) {
  for (const value of [min!, max!]) command({ type: 'updateTrafficMovementStyle', id: '__proto__', patch: { [key]: value } });
  for (const value of [min! - 1, max! + 1, NaN, Infinity, -Infinity, '1', null, undefined]) {
    const before = history;
    assert.throws(() => command({ type: 'updateTrafficMovementStyle', id: '__proto__', patch: { [key]: value } as never }));
    assert.equal(history, before, 'invalid style preserves present/past/future');
  }
}
for (const patch of [{ animationRate: 'warp' }, { animationEnabled: 1 }, { autoLayout: null }, { layoutOrder: 0.5 }, { color: '#fff' }, { color: 'red' }, { phase: 0 }, null, [], JSON.parse('{"__proto__":{}}')]) {
  assert.throws(() => command({ type: 'updateTrafficMovementStyle', id: '__proto__', patch: patch as never }));
}
assert.throws(() => command({ type: 'setTrafficMovementDirection', id: '__proto__', direction: 'sideways' as never }));
for (const animationRate of ['slow', 'medium', 'fast'] as const) {
  command({ type: 'updateTrafficMovementStyle', id: '__proto__', patch: { animationRate } });
  assert.equal(trafficMovementInputs(history.present)[0]!.visualRatePixelsPerSecond, { slow: 20, medium: 40, fast: 80 }[animationRate]);
}
const geometryBeforeAdapter = JSON.stringify(history.present.features);
trafficMovementInputs(history.present)[0]!.coordinates[0]![0] = 0;
assert.equal(JSON.stringify(history.present.features), geometryBeforeAdapter);
command({ type: 'toggleFeatureVisibility', id: '__proto__' });
assert.equal(trafficMovementInputs(history.present).length, 0);
command({ type: 'toggleFeatureVisibility', id: '__proto__' });
command({ type: 'toggleLayerVisibility', layerId: 'layer-lines' });
assert.equal(trafficMovementInputs(history.present).length, 0);
assert.deepEqual(history.present.presentation, initial.presentation);
assert.equal(serializeProjectDocument(parseProjectDocumentJson(serializeProjectDocument(history.present))), serializeProjectDocument(history.present));

for (const id of ['constructor', 'prototype']) {
  let weird = createProjectHistory(createProjectDocument({ metadata: base.metadata, layers: initial.layers,
    features: [createAuthoredLineString(id, line.coordinates, 1)] }));
  weird = executeProjectCommand(weird, { type: 'convertToTrafficMovement', id }, time());
  assert.ok(Object.hasOwn(parseProjectDocumentJson(serializeProjectDocument(weird.present)).trafficMovements, id));
}

let capped = createProjectHistory(createProjectDocument({ metadata: base.metadata, layers: initial.layers,
  features: Array.from({ length: 25 }, (_, index) => createAuthoredLineString(`line-${index}`, line.coordinates, index + 1)),
}));
for (let index = 0; index < 24; index++) capped = executeProjectCommand(capped, { type: 'convertToTrafficMovement', id: `line-${index}` }, time());
assert.equal(Object.keys(capped.present.trafficMovements).length, 24);
const cappedBefore = JSON.stringify(capped);
assert.throws(() => executeProjectCommand(capped, { type: 'convertToTrafficMovement', id: 'line-24' }, time()), /24/);
assert.equal(JSON.stringify(capped), cappedBefore);

const valid = JSON.parse(serializeProjectDocument(styled));
for (const mutate of [
  (value: any) => { value[''] = true; },
  (value: any) => { value.metadata[''] = true; },
  (value: any) => { value.features[0][''] = true; },
  (value: any) => { value.schemaVersion = 3; },
  (value: any) => { delete value.schemaVersion; },
  (value: any) => { delete value.trafficMovements; },
  (value: any) => { value.trafficMovements.orphan = value.trafficMovements['__proto__']; },
  (value: any) => { value.trafficMovements.imported = value.trafficMovements['__proto__']; },
  (value: any) => { value.trafficMovements.constructor = value.trafficMovements['__proto__']; },
  (value: any) => { value.trafficMovements['__proto__'].style.extra = true; },
  (value: any) => { delete value.trafficMovements['__proto__'].style.color; },
  (value: any) => { value.trafficMovements['__proto__'].extra = true; },
  (value: any) => { value.features[0].role = 'traffic-movement'; },
  (value: any) => { value.features = new Array(2); },
  (value: any) => { value.apiKey = 'runtime-only'; },
  (value: any) => { value.animationPhase = 1; },
]) {
  const value = structuredClone(valid);
  mutate(value);
  assert.throws(() => decodeProjectDocument(value));
}
console.log('PASS T2A strict v2, lineage, cap, every style bound, weird IDs, geometry/history/visibility and transient exclusion');
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
