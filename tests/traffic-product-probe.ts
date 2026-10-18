import { Map, type GeoJSONSource } from 'maplibre-gl';

const maps: Map[] = [];
const on = Map.prototype.on;
Map.prototype.on = function (...args: Parameters<typeof on>) {
  if (!maps.includes(this)) maps.push(this);
  if (args[0] === 'idle' && typeof args[1] === 'function') {
    const listener = args[1];
    args[1] = function (...eventArgs: unknown[]) {
      if (!(window as any).trafficSuppressIdle) return (listener as Function).apply(this, eventArgs);
    } as typeof listener;
  }
  return on.apply(this, args);
} as typeof on;

// Observation of the actual App-owned map, no alternate controller or project store.
Object.assign(window, { trafficProbe: {
  map: () => maps.at(-1)!,
  maps,
  async source(id: string) {
    const map = maps.at(-1)!;
    const source = map.getSource(id) as GeoJSONSource | undefined;
    return source ? source.getData() : { type: 'FeatureCollection', features: [] };
  },
} });
