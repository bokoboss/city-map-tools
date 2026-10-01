# Project Profile

## Identity
- Project: City Map Tools
- Repository: https://github.com/bokoboss/city-map-tools
- Authoritative local path: `C:\MyRD\city-map-tools`
- Primary branch: `main`
- Package version: `2.2.0` (package label, not a production-readiness claim)
- Product North Star: `PRODUCT_DIRECTION.md`

## Current accepted baseline
- Accepted **product-code baseline**: `f72ecb2495f2e48573326a45b083a7a897a8465c`
- Baseline date: 2026-10-01, project timezone UTC+07:00
- This baseline is merge commit PR #46 / Issue #42: indexed screen-space CAD snapping for authored geometry, including the bounded diagonal/zig-zag segment-index remediation accepted at PR head `f33dff43c5eeaf6d779c4ef6f4d94dc9ac46dc44`.
- It also includes PR #44 / Issue #41: WGS84 ellipsoidal geodesic kernel, plus documentation-only product-direction realignment from PR #47/#48.
- Prior accepted foundation includes:
  - #2 workflow/project baseline;
  - #3 truth/security/quarantine remediation;
  - #18 shell + MapLibre foundation;
  - #19 typed Point/layer/select/inspector + safe Point GeoJSON I/O;
  - #20 LineString/Polygon/basic buffer editor foundation;
  - #5A Project Document v1;
  - #5B authoritative project state + transaction/history;
  - #5C IndexedDB autosave/recovery;
  - #6 Phase A, B1 and B2 CI/browser-smoke foundation;
  - #21 safe legacy retirement + transactional authored Point drag;
  - #41 geodesic kernel;
  - #42 indexed CAD snapping.
- Durable program record: Issue #1.
- Product direction: `PRODUCT_DIRECTION.md`.

## Recently accepted spatial work

### Issue #42 — indexed CAD snapping
- PR #46 merged to `main` as `f72ecb2495f2e48573326a45b083a7a897a8465c`.
- Accepted PR head: `f33dff43c5eeaf6d779c4ef6f4d94dc9ac46dc44`.
- The original P1 / REQUIRED finding was remediated by clipping segments to the screen plus the 12 CSS px tolerance and indexing only a bounded 32 CSS px grid corridor near each segment rather than every cell of its axis-aligned bounding rectangle.
- Deterministic diagnostics cover indexed cell-entry growth; long diagonal, off-screen, zig-zag, duplicate-cell, corridor and exact-edge regressions are present.
- Exact-head CI passed build and browser-smoke, the P1 review thread was resolved, fresh targeted review found no major issue, and control-plane acceptance found no remaining BLOCKER / REQUIRED / FOLLOW-UP finding for #42.
- Issue #42 is closed as completed.

## Current active / next spatial work
- #43 provider/basemap capability + credential-safe service contracts is next.
- After #43, audit #7 acceptance gaps explicitly before closing the R2 spatial core.

## Current implemented stack
- Vite 6 + React + strict TypeScript + npm/ESM.
- MapLibre GL JS v6 for map/runtime.
- Terra Draw + MapLibre adapter for supported transient geometry creation/editing.
- Project-owned `SnapPolicy` with 12 CSS px tolerance and a 32 CSS px screen-space grid for accepted CAD snapping.
- `@turf/buffer` for bounded derived buffers.
- `geographiclib-geodesic` for the protected WGS84 ellipsoidal geodesic kernel.
- Native IndexedDB for committed Project Document v1 autosave/recovery.
- Playwright Chromium is used for the focused hosted browser-smoke gate; there is intentionally no broad multi-browser E2E matrix.
- Node 22 is the CI baseline.

## Current accepted product behavior
- Map navigation and OSM raster / CARTO Voyager switching with explicit loading/error behavior.
- Truthful compatible/unavailable 3D state; 3D is visualization only.
- Typed authored/imported/derived project records.
- Authored WGS84 Point, LineString, and single-exterior-ring Polygon geometry.
- Point creation/selection/rename and authored Point drag in Select mode.
- Layer visibility.
- Transient Terra Draw line/polygon creation and edit sessions.
- Deterministic CAD snapping for visible authored Point/LineString/Polygon geometry with vertex and nearest-on-segment targets, self/ineligible exclusion, exact canonical WGS84 vertex preservation, bounded candidate lookup, transient feedback, and camera/style/project lifecycle invalidation.
- Derived Turf buffers with source snapshot, metres, library version, stale/orphan state, and read-only derived geometry.
- Point presentation with center/pin-tip hotspot semantics, bounded marker size, and eight label placements; presentation does not alter canonical geometry.
- Strict Project Document v1 validation/serialization.
- Authoritative project state, project commands, one-action history, transaction drafts, bounded 20-snapshot Undo/Redo.
- Native IndexedDB 500 ms committed-state autosave with Saved/Saving/Unsaved/Error state and strict recovery preservation.
- Deterministic pure tests, strict typecheck/build, and focused production-preview/hosted Chromium browser evidence.
- WGS84 ellipsoidal inverse distance/bearing, line length, polygon perimeter, and absolute area kernel for later #14 measurement.

