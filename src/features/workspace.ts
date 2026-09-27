import {
  createAuthoredLineString,
  createAuthoredPolygon,
  geometrySnapshotsEqual,
  markDependentBuffersStale,
  reservedWorkspaceIds,
  type GeometrySnapshot,
  type SpatialFeature,
} from './featureModel';

export function nextFeatureId(features: readonly SpatialFeature[], prefix: string): string {
  const used = reservedWorkspaceIds(features);
  let index = 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

export function createWorkspaceGeometry(
  features: readonly SpatialFeature[],
  geometry: GeometrySnapshot,
): SpatialFeature {
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

export function geometryEqual(target: SpatialFeature, geometry: GeometrySnapshot): boolean {
  if (target.type !== geometry.type || geometry.type === 'Point') return false;
  if (target.type === 'LineString' && geometry.type === 'LineString') {
    return geometrySnapshotsEqual({ type: 'LineString', coordinates: target.coordinates }, geometry);
  }
  if (target.type === 'Polygon' && geometry.type === 'Polygon') {
    return geometrySnapshotsEqual({ type: 'Polygon', coordinates: target.coordinates }, geometry);
  }
  return false;
}

export function applyWorkspaceGeometry(
  features: readonly SpatialFeature[],
  id: string,
  geometry: GeometrySnapshot,
): SpatialFeature[] {
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
