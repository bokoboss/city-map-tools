import {
  boundedText,
  defaultProvenance,
  isFeatureLineage,
  isRecord,
  isValidationStatus,
  MAX_FEATURE_ID_LENGTH,
  MAX_TEXT_LENGTH,
  normalizeProvenance,
  normalizeValidationStatus,
  type FeatureLayer,
  type FeatureLineage,
  type PointFeature,
  type Provenance,
  validateWgs84Point,
} from './featureModel';

export const GEOJSON_EXPORT_FORMAT = 'city-map-tools.geojson';
export const GEOJSON_EXPORT_VERSION = 1;
export const GEOJSON_MAX_TEXT_LENGTH = 1_000_000;

export const SUPPORTED_GEOJSON_PROPERTIES = [
  'name',
  'description',
  'layerId',
  'visible',
  'lineage',
  'validationStatus',
  'provenance',
] as const;

type SupportedProperty = typeof SUPPORTED_GEOJSON_PROPERTIES[number];
type JsonProperties = Partial<Record<SupportedProperty, unknown>>;

export interface GeoJsonPointFeature {
  type: 'Feature';
  id?: string | number;
  geometry: { type: 'Point'; coordinates: unknown };
  properties?: JsonProperties | null;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  metadata?: unknown;
  features: unknown[];
}

export class GeoJsonImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeoJsonImportError';
  }
}

function fail(message: string): never {
  throw new GeoJsonImportError(message);
}

function readBoundedString(value: unknown, label: string, maxLength = MAX_TEXT_LENGTH): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string.`);
  if (value.length > maxLength) fail(`${label} exceeds the ${maxLength}-character limit.`);
  return boundedText(value, maxLength);
}

function assertSupportedProvenance(value: unknown, label: string, depth = 0): void {
  if (!isRecord(value) || depth > 2) fail(`${label} must be a bounded provenance object.`);
  const supported = new Set(['method', 'source', 'units', 'limitations', 'importedValidationStatus', 'importChain', 'derivedFrom']);
  const unsupported = Object.keys(value).find(key => !supported.has(key));
  if (unsupported) fail(`${label}.${unsupported} is unsupported; import was rejected without changing app state.`);
  for (const key of ['method', 'source', 'units', 'limitations', 'importedValidationStatus']) {
    if (value[key] !== undefined) readBoundedString(value[key], `${label}.${key}`, key === 'importedValidationStatus' ? MAX_FEATURE_ID_LENGTH : MAX_TEXT_LENGTH);
  }
  if (value.importChain !== undefined) {
    if (!Array.isArray(value.importChain) || value.importChain.length > 20 ||
        value.importChain.some(item => typeof item !== 'string' || item.length > 160)) {
      fail(`${label}.importChain must contain at most 20 short strings.`);
    }
  }
  if (value.derivedFrom !== undefined) {
    if (!isRecord(value.derivedFrom)) fail(`${label}.derivedFrom must be an object.`);
    const derivedKeys = new Set(['id', 'name', 'validationStatus', 'provenance']);
    const unsupportedDerived = Object.keys(value.derivedFrom).find(key => !derivedKeys.has(key));
    if (unsupportedDerived) fail(`${label}.derivedFrom.${unsupportedDerived} is unsupported.`);
    if (value.derivedFrom.id !== undefined) readBoundedString(value.derivedFrom.id, `${label}.derivedFrom.id`, MAX_FEATURE_ID_LENGTH);
    if (value.derivedFrom.name !== undefined) readBoundedString(value.derivedFrom.name, `${label}.derivedFrom.name`);
    if (value.derivedFrom.validationStatus !== undefined && !isValidationStatus(value.derivedFrom.validationStatus)) {
      fail(`${label}.derivedFrom.validationStatus is not recognized.`);
    }
    if (value.derivedFrom.provenance !== undefined) assertSupportedProvenance(value.derivedFrom.provenance, `${label}.derivedFrom.provenance`, depth + 1);
  }
}

function readFeatureId(value: unknown, index: number): string {
  if (value === undefined || value === null) return `imported-point-${index + 1}`;
  if (typeof value === 'string') return readBoundedString(value, `Feature ${index + 1} id`, MAX_FEATURE_ID_LENGTH);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  fail(`Feature ${index + 1} id must be a string or safe integer.`);
}

function isApplicationExport(document: GeoJsonFeatureCollection): boolean {
  return isRecord(document.metadata) &&
    document.metadata.format === GEOJSON_EXPORT_FORMAT &&
    document.metadata.version === GEOJSON_EXPORT_VERSION &&
    document.metadata.generator === 'City Map Tools';
}

function readProperties(value: unknown, index: number): JsonProperties {
  if (value === null || value === undefined) return {};
  if (!isRecord(value)) fail(`Feature ${index + 1} properties must be an object or null.`);
  const unsupported = Object.keys(value).find(key => !SUPPORTED_GEOJSON_PROPERTIES.includes(key as SupportedProperty));
  if (unsupported) fail(`Feature ${index + 1} property "${boundedText(unsupported, 120)}" is unsupported; import was rejected without changing app state.`);
  return value as JsonProperties;
}

function appendImportContext(provenance: Provenance, applicationExport: boolean): Provenance {
  const chain = provenance.importChain ? provenance.importChain.slice(-19) : [];
  chain.push(applicationExport
    ? 'GeoJSON import from City Map Tools export'
    : 'GeoJSON import from external file');
  const note = 'This import preserves lineage but does not independently validate it.';
  const separator = '; ';
  const available = MAX_TEXT_LENGTH - separator.length - note.length;
  const limitations = provenance.limitations.includes(note)
    ? provenance.limitations
    : `${boundedText(provenance.limitations, available)}${separator}${note}`;
  return { ...provenance, limitations, importChain: chain };
}

function readPointFeature(value: unknown, index: number, layers: readonly FeatureLayer[], applicationExport: boolean): PointFeature {
  if (!isRecord(value) || value.type !== 'Feature') fail(`Feature ${index + 1} must be a GeoJSON Feature.`);
  if (!isRecord(value.geometry) || value.geometry.type !== 'Point') {
    const geometryType = isRecord(value.geometry) && typeof value.geometry.type === 'string' ? value.geometry.type : 'missing';
    fail(`Feature ${index + 1} uses unsupported geometry "${boundedText(geometryType, 80)}"; Issue #19 accepts Point only.`);
  }
  let coordinates;
  try {
    coordinates = validateWgs84Point(value.geometry.coordinates);
  } catch (error) {
    fail(`Feature ${index + 1} has invalid Point coordinates: ${error instanceof Error ? error.message : 'invalid coordinate value'}`);
  }

  const properties = readProperties(value.properties, index);
  const name = properties.name === undefined
    ? `Imported Feature ${index + 1}`
    : readBoundedString(properties.name, `Feature ${index + 1} name`);
  const description = properties.description === undefined
    ? undefined
    : readBoundedString(properties.description, `Feature ${index + 1} description`);
  const layerId = properties.layerId === undefined
    ? layers[0]?.id
     : readBoundedString(properties.layerId, `Feature ${index + 1} layerId`, MAX_FEATURE_ID_LENGTH);
  if (!layerId || !layers.some(layer => layer.id === layerId)) {
    fail(`Feature ${index + 1} references an unknown layer; no fallback layer was guessed.`);
  }
  if (properties.visible !== undefined && typeof properties.visible !== 'boolean') {
    fail(`Feature ${index + 1} visible must be boolean.`);
  }
  if (properties.lineage !== undefined && !isFeatureLineage(properties.lineage)) {
    fail(`Feature ${index + 1} lineage must be authored, imported, or derived.`);
  }
  if (properties.provenance !== undefined) assertSupportedProvenance(properties.provenance, `Feature ${index + 1} provenance`);

  const rawStatus = properties.validationStatus;
  const validationStatus = normalizeValidationStatus(rawStatus);
  const rawProvenance = properties.provenance === undefined
    ? null
    : normalizeProvenance(properties.provenance);
  if (properties.provenance !== undefined && !rawProvenance) {
    fail(`Feature ${index + 1} provenance must include method, source, units, and limitations.`);
  }
  const lineage: FeatureLineage = applicationExport && isFeatureLineage(properties.lineage)
    ? properties.lineage
    : 'imported';
  const provenance = appendImportContext(rawProvenance || defaultProvenance(lineage), applicationExport);
  if (typeof rawStatus === 'string' && rawStatus !== validationStatus) {
    provenance.importedValidationStatus = boundedText(rawStatus, 120);
  }

  return {
    id: readFeatureId(value.id, index),
    type: 'Point',
    coordinates,
    name,
    ...(description === undefined ? {} : { description }),
    layerId,
    visible: properties.visible !== false,
    lineage,
    validationStatus,
    provenance,
  };
}

