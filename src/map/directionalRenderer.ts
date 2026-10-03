import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { arrowCounts, buildDisplayPath, MOVEMENT_LIMITS, sampleDisplayPath, snapshotInputs } from './directionalPath';
import type { DirectionalInput, DisplayPath } from './directionalPath';
import { createDirectionalClock } from './directionalClock';

export const DIRECTIONAL_IDS = {
  tracks: 'city-map-directional-tracks', arrows: 'city-map-directional-arrows',
  line: 'city-map-directional-line', symbol: 'city-map-directional-symbol', image: 'city-map-directional-arrow',
} as const;
type Properties = { movementId: string; color: string; opacity: number; width: number; size: number; offset: number; bearing?: number };
type Track = { input: DirectionalInput; path: DisplayPath; count: number };
const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

/** Small project-owned SDF arrow, pointing up, with no glyph/sprite/network dependency. */
function arrowImage() {
  const size = 40;
  const polygon = [[20, 4], [34, 21], [25, 21], [25, 35], [15, 35], [15, 21], [6, 21]];
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let distance = Infinity;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[j]!;
      const b = polygon[i]!;
      const dx = b[0]! - a[0]!;
      const dy = b[1]! - a[1]!;
      const t = Math.max(0, Math.min(1, ((x - a[0]!) * dx + (y - a[1]!) * dy) / (dx * dx + dy * dy)));
      distance = Math.min(distance, Math.hypot(x - a[0]! - t * dx, y - a[1]! - t * dy));
      if ((a[1]! > y) !== (b[1]! > y) && x < dx * (y - a[1]!) / dy + a[0]!) inside = !inside;
    }
    const index = (y * size + x) * 4;
    data[index] = data[index + 1] = data[index + 2] = 255;
    data[index + 3] = Math.max(0, Math.min(255, Math.round(191 + (inside ? distance : -distance) * 16)));
  }
  return { width: size, height: size, data };
}

