import assert from 'node:assert/strict';
import {
  MAX_LINE_VERTICES,
  createAuthoredLineString,
  createAuthoredPoint,
  createAuthoredPolygon,
  markDependentBuffersStale,
  validateWgs84LineString,
  validateWgs84Polygon,
  type Wgs84LineString,
  type Wgs84Polygon,
} from '../src/features/featureModel';
import {
  BUFFER_LIBRARY_VERSION,
  BUFFER_STEPS,
  deriveBufferFeature,
  validateBufferResult,
} from '../src/features/buffer';
import { initialWorkspaceState, workspaceReducer } from '../src/features/workspace';

const lineCoordinates: Wgs84LineString = [[100.5, 13.75], [100.51, 13.76], [100.52, 13.75]];
const polygonCoordinates: Wgs84Polygon = [[[100.5, 13.75], [100.51, 13.75], [100.51, 13.76], [100.5, 13.75]]];

assert.deepEqual(validateWgs84LineString(lineCoordinates), lineCoordinates);
assert.throws(() => validateWgs84LineString([[100.5, 13.75]]), /at least 2/);
assert.throws(() => validateWgs84LineString(Array.from({ length: MAX_LINE_VERTICES + 1 }, () => [100.5, 13.75])), /operational limit/);
console.log('PASS LineString finite/minimum/operational-bound validation');

assert.deepEqual(validateWgs84Polygon(polygonCoordinates), polygonCoordinates);
assert.throws(() => validateWgs84Polygon([[[100.5, 13.75], [100.51, 13.75], [100.51, 13.76], [100.5, 13.76]]]), /explicitly closed/);
assert.throws(() => validateWgs84Polygon([[[100.5, 13.75], [100.5, 13.75], [100.51, 13.75], [100.5, 13.75]]]), /3 distinct/);
console.log('PASS Polygon exterior-ring, closure, and distinct-vertex validation');

const point = createAuthoredPoint('point-1', [100.5, 13.75], 1);
const line = createAuthoredLineString('line-1', lineCoordinates, 1);
const polygon = createAuthoredPolygon('polygon-1', polygonCoordinates, 1);
for (const [source, id] of [[point, 'buffer-point'], [line, 'buffer-line'], [polygon, 'buffer-polygon']] as const) {
  const derived = deriveBufferFeature(source, id, 125);
  assert.equal(derived.type, 'Polygon');
  assert.equal(derived.lineage, 'derived');
  assert.equal(derived.validationStatus, 'Functional but unvalidated');
  assert.equal(derived.provenance.buffer?.radius, 125);
  assert.equal(derived.provenance.buffer?.units, 'meters');
  assert.equal(derived.provenance.buffer?.steps, BUFFER_STEPS);
  assert.equal(derived.provenance.buffer?.libraryVersion, BUFFER_LIBRARY_VERSION);
  assert.equal(derived.provenance.derivedFrom?.id, source.id);
  assert.equal(derived.provenance.derivedFrom?.type, source.type);
}
console.log('PASS Point/LineString/Polygon buffers with exact meters/steps/library provenance');

for (const [status, expected] of [
  ['Validated', 'Functional but unvalidated'],
  ['Functional but unvalidated', 'Functional but unvalidated'],
  ['Experimental', 'Experimental'],
  ['Stale', 'Stale'],
] as const) {
  const statusSource = { ...createAuthoredPoint(`status-${status}`, [100.5, 13.75], 1), validationStatus: status };
  const statusBuffer = deriveBufferFeature(statusSource, `status-buffer-${status}`, 10);
  assert.equal(statusBuffer.validationStatus, expected);
  assert.equal(statusBuffer.provenance.derivedFrom?.validationStatus, status);
}
console.log('PASS conservative buffer status propagation for Validated, Functional but unvalidated, Experimental, and Stale sources');

let capturedPointBufferInput: unknown;
const capturedPointBuffer = deriveBufferFeature(point, 'captured-point-buffer', 125, feature => {
  capturedPointBufferInput = feature;
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: polygonCoordinates } };
});
assert.deepEqual(capturedPointBufferInput, {
  type: 'Feature',
  properties: {},
  geometry: { type: 'Point', coordinates: point.coordinates },
});
assert.deepEqual(capturedPointBuffer.provenance.derivedFrom?.geometry, {
  type: 'Point',
  coordinates: point.coordinates,
});
console.log('PASS Point buffer input is exactly the canonical stored Point coordinate, never presentation state');

