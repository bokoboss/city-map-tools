import { useCallback, useEffect, useRef, useState } from 'react';
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
  applyProjectTransactionCommand,
  beginProjectTransaction,
  cancelProjectTransaction,
  canRedoProject,
  canUndoProject,
  commitProjectTransaction,
  createProjectHistory,
  currentProjectDocument,
  executeProjectCommand,
  redoProject,
  undoProject,
  type ProjectCommand,
  type ProjectHistoryState,
} from './project/projectHistory';
import { createEmptyProjectDocument } from './project/projectDocument';
import { IndexedDbProjectCatalogStorage, IndexedDbProjectStorage } from './project/indexedDbProjectStorage';
import { ProjectCatalog, type ProjectCatalogItem, type ProjectCatalogBootstrap, type StoredProject } from './project/projectCatalog';
import { ProjectPersistence, type PersistenceStatus } from './project/projectPersistence';

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
  const activePointDragRef = useRef<{ id: string; coordinates: Wgs84Point } | null>(null);
  const [catalog] = useState(() => new ProjectCatalog(new IndexedDbProjectCatalogStorage()));
  const [persistence, setPersistence] = useState<ProjectPersistence | null>(null);
  const persistenceRef = useRef<ProjectPersistence | null>(null);
  const [saveStatus, setSaveStatus] = useState<PersistenceStatus>({ state: 'Loading', message: 'Restoring a browser-local project.' });
  const [startupState, setStartupState] = useState<'loading' | 'ready' | 'recovery' | 'storage-error'>('loading');
  const [startupError, setStartupError] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [catalogItems, setCatalogItems] = useState<ProjectCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [legacyRecordPresent, setLegacyRecordPresent] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const switchingRef = useRef(false);
  const [projectFeedback, setProjectFeedback] = useState('');
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const project = currentProjectDocument(historyState);
  const { features, layers } = project;
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('select');
  const modeRef = useRef<EditorMode>(mode);
  const [importStatus, setImportStatus] = useState('No GeoJSON imported. Point-only import/export remains explicit.');

  modeRef.current = mode;
  const getInteractionBlockReason = () => modeRef.current !== 'select' || activePointDragRef.current !== null || historyRef.current.transaction !== null
    ? 'Finish or cancel the active Point, LineString, Polygon, geometry edit, or Point drag before saving, opening, or creating a project.'
    : '';
  const interactionBlockReason = getInteractionBlockReason();

  const installStoredProject = useCallback((stored: StoredProject) => {
    const nextHistory = createProjectHistory(stored.document);
    const nextPersistence = new ProjectPersistence(
      stored.document,
      new IndexedDbProjectStorage(stored.document.metadata.id),
    );
    nextPersistence.restoreStored(stored.serialized);
    const previousPersistence = persistenceRef.current;
    historyRef.current = nextHistory;
    persistenceRef.current = nextPersistence;
    previousPersistence?.dispose();
    setHistoryState(nextHistory);
    setPersistence(nextPersistence);
    setSaveStatus(nextPersistence.getStatus());
    setSelectedFeatureId(null);
    activePointDragRef.current = null;
    modeRef.current = 'select';
    setMode('select');
    setImportStatus('No GeoJSON imported. Point-only import/export remains explicit.');
    setActiveProjectId(stored.activeProjectId);
    setCatalogItems(stored.projects);
    setCatalogLoading(false);
    setCatalogError('');
    setLegacyRecordPresent(stored.legacyRecordPresent);
    setRecoveryMessage('');
    setStartupError('');
    setStartupState('ready');
  }, []);

  useEffect(() => {
    let active = true;
    void catalog.bootstrap().then((result: ProjectCatalogBootstrap) => {
      if (!active) return;
      if (result.kind === 'recovery') {
        setCatalogItems(result.projects);
        setActiveProjectId(result.activeProjectId);
        setLegacyRecordPresent(result.legacyRecordPresent);
        setRecoveryMessage(result.message);
        setStartupState('recovery');
        return;
      }
      installStoredProject(result);
    }).catch(error => {
      if (!active) return;
      setStartupError(error instanceof Error
        ? `Browser-local project storage could not be used: ${error.message}`
        : 'Browser-local project storage could not be used. Check browser storage permissions and retry.');
      setStartupState('storage-error');
    });
    return () => { active = false; };
  }, [bootstrapAttempt, catalog, installStoredProject]);

  useEffect(() => {
    if (!persistence) return;
    return persistence.subscribe(setSaveStatus);
  }, [persistence]);

  const acceptHistory = (next: ProjectHistoryState) => {
    if (next === historyRef.current) return;
    if (next.present !== historyRef.current.present) persistenceRef.current?.commit(next.present);
    historyRef.current = next;
    setHistoryState(next);
    const nextProject = currentProjectDocument(next);
    setSelectedFeatureId(current => current && nextProject.features.some(feature => feature.id === current)
      ? current
      : null);
  };

  const cancelPointDrag = (id: string) => {
    if (activePointDragRef.current?.id !== id) return;
    activePointDragRef.current = null;
    const current = historyRef.current;
    if (current.transaction) acceptHistory(cancelProjectTransaction(current));
  };

  const changeMode = useCallback((nextMode: EditorMode) => {
    if (switchingRef.current) return;
    const activeDrag = activePointDragRef.current;
    if (nextMode !== 'select' && activeDrag) cancelPointDrag(activeDrag.id);
    modeRef.current = nextMode;
    setMode(nextMode);
  }, []);

  const runProjectCommand = (command: ProjectCommand): OperationResult => {
    if (switchingRef.current) return failure(new Error('Project changes are paused while the current project is being saved or switched.'));
    try {
      acceptHistory(executeProjectCommand(historyRef.current, command, new Date().toISOString()));
      return success('Project edit accepted.');
    } catch (error) {
      return failure(error);
    }
  };

  const handlePointDragStart = (id: string): OperationResult => {
    if (switchingRef.current) return failure(new Error('Point dragging is paused while the current project is being saved or switched.'));
    const current = historyRef.current;
    if (modeRef.current !== 'select' || current.transaction) {
      return failure(new Error('Point markers can only be moved in Select mode when no other project transaction is active.'));
    }
    const point = current.present.features.find(feature => feature.id === id);
    const layer = point && current.present.layers.find(candidate => candidate.id === point.layerId);
    if (!point || !isPointFeature(point) || point.lineage !== 'authored' || !point.visible || !layer?.visible) {
      return failure(new Error('Only visible authored Points can be moved. Imported and hidden Points remain fixed.'));
    }
    try {
      acceptHistory(beginProjectTransaction(current));
      activePointDragRef.current = {
        id,
        coordinates: [point.coordinates[0], point.coordinates[1]],
      };
      setSelectedFeatureId(id);
      return success('Point move started. Release to commit this gesture.');
    } catch (error) {
      return failure(error);
    }
  };

  const handlePointDragMove = (id: string, coordinates: Wgs84Point): OperationResult => {
    const drag = activePointDragRef.current;
    const current = historyRef.current;
    if (modeRef.current !== 'select' || !drag || drag.id !== id || !current.transaction) {
      return failure(new Error('The Point move is no longer active. The committed position will be restored.'));
    }
    try {
      const point = current.transaction.draft.features.find(feature => feature.id === id);
      if (!point || !isPointFeature(point) || point.lineage !== 'authored') {
        throw new Error('Only an authored Point can be moved in this gesture.');
      }
      const validated = validateWgs84Point(coordinates);
      acceptHistory(applyProjectTransactionCommand(current, { type: 'movePoint', id, coordinates: validated }));
      return success('');
    } catch (error) {
      return failure(error);
    }
  };

  const handlePointDragEnd = (id: string, coordinates: Wgs84Point): OperationResult => {
    const drag = activePointDragRef.current;
    let current = historyRef.current;
    if (!drag || drag.id !== id || !current.transaction) {
      cancelPointDrag(id);
      return failure(new Error('The Point move could not be committed because its transaction was no longer active.'));
    }
    try {
      const point = current.transaction.draft.features.find(feature => feature.id === id);
      if (!point || !isPointFeature(point) || point.lineage !== 'authored') {
        throw new Error('Only an authored Point can be committed by this gesture.');
      }
      const validated = validateWgs84Point(coordinates);
      current = applyProjectTransactionCommand(current, { type: 'movePoint', id, coordinates: validated });
      if (validated[0] === drag.coordinates[0] && validated[1] === drag.coordinates[1]) {
        activePointDragRef.current = null;
        acceptHistory(cancelProjectTransaction(current));
        return success('Point returned to its original WGS84 position. No project edit was saved.');
      }
      acceptHistory(commitProjectTransaction(current, new Date().toISOString()));
      activePointDragRef.current = null;
      return success('Point move committed. Dependent buffers, if any, are now Stale.');
    } catch (error) {
      cancelPointDrag(id);
      return failure(error);
    }
  };

  const handleMapPointClick = (coordinates: Wgs84Point) => {
    if (switchingRef.current || modeRef.current !== 'point') return;
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
    if (switchingRef.current || modeRef.current !== 'select') {
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
    const current = historyRef.current.present;
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
    if (switchingRef.current) return;
    try {
      acceptHistory(transition(historyRef.current, new Date().toISOString()));
    } catch (error) {
      setImportStatus(`Project history could not be updated: ${failure(error).message}`);
    }
  };

  const beginProjectTransition = (): boolean => {
    if (switchingRef.current) return false;
    const blockedReason = getInteractionBlockReason();
    if (blockedReason) {
      setProjectFeedback(blockedReason);
      return false;
    }
    switchingRef.current = true;
    setSwitching(true);
    setProjectFeedback('');
    return true;
  };

  const projectActionFailure = (error: unknown): string => {
    const currentStatus = persistenceRef.current?.getStatus();
    if (currentStatus?.state === 'Error') return currentStatus.message;
    return error instanceof Error ? error.message : 'The local project action could not be completed.';
  };

  const handleSaveNow = async () => {
    if (switchingRef.current) return;
    const blockedReason = getInteractionBlockReason();
    if (blockedReason) {
      setProjectFeedback(blockedReason);
      return;
    }
    const current = persistenceRef.current;
    if (!current) {
      setProjectFeedback('No browser-local project is ready to save.');
      return;
    }
    setProjectFeedback('');
    try {
      await current.flushNow();
      setProjectFeedback('The current browser-local project is saved.');
    } catch (error) {
      setProjectFeedback(projectActionFailure(error));
    }
  };

  const handleOpenProjectManager = async () => {
    setProjectsOpen(true);
    setProjectFeedback('');
    setCatalogError('');
    setCatalogLoading(true);
    try {
      const result = await catalog.listProjects(activeProjectId);
      setCatalogItems(result.projects);
      setLegacyRecordPresent(result.legacyRecordPresent);
    } catch (error) {
      const message = `The browser-local project catalogue could not be refreshed: ${failure(error).message}`;
      setCatalogError(message);
      setProjectFeedback(message);
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleCreateProject = async (name: string) => {
    if (!beginProjectTransition()) return;
    try {
      const current = persistenceRef.current;
      const created = await catalog.createProject(name, current ? () => current.flushNow() : undefined);
      installStoredProject(created);
      setProjectsOpen(false);
      setProjectFeedback('New local project created.');
    } catch (error) {
      setProjectFeedback(projectActionFailure(error));
    } finally {
      switchingRef.current = false;
      setSwitching(false);
    }
  };

  const handleOpenProject = async (projectId: string) => {
    if (!beginProjectTransition()) return;
    try {
      const current = persistenceRef.current;
      const opened = await catalog.openProject(projectId, current ? () => current.flushNow() : undefined);
      installStoredProject(opened);
      setProjectsOpen(false);
      setProjectFeedback(`Opened ${opened.document.metadata.name}. Undo and Redo start from a fresh project history root.`);
    } catch (error) {
      setProjectFeedback(projectActionFailure(error));
    } finally {
      switchingRef.current = false;
      setSwitching(false);
    }
  };

  if (startupState === 'loading') {
    return <main className="app"><header className="app-header"><h1>City Map Tools</h1><p className="project-save-state" role="status" aria-live="polite">Loading · {saveStatus.message}</p></header></main>;
  }

  if (startupState === 'storage-error') {
    return <main className="app project-recovery">
      <header className="app-header"><h1>City Map Tools</h1></header>
      <section className="project-recovery-panel" aria-label="Browser-local project storage error">
        <h2>Local project storage is unavailable</h2>
        <p role="alert">{startupError}</p>
        <p>New, Open, and Save are unavailable until IndexedDB can be read and written. No local project action was reported as successful.</p>
        <button type="button" onClick={() => setBootstrapAttempt(attempt => attempt + 1)}>Retry project storage</button>
      </section>
    </main>;
  }

  if (startupState === 'recovery') {
    return <main className="app project-recovery">
      <header className="app-header">
        <div><h1>City Map Tools</h1><p className="project-save-state project-save-error" role="status"><strong>Recovery needed</strong> · No active local project was opened.</p></div>
      </header>
      <section className="project-recovery-panel" aria-label="Browser-local project recovery">
        <h2>Recover a browser-local project</h2>
        <p role="alert">{recoveryMessage}</p>
        <ProjectManagerPanel
          projects={catalogItems}
          activeProjectId={activeProjectId}
          legacyRecordPresent={legacyRecordPresent}
          blockedReason={''}
          busy={switching}
          feedback={projectFeedback}
          onCreate={handleCreateProject}
          onOpen={handleOpenProject}
        />
      </section>
    </main>;
  }

  return (
    <main className="app">
      <header className="app-header">
        <div className="project-header-identity">
          <h1>City Map Tools</h1>
          <p>Project workspace · R1B preview</p>
          <div className="current-project-identity">
            <span>Current project</span>
            <strong aria-label="Current project name">{project.metadata.name}</strong>
          </div>
          <p className={`project-save-state project-save-${saveStatus.state.toLowerCase()}`} role="status" aria-live="polite"><strong>{saveStatus.state}</strong> · {saveStatus.message}</p>
          <div className="project-workflow-actions" aria-label="Project actions">
            <button
              type="button"
              onClick={() => void handleSaveNow()}
              disabled={Boolean(interactionBlockReason) || switching}
              aria-describedby={interactionBlockReason ? 'project-action-reason' : undefined}
            >Save now</button>
            <button type="button" onClick={() => void handleOpenProjectManager()} disabled={switching}>Projects…</button>
          </div>
        </div>
        <div className="reload-control">
          <button
            type="button"
            className="history-button"
            disabled={!canUndoProject(historyState) || mode !== 'select' || switching}
            aria-label="Undo project edit"
            onClick={() => updateProjectHistory(undoProject)}
          >Undo</button>
          <button
            type="button"
            className="history-button"
            disabled={!canRedoProject(historyState) || mode !== 'select' || switching}
            aria-label="Redo project edit"
            onClick={() => updateProjectHistory(redoProject)}
          >Redo</button>
          <button
            type="button"
            disabled={mode !== 'select' || switching}
            aria-describedby={interactionBlockReason ? 'project-action-reason' : undefined}
            onClick={() => setMapSession(session => session + 1)}
          >Reload map</button>
        </div>
      <p
        id="project-action-reason"
        className={`project-header-message ${interactionBlockReason ? 'project-action-reason' : 'project-feedback'}`}
        role="status"
        aria-live="polite"
      >{interactionBlockReason || projectFeedback || '\u00a0'}</p>
      </header>
      <MapCanvas
        key={mapSession}
        features={features}
        layers={layers}
        selectedFeatureId={selectedFeatureId}
        mode={mode}
        interactionLocked={switching}
        importStatus={importStatus}
        pointPresentations={project.presentation.points}
        onModeChange={changeMode}
        onPointSelect={setSelectedFeatureId}
        onPointDragStart={handlePointDragStart}
        onPointDragMove={handlePointDragMove}
        onPointDragEnd={handlePointDragEnd}
        onPointDragCancel={cancelPointDrag}
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
      {projectsOpen && <div className="project-dialog-backdrop">
        <ProjectManagerPanel
          projects={catalogItems}
          activeProjectId={activeProjectId}
          legacyRecordPresent={legacyRecordPresent}
          blockedReason={interactionBlockReason}
          busy={switching}
          catalogLoading={catalogLoading}
          catalogError={catalogError}
          feedback={projectFeedback}
          onClose={() => setProjectsOpen(false)}
          onCreate={handleCreateProject}
          onOpen={handleOpenProject}
        />
      </div>}
    </main>
  );
}

interface ProjectManagerPanelProps {
  projects: readonly ProjectCatalogItem[];
  activeProjectId: string | null;
  legacyRecordPresent: boolean;
  blockedReason: string;
  busy: boolean;
  catalogLoading?: boolean;
  catalogError?: string;
  feedback: string;
  onCreate: (name: string) => void;
  onOpen: (projectId: string) => void;
  onClose?: () => void;
}

function ProjectManagerPanel({
  projects,
  activeProjectId,
  legacyRecordPresent,
  blockedReason,
  busy,
  catalogLoading = false,
  catalogError = '',
  feedback,
  onCreate,
  onOpen,
  onClose,
}: ProjectManagerPanelProps) {
  const [newProjectName, setNewProjectName] = useState('Untitled project');
  const switchingBlocked = Boolean(blockedReason);
  const actionDisabled = busy || switchingBlocked || catalogLoading || Boolean(catalogError);
  const unreadableProjects = projects.filter(project => !project.openable);

  return <section
    className="project-manager-panel"
    role={onClose ? 'dialog' : 'region'}
    aria-modal={onClose ? 'true' : undefined}
    aria-labelledby="project-manager-title"
  >
    <header className="project-manager-header">
      <div>
        <h2 id="project-manager-title">Local projects</h2>
        <p>Projects stay in this browser. Editing the same project in multiple tabs has no conflict resolution.</p>
      </div>
      {onClose && <button type="button" aria-label="Close projects" onClick={onClose} disabled={busy}>Close</button>}
    </header>

    {blockedReason && <p className="project-action-reason" role="status">{blockedReason}</p>}
    {catalogLoading && <p role="status">Refreshing browser-local projects…</p>}
    {catalogError && <p role="alert">{catalogError}</p>}
    {feedback && <p className="project-feedback" role="status" aria-live="polite">{feedback}</p>}
    {legacyRecordPresent && <p className="project-recovery-note" role="alert">A legacy recovery record is still stored. It was not overwritten or deleted.</p>}
    {unreadableProjects.length > 0 && <p className="project-recovery-note" role="alert">Unreadable project records remain in storage. They were not overwritten or deleted.</p>}
    <form className="new-project-form" onSubmit={event => {
      event.preventDefault();
      if (!actionDisabled) onCreate(newProjectName);
    }}>
      <label htmlFor="new-project-name">New local project name</label>
      <div className="new-project-controls">
        <input
          id="new-project-name"
          value={newProjectName}
          maxLength={500}
          required
          disabled={busy}
          onChange={event => setNewProjectName(event.target.value)}
        />
        <button type="submit" disabled={actionDisabled}>New project</button>
      </div>
    </form>

    <section className="local-project-list" aria-label="Available local projects">
      <h3>Projects on this browser</h3>
      {projects.length === 0
        ? <p>No named project records are available yet.</p>
        : <ul>{projects.map(project => <li key={project.id} className={project.active ? 'active-project' : undefined}>
          <div className="local-project-summary">
            <strong>{project.name}</strong>
            {project.active && <span className="active-project-tag">Active</span>}
            {project.openable && project.updatedAt
              ? <time dateTime={project.updatedAt}>Updated {new Date(project.updatedAt).toLocaleString()}</time>
              : <span className="unavailable-project-tag">Unavailable · recovery needed</span>}
          </div>
          {project.openable
            ? <button
              type="button"
              aria-label={`Open project ${project.name}`}
              disabled={actionDisabled || project.id === activeProjectId}
              onClick={() => onOpen(project.id)}
            >Open</button>
            : <span className="control-help" title={project.message}>Stored record preserved</span>}
        </li>)}</ul>}
    </section>
  </section>;
}
