// Included by the deterministic npm test script through tests/run-unit-tests.ts.
import assert from 'node:assert/strict';
import { createAuthoredPoint, createDefaultLayers, defaultProvenance, importFeaturesIntoWorkspace, pointCompatibleLayers } from '../src/features/featureModel';
import { exportGeoJson, GEOJSON_MAX_FEATURES, importGeoJsonText } from '../src/features/geojson';

const layers = createDefaultLayers();
const point = (id: string, properties: Record<string, unknown> = {}) => ({
  type: 'Feature', id, geometry: { type: 'Point', coordinates: [100.5, 13.75] }, properties,
});
const collection = (features: unknown[]) => JSON.stringify({
  type: 'FeatureCollection',
  metadata: { format: 'city-map-tools.geojson', version: 1, generator: 'City Map Tools' },
  features,
});
const parse = (features: unknown[]) => importGeoJsonText(collection(features), layers);
const parsePointCompatible = (features: unknown[]) => importGeoJsonText(collection(features), pointCompatibleLayers(layers));

assert.equal(pointCompatibleLayers(layers).length, 1);
assert.equal(parsePointCompatible([point('point-layer', { layerId: 'layer-points' })])[0]!.layerId, 'layer-points');
for (const layerId of ['layer-lines', 'layer-polygons', 'layer-buffers']) {
  assert.throws(() => parsePointCompatible([point(`invalid-${layerId}`, { layerId })]), /unknown layer/);
}
console.log('PASS Point-only import accepts only the Point-compatible layer and rejects geometry-specific layers transactionally');

for (const lineage of ['authored', 'derived', 'imported'] as const) {
  const imported = parse([point('forged', { lineage, validationStatus: 'Validated' })]);
  assert.equal(imported[0]!.lineage, 'imported');
  assert.deepEqual(imported[0]!.provenance.sourceLineageClaim, { lineage, trust: 'untrusted' });
  assert.equal(imported[0]!.validationStatus, 'Functional but unvalidated');
  assert.equal(imported[0]!.provenance.importedValidationStatus, 'Validated');
  const again = importGeoJsonText(exportGeoJson(imported), layers);
  const third = importGeoJsonText(exportGeoJson(again), layers);
  assert.equal(again[0]!.lineage, 'imported');
  assert.deepEqual(third[0]!.provenance.sourceLineageClaim, imported[0]!.provenance.sourceLineageClaim);
  assert.deepEqual(JSON.parse(exportGeoJson(third)).features[0].properties.provenance.sourceLineageClaim,
    { lineage, trust: 'untrusted' });
}
const authored = createAuthoredPoint('local', [100, 13], 1);
assert.equal(authored.lineage, 'authored');
const genuine = importGeoJsonText(exportGeoJson([authored]), layers)[0]!;
assert.equal(genuine.lineage, 'imported');
assert.deepEqual(genuine.provenance.sourceLineageClaim, { lineage: 'authored', trust: 'untrusted' });
assert.equal(parse([point('no-claim')])[0]!.provenance.sourceLineageClaim, undefined);
for (const claim of ['authored', { lineage: 'derived', trust: 'trusted' },
  { lineage: 'x'.repeat(501), trust: 'untrusted' }, { lineage: 'authored', trust: 'untrusted', extra: true }]) {
  assert.throws(() => parse([point('bad', { provenance: { ...defaultProvenance('imported'), sourceLineageClaim: claim } })]), /sourceLineageClaim/);
}
console.log('PASS forged metadata, genuine export, bounded untrusted claim round-trip, Validated demotion');

const imported = parse([
  point('source', { lineage: 'authored' }),
  point('child', { lineage: 'derived', provenance: { ...defaultProvenance('derived'), derivedFrom: {
    id: 'source', provenance: { ...defaultProvenance('derived'), derivedFrom: { id: 'source' } },
  } } }),
]);
const workspace = importFeaturesIntoWorkspace(imported, [createAuthoredPoint('source', [1, 2], 1)]);
assert.equal(workspace.selectedFeatureId, 'source-2');
assert.equal(workspace.features[2]!.provenance.derivedFrom!.id, 'source-2');
assert.equal(workspace.features[2]!.provenance.derivedFrom!.provenance!.derivedFrom!.id, 'source-2');
assert.ok(workspace.features.slice(1).every(f => f.lineage === 'imported'));
assert.deepEqual(workspace.features[2]!.provenance.sourceLineageClaim, { lineage: 'derived', trust: 'untrusted' });
console.log('PASS recursive derivedFrom remapping and current-state selection');

const atLimit = Array.from({ length: GEOJSON_MAX_FEATURES }, (_, i) => point(`p-${i}`));
assert.equal(parse(atLimit).length, GEOJSON_MAX_FEATURES);
assert.equal(importGeoJsonText(exportGeoJson(parse(atLimit)), layers).length, GEOJSON_MAX_FEATURES);
// Conversion of any valid Point needs layers. A throwing proxy proves the
// count gate rejects before any readPointFeature conversion reaches that step.
let layerReads = 0;
const forbiddenLayers = new Proxy(layers, { get() { layerReads++; throw new Error('materialization reached'); } });
assert.throws(() => importGeoJsonText(collection([...atLimit, point('extra')]), forbiddenLayers), /500-Point import limit/);
assert.equal(layerReads, 0);
// Count rejection also takes precedence over even the first feature's validation.
assert.throws(() => parse([null, ...atLimit]), /500-Point import limit/);
console.log('PASS 500 Points, 501 rejected before conversion, at-limit export/re-import');

assert.throws(() => parse([point('dup'), point('dup')]), /duplicated/);
assert.throws(() => parse([{ ...point('bad'), geometry: { type: 'Point', coordinates: ['100', 13] } }]), /invalid Point coordinates/);
assert.throws(() => parse([{ ...point('bad'), geometry: { type: 'LineString', coordinates: [[1, 2], [2, 3]] } }]), /unsupported geometry/);
const malicious = '<img src=x onerror=window.__issue19Xss=1>';
assert.equal(parse([point('literal', { name: malicious })])[0]!.name, malicious);
for (const length of [499, 500]) {
  const once = parse([point('bounded', { provenance: { ...defaultProvenance('imported'), limitations: 'x'.repeat(length) } })]);
  const twice = importGeoJsonText(exportGeoJson(once), layers);
  assert.ok(twice[0]!.provenance.limitations.length <= 500);
  assert.equal(twice[0]!.provenance.limitations, once[0]!.provenance.limitations);
  assert.ok(twice[0]!.provenance.limitations.includes('untrusted'));
}
console.log('PASS duplicate/malformed/unsupported rejection, literal strings, max limitations round-trip');
