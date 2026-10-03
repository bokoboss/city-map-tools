# Project Profile

## Identity
- Project: City Map Tools
- Repository: https://github.com/bokoboss/city-map-tools
- Authoritative local path: `C:\MyRD\city-map-tools`
- Primary branch: `main`
- Package version: `2.2.0` (package label, not a production-readiness claim)
- Product North Star: `PRODUCT_DIRECTION.md`

## Current accepted baseline
- Accepted **product-code baseline**: `5013c0647b94cdf57b05b47df5784bd763e37e35`
- Baseline date: 2026-10-03, project timezone UTC+07:00
- This baseline is merge commit PR #55 / Issue #29 T1A: bounded MapLibre-native directional renderer infrastructure/proof, accepted at PR head `1021fb9ac158348985e369dc0f77eb922f6a533b`.
- It also includes PR #53 / Issue #5D: browser-local multi-project New/Open/Save workflow, loss-preserving legacy migration, recovery controls, and StrictMode-safe catalogue bootstrap, accepted at PR head `4d2ce745439bcdc54026f96e36218ed5af1b8a1e`.
- It also includes PR #50 / Issue #43: typed OSM/CARTO basemap/provider capability contracts and credential-safe runtime BYOK behavior, accepted at PR head `5bf6bf84daa82d8eba6af91bfa995f6465b38994` after bounded credential/security remediation.
- It also includes PR #46 / Issue #42: indexed screen-space CAD snapping for authored geometry, including the bounded diagonal/zig-zag segment-index remediation accepted at PR head `f33dff43c5eeaf6d779c4ef6f4d94dc9ac46dc44`.
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
  - #5D browser-local multi-project New/Open/Save workflow;
  - #6 Phase A, B1 and B2 CI/browser-smoke foundation;
  - #21 safe legacy retirement + transactional authored Point drag;
  - #41 geodesic kernel;
  - #42 indexed CAD snapping;
  - #43 provider/basemap capability and runtime-BYOK contracts;
  - #29 T1A bounded directional renderer proof.
- Durable program record: Issue #1.
- Product direction: `PRODUCT_DIRECTION.md`.

## Recently accepted product-authoring work

### Issue #29 T1A — bounded directional renderer proof
- PR #55 merged to `main` as `5013c0647b94cdf57b05b47df5784bd763e37e35`.
- Accepted PR head: `1021fb9ac158348985e369dc0f77eb922f6a533b`.
- T1A is renderer infrastructure/proof only; Issue #29 remains open. Automatic shared-corridor layout remains T1B, while persisted Traffic Movement semantics/UI/history remain T2.
- Canonical WGS84 LineStrings remain unchanged. Forward/reverse traversal, explicit lateral display tracks, static/animated arrows, and animation phase are presentation-only.
- Renderer resources are bounded and shared: two GeoJSON sources, one LineLayer, one SymbolLayer, one generated SDF arrow image, and one scheduler independent of movement/arrow count.
- Current T1A caps are 24 simultaneous renderer inputs, the existing 1,000-vertex LineString bound, and 512 total arrow Points. Scheduler updates are bounded to a minimum 40 ms interval (maximum 25 updates/second); overflow increases visual spacing rather than dropping accepted paths.
- Path sampling/cache is input/camera driven rather than frame driven. Animated arrows follow multi-segment, curved, and U-turn-like paths with local bearings; no React state update or DOM Marker is used per frame/arrow.
- Explicit display offsets are CSS/display-space only and use the same render track for line plus static/animated arrows. T1A does not infer shared corridors or assign display tracks automatically.
- Reduced-motion static fallback, Page Visibility pause/resume, style replacement reconstruction, cleanup/remount, true-crossing preservation, explicit coincident-track separation, reverse semantics and canonical-coordinate immutability have deterministic browser evidence.
- Exact-head CI Run #68 passed build and browser-smoke; CI browser evidence passed 16/16 tests including all three T1A browser proofs. Fresh exact-head Code Review found no major issue and exact-head Security Review found no security issue.
- Evidence limitation retained for later product/UAT work: native headless Chromium delivery of subsequent media-change events was inconsistent, so the fixture uses media emulation plus explicit delivery to the actual production listener. Synchronous sampler/`setData()` timings also exclude asynchronous worker/GPU time and are not general performance benchmarks.
- Control-plane acceptance comment: PR #55 comment `5970679009`.

