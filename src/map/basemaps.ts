import type { StyleSpecification } from 'maplibre-gl';

export type BasemapId = 'osm' | 'voyager';
export type CredentialPolicy = 'none' | 'runtime-BYOK-required';
export type BuildingCapability = 'unavailable' | 'requires-loaded-style-evidence';

export interface BasemapDescriptor {
  id: BasemapId;
  label: string;
  provider: string;
  kind: 'raster' | 'vector';
  attribution: string;
  policyUrl: string;
  keyInfoUrl?: string;
  note: string;
  credentialPolicy: CredentialPolicy;
  bulk: false;
  offline: false;
  prefetch: false;
  buildings: BuildingCapability;
  terrain: 'unavailable';
  styleResolution: 'inline-raster' | 'keyed-remote-style';
  styleEndpoint: string;
}

const osmTileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const voyagerStyleUrl = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const cartoHost = 'basemaps.cartocdn.com';
const cartoResourceHosts = new Set([
  cartoHost,
  `tiles.${cartoHost}`,
  ...['a', 'b', 'c', 'd'].map(subdomain => `${subdomain}.${cartoHost}`),
]);

export function isCartoBasemapHost(hostname: string): boolean {
  return hostname === cartoHost || hostname.endsWith(`.${cartoHost}`);
}

export const basemaps: Record<BasemapId, BasemapDescriptor> = {
  osm: {
    id: 'osm',
    label: 'OpenStreetMap · Raster',
    provider: 'OpenStreetMap Foundation',
    kind: 'raster',
    attribution: '© OpenStreetMap contributors',
    policyUrl: 'https://operations.osmfoundation.org/policies/tiles/',
    note: 'Community tiles, best-effort availability with no SLA. No bulk download, offline use, or prefetch.',
    credentialPolicy: 'none',
    bulk: false,
    offline: false,
    prefetch: false,
    buildings: 'unavailable',
    terrain: 'unavailable',
    styleResolution: 'inline-raster',
    styleEndpoint: osmTileUrl,
  },
  voyager: {
    id: 'voyager',
    label: 'CARTO Voyager · Vector',
    provider: 'CARTO',
    kind: 'vector',
    attribution: '© OpenStreetMap contributors, © CARTO',
    policyUrl: 'https://carto.com/legal/basemap-terms/',
    keyInfoUrl: 'https://carto.com/basemaps/apikey/',
    note: 'Optional CARTO service. Access can fail or be rate-limited; coverage and provider terms apply.',
    credentialPolicy: 'runtime-BYOK-required',
    bulk: false,
    offline: false,
    prefetch: false,
    buildings: 'requires-loaded-style-evidence',
    terrain: 'unavailable',
    styleResolution: 'keyed-remote-style',
    styleEndpoint: voyagerStyleUrl,
  },
};

export function hasRuntimeCredential(credential: string | null | undefined): boolean {
  return typeof credential === 'string' && credential.trim().length > 0;
}

export function resolveBasemapStyle(id: BasemapId, credential?: string | null): string | StyleSpecification {
  if (id === 'osm') {
    return {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: [osmTileUrl],
          tileSize: 256,
          maxzoom: 19,
          attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    };
  }
  if (!hasRuntimeCredential(credential)) throw new Error('CARTO Basemaps API key required.');
  return cartoRequestUrl(voyagerStyleUrl, credential!);
}

// The sole boundary that adds a runtime key to CARTO style, tile, glyph and
// sprite URLs. MapLibre may resolve nested style URLs without inheriting the
// style query string, so every CARTO resource is handled here.
export function cartoRequestUrl(url: string, credential: string): string {
  if (!hasRuntimeCredential(credential)) throw new Error('CARTO Basemaps API key required.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !cartoResourceHosts.has(parsed.hostname)) {
    throw new Error('Unexpected CARTO resource endpoint.');
  }
  parsed.searchParams.set('key', credential.trim());
  return parsed.toString();
}

// This is an intentionally inactive contract for a future optional service.
// Public Nominatim is not activated: its usage policy restricts capacity,
// forbids autocomplete, and requires a deliberate provider choice.
export interface OptionalProviderService {
  provider: string;
  capability: 'geocoding';
  endpoint: string;
  attribution: string;
  credentialPolicy: CredentialPolicy;
  timeoutMs: number;
  cancellation: 'AbortSignal';
  status: 'inactive' | 'available' | 'credential-required' | 'unavailable' | 'rate-limited' | 'quota-exceeded' | 'timeout' | 'provider-error';
}
