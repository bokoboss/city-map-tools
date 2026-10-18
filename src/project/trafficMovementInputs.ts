import type { DirectionalInput } from '../map/directionalPath';
import type { ProjectDocumentV2 } from './projectDocument';

/** Pure preparation only. T2B owns connecting these inputs to the map lifecycle. */
export function trafficMovementInputs(document: ProjectDocumentV2): DirectionalInput[] {
  const visibleLayers = new Set(document.layers.filter(layer => layer.visible).map(layer => layer.id));
  return document.features.flatMap(feature => {
    if (!feature.visible || !visibleLayers.has(feature.layerId) || feature.type !== 'LineString' ||
        !Object.hasOwn(document.trafficMovements, feature.id)) return [];
    const { direction, style } = document.trafficMovements[feature.id]!;
    const { animationRate, ...presentation } = style;
    return [{ id: feature.id, coordinates: feature.coordinates.map(point => [...point] as [number, number]),
      direction, ...presentation, visualRatePixelsPerSecond: { slow: 20, medium: 40, fast: 80 }[animationRate] }];
  });
}