## Recently accepted project workflow work

### Issue #5 / #5D — browser-local project workflow
- PR #53 merged to `main` as `9c05cc19ec2af22cc01334a10574358b991a8ae5`.
- Accepted PR head: `4d2ce745439bcdc54026f96e36218ed5af1b8a1e`.
- The existing IndexedDB database version 1 and `project-state` object store remain unchanged; Project Document v1 remains unchanged.
- Browser-local projects use `project:<projectId>` records plus one `active-project-id` pointer. The former `last-accepted-project` record is treated only as the legacy migration source.
- Valid legacy Project Document v1 data migrates byte-for-byte in one read/write transaction that writes the project record and active pointer and deletes the legacy key only on successful transaction completion.
- Malformed, unsupported/future, unreadable, or failed-migration recovery records remain preserved rather than being silently overwritten or deleted.
- The app now provides explicit New, Open, and Save-now local project actions. Save-now means a durable browser-local IndexedDB flush, not portable/native file export; broader project-file/package interoperability remains owned by #13.
- New/Open flush the current committed project before switching, reject failed flushes without changing the active pointer, preserve active draft/edit/Point-drag work by blocking the transition, and install the opened project as a fresh history root.
- React StrictMode startup on an empty catalogue is idempotent: concurrent bootstrap callers share one in-flight operation, preventing duplicate Untitled projects. The coalescing state clears after both success and failure so later reads/retries remain possible.
- Exact-head CI Run #63 passed build and browser-smoke. The focused production-preview project workflow suite passed 13/13 and a focused Vite development-mode StrictMode bootstrap regression passed 1/1.
- The StrictMode duplicate-bootstrap REQUIRED finding was remediated and its review thread resolved. Fresh exact-head Code Review found no new issue. The prior Security Review was reused because the final remediation changed only in-memory bootstrap coalescing/test harnesses and did not alter storage transactions, schema validation, migration, credentials, or security boundaries.
- One non-blocking FOLLOW-UP remains: add browser integration coverage for New/Open while an autosave is already in flight, including failed-flush behavior. Pure persistence tests already cover in-flight `flushNow` semantics.
- Issue #5 is closed as completed after #5A/#5B/#5C/#5D acceptance.

## Recently accepted spatial work

### R2 / Issue #7 — spatial-core umbrella closure
- Issue #7 is closed as completed after control-plane closure audit comment `5956210272`.
- The accepted R2 implementation is the bounded child sequence #41 (coordinate/unit + ellipsoidal geodesic kernel), #42 (indexed CAD snapping), and #43 (provider/basemap capability + credential-safe service contracts).
- The closure audit found no remaining material implementation gap after applying the later research/scrutiny record that superseded the original one-tranche #7 interpretation.
- Persistent transport/activity centroid behavior remains deliberately owned by #11, and live measurement/display conversion remains owned by #14; neither is a missing #7 implementation slice.
- Future tracing/reuse geometry, topology, map matching, routing, OSM-network redistribution/export licensing, and live-provider requalification remain separate future triggers rather than hidden R2 scope.

