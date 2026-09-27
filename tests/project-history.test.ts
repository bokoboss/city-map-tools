import assert from 'node:assert/strict';
import {
  createAuthoredLineString,
  createAuthoredPoint,
  createAuthoredPolygon,
  createDefaultLayers,
  type PointFeature,
  type SpatialFeature,
  type Wgs84LineString,
  type Wgs84Polygon,
} from '../src/features/featureModel';
import { deriveBufferFeature } from '../src/features/buffer';
import type { PointPresentation } from '../src/map/pointPresentation';
import {
  PROJECT_DOCUMENT_MAX_FEATURES,
  PROJECT_DOCUMENT_MAX_TEXT_LENGTH,
  createProjectDocument,
  serializeProjectDocument,
  type ProjectDocumentV1,
} from '../src/project/projectDocument';
import {
  PROJECT_HISTORY_MAX_SNAPSHOTS,
  applyProjectCommand,
  applyProjectTransactionCommand,
  beginProjectTransaction,
  canRedoProject,
  canUndoProject,
  cancelProjectTransaction,
  commitProjectTransaction,
  createProjectHistory,
  currentProjectDocument,
  executeProjectCommand,
  redoProject,
  replaceProject,
  undoProject,
  type ProjectCommand,
  type ProjectHistoryState,
} from '../src/project/projectHistory';

const createdAt = '2026-09-21T00:00:00.000Z';
const baseTime = Date.parse(createdAt);
const time = (seconds: number) => new Date(baseTime + seconds * 1_000).toISOString();
const lineCoordinates: Wgs84LineString = [[100.5, 13.75], [100.51, 13.76], [100.52, 13.75]];
const editedLineCoordinates: Wgs84LineString = [[100.5, 13.75], [100.53, 13.76], [100.54, 13.75]];
const polygonCoordinates: Wgs84Polygon = [[[100.5, 13.75], [100.51, 13.75], [100.51, 13.76], [100.5, 13.75]]];
const editedPolygonCoordinates: Wgs84Polygon = [[[100.5, 13.75], [100.515, 13.75], [100.51, 13.76], [100.5, 13.75]]];
const point = createAuthoredPoint('point-1', [100.5, 13.75], 1);
const line = createAuthoredLineString('line-1', lineCoordinates, 1);
const polygon = createAuthoredPolygon('polygon-1', polygonCoordinates, 1);
const presentation: PointPresentation = {
  marker: 'pin',
  markerSize: 24,
  labelVisible: false,
  labelPosition: 'top-right',
};

function ownPresentations(entries: readonly [string, PointPresentation][]): Record<string, PointPresentation> {
  const output = Object.create(null) as Record<string, PointPresentation>;
  for (const [id, value] of entries) {
    Object.defineProperty(output, id, { value, enumerable: true, writable: true, configurable: true });
  }
  return output;
}

function documentWith(
  features: readonly SpatialFeature[] = [],
  pointPresentations: Readonly<Record<string, PointPresentation>> = Object.create(null),
): ProjectDocumentV1 {
  return createProjectDocument({
    metadata: { id: 'history-project', name: 'History fixture', createdAt, updatedAt: createdAt },
    layers: createDefaultLayers(),
    features,
    pointPresentations,
  });
}

function projectContent(document: ProjectDocumentV1): unknown {
  return {
    ...document,
    metadata: { ...document.metadata, updatedAt: '<revision timestamp>' },
  };
}

function commandTime(index: number): string {
  return time(index + 1);
}

function assertUndoRedo(document: ProjectDocumentV1, command: ProjectCommand): void {
  const initial = createProjectHistory(document);
  const edited = executeProjectCommand(initial, command, commandTime(0));
  assert.notStrictEqual(edited, initial, `${command.type} must commit one project edit`);
  assert.equal(edited.past.length, 1, `${command.type} must create one history entry`);
  assert.deepEqual(projectContent(undoProject(edited, commandTime(1)).present), projectContent(initial.present));
  const undone = undoProject(edited, commandTime(1));
  assert.equal(undone.present.metadata.updatedAt, commandTime(1), 'undo stamps the restored current revision');
  assert.equal(undone.present.metadata.createdAt, createdAt, 'undo preserves project creation time');
  const redone = redoProject(undone, commandTime(2));
  assert.deepEqual(projectContent(redone.present), projectContent(edited.present));
  assert.equal(redone.present.metadata.updatedAt, commandTime(2), 'redo stamps the restored current revision');
  assert.equal(redone.present.metadata.createdAt, createdAt, 'redo preserves project creation time');
}

