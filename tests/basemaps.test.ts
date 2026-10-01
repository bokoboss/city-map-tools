import assert from 'node:assert/strict';
import {
  basemaps,
  cartoRequestUrl,
  hasRuntimeCredential,
  resolveBasemapStyle,
  type OptionalProviderService,
} from '../src/map/basemaps';

const syntheticKey = 'synthetic-carto-key-for-test-only';
assert.deepEqual(Object.keys(basemaps), ['osm', 'voyager']);
assert.equal(basemaps.osm.id, 'osm');
assert.equal(basemaps.osm.provider, 'OpenStreetMap Foundation');
assert.equal(basemaps.osm.kind, 'raster');
assert.equal(basemaps.osm.credentialPolicy, 'none');
assert.deepEqual([basemaps.osm.bulk, basemaps.osm.offline, basemaps.osm.prefetch], [false, false, false]);
assert.equal(basemaps.osm.buildings, 'unavailable');
assert.equal(basemaps.osm.terrain, 'unavailable');
assert.equal(basemaps.osm.styleResolution, 'inline-raster');
assert.match(basemaps.osm.attribution, /OpenStreetMap contributors/);
assert.match(basemaps.osm.note, /No bulk download, offline use, or prefetch/);
assert.equal(basemaps.osm.policyUrl, 'https://operations.osmfoundation.org/policies/tiles/');
const osmStyle = resolveBasemapStyle('osm');
assert.equal(typeof osmStyle, 'object');
assert.equal(osmStyle.sources.osm.type, 'raster');
assert.deepEqual(osmStyle.sources.osm.tiles, ['https://tile.openstreetmap.org/{z}/{x}/{y}.png']);
assert.ok(!JSON.stringify(osmStyle).includes('key='));

assert.equal(basemaps.voyager.id, 'voyager');
assert.equal(basemaps.voyager.provider, 'CARTO');
assert.equal(basemaps.voyager.kind, 'vector');
assert.equal(basemaps.voyager.credentialPolicy, 'runtime-BYOK-required');
assert.equal(basemaps.voyager.buildings, 'requires-loaded-style-evidence');
assert.equal(basemaps.voyager.terrain, 'unavailable');
assert.equal(basemaps.voyager.styleResolution, 'keyed-remote-style');
assert.match(basemaps.voyager.attribution, /OpenStreetMap contributors.*CARTO/);
assert.equal(basemaps.voyager.policyUrl, 'https://carto.com/legal/basemap-terms/');
assert.equal(basemaps.voyager.keyInfoUrl, 'https://carto.com/basemaps/apikey/');
assert.equal(hasRuntimeCredential(null), false);
assert.equal(hasRuntimeCredential('  '), false);
assert.equal(hasRuntimeCredential(syntheticKey), true);
assert.throws(() => resolveBasemapStyle('voyager'), /key required/);
assert.throws(() => resolveBasemapStyle('voyager', '   '), /key required/);
assert.equal(resolveBasemapStyle('voyager', syntheticKey),
  `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?key=${syntheticKey}`);
assert.equal(cartoRequestUrl('https://basemaps.cartocdn.com/fonts/0.pbf?language=en', syntheticKey),
  `https://basemaps.cartocdn.com/fonts/0.pbf?language=en&key=${syntheticKey}`);
assert.throws(() => cartoRequestUrl('https://example.com/style.json', syntheticKey), /Unexpected CARTO/);

const futureService: OptionalProviderService = {
  provider: 'Example geocoder', capability: 'geocoding', endpoint: 'https://example.com/geocode',
  attribution: 'Example', credentialPolicy: 'runtime-BYOK-required', timeoutMs: 5000,
  cancellation: 'AbortSignal', status: 'rate-limited',
};
assert.equal(futureService.status, 'rate-limited');
console.log('PASS bounded basemap descriptors, credential resolution, nested CARTO requests, and inactive service contract');
