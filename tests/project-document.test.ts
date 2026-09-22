import assert from 'node:assert/strict';
import {
  BUFFER_LAYER_ID,
  createAuthoredLineString,
  createAuthoredPoint,
  createAuthoredPolygon,
  createDefaultLayers,
  defaultProvenance,
  type SpatialFeature,
} from '../src/features/featureModel';
import { deriveBufferFeature } from '../src/features/buffer';
import {
  PROJECT_DOCUMENT_AXIS_ORDER,
  PROJECT_DOCUMENT_CRS,
  PROJECT_DOCUMENT_FORMAT,
  PROJECT_DOCUMENT_MAX_TEXT_LENGTH,
  PROJECT_DOCUMENT_UNITS,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  createEmptyProjectDocument,
  createProjectDocument,
  decodeProjectDocument,
  parseProjectDocumentJson,
  serializeProjectDocument,
} from '../src/project/projectDocument';

const createdAt = '2026-09-21T00:00:00.000Z';
const updatedAt = '2026-09-21T00:00:01.000Z';
const polygonCoordinates = [[[100.5, 13.75], [100.515, 13.75], [100.51, 13.76], [100.5, 13.75]]] as const;

const point = createAuthoredPoint('point-1', [100.5, 13.75], 1);
const line = createAuthoredLineString('line-1', [[100.5, 13.75], [100.53, 13.76]], 1);
const polygon = createAuthoredPolygon('polygon-1', polygonCoordinates, 1);
const buffer = deriveBufferFeature(point, 'buffer-point-1', 80);