function importedPoint(id: string): PointFeature {
  const imported = createAuthoredPoint(id, [100.7, 13.85], 1);
  return {
    ...imported,
    lineage: 'imported',
    provenance: { ...imported.provenance, method: 'GeoJSON import', source: 'Imported GeoJSON' },
  };
}

const ordinaryProject = documentWith([point, line, polygon]);
assertUndoRedo(ordinaryProject, { type: 'createPoint', coordinates: [100.6, 13.8] });
assertUndoRedo(ordinaryProject, { type: 'createGeometry', geometry: { type: 'LineString', coordinates: lineCoordinates } });
assertUndoRedo(ordinaryProject, { type: 'createGeometry', geometry: { type: 'Polygon', coordinates: polygonCoordinates } });
assertUndoRedo(ordinaryProject, { type: 'applyGeometry', id: line.id, geometry: { type: 'LineString', coordinates: editedLineCoordinates } });
assertUndoRedo(ordinaryProject, { type: 'createBuffer', sourceId: point.id, radius: 80 });
assertUndoRedo(ordinaryProject, { type: 'importPoints', features: [importedPoint('imported-point')] });
assertUndoRedo(ordinaryProject, { type: 'deleteFeature', id: polygon.id });
assertUndoRedo(ordinaryProject, { type: 'renameFeature', id: line.id, name: 'Renamed line' });
assertUndoRedo(ordinaryProject, { type: 'toggleFeatureVisibility', id: line.id });
assertUndoRedo(ordinaryProject, { type: 'toggleLayerVisibility', layerId: 'layer-lines' });
assertUndoRedo(ordinaryProject, { type: 'updatePointPresentation', id: point.id, patch: { marker: 'pin', markerSize: 32 } });
assertUndoRedo(ordinaryProject, { type: 'movePoint', id: point.id, coordinates: [100.6, 13.8] });
console.log('PASS all current project command types are v1-backed and support one-step undo/redo');

const bufferedPoint = deriveBufferFeature(point, 'buffer-point-1', 80);
const pointDocument = documentWith([point, bufferedPoint], ownPresentations([[point.id, presentation]]));
const deleteHistory = executeProjectCommand(createProjectHistory(pointDocument), { type: 'deleteFeature', id: point.id }, commandTime(0));
assert.equal(deleteHistory.present.features.some(feature => feature.id === point.id), false);
assert.equal(Object.hasOwn(deleteHistory.present.presentation.points, point.id), false);
assert.equal(deleteHistory.present.features.find(feature => feature.id === bufferedPoint.id)?.validationStatus, 'Stale');
assert.equal(deleteHistory.present.features.find(feature => feature.id === bufferedPoint.id)?.provenance.derivedFrom?.orphaned, true);
const restoredPoint = undoProject(deleteHistory, commandTime(1)).present;
assert.equal(restoredPoint.features.some(feature => feature.id === point.id), true);
assert.deepEqual(restoredPoint.presentation.points[point.id], presentation);
assert.equal(restoredPoint.features.find(feature => feature.id === bufferedPoint.id)?.validationStatus, bufferedPoint.validationStatus);
assert.equal(restoredPoint.features.find(feature => feature.id === bufferedPoint.id)?.provenance.derivedFrom?.orphaned, undefined);
console.log('PASS feature deletion atomically removes point presentation and Undo restores the feature, presentation, and buffer state');

const noOpLineBuffer = deriveBufferFeature(line, 'buffer-line-1', 80);
const noOpDocument = documentWith([line, noOpLineBuffer]);
const noOpHistory = createProjectHistory(noOpDocument);
assert.strictEqual(executeProjectCommand(noOpHistory, {
  type: 'applyGeometry',
  id: line.id,
  geometry: { type: 'LineString', coordinates: line.coordinates },
}, commandTime(8)), noOpHistory);
assert.strictEqual(executeProjectCommand(noOpHistory, {
  type: 'renameFeature',
  id: line.id,
  name: line.name,
}, commandTime(9)), noOpHistory);
assert.equal(noOpHistory.present.metadata.updatedAt, createdAt);
assert.equal(noOpHistory.past.length, 0);
console.log('PASS no-op geometry Apply and rename preserve updatedAt and do not create history');

