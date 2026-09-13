# City Map Tools

Static-first map workspace. This revision carries the modular shell from Issue #18
and the bounded Point/layer/GeoJSON slice from Issue #19; it does not provide
validated engineering analysis.

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
- Create and select Point features, rename them in the inspector, and toggle the
  Points layer visibility. New points are authored and remain `Functional but
  unvalidated` with explicit WGS84 longitude/latitude provenance.
- Import and export GeoJSON FeatureCollections for Point geometry only. Supported
  properties are `name`, `description`, `layerId`, `visible`, `lineage`,
  `validationStatus`, and the bounded R0 provenance object. Unknown properties,
  unsupported geometry, malformed coordinates, and unknown layers reject the whole
  import with a visible reason. Imported text is rendered as text, never HTML.

GeoJSON imports accept at most **500 Points per file** and 1,000,000 characters.
Larger collections reject before Point conversion; feature state and selection
remain unchanged. This is a per-import limit, not a total workspace limit. Exports
contain all workspace Points; exports above either import limit cannot be re-imported
as one file. There is no automatic splitting, clustering, or virtualization.

Every file import, including a current application export, has active lineage
`imported`. Public format/version/generator markers do not authenticate a file.
Recognized incoming lineage is retained only as the bounded provenance object
`sourceLineageClaim: { lineage: "authored" | "imported" | "derived", trust: "untrusted" }`.
An existing source claim takes precedence over the incoming active lineage so it
survives subsequent export/re-import cycles. These claims never activate derived
or trusted behavior. `derivedFrom` remains imported audit/reference data and follows
the deterministic ID collision mapping. `Validated` claims remain demoted to
`Functional but unvalidated` with the original claim retained in provenance.

The accepted R0 annotation prototype is preserved unchanged at
[`legacy/r0-safe-prototype.html`](legacy/r0-safe-prototype.html), with a
[reference-only marker](legacy/README.md). It is not included in the production
build. Its search, drawing, buffers, and history are not available in this shell.
Later bounded Issues #20, #5, and #21 own those migrations.

Space Syntax, routing/accessibility, synthetic isochrones, elevation, and OD
analytics remain unavailable. No analytical engine is migrated or reactivated.
There is no project storage, API-key input, or non-Point GIS format in this slice.

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

Focused Issue #19 regression fixtures are committed under `tests/`:

```sh
npx --yes --package tsx tsx tests/geojson-import.test.ts
# With the production preview running and a playwright-cli browser open:
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/geojson-browser.js
```

These check import trust, count limits, transactional state preservation, XSS,
provenance round-trips, and the Point/layer/basemap controls. The browser fixture
uses generated File objects through the file input and reads actual export downloads.

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
