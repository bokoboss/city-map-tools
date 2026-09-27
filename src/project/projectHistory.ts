import { deriveBufferFeature } from '../features/buffer';
import {
  createAuthoredPoint,
  importFeaturesIntoWorkspace,
  markDependentBuffersStale,
  renameFeature,
  validateWgs84Point,
  type PointFeature,
  type SpatialFeature,
  type Wgs84Point,
} from '../features/featureModel';
import { applyWorkspaceGeometry, createWorkspaceGeometry, nextFeatureId } from '../features/workspace';
import {
  createProjectDocument,
  decodeProjectDocument,
  type ProjectDocumentV1,
} from './projectDocument';
import { pointPresentationFor, type PointPresentation } from '../map/pointPresentation';
import type { GeometrySnapshot } from '../features/featureModel';

export const PROJECT_HISTORY_MAX_SNAPSHOTS = 20;

export type ProjectCommand =
  | { type: 'createPoint'; coordinates: Wgs84Point }
  | { type: 'createGeometry'; geometry: GeometrySnapshot }
  | { type: 'applyGeometry'; id: string; geometry: GeometrySnapshot }
  | { type: 'createBuffer'; sourceId: string; radius: number }
  | { type: 'importPoints'; features: readonly PointFeature[] }
  | { type: 'deleteFeature'; id: string }
  | { type: 'renameFeature'; id: string; name: string }
  | { type: 'toggleFeatureVisibility'; id: string }
  | { type: 'toggleLayerVisibility'; layerId: string }
  | { type: 'updatePointPresentation'; id: string; patch: Partial<PointPresentation> }
  | { type: 'movePoint'; id: string; coordinates: Wgs84Point };

export interface ProjectTransaction {
  draft: ProjectDocumentV1;
}

export interface ProjectHistoryState {
  present: ProjectDocumentV1;
  past: readonly ProjectDocumentV1[];
  future: readonly ProjectDocumentV1[];
  transaction: ProjectTransaction | null;
}

function projectContentEqual(left: ProjectDocumentV1, right: ProjectDocumentV1): boolean {
  // All documents entering history have passed the v1 decoder, which returns a
  // canonical property and array order suitable for deterministic comparison.
  return JSON.stringify(left) === JSON.stringify(right);
}

function documentWithTimestamp(document: ProjectDocumentV1, updatedAt: string): ProjectDocumentV1 {
  return createProjectDocument({
    metadata: { ...document.metadata, updatedAt },
    layers: document.layers,
    features: document.features,
    pointPresentations: document.presentation.points,
  });
}

function documentWithParts(
  document: ProjectDocumentV1,
  parts: {
    layers?: readonly ProjectDocumentV1['layers'][number][];
    features?: readonly SpatialFeature[];
    pointPresentations?: Readonly<Record<string, PointPresentation>>;
  },
): ProjectDocumentV1 {
  return createProjectDocument({
    metadata: document.metadata,
    layers: parts.layers ?? document.layers,
    features: parts.features ?? document.features,
    pointPresentations: parts.pointPresentations ?? document.presentation.points,
  });
}

function requiredFeature(document: ProjectDocumentV1, id: string): SpatialFeature {
  const feature = document.features.find(candidate => candidate.id === id);
  if (!feature) throw new Error(`Feature "${id}" no longer exists in the current project.`);
  return feature;
}