/** Map controller owns style hydration; this module owns camera, motion and visibility listeners. */
export function createDirectionalRenderer(map: MapLibreMap) {
  let inputs: DirectionalInput[] = [];
  let key = '[]';
  let tracks: Track[] = [];
  let lines: FeatureCollection<LineString, Properties> = { type: 'FeatureCollection', features: [] };
  let inputRebuilds = 0;
  let projectionRebuilds = 0;
  let sourceUpdates = 0;
  let arrowUpdateMsTotal = 0;
  let arrowUpdateMsMax = 0;
  let arrowFeatures = 0;
  let arrowLimited = false;
  let projectionErrors: string[] = [];
  let destroyed = false;
  let manuallyPaused = false;
  let styleReady = false;
  let projectionDirty = false;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const properties = (input: DirectionalInput): Properties => ({
    movementId: input.id, color: input.color, opacity: input.opacity, width: input.lineWidthPixels,
    size: input.arrowSizePixels / 40, offset: input.displayOffsetPixels,
  });
  const unproject = (point: { x: number; y: number }): [number, number] => {
    const coordinate = map.unproject([point.x, point.y]);
    if (!Number.isFinite(coordinate.lng) || !Number.isFinite(coordinate.lat)) throw new Error('Display track cannot be unprojected at this camera.');
    return [coordinate.lng, coordinate.lat];
  };
  const clock = createDirectionalClock({
    now: () => performance.now(), request: callback => requestAnimationFrame(callback), cancel: id => cancelAnimationFrame(id),
  }, elapsed => {
    // A browser can expose the new media/visibility value before delivering its change event.
    // Recheck at the update boundary so no continuous work survives that delivery gap.
    if (motion.matches || document.hidden) syncClock();
    if (!document.hidden) publishArrows(elapsed);
  });

  function publishArrows(elapsed: number) {
    if (!styleReady || destroyed) return;
    const source = map.getSource(DIRECTIONAL_IDS.arrows) as GeoJSONSource | undefined;
    if (!source) { styleReady = false; clock.pause(); return; }
    const began = performance.now();
    const features: Array<Feature<Point, Properties>> = [];
    for (const track of tracks) {
      const { input, path, count } = track;
      const spacing = path.length / count;
      const phase = input.animationEnabled && !motion.matches ? elapsed * input.visualRatePixelsPerSecond / 1000 : 0;
      for (let i = 0; i < count; i++) {
        const distance = ((i + 0.5) * spacing + phase) % path.length;
        const point = sampleDisplayPath(path, distance, input.direction);
        let coordinates: [number, number];
        try { coordinates = unproject(point); }
        catch {
          const message = `${input.id}: arrow projection unavailable at this camera; change the view.`;
          if (!projectionErrors.includes(message)) projectionErrors.push(message);
          continue;
        }
        features.push({ type: 'Feature', id: `${input.id}:${i}`, properties: { ...properties(input), bearing: point.bearing },
          geometry: { type: 'Point', coordinates } });
      }
    }
    arrowFeatures = features.length;
    source.setData({ type: 'FeatureCollection', features });
    sourceUpdates++;
    const duration = performance.now() - began;
    arrowUpdateMsTotal += duration;
    arrowUpdateMsMax = Math.max(arrowUpdateMsMax, duration);
  }

  function projectTracks() {
    projectionRebuilds++;
    projectionErrors = [];
    const projected: Array<{ input: DirectionalInput; path: DisplayPath; coordinates: [number, number][] }> = [];
    for (const input of inputs) {
      try {
        const path = buildDisplayPath(input.coordinates.map(coordinate => map.project([coordinate[0], coordinate[1]])), input.displayOffsetPixels);
        projected.push({ input, path, coordinates: path.points.map(unproject) });
      } catch (error) {
        projectionErrors.push(`${input.id}: ${error instanceof Error ? error.message : 'Display projection failed.'}`);
      }
    }
    const budget = arrowCounts(projected.map(track => track.path), projected.map(track => track.input.arrowSpacingPixels));
    arrowLimited = budget.limited;
    tracks = projected.map((track, i) => ({ ...track, count: budget.counts[i]! }));
    lines = { type: 'FeatureCollection', features: projected.map(({ input, coordinates }) => ({
      type: 'Feature', id: input.id, properties: properties(input), geometry: { type: 'LineString', coordinates },
    })) };
    projectionDirty = false;
  }

  function syncClock() {
    const animate = styleReady && !destroyed && !manuallyPaused && !document.hidden && !motion.matches &&
      tracks.some(track => track.input.animationEnabled && track.input.visualRatePixelsPerSecond > 0);
    if (animate) clock.resume();
    else clock.pause();
  }

  function refreshProjection() {
    if (destroyed || !styleReady || inputs.length === 0) return;
    if (document.hidden) { projectionDirty = true; return; }
    projectTracks();
    (map.getSource(DIRECTIONAL_IDS.tracks) as GeoJSONSource | undefined)?.setData(lines);
    publishArrows(clock.elapsed());
    syncClock();
  }
  const visibilityChanged = () => {
    if (document.hidden) clock.pause();
    else {
      if (projectionDirty) refreshProjection();
      syncClock();
    }
  };
  const motionChanged = () => { syncClock(); publishArrows(clock.elapsed()); };
  map.on('move', refreshProjection);
  map.on('resize', refreshProjection);
  document.addEventListener('visibilitychange', visibilityChanged);
  motion.addEventListener('change', motionChanged);

  function removeResources() {
    for (const id of [DIRECTIONAL_IDS.symbol, DIRECTIONAL_IDS.line]) if (map.getLayer(id)) map.removeLayer(id);
    for (const id of [DIRECTIONAL_IDS.arrows, DIRECTIONAL_IDS.tracks]) if (map.getSource(id)) map.removeSource(id);
    if (map.hasImage(DIRECTIONAL_IDS.image)) map.removeImage(DIRECTIONAL_IDS.image);
  }

  function rebuildStyle(): boolean {
    if (destroyed) return false;
    if (inputs.length === 0) return true;
    if (styleReady && map.getSource(DIRECTIONAL_IDS.tracks) && map.getSource(DIRECTIONAL_IDS.arrows) && map.getLayer(DIRECTIONAL_IDS.line) && map.getLayer(DIRECTIONAL_IDS.symbol)) return true;
    // Existing resources can accept setData while the GeoJSON worker is busy.
    if (!map.getSource(DIRECTIONAL_IDS.tracks) && !map.isStyleLoaded()) return false;
    if (!map.hasImage(DIRECTIONAL_IDS.image)) map.addImage(DIRECTIONAL_IDS.image, arrowImage(), { sdf: true });
    for (const id of [DIRECTIONAL_IDS.tracks, DIRECTIONAL_IDS.arrows]) {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: empty(), maxzoom: 24, tolerance: 0 });
    }
    if (!map.getLayer(DIRECTIONAL_IDS.line)) map.addLayer({
      id: DIRECTIONAL_IDS.line, type: 'line', source: DIRECTIONAL_IDS.tracks,
      layout: { 'line-cap': 'round', 'line-join': 'bevel' },
      paint: { 'line-color': ['get', 'color'], 'line-opacity': ['get', 'opacity'], 'line-width': ['get', 'width'] },
    });
    if (!map.getLayer(DIRECTIONAL_IDS.symbol)) map.addLayer({
      id: DIRECTIONAL_IDS.symbol, type: 'symbol', source: DIRECTIONAL_IDS.arrows,
      layout: { 'icon-image': DIRECTIONAL_IDS.image, 'icon-size': ['get', 'size'], 'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'viewport', 'icon-pitch-alignment': 'viewport', 'icon-allow-overlap': true, 'icon-ignore-placement': true },
      paint: { 'icon-color': ['get', 'color'], 'icon-opacity': ['get', 'opacity'], 'icon-halo-color': '#ffffff', 'icon-halo-width': 1 },
    });
    styleReady = true;
    refreshProjection();
    return true;
  }

  return {
    updateInputs(next: readonly DirectionalInput[]): { ok: boolean; message: string } {
      if (destroyed) return { ok: false, message: 'Renderer has been destroyed.' };
      let snapshot: DirectionalInput[];
      try { snapshot = snapshotInputs(next); }
      catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Invalid renderer input; previous rendering retained.' }; }
      const nextKey = JSON.stringify(snapshot);
      if (key === nextKey) return { ok: true, message: 'Renderer cache reused.' };
      key = nextKey;
      inputs = snapshot;
      inputRebuilds++;
      if (inputs.length === 0) {
        clock.pause(); removeResources(); tracks = []; lines = { type: 'FeatureCollection', features: [] }; arrowFeatures = 0; arrowLimited = false; projectionErrors = []; styleReady = false;
      } else if (styleReady) refreshProjection();
      else rebuildStyle();
      return { ok: true, message: 'Transient inputs accepted. Inspect diagnostics for projection/arrow-spacing fallback.' };
    },
    rebuildStyle,
    suspendStyle() { styleReady = false; clock.pause(); },
    pause() { manuallyPaused = true; syncClock(); },
    resume() { manuallyPaused = false; syncClock(); },
    diagnostics() {
      return { ...clock.diagnostics(), inputRebuilds, projectionRebuilds, sourceUpdates, arrowFeatures,
        arrowUpdateMsMean: sourceUpdates ? arrowUpdateMsTotal / sourceUpdates : 0, arrowUpdateMsMax,
        animatedArrowFeatures: motion.matches ? 0 : tracks.filter(track => track.input.animationEnabled && track.input.visualRatePixelsPerSecond > 0).reduce((sum, track) => sum + track.count, 0),
        inputs: inputs.length, reducedMotion: motion.matches, hidden: document.hidden, destroyed,
        sources: destroyed ? 0 : [DIRECTIONAL_IDS.tracks, DIRECTIONAL_IDS.arrows].filter(id => map.getSource(id)).length,
        layers: destroyed ? 0 : [DIRECTIONAL_IDS.line, DIRECTIONAL_IDS.symbol].filter(id => map.getLayer(id)).length,
        ownedListeners: destroyed ? 0 : 4,
        limitations: [...projectionErrors, ...(arrowLimited ? [`Arrow cap ${MOVEMENT_LIMITS.arrows}: display spacing increased; all accepted paths retained.`] : [])] };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clock.destroy();
      map.off('move', refreshProjection); map.off('resize', refreshProjection);
      document.removeEventListener('visibilitychange', visibilityChanged);
      motion.removeEventListener('change', motionChanged);
      removeResources(); inputs = []; key = '[]'; tracks = []; lines = { type: 'FeatureCollection', features: [] }; arrowFeatures = 0;
      projectionErrors = []; arrowLimited = false;
    },
  };
}
