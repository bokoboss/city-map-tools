import { useCallback, useRef, useState } from 'react';
import { importGeoJsonText, exportGeoJson, GEOJSON_MAX_TEXT_LENGTH } from './features/geojson';
import {
  importFeaturesIntoWorkspace,
  isPointFeature,
  pointCompatibleLayers,
  validateGeometrySnapshot,
  validateWgs84Point,
  type GeometrySnapshot,
  type Wgs84Point,
} from './features/featureModel';
import { nextFeatureId, geometryEqual } from './features/workspace';
import { MapCanvas } from './map/MapCanvas';
import type { OperationResult } from './map/MapCanvas';
import type { EditorMode } from './map/MapCanvas';
import {
  canRedoProject,
  canUndoProject,
  createProjectHistory,
  currentProjectDocument,
  executeProjectCommand,
  redoProject,
  undoProject,
  type ProjectCommand,
  type ProjectHistoryState,
} from './project/projectHistory';
import { createEmptyProjectDocument } from './project/projectDocument';

function success(message: string): OperationResult {
  return { ok: true, message };
}

function failure(error: unknown): OperationResult {
  return { ok: false, message: error instanceof Error ? error.message : 'The requested operation could not be completed.' };
}

function createInitialHistory(): ProjectHistoryState {
  const createdAt = new Date().toISOString();
  return createProjectHistory(createEmptyProjectDocument({
    id: globalThis.crypto.randomUUID(),
    createdAt,
    name: 'Untitled project',
  }));
}

