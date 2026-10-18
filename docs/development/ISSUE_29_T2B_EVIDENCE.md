# Issue #29 T2B implementation and evidence

Date: 2026-10-18, Asia/Bangkok. Work mode: STANDARD, high confidence, bounded
UI/controller integration. Execution contract: Issue #29 comment 6248790348;
architecture/UX qualification 6248670390; accepted v2 contract 6247947126.

Verified starting remote main: `224a4bf1709d1979bc5b66968e553522260b64bb`.
Accepted product-code baseline: `32ef67f0aefbc9d7bf869948c2d380eacf0c3c98`.
Branch: `codex/traffic-movement-product-t2b`. Initial worktree clean. All 29 pinned
workflow hashes match after CRLF-to-LF normalization; workflow version 1.7.4.
No changes to that snapshot, schema, history implementation, persistence, IndexedDB,
provider credentials, spatial methods or runtime dependencies.

## Success gates and scope

1. Real editor draw/select/Convert, all bounded Inspector controls, reverse,
   Unconvert and history use accepted project commands; rejected edits have no write.
2. Committed `historyState.present` exclusively feeds `trafficMovementInputs` and
   renderer. Transaction drafts never feed directional rendering or persistence.
3. Display-track clicks resolve the expected stable authored ID; generic stroke is
   absent for converted features, including offset/shared paths. Canonical geometry
   remains available to editor and SnapPolicy.
4. Undo/Redo, visibility, deletion, project switching, reload and full style replacement
   reconstruct current committed inputs. Shared resources and cleanup stay bounded.
5. Global pause is React/runtime-only, preserved across map remount/style replacement,
   reset on New/Open. Saved animation preferences, bytes and history stay unchanged.
6. Accessible labels/keyboard and narrow layout; actionable display warnings preserve
   other valid movements. No quantitative traffic claims.
7. Unit, typecheck, normal build, diff check, full browser regressions, focused product
   UAT, exact-head CI, fresh exact-head Code Review and targeted independent controller
   review. No merge; final product acceptance remains with the control plane.

## Implementation

- App owns transient pause and passes the committed project separately from the
  existing transaction-view feature props. Movement operations use `runProjectCommand`
  and reject active geometry interactions.
- MapCanvas binds committed inputs and pause to the existing controller. A selected
  authored LineString exposes Convert/Unconvert and an accessible visual Inspector.
  The cap, unsupported lineage and active-interaction restrictions explain disabled
  actions. Numeric fields commit on blur/Enter; errors retain stored values.
- Controller retains all canonical geometry for editing/snapping but omits movement
  LineStrings from generic rendering. Picking measures the renderer's final tapered
  display paths, then reconciles IDs and effective visibility with current features.
  Ordinary lines/polygons retain their established picking behavior.
- Per-input display validation isolates unsupported Web Mercator/antimeridian paths;
  renderer layout/projection warnings are surfaced without continuous React updates.
  Production opts into per-feature isolation; the default infrastructure API retains
  atomic rejection with its prior render cache. The first full regression run caught
  this distinction (34 passed, 1 failed); the implementation restored the default
  contract rather than weakening the accepted regression.
- Browser UAT exposed worker-idleness coupling: `map.isStyleLoaded()` can be false
  while animated GeoJSON sources update. Gating generic overlays on that method lost
  ordinary strokes. Controller style readiness now follows `style.load`/replacement,
  independently of source-worker idleness. The failing ordinary-line source assertion
  passed after the bounded controller correction.
- Fresh Code Review of the first head found two REQUIRED issues. Both received
  failing browser reproducers before remediation: controller `idle` delivery was
  suppressed to reproduce startup/snapping stuck in Loading; a stream of native
  color input/change events reproduced multiple history entries. Readiness now uses
  completed committed-geometry hydration and per-basemap source completion events,
  without waiting for animated application sources or `idle`. Provider errors retain
  priority. Color is a local native-input draft committed once on blur/Enter.
- A later exact-head review found generic layers could hydrate above directional
  layers, unlike conversion after startup. An exact-crossing click test reproduced
  movement selection changing after a full style replacement. Generic layers now
  insert before the directional line whenever it exists, keeping draw order and
  rendered tie-breaking stable through startup/conversion/style replacement.

