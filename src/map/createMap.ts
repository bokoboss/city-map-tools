import { Map, Marker, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl';
import type { ExpressionSpecification, GeoJSONSource } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { basemaps, cartoRequestUrl, hasRuntimeCredential, resolveBasemapStyle } from './basemaps';
import type { BasemapId } from './basemaps';
import { createGeometryEditor } from './geometryEditor';
import type { GeometryEditor, GeometryEditorSession } from './geometryEditor';
import { pointMarkerDefinitions } from './pointPresentation';
import type { PointPresentation } from './pointPresentation';
import { SnapPolicy, type ScreenCoordinate, type SnapResult } from '../spatial/snapPolicy';
import {
  isLineStringFeature,
  isPolygonFeature,
  type FeatureLayer,
  type GeometrySnapshot,
  type LineStringFeature,
  type PointFeature,
  type PolygonFeature,
  type SpatialFeature,
} from '../features/featureModel';

// Vite must bundle the worker's shared imports into the production worker asset.
setWorkerUrl(workerUrl);

export type EditorMode = 'select' | 'point' | 'line' | 'polygon' | 'editing';

export interface MapState {
  phase: 'loading' | 'ready' | 'error';
  message: string;
  buildings: 'unavailable' | 'off' | 'on';
  buildingReason: string;
  longitude: number;
  latitude: number;
  zoom: number;
}

export const initialMapState: MapState = {
  phase: 'loading',
  message: 'Loading basemap…',
  buildings: 'unavailable',
  buildingReason: 'Checking the selected basemap…',
  longitude: 100.5018,
  latitude: 13.7563,
  zoom: 14,
};

const buildingLayerId = 'city-map-buildings';
const geometrySourceId = 'city-map-committed-geometry';
const polygonFillLayerId = 'city-map-polygons-fill';
const polygonOutlineLayerId = 'city-map-polygons-outline';
const lineLayerId = 'city-map-lines';
const interactiveGeometryLayerIds = [polygonFillLayerId, polygonOutlineLayerId, lineLayerId];
const lineHitTolerance = 8;
// Pixel-space epsilon only resolves visually coincident strokes. A materially
// nearer line always wins before rendered/canonical topmost ordering applies.
const lineHitTieEpsilon = 0.75;

export interface MapPointOverlay {
  id: string;
  coordinates: PointFeature['coordinates'];
  name: string;
  visible: boolean;
  layerVisible: boolean;
  draggable: boolean;
  color: string;
  selected: boolean;
  presentation: PointPresentation;
}

interface GeometryProperties {
  id: string;
  color: string;
  selected: boolean;
}

interface ScreenPoint {
  x: number;
  y: number;
}

interface MapCallbacks {
  onState: (state: MapState) => void;
  onPointSelect: (id: string) => void;
  onPointDragStart: (id: string, coordinates: PointFeature['coordinates']) => { ok: boolean; message: string };
  onPointDragMove: (id: string, coordinates: PointFeature['coordinates']) => { ok: boolean; message: string };
  onPointDragEnd: (id: string, coordinates: PointFeature['coordinates']) => { ok: boolean; message: string };
  onPointDragCancel: (id: string, message?: string) => void;
  onPointDragStatus: (message: string) => void;
  onGeometrySelect: (id: string) => void;
  onMapPointClick: (coordinates: PointFeature['coordinates']) => void;
  onMapBackgroundClick: () => void;
  onGeometryFinish: (geometry: GeometrySnapshot) => void;
  onEditorError: (message: string) => void;
  onBasemapBlocked: (message: string) => void;
  onSnapStatus: (message: string) => void;
}

function geometryData(
  features: readonly SpatialFeature[],
  layers: readonly FeatureLayer[],
  selectedFeatureId: string | null,
  hiddenFeatureId: string | null,
): FeatureCollection<LineString | Polygon, GeometryProperties> {
  const visibleLayers = new globalThis.Map(layers.map(layer => [layer.id, layer]));
  const mapped: Array<Feature<LineString | Polygon, GeometryProperties>> = [];
  for (const feature of features) {
    if (feature.id === hiddenFeatureId || !feature.visible) continue;
    const layer = visibleLayers.get(feature.layerId);
    if (!layer?.visible || (!isLineStringFeature(feature) && !isPolygonFeature(feature))) continue;
    const geometry = feature.type === 'LineString'
      ? { type: 'LineString' as const, coordinates: feature.coordinates }
      : { type: 'Polygon' as const, coordinates: feature.coordinates };
    mapped.push({
      type: 'Feature',
      id: feature.id,
      properties: { id: feature.id, color: layer.color, selected: feature.id === selectedFeatureId },
      geometry,
    });
  }
  return { type: 'FeatureCollection', features: mapped };
}

function distanceToSegment(point: ScreenPoint, start: ScreenPoint, end: ScreenPoint): number {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX ** 2 + deltaY ** 2;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const position = Math.max(0, Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared));
  return Math.hypot(point.x - (start.x + position * deltaX), point.y - (start.y + position * deltaY));
}

