export const POINT_LAYER_ID = 'layer-points';
export const LINE_LAYER_ID = 'layer-lines';
export const POLYGON_LAYER_ID = 'layer-polygons';
export const BUFFER_LAYER_ID = 'layer-buffers';
export const MAX_TEXT_LENGTH = 500;
export const MAX_FEATURE_ID_LENGTH = 120;
export const MAX_LINE_VERTICES = 1_000;
export const MAX_POLYGON_VERTICES = 1_000;

export const VALIDATION_STATUSES = [
  'Validated',
  'Functional but unvalidated',
  'Experimental',
  'Stale',
] as const;

export type ValidationStatus = typeof VALIDATION_STATUSES[number];
export type FeatureLineage = 'authored' | 'imported' | 'derived';
export type GeometryType = 'Point' | 'LineString' | 'Polygon';
export type Wgs84Point = [longitude: number, latitude: number];
export type Wgs84LineString = Wgs84Point[];
// #20 deliberately supports only one exterior ring; holes and MultiPolygon stay out of scope.
export type Wgs84Polygon = [exteriorRing: Wgs84Point[]];

export type GeometrySnapshot =
  | { type: 'Point'; coordinates: Wgs84Point }
  | { type: 'LineString'; coordinates: Wgs84LineString }
  | { type: 'Polygon'; coordinates: Wgs84Polygon };

export interface DerivedFrom {
  id?: string;
  name?: string;
  type?: GeometryType;
  geometry?: GeometrySnapshot;
  validationStatus?: ValidationStatus;
  orphaned?: boolean;
  provenance?: Provenance;
}

export interface BufferDerivation {
  library: '@turf/buffer';
  libraryVersion: string;
  radius: number;
  units: 'meters';
  steps: number;
}

export interface Provenance {
  method: string;
  source: string;
  units: string;
  limitations: string;
  importedValidationStatus?: string;
  // Audit data from an untrusted file; never used as active workspace lineage.
  sourceLineageClaim?: { lineage: FeatureLineage; trust: 'untrusted' };
  importChain?: string[];
  derivedFrom?: DerivedFrom;
  buffer?: BufferDerivation;
}

interface BaseFeature<Type extends GeometryType, Coordinates> {
  id: string;
  type: Type;
  coordinates: Coordinates;
  name: string;
  description?: string;
  layerId: string;
  visible: boolean;
  lineage: FeatureLineage;
  validationStatus: ValidationStatus;
  provenance: Provenance;
}

export interface PointFeature extends BaseFeature<'Point', Wgs84Point> {}
export interface LineStringFeature extends BaseFeature<'LineString', Wgs84LineString> {}
export interface PolygonFeature extends BaseFeature<'Polygon', Wgs84Polygon> {}
export type SpatialFeature = PointFeature | LineStringFeature | PolygonFeature;

export interface FeatureLayer {
  id: string;
  name: string;
  visible: boolean;
  color: string;
}

export const defaultPointLayer: FeatureLayer = {
  id: POINT_LAYER_ID,
  name: 'Points',
  visible: true,
  color: '#f43f5e',
};

export const defaultLineLayer: FeatureLayer = {
  id: LINE_LAYER_ID,
  name: 'Lines',
  visible: true,
  color: '#0f766e',
};

export const defaultPolygonLayer: FeatureLayer = {
  id: POLYGON_LAYER_ID,
  name: 'Polygons',
  visible: true,
  color: '#2563eb',
};

export const defaultBufferLayer: FeatureLayer = {
  id: BUFFER_LAYER_ID,
  name: 'Buffers',
  visible: true,
  color: '#7c3aed',
};

