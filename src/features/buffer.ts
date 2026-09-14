import turfBuffer from '@turf/buffer';
import {
  BUFFER_LAYER_ID,
  geometrySnapshot,
  type GeometrySnapshot,
  type PolygonFeature,
  type SpatialFeature,
  type Wgs84Point,
  type Wgs84Polygon,
  validateWgs84Polygon,
} from './featureModel';

export const BUFFER_RADIUS_MIN_METERS = 1;
// Operational safety bound for this low-volume annotation tool, not an engineering standard.
export const BUFFER_RADIUS_MAX_METERS = 10_000;
export const BUFFER_STEPS = 8;
export const BUFFER_LIBRARY_VERSION = '7.4.0';

export class BufferDerivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BufferDerivationError';
  }
}

interface BufferInputFeature {
  type: 'Feature';
  properties: Record<string, never>;
  geometry: GeometrySnapshot;
}

interface BufferOutputFeature {
  type: 'Feature';
  geometry?: { type?: unknown; coordinates?: unknown } | null;
}

export type BufferImplementation = (
  feature: BufferInputFeature,
  radius: number,
  options: { units: 'meters'; steps: number },
) => BufferOutputFeature | undefined;

function fail(message: string): never {
  throw new BufferDerivationError(message);
}

function pointsInGeometry(geometry: GeometrySnapshot): Wgs84Point[] {
  if (geometry.type === 'Point') return [geometry.coordinates as Wgs84Point];
  if (geometry.type === 'LineString') return geometry.coordinates as Wgs84Point[];
  return (geometry.coordinates as Wgs84Polygon)[0];
}

export function longitudeSpan(geometry: GeometrySnapshot): number {
  const points = pointsInGeometry(geometry);
  const longitudes = points.map(point => point[0]);
  const minimum = Math.min(...longitudes);
  const maximum = Math.max(...longitudes);
  return maximum - minimum;
}

export function assertSupportedBufferSource(source: SpatialFeature, radius: number): GeometrySnapshot {
  if (source.lineage === 'derived') {
    fail('Derived buffers cannot be used as buffer sources in this slice.');
  }
  if (!Number.isFinite(radius) || radius < BUFFER_RADIUS_MIN_METERS || radius > BUFFER_RADIUS_MAX_METERS) {
    fail(`Buffer radius must be between ${BUFFER_RADIUS_MIN_METERS} and ${BUFFER_RADIUS_MAX_METERS} meters; this is an operational safety bound, not an engineering standard.`);
  }
  const geometry = geometrySnapshot(source);
  if (longitudeSpan(geometry) > 180) {
    fail('Buffer source crosses an unsupported antimeridian/pathological longitude span and was not processed.');
  }
  return geometry;
}

export function validateBufferResult(result: unknown): Wgs84Polygon {
  if (!result || typeof result !== 'object' || (result as BufferOutputFeature).type !== 'Feature') {
    fail('Turf buffer returned no supported feature; workspace state was unchanged.');
  }
  const geometry = (result as BufferOutputFeature).geometry;
  if (!geometry || geometry.type === undefined) {
    fail('Turf buffer returned no supported geometry; workspace state was unchanged.');
  }
  if (geometry.type !== 'Polygon') {
    fail(`Turf buffer returned unsupported ${typeof geometry.type === 'string' ? geometry.type : 'geometry'} output; only Polygon is supported in this slice.`);
  }
  let coordinates: Wgs84Polygon;
  try {
    coordinates = validateWgs84Polygon(geometry.coordinates);
  } catch (error) {
    fail(`Turf buffer returned invalid Polygon coordinates; workspace state was unchanged. ${error instanceof Error ? error.message : ''}`.trim());
  }
  if (longitudeSpan({ type: 'Polygon', coordinates }) > 180) {
    fail('Turf buffer returned an unsupported antimeridian/pathological Polygon; workspace state was unchanged.');
  }
  return coordinates;
}

function toBufferInput(geometry: GeometrySnapshot): BufferInputFeature {
  return { type: 'Feature', properties: {}, geometry };
}

export function deriveBufferFeature(
  source: SpatialFeature,
  id: string,
  radius: number,
  implementation: BufferImplementation = turfBuffer as unknown as BufferImplementation,
): PolygonFeature {
  const sourceGeometry = assertSupportedBufferSource(source, radius);
  const result = implementation(toBufferInput(sourceGeometry), radius, { units: 'meters', steps: BUFFER_STEPS });
  const coordinates = validateBufferResult(result);
  return {
    id,
    type: 'Polygon',
    coordinates,
    name: `${source.name} buffer`,
    layerId: BUFFER_LAYER_ID,
    visible: true,
    lineage: 'derived',
    validationStatus: 'Functional but unvalidated',
    provenance: {
      method: 'Turf buffer (derived spatial output)',
      source: `${source.type} ${source.id}`,
      units: 'WGS84 longitude/latitude; buffer radius in meters',
      limitations: 'Derived, unvalidated spatial output. Turf buffer is not surveyed or validated engineering geometry. Antimeridian and MultiPolygon output are fail-closed in this slice.',
      derivedFrom: {
        id: source.id,
        name: source.name,
        type: source.type,
        geometry: sourceGeometry,
        validationStatus: source.validationStatus,
        provenance: source.provenance,
      },
      buffer: {
        library: '@turf/buffer',
        libraryVersion: BUFFER_LIBRARY_VERSION,
        radius,
        units: 'meters',
        steps: BUFFER_STEPS,
      },
    },
  };
}
