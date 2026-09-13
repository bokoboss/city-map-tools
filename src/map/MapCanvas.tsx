import { useEffect, useRef, useState } from 'react';
import { basemaps } from './basemaps';
import type { BasemapId } from './basemaps';
import { createMap, initialMapState } from './createMap';
import type { FeatureLayer, PointFeature, Wgs84Point } from '../features/featureModel';

export type EditorMode = 'select' | 'create';

interface MapCanvasProps {
  features: readonly PointFeature[];
  layers: readonly FeatureLayer[];
  selectedFeatureId: string | null;
  mode: EditorMode;
  importStatus: string;
  onModeChange: (mode: EditorMode) => void;
  onPointSelect: (id: string) => void;
  onMapPointClick: (coordinates: Wgs84Point) => void;
  onLayerVisibilityChange: (id: string) => void;
  onFeatureVisibilityChange: (id: string) => void;
  onFeatureSelect: (id: string) => void;
  onFeatureRename: (id: string, name: string) => void;
  onImportFile: (file: File) => void;
  onExport: () => void;
}

export function MapCanvas({
  features,
  layers,
  selectedFeatureId,
  mode,
  importStatus,
  onModeChange,
  onPointSelect,
  onMapPointClick,
  onLayerVisibilityChange,
  onFeatureVisibilityChange,
  onFeatureSelect,
  onFeatureRename,
  onImportFile,
  onExport,
}: MapCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof createMap> | null>(null);
  const pointSelectRef = useRef(onPointSelect);
  const mapClickRef = useRef(onMapPointClick);
  const [basemap, setBasemap] = useState<BasemapId>('osm');
  const [state, setState] = useState(initialMapState);

  pointSelectRef.current = onPointSelect;
  mapClickRef.current = onMapPointClick;

  useEffect(() => {
    if (!container.current) return;
    try {
      controller.current = createMap(
        container.current,
        setState,
        id => pointSelectRef.current(id),
        coordinates => mapClickRef.current(coordinates),
      );
    } catch {
      setState({ ...initialMapState, phase: 'error', message: 'The map could not start. Check WebGL support and reload the map.', buildingReason: '3D unavailable: map initialization failed.' });
    }
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    const visibleLayers = new Map(layers.map(layer => [layer.id, layer.visible]));
    controller.current?.setPointOverlays(features.map(feature => ({
      id: feature.id,
      coordinates: feature.coordinates,
      name: feature.name,
      visible: feature.visible,
      layerVisible: visibleLayers.get(feature.layerId) === true,
      color: layers.find(layer => layer.id === feature.layerId)?.color || '#f43f5e',
      selected: feature.id === selectedFeatureId,
    })));
  }, [features, layers, selectedFeatureId]);

  const selectedFeature = features.find(feature => feature.id === selectedFeatureId);

  return (
    <section className="map-workspace" aria-label="Map workspace">
      <aside className="map-controls" aria-label="Map and feature controls">
        <section className="editor-tools" aria-label="Feature tools">
          <h2>Feature tools</h2>
          <div className="mode-buttons">
            <button type="button" aria-pressed={mode === 'select'} onClick={() => onModeChange('select')}>Select</button>
            <button type="button" aria-pressed={mode === 'create'} onClick={() => onModeChange('create')}>Create point</button>
          </div>
          <p className="control-help">{mode === 'create' ? 'Click the map to add a WGS84 Point.' : 'Select a point marker or feature from the layer list.'}</p>
          <div className="file-actions">
            <label className="file-button">
              Import GeoJSON
              <input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={event => {
                const file = event.target.files?.[0];
                if (file) onImportFile(file);
                event.target.value = '';
              }} />
            </label>
            <button type="button" onClick={onExport} disabled={features.length === 0}>Export GeoJSON</button>
          </div>
          <output className="import-status" aria-live="polite">{importStatus}</output>
        </section>

        <section className="layer-panel" aria-label="Layers">
          <h2>Layers</h2>
          {layers.map(layer => {
            const layerFeatures = features.filter(feature => feature.layerId === layer.id);
            return (
              <div className="layer-card" key={layer.id}>
                <div className="layer-header">
                  <span className="layer-name"><span className="layer-color" style={{ backgroundColor: layer.color }} />{layer.name} <span className="feature-count">({layerFeatures.length})</span></span>
                  <button
                    type="button"
                    className="visibility-button"
                    aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name} layer`}
                    aria-pressed={layer.visible}
                    data-layer-id={layer.id}
                    onClick={() => onLayerVisibilityChange(layer.id)}
                  >{layer.visible ? 'Visible' : 'Hidden'}</button>
                </div>
                {layerFeatures.length > 0 && <ul className="feature-list">
                  {layerFeatures.map(feature => <li key={feature.id}>
                    <button type="button" className={`feature-row ${feature.id === selectedFeatureId ? 'selected' : ''}`} onClick={() => onFeatureSelect(feature.id)}>
                      <span className="feature-row-name">{feature.name}</span>
                      <span className="feature-row-lineage">{feature.lineage}</span>
                    </button>
                    <button
                      type="button"
                      className="feature-visibility"
                      aria-label={`${feature.visible ? 'Hide' : 'Show'} ${feature.name}`}
                      aria-pressed={feature.visible}
                      onClick={() => onFeatureVisibilityChange(feature.id)}
                    >{feature.visible ? 'On' : 'Off'}</button>
                  </li>)}
                </ul>}
              </div>
            );
          })}
        </section>

        {selectedFeature && <section className="inspector" aria-label="Feature inspector">
          <h2>Inspector</h2>
          <p className="inspector-id">{selectedFeature.id}</p>
          <label htmlFor="feature-name">Name</label>
          <input id="feature-name" value={selectedFeature.name} maxLength={500} onChange={event => onFeatureRename(selectedFeature.id, event.target.value)} />
          <output className="stored-value" aria-label="Stored feature name">Stored value: {selectedFeature.name}</output>
          {selectedFeature.description !== undefined && <div className="inspector-field"><span>Description</span><p>{selectedFeature.description}</p></div>}
          <div className="inspector-field"><span>Coordinates</span><output>[{selectedFeature.coordinates[0]}, {selectedFeature.coordinates[1]}]</output></div>
          <div className="inspector-field"><span>Lineage</span><output>{selectedFeature.lineage}</output></div>
          <div className="inspector-field"><span>Validation status</span><output>{selectedFeature.validationStatus}</output></div>
          <div className="inspector-field"><span>Provenance</span><p>{selectedFeature.provenance.method}; {selectedFeature.provenance.source}; {selectedFeature.provenance.limitations}</p></div>
        </section>}

        <section className="map-options" aria-label="Basemap controls">
          <h2>Basemap</h2>
          <label htmlFor="basemap">Provider</label>
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
        </section>
      </aside>
      <div ref={container} className="map-canvas" aria-label="Interactive map" />
    </section>
  );
}