assert.throws(() => deriveBufferFeature(point, 'bad-radius', 0), /between 1 and 10000 meters/);
assert.throws(() => deriveBufferFeature(point, 'undefined-output', 10, () => undefined), /no supported feature/);
assert.throws(() => deriveBufferFeature(point, 'multipolygon-output', 10, () => ({
  type: 'Feature',
  geometry: { type: 'MultiPolygon', coordinates: [] },
})), /unsupported MultiPolygon/);
assert.throws(() => validateBufferResult({
  type: 'Feature',
  geometry: { type: 'Polygon', coordinates: [[[179, 0], [-179, 0], [-179, 1], [179, 0]]] },
}), /antimeridian/);
assert.throws(() => deriveBufferFeature(createAuthoredLineString('antimeridian', [[179.9, 0], [-179.9, 0]], 3), 'wide-source', 10_000), /antimeridian/);
console.log('PASS fail-closed radius, undefined, MultiPolygon, and antimeridian/pathological buffer output');

const source = createAuthoredLineString('source-line', lineCoordinates, 2);
const dependent = deriveBufferFeature(source, 'dependent-buffer', 80);
let state = { features: [source, dependent], selectedFeatureId: source.id };
state = workspaceReducer(state, {
  type: 'applyGeometry',
  id: source.id,
  geometry: { type: 'LineString', coordinates: [[100.5, 13.75], [100.53, 13.76]] },
});
const staleAfterEdit = state.features.find(feature => feature.id === dependent.id);
assert.equal(staleAfterEdit?.validationStatus, 'Stale');
assert.ok(staleAfterEdit?.provenance.limitations.includes('Source geometry changed'));

state = workspaceReducer(state, { type: 'delete', id: source.id });
const staleAfterDelete = state.features.find(feature => feature.id === dependent.id);
assert.equal(staleAfterDelete?.validationStatus, 'Stale');
assert.equal(staleAfterDelete?.provenance.derivedFrom?.orphaned, true);
assert.ok(staleAfterDelete?.provenance.limitations.includes('orphaned'));
assert.throws(() => workspaceReducer({ features: [dependent], selectedFeatureId: dependent.id }, {
  type: 'applyGeometry',
  id: dependent.id,
  geometry: { type: 'Polygon', coordinates: polygonCoordinates },
}), /read-only/);
console.log('PASS dependent buffers become Stale after source edit and Stale/orphaned after source delete; derived geometry stays read-only');

const orphanedLineSource = createAuthoredLineString('line-1', lineCoordinates, 1);
const orphanedLineBuffer = deriveBufferFeature(orphanedLineSource, 'buffer-line-1', 80);
const orphanedLineState = workspaceReducer({ features: [orphanedLineSource, orphanedLineBuffer], selectedFeatureId: orphanedLineSource.id }, {
  type: 'delete',
  id: orphanedLineSource.id,
});
const orphanedLineBeforeReplacement = JSON.stringify(orphanedLineState.features.find(feature => feature.id === orphanedLineBuffer.id));
assert.throws(() => workspaceReducer(orphanedLineState, {
  type: 'insert',
  feature: createAuthoredPoint('line-1', [100.6, 13.8], 1),
}), /collides/);
const replacementLineState = workspaceReducer(orphanedLineState, {
  type: 'createGeometry',
  geometry: { type: 'LineString', coordinates: [[100.5, 13.75], [100.53, 13.76]] },
});
const replacementLine = replacementLineState.features.find(feature => feature.lineage === 'authored' && feature.type === 'LineString');
assert.equal(replacementLine?.id, 'line-2');
const editedReplacementLineState = workspaceReducer(replacementLineState, {
  type: 'applyGeometry',
  id: 'line-2',
  geometry: { type: 'LineString', coordinates: [[100.5, 13.75], [100.54, 13.77]] },
});
assert.equal(JSON.stringify(editedReplacementLineState.features.find(feature => feature.id === orphanedLineBuffer.id)), orphanedLineBeforeReplacement);
const deletedReplacementLineState = workspaceReducer(editedReplacementLineState, { type: 'delete', id: 'line-2' });
assert.equal(JSON.stringify(deletedReplacementLineState.features.find(feature => feature.id === orphanedLineBuffer.id)), orphanedLineBeforeReplacement);
assert.equal(JSON.stringify(markDependentBuffersStale(orphanedLineState.features, 'line-1', false).find(feature => feature.id === orphanedLineBuffer.id)), orphanedLineBeforeReplacement);
console.log('PASS orphaned LineString source identity stays reserved and immutable through unrelated replacement edit/delete');

