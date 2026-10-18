import { isRecord, type SpatialFeature } from '../features/featureModel';
import { ProjectDocumentValidationError } from './projectDocumentV1';

export const MAX_TRAFFIC_MOVEMENTS = 24;
export type TrafficMovementDirection = 'forward' | 'reverse';
export interface TrafficMovementStyleV2 {
  color: string;
  opacity: number;
  lineWidthPixels: number;
  arrowSizePixels: number;
  arrowSpacingPixels: number;
  animationEnabled: boolean;
  animationRate: 'slow' | 'medium' | 'fast';
  autoLayout: boolean;
  displayOffsetPixels: number;
  layoutOrder: number;
}
export interface TrafficMovementV2 {
  direction: TrafficMovementDirection;
  style: TrafficMovementStyleV2;
}
export const DEFAULT_TRAFFIC_MOVEMENT_STYLE: Readonly<TrafficMovementStyleV2> = Object.freeze({
  color: '#2563eb', opacity: 1, lineWidthPixels: 3, arrowSizePixels: 24,
  arrowSpacingPixels: 80, animationEnabled: true, animationRate: 'medium',
  autoLayout: true, displayOffsetPixels: 0, layoutOrder: 0,
});

function invalid(message: string): never { throw new ProjectDocumentValidationError(`Traffic Movement: ${message}`); }
function exact(value: unknown, keys: readonly string[], partial = false): asserts value is Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).some(key => !keys.includes(key)) ||
      (!partial && keys.some(key => !Object.hasOwn(value, key)))) invalid('missing or unsupported property.');
}

export function validateTrafficMovementStylePatch(value: unknown): asserts value is Partial<TrafficMovementStyleV2> {
  exact(value, Object.keys(DEFAULT_TRAFFIC_MOVEMENT_STYLE), true);
  for (const [key, entry] of Object.entries(value)) {
    switch (key) {
      case 'color':
        if (typeof entry !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(entry)) invalid('color must be six-digit hex.');
        break;
      case 'animationEnabled': case 'autoLayout':
        if (typeof entry !== 'boolean') invalid(`${key} must be boolean.`);
        break;
      case 'animationRate':
        if (!['slow', 'medium', 'fast'].includes(entry as string)) invalid('invalid animation rate.');
        break;
      default: {
        const bounds: Record<string, readonly [number, number]> = {
          opacity: [0, 1], lineWidthPixels: [1, 16], arrowSizePixels: [8, 48],
          arrowSpacingPixels: [24, 256], displayOffsetPixels: [-64, 64], layoutOrder: [-24, 24],
        };
        const [min, max] = bounds[key]!;
        if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < min || entry > max ||
            (key === 'layoutOrder' && !Number.isInteger(entry))) invalid(`${key} is outside its finite bounds.`);
      }
    }
  }
}

export function cloneTrafficMovements(value: unknown, features: readonly SpatialFeature[]): Record<string, TrafficMovementV2> {
  if (!isRecord(value) || Object.keys(value).length > MAX_TRAFFIC_MOVEMENTS) invalid('expected a map of at most 24 entries.');
  const byId = new Map(features.map(feature => [feature.id, feature]));
  const result = Object.create(null) as Record<string, TrafficMovementV2>;
  for (const id of Object.keys(value)) {
    const feature = byId.get(id);
    if (!feature || feature.type !== 'LineString' || feature.lineage !== 'authored') invalid('reference must resolve to an authored LineString.');
    const movement = value[id];
    exact(movement, ['direction', 'style']);
    if (movement.direction !== 'forward' && movement.direction !== 'reverse') invalid('invalid direction.');
    exact(movement.style, Object.keys(DEFAULT_TRAFFIC_MOVEMENT_STYLE));
    validateTrafficMovementStylePatch(movement.style);
    const sourceStyle = movement.style;
    const style = Object.fromEntries((Object.keys(DEFAULT_TRAFFIC_MOVEMENT_STYLE) as Array<keyof TrafficMovementStyleV2>)
      .map(key => [key, sourceStyle[key]])) as unknown as TrafficMovementStyleV2;
    result[id] = { direction: movement.direction, style };
  }
  return result;
}