export function createDefaultLayers(): FeatureLayer[] {
  return [
    { ...defaultPointLayer },
    { ...defaultLineLayer },
    { ...defaultPolygonLayer },
    { ...defaultBufferLayer },
  ];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function boundedText(value: string, maxLength = MAX_TEXT_LENGTH): string {
  return value.slice(0, maxLength);
}

export function isValidationStatus(value: unknown): value is ValidationStatus {
  return typeof value === 'string' && VALIDATION_STATUSES.includes(value as ValidationStatus);
}

export function normalizeValidationStatus(value: unknown, allowValidated = false): ValidationStatus {
  if (!isValidationStatus(value)) return 'Functional but unvalidated';
  if (value === 'Validated' && !allowValidated) return 'Functional but unvalidated';
  return value;
}

export function isFeatureLineage(value: unknown): value is FeatureLineage {
  return value === 'authored' || value === 'imported' || value === 'derived';
}

export function isGeometryType(value: unknown): value is GeometryType {
  return value === 'Point' || value === 'LineString' || value === 'Polygon';
}

export function isPointFeature(feature: SpatialFeature): feature is PointFeature {
  return feature.type === 'Point';
}

export function isLineStringFeature(feature: SpatialFeature): feature is LineStringFeature {
  return feature.type === 'LineString';
}

export function isPolygonFeature(feature: SpatialFeature): feature is PolygonFeature {
  return feature.type === 'Polygon';
}

export function defaultProvenance(lineage: FeatureLineage): Provenance {
  if (lineage === 'authored') {
    return {
      method: 'User-authored annotation',
      source: 'User input',
      units: 'WGS84 longitude/latitude',
      limitations: 'Not a validated engineering result',
    };
  }
  if (lineage === 'derived') {
    return {
      method: 'Derived spatial output',
      source: 'Workspace feature',
      units: 'WGS84 longitude/latitude',
      limitations: 'Derived output is not a validated engineering result.',
    };
  }
  return {
    method: 'GeoJSON import',
    source: 'Imported GeoJSON',
    units: 'WGS84 longitude/latitude',
    limitations: 'Imported values are not validated by City Map Tools',
  };
}

export function validateWgs84Point(value: unknown): Wgs84Point {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error('Point coordinates must be a 2-item [longitude, latitude] array.');
  }
  const [longitude, latitude] = value;
  if (typeof longitude !== 'number' || typeof latitude !== 'number' ||
      !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error('Point coordinates must contain finite numbers; values are not coerced.');
  }
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error('Point coordinates must be valid WGS84 longitude/latitude values.');
  }
  return [longitude, latitude];
}

export function validateWgs84LineString(value: unknown): Wgs84LineString {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error('LineString must contain at least 2 WGS84 vertices.');
  }
  if (value.length > MAX_LINE_VERTICES) {
    throw new Error(`LineString exceeds the ${MAX_LINE_VERTICES}-vertex operational limit.`);
  }
  return value.map(validateWgs84Point);
}

function pointKey(point: Wgs84Point): string {
  return `${point[0]},${point[1]}`;
}

function samePoint(first: Wgs84Point, second: Wgs84Point): boolean {
  return first[0] === second[0] && first[1] === second[1];
}

export function validateWgs84Polygon(value: unknown): Wgs84Polygon {
  if (!Array.isArray(value) || value.length !== 1 || !Array.isArray(value[0])) {
    throw new Error('Polygon must contain exactly one closed exterior ring; holes are unsupported.');
  }
  const ring = value[0];
  if (ring.length < 4) {
    throw new Error('Polygon exterior ring must contain at least 3 distinct vertices plus its closing vertex.');
  }
  if (ring.length > MAX_POLYGON_VERTICES + 1) {
    throw new Error(`Polygon exceeds the ${MAX_POLYGON_VERTICES}-vertex operational limit.`);
  }
  const coordinates = ring.map(validateWgs84Point);
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (!first || !last || !samePoint(first, last)) {
    throw new Error('Polygon exterior ring must be explicitly closed without coordinate coercion.');
  }
  const distinct = new Set(coordinates.slice(0, -1).map(pointKey));
  if (distinct.size < 3) {
    throw new Error('Polygon exterior ring must contain at least 3 distinct vertices.');
  }
  return [coordinates];
}

export function geometrySnapshot(feature: SpatialFeature): GeometrySnapshot {
  if (feature.type === 'Point') {
    return { type: 'Point', coordinates: validateWgs84Point(feature.coordinates) };
  }
  if (feature.type === 'LineString') {
    return { type: 'LineString', coordinates: validateWgs84LineString(feature.coordinates) };
  }
  return { type: 'Polygon', coordinates: validateWgs84Polygon(feature.coordinates) };
}

export function validateGeometrySnapshot(value: GeometrySnapshot): GeometrySnapshot {
  if (value.type === 'Point') return { type: 'Point', coordinates: validateWgs84Point(value.coordinates) };
  if (value.type === 'LineString') return { type: 'LineString', coordinates: validateWgs84LineString(value.coordinates) };
  return { type: 'Polygon', coordinates: validateWgs84Polygon(value.coordinates) };
}