## Reproducible browser evidence

`tests/traffic-product-browser.spec.ts` runs the real production App, with real Terra
Draw interactions and IndexedDB. The test build compiles `src/main.tsx` unchanged
alongside a separate MapLibre observation entry. Tests load that entry before the App
to inspect the actual App-owned map; normal production builds contain no observer.
No alternate movement controller, semantic store or fake engineering result is used.

The product scenarios cover:

- Draw, map-select, Convert, visible moving arrows, Reverse, every presentation field,
  invalid bounds, static animation, Undo/Redo, pause byte/history preservation,
  Save/reload and Unconvert with exact WGS84/feature equality.
- Left/through/U-turn shared approach, right turn, true crossing and ordinary line;
  actual MapLibre rendered-line queries under every arrow, stable displaced-track map
  clicks, and absence of generic movement strokes.
- Real vertex drag, Cancel and Apply; committed display unchanged during the draft;
  visibility at feature/layer level; Delete/Undo; repeated OSM/local Voyager full
  style replacements; map remount; old-map removal; exactly two directional sources
  and two layers; New/Open with no cross-project ghosts and reset pause/history.
- Initial native reduced-motion preference, no control-DOM mutations during arrow
  motion, hidden-page pause and global-pause priority, with unchanged stored bytes.
- Real production v1 Save-now no-op and first Convert preserving exact backup;
  unsupported polar display diagnosis retaining valid movements and imported-line
  conversion refusal; 24-movement cap with no partial edit.
- Desktop/narrow screenshots, native labeled controls and keyboard traversal.
- No-idle startup and canonical vertex snapping with animated movements; one Undo
  entry for a finalized multi-event color-picker gesture, with no intermediate write.
- Exact-crossing map selection and generic/directional layer order before and after
  full Voyager/OSM style replacements.

Linux CI also exposed an existing smoke-fixture teardown race: a tile route read
`APIResponse.body()` after the request context was disposed. The smoke fixture now
loads the fixed tile bytes before registering the route, preserving identical tile
content without an asynchronous request-context dependency during map remount/teardown.
The same failure then appeared in the provider fixture; all browser fixture setups
using that pattern now preload the same local tile/status and close over those values.
This is test-only; no product change or test assertion was removed.

Supplementary local screenshots: `output/playwright/traffic-product-desktop.png` and
`output/playwright/traffic-product-narrow.png`. Full browser log:
`.cache/t2b-browser-final.log` (generated/ignored). Test results and exact-head CI/review
provenance are recorded on the PR for the final revision.

## Limitations and acceptance boundary

- Local Chromium uses SwiftShader and deterministic local basemap resources; no live
  CARTO credential/provider service is qualified. Normal production remains static.
- The visibility scenario explicitly delivers `visibilitychange` with a controlled
  `document.hidden` value, as headless tabs do not reliably reproduce native background
  scheduling. Reduced motion is set through Playwright media emulation and startup
  preference; inherited T1A tests retain their documented media-event limitation.
- Control-DOM observation supports no React frame churn; it is not a React profiler
  or GPU/worker performance benchmark. Accepted renderer tests cover scheduler bounds,
  lifecycle/listener cleanup, crossing/taper and pixel alignment independently.
- Render-only MapLibre project/unproject coordinates are checked within 0.00001 CSS
  px, not by exact WGS84 bit equality. Linux CI exposed a roughly 4e-12-degree
  floating-point difference in that round trip; canonical persisted features retain
  exact equality assertions. No production geometry change was needed.
- Browser storage remains local and fallible. Accepted v1 migration/backup/CAS and
  recovery behavior is unchanged. No generic LineString export, routing, scenario,
  traffic metric, simulation or new schema is added.
- Issue #29 stays open; this implementation report does not grant acceptance or merge.

Filesystem writes stay in `C:\MyRD\city-map-tools`. Authorized external writes are
the branch push, one PR and its review/evidence comments. No destructive cleanup,
force push, global installs or global/system changes.
