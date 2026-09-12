import { useEffect, useRef, useState } from 'react';
import { basemaps } from './basemaps';
import type { BasemapId } from './basemaps';
import { createMap, initialMapState } from './createMap';

export function MapCanvas() {
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof createMap> | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>('osm');
  const [state, setState] = useState(initialMapState);

  useEffect(() => {
    if (!container.current) return;
    try {
      controller.current = createMap(container.current, setState);
    } catch {
      setState({ ...initialMapState, phase: 'error', message: 'The map could not start. Check WebGL support and reload the map.', buildingReason: '3D unavailable: map initialization failed.' });
    }
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);

  return (
    <section className="map-workspace" aria-label="Map workspace">
      <aside className="map-controls" aria-label="Basemap controls">
        <label htmlFor="basemap">Basemap</label>
        <select id="basemap" value={basemap} onChange={event => {
          const id = event.target.value;
          if (id !== 'osm' && id !== 'voyager') return;
          setBasemap(id);
          controller.current?.setBasemap(id);
        }}>
          {Object.entries(basemaps).map(([id, option]) => <option key={id} value={id}>{option.label}</option>)}
        </select>
        <div className={`map-status ${state.phase}`} role="status" aria-live="polite">
          <strong>{state.phase === 'error' ? 'Map unavailable' : state.phase === 'loading' ? 'Loading' : 'Ready'}</strong>
          <p>{state.message}</p>
        </div>
        <div className="building-control">
          <button disabled={state.phase !== 'ready' || state.buildings === 'unavailable'}
            aria-pressed={state.buildings === 'on'} aria-describedby="building-reason"
            onClick={() => controller.current?.toggleBuildings()}>
            3D Buildings · {state.buildings === 'unavailable' ? 'Unavailable' : state.buildings === 'on' ? 'On' : 'Off'}
          </button>
          <p id="building-reason">{state.buildingReason}</p>
        </div>
        <details>
          <summary>Provider &amp; map notes</summary>
          <p>{basemaps[basemap].note} <a href={basemaps[basemap].policyUrl} target="_blank" rel="noreferrer">Usage policy</a></p>
          <p>Online basemap requests go to the selected provider. No API key or project storage is used.</p>
          <p>Coordinates: WGS84 longitude/latitude. Map display: Web Mercator. Scale is approximate; no metric analysis is performed.</p>
        </details>
        <output className="map-position" aria-label="Map position">
          {Math.abs(state.longitude).toFixed(5)}° {state.longitude < 0 ? 'W' : 'E'}, {Math.abs(state.latitude).toFixed(5)}° {state.latitude < 0 ? 'S' : 'N'} · Zoom {state.zoom.toFixed(1)}
        </output>
      </aside>
      <div ref={container} className="map-canvas" aria-label="Interactive map" />
    </section>
  );
}
