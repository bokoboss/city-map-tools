import type { FeatureLayer, SpatialFeature, Wgs84Point } from '../features/featureModel';

export const SNAP_TOLERANCE_PX = 12;
export const SNAP_CELL_PX = 32;

export interface ScreenCoordinate { x: number; y: number }
export interface SnapProjection {
  project: (coordinate: Wgs84Point) => ScreenCoordinate;
  unproject: (point: ScreenCoordinate) => Wgs84Point;
  width: number;
  height: number;
}
export interface SnapResult {
  kind: 'vertex' | 'segment';
  featureId: string;
  index: number;
  screen: ScreenCoordinate;
  coordinate: Wgs84Point;
  distancePx: number;
}
export interface SnapDiagnostics {
  totalCandidates: number;
  inspectedCandidates: number;
}
type Candidate = {
  kind: 'vertex' | 'segment';
  featureId: string;
  index: number;
  start: ScreenCoordinate;
  end?: ScreenCoordinate;
  coordinate?: Wgs84Point;
};

const finitePoint = (point: unknown): point is ScreenCoordinate => Boolean(point && typeof point === 'object' &&
  Number.isFinite((point as ScreenCoordinate).x) && Number.isFinite((point as ScreenCoordinate).y));
const validWgs84 = (point: unknown): point is Wgs84Point => Array.isArray(point) && point.length === 2 &&
  typeof point[0] === 'number' && typeof point[1] === 'number' &&
  Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
  point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90;
const cell = (value: number) => Math.floor(value / SNAP_CELL_PX);
const cellKey = (x: number, y: number) => `${x},${y}`;

export class SnapPolicy {
  private readonly cells = new Map<string, Candidate[]>();
  private count = 0;

  constructor(features: readonly SpatialFeature[], layers: readonly FeatureLayer[], private readonly projection: SnapProjection) {
    if (!Number.isFinite(projection.width) || !Number.isFinite(projection.height) ||
        projection.width <= 0 || projection.height <= 0) return;
    const visibleLayers = new Set(layers.filter(layer => layer.visible).map(layer => layer.id));
    for (const feature of features) {
      if (!feature.visible || feature.lineage !== 'authored' || !visibleLayers.has(feature.layerId)) continue;
      const vertices = feature.type === 'Point' ? [feature.coordinates] :
        feature.type === 'LineString' ? feature.coordinates : feature.coordinates[0].slice(0, -1);
      const projected: Array<ScreenCoordinate | null> = vertices.map(coordinate => {
        if (!validWgs84(coordinate)) return null;
        try {
          const point = projection.project(coordinate);
          return finitePoint(point) ? point : null;
        } catch { return null; }
      });
      projected.forEach((point, index) => {
        if (point) this.insert({ kind: 'vertex', featureId: feature.id, index, start: point, coordinate: vertices[index] });
      });
      if (feature.type === 'Point') continue;
      const segmentCount = feature.type === 'Polygon' ? vertices.length : vertices.length - 1;
      for (let index = 0; index < segmentCount; index += 1) {
        const start = projected[index];
        const end = projected[(index + 1) % projected.length];
        if (start && end) this.insert({ kind: 'segment', featureId: feature.id, index, start, end });
      }
    }
  }

  private insert(candidate: Candidate) {
    const minX = Math.max(-SNAP_TOLERANCE_PX, Math.min(candidate.start.x, candidate.end?.x ?? candidate.start.x) - SNAP_TOLERANCE_PX);
    const maxX = Math.min(this.projection.width + SNAP_TOLERANCE_PX, Math.max(candidate.start.x, candidate.end?.x ?? candidate.start.x) + SNAP_TOLERANCE_PX);
    const minY = Math.max(-SNAP_TOLERANCE_PX, Math.min(candidate.start.y, candidate.end?.y ?? candidate.start.y) - SNAP_TOLERANCE_PX);
    const maxY = Math.min(this.projection.height + SNAP_TOLERANCE_PX, Math.max(candidate.start.y, candidate.end?.y ?? candidate.start.y) + SNAP_TOLERANCE_PX);
    if (minX > maxX || minY > maxY) return;
    this.count += 1;
    for (let x = cell(minX); x <= cell(maxX); x += 1) {
      for (let y = cell(minY); y <= cell(maxY); y += 1) {
        const key = cellKey(x, y);
        const bucket = this.cells.get(key) ?? [];
        bucket.push(candidate);
        this.cells.set(key, bucket);
      }
    }
  }

  query(point: ScreenCoordinate, selfId?: string): { result: SnapResult | null; diagnostics: SnapDiagnostics } {
    const empty = { result: null, diagnostics: { totalCandidates: this.count, inspectedCandidates: 0 } };
    if (!finitePoint(point) || point.x < 0 || point.x > this.projection.width ||
        point.y < 0 || point.y > this.projection.height) return empty;
    const candidates = this.cells.get(cellKey(cell(point.x), cell(point.y))) ?? [];
    let best: SnapResult | null = null;
    for (const candidate of candidates) {
      if (candidate.featureId === selfId) continue;
      let screen = candidate.start;
      if (candidate.end) {
        const dx = candidate.end.x - screen.x;
        const dy = candidate.end.y - screen.y;
        const denominator = dx * dx + dy * dy;
        if (!Number.isFinite(denominator)) continue;
        const t = denominator === 0 ? 0 : Math.max(0, Math.min(1,
          ((point.x - screen.x) * dx + (point.y - screen.y) * dy) / denominator));
        screen = { x: screen.x + t * dx, y: screen.y + t * dy };
      }
      const distancePx = Math.hypot(point.x - screen.x, point.y - screen.y);
      if (!Number.isFinite(distancePx) || distancePx > SNAP_TOLERANCE_PX) continue;
      let coordinate = candidate.coordinate;
      if (!coordinate) {
        try { coordinate = this.projection.unproject(screen); } catch { continue; }
      }
      if (!validWgs84(coordinate)) continue;
      const result: SnapResult = { kind: candidate.kind, featureId: candidate.featureId,
        index: candidate.index, screen, coordinate, distancePx };
      if (!best || (result.kind === 'vertex' && best.kind === 'segment') ||
          (result.kind === best.kind && (result.distancePx < best.distancePx ||
          (result.distancePx === best.distancePx && (result.featureId < best.featureId ||
          (result.featureId === best.featureId && result.index < best.index)))))) best = result;
    }
    return { result: best, diagnostics: { totalCandidates: this.count, inspectedCandidates: candidates.length } };
  }
}