for (const scenario of [
  {
    prefix: 'point',
    source: createAuthoredPoint('point-1', [100.5, 13.75], 1),
    action: { type: 'createPoint' as const, coordinates: [100.6, 13.8] as [number, number] },
  },
  {
    prefix: 'polygon',
    source: createAuthoredPolygon('polygon-1', polygonCoordinates, 1),
    action: { type: 'createGeometry' as const, geometry: { type: 'Polygon' as const, coordinates: polygonCoordinates } },
  },
] as const) {
  const buffer = deriveBufferFeature(scenario.source, `${scenario.prefix}-buffer-1`, 80);
  const orphaned = workspaceReducer({ features: [scenario.source, buffer], selectedFeatureId: scenario.source.id }, { type: 'delete', id: scenario.source.id });
  const replacement = workspaceReducer(orphaned, scenario.action).features.find(feature => feature.lineage === 'authored' && feature.type === scenario.source.type);
  assert.equal(replacement?.id, `${scenario.prefix}-2`);
}
console.log('PASS orphaned Point and Polygon source identities stay reserved for generated IDs');

const historicalLine = createAuthoredLineString('historical-source', lineCoordinates, 1);
const historicalGeneratedLine = createAuthoredLineString('line-1', lineCoordinates, 2);
const historicalBuffers = [
  deriveBufferFeature(historicalLine, 'buffer-historical-source', 80),
  deriveBufferFeature(historicalGeneratedLine, 'buffer-line-1', 80),
];
let importCollisionState = { features: [historicalLine, historicalGeneratedLine, ...historicalBuffers], selectedFeatureId: null };
importCollisionState = workspaceReducer(importCollisionState, { type: 'delete', id: historicalLine.id });
importCollisionState = workspaceReducer(importCollisionState, { type: 'delete', id: historicalGeneratedLine.id });
const orphanedImportSnapshots = historicalBuffers.map(buffer => JSON.stringify(importCollisionState.features.find(feature => feature.id === buffer.id)));
const importedPoint = (id: string) => {
  const point = createAuthoredPoint(id, [100.7, 13.85], 1);
  return {
    ...point,
    lineage: 'imported' as const,
    provenance: { ...point.provenance, method: 'GeoJSON import', source: 'Imported GeoJSON' },
  };
};
const importedState = workspaceReducer(importCollisionState, {
  type: 'import',
  imported: [importedPoint('line-1'), importedPoint('historical-source')],
});
assert.deepEqual(importedState.features.filter(feature => feature.lineage === 'imported').map(feature => feature.id), ['line-1-2', 'historical-source-2']);
historicalBuffers.forEach((buffer, index) => {
  assert.equal(JSON.stringify(importedState.features.find(feature => feature.id === buffer.id)), orphanedImportSnapshots[index]);
});
console.log('PASS imported IDs collide deterministically with retained historical identities without mutating orphaned buffers');

let created = workspaceReducer(initialWorkspaceState, { type: 'createGeometry', geometry: { type: 'LineString', coordinates: lineCoordinates } });
assert.equal(created.features[0]?.type, 'LineString');
created = workspaceReducer(created, { type: 'createGeometry', geometry: { type: 'Polygon', coordinates: polygonCoordinates } });
assert.equal(created.features[1]?.type, 'Polygon');
console.log('PASS canonical workspace creates authored LineString and Polygon without React or MapLibre state');