export function App() {
  const [mapSession, setMapSession] = useState(0);
  const [historyState, setHistoryState] = useState<ProjectHistoryState>(createInitialHistory);
  const historyRef = useRef(historyState);
  const project = currentProjectDocument(historyState);
  const { features, layers } = project;
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('select');
  const modeRef = useRef<EditorMode>(mode);
  const [importStatus, setImportStatus] = useState('No GeoJSON imported. Point-only import/export remains explicit.');

  modeRef.current = mode;

  const changeMode = useCallback((nextMode: EditorMode) => {
    modeRef.current = nextMode;
    setMode(nextMode);
  }, []);

  const acceptHistory = (next: ProjectHistoryState) => {
    if (next === historyRef.current) return;
    historyRef.current = next;
    setHistoryState(next);
    const nextProject = currentProjectDocument(next);
    setSelectedFeatureId(current => current && nextProject.features.some(feature => feature.id === current)
      ? current
      : null);
  };

  const runProjectCommand = (command: ProjectCommand): OperationResult => {
    try {
      acceptHistory(executeProjectCommand(historyRef.current, command, new Date().toISOString()));
      return success('Project edit accepted.');
    } catch (error) {
      return failure(error);
    }
  };

  const handleMapPointClick = (coordinates: Wgs84Point) => {
    if (modeRef.current !== 'point') return;
    try {
      const validated = validateWgs84Point(coordinates);
      const current = currentProjectDocument(historyRef.current);
      const id = nextFeatureId(current.features, 'point');
      const result = runProjectCommand({ type: 'createPoint', coordinates: validated });
      if (!result.ok) throw new Error(result.message);
      setSelectedFeatureId(id);
      changeMode('select');
    } catch (error) {
      setImportStatus(`Point was not created: ${failure(error).message}`);
      changeMode('select');
    }
  };

  const handleGeometryCreate = (geometry: GeometrySnapshot): OperationResult => {
    try {
      const validated = validateGeometrySnapshot(geometry);
      if (validated.type === 'Point') throw new Error('Point geometry must use the Point tool.');
      const current = currentProjectDocument(historyRef.current);
      const prefix = validated.type === 'LineString' ? 'line' : 'polygon';
      const id = nextFeatureId(current.features, prefix);
      const result = runProjectCommand({ type: 'createGeometry', geometry: validated });
      if (!result.ok) return result;
      setSelectedFeatureId(id);
      return success(`${validated.type} created as authored, Functional but unvalidated WGS84 geometry.`);
    } catch (error) {
      return failure(error);
    }
  };

  const handleGeometryApply = (id: string, geometry: GeometrySnapshot): OperationResult => {
    try {
      const current = currentProjectDocument(historyRef.current);
      const target = current.features.find(feature => feature.id === id);
      if (!target) throw new Error('Selected feature no longer exists.');
      if (target.lineage === 'derived') throw new Error('Derived buffer geometry is read-only in this slice.');
      const validated = validateGeometrySnapshot(geometry);
      if (validated.type === 'Point' || validated.type !== target.type) {
        throw new Error('Only an authored LineString or Polygon may receive a matching geometry edit.');
      }
      const changed = !geometryEqual(target, validated);
      const result = runProjectCommand({ type: 'applyGeometry', id, geometry: validated });
      if (!result.ok) return result;
      return success(changed
        ? `${validated.type} geometry applied. Directly dependent buffers, if any, are now marked Stale.`
        : `${validated.type} geometry unchanged. No dependent buffer status changed.`);
    } catch (error) {
      return failure(error);
    }
  };

  const handleCreateBuffer = (id: string, radius: number): OperationResult => {
    try {
      const current = currentProjectDocument(historyRef.current);
      const source = current.features.find(feature => feature.id === id);
      if (!source) throw new Error('Selected source feature no longer exists.');
      const bufferId = nextFeatureId(current.features, 'buffer');
      const result = runProjectCommand({ type: 'createBuffer', sourceId: id, radius });
      if (!result.ok) return result;
      const createdBuffer = currentProjectDocument(historyRef.current).features.find(feature => feature.id === bufferId);
      if (!createdBuffer || createdBuffer.lineage !== 'derived') {
        return failure('The created buffer could not be read from the committed project.');
      }
      setSelectedFeatureId(bufferId);
      return success(`Created derived buffer at ${radius} meters with explicit @turf/buffer@7.4.0 provenance. It is ${createdBuffer.validationStatus} and read-only.`);
    } catch (error) {
      return failure(error);
    }
  };

  const handleDelete = (id: string): OperationResult => {
    const current = currentProjectDocument(historyRef.current);
    const feature = current.features.find(candidate => candidate.id === id);
    if (!feature) return { ok: false, message: 'Selected feature no longer exists.' };
    const result = runProjectCommand({ type: 'deleteFeature', id });
    if (!result.ok) return result;
    return success(feature.lineage === 'derived'
      ? 'Derived buffer deleted.'
      : 'Feature deleted. Dependent derived buffers remain traceable and are marked Stale/orphaned.');
  };

  const handleImportFile = async (file: File) => {
    const importBlockedMessage = 'Import Points GeoJSON is unavailable while an active geometry interaction is open. Finish or cancel it before importing.';
    if (modeRef.current !== 'select') {
      setImportStatus(importBlockedMessage);
      return;
    }
    if (file.size > GEOJSON_MAX_TEXT_LENGTH * 4) {
      setImportStatus(`Import rejected: file exceeds the ${GEOJSON_MAX_TEXT_LENGTH}-character safety limit.`);
      return;
    }
    const startingProject = currentProjectDocument(historyRef.current);
    try {
      const imported = importGeoJsonText(await file.text(), pointCompatibleLayers(startingProject.layers));
      if (modeRef.current !== 'select') {
        setImportStatus('Import was not applied because a geometry interaction became active while the file was being read.');
        return;
      }
      if (currentProjectDocument(historyRef.current) !== startingProject) {
        setImportStatus('Import was not applied because the project changed while the file was being read. Choose the file again to import it against the current project.');
        return;
      }
      const selection = importFeaturesIntoWorkspace(imported, startingProject.features).selectedFeatureId;
      const result = runProjectCommand({ type: 'importPoints', features: imported });
      if (!result.ok) throw new Error(result.message);
      setSelectedFeatureId(selection);
      changeMode('select');
      setImportStatus(`Imported ${imported.length} Point feature${imported.length === 1 ? '' : 's'}; imported values remain unvalidated.`);
    } catch (error) {
      setImportStatus(`Import rejected: ${failure(error).message}`);
    }
  };

  const handleExport = () => {
    const current = currentProjectDocument(historyRef.current);
    const pointFeatures = current.features.filter(isPointFeature);
    const blob = new Blob([exportGeoJson(pointFeatures)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'city-map-tools-points.geojson';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setImportStatus(`Exported ${pointFeatures.length} Point feature${pointFeatures.length === 1 ? '' : 's'} only. Lines, Polygons, and Buffers were not included.`);
  };

  const updateProjectHistory = (transition: (state: ProjectHistoryState, updatedAt: string) => ProjectHistoryState) => {
    try {
      acceptHistory(transition(historyRef.current, new Date().toISOString()));
    } catch (error) {
      setImportStatus(`Project history could not be updated: ${failure(error).message}`);
    }
  };

  return (
    <main className="app">
      <header className="app-header">
        <div><h1>City Map Tools</h1><p>Project workspace · R1B preview</p></div>
        <div className="reload-control">
          <button
            type="button"
            className="history-button"
            disabled={!canUndoProject(historyState) || mode !== 'select'}
            aria-label="Undo project edit"
            onClick={() => updateProjectHistory(undoProject)}
          >Undo</button>
          <button
            type="button"
            className="history-button"
            disabled={!canRedoProject(historyState) || mode !== 'select'}
            aria-label="Redo project edit"
            onClick={() => updateProjectHistory(redoProject)}
          >Redo</button>
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
        pointPresentations={project.presentation.points}
        onModeChange={changeMode}
        onPointSelect={setSelectedFeatureId}
        onMapPointClick={handleMapPointClick}
        onLayerVisibilityChange={id => runProjectCommand({ type: 'toggleLayerVisibility', layerId: id })}
        onFeatureVisibilityChange={id => runProjectCommand({ type: 'toggleFeatureVisibility', id })}
        onFeatureSelect={setSelectedFeatureId}
        onFeatureRename={(id, name) => runProjectCommand({ type: 'renameFeature', id, name })}
        onGeometryCreate={handleGeometryCreate}
        onGeometryApply={handleGeometryApply}
        onFeatureDelete={handleDelete}
        onCreateBuffer={handleCreateBuffer}
        onPointPresentationChange={(id, patch) => runProjectCommand({ type: 'updatePointPresentation', id, patch })}
        onImportFile={handleImportFile}
        onExport={handleExport}
      />
      <footer className="app-footer">
        Point, LineString, Polygon, and derived buffer authoring are available in this slice. Buffers are unvalidated derived outputs; engineering analytics remain unavailable.
      </footer>
    </main>
  );
}