export function importGeoJsonText(text: string, layers: readonly FeatureLayer[]): PointFeature[] {
  if (text.length > GEOJSON_MAX_TEXT_LENGTH) fail(`GeoJSON exceeds the ${GEOJSON_MAX_TEXT_LENGTH}-character limit.`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    fail('GeoJSON is not valid JSON.');
  }
  if (!isRecord(parsed) || parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    fail('Expected a GeoJSON FeatureCollection with a features array.');
  }
  const document = parsed as unknown as GeoJsonFeatureCollection;
  if (document.features.length === 0) fail('GeoJSON FeatureCollection contains no features.');
  const applicationExport = isApplicationExport(document);
  const imported = document.features.map((feature, index) => readPointFeature(feature, index, layers, applicationExport));
  const ids = new Set<string>();
  for (const feature of imported) {
    if (ids.has(feature.id)) {
      fail(`Feature id "${boundedText(feature.id, 120)}" is duplicated; import was rejected without changing app state.`);
    }
    ids.add(feature.id);
  }
  return imported;
}

export function exportGeoJson(features: readonly PointFeature[]): string {
  const document = {
    type: 'FeatureCollection' as const,
    metadata: {
      format: GEOJSON_EXPORT_FORMAT,
      version: GEOJSON_EXPORT_VERSION,
      generator: 'City Map Tools',
    },
    features: features.map(feature => ({
      type: 'Feature' as const,
      id: feature.id,
      geometry: { type: 'Point' as const, coordinates: feature.coordinates },
      properties: {
        name: feature.name,
        ...(feature.description === undefined ? {} : { description: feature.description }),
        layerId: feature.layerId,
        visible: feature.visible,
        lineage: feature.lineage,
        validationStatus: feature.validationStatus,
        provenance: feature.provenance,
      },
    })),
  };
  return JSON.stringify(document, null, 2);
}