let branchHistory = createProjectHistory(documentWith([point]));
branchHistory = executeProjectCommand(branchHistory, { type: 'renameFeature', id: point.id, name: 'First edit' }, commandTime(0));
branchHistory = undoProject(branchHistory, commandTime(1));
assert.equal(canRedoProject(branchHistory), true);
branchHistory = executeProjectCommand(branchHistory, { type: 'toggleFeatureVisibility', id: point.id }, commandTime(2));
assert.equal(branchHistory.future.length, 0);
assert.equal(canRedoProject(branchHistory), false);
console.log('PASS a new edit after Undo clears Redo history');

let boundedHistory = createProjectHistory(documentWith([point]));
for (let index = 0; index < PROJECT_HISTORY_MAX_SNAPSHOTS + 5; index += 1) {
  boundedHistory = executeProjectCommand(boundedHistory, {
    type: 'renameFeature',
    id: point.id,
    name: `Rename ${index + 1}`,
  }, commandTime(index));
}
assert.equal(boundedHistory.past.length, PROJECT_HISTORY_MAX_SNAPSHOTS);
assert.equal(boundedHistory.future.length, 0);
for (let index = 0; index < PROJECT_HISTORY_MAX_SNAPSHOTS; index += 1) {
  assert.ok(canUndoProject(boundedHistory));
  boundedHistory = undoProject(boundedHistory, time(40 + index));
  assert.ok(boundedHistory.past.length + boundedHistory.future.length <= PROJECT_HISTORY_MAX_SNAPSHOTS);
}
assert.equal(canUndoProject(boundedHistory), false);
assert.equal(boundedHistory.present.features[0]?.name, 'Rename 5', 'oldest retained snapshot is the state before edit 6');
for (let index = 0; index < PROJECT_HISTORY_MAX_SNAPSHOTS; index += 1) {
  assert.ok(canRedoProject(boundedHistory));
  boundedHistory = redoProject(boundedHistory, time(70 + index));
  assert.ok(boundedHistory.past.length + boundedHistory.future.length <= PROJECT_HISTORY_MAX_SNAPSHOTS);
}
assert.equal(boundedHistory.present.features[0]?.name, 'Rename 25');
console.log('PASS history deterministically trims to 20 snapshots across past and future');

const transactionStart = documentWith([point, bufferedPoint]);
let transaction = createProjectHistory(transactionStart);
transaction = beginProjectTransaction(transaction);
assert.throws(() => beginProjectTransaction(transaction), /Nested project transactions/);
transaction = applyProjectTransactionCommand(transaction, { type: 'movePoint', id: point.id, coordinates: [100.6, 13.8] });
transaction = applyProjectTransactionCommand(transaction, { type: 'movePoint', id: point.id, coordinates: [100.7, 13.9] });
assert.equal(transaction.present.features.find(feature => feature.id === point.id)?.coordinates[0], point.coordinates[0]);
assert.equal(currentProjectDocument(transaction).features.find(feature => feature.id === point.id)?.coordinates[0], 100.7);
assert.equal(currentProjectDocument(transaction).metadata.updatedAt, createdAt, 'draft updates do not stamp timestamps');
assert.equal(transaction.past.length, 0, 'draft updates do not push history');
assert.throws(() => undoProject(transaction, commandTime(0)), /Undo is unavailable while a project transaction is active/);
assert.throws(() => redoProject(transaction, commandTime(0)), /Redo is unavailable while a project transaction is active/);
transaction = commitProjectTransaction(transaction, commandTime(0));
assert.equal(transaction.past.length, 1, 'one committed transaction creates one history entry');
assert.equal(transaction.present.metadata.updatedAt, commandTime(0), 'transaction commit stamps once');
const movedBuffer = transaction.present.features.find(feature => feature.id === bufferedPoint.id);
assert.equal(transaction.present.features.find(feature => feature.id === point.id)?.coordinates[0], 100.7);
assert.equal(movedBuffer?.validationStatus, 'Stale');
assert.deepEqual(movedBuffer?.provenance.derivedFrom?.geometry, { type: 'Point', coordinates: point.coordinates });
const undoneMove = undoProject(transaction, commandTime(1));
assert.deepEqual(undoneMove.present.features.find(feature => feature.id === point.id)?.coordinates, point.coordinates);
assert.equal(undoneMove.present.features.find(feature => feature.id === bufferedPoint.id)?.validationStatus, bufferedPoint.validationStatus);
const redoneMove = redoProject(undoneMove, commandTime(2));
assert.deepEqual(redoneMove.present.features.find(feature => feature.id === point.id)?.coordinates, [100.7, 13.9]);
assert.equal(redoneMove.present.features.find(feature => feature.id === bufferedPoint.id)?.validationStatus, 'Stale');
console.log('PASS drag-style transaction batches repeated Point moves into one undoable action and preserves dependent-buffer stale semantics');

