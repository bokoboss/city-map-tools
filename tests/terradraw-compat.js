import 'maplibre-gl/dist/maplibre-gl.css';
import { Map, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';

setWorkerUrl(workerUrl);

const status = document.querySelector('#status');
const eventLog = document.querySelector('#events');
const editLineButton = document.querySelector('#edit-line');
const mapElement = document.querySelector('#map');
const events = [];
let map;
let draw;
let destroyed = false;

function coordinateAtEditorPrecision(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function updateStatus(message) {
  status.textContent = message;
}

function committedSnapshot() {
  if (!draw) return [];
  return draw.getSnapshot().filter(feature =>
    (feature.geometry.type === 'LineString' || feature.geometry.type === 'Polygon') &&
    feature.properties.currentlyDrawing !== true,
  );
}

function publish(event, details = {}) {
  events.push({ event, ...details });
  eventLog.textContent = JSON.stringify({ events, committed: committedSnapshot() }, null, 2);
  const firstLine = committedSnapshot().find(feature => feature.geometry.type === 'LineString');
  editLineButton.disabled = !firstLine || destroyed;
}

function removeMap() {
  if (destroyed) return;
  destroyed = true;
  draw?.stop();
  map?.remove();
  publish('cleanup');
  updateStatus('Stopped and removed cleanly.');
}

map = new Map({
  container: mapElement,
  center: [100.5018, 13.7563],
  zoom: 14,
  style: { version: 8, sources: {}, layers: [] },
});

map.once('load', () => {
  draw = new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map, prefixId: 'compat-terra-draw' }),
    modes: [
      new TerraDrawSelectMode(),
      new TerraDrawLineStringMode({ keyEvents: { cancel: 'Escape', finish: 'Enter' } }),
      new TerraDrawPolygonMode({ keyEvents: { cancel: 'Escape', finish: 'Enter' } }),
    ],
  });
  draw.on('ready', () => publish('ready'));
  draw.on('change', (ids, type) => publish('change', { ids, type }));
  draw.on('finish', (id, context) => publish('finish', { id, mode: context.mode }));
  draw.start();
  draw.setMode('select');
  publish('started', { mode: draw.getMode() });
  updateStatus('Ready: MapLibre 6.9 + Terra Draw adapter started.');
});

for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', () => {
    if (!draw || destroyed) return;
    draw.setMode(button.dataset.mode);
    publish('mode', { mode: draw.getMode() });
    updateStatus(`Mode: ${draw.getMode()}`);
  });
}

editLineButton.addEventListener('click', () => {
  if (!draw || destroyed) return;
  const line = committedSnapshot().find(feature => feature.geometry.type === 'LineString');
  if (!line || line.geometry.type !== 'LineString') return;
  const [first] = line.geometry.coordinates;
  if (!first) return;
  draw.updateFeatureGeometry(line.id, {
    type: 'LineString',
    coordinates: line.geometry.coordinates.map(([longitude, latitude], index) => [
      coordinateAtEditorPrecision(longitude + (index === 0 ? 0.0005 : 0)),
      coordinateAtEditorPrecision(latitude + (index === 0 ? 0.0005 : 0)),
    ]),
  });
  publish('edit-coordinate', { id: line.id });
  updateStatus('Edited first LineString coordinate through Terra Draw.');
});

document.querySelector('#clear').addEventListener('click', () => {
  if (!draw || destroyed) return;
  draw.clear();
  publish('clear');
  updateStatus('Cleared Terra Draw store and overlays.');
});

document.querySelector('#destroy').addEventListener('click', removeMap);
window.addEventListener('beforeunload', removeMap, { once: true });
