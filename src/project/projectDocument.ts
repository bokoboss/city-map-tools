import {
  BUFFER_LIBRARY_VERSION,
  BUFFER_RADIUS_MAX_METERS,
  BUFFER_RADIUS_MIN_METERS,
  BUFFER_STEPS,
} from '../features/buffer';
import {
  BUFFER_LAYER_ID,
  LINE_LAYER_ID,
  MAX_FEATURE_ID_LENGTH,
  MAX_TEXT_LENGTH,
  POLYGON_LAYER_ID,
  POINT_LAYER_ID,
  createDefaultLayers,
  isFeatureLineage,
  isGeometryType,
  isDenseArray,
  isRecord,
  isValidationStatus,
  geometrySnapshot,
  geometrySnapshotsEqual,
  validateWgs84LineString,
  validateWgs84Point,
  validateWgs84Polygon,
  type BufferDerivation,
  type DerivedFrom,
  type FeatureLayer,
  type FeatureLineage,
  type GeometrySnapshot,
  type Provenance,
  type SpatialFeature,
} from '../features/featureModel';
import {
  POINT_LABEL_POSITIONS,
  POINT_MARKER_KINDS,
  POINT_MARKER_SIZES,
  type PointPresentation,
} from '../map/pointPresentation';

export const PROJECT_DOCUMENT_FORMAT = 'city-map-tools-project' as const;
export const PROJECT_DOCUMENT_SCHEMA_VERSION = 1 as const;
// A low-volume project with the existing 1,000-vertex geometry bounds fits well
// below this limit. Input is rejected before JSON.parse; it is never truncated.
export const PROJECT_DOCUMENT_MAX_TEXT_LENGTH = 2_000_000;
export const PROJECT_DOCUMENT_MAX_FEATURES = 500;
export const PROJECT_DOCUMENT_MAX_LAYERS = 64;
export const PROJECT_DOCUMENT_MAX_PROVENANCE_DEPTH = 2;

export const PROJECT_DOCUMENT_CRS = 'EPSG:4326' as const;
export const PROJECT_DOCUMENT_AXIS_ORDER = 'longitude-latitude' as const;
export const PROJECT_DOCUMENT_UNITS = 'degrees' as const;

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSpatialReference {
  crs: typeof PROJECT_DOCUMENT_CRS;
  axisOrder: typeof PROJECT_DOCUMENT_AXIS_ORDER;
  units: typeof PROJECT_DOCUMENT_UNITS;
}

export interface ProjectPresentation {
  points: Record<string, PointPresentation>;
}

export interface ProjectDocumentV1 {
  format: typeof PROJECT_DOCUMENT_FORMAT;
  schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION;
  metadata: ProjectMetadata;
  spatialReference: ProjectSpatialReference;
  layers: FeatureLayer[];
  features: SpatialFeature[];
  presentation: ProjectPresentation;
}

export interface CreateEmptyProjectDocumentInput {
  id: string;
  createdAt: string;
  updatedAt?: string;
  name?: string;
}

export interface CreateProjectDocumentInput {
  metadata: ProjectMetadata;
  layers: readonly FeatureLayer[];
  features: readonly SpatialFeature[];
  pointPresentations?: Readonly<Record<string, PointPresentation>>;
}

export class ProjectDocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectDocumentValidationError';
  }
}

type UnknownRecord = Record<string, unknown>;

function fail(path: string, message: string): never {
  throw new ProjectDocumentValidationError(`${path}: ${message}`);
}

function record(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) fail(path, 'must be an object.');
  return value;
}

function hasOwn(value: UnknownRecord, key: string): boolean {
  return Object.hasOwn(value, key);
}

function required(value: UnknownRecord, key: string, path: string): unknown {
  if (!hasOwn(value, key)) fail(path, `missing required property "${key}".`);
  return value[key];
}

