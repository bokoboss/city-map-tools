import { MAX_LINE_VERTICES, validateWgs84LineString } from '../features/featureModel';

export const MOVEMENT_LIMITS = { movements: 24, vertices: MAX_LINE_VERTICES, arrows: 512, updateIntervalMs: 40 } as const;

/** Transient presentation only; never part of Project Document v1. All pixel units are CSS pixels. */
export interface DirectionalInput {
  id: string;
  coordinates: readonly (readonly [number, number])[];
  direction: 'forward' | 'reverse';
  color: string;
  opacity: number;
  lineWidthPixels: number;
  arrowSizePixels: number;
  arrowSpacingPixels: number;
  animationEnabled: boolean;
  visualRatePixelsPerSecond: number;
  /** Positive = right of canonical first-to-last traversal, independent of direction. */
  displayOffsetPixels: number;
  /** Transient T1B controls. Explicit nonzero base offsets opt out unless autoLayout is true. */
  autoLayout?: boolean;
  layoutOrder?: number;
}

export interface DisplayPoint { x: number; y: number }
export interface DisplayPath { points: DisplayPoint[]; ends: number[]; length: number }

export function snapshotInputs(inputs: readonly DirectionalInput[]): DirectionalInput[] {
  if (inputs.length > MOVEMENT_LIMITS.movements) throw new Error(`At most ${MOVEMENT_LIMITS.movements} renderer inputs; reduce the fixture set.`);
  const ids = new Set<string>();
  return inputs.map(input => {
    if (typeof input.id !== 'string' || !input.id || input.id.length > 120 || ids.has(input.id)) throw new Error('Renderer ids must be unique nonempty strings (120 characters maximum).');
    ids.add(input.id);
    const coordinates = validateWgs84LineString(input.coordinates);
    for (let i = 0; i < coordinates.length; i++) {
      const coordinate = coordinates[i]!;
      if (Math.abs(coordinate[1]) > 85 || (i > 0 && Math.abs(coordinate[0] - coordinates[i - 1]![0]) > 180)) {
        throw new Error('T1A display proof supports Web Mercator latitudes ±85° and paths without antimeridian crossings.');
      }
    }
    if (input.direction !== 'forward' && input.direction !== 'reverse') throw new Error('Invalid renderer direction.');
    if (!/^#[0-9a-f]{6}$/i.test(input.color)) throw new Error('Renderer color must be a six-digit hex color.');
    if (typeof input.animationEnabled !== 'boolean') throw new Error('Invalid animation setting.');
    if (input.autoLayout !== undefined && typeof input.autoLayout !== 'boolean') throw new Error('Invalid auto-layout setting.');
    if (input.layoutOrder !== undefined && (!Number.isFinite(input.layoutOrder) || Math.abs(input.layoutOrder) > 1e6)) throw new Error('Invalid transient layout order.');
    const bounds: Array<[number, number, number]> = [
      [input.opacity, 0, 1], [input.lineWidthPixels, 1, 16], [input.arrowSizePixels, 8, 48],
      [input.arrowSpacingPixels, 24, 256], [input.visualRatePixelsPerSecond, 0, 120], [input.displayOffsetPixels, -64, 64],
    ];
    if (bounds.some(([value, min, max]) => !Number.isFinite(value) || value < min || value > max)) throw new Error('Renderer presentation value outside documented T1A bounds.');
    return { ...input, coordinates };
  });
}

/** Offset the projected polyline once, including its joins. Both lines and arrows use this exact track. */
export function buildDisplayPath(projected: readonly DisplayPoint[], offset: number): DisplayPath {
  if (!Number.isFinite(offset) || Math.abs(offset) > 64) throw new Error('Invalid display offset.');
  const points: DisplayPoint[] = [];
  for (const point of projected) {
    if (![point.x, point.y].every(value => Number.isFinite(value) && Math.abs(value) <= 1e8)) throw new Error('Path cannot be projected into the supported display extent.');
    const last = points.at(-1);
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 1e-6) points.push({ ...point });
  }
  if (points.length < 2) throw new Error('Path has no nonzero display segment.');
  const normals = points.slice(1).map((end, i) => {
    const start = points[i]!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    return { x: -(end.y - start.y) / length, y: (end.x - start.x) / length };
  });
  const shifted: DisplayPoint[] = [];
  const append = (p: DisplayPoint, n: DisplayPoint) => shifted.push({ x: p.x + n.x * offset, y: p.y + n.y * offset });
  points.forEach((point, i) => {
    const before = normals[i - 1];
    const after = normals[i];
    if (!before || !after) append(point, (before ?? after)!);
    else {
      const denominator = 1 + before.x * after.x + before.y * after.y;
      // Bounded miter; tight turns use a bevel rather than an unbounded spike.
      if (denominator >= 0.5) append(point, { x: (before.x + after.x) / denominator, y: (before.y + after.y) / denominator });
      else { append(point, before); append(point, after); }
    }
  });
  const ends: number[] = [];
  const track = [shifted[0]!];
  let length = 0;
  for (const point of shifted.slice(1)) {
    const last = track.at(-1)!;
    const segmentLength = Math.hypot(point.x - last.x, point.y - last.y);
    if (segmentLength <= 1e-6) continue;
    length += segmentLength;
    ends.push(length);
    track.push(point);
  }
  if (length === 0) throw new Error('Offset path has no nonzero display segment.');
  return { points: track, ends, length };
}

/** Distance is display pixels, bearing is clockwise from viewport-up; no engineering measurement. */
export function sampleDisplayPath(path: DisplayPath, distance: number, direction: DirectionalInput['direction']) {
  if (!Number.isFinite(distance)) throw new Error('Invalid display position.');
  const along = Math.max(0, Math.min(path.length, distance));
  const canonicalDistance = direction === 'forward' ? along : path.length - along;
  let low = 0;
  let high = path.ends.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (path.ends[middle]! < canonicalDistance) low = middle + 1;
    else high = middle;
  }
  const start = path.points[low]!;
  const end = path.points[low + 1]!;
  const segmentStart = low === 0 ? 0 : path.ends[low - 1]!;
  const ratio = (canonicalDistance - segmentStart) / (path.ends[low]! - segmentStart);
  const bearing = (Math.atan2(end.x - start.x, -(end.y - start.y)) * 180 / Math.PI + (direction === 'reverse' ? 180 : 0) + 360) % 360;
  return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio, bearing };
}

export function arrowCounts(paths: readonly DisplayPath[], spacings: readonly number[]): { counts: number[]; limited: boolean } {
  const requested = paths.map((path, i) => Math.max(1, Math.ceil(path.length / spacings[i]!)));
  const limited = requested.reduce((sum, n) => sum + n, 0) > MOVEMENT_LIMITS.arrows;
  // Equal bounded quota keeps every accepted path readable, including static paths.
  const quota = Math.floor(MOVEMENT_LIMITS.arrows / Math.max(1, paths.length));
  return { counts: requested.map(n => limited ? Math.min(n, quota) : n), limited };
}
