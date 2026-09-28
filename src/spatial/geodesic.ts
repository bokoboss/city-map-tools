import { Geodesic } from 'geographiclib-geodesic';
import {
  validateWgs84LineString,
  validateWgs84Point,
  validateWgs84Polygon,
  type Wgs84LineString,
  type Wgs84Point,
  type Wgs84Polygon,
} from '../features/featureModel';

export interface GeodesicInverseResult {
  distanceMeters: number;
  initialBearingDegrees: number | null;
}

export interface GeodesicPolygonMetrics {
  perimeterMeters: number;
  areaSquareMeters: number;
}

export const GEODESIC_METHOD = Object.freeze({
  id: 'wgs84-ellipsoidal-geodesic-v1',
  ellipsoid: 'WGS84',
  library: 'geographiclib-geodesic@2.2.0',
  distanceUnit: 'm',
  perimeterUnit: 'm',
  areaUnit: 'm²',
  azimuthConvention: 'Initial geodesic azimuth clockwise from true north, normalized to [0, 360) degrees',
} as const);

function finiteResult(value: number | undefined, field: string): number {
  if (value === undefined || !Number.isFinite(value)) {
    throw new Error(`GeographicLib returned an invalid ${field}.`);
  }
  return value;
}

export function inverseGeodesic(start: Wgs84Point, end: Wgs84Point): GeodesicInverseResult {
  const [startLongitude, startLatitude] = validateWgs84Point(start);
  const [endLongitude, endLatitude] = validateWgs84Point(end);
  // Project [longitude, latitude] -> GeographicLib (latitude, longitude).
  const result = Geodesic.WGS84.Inverse(startLatitude, startLongitude, endLatitude, endLongitude);
  const distanceMeters = finiteResult(result.s12, 'distance');
  if (distanceMeters < 0) throw new Error('GeographicLib returned a negative distance.');
  if (distanceMeters === 0) return { distanceMeters: 0, initialBearingDegrees: null };
  const azimuth = finiteResult(result.azi1, 'initial azimuth');
  const initialBearingDegrees = ((azimuth % 360) + 360) % 360;
  return { distanceMeters, initialBearingDegrees };
}

export function geodesicLineLength(coordinates: Wgs84LineString): number {
  const vertices = validateWgs84LineString(coordinates);
  let lengthMeters = 0;
  for (let index = 1; index < vertices.length; index += 1) {
    const start = vertices[index - 1];
    const end = vertices[index];
    if (!start || !end) throw new Error('LineString has a missing vertex.');
    lengthMeters += inverseGeodesic(start, end).distanceMeters;
  }
  return finiteResult(lengthMeters, 'line length');
}

export function geodesicPolygonMetrics(polygon: Wgs84Polygon): GeodesicPolygonMetrics {
  const [ring] = validateWgs84Polygon(polygon);
  if (!ring) throw new Error('Polygon has no exterior ring.');
  const accumulator = Geodesic.WGS84.Polygon(false);
  // The project ring repeats its first vertex at the end. GeographicLib closes it itself.
  for (const point of ring.slice(0, -1)) {
    const [longitude, latitude] = point;
    // Project [longitude, latitude] -> GeographicLib (latitude, longitude).
    accumulator.AddPoint(latitude, longitude);
  }
  const result = accumulator.Compute(false, true);
  const perimeterMeters = finiteResult(result.perimeter, 'polygon perimeter');
  const areaSquareMeters = Math.abs(finiteResult(result.area, 'polygon area'));
  if (perimeterMeters < 0) throw new Error('GeographicLib returned a negative perimeter.');
  return { perimeterMeters, areaSquareMeters };
}
