import { expect, test } from '@playwright/test';

test('Vite-bundled GeographicLib kernel executes WGS84 references in Chromium', async ({ page }) => {
  await page.goto('./');
  const actual = await page.evaluate(async () => {
    const kernel = await import('/city-map-tools/__geodesic_probe.mjs');
    return {
      inverse: kernel.inverseGeodesic([100.5018, 13.7563], [100.5350, 13.7650]),
      polygon: kernel.geodesicPolygonMetrics([[[100.50, 13.75], [100.51, 13.75],
        [100.51, 13.76], [100.50, 13.76], [100.50, 13.75]]]),
    };
  });

  expect(Math.abs(actual.inverse.distanceMeters - 3717.1938537033648)).toBeLessThanOrEqual(0.000001);
  expect(Math.abs(actual.inverse.initialBearingDegrees! - 74.9886720611913)).toBeLessThanOrEqual(0.000000001);
  expect(Math.abs(actual.polygon.perimeterMeters - 4375.690804507745)).toBeLessThanOrEqual(0.000001);
  expect(Math.abs(actual.polygon.areaSquareMeters - 1196511.9269070625)).toBeLessThanOrEqual(0.0001);
});
