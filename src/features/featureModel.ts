export const POINT_LAYER_ID = 'layer-points';
export const MAX_TEXT_LENGTH = 500;

export const VALIDATION_STATUSES = [
  'Validated',
  'Functional but unvalidated',
  'Experimental',
  'Stale',
] as const;

export type ValidationStatus = typeof VALIDATION_STATUSES[number];
export type FeatureLineage = 'authored' | 'imported' | 'derived';
export type Wgs84Point = [longitude: number, latitude: number];

export interface DerivedFrom {
  id?: string;
  name?: string;
  validationStatus?: ValidationStatus;
  provenance?: Provenance;
}

export interface Provenance {
  method: string;
  source: string;
  units: string;
  limitations: string;
  importedValidationStatus?: string;
  importChain?: string[];
  derivedFrom?: DerivedFrom;
}

export interface PointFeature {
  id: string;
  type: 'Point';
  coordinates: Wgs84Point;
  name: string;
  description?: string;
  layerId: string;
  visible: boolean;
  lineage: FeatureLineage;
  validationStatus: ValidationStatus;
  provenance: Provenance;
}

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

export function createDefaultLayers(): FeatureLayer[] {
  return [{ ...defaultPointLayer }];
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

export function defaultProvenance(lineage: FeatureLineage): Provenance {
  if (lineage === 'authored') {
    return {
      method: 'User-authored annotation',
      source: 'User input',
      units: 'WGS84 longitude/latitude',
      limitations: 'Not a validated engineering result',
    };
  }
  return {
    method: 'GeoJSON import',
    source: 'Imported GeoJSON',
    units: 'WGS84 longitude/latitude',
    limitations: 'Imported values are not validated by City Map Tools',
  };
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
    if (isValidationStatus(value.derivedFrom.validationStatus)) {
      derivedFrom.validationStatus = value.derivedFrom.validationStatus;
    }
    const parentProvenance = normalizeProvenance(value.derivedFrom.provenance, depth + 1);
    if (parentProvenance) derivedFrom.provenance = parentProvenance;
    if (Object.keys(derivedFrom).length > 0) normalized.derivedFrom = derivedFrom;
  }

  return normalized;
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

export function createAuthoredPoint(id: string, coordinates: Wgs84Point, index: number): PointFeature {
  return {
    id,
    type: 'Point',
    coordinates,
    name: `Point ${index}`,
    layerId: POINT_LAYER_ID,
    visible: true,
    lineage: 'authored',
    validationStatus: 'Functional but unvalidated',
    provenance: defaultProvenance('authored'),
  };
}

export function renamePoint(feature: PointFeature, name: string): PointFeature {
  return { ...feature, name: name.length > 0 ? boundedText(name) : 'Untitled point' };
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
  existing: readonly PointFeature[],
): PointFeature[] {
  const used = new Set(existing.map(feature => feature.id));
  const idMap = new Map<string, string>();
  const resolvedIds = imported.map(feature => {
    let id = feature.id;
    let suffix = 2;
    while (used.has(id)) {
      id = `${feature.id}-${suffix}`;
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
  existing: readonly PointFeature[],
): { features: PointFeature[]; selectedFeatureId: string | null } {
  const inserted = resolveImportedFeatures(imported, existing);
  return {
    features: [...existing, ...inserted],
    selectedFeatureId: inserted[0]?.id || null,
  };
}
