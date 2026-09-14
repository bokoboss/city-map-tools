import assert from 'node:assert/strict';
import {
  MAX_LINE_VERTICES,
  createAuthoredLineString,
  createAuthoredPoint,
  createAuthoredPolygon,
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

let created = workspaceReducer(initialWorkspaceState, { type: 'createGeometry', geometry: { type: 'LineString', coordinates: lineCoordinates } });
assert.equal(created.features[0]?.type, 'LineString');
created = workspaceReducer(created, { type: 'createGeometry', geometry: { type: 'Polygon', coordinates: polygonCoordinates } });
assert.equal(created.features[1]?.type, 'Polygon');
console.log('PASS canonical workspace creates authored LineString and Polygon without React or MapLibre state');
