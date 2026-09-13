import { useState } from 'react';
import { importGeoJsonText, exportGeoJson, GEOJSON_MAX_TEXT_LENGTH } from './features/geojson';
import { createAuthoredPoint, createDefaultLayers, renamePoint } from './features/featureModel';
import type { FeatureLayer, PointFeature, Wgs84Point } from './features/featureModel';
import { MapCanvas } from './map/MapCanvas';
import type { EditorMode } from './map/MapCanvas';

function nextPointId(features: readonly PointFeature[], prefix: string): string {
  const used = new Set(features.map(feature => feature.id));
  let index = features.length + 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function uniqueImportedFeatures(imported: readonly PointFeature[], existing: readonly PointFeature[]): PointFeature[] {
  const used = new Set(existing.map(feature => feature.id));
  return imported.map(feature => {
    let id = feature.id;
    let suffix = 2;
    while (used.has(id)) {
      id = `${feature.id}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return id === feature.id ? feature : { ...feature, id };
  });
}

export function App() {
  const [mapSession, setMapSession] = useState(0);
  const [features, setFeatures] = useState<PointFeature[]>([]);
  const [layers, setLayers] = useState<FeatureLayer[]>(createDefaultLayers);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('select');
  const [importStatus, setImportStatus] = useState('No GeoJSON imported.');

  const handleMapPointClick = (coordinates: Wgs84Point) => {
    if (mode !== 'create') {
      setSelectedFeatureId(null);
      return;
    }
    setFeatures(current => {
      const point = createAuthoredPoint(nextPointId(current, 'point'), coordinates, current.length + 1);
      setSelectedFeatureId(point.id);
      setMode('select');
      return [...current, point];
    });
  };

  const handleImportFile = async (file: File) => {
    if (file.size > GEOJSON_MAX_TEXT_LENGTH * 4) {
      setImportStatus(`Import rejected: file exceeds the ${GEOJSON_MAX_TEXT_LENGTH}-character safety limit.`);
      return;
    }
    try {
      const imported = importGeoJsonText(await file.text(), layers);
      const safeImported = uniqueImportedFeatures(imported, features);
      setFeatures(current => [...current, ...uniqueImportedFeatures(imported, current)]);
      setSelectedFeatureId(safeImported[0]?.id || null);
      setMode('select');
      setImportStatus(`Imported ${safeImported.length} Point feature${safeImported.length === 1 ? '' : 's'}; imported values remain unvalidated.`);
    } catch (error) {
      setImportStatus(`Import rejected: ${error instanceof Error ? error.message : 'unsupported GeoJSON input.'}`);
    }
  };

  const handleExport = () => {
    const blob = new Blob([exportGeoJson(features)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'city-map-tools-points.geojson';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setImportStatus(`Exported ${features.length} Point feature${features.length === 1 ? '' : 's'} with lineage and provenance.`);
  };

  return (
    <main className="app">
      <header className="app-header">
        <div><h1>City Map Tools</h1><p>Point and layer workspace · R1A-2 preview</p></div>
        <button type="button" onClick={() => setMapSession(session => session + 1)}>Reload map</button>
      </header>
      <MapCanvas
        key={mapSession}
        features={features}
        layers={layers}
        selectedFeatureId={selectedFeatureId}
        mode={mode}
        importStatus={importStatus}
        onModeChange={setMode}
        onPointSelect={setSelectedFeatureId}
        onMapPointClick={handleMapPointClick}
        onLayerVisibilityChange={id => setLayers(current => current.map(layer => layer.id === id ? { ...layer, visible: !layer.visible } : layer))}
        onFeatureVisibilityChange={id => setFeatures(current => current.map(feature => feature.id === id ? { ...feature, visible: !feature.visible } : feature))}
        onFeatureSelect={setSelectedFeatureId}
        onFeatureRename={(id, name) => setFeatures(current => current.map(feature => feature.id === id ? renamePoint(feature, name) : feature))}
        onImportFile={handleImportFile}
        onExport={handleExport}
      />
      <footer className="app-footer">
        Point editing, selection, visibility, and safe Point-only GeoJSON import/export are available in this slice.
        Engineering analytics remain unavailable; no validated analysis is produced.
      </footer>
    </main>
  );
}