let cancelledTransaction = createProjectHistory(transactionStart);
const originalPresent = cancelledTransaction.present;
cancelledTransaction = beginProjectTransaction(cancelledTransaction);
cancelledTransaction = applyProjectTransactionCommand(cancelledTransaction, { type: 'movePoint', id: point.id, coordinates: [100.6, 13.8] });
cancelledTransaction = cancelProjectTransaction(cancelledTransaction);
assert.strictEqual(cancelledTransaction.present, originalPresent);
assert.deepEqual(cancelledTransaction.present, transactionStart);
assert.equal(cancelledTransaction.past.length, 0);
assert.equal(cancelledTransaction.present.metadata.updatedAt, createdAt);
let noOpTransaction = beginProjectTransaction(createProjectHistory(transactionStart));
noOpTransaction = applyProjectTransactionCommand(noOpTransaction, { type: 'movePoint', id: point.id, coordinates: point.coordinates });
noOpTransaction = commitProjectTransaction(noOpTransaction, commandTime(3));
assert.equal(noOpTransaction.past.length, 0);
assert.equal(noOpTransaction.present.metadata.updatedAt, createdAt);
console.log('PASS cancelling a transaction restores the exact pre-transaction project and no-op commit creates no history');

let rejectedMove = beginProjectTransaction(createProjectHistory(transactionStart));
const rejectedMoveRoot = rejectedMove.present;
const rejectedMoveDraft = currentProjectDocument(rejectedMove);
assert.throws(
  () => applyProjectTransactionCommand(rejectedMove, { type: 'movePoint', id: point.id, coordinates: [100.6, 91] }),
  /valid WGS84 longitude\/latitude/,
);
assert.strictEqual(currentProjectDocument(rejectedMove), rejectedMoveDraft, 'invalid drag coordinates do not mutate the active draft');
assert.strictEqual(rejectedMove.present, rejectedMoveRoot, 'invalid drag coordinates do not mutate committed state');
rejectedMove = cancelProjectTransaction(rejectedMove);
assert.strictEqual(rejectedMove.present, rejectedMoveRoot, 'validation failure can cancel back to the exact rollback root');
assert.equal(rejectedMove.transaction, null);
assert.equal(rejectedMove.past.length, 0);
console.log('PASS invalid Point drag coordinates leave state untouched and the active transaction can fail closed');

let replaceHistory = createProjectHistory(documentWith([point]));
replaceHistory = executeProjectCommand(replaceHistory, { type: 'renameFeature', id: point.id, name: 'Changed' }, commandTime(0));
replaceHistory = undoProject(replaceHistory, commandTime(1));
replaceHistory = beginProjectTransaction(replaceHistory);
replaceHistory = applyProjectTransactionCommand(replaceHistory, { type: 'toggleFeatureVisibility', id: point.id });
const loadedDocument = documentWith([line, polygon]);
replaceHistory = replaceProject(replaceHistory, loadedDocument);
assert.equal(replaceHistory.past.length, 0);
assert.equal(replaceHistory.future.length, 0);
assert.equal(replaceHistory.transaction, null);
assert.deepEqual(replaceHistory.present, loadedDocument);
assert.equal(replaceHistory.present.metadata.updatedAt, loadedDocument.metadata.updatedAt);
console.log('PASS replaceProject resets history and active transaction without changing the decoded v1 document');

const transientText = serializeProjectDocument(ordinaryProject);
for (const name of ['selectedFeatureId', 'activeTool', 'importStatus', 'camera', 'mapSession', 'bufferRadius', 'apiKey']) {
  assert.ok(!transientText.includes(name), `${name} must remain outside serialized project state`);
}
const transientHistory = executeProjectCommand(createProjectHistory(ordinaryProject), {
  type: 'renameFeature', id: line.id, name: 'History contains project data only',
}, commandTime(0));
for (const document of [...transientHistory.past, transientHistory.present, ...transientHistory.future]) {
  const serialized = serializeProjectDocument(document);
  assert.ok(!serialized.includes('selectedFeatureId'));
  assert.ok(!serialized.includes('importStatus'));
}
console.log('PASS selection, tools, import status, map/camera runtime values, buffer text, and credentials stay outside documents and history');