function exactKeys(value: UnknownRecord, allowed: readonly string[], path: string): void {
  const allowedSet = new Set(allowed);
  const unsupported = Object.keys(value).find(key => !allowedSet.has(key));
  if (unsupported) fail(path, `unsupported property "${unsupported}".`);
}

function boundedString(value: unknown, path: string, maxLength: number): string {
  if (typeof value !== 'string' || value.length === 0) fail(path, 'must be a non-empty string.');
  if (value.length > maxLength) fail(path, `exceeds the ${maxLength}-character limit.`);
  return value;
}

function boundedId(value: unknown, path: string): string {
  return boundedString(value, path, MAX_FEATURE_ID_LENGTH);
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'must be boolean.');
  return value;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'must be a finite number.');
  return value;
}

function integer(value: unknown, path: string): number {
  const number = finiteNumber(value, path);
  if (!Number.isInteger(number)) fail(path, 'must be an integer.');
  return number;
}

function canonicalTimestamp(value: unknown, path: string): string {
  const timestamp = boundedString(value, path, 24);
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== timestamp) {
    fail(path, 'must be a canonical UTC ISO timestamp with milliseconds.');
  }
  return timestamp;
}

function cloneGeometry(value: unknown, path: string): GeometrySnapshot {
  const source = record(value, path);
  exactKeys(source, ['type', 'coordinates'], path);
  const type = required(source, 'type', path);
  const coordinates = required(source, 'coordinates', path);
  if (!isGeometryType(type)) fail(`${path}.type`, 'must be Point, LineString, or Polygon.');
  try {
    if (type === 'Point') return { type, coordinates: validateWgs84Point(coordinates) };
    if (type === 'LineString') return { type, coordinates: validateWgs84LineString(coordinates) };
    return { type, coordinates: validateWgs84Polygon(coordinates) };
  } catch (error) {
    fail(path, error instanceof Error ? error.message : 'has invalid WGS84 coordinates.');
  }
}

function cloneBuffer(value: unknown, path: string): BufferDerivation {
  const source = record(value, path);
  exactKeys(source, ['library', 'libraryVersion', 'radius', 'units', 'steps'], path);
  const library = required(source, 'library', path);
  if (library !== '@turf/buffer') fail(`${path}.library`, 'must be @turf/buffer for schema v1.');
  const libraryVersion = boundedString(required(source, 'libraryVersion', path), `${path}.libraryVersion`, 80);
  if (libraryVersion !== BUFFER_LIBRARY_VERSION) {
    fail(`${path}.libraryVersion`, `must be ${BUFFER_LIBRARY_VERSION} for the accepted v1 buffer method.`);
  }
  const radius = finiteNumber(required(source, 'radius', path), `${path}.radius`);
  if (radius < BUFFER_RADIUS_MIN_METERS || radius > BUFFER_RADIUS_MAX_METERS) {
    fail(`${path}.radius`, `must be between ${BUFFER_RADIUS_MIN_METERS} and ${BUFFER_RADIUS_MAX_METERS} metres.`);
  }
  if (required(source, 'units', path) !== 'meters') fail(`${path}.units`, 'must be meters.');
  const steps = integer(required(source, 'steps', path), `${path}.steps`);
  if (steps !== BUFFER_STEPS) fail(`${path}.steps`, `must be ${BUFFER_STEPS} for the accepted v1 buffer method.`);
  return { library, libraryVersion, radius, units: 'meters', steps };
}

