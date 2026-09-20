import {
  createAuthoredLineString,
  createAuthoredPoint,
  createAuthoredPolygon,
  importFeaturesIntoWorkspace,
  markDependentBuffersStale,
  renameFeature,
  reservedWorkspaceIds,
  type GeometrySnapshot,
  type PointFeature,
  type SpatialFeature,
  type Wgs84Point,
} from './featureModel';

export interface WorkspaceState {
  features: SpatialFeature[];
  selectedFeatureId: string | null;
}

export type WorkspaceAction =
  | { type: 'createPoint'; coordinates: Wgs84Point }
  | { type: 'createGeometry'; geometry: GeometrySnapshot }
  | { type: 'applyGeometry'; id: string; geometry: GeometrySnapshot }
  | { type: 'insert'; feature: SpatialFeature }
  | { type: 'import'; imported: readonly PointFeature[] }
  | { type: 'select'; id: string | null }
  | { type: 'toggleVisibility'; id: string }
  | { type: 'rename'; id: string; name: string }
  | { type: 'delete'; id: string };

export const initialWorkspaceState: WorkspaceState = {
  features: [],
  selectedFeatureId: null,
};

export function nextFeatureId(features: readonly SpatialFeature[], prefix: string): string {
  const used = reservedWorkspaceIds(features);
  let index = 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function createGeometry(features: readonly SpatialFeature[], geometry: GeometrySnapshot): SpatialFeature {
  if (geometry.type === 'Point') {
    throw new Error('Point creation uses the dedicated Point interaction path.');
  }
  if (geometry.type === 'LineString') {
    return createAuthoredLineString(
      nextFeatureId(features, 'line'),
      geometry.coordinates,
      features.filter(feature => feature.type === 'LineString').length + 1,
    );
  }
  return createAuthoredPolygon(
    nextFeatureId(features, 'polygon'),
    geometry.coordinates,
    features.filter(feature => feature.type === 'Polygon' && feature.lineage !== 'derived').length + 1,
  );
}

function coordinatesEqual(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((value, index) => {
    const other = right[index];
    if (Array.isArray(value) && Array.isArray(other)) return coordinatesEqual(value, other);
    return value === other;
  });
}

export function geometryEqual(target: SpatialFeature, geometry: GeometrySnapshot): boolean {
  if (target.type !== geometry.type || geometry.type === 'Point') return false;
  if (target.type === 'LineString' && geometry.type === 'LineString') {
    return coordinatesEqual(target.coordinates, geometry.coordinates);
  }
  if (target.type === 'Polygon' && geometry.type === 'Polygon') {
    return coordinatesEqual(target.coordinates, geometry.coordinates);
  }
  return false;
}

function applyGeometry(features: readonly SpatialFeature[], id: string, geometry: GeometrySnapshot): SpatialFeature[] {
  const target = features.find(feature => feature.id === id);
  if (!target) throw new Error('Selected feature no longer exists.');
  if (target.lineage === 'derived') throw new Error('Derived buffer geometry is read-only in this slice.');
  if (target.type !== geometry.type || geometry.type === 'Point') {
    throw new Error('Only authored LineString and Polygon geometry can be edited in this slice.');
  }
  if (geometryEqual(target, geometry)) return features.slice();
  const updated = features.map(feature => {
    if (feature.id !== id) return feature;
    if (geometry.type === 'LineString' && feature.type === 'LineString') {
      return { ...feature, coordinates: geometry.coordinates };
    }
    if (geometry.type === 'Polygon' && feature.type === 'Polygon') {
      return { ...feature, coordinates: geometry.coordinates };
    }
    return feature;
  });
  return markDependentBuffersStale(updated, id, false);
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'createPoint': {
      const point = createAuthoredPoint(
        nextFeatureId(state.features, 'point'),
        action.coordinates,
        state.features.filter(feature => feature.type === 'Point').length + 1,
      );
      return { features: [...state.features, point], selectedFeatureId: point.id };
    }
    case 'createGeometry': {
      const feature = createGeometry(state.features, action.geometry);
      return { features: [...state.features, feature], selectedFeatureId: feature.id };
    }
    case 'applyGeometry':
      return { ...state, features: applyGeometry(state.features, action.id, action.geometry) };
    case 'insert': {
      if (reservedWorkspaceIds(state.features).has(action.feature.id)) {
        throw new Error('New feature ID collides with an existing workspace feature.');
      }
      return { features: [...state.features, action.feature], selectedFeatureId: action.feature.id };
    }
    case 'import': {
      const next = importFeaturesIntoWorkspace(action.imported, state.features);
      return { features: next.features, selectedFeatureId: next.selectedFeatureId };
    }
    case 'select':
      return { ...state, selectedFeatureId: action.id };
    case 'toggleVisibility':
      return {
        ...state,
        features: state.features.map(feature => feature.id === action.id ? { ...feature, visible: !feature.visible } : feature),
      };
    case 'rename':
      return {
        ...state,
        features: state.features.map(feature => feature.id === action.id ? renameFeature(feature, action.name) : feature),
      };
    case 'delete': {
      const target = state.features.find(feature => feature.id === action.id);
      if (!target) return state;
      const remaining = state.features.filter(feature => feature.id !== action.id);
      return {
        features: markDependentBuffersStale(remaining, target.id, true),
        selectedFeatureId: state.selectedFeatureId === target.id ? null : state.selectedFeatureId,
      };
    }
  }
}
