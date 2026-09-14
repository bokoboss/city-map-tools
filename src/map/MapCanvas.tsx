import { useEffect, useRef, useState } from 'react';
import { basemaps } from './basemaps';
import type { BasemapId } from './basemaps';
import { createMap, initialMapState } from './createMap';
import type { EditorMode } from './createMap';
import {
  POINT_LABEL_POSITIONS,
  POINT_MARKER_KINDS,
  POINT_MARKER_SIZES,
  pointPresentationFor,
} from './pointPresentation';
import type { PointMarkerKind, PointMarkerSize, PointPresentation } from './pointPresentation';
import {
  isLineStringFeature,
  isPointFeature,
  isPolygonFeature,
  type FeatureLayer,
  type GeometrySnapshot,
  type SpatialFeature,
  type Wgs84Point,
} from '../features/featureModel';

export type { EditorMode } from './createMap';

export interface OperationResult {
  ok: boolean;
  message: string;
}

interface MapCanvasProps {
  features: readonly SpatialFeature[];
  layers: readonly FeatureLayer[];
  selectedFeatureId: string | null;
  mode: EditorMode;
  importStatus: string;
  pointPresentations: Readonly<Record<string, PointPresentation>>;
  onModeChange: (mode: EditorMode) => void;
  onPointSelect: (id: string) => void;
  onMapPointClick: (coordinates: Wgs84Point) => void;
  onLayerVisibilityChange: (id: string) => void;
  onFeatureVisibilityChange: (id: string) => void;
  onFeatureSelect: (id: string | null) => void;
  onFeatureRename: (id: string, name: string) => void;
  onGeometryCreate: (geometry: GeometrySnapshot) => OperationResult;
  onGeometryApply: (id: string, geometry: GeometrySnapshot) => OperationResult;
  onFeatureDelete: (id: string) => OperationResult;
  onCreateBuffer: (id: string, radius: number) => OperationResult;
  onPointPresentationChange: (id: string, patch: Partial<PointPresentation>) => void;
  onImportFile: (file: File) => void;
  onExport: () => void;
}

function geometrySummary(feature: SpatialFeature): string {
  if (feature.type === 'Point') return `[${feature.coordinates[0]}, ${feature.coordinates[1]}]`;
  if (feature.type === 'LineString') return `${feature.coordinates.length} WGS84 vertices`;
  return `${feature.coordinates[0].length - 1} exterior WGS84 vertices; closed ring`;
}

function modeLabel(mode: EditorMode): string {
  if (mode === 'point') return 'Point mode: click the map to add one WGS84 Point.';
  if (mode === 'line') return 'Line mode: click vertices, then press Enter to finish. Escape cancels.';
  if (mode === 'polygon') return 'Polygon mode: click exterior vertices, then press Enter to finish. Escape cancels.';
  if (mode === 'editing') return 'Editing geometry draft: Apply commits it; Cancel restores the exact committed geometry.';
  return 'Select mode: choose a feature from the map or Layers.';
}