function cloneDerivedFrom(value: unknown, path: string, depth: number): DerivedFrom {
  if (depth > PROJECT_DOCUMENT_MAX_PROVENANCE_DEPTH) {
    fail(path, `exceeds the ${PROJECT_DOCUMENT_MAX_PROVENANCE_DEPTH}-level provenance depth limit.`);
  }
  const source = record(value, path);
  exactKeys(source, ['id', 'name', 'type', 'geometry', 'validationStatus', 'orphaned', 'provenance'], path);
  const derivedFrom: DerivedFrom = {};
  if (hasOwn(source, 'id')) derivedFrom.id = boundedId(source.id, `${path}.id`);
  if (hasOwn(source, 'name')) derivedFrom.name = boundedString(source.name, `${path}.name`, MAX_TEXT_LENGTH);
  if (hasOwn(source, 'type')) {
    if (!isGeometryType(source.type)) fail(`${path}.type`, 'must be Point, LineString, or Polygon.');
    derivedFrom.type = source.type;
  }
  if (hasOwn(source, 'geometry')) derivedFrom.geometry = cloneGeometry(source.geometry, `${path}.geometry`);
  if (hasOwn(source, 'validationStatus')) {
    if (!isValidationStatus(source.validationStatus)) fail(`${path}.validationStatus`, 'is not recognized.');
    derivedFrom.validationStatus = source.validationStatus;
  }
  if (hasOwn(source, 'orphaned')) derivedFrom.orphaned = booleanValue(source.orphaned, `${path}.orphaned`);
  if (hasOwn(source, 'provenance')) {
    derivedFrom.provenance = cloneProvenance(source.provenance, `${path}.provenance`, depth + 1);
  }
  return derivedFrom;
}

function cloneProvenance(value: unknown, path: string, depth = 0): Provenance {
  if (depth > PROJECT_DOCUMENT_MAX_PROVENANCE_DEPTH) {
    fail(path, `exceeds the ${PROJECT_DOCUMENT_MAX_PROVENANCE_DEPTH}-level provenance depth limit.`);
  }
  const source = record(value, path);
  exactKeys(source, [
    'method', 'source', 'units', 'limitations', 'importedValidationStatus',
    'sourceLineageClaim', 'importChain', 'derivedFrom', 'buffer',
  ], path);
  const provenance: Provenance = {
    method: boundedString(required(source, 'method', path), `${path}.method`, MAX_TEXT_LENGTH),
    source: boundedString(required(source, 'source', path), `${path}.source`, MAX_TEXT_LENGTH),
    units: boundedString(required(source, 'units', path), `${path}.units`, MAX_TEXT_LENGTH),
    limitations: boundedString(required(source, 'limitations', path), `${path}.limitations`, MAX_TEXT_LENGTH),
  };
  if (hasOwn(source, 'importedValidationStatus')) {
    provenance.importedValidationStatus = boundedString(source.importedValidationStatus, `${path}.importedValidationStatus`, MAX_FEATURE_ID_LENGTH);
  }
  if (hasOwn(source, 'sourceLineageClaim')) {
    const claim = record(source.sourceLineageClaim, `${path}.sourceLineageClaim`);
    exactKeys(claim, ['lineage', 'trust'], `${path}.sourceLineageClaim`);
    if (!isFeatureLineage(required(claim, 'lineage', `${path}.sourceLineageClaim`))) {
      fail(`${path}.sourceLineageClaim.lineage`, 'must be an authored, imported, or derived lineage.');
    }
    if (required(claim, 'trust', `${path}.sourceLineageClaim`) !== 'untrusted') {
      fail(`${path}.sourceLineageClaim.trust`, 'must be untrusted.');
    }
    provenance.sourceLineageClaim = { lineage: claim.lineage as FeatureLineage, trust: 'untrusted' };
  }
  if (hasOwn(source, 'importChain')) {
    if (!Array.isArray(source.importChain) || source.importChain.length > 20) {
      fail(`${path}.importChain`, 'must contain at most 20 strings.');
    }
    if (!isDenseArray(source.importChain)) {
      fail(`${path}.importChain`, 'must be a dense array; sparse arrays are not accepted.');
    }
    provenance.importChain = source.importChain.map((entry, index) =>
      boundedString(entry, `${path}.importChain[${index}]`, 160));
  }
  if (hasOwn(source, 'derivedFrom')) {
    provenance.derivedFrom = cloneDerivedFrom(source.derivedFrom, `${path}.derivedFrom`, depth);
    const derived = provenance.derivedFrom;
    if (derived.type && derived.geometry && derived.type !== derived.geometry.type) {
      fail(`${path}.derivedFrom`, 'type must match the stored geometry snapshot type.');
    }
  }
  if (hasOwn(source, 'buffer')) provenance.buffer = cloneBuffer(source.buffer, `${path}.buffer`);
  return provenance;
}

