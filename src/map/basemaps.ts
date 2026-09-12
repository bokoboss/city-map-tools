import type { StyleSpecification } from 'maplibre-gl';

export type BasemapId = 'osm' | 'voyager';

export const basemaps: Record<BasemapId, {
  label: string;
  style: string | StyleSpecification;
  note: string;
  policyUrl: string;
}> = {
  osm: {
    label: 'OpenStreetMap · Raster',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          maxzoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    note: 'Community tiles, best-effort availability. No bulk download or offline prefetch.',
    policyUrl: 'https://operations.osmfoundation.org/policies/tiles/',
  },
  voyager: {
    label: 'CARTO Voyager · Vector',
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    note: 'External CARTO basemap, best-effort availability. Provider terms and data coverage apply.',
    policyUrl: 'https://carto.com/legal/',
  },
};