### Issue #43 — provider/basemap capability and credential-safe service contracts
- PR #50 merged to `main` as `eca3621ec974e3f27bae1b4348c69af0c39f3300`.
- Accepted PR head: `5bf6bf84daa82d8eba6af91bfa995f6465b38994`.
- OSM remains the credential-free default. CARTO Voyager is optional and requires a user-supplied runtime API key; no CARTO request is issued before a key is supplied.
- The runtime key is held only in the map controller memory and is excluded from Project Document, IndexedDB, exports, application URL/history, visible status/error text, logs, source, and committed test/output artifacts.
- CARTO style/tile/glyph/sprite requests are keyed only at the provider boundary. Approved hosts are the basemap apex, `tiles`, and `a`–`d` subdomains; unknown CARTO-family hosts fail closed.
- Host handling canonicalizes case and a terminal DNS dot before CARTO-family recognition and exact allowlisting.
- Clearing the runtime key destroys it immediately even when an active geometry draft defers switching away from Voyager; the draft is preserved and subsequent CARTO requests remain blocked until a new key is supplied.
- 3D capability remains conditional on compatible evidence from the actually loaded vector style/source; terrain remains unavailable.
- Public Nominatim is not activated. Only a minimal inactive optional-service type exists for future provider decisions.
- Exact-head CI passed build and browser-smoke (9/9). The original CARTO-subdomain BLOCKER and two later REQUIRED credential-boundary findings were remediated and all review threads resolved. Fresh exact-head independent review found no major issue; control-plane acceptance found no remaining BLOCKER / REQUIRED / FOLLOW-UP finding for #43.
- The separate Codex `Security Review` summary did not rebind from an earlier commit despite repeated exact-head requests; this was recorded as a tooling/modality limitation. The substantive independent-review requirement was satisfied by exact-head targeted review, deterministic credential regressions, CI, and control-plane credential/security review.
- Live CARTO key validity, CORS/quota behavior, and future production-style changes remain explicit external-provider requalification triggers rather than accepted live-service guarantees.
- Issue #43 is closed as completed.

### Issue #42 — indexed CAD snapping
- PR #46 merged to `main` as `f72ecb2495f2e48573326a45b083a7a897a8465c`.
- Accepted PR head: `f33dff43c5eeaf6d779c4ef6f4d94dc9ac46dc44`.
- The original P1 / REQUIRED finding was remediated by clipping segments to the screen plus the 12 CSS px tolerance and indexing only a bounded 32 CSS px grid corridor near each segment rather than every cell of its axis-aligned bounding rectangle.
- Deterministic diagnostics cover indexed cell-entry growth; long diagonal, off-screen, zig-zag, duplicate-cell, corridor and exact-edge regressions are present.
- Exact-head CI passed build and browser-smoke, the P1 review thread was resolved, fresh targeted review found no major issue, and control-plane acceptance found no remaining BLOCKER / REQUIRED / FOLLOW-UP finding for #42.
- Issue #42 is closed as completed.

## Current active / next work
- R1B / Issue #5 and R2 / Issue #7 are closed as completed.
- Issue #29 remains active. T1A directional renderer infrastructure is accepted; immediate next slice is T1B shared/near-collinear corridor detection plus deterministic presentation-only display-track layout, while preserving true crossings and canonical geometry.
- After #29 reaches useful product integration, continue the core product-authoring set with Site Access Route (#30), cartographic presentation (#32), and Site Plan overlay (#33), subject to dependency reconciliation.

## Current implemented stack
- Vite 6 + React + strict TypeScript + npm/ESM.
- MapLibre GL JS v6 for map/runtime.
- Terra Draw + MapLibre adapter for supported transient geometry creation/editing.
- Project-owned `SnapPolicy` with 12 CSS px tolerance and a 32 CSS px screen-space grid for accepted CAD snapping.
- Project-owned bounded directional renderer infrastructure with two shared GeoJSON sources, two shared layers, one generated SDF arrow image, cached display-path sampling, explicit display tracks, and one 25-updates/second scheduler.
- `@turf/buffer` for bounded derived buffers.
- `geographiclib-geodesic` for the protected WGS84 ellipsoidal geodesic kernel.
- Native IndexedDB for browser-local multi-project catalogue, committed Project Document v1 autosave/recovery, and explicit active-project selection.
- Playwright Chromium is used for the focused hosted browser-smoke gate; there is intentionally no broad multi-browser E2E matrix.
- Node 22 is the CI baseline.

