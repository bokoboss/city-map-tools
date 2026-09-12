import { useState } from 'react';
import { MapCanvas } from './map/MapCanvas';

export function App() {
  const [mapSession, setMapSession] = useState(0);

  return (
    <main className="app">
      <header className="app-header">
        <div><h1>City Map Tools</h1><p>Explore the map · Foundation preview</p></div>
        <button onClick={() => setMapSession(session => session + 1)}>Reload map</button>
      </header>
      <MapCanvas key={mapSession} />
      <footer className="app-footer">
        Map viewing only. Editing and project tools are being migrated in later slices.
        Engineering analytics remain unavailable; no validated analysis is produced.
      </footer>
    </main>
  );
}
