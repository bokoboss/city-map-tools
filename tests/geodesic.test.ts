import assert from 'node:assert/strict';
import {
  GEODESIC_METHOD,
  geodesicLineLength,
  geodesicPolygonMetrics,
  inverseGeodesic,
} from '../src/spatial/geodesic';
import type { Wgs84LineString, Wgs84Point, Wgs84Polygon } from '../src/features/featureModel';

function closeTo(actual: number, expected: number, tolerance: number): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`);
}

assert.equal(Object.isFrozen(GEODESIC_METHOD), true);
assert.equal(GEODESIC_METHOD.library, 'geographiclib-geodesic@2.2.0');
assert.equal(GEODESIC_METHOD.ellipsoid, 'WGS84');
assert.equal(GEODESIC_METHOD.distanceUnit, 'm');
assert.equal(GEODESIC_METHOD.perimeterUnit, 'm');
assert.equal(GEODESIC_METHOD.areaUnit, 'm²');

// GeographicLib 2.2.0 official documentation, rounded to the nearest millimetre.
const global = inverseGeodesic([174.81, -41.32], [-5.50, 40.96]);
closeTo(global.distanceMeters, 19_959_679.267, 0.001);

// Independent WGS84 GeographicLib reference computations frozen in Issue #41 comment 5857245478.
const bangkokStart: Wgs84Point = [100.5018, 13.7563];
const bangkokEnd: Wgs84Point = [100.5350, 13.7650];
const bangkok = inverseGeodesic(bangkokStart, bangkokEnd);
closeTo(bangkok.distanceMeters, 3717.1938537033648, 0.000001);
assert.notEqual(bangkok.initialBearingDegrees, null);
closeTo(bangkok.initialBearingDegrees!, 74.9886720611913, 0.000000001);

const antimeridian = inverseGeodesic([179.9, 0], [-179.9, 0]);
closeTo(antimeridian.distanceMeters, 22263.898158653446, 0.000001);
assert.equal(antimeridian.initialBearingDegrees, 90);
assert.equal(inverseGeodesic([0, 0], [-1, 0]).initialBearingDegrees, 270);

assert.deepEqual(inverseGeodesic(bangkokStart, bangkokStart), {
  distanceMeters: 0,
  initialBearingDegrees: null,
});
assert.deepEqual(inverseGeodesic([180, 0], [-180, 0]), {
  distanceMeters: 0,
  initialBearingDegrees: null,
});

const line: Wgs84LineString = [bangkokStart, bangkokEnd, [100.54, 13.77]];
const expectedLineMeters = inverseGeodesic(line[0]!, line[1]!).distanceMeters +
  inverseGeodesic(line[1]!, line[2]!).distanceMeters;
assert.equal(geodesicLineLength(line), expectedLineMeters);

const ring: Wgs84Point[] = [
  [100.50, 13.75],
  [100.51, 13.75],
  [100.51, 13.76],
  [100.50, 13.76],
  [100.50, 13.75],
];
const polygon: Wgs84Polygon = [ring];
const metrics = geodesicPolygonMetrics(polygon);
closeTo(metrics.perimeterMeters, 4375.690804507745, 0.000001);
closeTo(metrics.areaSquareMeters, 1196511.9269070625, 0.0001);
const reversed = geodesicPolygonMetrics([[...ring].reverse()]);
closeTo(reversed.perimeterMeters, metrics.perimeterMeters, 0.000001);
closeTo(reversed.areaSquareMeters, metrics.areaSquareMeters, 0.0001);

assert.throws(() => inverseGeodesic([181, 13], bangkokEnd), /valid WGS84/);
assert.throws(() => inverseGeodesic([100, -91], bangkokEnd), /valid WGS84/);
assert.throws(() => inverseGeodesic([Number.NaN, 0], bangkokEnd), /finite numbers/);
assert.throws(() => inverseGeodesic(bangkokStart, [Number.POSITIVE_INFINITY, 0]), /finite numbers/);
assert.throws(() => geodesicLineLength([bangkokStart]), /at least 2/);
assert.throws(() => geodesicLineLength([bangkokStart, [200, 0]]), /valid WGS84/);
assert.throws(() => geodesicPolygonMetrics([[...ring.slice(0, -1)]]), /explicitly closed/);
assert.throws(() => geodesicPolygonMetrics([[[100, 0], [100, 0], [100, 0], [100, 0]]]), /3 distinct/);
assert.throws(() => geodesicPolygonMetrics([[[100, 0], [101, 0], [101, Number.NaN], [100, 0]]]), /finite numbers/);

console.log('PASS WGS84 geodesic inverse, line, polygon, metadata, and fail-closed reference fixtures');