function cloneLayer(value: unknown, index: number): FeatureLayer {
  const path = `layers[${index}]`;
  const source = record(value, path);
  exactKeys(source, ['id', 'name', 'visible', 'color'], path);
  return {
    id: boundedId(required(source, 'id', path), `${path}.id`),
    name: boundedString(required(source, 'name', path), `${path}.name`, MAX_TEXT_LENGTH),
    visible: booleanValue(required(source, 'visible', path), `${path}.visible`),
    color: boundedString(required(source, 'color', path), `${path}.color`, 64),
  };
}

function cloneFeature(value: unknown, index: number): SpatialFeature {
  const path = `features[${index}]`;
  const source = record(value, path);
  exactKeys(source, [
    'id', 'type', 'coordinates', 'name', 'description', 'layerId',
    'visible', 'lineage', 'validationStatus', 'provenance',
  ], path);
  const id = boundedId(required(source, 'id', path), `${path}.id`);
  const type = required(source, 'type', path);
  if (!isGeometryType(type)) fail(`${path}.type`, 'must be Point, LineString, or Polygon.');
  const name = boundedString(required(source, 'name', path), `${path}.name`, MAX_TEXT_LENGTH);
  const description = hasOwn(source, 'description')
    ? boundedString(source.description, `${path}.description`, MAX_TEXT_LENGTH)
    : undefined;
  const layerId = boundedId(required(source, 'layerId', path), `${path}.layerId`);
  const visible = booleanValue(required(source, 'visible', path), `${path}.visible`);
  const lineage = required(source, 'lineage', path);
  if (!isFeatureLineage(lineage)) fail(`${path}.lineage`, 'must be authored, imported, or derived.');
  const validationStatus = required(source, 'validationStatus', path);
  if (!isValidationStatus(validationStatus)) fail(`${path}.validationStatus`, 'is not recognized.');
  if (validationStatus === 'Validated') {
    fail(`${path}.validationStatus`, 'Validated is not an active status that native v1 can create or trust.');
  }
  const provenance = cloneProvenance(required(source, 'provenance', path), `${path}.provenance`);
  const base = {
    id,
    name,
    ...(description === undefined ? {} : { description }),
    layerId,
    visible,
    lineage,
    validationStatus,
    provenance,
  };
  try {
    if (type === 'Point') return { ...base, type, coordinates: validateWgs84Point(required(source, 'coordinates', path)) };
    if (type === 'LineString') return { ...base, type, coordinates: validateWgs84LineString(required(source, 'coordinates', path)) };
    return { ...base, type, coordinates: validateWgs84Polygon(required(source, 'coordinates', path)) };
  } catch (error) {
    fail(`${path}.coordinates`, error instanceof Error ? error.message : 'has invalid WGS84 coordinates.');
  }
}

