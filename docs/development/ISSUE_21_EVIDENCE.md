# Issue #21 parity, retirement, and closure evidence

Authority: [Issue #21 control-plane contract, comment 5856364892](https://github.com/bokoboss/city-map-tools/issues/21#issuecomment-5856364892).

## Starting point and gates

- Work mode: **STANDARD**; scrutiny: **GO WITH CONDITIONS**.
- Accepted baseline: `5d7456d70807f57bda91811ecf76fc1b093d5434`.
- Before edits, `main`, `origin/main`, and `HEAD` were verified at the accepted
  baseline after fetching `origin/main`; the worktree was clean. The requested
  branch is `codex/r1a4-legacy-retirement`.
- `.engineering-workflow.json` pins v1.7.4. All 29 managed workflow snapshot
  hashes matched after normalizing checkout CRLF to source LF.
- Success gates: authored Point eligibility only; a single transaction per drag;
  draft positions excluded from persistence/history; no-op with no timestamp,
  save, or history; one committed undo step; exact Undo/Redo and cancellation;
  dependent-buffer Stale semantics; mode/lifecycle cleanup; imported Points fixed;
  hotspot presentation independent from canonical WGS84; no deferred legacy
  feature or production-boundary change.

## Protected behavior parity

The modular app retains the protected R1A behavior in these existing owners:

| Protected behavior | Current owner |
| --- | --- |
| Vite/React/TypeScript shell and MapLibre lifecycle | `src/main.tsx`, `src/App.tsx`, `src/map/MapCanvas.tsx`, `src/map/createMap.ts` |
| OSM/CARTO basemaps and truthful 3D capability/error status | `src/map/createMap.ts`, `src/map/MapCanvas.tsx` |
| Point/LineString/Polygon authoring, selection, visibility, inspector, rename, edit, delete | `src/App.tsx`, `src/map/MapCanvas.tsx`, `src/features/featureModel.ts`, `src/project/projectHistory.ts` |
| Bounded derived buffers and source-change invalidation | `src/features/workspace.ts`, `src/project/projectHistory.ts` |
| Point marker presentation and hotspot | `src/map/pointPresentation.ts`, `src/map/createMap.ts`, `src/styles.css` |
| Safe Point GeoJSON import/export | `src/features/geojson.ts`, `src/App.tsx` |
| Project Document v1, Undo/Redo, transaction history | `src/project/projectDocument.ts`, `src/project/projectHistory.ts` |
| Committed-state IndexedDB autosave and recovery | `src/project/projectPersistence.ts`, `src/project/indexedDbProjectStorage.ts`, `src/App.tsx` |
| Representative hosted Chromium CI smoke | `tests/ci-browser-smoke.spec.ts`, `.github/workflows/ci.yml` |
| Authored Point drag added by #21 | `src/map/createMap.ts`, `src/map/MapCanvas.tsx`, `src/App.tsx` |

`projectHistory.ts`, Project Document v1, persistence debounce, buffer method,
and dependency manifests are unchanged by this slice. `legacy/r0-safe-prototype.html`
remains an archival reference and is not imported or packaged by the modular app.

## Drag lifecycle and closure audit

| Path / risk | Implementation and evidence | Result |
| --- | --- | --- |
| Eligibility | MapCanvas supplies authored lineage only; the controller requires Select mode and a visible marker. Feature/layer-hidden markers are removed and cannot drag. Browser smoke attempts imported and non-Select drags and checks storage remains identical. | PASS |
| Start and rollback root | `dragstart` selects the feature and starts the accepted project transaction against the committed document. App callbacks own transaction changes; a rejected/cancelled callback is scoped to its Point id. | PASS |
| Repeated draft positions | `drag` reads `Marker.getLngLat()`, validates WGS84, and applies `movePoint` only to the transaction draft. `acceptHistory` persists only when the committed `present` changes; draft-only state does not cross that boundary. Browser smoke holds a drag for 600 ms and compares the IndexedDB text with the prior committed record. | PASS |
| GeoJSON export during drag | `handleExport` serializes `historyRef.current.present`, the committed root. The browser smoke exports while the pointer is held mid-drag and checks that the download contains the original coordinate while IndexedDB is unchanged and Undo remains disabled. | PASS |
| Commit and history | `dragend` applies the final validated position and commits once. The smoke checks exact moved coordinates, one Undo to the original coordinate and buffer state, and one Redo to the moved coordinate and Stale state. | PASS |
| No-op and projection drift | The smoke performs a real drag out and back, holds past the 500 ms autosave debounce, and verifies identical stored text and buffer state; one Undo then removes the buffer itself, proving the no-op added no history item. MapLibre inverse projection can produce up to one CSS pixel of drift on return. `map.project` compares the canonical start/end positions only to classify a return within one CSS pixel as no-op; the exact committed WGS84 origin is reused. Otherwise the value comes directly from `Marker.getLngLat()`. No DOM/icon bounds or presentation offsets generate coordinates. | PASS |
| Validation failure | The pure history fixture rejects out-of-range WGS84 without changing committed/draft objects, then cancels to the exact rollback root with no history. Map callbacks cancel on failed validation or commit. | PASS |
| Controller lifecycle | `destroy`, basemap replacement, mode change, and marker removal cancel an active gesture, restore its original Marker position, and clear its matching App transaction. The hosted smoke destroys/remounts the map during a live drag, checks the IndexedDB record remains unchanged, and verifies the exact original Point returns. | PASS |
| Hotspot and style rehydration | The production-preview marker fixture first moves an authored Point, then checks canonical geometry and hotspot positions through labels, all label placements, marker size/type, selection/focus, and OSM/CARTO/OSM style replacement. | PASS |
| Legacy interaction retirement | The legacy HTML is retained as archive-only. The README beside it states it is not an active migration source and requires the owning Issue/methodology gate before production reuse. Deferred controls and owners are listed below. | PASS |

## Legacy controls intentionally deferred

| Legacy control | Disposition / owner |
| --- | --- |
| Location search and geocoding | #7 provider contract; provider terms and failure behavior are not frozen here. |
| CAD magnetic snapping | #7 snapping engine. |
| Route preview and isochrone | #7/#9; motor-vehicle routing remains out of scope. |
| Desire Line and OD behavior | #11 and later semantic work. |
| Experimental network / Space Syntax controls | #10 deferred research; no analytical engine. |
| Additional satellite, topographic, or provider basemaps | #7 provider/basemap contract. |
| Bearing presets, zoom lock, presentation controls | Later UX/presentation work, including #12/#32. |
| Layer ordering / z-order UI | #12/#32; current Point, Line, and Polygon overlays use distinct rendering paths, so no misleading ordering control is added. |
| Prototype keyboard shortcut claims | Not ported; only implemented and tested interactions are advertised. |
| New/Open/Save/recovery workflow | #5D. |
| Analytics and future #29-#34 features | Deferred; no unsupported analytics or synthetic result is reactivated. |

## Production boundary audit

- Root `index.html` remains the minimal Vite entry with a local `/src/main.tsx`
  module. `rg -ni "cdn\.tailwindcss\.com|unpkg\.com" index.html src` returned no
  matches.
- The production `dist/` listing contains only `index.html` and generated assets;
  no `legacy/` file is packaged.
- No package manifest, lockfile, provider, external service, credential path, or
  analytics control was added or changed.
- README and PROJECT_PROFILE now describe accepted #5C IndexedDB persistence,
  #6 Phase B2 Chromium CI, authored Point dragging, and the separate #5D workflow.
  `legacy/README.md` now describes the old prototype as archive-only.

## Local evidence

The production-preview fixtures below were run against the freshly built `dist/`;
the test IndexedDB was reset before each fixture. Each fixture returned PASS with
no page errors and no unexpected console warnings/errors. The map-lifecycle fixture
includes an intentional provider-failure case and excludes only that expected
failure from its console assertion.

| Gate / fixture | Result |
| --- | --- |
| `npm test` | PASS; all workspace, Project Document, history, drag-transaction, and persistence suites |
| `npm run typecheck` | PASS; strict TypeScript check |
| `npm run build` | PASS; Vite transformed 174 modules. Existing large-chunk advisory remains. |
| `npm run test:browser:ci` | PASS; 1 Chromium test, including draft persistence/export exclusion, no-op history/save, cancellation, Stale/Undo/Redo, imported and non-Select guards, and reload |
| `tests/project-persistence-browser.js` | PASS; canonical v1 payload, reload, recovery preservation |
| `tests/project-history-browser.js` | PASS; creation, presentation, visibility, buffers, drawing and Undo/Redo |
| `tests/import-lifecycle-browser.js` | PASS; import races preserve active geometry/project revision |
| `tests/geometry-browser.js` | PASS; geometry authoring/editing, style replacement, buffers, responsive/focus behavior |
| `tests/map-lifecycle-browser.js` | PASS; OSM/CARTO, remount, intentional provider failure and recovery |
| `tests/marker-hotspot-browser.js` | PASS; authored drag followed by hotspot/presentation/style invariants |
| `git diff --check` | PASS |

Exact-head GitHub build/browser-smoke, the single targeted `@codex review`, and
review-thread closure are pending at this pre-push checkpoint. No Security Review
is requested because the change adds no new untrusted/security boundary. Do not
merge before those remote gates are inspected.

External writes before push: none. Global/system changes: none.