let countHistory = createProjectHistory(documentWith(Array.from({ length: PROJECT_DOCUMENT_MAX_FEATURES }, (_, index) =>
  createAuthoredPoint(`count-point-${index + 1}`, [100.5, 13.75], index + 1))));
const countHistoryBefore = countHistory;
assert.throws(() => executeProjectCommand(countHistory, { type: 'createPoint', coordinates: [100.6, 13.8] }, commandTime(0)), /at most 500 features/);
assert.strictEqual(countHistory, countHistoryBefore, 'feature-count rejection must leave present/history untouched');
assert.equal(countHistory.present.features.length, PROJECT_DOCUMENT_MAX_FEATURES);
console.log('PASS Project Document feature-count overflow rejects atomically before commit');

function rawProjectLength(features: readonly SpatialFeature[]): number {
  return JSON.stringify({
    format: 'city-map-tools-project',
    schemaVersion: 1,
    metadata: { id: 'history-project', name: 'History fixture', createdAt, updatedAt: createdAt },
    spatialReference: { crs: 'EPSG:4326', axisOrder: 'longitude-latitude', units: 'degrees' },
    layers: createDefaultLayers(),
    features,
    presentation: { points: Object.create(null) },
  }).length;
}

const largeCoordinates: Wgs84LineString = Array.from({ length: 1_000 }, (_, index) =>
  [100.5 + (index % 2) * 0.001, 13.75] as [number, number]);
const templateLine = createAuthoredLineString('bulk-line-0', largeCoordinates, 1);
const emptySize = rawProjectLength([]);
const targetGrow = applyProjectCommand(documentWith([point]), { type: 'createPoint', coordinates: [100.6, 13.8] });
const targetDelta = JSON.stringify(targetGrow).length - JSON.stringify(documentWith([point])).length;
const targetSize = PROJECT_DOCUMENT_MAX_TEXT_LENGTH - targetDelta + 2;
const featureSize = JSON.stringify(templateLine).length + 1;
let bulkCount = Math.max(1, Math.floor((targetSize - emptySize) / featureSize));
let bulkFeatures: SpatialFeature[] = Array.from({ length: bulkCount }, (_, index) =>
  createAuthoredLineString(`bulk-line-${index}`, largeCoordinates, index + 1));
while (rawProjectLength(bulkFeatures) > targetSize) {
  bulkFeatures.pop();
  bulkCount -= 1;
}
while (bulkCount < 500) {
  const nextFeature = createAuthoredLineString(`bulk-line-${bulkCount}`, largeCoordinates, bulkCount + 1);
  if (rawProjectLength([...bulkFeatures, nextFeature]) > targetSize) break;
  bulkFeatures.push(nextFeature);
  bulkCount += 1;
}
let bulkLength = rawProjectLength(bulkFeatures);
for (const feature of bulkFeatures) {
  if (bulkLength >= targetSize - 2) break;
  const remaining = targetSize - bulkLength;
  const descriptionLength = Math.min(500, remaining - 18);
  if (descriptionLength < 1) break;
  const index = bulkFeatures.indexOf(feature);
  bulkFeatures[index] = { ...feature, description: 'x'.repeat(descriptionLength) };
  bulkLength = rawProjectLength(bulkFeatures);
}
const aggregateDocument = documentWith(bulkFeatures);
const aggregateLength = serializeProjectDocument(aggregateDocument).length;
assert.ok(aggregateLength <= PROJECT_DOCUMENT_MAX_TEXT_LENGTH);
assert.ok(aggregateLength > PROJECT_DOCUMENT_MAX_TEXT_LENGTH - targetDelta - 4,
  `aggregate fixture must be close enough to the v1 bound to reject one Point; size=${aggregateLength}, delta=${targetDelta}`);
const aggregateHistory = createProjectHistory(aggregateDocument);
assert.throws(() => executeProjectCommand(aggregateHistory, {
  type: 'createPoint', coordinates: [100.6, 13.8],
}, commandTime(0)), /normalized serialized JSON exceeds the 2000000-character limit/);
assert.equal(aggregateHistory.present.features.length, bulkFeatures.length);
assert.equal(aggregateHistory.past.length, 0);
assert.equal(aggregateHistory.future.length, 0);
console.log('PASS aggregate serialized-size overflow rejects atomically before commit');

console.log('PASS all bounded project history checks');
