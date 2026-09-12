# City Map Tools

Static-first map viewing foundation. This revision introduces the modular shell
in Issue #18; it does not provide validated engineering analysis.

Repository: <https://github.com/bokoboss/city-map-tools>
Intended Pages URL: <https://bokoboss.github.io/city-map-tools/>.
Pages configuration remains a separate human-controlled deployment gate.

## Current scope

- Vite 6, React, strict TypeScript, npm-managed MapLibre GL JS, and build-time CSS.
- Map navigation and switching between accepted OpenStreetMap raster and CARTO
  Voyager vector basemaps, with attribution, loading, and error states.
- 3D Buildings is disabled for incompatible basemaps. Compatible vector building
  sources support a visualization toggle at zoom 14+, using numeric provider
  heights in metres where supplied. Missing heights are not fabricated. Coverage
  and accuracy are provider-dependent; these are not surveyed engineering results.
- Reload map creates a fresh map session. Basemap changes preserve location/zoom
  and reset 3D. Provider failures disable 3D and remain visible until a new basemap
  load or explicit reload; no fallback data is generated.

The accepted R0 annotation prototype is preserved unchanged at
[`legacy/r0-safe-prototype.html`](legacy/r0-safe-prototype.html), with a
[reference-only marker](legacy/README.md). It is not included in the production
build. Its editor, search, GeoJSON, drawing, buffers, and history are not available
in this shell. Later bounded Issues #19, #20, #5, and #21 own those migrations.

Space Syntax, routing/accessibility, synthetic isochrones, elevation, and OD
analytics remain unavailable. No analytical engine is migrated or reactivated.
There is no project storage, API-key input, or export in this slice.

## Development and verification

Use Node.js 22 (the CI version) and npm:

```sh
npm ci
npm run dev
```

The app uses `/city-map-tools/`. Verify the production output with:

```sh
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Browse <http://127.0.0.1:4173/city-map-tools/>. Browser smoke must cover real map
rendering, pan/zoom, both basemaps, provider error/recovery, incompatible 3D,
compatible 3D on/off, and reload cleanup. CI's stable `build` check runs clean
install, typecheck, and build on PR/main; deploy also typechecks before building
and uploading only `dist/`. No lint/unit/E2E script is claimed.

MapLibre v6's worker is bundled with
`maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url` and `setWorkerUrl(...)`, per
[official Vite integration guidance](https://maplibre.org/maplibre-gl-js/docs/#installation).
The production shell needs no Tailwind Play CDN or UNPKG globals.

## Providers, coordinates, and limitations

- OpenStreetMap community tiles require [OSM attribution](https://www.openstreetmap.org/copyright)
  and compliance with the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
  No bulk downloading or offline prefetch is implemented.
- CARTO Voyager retains the style's CARTO/OpenStreetMap attribution. Existing
  [provider terms](https://carto.com/legal/) and coverage limitations apply.
- These accepted providers are best-effort online capabilities. Requests go to
  the selected provider; their availability is not guaranteed by the static app.
  No new provider, credentials, paid backend, or direct Google tile endpoint is introduced.
- Displayed coordinates are WGS84 longitude/latitude, map display uses Web Mercator,
  and the metric scale is approximate. No engineering distance/area calculation is performed.

## Provenance and licensing

See [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md) for the historical R0 provenance
review. Its runtime inventory describes the preserved prototype. The current
shell uses the npm libraries listed above; their licenses travel with their
packages. No provider dataset is vendored. A repository license remains
unselected pending the separate source-lineage review.
