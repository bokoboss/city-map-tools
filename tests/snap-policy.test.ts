import assert from 'node:assert/strict';
import { createDefaultLayers, LINE_LAYER_ID, POINT_LAYER_ID, POLYGON_LAYER_ID,
  type SpatialFeature, type Wgs84Point } from '../src/features/featureModel';
import { SnapPolicy, type SnapProjection } from '../src/spatial/snapPolicy';

const projection: SnapProjection = {
  width: 1200, height: 900,
  project: ([longitude, latitude]) => ({ x: longitude * 100, y: latitude * 100 }),
  unproject: ({ x, y }) => [x / 100, y / 100],
};
const base = { name: 'Target', visible: true, lineage: 'authored' as const,
  validationStatus: 'Functional but unvalidated' as const,
  provenance: { method: 'test', source: 'test', units: 'degrees', limitations: 'fixture' } };
const point = (id: string, coordinates: Wgs84Point, patch: Partial<SpatialFeature> = {}): SpatialFeature =>
  ({ ...base, id, type: 'Point', layerId: POINT_LAYER_ID, coordinates, ...patch }) as SpatialFeature;
const line = (id: string, coordinates: Wgs84Point[], patch: Partial<SpatialFeature> = {}): SpatialFeature =>
  ({ ...base, id, type: 'LineString', layerId: LINE_LAYER_ID, coordinates, ...patch }) as SpatialFeature;
const polygon = (id: string, ring: Wgs84Point[], patch: Partial<SpatialFeature> = {}): SpatialFeature =>
  ({ ...base, id, type: 'Polygon', layerId: POLYGON_LAYER_ID, coordinates: [ring], ...patch }) as SpatialFeature;

const layers = createDefaultLayers();
const eligible = new SnapPolicy([
  point('authored', [1, 1]),
  point('hidden', [1.01, 1], { visible: false }),
  point('imported', [1.02, 1], { lineage: 'imported' }),
  point('derived', [1.03, 1], { lineage: 'derived' }),
  line('hidden-layer', [[1.04, 1], [1.05, 1]], { layerId: 'hidden-layer' }),
], [...layers, { id: 'hidden-layer', name: 'Hidden', color: '#000000', visible: false }], projection);
assert.equal(eligible.query({ x: 100, y: 100 }).result?.featureId, 'authored');
assert.equal(eligible.query({ x: 100, y: 100 }, 'authored').result, null);
assert.equal(eligible.query({ x: 104, y: 100 }, 'authored').diagnostics.totalCandidates, 1);

const priority = new SnapPolicy([
  point('z-vertex', [1, 1]),
  line('a-segment', [[0.5, 1.1], [1.5, 1.1]]),
], layers, projection);
assert.equal(priority.query({ x: 100, y: 110 }).result?.featureId, 'z-vertex');
const ties = new SnapPolicy([point('z', [1, 1]), point('a', [1, 1]),
  line('line', [[1, 1], [2, 1], [1, 1]])], layers, projection);
assert.equal(ties.query({ x: 100, y: 100 }).result?.featureId, 'a');
assert.equal(new SnapPolicy([point('farther', [1.1, 1]), point('nearer', [1, 1])], layers, projection)
  .query({ x: 101, y: 100 }).result?.featureId, 'nearer');
assert.equal(new SnapPolicy([line('only', [[0, 0], [2, 0], [0, 0]])], layers, projection)
  .query({ x: 100, y: 10 }).result?.index, 0);
assert.equal(new SnapPolicy([line('z', [[0, 0], [2, 0]]), line('a', [[0, 0], [2, 0]])], layers, projection)
  .query({ x: 100, y: 10 }).result?.featureId, 'a');
assert.equal(new SnapPolicy([point('at', [1, 1])], layers, projection).query({ x: 111, y: 100 }).result?.kind, 'vertex');
assert.equal(new SnapPolicy([point('at', [1, 1])], layers, projection).query({ x: 112.1, y: 100 }).result, null);

const segment = new SnapPolicy([line('segment', [[0, 0], [2, 0]])], layers, projection);
assert.deepEqual(segment.query({ x: 100, y: 11 }).result?.coordinate, [1, 0]);
assert.equal(segment.query({ x: 100, y: 11 }).result?.kind, 'segment');
assert.equal(segment.query({ x: 100, y: 12.1 }).result, null);
assert.deepEqual(segment.query({ x: 201, y: 0 }).result?.coordinate, [2, 0]);

const ring = new SnapPolicy([polygon('ring', [[0, 0], [1, 0], [1, 1], [0, 0]])], layers, projection);
assert.equal(ring.query({ x: 0, y: 0 }).diagnostics.totalCandidates, 6);
assert.deepEqual(ring.query({ x: 0, y: 0 }).result?.coordinate, [0, 0]);
assert.equal(ring.query({ x: 40, y: 45 }).result?.index, 2);
assert.equal(ring.query({ x: 40, y: 45 }).result?.kind, 'segment');

assert.equal(segment.query({ x: NaN, y: 0 }).result, null);
assert.equal(new SnapPolicy([point('bad', [Infinity, 0])], layers, projection)
  .query({ x: 0, y: 0 }).result, null);
const invalidProjection = new SnapPolicy([point('bad', [1, 1])], layers,
  { ...projection, project: () => ({ x: Infinity, y: 100 }) });
assert.equal(invalidProjection.query({ x: 100, y: 100 }).result, null);
const invalidUnproject = new SnapPolicy([line('bad', [[0, 0], [2, 0]])], layers,
  { ...projection, unproject: () => [NaN, 0] });
assert.equal(invalidUnproject.query({ x: 100, y: 11 }).result, null);
const missingUnproject = new SnapPolicy([line('bad', [[0, 0], [2, 0]])], layers,
  { ...projection, unproject: () => undefined as unknown as Wgs84Point });
assert.equal(missingUnproject.query({ x: 100, y: 11 }).result, null);
assert.equal(segment.query(null as unknown as { x: number; y: number }).result, null);

// Project Document v1 caps the workspace at 500 features. This fixture has
// 10,000 vertices and 9,500 segments, distributed across a realistic viewport.
const maximum = Array.from({ length: 500 }, (_, featureIndex) =>
  line(`line-${featureIndex}`, Array.from({ length: 20 }, (_, vertexIndex) =>
    [vertexIndex * 0.4, featureIndex * 0.015] as Wgs84Point)));
const maxPolicy = new SnapPolicy(maximum, layers, projection);
const diagnostic = maxPolicy.query({ x: 400, y: 400 }).diagnostics;
assert.equal(diagnostic.totalCandidates, 19_500);
assert.ok(diagnostic.inspectedCandidates < 200,
  `grid query inspected ${diagnostic.inspectedCandidates} of ${diagnostic.totalCandidates}`);
console.log(`PASS SnapPolicy eligibility, priority, ties, segments, closure, invalid inputs; max fixture ${diagnostic.inspectedCandidates}/${diagnostic.totalCandidates} candidates inspected`);
