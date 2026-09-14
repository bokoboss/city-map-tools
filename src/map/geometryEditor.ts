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
} from '../features/featureModel';

export type GeometryEditorSession =
  | { kind: 'draw'; type: 'LineString' | 'Polygon' }
  | { kind: 'edit'; sourceId: string; type: 'LineString' | 'Polygon'; transientId: string | number };

export interface GeometryEditorCallbacks {
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

function geometryFromTerraFeature(value: unknown): GeometrySnapshot {
  if (!value || typeof value !== 'object') throw new Error('Terra Draw did not return a geometry snapshot.');
  const geometry = (value as { geometry?: unknown }).geometry;
  if (!geometry || typeof geometry !== 'object') throw new Error('Terra Draw did not return a geometry object.');
  const candidate = geometry as { type?: unknown; coordinates?: unknown };
  if (candidate.type === 'LineString') {
    return { type: 'LineString', coordinates: validateWgs84LineString(candidate.coordinates) };
  }
  if (candidate.type === 'Polygon') {
    return { type: 'Polygon', coordinates: validateWgs84Polygon(candidate.coordinates) };
  }
  throw new Error('Terra Draw returned an unsupported geometry type.');
}

export function createGeometryEditor(map: Map, callbacks: GeometryEditorCallbacks): GeometryEditor {
  let currentSession: GeometryEditorSession | null = null;
  let destroyed = false;
  const draw = new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map, prefixId: 'city-map-editor' }),
    modes: [
      new TerraDrawSelectMode({
        keyEvents: { deselect: null, delete: null, rotate: null, scale: null },
        flags: {
          linestring: { feature: { draggable: false, rotateable: false, scaleable: false, coordinates: { draggable: true, deletable: false, midpoints: false } } },
          polygon: { feature: { draggable: false, rotateable: false, scaleable: false, coordinates: { draggable: true, deletable: false, midpoints: false } } },
        },
      }),
      new TerraDrawLineStringMode({ keyEvents: { cancel: 'Escape', finish: 'Enter' } }),
      new TerraDrawPolygonMode({ keyEvents: { cancel: 'Escape', finish: 'Enter' } }),
    ],
  });

  const resetTransientStore = () => {
    draw.clear();
    draw.setMode('select');
  };

  draw.on('finish', id => {
    const session = currentSession;
    if (!session || session.kind !== 'draw' || destroyed) return;
    try {
      const geometry = geometryFromTerraFeature(draw.getSnapshotFeature(id));
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
        const transientId = draw.getFeatureId();
        const mode = feature.type === 'LineString' ? 'linestring' : 'polygon';
        const geometry = feature.type === 'LineString'
          ? { type: 'LineString' as const, coordinates: feature.coordinates }
          : { type: 'Polygon' as const, coordinates: feature.coordinates };
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
        const geometry = geometryFromTerraFeature(draw.getSnapshotFeature(currentSession.transientId));
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
      draw.stop();
    },
  };
}