function normalizeGeometrySnapshot(value: unknown): GeometrySnapshot | undefined {
  if (!isRecord(value) || !isGeometryType(value.type) || value.coordinates === undefined) return undefined;
  try {
    if (value.type === 'Point') return { type: 'Point', coordinates: validateWgs84Point(value.coordinates) };
    if (value.type === 'LineString') return { type: 'LineString', coordinates: validateWgs84LineString(value.coordinates) };
    return { type: 'Polygon', coordinates: validateWgs84Polygon(value.coordinates) };
  } catch {
    return undefined;
  }
}

export function normalizeProvenance(value: unknown, depth = 0): Provenance | null {
  if (!isRecord(value) || depth > 2) return null;
  const text = (field: unknown): string | undefined =>
    typeof field === 'string' && field.length > 0 ? boundedText(field) : undefined;

  const method = text(value.method);
  const source = text(value.source);
  const units = text(value.units);
  const limitations = text(value.limitations);
  if (!method || !source || !units || !limitations) return null;

  const normalized: Provenance = { method, source, units, limitations };
  if (isRecord(value.sourceLineageClaim) &&
      isFeatureLineage(value.sourceLineageClaim.lineage) && value.sourceLineageClaim.trust === 'untrusted') {
    normalized.sourceLineageClaim = { lineage: value.sourceLineageClaim.lineage, trust: 'untrusted' };
  }
  const importedValidationStatus = text(value.importedValidationStatus);
  if (importedValidationStatus) normalized.importedValidationStatus = importedValidationStatus;

  if (Array.isArray(value.importChain)) {
    const importChain = value.importChain
      .filter((item): item is string => typeof item === 'string')
      .map(item => boundedText(item, 160))
      .filter(Boolean)
      .slice(-20);
    if (importChain.length > 0) normalized.importChain = importChain;
  }

  if (isRecord(value.derivedFrom)) {
    const derivedFrom: DerivedFrom = {};
    if (typeof value.derivedFrom.id === 'string') derivedFrom.id = boundedText(value.derivedFrom.id, 120);
    if (typeof value.derivedFrom.name === 'string') derivedFrom.name = boundedText(value.derivedFrom.name);
    if (isGeometryType(value.derivedFrom.type)) derivedFrom.type = value.derivedFrom.type;
    const geometry = normalizeGeometrySnapshot(value.derivedFrom.geometry);
    if (geometry) derivedFrom.geometry = geometry;
    if (isValidationStatus(value.derivedFrom.validationStatus)) {
      derivedFrom.validationStatus = value.derivedFrom.validationStatus;
    }
    if (typeof value.derivedFrom.orphaned === 'boolean') derivedFrom.orphaned = value.derivedFrom.orphaned;
    const parentProvenance = normalizeProvenance(value.derivedFrom.provenance, depth + 1);
    if (parentProvenance) derivedFrom.provenance = parentProvenance;
    if (Object.keys(derivedFrom).length > 0) normalized.derivedFrom = derivedFrom;
  }

  if (isRecord(value.buffer) && value.buffer.library === '@turf/buffer' &&
      typeof value.buffer.libraryVersion === 'string' &&
      typeof value.buffer.radius === 'number' && Number.isFinite(value.buffer.radius) &&
      value.buffer.units === 'meters' && typeof value.buffer.steps === 'number' && Number.isInteger(value.buffer.steps)) {
    normalized.buffer = {
      library: '@turf/buffer',
      libraryVersion: boundedText(value.buffer.libraryVersion, 80),
      radius: value.buffer.radius,
      units: 'meters',
      steps: value.buffer.steps,
    };
  }

  return normalized;
}

function createAuthoredFeatureBase(id: string, index: number, layerId: string, type: GeometryType): Omit<SpatialFeature, 'type' | 'coordinates'> {
  return {
    id,
    name: `${type === 'LineString' ? 'Line' : type} ${index}`,
    layerId,
    visible: true,
    lineage: 'authored',
    validationStatus: 'Functional but unvalidated',
    provenance: defaultProvenance('authored'),
  } as Omit<SpatialFeature, 'type' | 'coordinates'>;
}

export function createAuthoredPoint(id: string, coordinates: Wgs84Point, index: number): PointFeature {
  return {
    ...createAuthoredFeatureBase(id, index, POINT_LAYER_ID, 'Point'),
    type: 'Point',
    coordinates: validateWgs84Point(coordinates),
  } as PointFeature;
}

