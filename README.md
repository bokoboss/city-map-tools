# City Map Tools

Static-first map workspace. This revision carries the modular shell from Issue #18,
the Point/layer/GeoJSON slice from Issue #19, the bounded geometry-editor slice
from Issue #20, and the pure native Project Document v1 contract from Issue #5A;
it does not provide validated engineering analysis or runtime project persistence.

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
- Create, select, rename, edit, hide/show, and delete authored WGS84 LineString and
  single-exterior-ring Polygon features. Terra Draw is transient editor state only:
  a line/polygon becomes workspace data only on finish, and editing needs an explicit
  Apply action. Escape/Cancel leaves no orphan draft or partial committed mutation.
- Derive a Polygon buffer from an authored Point, LineString, or Polygon using
  `@turf/buffer@7.4.0`, a user-visible radius of 1–10,000 metres, and 8 steps. The
  source snapshot, method, library/version, units, radius, steps, validation state,
  and limitations remain visible in the inspector. A derived buffer is read-only;
  source edits mark it `Stale`, and source deletion leaves it visibly orphaned.
- Buffer inputs are exact canonical WGS84 geometry snapshots. Marker pixels, label
  layout, DOM bounds, and presentation state are never used for geometry or buffer
  derivation. Antimeridian/pathological spans and unsupported/MultiPolygon Turf output
  fail closed without changing workspace state. Buffers are functional but unvalidated
  derived spatial output—not surveyed, cadastral, or validated engineering geometry.
- Point presentation has only bounded runtime controls: dot (center hotspot) or pin
  (tip/bottom-center hotspot), 18/24/32 px size, label visible/hidden, and one of eight
  named label positions. It never changes canonical geometry, buffer input, or
  provenance. The #5A native contract can represent this bounded presentation, but
  the current app still owns it in memory and has no project workflow/persistence.
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
build. Its search, history, UI patterns, and unconstrained prototype behavior are not
available in this shell. Only the bounded #20 geometry behavior described above is
implemented; later Issues #5 and #21 remain separately authorized work.

Space Syntax, routing/accessibility, synthetic isochrones, elevation, and OD
analytics remain unavailable. No analytical engine is migrated or reactivated.
There is no project persistence/workflow, API-key input, generic GIS import/export,
or full icon catalogue in this slice. Issue #5A defines only the pure, strict,
versioned native Project Document v1 contract; IndexedDB, autosave, history, and
runtime state migration remain later #5B–#5D work.

## Development and verification

Use Node.js 22 (the CI version) and npm:

```sh
npm ci
npm test
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
compatible 3D on/off, reload cleanup, geometry style remount, and marker hotspot
alignment. CI's stable check runs clean install, unit tests, typecheck, and build on
PR/main; deploy also typechecks before building and uploading only `dist/`. The
deterministic `npm test` script runs the committed pure TypeScript suites; no
ESLint, Playwright, or general E2E CI matrix is claimed.

Focused Issue #19/#20/#5A regression fixtures are committed under `tests/`:

```sh
npm test
# With the production preview running and a playwright-cli browser open:
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/geojson-browser.js
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/geometry-browser.js
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/marker-hotspot-browser.js
# In a second terminal, before the deterministic lifecycle fixture:
node tests/map-tile-server.cjs
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/map-lifecycle-browser.js
```

These check import trust, count limits, transactional state preservation, XSS,
provenance round-trips, canonical geometry/buffer behavior, point hotspot presentation,
the strict native Project Document v1 contract, and Point/layer/basemap controls. The
GeoJSON browser fixture uses generated File objects through the file input and reads
actual export downloads.

`map-tile-server.cjs` is a loopback-only test helper that serves one valid 256px PNG.
The lifecycle fixture uses it only for normal OSM-tile readiness, then deliberately
aborts OSM requests to prove the app's visible error path and CARTO recovery. Live
OSM/CARTO behavior remains exercised by the geometry and marker fixtures.

The isolated Terra Draw/MapLibre compatibility fixture is served by Vite development
mode because it is intentionally outside the production app bundle:

```sh
npm run dev -- --host 127.0.0.1 --port 4174 --strictPort --open false
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/terradraw-compat-browser.js
```

It qualifies the MapLibre 6 worker plus Terra Draw adapter with real LineString and
Polygon create/change/finish, cancellation, clear, and teardown behavior.

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
- Stored coordinates are WGS84 longitude/latitude and map display uses Web Mercator.
  Buffer radius is explicitly passed to Turf in metres; buffer output returns to WGS84
  Polygon storage. Map scale is approximate, and no output is a validated engineering
  distance/area calculation.

## Provenance and licensing

See [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md) for the historical R0 provenance
review and the current direct runtime-library record. No provider dataset is vendored.
A repository license remains unselected pending the separate source-lineage review.
