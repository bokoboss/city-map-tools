import { Map, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl';
import type { ExpressionSpecification } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { basemaps } from './basemaps';
import type { BasemapId } from './basemaps';

// Vite must bundle the worker's shared imports into the production worker asset.
setWorkerUrl(workerUrl);

export interface MapState {
  phase: 'loading' | 'ready' | 'error';
  message: string;
  buildings: 'unavailable' | 'off' | 'on';
  buildingReason: string;
  longitude: number;
  latitude: number;
  zoom: number;
}

export const initialMapState: MapState = {
  phase: 'loading',
  message: 'Loading basemap…',
  buildings: 'unavailable',
  buildingReason: 'Checking the selected basemap…',
  longitude: 100.5018,
  latitude: 13.7563,
  zoom: 14,
};

const buildingLayerId = 'city-map-buildings';

export function createMap(container: HTMLDivElement, onState: (state: MapState) => void) {
  let state = { ...initialMapState };
  let disposed = false;
  let loadingTimer: ReturnType<typeof setTimeout>;

  const publish = (patch: Partial<MapState>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    onState(state);
  };
  const isReady = () => state.phase === 'ready';

  const map = new Map({
    container,
    center: [state.longitude, state.latitude],
    zoom: state.zoom,
    style: basemaps.osm.style,
    attributionControl: { compact: false },
  });

  const fail = () => {
    clearTimeout(loadingTimer);
    if (disposed || state.phase === 'error') return;
    publish({
      phase: 'error',
      message: 'Basemap or map resource unavailable. Switch basemap or reload the map to retry.',
      buildings: 'unavailable',
      buildingReason: '3D unavailable while map resources have an error.',
    });
    // A failed provider must not leave visible 3D behind a disabled control.
    try {
      if (map.getLayer(buildingLayerId)) {
        map.setLayoutProperty(buildingLayerId, 'visibility', 'none');
      }
      map.jumpTo({ pitch: 0 });
    } catch {
      publish({ buildingReason: '3D unavailable: map rendering failed. Reload the map to clear the view.' });
    }
  };

  const startLoading = () => {
    clearTimeout(loadingTimer);
    publish({
      phase: 'loading', message: 'Loading basemap…', buildings: 'unavailable',
      buildingReason: 'Checking the selected basemap…',
    });
    loadingTimer = setTimeout(fail, 20000);
  };

  const configureBuildings = () => {
    const style = map.getStyle();
    const building = style.layers.find(layer =>
      layer.type === 'fill' && layer['source-layer'] === 'building' &&
      style.sources[layer.source]?.type === 'vector',
    );
    if (!building || building.type !== 'fill') {
      publish({ buildings: 'unavailable', buildingReason: '3D unavailable: this basemap has no compatible vector building source.' });
      return;
    }

    // Only provider-supplied numeric heights are extruded; missing heights stay absent.
    const height: ExpressionSpecification = ['number', ['get', 'render_height'], ['get', 'height'], 0];
    try {
      map.addLayer({
        id: buildingLayerId,
        type: 'fill-extrusion',
        source: building.source,
        'source-layer': building['source-layer'],
        minzoom: 14,
        filter: ['>', height, 0],
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': '#536b79',
          'fill-extrusion-height': height,
          'fill-extrusion-base': ['max', 0, ['number', ['get', 'render_min_height'], ['get', 'min_height'], 0]],
          'fill-extrusion-opacity': 0.8,
        },
      });
      if (state.phase !== 'error' && map.getLayer(buildingLayerId)) {
        publish({ buildings: 'off', buildingReason: 'Provider heights in metres, where supplied; zoom 14+. Visualization only, not surveyed or validated engineering data.' });
      }
    } catch {
      publish({ buildings: 'unavailable', buildingReason: '3D unavailable: the provider building layer could not be configured.' });
    }
  };

  map.on('error', fail);
  map.on('style.load', configureBuildings);
  map.on('idle', () => {
    // Do not let idle silently clear an error from a failed tile/style request.
    if (state.phase === 'loading' && map.areTilesLoaded()) {
      clearTimeout(loadingTimer);
      publish({ phase: 'ready', message: 'Map ready' });
    }
  });
  map.on('moveend', () => {
    const center = map.getCenter();
    publish({ longitude: center.lng, latitude: center.lat, zoom: map.getZoom() });
  });
  map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new ScaleControl({ unit: 'metric' }));
  const resizeObserver = new ResizeObserver(() => map.resize());
  resizeObserver.observe(container);
  startLoading();

  return {
    setBasemap(id: BasemapId) {
      startLoading();
      map.jumpTo({ pitch: 0 });
      try {
        // Full style replacement removes the previous style's custom 3D layer.
        map.setStyle(basemaps[id].style, { diff: false });
      } catch {
        fail();
      }
    },
    toggleBuildings() {
      if (!isReady() || state.buildings === 'unavailable') return;
      const enabled = state.buildings !== 'on';
      try {
        map.setLayoutProperty(buildingLayerId, 'visibility', enabled ? 'visible' : 'none');
        if (!isReady()) return;
        map.easeTo({ pitch: enabled ? 55 : 0 });
        publish({ buildings: enabled ? 'on' : 'off' });
      } catch {
        publish({ buildings: 'unavailable', buildingReason: '3D unavailable: the building layer could not be updated. Reload the map to retry.' });
      }
    },
    destroy() {
      disposed = true;
      clearTimeout(loadingTimer);
      resizeObserver.disconnect();
      map.remove();
    },
  };
}
