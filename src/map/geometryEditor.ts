import type { Map } from 'maplibre-gl';
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import {
  validateWgs84LineString,
  validateWgs84Polygon,
  type GeometrySnapshot,
  type LineStringFeature,
  type PolygonFeature,
  type Wgs84Point,
} from '../features/featureModel';
import type { ScreenCoordinate, SnapResult } from '../spatial/snapPolicy';

export type GeometryEditorSession =
  | { kind: 'draw'; type: 'LineString' | 'Polygon' }
  | { kind: 'edit'; sourceId: string; type: 'LineString' | 'Polygon'; transientId: string | number };

export interface GeometryEditorCallbacks {
  querySnap: (point: ScreenCoordinate, selfId?: string) => SnapResult | null;
  onFinish: (geometry: GeometrySnapshot) => void;
  onError: (message: string) => void;
}

export interface GeometryEditor {
  readonly hasActiveSession: () => boolean;
  readonly session: () => GeometryEditorSession | null;
  startDraw: (type: 'LineString' | 'Polygon') => boolean;
  beginEdit: (feature: LineStringFeature | PolygonFeature) => boolean;
  getEditGeometry: () => GeometrySnapshot | null;
  cancel: () => GeometryEditorSession | null;
  completeEdit: () => void;
  destroy: () => void;
}

function geometryFromTerraFeature(value: unknown, originals: ReadonlyMap<number, Wgs84Point>, overrides: ReadonlyMap<number, Wgs84Point>, precision: number): GeometrySnapshot {
  if (!value || typeof value !== 'object') throw new Error('Terra Draw did not return a geometry snapshot.');
  const geometry = (value as { geometry?: unknown }).geometry;
  if (!geometry || typeof geometry !== 'object') throw new Error('Terra Draw did not return a geometry object.');
  const candidate = geometry as { type?: unknown; coordinates?: unknown };
  const restore = (coordinates: unknown, polygon: boolean) => {
    const source = polygon ? (coordinates as Wgs84Point[][])?.[0] : coordinates as Wgs84Point[];
    if (!Array.isArray(source)) return coordinates;
    const updated = source.map(point => Array.isArray(point) ? [...point] as Wgs84Point : point);
    const applyExact = (exact: Wgs84Point, index: number) => {
      // Terra Draw may reverse Polygon winding before finish. Match the public
      // snapshot's rounded geographic value, then restore the captured WGS84
      // result. A nearby but different CAD coordinate must never be replaced.
      const matches = (point: Wgs84Point | undefined) => Array.isArray(point) &&
        Number.isFinite(point[0]) && Number.isFinite(point[1]) &&
        Math.abs(point[0] - exact[0]) <= 10 ** -precision &&
        Math.abs(point[1] - exact[1]) <= 10 ** -precision;
      const targetIndex = matches(updated[index]) ? index : updated.findIndex(matches);
      if (targetIndex >= 0) updated[targetIndex] = [exact[0], exact[1]];
    };
    originals.forEach(applyExact);
    overrides.forEach(applyExact);
    if (polygon && updated.length > 1 && Array.isArray(updated[0])) updated[updated.length - 1] = [...updated[0]] as Wgs84Point;
    return polygon ? [updated] : updated;
  };
  if (candidate.type === 'LineString') {
    return { type: 'LineString', coordinates: validateWgs84LineString(restore(candidate.coordinates, false)) };
  }
  if (candidate.type === 'Polygon') {
    return { type: 'Polygon', coordinates: validateWgs84Polygon(restore(candidate.coordinates, true)) };
  }
  throw new Error('Terra Draw returned an unsupported geometry type.');
}