function isInsideScreenRing(point: ScreenPoint, ring: readonly ScreenPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const currentVertex = ring[index];
    const previousVertex = ring[previous];
    if (!currentVertex || !previousVertex) continue;
    const crossesRay = (currentVertex.y > point.y) !== (previousVertex.y > point.y);
    if (crossesRay && point.x < ((previousVertex.x - currentVertex.x) * (point.y - currentVertex.y))
      / (previousVertex.y - currentVertex.y) + currentVertex.x) {
      inside = !inside;
    }
  }
  return inside;
}

function createPinIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('point-marker-pin');
  svg.setAttribute('viewBox', '0 0 24 32');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  // The path's final point is the visual pin tip at the bottom-center of the SVG.
  path.setAttribute('d', 'M12 0C5.4 0 0 5.4 0 12c0 8.8 12 20 12 20s12-11.2 12-20C24 5.4 18.6 0 12 0Z');
  svg.append(path);
  return svg;
}

function createPointMarkerRoot(overlay: MapPointOverlay, onSelect: (id: string) => void): HTMLDivElement {
  const root = document.createElement('div');
  root.className = 'point-marker-root';
  root.dataset.featureId = overlay.id;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'point-marker';
  button.addEventListener('click', event => {
    event.stopPropagation();
    onSelect(overlay.id);
  });

  const dot = document.createElement('span');
  dot.className = 'point-marker-dot';
  dot.setAttribute('aria-hidden', 'true');
  const pin = createPinIcon();
  const label = document.createElement('span');
  label.className = 'point-marker-label';
  label.setAttribute('aria-hidden', 'true');
  button.append(dot, pin, label);
  root.append(button);
  return root;
}

