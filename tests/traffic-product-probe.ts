import { Map, type GeoJSONSource } from 'maplibre-gl';

const maps: Map[] = [];
const on = Map.prototype.on;
Map.prototype.on = function (...args: Parameters<typeof on>) {
  if (!maps.includes(this)) maps.push(this);
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