function clonePresentation(value: unknown, features: readonly SpatialFeature[]): ProjectPresentation {
  const source = record(value, 'presentation');
  exactKeys(source, ['points'], 'presentation');
  const points = record(required(source, 'points', 'presentation'), 'presentation.points');
  const featureById = new Map(features.map(feature => [feature.id, feature]));
  const output = Object.create(null) as Record<string, PointPresentation>;
  for (const featureId of Object.keys(points)) {
    boundedId(featureId, `presentation.points.${featureId}`);
    const feature = featureById.get(featureId);
    if (!feature) fail(`presentation.points.${featureId}`, 'references a missing feature.');
    if (feature.type !== 'Point') fail(`presentation.points.${featureId}`, 'may reference Point features only.');
    const presentation = record(points[featureId], `presentation.points.${featureId}`);
    exactKeys(presentation, ['marker', 'markerSize', 'labelVisible', 'labelPosition'], `presentation.points.${featureId}`);
    const marker = required(presentation, 'marker', `presentation.points.${featureId}`);
    if (!POINT_MARKER_KINDS.includes(marker as PointPresentation['marker'])) {
      fail(`presentation.points.${featureId}.marker`, 'is not a supported marker kind.');
    }
    const markerSize = integer(required(presentation, 'markerSize', `presentation.points.${featureId}`), `presentation.points.${featureId}.markerSize`);
    if (!POINT_MARKER_SIZES.includes(markerSize as PointPresentation['markerSize'])) {
      fail(`presentation.points.${featureId}.markerSize`, 'is not a supported marker size.');
    }
    const labelVisible = booleanValue(required(presentation, 'labelVisible', `presentation.points.${featureId}`), `presentation.points.${featureId}.labelVisible`);
    const labelPosition = required(presentation, 'labelPosition', `presentation.points.${featureId}`);
    if (!POINT_LABEL_POSITIONS.includes(labelPosition as PointPresentation['labelPosition'])) {
      fail(`presentation.points.${featureId}.labelPosition`, 'is not a supported label position.');
    }
    Object.defineProperty(output, featureId, {
      value: { marker: marker as PointPresentation['marker'], markerSize: markerSize as PointPresentation['markerSize'], labelVisible, labelPosition: labelPosition as PointPresentation['labelPosition'] },
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return { points: output };
}

function validateDerivedFeatureRelationships(features: readonly SpatialFeature[]): void {
  const live = new Map(features.map(feature => [feature.id, feature]));
  for (const [index, feature] of features.entries()) {
    const derivedFrom = feature.provenance.derivedFrom;
    const buffer = feature.provenance.buffer;
    if (feature.lineage !== 'derived') {
      if (buffer !== undefined) fail(`features[${index}].provenance.buffer`, 'is reserved for derived buffer features.');
      continue;
    }
    if (feature.type !== 'Polygon' || feature.layerId !== BUFFER_LAYER_ID) {
      fail(`features[${index}]`, 'derived v1 features must be Polygon buffers on the Buffers layer.');
    }
    if (feature.validationStatus === 'Validated') {
      fail(`features[${index}].validationStatus`, 'derived results cannot claim Validated status.');
    }
    if (!derivedFrom || !buffer) fail(`features[${index}].provenance`, 'derived buffers require buffer metadata and a source snapshot.');
    if (!derivedFrom.id || !derivedFrom.name || !derivedFrom.type || !derivedFrom.geometry ||
        !derivedFrom.validationStatus || !derivedFrom.provenance) {
      fail(`features[${index}].provenance.derivedFrom`, 'must preserve id, name, type, geometry, validation status, and provenance.');
    }
    if (derivedFrom.type !== derivedFrom.geometry.type) {
      fail(`features[${index}].provenance.derivedFrom`, 'source type must match the source geometry snapshot.');
    }
    if (derivedFrom.orphaned === true) {
      if (feature.validationStatus !== 'Stale') {
        fail(`features[${index}].validationStatus`, 'orphaned derived buffers must be Stale.');
      }
      if (live.has(derivedFrom.id)) fail(`features[${index}].provenance.derivedFrom.id`, 'orphaned source ID is currently live and would silently reconnect.');
    } else {
      const source = live.get(derivedFrom.id);
      if (!source) fail(`features[${index}].provenance.derivedFrom.id`, 'must resolve to a live source or be explicitly orphaned.');
      if (source.lineage === 'derived' || source.type !== derivedFrom.type) {
        fail(`features[${index}].provenance.derivedFrom.id`, 'resolves to an incompatible live source.');
      }
      if (feature.validationStatus !== 'Stale' &&
          !geometrySnapshotsEqual(geometrySnapshot(source), derivedFrom.geometry)) {
        fail(`features[${index}].provenance.derivedFrom.geometry`, 'must exactly match the live source geometry when the derived buffer is not Stale.');
      }
    }
  }
}

function cloneDocument(value: unknown): ProjectDocumentV1 {
  const source = record(value, 'project document');
  exactKeys(source, ['format', 'schemaVersion', 'metadata', 'spatialReference', 'layers', 'features', 'presentation'], 'project document');
  if (required(source, 'format', 'project document') !== PROJECT_DOCUMENT_FORMAT) {
    fail('format', `must be ${PROJECT_DOCUMENT_FORMAT}.`);
  }
  const schemaVersion = required(source, 'schemaVersion', 'project document');
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
    fail('schemaVersion', 'must be the integer 1.');
  }
  if (schemaVersion > PROJECT_DOCUMENT_SCHEMA_VERSION) {
    fail('schemaVersion', `future schema version ${schemaVersion} is unsupported; upgrade City Map Tools before loading this file.`);
  }
  if (schemaVersion !== PROJECT_DOCUMENT_SCHEMA_VERSION) fail('schemaVersion', 'must be the integer 1.');

  const metadataSource = record(required(source, 'metadata', 'project document'), 'metadata');
  exactKeys(metadataSource, ['id', 'name', 'createdAt', 'updatedAt'], 'metadata');
  const metadata: ProjectMetadata = {
    id: boundedId(required(metadataSource, 'id', 'metadata'), 'metadata.id'),
    name: boundedString(required(metadataSource, 'name', 'metadata'), 'metadata.name', MAX_TEXT_LENGTH),
    createdAt: canonicalTimestamp(required(metadataSource, 'createdAt', 'metadata'), 'metadata.createdAt'),
    updatedAt: canonicalTimestamp(required(metadataSource, 'updatedAt', 'metadata'), 'metadata.updatedAt'),
  };
  if (Date.parse(metadata.createdAt) > Date.parse(metadata.updatedAt)) fail('metadata', 'createdAt must be earlier than or equal to updatedAt.');

  const spatialSource = record(required(source, 'spatialReference', 'project document'), 'spatialReference');
  exactKeys(spatialSource, ['crs', 'axisOrder', 'units'], 'spatialReference');
  if (required(spatialSource, 'crs', 'spatialReference') !== PROJECT_DOCUMENT_CRS ||
      required(spatialSource, 'axisOrder', 'spatialReference') !== PROJECT_DOCUMENT_AXIS_ORDER ||
      required(spatialSource, 'units', 'spatialReference') !== PROJECT_DOCUMENT_UNITS) {
    fail('spatialReference', 'must explicitly use EPSG:4326 longitude-latitude degrees; CRS semantics are never inferred.');
  }

  const layersValue = required(source, 'layers', 'project document');
  if (!Array.isArray(layersValue) || layersValue.length === 0 || layersValue.length > PROJECT_DOCUMENT_MAX_LAYERS) {
    fail('layers', `must contain 1-${PROJECT_DOCUMENT_MAX_LAYERS} layers.`);
  }
  if (!isDenseArray(layersValue)) fail('layers', 'must be a dense array; sparse arrays are not accepted.');
  const layers = layersValue.map(cloneLayer);
  const layerIds = new Set<string>();
  layers.forEach((layer, index) => {
    if (layerIds.has(layer.id)) fail(`layers[${index}].id`, 'is duplicated.');
    layerIds.add(layer.id);
  });

  const featuresValue = required(source, 'features', 'project document');
  if (!Array.isArray(featuresValue) || featuresValue.length > PROJECT_DOCUMENT_MAX_FEATURES) {
    fail('features', `must contain at most ${PROJECT_DOCUMENT_MAX_FEATURES} features.`);
  }
  if (!isDenseArray(featuresValue)) fail('features', 'must be a dense array; sparse arrays are not accepted.');
  const features = featuresValue.map(cloneFeature);
  const featureIds = new Set<string>();
  features.forEach((feature, index) => {
    if (featureIds.has(feature.id)) fail(`features[${index}].id`, 'is duplicated.');
    featureIds.add(feature.id);
    if (!layerIds.has(feature.layerId)) fail(`features[${index}].layerId`, 'references a missing layer.');
    if (feature.layerId === POINT_LAYER_ID && feature.type !== 'Point') fail(`features[${index}].layerId`, 'layer-points accepts Point features only.');
    if (feature.layerId === LINE_LAYER_ID && feature.type !== 'LineString') fail(`features[${index}].layerId`, 'layer-lines accepts LineString features only.');
    if (feature.layerId === POLYGON_LAYER_ID && feature.type !== 'Polygon') fail(`features[${index}].layerId`, 'layer-polygons accepts Polygon features only.');
    if (feature.layerId === BUFFER_LAYER_ID && (feature.type !== 'Polygon' || feature.lineage !== 'derived')) fail(`features[${index}].layerId`, 'layer-buffers accepts derived Polygon buffers only.');
  });
  validateDerivedFeatureRelationships(features);

  const document: ProjectDocumentV1 = {
    format: PROJECT_DOCUMENT_FORMAT,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    metadata,
    spatialReference: {
      crs: PROJECT_DOCUMENT_CRS,
      axisOrder: PROJECT_DOCUMENT_AXIS_ORDER,
      units: PROJECT_DOCUMENT_UNITS,
    },
    layers,
    features,
    presentation: clonePresentation(required(source, 'presentation', 'project document'), features),
  };
  assertSerializedDocumentSize(document);
  return document;
}

function assertSerializedDocumentSize(document: ProjectDocumentV1): void {
  const normalizedText = JSON.stringify(document);
  if (normalizedText.length > PROJECT_DOCUMENT_MAX_TEXT_LENGTH) {
    fail('project document', `normalized serialized JSON exceeds the ${PROJECT_DOCUMENT_MAX_TEXT_LENGTH}-character limit; the document was rejected without truncation.`);
  }
}

export function createEmptyProjectDocument(input: CreateEmptyProjectDocumentInput): ProjectDocumentV1 {
  const updatedAt = input.updatedAt ?? input.createdAt;
  return createProjectDocument({
    metadata: {
      id: input.id,
      name: input.name ?? 'Untitled project',
      createdAt: input.createdAt,
      updatedAt,
    },
    layers: createDefaultLayers(),
    features: [],
  });
}

export function createProjectDocument(input: CreateProjectDocumentInput): ProjectDocumentV1 {
  return decodeProjectDocument({
    format: PROJECT_DOCUMENT_FORMAT,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    metadata: input.metadata,
    spatialReference: {
      crs: PROJECT_DOCUMENT_CRS,
      axisOrder: PROJECT_DOCUMENT_AXIS_ORDER,
      units: PROJECT_DOCUMENT_UNITS,
    },
    layers: input.layers,
    features: input.features,
    presentation: { points: input.pointPresentations ?? Object.create(null) },
  });
}

export function decodeProjectDocument(value: unknown): ProjectDocumentV1 {
  return cloneDocument(value);
}

export function parseProjectDocumentJson(text: string): ProjectDocumentV1 {
  if (typeof text !== 'string') throw new ProjectDocumentValidationError('Project document JSON must be a string.');
  if (text.length > PROJECT_DOCUMENT_MAX_TEXT_LENGTH) {
    throw new ProjectDocumentValidationError(`Project document JSON exceeds the ${PROJECT_DOCUMENT_MAX_TEXT_LENGTH}-character limit; input was not parsed or truncated.`);
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new ProjectDocumentValidationError('Project document JSON is malformed; the current project was not changed.');
  }
  return decodeProjectDocument(value);
}

export function serializeProjectDocument(document: ProjectDocumentV1): string {
  const normalized = decodeProjectDocument(document);
  assertSerializedDocumentSize(normalized);
  return JSON.stringify(normalized);
}
