# City Map Tools

Static-first map workspace. This revision carries the modular shell from Issue #18,
the Point/layer/GeoJSON slice from Issue #19, the bounded geometry-editor slice
from Issue #20, the Project Document v1 contract from Issue #5A, v1-backed runtime
history from Issue #5B, local IndexedDB persistence from Issue #5C, and the
representative Chromium CI smoke from Issue #6 Phase B2. Issue #21 adds
transactional dragging for authored Points. The app does not provide validated
engineering analysis or a New/Open/Save project workflow (#5D).

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
  unvalidated` with explicit WGS84 longitude/latitude provenance. In Select mode,
  visible authored Points can be dragged as one undoable project edit; imported
  Points stay fixed. Marker pixels and hotspot presentation never change stored
  WGS84 coordinates.
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
- Point presentation has only bounded controls: dot (center hotspot) or pin
  (tip/bottom-center hotspot), 18/24/32 px size, label visible/hidden, and one of eight
  named label positions. It is part of the current Project Document state, never
  changes canonical geometry, buffer input, or provenance, and is not included in
  GeoJSON export.
- Project Document v1 is the single source for current metadata, ordered layers,
  features, and PointPresentation. Every accepted edit is validated against v1 before
  commit. Undo/Redo keeps at most 20 project snapshots; create/import/delete, geometry
  Apply, rename, visibility, PointPresentation, and buffer creation each form one action.
  Feature rename commits on blur or Enter. Selection, tools, drawing/edit drafts, camera,
  basemap, buffer text, and import status stay transient. History controls are disabled
  during active drawing/editing and Point-move transactions. A Point drag commits as
  one history action; draft positions are not persisted, and a cancelled/no-op drag
  creates no save.
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
build. Its search and unconstrained prototype behavior are not available in this shell.
The current app uses only the bounded project history described above; it does not
implement the prototype's history behavior or UI.

Space Syntax, routing/accessibility, synthetic isochrones, elevation, and OD
analytics remain unavailable. No analytical engine is migrated or reactivated.
The committed Project Document v1 is saved locally in IndexedDB after a 500 ms
debounce. The header reports Loading, Unsaved, Saving, Saved, or Error. A valid
last-saved project returns on reload with fresh, empty Undo/Redo history; active
drawings, selection, tools, and map state do not return. A corrupt or unsupported
stored record is preserved, and autosave pauses with an Error while the user can
continue in a memory-only session. There is no New/Open/Save project workflow,
API-key input, generic GIS import/export, or full icon catalogue in this slice.
Issue #5D owns the later project workflow and explicit recovery controls.

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
deterministic `npm test` script runs the committed pure TypeScript suites. CI also
runs `npm run test:browser:ci`, a focused production-preview Chromium smoke for map,
history, persistence/recovery, and authored Point dragging. This is not a general
end-to-end matrix.

Focused Issue #19/#20/#5A/#5B/#5C/#21 regression fixtures are committed under `tests/`:

```sh
npm test
npm run test:browser:ci
# With the production preview running and a playwright-cli browser open:
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/project-persistence-browser.js
# The persistence fixture leaves a corrupt test record. Reset the test database
# before each older fixture, which assumes a new project:
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/reset-project-database-browser.js
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/geojson-browser.js
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/geometry-browser.js
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/marker-hotspot-browser.js
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/import-lifecycle-browser.js
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/project-history-browser.js
# In a second terminal, before the deterministic lifecycle fixture:
node tests/map-tile-server.cjs
npx --yes --package @playwright/cli playwright-cli run-code --filename tests/map-lifecycle-browser.js
```

These check import trust, count limits, transactional state preservation, XSS,
provenance round-trips, canonical geometry/buffer behavior, point hotspot presentation,
the strict native Project Document v1 contract, Project Document-backed undo/redo,
stale async import rejection, and Point/layer/basemap controls. The GeoJSON browser
fixture uses generated File objects through the file input and reads actual export
downloads.

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