export function createAuthoredLineString(id: string, coordinates: Wgs84LineString, index: number): LineStringFeature {
  return {
    ...createAuthoredFeatureBase(id, index, LINE_LAYER_ID, 'LineString'),
    type: 'LineString',
    coordinates: validateWgs84LineString(coordinates),
  } as LineStringFeature;
}

export function createAuthoredPolygon(id: string, coordinates: Wgs84Polygon, index: number): PolygonFeature {
  return {
    ...createAuthoredFeatureBase(id, index, POLYGON_LAYER_ID, 'Polygon'),
    type: 'Polygon',
    coordinates: validateWgs84Polygon(coordinates),
  } as PolygonFeature;
}

export function renameFeature<T extends SpatialFeature>(feature: T, name: string): T {
  return { ...feature, name: name.length > 0 ? boundedText(name) : `Untitled ${feature.type.toLowerCase()}` } as T;
}

export function renamePoint(feature: PointFeature, name: string): PointFeature {
  return renameFeature(feature, name);
}

function remapProvenanceIds(provenance: Provenance, idMap: ReadonlyMap<string, string>): Provenance {
  const derivedFrom = provenance.derivedFrom;
  if (!derivedFrom) return provenance;

  const remappedDerivedFrom: DerivedFrom = {
    ...derivedFrom,
    ...(derivedFrom.id && idMap.has(derivedFrom.id) ? { id: idMap.get(derivedFrom.id) } : {}),
    ...(derivedFrom.provenance
      ? { provenance: remapProvenanceIds(derivedFrom.provenance, idMap) }
      : {}),
  };
  return { ...provenance, derivedFrom: remappedDerivedFrom };
}

export function resolveImportedFeatures(
  imported: readonly PointFeature[],
  existing: readonly SpatialFeature[],
): PointFeature[] {
  const used = new Set(existing.map(feature => feature.id));
  const idMap = new Map<string, string>();
  const resolvedIds = imported.map(feature => {
    let id = feature.id;
    let suffix = 2;
    while (used.has(id)) {
      const suffixText = `-${suffix}`;
      if (suffixText.length >= MAX_FEATURE_ID_LENGTH) {
        throw new Error('Imported feature ID collision cannot be represented within the ID length limit.');
      }
      id = `${boundedText(feature.id, MAX_FEATURE_ID_LENGTH - suffixText.length)}${suffixText}`;
      suffix += 1;
    }
    used.add(id);
    idMap.set(feature.id, id);
    return id;
  });

  return imported.map((feature, index) => {
    const id = resolvedIds[index];
    if (!id) throw new Error('Imported feature ID resolution produced an incomplete result.');
    return {
      ...feature,
      id,
      provenance: remapProvenanceIds(feature.provenance, idMap),
    };
  });
}

export function importFeaturesIntoWorkspace(
  imported: readonly PointFeature[],
  existing: readonly SpatialFeature[],
): { features: SpatialFeature[]; selectedFeatureId: string | null } {
  const inserted = resolveImportedFeatures(imported, existing);
  return {
    features: [...existing, ...inserted],
    selectedFeatureId: inserted[0]?.id || null,
  };
}

function appendLimitation(limitations: string, note: string): string {
  if (limitations.includes(note)) return limitations;
  const separator = '; ';
  const available = Math.max(0, MAX_TEXT_LENGTH - separator.length - note.length);
  return `${boundedText(limitations, available)}${separator}${note}`;
}

export function markDependentBuffersStale(
  features: readonly SpatialFeature[],
  sourceId: string,
  sourceDeleted: boolean,
): SpatialFeature[] {
  const note = sourceDeleted
    ? 'Source feature was deleted; this derived buffer is orphaned and stale.'
    : 'Source geometry changed; regenerate this derived buffer before use.';
  return features.map(feature => {
    if (feature.lineage !== 'derived' || feature.provenance.derivedFrom?.id !== sourceId) return feature;
    return {
      ...feature,
      validationStatus: 'Stale',
      provenance: {
        ...feature.provenance,
        limitations: appendLimitation(feature.provenance.limitations, note),
        derivedFrom: {
          ...feature.provenance.derivedFrom,
          ...(sourceDeleted ? { orphaned: true } : {}),
        },
      },
    } as SpatialFeature;
  });
}