## Not yet implemented / not yet accepted
- #5D user-facing New/Open/Save-or-equivalent project workflow.
- Full provider capability contract from #43.
- Traffic Movement (#29), Site Access Route (#30), Scenario/Stage (#31), presentation system (#32), Site Plan overlay (#33), semantic traffic annotations (#34).
- Live measurement UI (#14).
- Data-driven Desire Line / OD (#11).
- Pedestrian Walking Walkshed (#9).
- Traffic-engineering result visualization (#16).
- Engineering-grade interoperability/cartographic export package (#13).
- Field evidence/photos (#15).
- Vissim/simulation trajectory replay (#22).
- GitHub Pages Phase C accepted deployment.

## Product direction / priority

`PRODUCT_DIRECTION.md` is authoritative for product priority.

Current high-level sequence:

`Finish #43/#7 -> #5D -> #29/#30/#32/#33 -> #14/#11 -> #12 -> #13/#15/#16 -> #9 when justified -> #22`

Additional rules:
- #31/#34 enter when their concrete user workflow and dependencies justify them; they should not block the first useful traffic/access authoring set.
- #8 DEM/elevation is closed `not planned` and must not be reintroduced merely because it existed in the original PRD.
- #10 Space Syntax remains deferred research requiring a future explicit GO / GO WITH CONDITIONS.
- #16 traffic result visualization is a planned core integration direction, not a disposable nice-to-have.
- #22 simulation replay is a planned major capability, intentionally later because of data/render/georeferencing complexity.
- No motor-vehicle routing or traffic-aware vehicle isochrone is current product scope.

## Architecture / protected invariants
- Personal/hobby, low-volume, static-first and local-first core.
- Never present/export synthetic, demo, experimental, or unvalidated results as validated engineering outputs.
- `README.md` = accepted current capability; `PRODUCT_DIRECTION.md` = product North Star; `PRD.md` = target specification; Issue #1/children = execution truth; this file = current accepted state.
- Canonical geographic storage is WGS84 longitude/latitude `[lng, lat]`.
- DOM bounds, icon pixels, labels, callouts, animation state, and marker hotspot presentation must never influence stored WGS84 geometry, buffer input, engineering calculations, or export geometry.
- Engineering outputs preserve source, method, parameters, units, version, validation/status, stale state, and limitations where applicable.
- Authored/imported data remain distinct from derived engineering results.
- Optional services require attribution, failure behavior, usage/licensing notes, and explicit capability state.
- Browser BYOK, if authorized, stays in runtime memory by default and never enters IndexedDB/project/export/log/Git.
- Snapping, tracing, map matching, routing/reachability, authored access routes, and simulation replay are distinct operations.
- No speculative generic plugin framework.

## Project-state contract
- Project Document v1 is current persisted project truth.
- Current project state includes accepted layers/features/provenance/derived-buffer records and Point presentation.
- Selection, tool/mode, hover, draft/edit state, map runtime/camera, import status, animation phase, and other transient UI state are not persisted project truth.
- History is runtime-only and resets to a fresh root after reload/recovery.
- Project files/persistence must contain no credentials/secrets.
- #5D owns the explicit local project workflow; #13 owns broader portable/native interoperability packages where appropriate.

## Package manager / commands

```text
npm ci
npm test
npm run dev
npm run typecheck
npm run build
npm run test:browser
npm run test:browser:ci
git diff --check
```

Production preview URL: `http://127.0.0.1:4173/city-map-tools/`.

If a local Playwright Chromium binary is absent, project work should not silently install into a user/global profile. Use an explicitly project-local ignored browser cache when authorized for the task.

## Validation matrix
| Gate | Method | Required |
|---|---|---|
| Deterministic install | `npm ci` | Yes |
| Pure/unit contract | `npm test` | Yes for affected domain work |
| Strict TypeScript | `npm run typecheck` | Yes |
| Production artifact | `npm run build` | Yes |
| Diff hygiene | `git diff --check` | Yes |
| Browser | `npm run test:browser:ci` plus affected production-preview fixtures | For runtime changes |
| CI | Exact PR-head `build` and `browser-smoke` checks on Node 22 | Yes |
| Independent review | Actual diff/evidence according to applicable Issue/workflow risk | As required |
| Analytical/reference data | Method-specific deterministic/open fixtures | Before analytical acceptance |

## Important paths
- Product North Star: `PRODUCT_DIRECTION.md`
- Target product specification: `PRD.md`
- Current capability: `README.md`
- Production: `index.html`, `src/main.tsx`, `src/App.tsx`, `src/map/`, `src/styles.css`
- Project contract: `src/project/projectDocument.ts`, `docs/architecture/project-document-v1.md`
- Spatial kernels: `src/spatial/geodesic.ts`, `src/spatial/snapPolicy.ts`
- Legacy reference: `legacy/r0-safe-prototype.html`, `legacy/README.md`
- Build/dependencies: `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`
- Documentation: `ACKNOWLEDGEMENTS.md`, `DEVELOPMENT_LOG.md`
- Workflow: `AGENTS.md`, `.engineering-workflow/`, `.engineering-workflow.json`
- CI/deploy: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

## Workspace / execution policy
- Default writable boundary: `C:\MyRD\city-map-tools` only.
- Do not modify another repository, global/system configuration, PATH, registry, credentials, browser user profile, or shared workflow checkout without explicit approval.
- Preserve unknown/untracked work; no destructive reset/clean for convenience.
- Use focused branches and GitHub noreply identity; never expose private email.
- Reconstruct truth from Git/GitHub/project files, not chat history.
- Review actual diff/evidence; do not claim completion while mandatory gates are failed/blocked.
- Triage review findings as BLOCKER / REQUIRED / FOLLOW-UP and stop once closure conditions are met.

## Current objective
1. Implement #43 provider/basemap capability contracts.
2. Audit and close remaining #7 spatial-core acceptance gaps.
3. Complete #5D local project workflow.
4. Move into the core product-authoring sequence defined by `PRODUCT_DIRECTION.md`, beginning with #29/#30/#32/#33 rather than allowing infrastructure or unrelated analytics to displace the product North Star.