export function MapCanvas({
  features,
  layers,
  selectedFeatureId,
  mode,
  importStatus,
  pointPresentations,
  onModeChange,
  onPointSelect,
  onMapPointClick,
  onLayerVisibilityChange,
  onFeatureVisibilityChange,
  onFeatureSelect,
  onFeatureRename,
  onGeometryCreate,
  onGeometryApply,
  onFeatureDelete,
  onCreateBuffer,
  onPointPresentationChange,
  onImportFile,
  onExport,
}: MapCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<typeof createMap> | null>(null);
  const modeRef = useRef(mode);
  const preserveEditorStatusOnNextModeChange = useRef(false);
  const pointSelectRef = useRef(onPointSelect);
  const mapPointClickRef = useRef(onMapPointClick);
  const featureSelectRef = useRef(onFeatureSelect);
  const geometryCreateRef = useRef(onGeometryCreate);
  const [basemap, setBasemap] = useState<BasemapId>('osm');
  const [state, setState] = useState(initialMapState);
  const [editorStatus, setEditorStatus] = useState('Select mode: choose a feature from the map or Layers.');
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [bufferRadius, setBufferRadius] = useState('100');

  modeRef.current = mode;
  pointSelectRef.current = onPointSelect;
  mapPointClickRef.current = onMapPointClick;
  featureSelectRef.current = onFeatureSelect;
  geometryCreateRef.current = onGeometryCreate;

  useEffect(() => {
    if (!container.current) return;
    try {
      controller.current = createMap(container.current, {
        onState: setState,
        onPointSelect: id => pointSelectRef.current(id),
        onGeometrySelect: id => featureSelectRef.current(id),
        onMapPointClick: coordinates => mapPointClickRef.current(coordinates),
        onMapBackgroundClick: () => featureSelectRef.current(null),
        onGeometryFinish: geometry => {
          const result = geometryCreateRef.current(geometry);
          setEditorStatus(result.message);
          preserveEditorStatusOnNextModeChange.current = true;
          onModeChange('select');
        },
        onEditorError: message => {
          setEditorStatus(message);
          if ((modeRef.current === 'line' || modeRef.current === 'polygon') &&
              !controller.current?.hasActiveEditorSession()) {
            preserveEditorStatusOnNextModeChange.current = true;
            onModeChange('select');
          }
        },
        onBasemapBlocked: message => setEditorStatus(message),
      });
      if (modeRef.current !== 'editing') controller.current.setEditorMode(modeRef.current);
    } catch {
      setState({ ...initialMapState, phase: 'error', message: 'The map could not start. Check WebGL support and reload the map.', buildingReason: '3D unavailable: map initialization failed.' });
    }
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, [onModeChange]);

  useEffect(() => {
    if (mode !== 'editing') controller.current?.setEditorMode(mode);
    if (preserveEditorStatusOnNextModeChange.current) {
      preserveEditorStatusOnNextModeChange.current = false;
    } else {
      setEditorStatus(modeLabel(mode));
    }
  }, [mode]);

  useEffect(() => {
    const visibleLayers = new Map(layers.map(layer => [layer.id, layer.visible]));
    controller.current?.setPointOverlays(features.filter(isPointFeature).map(feature => ({
      id: feature.id,
      coordinates: feature.coordinates,
      name: feature.name,
      visible: feature.visible,
      layerVisible: visibleLayers.get(feature.layerId) === true,
      color: layers.find(layer => layer.id === feature.layerId)?.color || '#f43f5e',
      selected: feature.id === selectedFeatureId,
      presentation: pointPresentationFor(pointPresentations, feature.id),
    })));
    controller.current?.setGeometryOverlays(features, layers, selectedFeatureId);
  }, [features, layers, pointPresentations, selectedFeatureId]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || mode === 'select') return;
      event.preventDefault();
      const cancelled = controller.current?.cancelEditor();
      preserveEditorStatusOnNextModeChange.current = true;
      onModeChange('select');
      setEditorStatus(cancelled?.kind === 'edit'
        ? 'Geometry edit cancelled. The committed geometry is unchanged.'
        : 'Active drawing mode cancelled. No geometry was created.');
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [mode, onModeChange]);

  useEffect(() => {
    setDeleteConfirmationId(null);
  }, [selectedFeatureId]);

  const selectedFeature = features.find(feature => feature.id === selectedFeatureId);
  const selectedPointPresentation = selectedFeature && isPointFeature(selectedFeature)
    ? pointPresentationFor(pointPresentations, selectedFeature.id)
    : null;

  const selectTool = (nextMode: Exclude<EditorMode, 'editing'>) => {
    const accepted = controller.current?.setEditorMode(nextMode);
    if (accepted === false) return;
    onModeChange(nextMode);
  };

  const cancelActiveMode = () => {
    const cancelled = controller.current?.cancelEditor();
    preserveEditorStatusOnNextModeChange.current = true;
    onModeChange('select');
    setEditorStatus(cancelled?.kind === 'edit'
      ? 'Geometry edit cancelled. The committed geometry is unchanged.'
      : 'Active drawing mode cancelled. No geometry was created.');
  };

  const beginEdit = () => {
    if (!selectedFeature || (!isLineStringFeature(selectedFeature) && !isPolygonFeature(selectedFeature)) || selectedFeature.lineage !== 'authored') return;
    if (controller.current?.beginEdit(selectedFeature)) {
      onModeChange('editing');
      setEditorStatus('Editing geometry draft: Apply commits it; Cancel restores the exact committed geometry.');
    }
  };

  const applyEdit = () => {
    if (!selectedFeature) return;
    const geometry = controller.current?.getEditGeometry();
    if (!geometry) {
      setEditorStatus('No valid geometry edit draft is available to apply. The committed geometry is unchanged.');
      return;
    }
    const result = onGeometryApply(selectedFeature.id, geometry);
    setEditorStatus(result.message);
    if (result.ok) {
      controller.current?.completeEdit();
      preserveEditorStatusOnNextModeChange.current = true;
      onModeChange('select');
    }
  };

  const deleteSelected = () => {
    if (!selectedFeature) return;
    const result = onFeatureDelete(selectedFeature.id);
    setDeleteConfirmationId(null);
    setEditorStatus(result.message);
  };

  const createBuffer = () => {
    if (!selectedFeature) return;
    const result = onCreateBuffer(selectedFeature.id, Number(bufferRadius));
    setEditorStatus(result.message);
  };

  const canEditGeometry = Boolean(selectedFeature && selectedFeature.lineage === 'authored' &&
    (isLineStringFeature(selectedFeature) || isPolygonFeature(selectedFeature)));
  const canBuffer = Boolean(selectedFeature && selectedFeature.lineage !== 'derived');

  return (
    <section className="map-workspace" aria-label="Map workspace">
      <aside className="map-controls" aria-label="Layer, data, and inspector controls">
        <section className="data-actions" aria-label="Point GeoJSON data actions">
          <h2>Data</h2>
          <div className="file-actions">
            <label className="file-button">
              Import Points GeoJSON
              <input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={event => {
                const file = event.target.files?.[0];
                if (file) onImportFile(file);
                event.target.value = '';
              }} />
            </label>
            <button type="button" onClick={onExport} disabled={!features.some(isPointFeature)}>Export Points GeoJSON</button>
          </div>
          <p className="control-help">Point-only import and export remain deliberate in this slice. Lines, polygons, and buffers are not included in exports.</p>
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
          <div className="inspector-field"><span>Geometry</span><output>{selectedFeature.type}: {geometrySummary(selectedFeature)}</output></div>
          <div className="inspector-field"><span>Lineage</span><output>{selectedFeature.lineage}</output></div>
          {selectedFeature.provenance.sourceLineageClaim && <div className="inspector-field"><span>Source lineage claim (untrusted)</span><output>{selectedFeature.provenance.sourceLineageClaim.lineage}</output></div>}
          <div className="inspector-field"><span>Validation status</span><output>{selectedFeature.validationStatus}</output></div>
          {selectedFeature.provenance.derivedFrom && <div className="inspector-field"><span>Derived source</span><output>{selectedFeature.provenance.derivedFrom.name || selectedFeature.provenance.derivedFrom.id || 'Unknown source'}{selectedFeature.provenance.derivedFrom.orphaned ? ' — orphaned' : ''}</output></div>}
          {selectedFeature.provenance.buffer && <div className="inspector-field"><span>Buffer derivation</span><output>{selectedFeature.provenance.buffer.radius} {selectedFeature.provenance.buffer.units}; {selectedFeature.provenance.buffer.library}@{selectedFeature.provenance.buffer.libraryVersion}; {selectedFeature.provenance.buffer.steps} steps</output></div>}
          <div className="inspector-field"><span>Provenance</span><p>{selectedFeature.provenance.method}; {selectedFeature.provenance.source}; {selectedFeature.provenance.limitations}</p></div>

          {selectedPointPresentation && <section className="point-presentation" aria-label="Point presentation">
            <h3>Point presentation</h3>
            <p>Presentation only: it is not saved, exported, or used for geometry or buffers.</p>
            <label htmlFor="point-marker-kind">Marker type</label>
            <select id="point-marker-kind" value={selectedPointPresentation.marker} onChange={event => onPointPresentationChange(selectedFeature.id, {
              marker: event.target.value as PointMarkerKind,
            })}>
              {POINT_MARKER_KINDS.map(kind => <option key={kind} value={kind}>{kind === 'dot' ? 'Dot — center hotspot' : 'Pin — tip hotspot'}</option>)}
            </select>
            <label htmlFor="point-marker-size">Marker size</label>
            <select id="point-marker-size" value={selectedPointPresentation.markerSize} onChange={event => onPointPresentationChange(selectedFeature.id, {
              markerSize: Number(event.target.value) as PointMarkerSize,
            })}>
              {POINT_MARKER_SIZES.map(size => <option key={size} value={size}>{size} px</option>)}
            </select>
            <label className="presentation-checkbox" htmlFor="point-label-visible">
              <input id="point-label-visible" type="checkbox" checked={selectedPointPresentation.labelVisible} onChange={event => onPointPresentationChange(selectedFeature.id, {
                labelVisible: event.target.checked,
              })} />
              Show point label
            </label>
            <label htmlFor="point-label-position">Label position</label>
            <select id="point-label-position" value={selectedPointPresentation.labelPosition} onChange={event => onPointPresentationChange(selectedFeature.id, {
              labelPosition: event.target.value as PointPresentation['labelPosition'],
            })}>
              {POINT_LABEL_POSITIONS.map(position => <option key={position} value={position}>{position}</option>)}
            </select>
          </section>}

          <div className="inspector-actions">
            {canEditGeometry && mode !== 'editing' && <button type="button" onClick={beginEdit}>Edit geometry</button>}
            {canEditGeometry && mode === 'editing' && <>
              <button type="button" onClick={applyEdit}>Apply geometry</button>
              <button type="button" onClick={cancelActiveMode}>Cancel edit</button>
            </>}
            {canBuffer && <div className="buffer-actions">
              <label htmlFor="buffer-radius">Buffer radius (metres)</label>
              <input id="buffer-radius" type="number" min="1" max="10000" step="1" value={bufferRadius} onChange={event => setBufferRadius(event.target.value)} />
              <button type="button" onClick={createBuffer}>Create derived buffer</button>
              <p>1–10,000 metres is an operational safety bound, not an engineering standard. Derived buffers are unvalidated and read-only.</p>
            </div>}
            {selectedFeature.lineage === 'derived' && <p className="control-help">Derived buffer geometry is read-only. Delete it or regenerate it from a current authored source.</p>}
            {deleteConfirmationId !== selectedFeature.id
              ? <button type="button" className="danger-button" onClick={() => setDeleteConfirmationId(selectedFeature.id)}>Delete feature</button>
              : <div className="delete-confirmation" role="alert">
                <p>Delete is irreversible until history is separately implemented.</p>
                <button type="button" className="danger-button" onClick={deleteSelected}>Confirm delete</button>
                <button type="button" onClick={() => setDeleteConfirmationId(null)}>Keep feature</button>
              </div>}
          </div>
        </section>}

        <section className="map-options" aria-label="Basemap controls">
          <h2>Basemap</h2>
          <label htmlFor="basemap">Provider</label>
          <select id="basemap" value={basemap} onChange={event => {
            const id = event.target.value;
            if (id !== 'osm' && id !== 'voyager') return;
            if (controller.current?.setBasemap(id) !== false) setBasemap(id);
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
      <div className="map-stage">
        <div className="spatial-toolbar" role="toolbar" aria-label="Spatial tools">
          <button type="button" aria-label="Select tool" aria-pressed={mode === 'select'} onClick={() => selectTool('select')}>Select</button>
          <button type="button" aria-label="Point tool" aria-pressed={mode === 'point'} onClick={() => selectTool('point')}>Point</button>
          <button type="button" aria-label="Line tool" aria-pressed={mode === 'line'} onClick={() => selectTool('line')}>Line</button>
          <button type="button" aria-label="Polygon tool" aria-pressed={mode === 'polygon'} onClick={() => selectTool('polygon')}>Polygon</button>
          {mode !== 'select' && <button type="button" className="toolbar-cancel" onClick={cancelActiveMode}>Cancel</button>}
        </div>
        <div className="editor-status" role="status" aria-live="polite">{editorStatus}</div>
        <div ref={container} className="map-canvas" aria-label="Interactive map" />
      </div>
    </section>
  );
}
