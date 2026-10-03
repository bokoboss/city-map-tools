import { Map, type GeoJSONSource } from 'maplibre-gl';
import { createMap } from '../src/map/createMap';
import { DIRECTIONAL_IDS } from '../src/map/directionalRenderer';
import { MOVEMENT_LIMITS, type DirectionalInput } from '../src/map/directionalPath';

/** Browser-proof-only harness, using the real accepted map controller. No production entry imports this. */
export function mountDirectionalProof(container: HTMLDivElement) {
  let map!: Map;
  const on = Map.prototype.on;
  // Capture the controller-owned Map for resource/pixel inspection entirely in test code.
  Map.prototype.on = function (...args: Parameters<typeof on>) { map = this; return on.apply(this, args); } as typeof on;
  let state = 'loading';
  let controller: ReturnType<typeof createMap>;
  try {
    controller = createMap(container, {
      onState: next => { state = next.phase; }, onPointSelect() {}, onGeometrySelect() {}, onMapPointClick() {},
      onMapBackgroundClick() {}, onGeometryFinish() {}, onEditorError(message) { throw new Error(message); },
      onBasemapBlocked(message) { throw new Error(message); }, onSnapStatus() {}, onPointDragStatus() {}, onPointDragCancel() {},
      onPointDragStart: () => ({ ok: true, message: '' }), onPointDragMove: () => ({ ok: true, message: '' }), onPointDragEnd: () => ({ ok: true, message: '' }),
    });
  } finally { Map.prototype.on = on; }
  const common = { direction: 'forward' as const, color: '#0077cc', opacity: 1, lineWidthPixels: 3,
    arrowSizePixels: 24, arrowSpacingPixels: 64, animationEnabled: true, visualRatePixelsPerSecond: 32, displayOffsetPixels: 0 };
  const fromScreen = (points: number[][]): Array<[number, number]> => points.map(point => {
    const coordinate = map.unproject([point[0]!, point[1]!]); return [coordinate.lng, coordinate.lat];
  });
  let fixtures: DirectionalInput[] = [];
  let original = '';
  const mapListeners: Array<{ type: string; callback: unknown }> = [];
  const removedMapListeners = new Set<unknown>();
  const mapOn = map.on;
  const mapOff = map.off;
  let installing = false;
  map.on = function (...args: Parameters<typeof mapOn>) {
    if (installing && (args[0] === 'move' || args[0] === 'resize')) mapListeners.push({ type: args[0], callback: args[1] });
    return mapOn.apply(this, args);
  } as typeof mapOn;
  map.off = function (...args: Parameters<typeof mapOff>) {
    if (mapListeners.some(record => record.type === args[0] && record.callback === args[1])) removedMapListeners.add(args[1]);
    return mapOff.apply(this, args);
  } as typeof mapOff;
  const runtimeListeners: Array<{ target: EventTarget; type: string; listener: unknown; removed: boolean }> = [];
  const add = document.addEventListener;
  const remove = document.removeEventListener;
  document.addEventListener = function (type, listener, options) {
    if (installing && type === 'visibilitychange') runtimeListeners.push({ target: this, type, listener, removed: false });
    return add.call(this, type, listener, options);
  };
  document.removeEventListener = function (type, listener, options) {
    for (const record of runtimeListeners) if (record.target === this && record.type === type && record.listener === listener) record.removed = true;
    return remove.call(this, type, listener, options);
  };
  const matchMedia = window.matchMedia;
  let motionTarget: MediaQueryList | null = null;
  window.matchMedia = function (query) {
    const media = matchMedia.call(this, query);
    if (installing && query === '(prefers-reduced-motion: reduce)') motionTarget = media;
    const mediaAdd = media.addEventListener;
    const mediaRemove = media.removeEventListener;
    media.addEventListener = function (type, listener, options) {
      if (installing && type === 'change') runtimeListeners.push({ target: this, type, listener, removed: false });
      return mediaAdd.call(this, type, listener, options);
    };
    media.removeEventListener = function (type, listener, options) {
      for (const record of runtimeListeners) if (record.target === this && record.type === type && record.listener === listener) record.removed = true;
      return mediaRemove.call(this, type, listener, options);
    };
    return media;
  };
  return {
    state: () => state,
    install() {
      const straight = fromScreen([[80, 120], [350, 120], [650, 120]]);
      const curve = fromScreen([[80, 260], [170, 255], [250, 280], [300, 340], [310, 410]]);
      const uturn = fromScreen([[450, 260], [610, 260], [660, 285], [675, 330], [650, 365], [610, 380], [450, 380]]);
      fixtures = [
        { ...common, id: 'straight-forward', coordinates: straight, displayOffsetPixels: -14 },
        { ...common, id: 'straight-reverse', coordinates: straight, direction: 'reverse', color: '#d45500', displayOffsetPixels: 14 },
        { ...common, id: 'curve-forward', coordinates: curve, displayOffsetPixels: -12 },
        { ...common, id: 'curve-reverse', coordinates: curve, direction: 'reverse', color: '#d45500', displayOffsetPixels: 12 },
        { ...common, id: 'uturn', coordinates: uturn, color: '#8040bb' },
        { ...common, id: 'cross-east', coordinates: fromScreen([[400, 500], [680, 500]]), color: '#159050' },
        { ...common, id: 'cross-north', coordinates: fromScreen([[540, 580], [540, 420]]), color: '#be3566' },
      ];
      original = JSON.stringify(fixtures.map(input => input.coordinates));
      installing = true;
      try { return controller.setDirectionalInputs(fixtures); }
      finally { installing = false; document.addEventListener = add; window.matchMedia = matchMedia; }
    },
    async data() {
      const lineSource = map.getSource(DIRECTIONAL_IDS.tracks) as GeoJSONSource | undefined;
      const arrowSource = map.getSource(DIRECTIONAL_IDS.arrows) as GeoJSONSource | undefined;
      return { lines: await lineSource?.getData(), arrows: await arrowSource?.getData() };
    },
    project(coordinates: [number, number]) { const point = map.project(coordinates); return { x: point.x, y: point.y }; },
    fixtures: () => fixtures,
    unchanged: () => original === JSON.stringify(fixtures.map(input => input.coordinates)),
    listenerEvidence: () => ({ registered: mapListeners.length + runtimeListeners.length,
      removed: mapListeners.filter(record => removedMapListeners.has(record.callback)).length + runtimeListeners.filter(record => record.removed).length }),
    diagnostics: () => controller.directionalDiagnostics(),
    notifyMotion() { motionTarget?.dispatchEvent(new Event('change')); },
    static(enabled: boolean) { fixtures = fixtures.map(input => ({ ...input, animationEnabled: !enabled })); return controller.setDirectionalInputs(fixtures); },
    reuse() { return controller.setDirectionalInputs(JSON.parse(JSON.stringify(fixtures))); },
    invalid() { return controller.setDirectionalInputs([...fixtures, { ...fixtures[0]!, opacity: NaN, id: 'bad' }]); },
    overCap() { return controller.setDirectionalInputs(Array.from({ length: 25 }, (_, i) => ({ ...fixtures[0]!, id: String(i) }))); },
    atCap() {
      const coordinates = fromScreen(Array.from({ length: MOVEMENT_LIMITS.vertices }, (_, i) => [-20000 + i * 40000 / (MOVEMENT_LIMITS.vertices - 1), 300 + (i % 2)]));
      return controller.setDirectionalInputs(Array.from({ length: MOVEMENT_LIMITS.movements }, (_, i) => ({ ...common, id: `cap-${i}`, coordinates, displayOffsetPixels: i * 4 - 48, arrowSpacingPixels: 24 })));
    },
    camera() { map.jumpTo({ zoom: map.getZoom() + 0.2, bearing: 25, pitch: 35 }); },
    resetCamera() { map.jumpTo({ center: [100.5018, 13.7563], zoom: 14, bearing: 0, pitch: 0 }); },
    switchStyle(voyager: boolean) { return controller.setBasemap(voyager ? 'voyager' : 'osm', voyager ? 'synthetic-proof-key' : undefined); },
    resourceIds() { const style = map.getStyle(); return { sources: Object.keys(style.sources).filter(id => id.startsWith('city-map-directional')), layers: style.layers.map(layer => layer.id).filter(id => id.startsWith('city-map-directional')) }; },
    async renderedAlignment() {
      const arrows = await (map.getSource(DIRECTIONAL_IDS.arrows) as GeoJSONSource).getData() as import('geojson').FeatureCollection<import('geojson').Point>;
      const visible = arrows.features.filter(feature => {
        const p = map.project(feature.geometry.coordinates as [number, number]);
        return p.x > 30 && p.y > 30 && p.x < 730 && p.y < 570;
      });
      return visible.map(feature => {
        const p = map.project(feature.geometry.coordinates as [number, number]);
        return { id: feature.properties!.movementId,
          line: map.queryRenderedFeatures(p, { layers: [DIRECTIONAL_IDS.line] }).some(hit => hit.properties?.movementId === feature.properties!.movementId),
          symbol: map.queryRenderedFeatures(p, { layers: [DIRECTIONAL_IDS.symbol] }).some(hit => hit.properties?.movementId === feature.properties!.movementId) };
      });
    },
    destroy() { controller.destroy(); document.removeEventListener = remove; },
  };
}