export function createMap(container: HTMLDivElement, callbacks: MapCallbacks) {
  let state = { ...initialMapState };
  let cartoCredential: string | null = null;
  let activeBasemapId: BasemapId = 'osm';
  let disposed = false;
  let loadingTimer: ReturnType<typeof setTimeout>;
  let interactionMode: EditorMode = 'select';
  let editingSourceId: string | null = null;
  let editor: GeometryEditor | null = null;
  let pendingStyleGeometryHydration = true;
  let latestGeometry: {
    features: readonly SpatialFeature[];
    layers: readonly FeatureLayer[];
    selectedFeatureId: string | null;
  } = { features: [], layers: [], selectedFeatureId: null };
  const pointMarkers = new globalThis.Map<string, Marker>();
  const draggablePointIds = new Set<string>();
  const canonicalPointCoordinates = new globalThis.Map<string, PointFeature['coordinates']>();
  type ActivePointDrag = {
    id: string;
    marker: Marker;
    startCoordinates: PointFeature['coordinates'];
  };
  let activePointDrag: ActivePointDrag | null = null;
  let cancelledPointDrag: ActivePointDrag | null = null;
  const map = new Map({
    container,
    center: [state.longitude, state.latitude],
    zoom: state.zoom,
    style: resolveBasemapStyle('osm'),
    transformRequest: url => {
      // Never allow a CARTO subresource to fall back to an anonymous request,
      // including one queued while the user clears the runtime credential.
      if (new URL(url, window.location.href).hostname !== 'basemaps.cartocdn.com') return { url };
      return { url: cartoCredential ? cartoRequestUrl(url, cartoCredential) : 'data:application/json,%7B%7D' };
    },
    attributionControl: { compact: false },
  });
  let snapIndex: SnapPolicy | null = null;
  let activeSnap: SnapResult | null = null;
  const snapIndicator = document.createElement('div');
  snapIndicator.className = 'snap-indicator';
  snapIndicator.hidden = true;
  snapIndicator.setAttribute('aria-hidden', 'true');
  map.getContainer().append(snapIndicator);

  const showSnap = (result: SnapResult | null) => {
    const previous = activeSnap;
    activeSnap = result;
    snapIndicator.hidden = !result;
    if (result) {
      snapIndicator.style.left = `${result.screen.x}px`;
      snapIndicator.style.top = `${result.screen.y}px`;
    }
    if (previous?.kind !== result?.kind) {
      callbacks.onSnapStatus(result ? `${result.kind === 'vertex' ? 'Vertex' : 'Segment'} snap` : '');
    }
  };
  const invalidateSnapIndex = () => {
    snapIndex = null;
    snapIndicator.dataset.index = 'invalidated';
    showSnap(null);
  };
  const rebuildSnapIndex = () => {
    if (disposed || state.phase !== 'ready' || !map.isStyleLoaded() || map.isMoving() || pendingStyleGeometryHydration) {
      invalidateSnapIndex();
      return;
    }
    const canvas = map.getCanvas();
    snapIndex = new SnapPolicy(latestGeometry.features, latestGeometry.layers, {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      project: coordinate => map.project(coordinate),
      unproject: point => {
        const coordinate = map.unproject([point.x, point.y]);
        return [coordinate.lng, coordinate.lat];
      },
    });
    snapIndicator.dataset.index = 'ready';
    showSnap(null);
  };
  const querySnap = (point: ScreenCoordinate, selfId?: string): SnapResult | null => {
    if (!snapIndex || state.phase !== 'ready' || map.isMoving() || pendingStyleGeometryHydration) {
      showSnap(null);
      return null;
    }
    const result = snapIndex.query(point, selfId).result;
    showSnap(result);
    return result;
  };

  const publish = (patch: Partial<MapState>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    callbacks.onState(state);
  };
  const isReady = () => state.phase === 'ready';

  const markerCoordinates = (marker: Marker): PointFeature['coordinates'] => {
    const coordinates = marker.getLngLat();
    return [coordinates.lng, coordinates.lat];
  };

  const syncPointMarkerDraggability = () => {
    pointMarkers.forEach((marker, id) => {
      marker.setDraggable(interactionMode === 'select' && draggablePointIds.has(id));
    });
  };

  const cancelActivePointDrag = (message?: string) => {
    const drag = activePointDrag;
    if (!drag) return;
    activePointDrag = null;
    showSnap(null);
    cancelledPointDrag = drag;
    try {
      drag.marker.setLngLat(drag.startCoordinates);
    } catch {
      // The controller may already be tearing down. The project callback still
      // cancels the transaction so history cannot remain locked.
    }
    callbacks.onPointDragCancel(drag.id, message);
    syncPointMarkerDraggability();
  };

  const setInteractionMode = (mode: EditorMode) => {
    if (interactionMode !== mode) {
      cancelActivePointDrag('Point move cancelled because the editor mode changed. The committed WGS84 position was restored.');
    }
    interactionMode = mode;
    syncPointMarkerDraggability();
  };

  const beginPointDrag = (id: string, marker: Marker) => {
    if (interactionMode !== 'select' || !draggablePointIds.has(id) || activePointDrag) {
      const coordinates = canonicalPointCoordinates.get(id);
      if (coordinates) marker.setLngLat(coordinates);
      callbacks.onPointDragStatus('Only visible authored Points can be moved in Select mode.');
      return;
    }
    const coordinates = canonicalPointCoordinates.get(id) ?? markerCoordinates(marker);
    const drag = { id, marker, startCoordinates: [coordinates[0], coordinates[1]] as PointFeature['coordinates'] };
    activePointDrag = drag;
    cancelledPointDrag = null;
    try {
      const result = callbacks.onPointDragStart(id, drag.startCoordinates);
      if (!result.ok) cancelActivePointDrag(result.message);
    } catch {
      cancelActivePointDrag('Point move could not start. The committed WGS84 position was restored.');
    }
  };

  const movePointDrag = (id: string, marker: Marker) => {
    const drag = activePointDrag;
    if (!drag || drag.id !== id || drag.marker !== marker) {
      if (cancelledPointDrag?.marker === marker) marker.setLngLat(cancelledPointDrag.startCoordinates);
      return;
    }
    try {
      const position = markerCoordinates(marker);
      const projected = map.project(position);
      const snap = querySnap(projected, id);
      const coordinates = snap?.coordinate ?? position;
      if (snap) marker.setLngLat(coordinates);
      const result = callbacks.onPointDragMove(id, coordinates);
      if (!result.ok) cancelActivePointDrag(result.message);
    } catch {
      cancelActivePointDrag('Point move failed validation. The committed WGS84 position was restored.');
    }
  };

  const endPointDrag = (id: string, marker: Marker) => {
    const drag = activePointDrag;
    if (!drag || drag.id !== id || drag.marker !== marker) {
      if (cancelledPointDrag?.marker === marker) {
        marker.setLngLat(cancelledPointDrag.startCoordinates);
        cancelledPointDrag = null;
        syncPointMarkerDraggability();
      }
      return;
    }
    try {
      const position = markerCoordinates(marker);
      const projectedPosition = map.project(position);
      const snap = querySnap(projectedPosition, id);
      const coordinates = snap?.coordinate ?? position;
      const projectedStart = map.project(drag.startCoordinates);
      const projectedEnd = map.project(coordinates);
      // MapLibre's screen-to-coordinate round trip can add subpixel drift when
      // a drag returns to its origin. Compare projected canonical positions
      // within one CSS pixel to recognize that no-op; never derive stored
      // WGS84 from pixels or marker presentation offsets.
      const returnedToOrigin = !snap && Math.hypot(
        projectedEnd.x - projectedStart.x,
        projectedEnd.y - projectedStart.y,
      ) <= 1;
      const result = callbacks.onPointDragEnd(id, returnedToOrigin ? drag.startCoordinates : coordinates);
      if (!result.ok) {
        cancelActivePointDrag(result.message);
        return;
      }
      activePointDrag = null;
      cancelledPointDrag = null;
      showSnap(null);
      callbacks.onPointDragStatus(result.message);
      syncPointMarkerDraggability();
    } catch {
      cancelActivePointDrag('Point move could not be committed. The committed WGS84 position was restored.');
    }
  };

  const removePointMarker = (id: string) => {
    if (activePointDrag?.id === id) {
      cancelActivePointDrag('Point move cancelled because the marker became unavailable. The committed WGS84 position was restored.');
    }
    pointMarkers.get(id)?.remove();
    pointMarkers.delete(id);
    draggablePointIds.delete(id);
    canonicalPointCoordinates.delete(id);
  };

  const renderPointOverlays = (overlays: readonly MapPointOverlay[]) => {
    if (disposed) return;
    const activeIds = new Set<string>();
    overlays.forEach(overlay => {
      canonicalPointCoordinates.set(overlay.id, overlay.coordinates);
      if (!overlay.visible || !overlay.layerVisible) {
        removePointMarker(overlay.id);
        return;
      }
      activeIds.add(overlay.id);
      if (overlay.draggable) draggablePointIds.add(overlay.id);
      else draggablePointIds.delete(overlay.id);
      let marker = pointMarkers.get(overlay.id);
      if (!marker) {
        const root = createPointMarkerRoot(overlay, callbacks.onPointSelect);
        // The root has zero dimensions and represents the canonical geographic hotspot.
        // Icon and label presentation is absolutely positioned from that fixed root.
        const createdMarker = new Marker({ element: root, anchor: 'center' }).setLngLat(overlay.coordinates).addTo(map);
        createdMarker.on('dragstart', () => beginPointDrag(overlay.id, createdMarker));
        createdMarker.on('drag', () => movePointDrag(overlay.id, createdMarker));
        createdMarker.on('dragend', () => endPointDrag(overlay.id, createdMarker));
        marker = createdMarker;
        pointMarkers.set(overlay.id, marker);
      }
      marker.setLngLat(overlay.coordinates);
      marker.setDraggable(interactionMode === 'select' && overlay.draggable);
      const root = marker.getElement();
      const element = root.querySelector<HTMLButtonElement>('.point-marker');
      const dot = root.querySelector<HTMLElement>('.point-marker-dot');
      const pin = root.querySelector<SVGSVGElement>('.point-marker-pin');
      const label = root.querySelector<HTMLElement>('.point-marker-label');
      if (dot) dot.style.backgroundColor = overlay.color;
      if (pin) pin.style.fill = overlay.color;
      if (label) label.textContent = overlay.name;
      if (label) label.hidden = !overlay.presentation.labelVisible;
      if (element) {
        element.classList.toggle('selected', overlay.selected);
        element.dataset.markerKind = overlay.presentation.marker;
        element.dataset.labelPosition = overlay.presentation.labelPosition;
        element.style.setProperty('--point-marker-size', `${overlay.presentation.markerSize}px`);
        element.setAttribute('aria-label', `Select point ${overlay.name}`);
      }
      root.dataset.hotspot = pointMarkerDefinitions[overlay.presentation.marker].hotspot;
    });
    [...pointMarkers.keys()].forEach(id => {
      if (!activeIds.has(id)) removePointMarker(id);
    });
    syncPointMarkerDraggability();
  };

  const ensureGeometryLayers = (): boolean => {
    if (!map.isStyleLoaded()) return false;
    if (!map.getSource(geometrySourceId)) {
      map.addSource(geometrySourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!map.getLayer(polygonFillLayerId)) {
      map.addLayer({
        id: polygonFillLayerId,
        type: 'fill',
        source: geometrySourceId,
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['get', 'selected'], 0.46, 0.22],
        },
      });
    }
    if (!map.getLayer(polygonOutlineLayerId)) {
      map.addLayer({
        id: polygonOutlineLayerId,
        type: 'line',
        source: geometrySourceId,
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['get', 'selected'], 4, 2],
        },
      });
    }
    if (!map.getLayer(lineLayerId)) {
      map.addLayer({
        id: lineLayerId,
        type: 'line',
        source: geometrySourceId,
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['get', 'selected'], 5, 3],
        },
      });
    }
    return true;
  };

  const renderGeometry = (): boolean => {
    if (disposed || !map.isStyleLoaded()) return false;
    try {
      if (!ensureGeometryLayers()) return false;
      const source = map.getSource(geometrySourceId) as GeoJSONSource | undefined;
      if (!source) return false;
      source.setData(geometryData(
        latestGeometry.features,
        latestGeometry.layers,
        latestGeometry.selectedFeatureId,
        editingSourceId,
      ));
      return true;
    } catch {
      callbacks.onEditorError('Committed geometry could not be rendered. Reload the map to retry.');
      return false;
    }
  };

  const hydrateCommittedGeometry = (): boolean => {
    if (!renderGeometry()) return false;
    return interactiveGeometryLayerIds.every(layerId => map.getLayer(layerId) !== undefined);
  };

  const cancelEditor = (): GeometryEditorSession | null => {
    const previous = editor?.cancel() || null;
    showSnap(null);
    if (previous?.kind === 'edit') editingSourceId = null;
    setInteractionMode('select');
    renderGeometry();
    return previous;
  };

  const findVisibleLineAtPoint = (point: ScreenPoint): LineStringFeature | undefined => {
    if (!map.getLayer(lineLayerId)) return undefined;
    const visibleLayerIds = new Set(latestGeometry.layers.filter(layer => layer.visible).map(layer => layer.id));
    const candidates = latestGeometry.features
      .filter(isLineStringFeature)
      .filter(feature => feature.id !== editingSourceId)
      .filter(feature => feature.visible && visibleLayerIds.has(feature.layerId))
      .map(feature => {
        const projected = feature.coordinates.map(coordinates => map.project(coordinates));
        let distance = Number.POSITIVE_INFINITY;
        for (let index = 1; index < projected.length; index += 1) {
          const start = projected[index - 1];
          const end = projected[index];
          if (start && end) distance = Math.min(distance, distanceToSegment(point, start, end));
        }
        return { feature, distance };
      })
      .filter(candidate => candidate.distance <= lineHitTolerance);
    if (candidates.length === 0) return undefined;

    const nearestDistance = Math.min(...candidates.map(candidate => candidate.distance));
    const tied = candidates.filter(candidate => candidate.distance <= nearestDistance + lineHitTieEpsilon);
    if (tied.length === 1) return tied[0]?.feature;

    // Query the rendered line layer only for tied canonical candidates. The
    // expanded pixel box preserves the 8px interaction target while allowing
    // MapLibre's top-to-bottom order to resolve nearby coincident strokes.
    try {
      const rendered = map.queryRenderedFeatures([
        [point.x - lineHitTolerance, point.y - lineHitTolerance],
        [point.x + lineHitTolerance, point.y + lineHitTolerance],
      ], { layers: [lineLayerId] });
      for (const renderedFeature of rendered) {
        const id = renderedFeature.properties?.id;
        if (typeof id !== 'string') continue;
        const candidate = tied.find(entry => entry.feature.id === id);
        if (candidate) return candidate.feature;
      }
    } catch {
      // During style replacement the rendered-feature index can be transiently unavailable.
    }

    // geometryData preserves workspace order in the GeoJSON source, so reverse
    // traversal is the deterministic later/topmost fallback during rehydration.
    return [...tied].reverse()[0]?.feature;
  };

  const findVisiblePolygonAtPoint = (point: ScreenPoint): PolygonFeature | undefined => {
    if (!map.getLayer(polygonFillLayerId) && !map.getLayer(polygonOutlineLayerId)) return undefined;
    const visibleLayerIds = new Set(latestGeometry.layers.filter(layer => layer.visible).map(layer => layer.id));
    const isSelectable = (feature: SpatialFeature | undefined): feature is PolygonFeature => Boolean(feature &&
      isPolygonFeature(feature) &&
      feature.id !== editingSourceId &&
      feature.visible &&
      visibleLayerIds.has(feature.layerId));

    // Rendered fill order owns normal Polygon hit selection. Reconcile each
    // rendered ID to current canonical state before selecting it.
    if (map.getLayer(polygonFillLayerId)) {
      try {
        const rendered = map.queryRenderedFeatures([point.x, point.y], { layers: [polygonFillLayerId] });
        for (const renderedFeature of rendered) {
          const id = renderedFeature.properties?.id;
          if (typeof id !== 'string') continue;
          const candidate = latestGeometry.features.find(feature => feature.id === id);
          if (isSelectable(candidate)) return candidate;
        }
      } catch {
        // During style replacement the rendered-feature index can be transiently unavailable.
      }
    }

    // Canonical projection is the style-rehydration fallback. geometryData
    // preserves feature order in the source, so reverse traversal matches the
    // later/topmost Polygon draw order without adding a z-order subsystem.
    return [...latestGeometry.features].reverse()
      .filter(isPolygonFeature)
      .filter(isSelectable)
      .find(feature => isInsideScreenRing(point, feature.coordinates[0].map(coordinates => map.project(coordinates))));
  };

  const createEditor = () => {
    if (disposed || editor) return;
    try {
      editor = createGeometryEditor(map, {
        querySnap,
        onFinish(geometry) {
          showSnap(null);
          setInteractionMode('select');
          renderGeometry();
          callbacks.onGeometryFinish(geometry);
        },
        onError(message) {
          if (!editor?.hasActiveSession() && (interactionMode === 'line' || interactionMode === 'polygon')) {
            setInteractionMode('select');
          }
          callbacks.onEditorError(message);
        },
      });
    } catch {
      callbacks.onEditorError('Geometry editor could not start. Drawing is unavailable until the map is reloaded.');
    }
  };

  const fail = () => {
    invalidateSnapIndex();
    clearTimeout(loadingTimer);
    if (disposed || state.phase === 'error') return;
    publish({
      phase: 'error',
      message: 'Basemap or map resource unavailable. Switch basemap or reload the map to retry.',
      buildings: 'unavailable',
      buildingReason: '3D unavailable while map resources have an error.',
    });
    // A failed provider must not leave visible 3D behind a disabled control.
    try {
      if (map.getLayer(buildingLayerId)) map.setLayoutProperty(buildingLayerId, 'visibility', 'none');
      map.jumpTo({ pitch: 0 });
    } catch {
      publish({ buildingReason: '3D unavailable: map rendering failed. Reload the map to clear the view.' });
    }
  };

  const startLoading = () => {
    invalidateSnapIndex();
    clearTimeout(loadingTimer);
    publish({
      phase: 'loading', message: 'Loading basemap…', buildings: 'unavailable',
      buildingReason: 'Checking the selected basemap…',
    });
    loadingTimer = setTimeout(fail, 20000);
  };

  const configureBuildings = () => {
    if (basemaps[activeBasemapId].buildings === 'unavailable') {
      publish({ buildings: 'unavailable', buildingReason: '3D unavailable: this raster basemap has no vector building source.' });
      return;
    }
    const style = map.getStyle();
    const building = style.layers.find(layer =>
      layer.type === 'fill' && layer['source-layer'] === 'building' &&
      style.sources[layer.source]?.type === 'vector',
    );
    if (!building || building.type !== 'fill') {
      publish({ buildings: 'unavailable', buildingReason: '3D unavailable: this basemap has no compatible vector building source.' });
      return;
    }

    // Only provider-supplied numeric heights are extruded; missing heights stay absent.
    const height: ExpressionSpecification = ['number', ['get', 'render_height'], ['get', 'height'], 0];
    try {
      map.addLayer({
        id: buildingLayerId,
        type: 'fill-extrusion',
        source: building.source,
        'source-layer': building['source-layer'],
        minzoom: 14,
        filter: ['>', height, 0],
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': '#536b79',
          'fill-extrusion-height': height,
          'fill-extrusion-base': ['max', 0, ['number', ['get', 'render_min_height'], ['get', 'min_height'], 0]],
          'fill-extrusion-opacity': 0.8,
        },
      });
      if (state.phase !== 'error' && map.getLayer(buildingLayerId)) {
        publish({ buildings: 'off', buildingReason: 'Provider heights in metres, where supplied; zoom 14+. Visualization only, not surveyed or validated engineering data.' });
      }
    } catch {
      publish({ buildings: 'unavailable', buildingReason: '3D unavailable: the provider building layer could not be configured.' });
    }
  };

  map.on('error', fail);
  map.on('style.load', () => {
    invalidateSnapIndex();
    configureBuildings();
    createEditor();
    // MapLibre can emit style.load before its style is queryable during a full
    // external-style replacement. Leave a bounded idle retry rather than
    // dropping committed geometry until the next React state change.
    pendingStyleGeometryHydration = !hydrateCommittedGeometry();
  });
  map.on('idle', () => {
    if (pendingStyleGeometryHydration) {
      pendingStyleGeometryHydration = !hydrateCommittedGeometry();
    }
    // Do not let idle silently clear an error from a failed tile/style request.
    if (state.phase === 'loading' && map.areTilesLoaded()) {
      clearTimeout(loadingTimer);
      publish({ phase: 'ready', message: 'Map ready' });
    }
    if (!snapIndex) rebuildSnapIndex();
  });
  map.on('movestart', invalidateSnapIndex);
  map.on('moveend', () => {
    const center = map.getCenter();
    publish({ longitude: center.lng, latitude: center.lat, zoom: map.getZoom() });
    rebuildSnapIndex();
  });
  map.on('resize', () => {
    invalidateSnapIndex();
    rebuildSnapIndex();
  });
  map.on('click', event => {
    if (disposed) return;
    if (interactionMode === 'point') {
      callbacks.onMapPointClick([event.lngLat.lng, event.lngLat.lat]);
      return;
    }
    if (interactionMode !== 'select' || editor?.hasActiveSession()) return;
    // A derived Polygon overlaps its source LineString. Querying rendered features can
    // omit the coincident line, so the canonical line geometry owns its visible stroke.
    const lineHit = findVisibleLineAtPoint(event.point);
    if (lineHit) {
      callbacks.onGeometrySelect(lineHit.id);
      return;
    }
    // The same canonical projection keeps authored polygon selection stable when
    // a style is still rebuilding its rendered-feature index.
    const polygonHit = findVisiblePolygonAtPoint(event.point);
    if (polygonHit) {
      callbacks.onGeometrySelect(polygonHit.id);
      return;
    }
    const renderedGeometryLayers = interactiveGeometryLayerIds.filter(layerId => map.getLayer(layerId));
    if (renderedGeometryLayers.length === 0) {
      callbacks.onMapBackgroundClick();
      return;
    }
    const hitIds = map.queryRenderedFeatures(event.point, { layers: renderedGeometryLayers })
      .map(feature => feature.properties?.id)
      .filter((id): id is string => typeof id === 'string');
    const visibleLayerIds = new Set(latestGeometry.layers.filter(layer => layer.visible).map(layer => layer.id));
    const candidates = hitIds
      .map(id => latestGeometry.features.find(feature => feature.id === id))
      .filter((feature): feature is SpatialFeature => Boolean(feature &&
        feature.id !== editingSourceId &&
        feature.visible &&
        visibleLayerIds.has(feature.layerId)));
    const selected = candidates[0];
    if (selected) callbacks.onGeometrySelect(selected.id);
    else callbacks.onMapBackgroundClick();
  });
  map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new ScaleControl({ unit: 'metric' }));
  const cancelPointDragOnEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !activePointDrag) return;
    event.preventDefault();
    cancelActivePointDrag('Point move cancelled. The committed WGS84 position was restored.');
  };
  window.addEventListener('keydown', cancelPointDragOnEscape);
  const resizeObserver = new ResizeObserver(() => map.resize());
  resizeObserver.observe(container);
  startLoading();

  return {
    setBasemap(id: BasemapId, suppliedCredential?: string): boolean {
      if (editor?.hasActiveSession()) {
        callbacks.onBasemapBlocked('Finish or cancel the active geometry draft before switching basemap; no work was discarded.');
        return false;
      }
      const credential = suppliedCredential ?? cartoCredential;
      if (basemaps[id].credentialPolicy === 'runtime-BYOK-required' && !hasRuntimeCredential(credential)) {
        callbacks.onBasemapBlocked('CARTO Voyager requires your runtime CARTO Basemaps API key. The current map and project are unchanged.');
        return false;
      }
      const style = resolveBasemapStyle(id, credential);
      if (id === 'voyager' && suppliedCredential !== undefined) cartoCredential = suppliedCredential.trim();
      cancelActivePointDrag('Point move cancelled because the basemap changed. The committed WGS84 position was restored.');
      editor?.destroy();
      editor = null;
      pendingStyleGeometryHydration = true;
      startLoading();
      map.jumpTo({ pitch: 0 });
      try {
        // Full style replacement removes custom layers and editor adapter layers.
        activeBasemapId = id;
        map.setStyle(style, { diff: false });
        return true;
      } catch {
        fail();
        return false;
      }
    },
    clearCartoCredential(): boolean {
      if (activeBasemapId === 'voyager' && !this.setBasemap('osm')) return false;
      cartoCredential = null;
      return true;
    },
    setPointOverlays(overlays: readonly MapPointOverlay[]) {
      renderPointOverlays(overlays);
    },
    setGeometryOverlays(features: readonly SpatialFeature[], layers: readonly FeatureLayer[], selectedFeatureId: string | null) {
      const targetsChanged = latestGeometry.features !== features || latestGeometry.layers !== layers;
      latestGeometry = { features, layers, selectedFeatureId };
      renderGeometry();
      // Point transaction drafts only move the current/self feature. Keep the
      // committed target index stable during the gesture; self is excluded at query.
      if (targetsChanged && !activePointDrag) {
        invalidateSnapIndex();
        rebuildSnapIndex();
      }
    },
    setEditorMode(mode: Exclude<EditorMode, 'editing'>): boolean {
      if (mode === 'select' || mode === 'point') {
        cancelEditor();
        setInteractionMode(mode);
        return true;
      }
      if (!editor) {
        callbacks.onEditorError('Geometry editor is not ready yet. Wait for the map to finish loading.');
        return false;
      }
      // Own the transition at the controller boundary so an edit cancellation
      // also clears editingSourceId and restores committed geometry rendering.
      cancelEditor();
      const started = editor.startDraw(mode === 'line' ? 'LineString' : 'Polygon');
      if (started) setInteractionMode(mode);
      return started;
    },
    beginEdit(feature: LineStringFeature | PolygonFeature): boolean {
      if (!editor || editor.hasActiveSession()) return false;
      const started = editor.beginEdit(feature);
      if (started) {
        editingSourceId = feature.id;
        setInteractionMode('editing');
        renderGeometry();
      }
      return started;
    },
    getEditGeometry(): GeometrySnapshot | null {
      return editor?.getEditGeometry() || null;
    },
    completeEdit() {
      editor?.completeEdit();
      showSnap(null);
      editingSourceId = null;
      setInteractionMode('select');
      renderGeometry();
    },
    cancelEditor,
    hasActiveEditorSession(): boolean {
      return editor?.hasActiveSession() || false;
    },
    session(): GeometryEditorSession | null {
      return editor?.session() || null;
    },
    toggleBuildings() {
      if (!isReady() || state.buildings === 'unavailable') return;
      const enabled = state.buildings !== 'on';
      try {
        map.setLayoutProperty(buildingLayerId, 'visibility', enabled ? 'visible' : 'none');
        if (!isReady()) return;
        map.easeTo({ pitch: enabled ? 55 : 0 });
        publish({ buildings: enabled ? 'on' : 'off' });
      } catch {
        publish({ buildings: 'unavailable', buildingReason: '3D unavailable: the building layer could not be updated. Reload the map to retry.' });
      }
    },
    destroy() {
      cancelActivePointDrag();
      invalidateSnapIndex();
      disposed = true;
      clearTimeout(loadingTimer);
      editor?.destroy();
      editor = null;
      pointMarkers.forEach(marker => marker.remove());
      pointMarkers.clear();
      window.removeEventListener('keydown', cancelPointDragOnEscape);
      resizeObserver.disconnect();
      map.remove();
    },
  };
}