function ownPresentations(entries: readonly [string, object][]): Record<string, object> {
  const output = Object.create(null) as Record<string, object>;
  for (const [key, value] of entries) {
    Object.defineProperty(output, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return output;
}

const document = createProjectDocument({
  metadata: { id: 'project-1', name: 'Round-trip fixture', createdAt, updatedAt },
  layers: createDefaultLayers(),
  features: [point, line, polygon, buffer],
  pointPresentations: ownPresentations([
    ['point-1', { marker: 'pin', markerSize: 32, labelVisible: false, labelPosition: 'top-left' }],
  ]),
});

const encoded = serializeProjectDocument(document);
const parsed = parseProjectDocumentJson(encoded);
assert.equal(parsed.format, PROJECT_DOCUMENT_FORMAT);
assert.equal(parsed.schemaVersion, PROJECT_DOCUMENT_SCHEMA_VERSION);
assert.deepEqual(parsed.spatialReference, {
  crs: PROJECT_DOCUMENT_CRS,
  axisOrder: PROJECT_DOCUMENT_AXIS_ORDER,
  units: PROJECT_DOCUMENT_UNITS,
});
assert.deepEqual(parsed.metadata, document.metadata);
assert.deepEqual(parsed.layers, document.layers);
assert.deepEqual(parsed.features, document.features);
assert.deepEqual(parsed.presentation.points['point-1'], document.presentation.points['point-1']);
assert.equal(serializeProjectDocument(parsed), encoded, 'valid current state serializes deterministically after parse');
console.log('PASS Point, LineString, Polygon, derived buffer, layers, PointPresentation, and provenance round-trip');

const empty = createEmptyProjectDocument({ id: 'empty-project', name: 'Empty', createdAt, updatedAt });
assert.deepEqual(empty.metadata, { id: 'empty-project', name: 'Empty', createdAt, updatedAt });
assert.deepEqual(empty.features, []);
assert.deepEqual(Object.keys(empty.presentation.points), []);
assert.deepEqual(empty.spatialReference, {
  crs: 'EPSG:4326',
  axisOrder: 'longitude-latitude',
  units: 'degrees',
});
console.log('PASS empty v1 document creation uses injected identity/time and explicit spatial reference');

function mutableDocument(): Record<string, any> {
  return JSON.parse(encoded) as Record<string, any>;
}

function rejects(mutator: (value: Record<string, any>) => void, message: RegExp): void {
  const value = mutableDocument();
  mutator(value);
  assert.throws(() => decodeProjectDocument(value), message);
}

rejects(value => { value.format = 'other-format'; }, /format: must be city-map-tools-project/);
rejects(value => { delete value.schemaVersion; }, /project document: missing required property "schemaVersion"/);
rejects(value => { value.schemaVersion = 2; }, /future schema version 2 is unsupported/);
rejects(value => { value.schemaVersion = 0; }, /schemaVersion: must be the integer 1/);
rejects(value => { value.metadata.createdAt = updatedAt; value.metadata.updatedAt = createdAt; }, /createdAt must be earlier/);
rejects(value => { value.metadata.name = 42; }, /metadata.name: must be a non-empty string/);
rejects(value => { value.spatialReference.units = 'metres'; }, /spatialReference: must explicitly use/);
rejects(value => { value.features.push({ ...value.features[0] }); }, /features\[4\]\.id: is duplicated/);
rejects(value => { value.layers.push({ ...value.layers[0] }); }, /layers\[4\]\.id: is duplicated/);
rejects(value => { value.features[0].layerId = 'missing-layer'; }, /features\[0\]\.layerId: references a missing layer/);
rejects(value => { value.features[1].layerId = 'layer-points'; }, /layer-points accepts Point features only/);
rejects(value => { value.features[1].coordinates = Array.from({ length: 1_001 }, () => [100, 13]); }, /LineString exceeds the 1000-vertex/);
rejects(value => { value.presentation.points['missing-point'] = { marker: 'dot', markerSize: 18, labelVisible: true, labelPosition: 'bottom' }; }, /references a missing feature/);
rejects(value => { value.presentation.points['point-1'].marker = 'html'; }, /marker: is not a supported marker kind/);
rejects(value => { value.features[3].provenance.buffer.radius = 0; }, /provenance.buffer.radius: must be between/);
rejects(value => { delete value.features[3].provenance.derivedFrom.geometry; }, /derivedFrom: must preserve id, name, type, geometry/);
rejects(value => { value.features[0].validationStatus = 'Validated'; }, /Validated is not an active status/);
rejects(value => { value.apiKey = 'must-not-be-persisted'; }, /project document: unsupported property "apiKey"/);
console.log('PASS strict format/version/timestamp/CRS/layer/geometry/presentation/buffer/trust rejection');

const stale = structuredClone(buffer) as SpatialFeature & { validationStatus: 'Stale' };
stale.validationStatus = 'Stale';
stale.provenance.limitations += '; Source geometry changed; regenerate this derived buffer before use.';
const changedPoint = structuredClone(point);
changedPoint.coordinates = [100.51, 13.75];
const staleDocument = createProjectDocument({
  metadata: { id: 'stale-project', name: 'Stale', createdAt, updatedAt },
  layers: createDefaultLayers(),
  features: [changedPoint, stale],
});
const staleRoundTrip = parseProjectDocumentJson(serializeProjectDocument(staleDocument));
assert.equal(staleRoundTrip.features[1]?.validationStatus, 'Stale');
assert.equal(staleRoundTrip.features[1]?.provenance.derivedFrom?.orphaned, undefined);
assert.deepEqual(staleRoundTrip.features[1]?.provenance.derivedFrom?.geometry, buffer.provenance.derivedFrom?.geometry);
assert.deepEqual(staleRoundTrip.features[0]?.coordinates, changedPoint.coordinates);

const orphaned = structuredClone(buffer) as SpatialFeature & { validationStatus: 'Stale' };
orphaned.validationStatus = 'Stale';
orphaned.provenance = {
  ...orphaned.provenance,
  limitations: `${orphaned.provenance.limitations}; Source feature was deleted; this derived buffer is orphaned and stale.`,
  derivedFrom: { ...orphaned.provenance.derivedFrom!, orphaned: true },
};
const orphanedDocument = createProjectDocument({
  metadata: { id: 'orphaned-project', name: 'Orphaned', createdAt, updatedAt },
  layers: createDefaultLayers(),
  features: [orphaned],
});
const orphanedRoundTrip = parseProjectDocumentJson(serializeProjectDocument(orphanedDocument));
assert.equal(orphanedRoundTrip.features[0]?.validationStatus, 'Stale');
assert.equal(orphanedRoundTrip.features[0]?.provenance.derivedFrom?.orphaned, true);
assert.deepEqual(orphanedRoundTrip.features[0]?.provenance.derivedFrom?.geometry, buffer.provenance.derivedFrom?.geometry);
console.log('PASS stale and orphaned derived buffer state preserves source ID, snapshot, provenance, and status');

rejects(value => {
  value.features[3].provenance.derivedFrom.orphaned = true;
}, /orphaned derived buffers must be Stale/);
rejects(value => {
  value.features[3].validationStatus = 'Experimental';
  value.features[3].provenance.derivedFrom.orphaned = true;
}, /orphaned derived buffers must be Stale/);
rejects(value => {
  value.features[0].coordinates = [100.51, 13.75];
}, /must exactly match the live source geometry when the derived buffer is not Stale/);
assert.equal(document.features[3]?.validationStatus, 'Functional but unvalidated');
assert.deepEqual(document.features[3]?.provenance.derivedFrom?.geometry, {
  type: 'Point',
  coordinates: point.coordinates,
}, 'an exact live source snapshot is accepted for a non-stale derived buffer');
console.log('PASS orphaned status and live-source geometry consistency rules are strict while stale snapshots remain preserved');

rejects(value => {
  value.features = [value.features[3]];
  value.presentation.points = {};
}, /must resolve to a live source or be explicitly orphaned/);
rejects(value => {
  value.features = [value.features[3]];
  value.presentation.points = {};
  value.features[0].validationStatus = 'Stale';
  value.features[0].provenance.derivedFrom.orphaned = true;
  value.features.push({ ...document.features[0], id: 'point-1' });
}, /orphaned source ID is currently live/);
console.log('PASS historical source IDs cannot silently reconnect to live replacement features');

const maliciousFeatures = [
  createAuthoredPoint('__proto__', [100, 13], 1),
  createAuthoredPoint('constructor', [101, 13], 2),
  createAuthoredPoint('prototype', [102, 13], 3),
];
const maliciousLayer = { id: '__proto__', name: 'Literal prototype layer', visible: true, color: '#111111' };
const maliciousFeature = { ...createAuthoredPoint('safe-on-malicious-layer', [103, 13], 4), layerId: maliciousLayer.id };
const maliciousPresentations = ownPresentations(maliciousFeatures.map(feature => [
  feature.id,
  { marker: 'dot', markerSize: 18, labelVisible: true, labelPosition: 'bottom' },
]) .concat([
  ['safe-on-malicious-layer', { marker: 'dot', markerSize: 18, labelVisible: true, labelPosition: 'bottom' }],
]));
const maliciousDocument = createProjectDocument({
  metadata: { id: 'prototype-safe', name: 'Prototype-safe', createdAt, updatedAt },
  layers: [...createDefaultLayers(), maliciousLayer],
  features: [...maliciousFeatures, maliciousFeature],
  pointPresentations: maliciousPresentations,
});
const maliciousRoundTrip = parseProjectDocumentJson(serializeProjectDocument(maliciousDocument));
for (const id of ['__proto__', 'constructor', 'prototype']) {
  assert.ok(Object.hasOwn(maliciousRoundTrip.presentation.points, id));
  assert.equal(maliciousRoundTrip.presentation.points[id]?.marker, 'dot');
}
assert.ok(Object.hasOwn(maliciousRoundTrip.presentation.points, 'safe-on-malicious-layer'));
assert.equal(Object.getPrototypeOf(maliciousRoundTrip.presentation.points), null);
assert.equal(Object.getPrototypeOf(Object.prototype), null);
console.log('PASS prototype-chain feature/layer/presentation IDs round-trip without prototype pollution or inherited lookup');

assert.throws(
  () => parseProjectDocumentJson(' '.repeat(PROJECT_DOCUMENT_MAX_TEXT_LENGTH + 1)),
  /exceeds the 2000000-character limit; input was not parsed or truncated/,
);
console.log('PASS over-limit native JSON rejects before parsing without truncation');

function makeBulkDocument(featureCount: number): Record<string, any> {
  const value = JSON.parse(encoded) as Record<string, any>;
  const coordinates = Array.from({ length: 1_000 }, () => [100, 13]);
  value.features = Array.from({ length: featureCount }, (_, index) => ({
    ...structuredClone(line),
    id: `bulk-line-${index}`,
    coordinates,
  }));
  value.presentation.points = {};
  return value;
}

const oversized = makeBulkDocument(500);
assert.ok(JSON.stringify(oversized).length > PROJECT_DOCUMENT_MAX_TEXT_LENGTH, 'fixture must exceed the aggregate serialized size bound');
assert.throws(
  () => decodeProjectDocument(oversized),
  /normalized serialized JSON exceeds the 2000000-character limit; the document was rejected without truncation/,
);
assert.throws(
  () => serializeProjectDocument(oversized as never),
  /normalized serialized JSON exceeds the 2000000-character limit; the document was rejected without truncation/,
);
assert.throws(
  () => createProjectDocument({
    metadata: oversized.metadata,
    layers: oversized.layers,
    features: oversized.features,
    pointPresentations: {},
  }),
  /normalized serialized JSON exceeds the 2000000-character limit; the document was rejected without truncation/,
);

function findExactBoundaryDocument(): Record<string, any> {
  for (let featureCount = 500; featureCount >= 1; featureCount -= 1) {
    const candidate = makeBulkDocument(featureCount);
    if (JSON.stringify(candidate).length > PROJECT_DOCUMENT_MAX_TEXT_LENGTH) continue;
    const baseLength = serializeProjectDocument(candidate as never).length;

    const oneDescription = structuredClone(candidate);
    oneDescription.features[0].description = 'x';
    const descriptionOverhead = serializeProjectDocument(oneDescription as never).length - baseLength - 1;
    const descriptionUnit = descriptionOverhead + MAX_DESCRIPTION_LENGTH;
    const remaining = PROJECT_DOCUMENT_MAX_TEXT_LENGTH - baseLength;
    const completeDescriptions = Math.min(
      candidate.features.length - 1,
      Math.floor(Math.max(0, remaining - descriptionOverhead - 1) / descriptionUnit),
    );
    for (let index = 0; index < completeDescriptions; index += 1) {
      candidate.features[index].description = 'x'.repeat(MAX_DESCRIPTION_LENGTH);
    }
    const afterComplete = serializeProjectDocument(candidate as never).length;
    const finalDescriptionLength = PROJECT_DOCUMENT_MAX_TEXT_LENGTH - afterComplete - descriptionOverhead;
    if (finalDescriptionLength < 1 || finalDescriptionLength > MAX_DESCRIPTION_LENGTH) continue;
    candidate.features[completeDescriptions].description = 'x'.repeat(finalDescriptionLength);
    if (serializeProjectDocument(candidate as never).length === PROJECT_DOCUMENT_MAX_TEXT_LENGTH) return candidate;
  }
  throw new Error('could not construct the exact aggregate-size boundary fixture');
}

const MAX_DESCRIPTION_LENGTH = 500;
const exactBoundary = findExactBoundaryDocument();
const exactBoundaryText = serializeProjectDocument(exactBoundary as never);
assert.equal(exactBoundaryText.length, PROJECT_DOCUMENT_MAX_TEXT_LENGTH);
assert.equal(serializeProjectDocument(parseProjectDocumentJson(exactBoundaryText)), exactBoundaryText);
assert.ok(encoded.length < PROJECT_DOCUMENT_MAX_TEXT_LENGTH);
assert.deepEqual(parseProjectDocumentJson(serializeProjectDocument(document)), document);
console.log('PASS normalized serialized JSON accepts exact-at-limit and ordinary under-limit documents, and rejects valid oversized fixtures');

const forgedValidatedSnapshot = JSON.parse(encoded) as Record<string, any>;
forgedValidatedSnapshot.features[3].provenance.derivedFrom.validationStatus = 'Validated';
assert.equal(decodeProjectDocument(forgedValidatedSnapshot).features[3]?.provenance.derivedFrom?.validationStatus, 'Validated', 'historical source snapshot is retained as provenance, not an active result claim');
console.log('PASS historical Validated source snapshot remains audit provenance while active v1 Validated results are rejected');

// Keep the imported helper in the fixture's dependency graph explicit: a native
// document uses the same current buffer layer identity as the accepted model.
assert.equal(buffer.layerId, BUFFER_LAYER_ID);
assert.equal(defaultProvenance('authored').units, 'WGS84 longitude/latitude');