export function createGeometryEditor(map: Map, callbacks: GeometryEditorCallbacks): GeometryEditor {
  let currentSession: GeometryEditorSession | null = null;
  let destroyed = false;
  const exactSnaps = new globalThis.Map<number, Wgs84Point>();
  const originalEditCoordinates = new globalThis.Map<number, Wgs84Point>();
  const adapter = new TerraDrawMapLibreGLAdapter({ map, prefixId: 'city-map-editor' });
  const precision = adapter.getCoordinatePrecision();
  if (!Number.isInteger(precision) || precision < 0 || precision > 15) {
    throw new Error('Terra Draw reported an unsupported coordinate precision.');
  }
  const transientCoordinate = (coordinate: Wgs84Point): Wgs84Point => [
    Number(coordinate[0].toFixed(precision)), Number(coordinate[1].toFixed(precision)),
  ];
  const snapToCustom = (event: { containerX: number; containerY: number }, context: {
    currentCoordinate?: number;
    getCurrentGeometrySnapshot: () => ({ type: 'LineString' | 'Polygon'; coordinates: number[][] | number[][][] }) | null;
  }) => {
    const session = currentSession;
    if (!session) return undefined;
    const snapshot = context.getCurrentGeometrySnapshot();
    const inferredIndex = snapshot?.type === 'Polygon'
      ? snapshot.coordinates[0]?.length ?? 0 : snapshot?.coordinates.length ?? 0;
    const index = Number.isInteger(context.currentCoordinate) && context.currentCoordinate! >= 0
      ? context.currentCoordinate! : inferredIndex;
    const snap = callbacks.querySnap({ x: event.containerX, y: event.containerY },
      session.kind === 'edit' ? session.sourceId : undefined);
    if (!snap) {
      exactSnaps.delete(index);
      return undefined;
    }
    exactSnaps.set(index, [snap.coordinate[0], snap.coordinate[1]]);
    return snap.coordinate;
  };
  const draw = new TerraDraw({
    adapter,
    modes: [
      new TerraDrawSelectMode({
        keyEvents: { deselect: null, delete: null, rotate: null, scale: null },
        flags: {
          linestring: { feature: { draggable: false, rotateable: false, scaleable: false, coordinates: { draggable: true, deletable: false, midpoints: false, snappable: { toCustom: snapToCustom } } } },
          polygon: { feature: { draggable: false, rotateable: false, scaleable: false, coordinates: { draggable: true, deletable: false, midpoints: false, snappable: { toCustom: snapToCustom } } } },
        },
      }),
      new TerraDrawLineStringMode({ keyEvents: { cancel: 'Escape', finish: 'Enter' }, snapping: { toCustom: snapToCustom } }),
      new TerraDrawPolygonMode({ keyEvents: { cancel: 'Escape', finish: 'Enter' }, snapping: { toCustom: snapToCustom } }),
    ],
  });

  const resetTransientStore = () => {
    exactSnaps.clear();
    originalEditCoordinates.clear();
    draw.clear();
    draw.setMode('select');
  };

  draw.on('finish', id => {
    const session = currentSession;
    if (!session || session.kind !== 'draw' || destroyed) return;
    try {
      const geometry = geometryFromTerraFeature(draw.getSnapshotFeature(id), originalEditCoordinates, exactSnaps, precision);
      if (geometry.type !== session.type) throw new Error('Terra Draw finished a geometry in the wrong editor mode.');
      currentSession = null;
      resetTransientStore();
      callbacks.onFinish(geometry);
    } catch (error) {
      currentSession = null;
      resetTransientStore();
      callbacks.onError(`Geometry was not committed: ${error instanceof Error ? error.message : 'invalid editor output.'}`);
    }
  });

  draw.start();
  draw.setMode('select');

  return {
    hasActiveSession: () => currentSession !== null,
    session: () => currentSession,
    startDraw(type) {
      if (destroyed) return false;
      if (currentSession) this.cancel();
      try {
        exactSnaps.clear();
        originalEditCoordinates.clear();
        draw.clear();
        draw.setMode(type === 'LineString' ? 'linestring' : 'polygon');
        currentSession = { kind: 'draw', type };
        return true;
      } catch (error) {
        callbacks.onError(`Geometry editor could not start: ${error instanceof Error ? error.message : 'unknown error.'}`);
        return false;
      }
    },
    beginEdit(feature) {
      if (destroyed) return false;
      if (currentSession) this.cancel();
      try {
        exactSnaps.clear();
        originalEditCoordinates.clear();
        const transientId = draw.getFeatureId();
        const mode = feature.type === 'LineString' ? 'linestring' : 'polygon';
        const vertices = feature.type === 'LineString' ? feature.coordinates : feature.coordinates[0];
        vertices.forEach((coordinate, index) => originalEditCoordinates.set(index, [coordinate[0], coordinate[1]]));
        const geometry = feature.type === 'LineString'
          ? { type: 'LineString' as const, coordinates: feature.coordinates.map(transientCoordinate) }
          : { type: 'Polygon' as const, coordinates: [feature.coordinates[0].map(transientCoordinate)] };
        const result = draw.addFeatures([{
          id: transientId,
          type: 'Feature',
          properties: { mode },
          geometry,
        }]);
        const failure = result.find(validation => !validation.valid);
        if (failure) throw new Error(failure.reason || 'Terra Draw rejected the selected geometry.');
        currentSession = { kind: 'edit', sourceId: feature.id, type: feature.type, transientId };
        draw.setMode('select');
        draw.selectFeature(transientId);
        return true;
      } catch (error) {
        currentSession = null;
        try {
          resetTransientStore();
        } catch {
          // The original error remains the actionable one.
        }
        callbacks.onError(`Geometry edit could not start: ${error instanceof Error ? error.message : 'unknown error.'}`);
        return false;
      }
    },
    getEditGeometry() {
      if (!currentSession || currentSession.kind !== 'edit' || destroyed) return null;
      try {
        const geometry = geometryFromTerraFeature(draw.getSnapshotFeature(currentSession.transientId), originalEditCoordinates, exactSnaps, precision);
        return geometry.type === currentSession.type ? geometry : null;
      } catch (error) {
        callbacks.onError(`Geometry edit could not be read: ${error instanceof Error ? error.message : 'unknown error.'}`);
        return null;
      }
    },
    cancel() {
      const previous = currentSession;
      currentSession = null;
      if (!destroyed) {
        try {
          resetTransientStore();
        } catch (error) {
          callbacks.onError(`Geometry editor cleanup failed: ${error instanceof Error ? error.message : 'unknown error.'}`);
        }
      }
      return previous;
    },
    completeEdit() {
      if (destroyed) return;
      currentSession = null;
      resetTransientStore();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      currentSession = null;
      exactSnaps.clear();
      originalEditCoordinates.clear();
      draw.stop();
    },
  };
}