function copyPointPresentations(
  presentations: Readonly<Record<string, PointPresentation>>,
): Record<string, PointPresentation> {
  const copy = Object.create(null) as Record<string, PointPresentation>;
  for (const id of Object.keys(presentations)) {
    Object.defineProperty(copy, id, {
      value: presentations[id],
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return copy;
}

function applyPointPresentation(
  document: ProjectDocumentV1,
  id: string,
  patch: Partial<PointPresentation>,
): ProjectDocumentV1 {
  const feature = requiredFeature(document, id);
  if (feature.type !== 'Point') throw new Error('Point presentation can only be changed for Point features.');
  const presentations = copyPointPresentations(document.presentation.points);
  Object.defineProperty(presentations, id, {
    value: { ...pointPresentationFor(presentations, id), ...patch },
    enumerable: true,
    writable: true,
    configurable: true,
  });
  return documentWithParts(document, { pointPresentations: presentations });
}

function movePoint(document: ProjectDocumentV1, id: string, coordinates: Wgs84Point): ProjectDocumentV1 {
  const target = requiredFeature(document, id);
  if (target.type !== 'Point') throw new Error('Only Point features support the Point-coordinate move command.');
  const validated = validateWgs84Point(coordinates);
  if (target.coordinates[0] === validated[0] && target.coordinates[1] === validated[1]) return document;
  const moved = document.features.map(feature => feature.id === id
    ? { ...target, coordinates: validated }
    : feature);
  return documentWithParts(document, { features: markDependentBuffersStale(moved, id, false) });
}

/**
 * Applies one pure project edit and validates its complete candidate against
 * the frozen Project Document v1 contract before returning it.
 */
export function applyProjectCommand(document: ProjectDocumentV1, command: ProjectCommand): ProjectDocumentV1 {
  switch (command.type) {
    case 'createPoint': {
      const point = createAuthoredPoint(
        nextFeatureId(document.features, 'point'),
        command.coordinates,
        document.features.filter(feature => feature.type === 'Point').length + 1,
      );
      return documentWithParts(document, { features: [...document.features, point] });
    }
    case 'createGeometry':
      return documentWithParts(document, {
        features: [...document.features, createWorkspaceGeometry(document.features, command.geometry)],
      });
    case 'applyGeometry':
      return documentWithParts(document, {
        features: applyWorkspaceGeometry(document.features, command.id, command.geometry),
      });
    case 'createBuffer': {
      const source = requiredFeature(document, command.sourceId);
      const buffer = deriveBufferFeature(source, nextFeatureId(document.features, 'buffer'), command.radius);
      return documentWithParts(document, { features: [...document.features, buffer] });
    }
    case 'importPoints': {
      const imported = importFeaturesIntoWorkspace(command.features, document.features);
      return documentWithParts(document, { features: imported.features });
    }
    case 'deleteFeature': {
      requiredFeature(document, command.id);
      const remaining = markDependentBuffersStale(
        document.features.filter(feature => feature.id !== command.id),
        command.id,
        true,
      );
      const presentations = copyPointPresentations(document.presentation.points);
      delete presentations[command.id];
      return documentWithParts(document, { features: remaining, pointPresentations: presentations });
    }
    case 'renameFeature': {
      requiredFeature(document, command.id);
      const features = document.features.map(feature => feature.id === command.id
        ? renameFeature(feature, command.name)
        : feature);
      return documentWithParts(document, { features });
    }
    case 'toggleFeatureVisibility': {
      const target = requiredFeature(document, command.id);
      return documentWithParts(document, {
        features: document.features.map(feature => feature.id === target.id
          ? { ...feature, visible: !target.visible }
          : feature),
      });
    }
    case 'toggleLayerVisibility': {
      const target = document.layers.find(layer => layer.id === command.layerId);
      if (!target) throw new Error(`Layer "${command.layerId}" no longer exists in the current project.`);
      return documentWithParts(document, {
        layers: document.layers.map(layer => layer.id === target.id
          ? { ...layer, visible: !target.visible }
          : layer),
      });
    }
    case 'updatePointPresentation':
      return applyPointPresentation(document, command.id, command.patch);
    case 'movePoint':
      return movePoint(document, command.id, command.coordinates);
  }
}

function committedState(
  state: ProjectHistoryState,
  candidate: ProjectDocumentV1,
  updatedAt: string,
): ProjectHistoryState {
  const present = documentWithTimestamp(candidate, updatedAt);
  const past = [...state.past, state.present];
  return {
    present,
    past: past.slice(-PROJECT_HISTORY_MAX_SNAPSHOTS),
    future: [],
    transaction: null,
  };
}

export function createProjectHistory(document: ProjectDocumentV1): ProjectHistoryState {
  return { present: decodeProjectDocument(document), past: [], future: [], transaction: null };
}

export function currentProjectDocument(state: ProjectHistoryState): ProjectDocumentV1 {
  return state.transaction?.draft ?? state.present;
}

export function executeProjectCommand(
  state: ProjectHistoryState,
  command: ProjectCommand,
  updatedAt: string,
): ProjectHistoryState {
  if (state.transaction) throw new Error('Project commands must use the active transaction draft until it is committed or cancelled.');
  const candidate = applyProjectCommand(state.present, command);
  if (projectContentEqual(candidate, state.present)) return state;
  return committedState(state, candidate, updatedAt);
}

export function beginProjectTransaction(state: ProjectHistoryState): ProjectHistoryState {
  if (state.transaction) throw new Error('Nested project transactions are not supported.');
  return { ...state, transaction: { draft: state.present } };
}

export function applyProjectTransactionCommand(
  state: ProjectHistoryState,
  command: ProjectCommand,
): ProjectHistoryState {
  if (!state.transaction) throw new Error('No project transaction is active.');
  const candidate = applyProjectCommand(state.transaction.draft, command);
  if (projectContentEqual(candidate, state.transaction.draft)) return state;
  return { ...state, transaction: { draft: candidate } };
}

export function commitProjectTransaction(state: ProjectHistoryState, updatedAt: string): ProjectHistoryState {
  if (!state.transaction) throw new Error('No project transaction is active.');
  if (projectContentEqual(state.transaction.draft, state.present)) {
    return { ...state, transaction: null };
  }
  return committedState(state, state.transaction.draft, updatedAt);
}

export function cancelProjectTransaction(state: ProjectHistoryState): ProjectHistoryState {
  if (!state.transaction) return state;
  return { ...state, transaction: null };
}

export function undoProject(state: ProjectHistoryState, updatedAt: string): ProjectHistoryState {
  if (state.transaction) throw new Error('Undo is unavailable while a project transaction is active.');
  if (state.past.length === 0) return state;
  const target = state.past[state.past.length - 1]!;
  return {
    present: documentWithTimestamp(target, updatedAt),
    past: state.past.slice(0, -1),
    future: [...state.future, state.present],
    transaction: null,
  };
}

export function redoProject(state: ProjectHistoryState, updatedAt: string): ProjectHistoryState {
  if (state.transaction) throw new Error('Redo is unavailable while a project transaction is active.');
  if (state.future.length === 0) return state;
  const target = state.future[state.future.length - 1]!;
  return {
    present: documentWithTimestamp(target, updatedAt),
    past: [...state.past, state.present],
    future: state.future.slice(0, -1),
    transaction: null,
  };
}

export function replaceProject(_state: ProjectHistoryState, document: ProjectDocumentV1): ProjectHistoryState {
  return { present: decodeProjectDocument(document), past: [], future: [], transaction: null };
}

export function canUndoProject(state: ProjectHistoryState): boolean {
  return state.transaction === null && state.past.length > 0;
}

export function canRedoProject(state: ProjectHistoryState): boolean {
  return state.transaction === null && state.future.length > 0;
}