## Current accepted product behavior
- Map navigation and OSM raster / CARTO Voyager switching with explicit loading/error behavior.
- Typed OSM/CARTO provider descriptors cover provider identity, raster/vector kind, attribution/policy, credential policy, usage restrictions, building capability expectation, terrain state, and style resolution.
- OSM is the no-key default. Voyager uses runtime-memory-only BYOK with fail-closed credential handling and keyed CARTO nested resources; credentials are not project truth.
- Truthful compatible/unavailable 3D state based on actual loaded-style/source evidence; 3D is visualization only and terrain remains unavailable.
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
- Browser-local multi-project catalogue with explicit New/Open/Save-now, active-project persistence, loss-preserving legacy migration/recovery, and fresh history roots after project switching.
- Native IndexedDB 500 ms committed-state autosave with Saved/Saving/Unsaved/Error state and strict recovery preservation.
- Accepted directional-renderer infrastructure can render bounded transient WGS84 LineStrings as static/animated directional display tracks with forward/reverse traversal, reduced-motion fallback, visibility pause/resume, style rehydration, explicit presentation-only offsets and bounded cleanup; this is infrastructure, not yet the user-facing Traffic Movement feature.
- Deterministic pure tests, strict typecheck/build, and focused production-preview/hosted Chromium browser evidence.
- WGS84 ellipsoidal inverse distance/bearing, line length, polygon perimeter, and absolute area kernel for later #14 measurement.

## Not yet implemented / not yet accepted
- Full Traffic Movement product feature (#29): T1B automatic overlap/shared-corridor display-track layout and T2 persisted semantic/domain/UI/history integration remain outstanding.
- Site Access Route (#30), Scenario/Stage (#31), presentation system (#32), Site Plan overlay (#33), semantic traffic annotations (#34).
- Live measurement UI (#14).
- Data-driven Desire Line / OD (#11), including persistent transport/activity centroid semantics when that workflow is implemented.
- Pedestrian Walking Walkshed (#9).
- Traffic-engineering result visualization (#16).
- Engineering-grade interoperability/cartographic export package (#13).
- Field evidence/photos (#15).
- Vissim/simulation trajectory replay (#22).
- GitHub Pages Phase C accepted deployment.

## Product direction / priority

`PRODUCT_DIRECTION.md` is authoritative for product priority.

Current high-level sequence:

`#29/#30/#32/#33 -> #14/#11 -> #12 -> #13/#15/#16 -> #9 when justified -> #22`

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
- DOM bounds, icon pixels, labels, callouts, animation state, directional display tracks/offsets, and marker hotspot presentation must never influence stored WGS84 geometry, buffer input, engineering calculations, or export geometry.
- Engineering outputs preserve source, method, parameters, units, version, validation/status, stale state, and limitations where applicable.
- Authored/imported data remain distinct from derived engineering results.
- Optional services require attribution, failure behavior, usage/licensing notes, and explicit capability state.
- Browser BYOK, if authorized, stays in runtime memory by default and never enters IndexedDB/project/export/log/Git.
- Snapping, tracing, map matching, routing/reachability, authored access routes, and simulation replay are distinct operations.
- No speculative generic plugin framework.

## Project-state contract
- Project Document v1 is current persisted project truth for each browser-local project.
- Current project state includes accepted layers/features/provenance/derived-buffer records and Point presentation.
- Browser-local catalogue identity/active-project selection are persistence workflow metadata, not fields inside Project Document v1.
- Selection, tool/mode, hover, draft/edit state, map runtime/camera, import status, animation phase, provider credential state, T1A directional renderer fixtures/display tracks, and other transient UI state are not persisted project truth.
- History is runtime-only and resets to a fresh root after reload/recovery/project switch.
- Project files/persistence must contain no credentials/secrets.
- Issue #5 owns the accepted browser-local project workflow; #13 owns broader portable/native interoperability packages where appropriate.

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
- Project workflow/persistence: `src/project/projectCatalog.ts`, `src/project/projectPersistence.ts`, `src/project/indexedDbProjectStorage.ts`
- Directional renderer proof: `src/map/directionalPath.ts`, `src/map/directionalClock.ts`, `src/map/directionalRenderer.ts`, `docs/development/traffic-movement-t1a.md`
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
1. Execute #29 T1B: detect obvious shared/near-collinear corridors and assign stable presentation-only display tracks while preserving real crossings and canonical geometry.
2. Keep #29 T2 persisted Traffic Movement semantics/UI/history separate until T1B layout evidence is accepted.
3. Carry the #5D in-flight-autosave browser regression as a non-blocking persistence/workflow hardening follow-up when that area is next touched.