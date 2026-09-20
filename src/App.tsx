import { useReducer, useRef, useState } from 'react';
import { deriveBufferFeature } from './features/buffer';
import { importGeoJsonText, exportGeoJson, GEOJSON_MAX_TEXT_LENGTH } from './features/geojson';
import {
  createDefaultLayers,
  isPointFeature,
  pointCompatibleLayers,
  validateGeometrySnapshot,
  validateWgs84Point,
  type FeatureLayer,
  type GeometrySnapshot,
  type Wgs84Point,
} from './features/featureModel';
import { geometryEqual, initialWorkspaceState, nextFeatureId, workspaceReducer } from './features/workspace';
import { MapCanvas } from './map/MapCanvas';
import type { OperationResult } from './map/MapCanvas';
import type { EditorMode } from './map/MapCanvas';
import { pointPresentationFor } from './map/pointPresentation';
import type { PointPresentation } from './map/pointPresentation';

function success(message: string): OperationResult {
  return { ok: true, message };
}

function failure(error: unknown): OperationResult {
  return { ok: false, message: error instanceof Error ? error.message : 'The requested operation could not be completed.' };
}

export function App() {
  const [mapSession, setMapSession] = useState(0);
  const [featureState, dispatchFeature] = useReducer(workspaceReducer, initialWorkspaceState);
  const { features, selectedFeatureId } = featureState;
  const [layers, setLayers] = useState<FeatureLayer[]>(createDefaultLayers);
  const [mode, setMode] = useState<EditorMode>('select');
  const modeRef = useRef<EditorMode>(mode);
  const [importStatus, setImportStatus] = useState('No GeoJSON imported. Point-only import/export remains explicit.');
  const [pointPresentations, setPointPresentations] = useState<Record<string, PointPresentation>>({});

  modeRef.current = mode;

  const handleMapPointClick = (coordinates: Wgs84Point) => {
    if (mode !== 'point') return;
    try {
      dispatchFeature({ type: 'createPoint', coordinates: validateWgs84Point(coordinates) });
      setMode('select');
    } catch (error) {
      setImportStatus(`Point was not created: ${failure(error).message}`);
      setMode('select');
    }
  };

  const handleGeometryCreate = (geometry: GeometrySnapshot): OperationResult => {
    try {
      const validated = validateGeometrySnapshot(geometry);
      if (validated.type === 'Point') throw new Error('Point geometry must use the Point tool.');
      dispatchFeature({ type: 'createGeometry', geometry: validated });
      return success(`${validated.type} created as authored, Functional but unvalidated WGS84 geometry.`);
    } catch (error) {
      return failure(error);
    }
  };

  const handleGeometryApply = (id: string, geometry: GeometrySnapshot): OperationResult => {
    try {
      const target = features.find(feature => feature.id === id);
      if (!target) throw new Error('Selected feature no longer exists.');
      if (target.lineage === 'derived') throw new Error('Derived buffer geometry is read-only in this slice.');
      const validated = validateGeometrySnapshot(geometry);
      if (validated.type === 'Point' || validated.type !== target.type) {
        throw new Error('Only an authored LineString or Polygon may receive a matching geometry edit.');
      }
      const changed = !geometryEqual(target, validated);
      dispatchFeature({ type: 'applyGeometry', id, geometry: validated });
      return success(changed
        ? `${validated.type} geometry applied. Directly dependent buffers, if any, are now marked Stale.`
        : `${validated.type} geometry unchanged. No dependent buffer status changed.`);
    } catch (error) {
      return failure(error);
    }
  };

  const handleCreateBuffer = (id: string, radius: number): OperationResult => {
    try {
      const source = features.find(feature => feature.id === id);
      if (!source) throw new Error('Selected source feature no longer exists.');
      const buffer = deriveBufferFeature(source, nextFeatureId(features, 'buffer'), radius);
      dispatchFeature({ type: 'insert', feature: buffer });
      return success(`Created derived buffer at ${radius} meters with explicit @turf/buffer@7.4.0 provenance. It is ${buffer.validationStatus} and read-only.`);
    } catch (error) {
      return failure(error);
    }
  };

  const handleDelete = (id: string): OperationResult => {
    const feature = features.find(candidate => candidate.id === id);
    if (!feature) return { ok: false, message: 'Selected feature no longer exists.' };
    dispatchFeature({ type: 'delete', id });
    setPointPresentations(current => {
      if (!Object.hasOwn(current, id)) return current;
      const { [id]: _removed, ...remaining } = current;
      return remaining;
    });
    return success(feature.lineage === 'derived'
      ? 'Derived buffer deleted.'
      : 'Feature deleted. Dependent derived buffers remain traceable and are marked Stale/orphaned.');
  };

  const handleImportFile = async (file: File) => {
    const importBlockedMessage = 'Import Points GeoJSON is unavailable while an active geometry interaction is open. Finish or cancel it before importing.';
    const importRaceMessage = 'Import was not applied because a geometry interaction became active while the file was being read.';
    if (modeRef.current !== 'select') {
      setImportStatus(importBlockedMessage);
      return;
    }
    if (file.size > GEOJSON_MAX_TEXT_LENGTH * 4) {
      setImportStatus(`Import rejected: file exceeds the ${GEOJSON_MAX_TEXT_LENGTH}-character safety limit.`);
      return;
    }
    try {
      const imported = importGeoJsonText(await file.text(), pointCompatibleLayers(layers));
      if (modeRef.current !== 'select') {
        setImportStatus(importRaceMessage);
        return;
      }
      dispatchFeature({ type: 'import', imported });
      setMode('select');
      setImportStatus(`Imported ${imported.length} Point feature${imported.length === 1 ? '' : 's'}; imported values remain unvalidated.`);
    } catch (error) {
      setImportStatus(`Import rejected: ${failure(error).message}`);
    }
  };

  const handleExport = () => {
    const pointFeatures = features.filter(isPointFeature);
    const blob = new Blob([exportGeoJson(pointFeatures)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'city-map-tools-points.geojson';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setImportStatus(`Exported ${pointFeatures.length} Point feature${pointFeatures.length === 1 ? '' : 's'} only. Lines, Polygons, and Buffers were not included.`);
  };

  return (
    <main className="app">
      <header className="app-header">
        <div><h1>City Map Tools</h1><p>Geometry editor workspace · R1A-3 preview</p></div>
        <div className="reload-control">
          <button
            type="button"
            disabled={mode !== 'select'}
            aria-describedby={mode === 'select' ? undefined : 'reload-reason'}
            onClick={() => setMapSession(session => session + 1)}
          >Reload map</button>
          {mode !== 'select' && <p id="reload-reason">Reload map is unavailable while an active geometry draft is open. Finish or cancel it before reloading.</p>}
        </div>
      </header>
      <MapCanvas
        key={mapSession}
        features={features}
        layers={layers}
        selectedFeatureId={selectedFeatureId}
        mode={mode}
        importStatus={importStatus}
        pointPresentations={pointPresentations}
        onModeChange={setMode}
        onPointSelect={id => dispatchFeature({ type: 'select', id })}
        onMapPointClick={handleMapPointClick}
        onLayerVisibilityChange={id => setLayers(current => current.map(layer => layer.id === id ? { ...layer, visible: !layer.visible } : layer))}
        onFeatureVisibilityChange={id => dispatchFeature({ type: 'toggleVisibility', id })}
        onFeatureSelect={id => dispatchFeature({ type: 'select', id })}
        onFeatureRename={(id, name) => dispatchFeature({ type: 'rename', id, name })}
        onGeometryCreate={handleGeometryCreate}
        onGeometryApply={handleGeometryApply}
        onFeatureDelete={handleDelete}
        onCreateBuffer={handleCreateBuffer}
        onPointPresentationChange={(id, patch) => setPointPresentations(current => ({
          ...current,
          [id]: { ...pointPresentationFor(current, id), ...patch },
        }))}
        onImportFile={handleImportFile}
        onExport={handleExport}
      />
      <footer className="app-footer">
        Point, LineString, Polygon, and derived buffer authoring are available in this slice. Buffers are unvalidated derived outputs; engineering analytics remain unavailable.
      </footer>
    </main>
  );
}
