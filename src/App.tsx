import { useReducer, useState } from 'react';
import { importGeoJsonText, exportGeoJson, GEOJSON_MAX_TEXT_LENGTH } from './features/geojson';
import { createAuthoredPoint, createDefaultLayers, importFeaturesIntoWorkspace, renamePoint } from './features/featureModel';
import type { FeatureLayer, PointFeature, Wgs84Point } from './features/featureModel';
import { MapCanvas } from './map/MapCanvas';
import type { EditorMode } from './map/MapCanvas';

function nextPointId(features: readonly PointFeature[], prefix: string): string {
  const used = new Set(features.map(feature => feature.id));
  let index = features.length + 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

interface FeatureState {
  features: PointFeature[];
  selectedFeatureId: string | null;
}

type FeatureAction =
  | { type: 'create'; coordinates: Wgs84Point }
  | { type: 'import'; imported: readonly PointFeature[] }
  | { type: 'select'; id: string | null }
  | { type: 'toggleVisibility'; id: string }
  | { type: 'rename'; id: string; name: string };

function featureReducer(state: FeatureState, action: FeatureAction): FeatureState {
  switch (action.type) {
    case 'create': {
      const point = createAuthoredPoint(nextPointId(state.features, 'point'), action.coordinates, state.features.length + 1);
      return { features: [...state.features, point], selectedFeatureId: point.id };
    }
    case 'import': {
      const next = importFeaturesIntoWorkspace(action.imported, state.features);
      return { features: next.features, selectedFeatureId: next.selectedFeatureId };
    }
    case 'select':
      return { ...state, selectedFeatureId: action.id };
    case 'toggleVisibility':
      return {
        ...state,
        features: state.features.map(feature => feature.id === action.id ? { ...feature, visible: !feature.visible } : feature),
      };
    case 'rename':
      return {
        ...state,
        features: state.features.map(feature => feature.id === action.id ? renamePoint(feature, action.name) : feature),
      };
  }
}

export function App() {
  const [mapSession, setMapSession] = useState(0);
  const [featureState, dispatchFeature] = useReducer(featureReducer, { features: [], selectedFeatureId: null });
  const { features, selectedFeatureId } = featureState;
  const [layers, setLayers] = useState<FeatureLayer[]>(createDefaultLayers);
  const [mode, setMode] = useState<EditorMode>('select');
  const [importStatus, setImportStatus] = useState('No GeoJSON imported.');

  const handleMapPointClick = (coordinates: Wgs84Point) => {
    if (mode !== 'create') {
      dispatchFeature({ type: 'select', id: null });
      return;
    }
    dispatchFeature({ type: 'create', coordinates });
    setMode('select');
  };

  const handleImportFile = async (file: File) => {
    if (file.size > GEOJSON_MAX_TEXT_LENGTH * 4) {
      setImportStatus(`Import rejected: file exceeds the ${GEOJSON_MAX_TEXT_LENGTH}-character safety limit.`);
      return;
    }
    try {
      const imported = importGeoJsonText(await file.text(), layers);
      dispatchFeature({ type: 'import', imported });
      setMode('select');
      setImportStatus(`Imported ${imported.length} Point feature${imported.length === 1 ? '' : 's'}; imported values remain unvalidated.`);
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
        onPointSelect={id => dispatchFeature({ type: 'select', id })}
        onMapPointClick={handleMapPointClick}
        onLayerVisibilityChange={id => setLayers(current => current.map(layer => layer.id === id ? { ...layer, visible: !layer.visible } : layer))}
        onFeatureVisibilityChange={id => dispatchFeature({ type: 'toggleVisibility', id })}
        onFeatureSelect={id => dispatchFeature({ type: 'select', id })}
        onFeatureRename={(id, name) => dispatchFeature({ type: 'rename', id, name })}
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
