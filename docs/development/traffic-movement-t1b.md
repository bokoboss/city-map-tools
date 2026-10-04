# Issue #29 T1B — shared-corridor display layout

T1B is presentation infrastructure over the accepted T1A renderer. It does not complete Traffic Movement. Persisted roles, Project Document changes, conversion/authoring UI, inspector and semantic history remain T2. All proof geometry is synthetic and is not an engineering result.

## Execution contract and scrutiny

- Work mode: STANDARD, medium-high confidence. The frozen control-plane design is reused; no new research dependency or broad renderer rewrite is needed.
- Verified fetched starting main: `af91d27b46c5d6f5c27abb7b8c28bbc0a0121ddd`.
- Accepted product-code baseline: `5013c0647b94cdf57b05b47df5784bd763e37e35`; accepted T1A head: `1021fb9ac158348985e369dc0f77eb922f6a533b`.
- Branch: `codex/traffic-movement-layout-t1b`, created from exact verified main after a clean-worktree check.
- Authoritative scope: [Issue #29](https://github.com/bokoboss/city-map-tools/issues/29), [legibility contract](https://github.com/bokoboss/city-map-tools/issues/29#issuecomment-5653293765), [architecture freeze](https://github.com/bokoboss/city-map-tools/issues/29#issuecomment-5970795209), [bounded execution packet](https://github.com/bokoboss/city-map-tools/issues/29#issuecomment-5978498740).
- Pinned workflow 1.7.4: all 29 managed-file hashes match after CRLF normalization. Applied routing, workspace safety, core workflow, context/model routing, acceptance, scrutiny, long-task guard, independent review and focused systematic debugging.
- Scrutiny: GO WITH CONDITIONS. Preserve crossings/canonical coordinates; prove partial tracks and all three visuals in actual native rendering; expose deterministic limits/ambiguity; preserve T1A lifecycle; obtain exact-head CI and fresh review. No protected analytical method, schema, persistence, provider, credential or network boundary is changed.
- Workspace writes: `C:\MyRD\city-map-tools` only. Explicitly authorized external actions: normal push, one focused PR, CI and review comments. No merge; control-plane acceptance remains required.

## Pure kernel and policy

`layoutDirectionalPaths` receives stable movement IDs, projected canonical points, canonical-direction manual base offsets, optional transient order and optional auto-layout eligibility. It returns one render-only `DisplayPath` per ID and deterministic diagnostics. It imports only the existing pure sampler; it has no MapLibre, React, DOM, project mutation or storage dependency.

All units below are CSS pixels except the axial angle. None is a physical lane dimension.

| Policy | Exact value |
| --- | --- |
| Arc resampling step | 8 |
| Maximum centerline proximity | 12 |
| Maximum axial tangent difference | 15 degrees, modulo 180 |
| Minimum contiguous run | 48 on both paths |
| Nominal centered track spacing | 14 |
| Smooth entry/exit taper | 40 |
| Uniform grid cell | 24 |
| Total resampled points | 8,192 |
| Grid candidate visits | 131,072, including rejected/same-path candidates |
| Run/profile lookup checks | 131,072 |
| Warning details | 64, plus one reserved budget warning; additional occurrences counted |

The six frozen heuristics are unchanged. Original polyline corners are inserted beside 8px arc samples. A preflight estimate checks allocation before long/off-screen paths are sampled. Segment midpoints are hashed into a 24px uniform grid; sample lookup visits the surrounding nine cells. Indexed segments are at most 8px long, so this search includes every segment within the 12px tolerance. There is no all-segment matching loop.

Nearest segment candidates must meet proximity and axial orientation together. Pairwise matches must be consecutive in source samples, monotonic in matched arc distance, and cover at least 48px on each path. Large correspondence jumps and folded/equally near alternatives are declined. A crossing point alone, short tangency, or already-distinct parallel path cannot create a run.

Local bundles require pairwise common runs rather than connecting a chain of nearby paths. Members are sorted by explicit order, then stable ID using code-point ordering. The first member's canonical projected traversal supplies the reference frame. Slots are centered on that frame, with existing centerline differences accounted for; opposite canonical traversal uses the corresponding signed local normal. Semantic Forward/Reverse is absent from the kernel and cannot mirror/reorder tracks.

## Partial tracks, taper and manual fallback

Offsets exist only within proven local bundles. Each contiguous bundle-membership section uses a clamped cubic smoothstep over 40px at non-endpoint boundaries. Outside it, the movement returns to its manual base offset. The taper also applies when membership changes, so a surviving pair does not abruptly jump when a third movement leaves. A path endpoint has no off-path transition. Bounded miter/bevel joins reuse T1A's policy; transient inserted vertices remain display data.

At short membership sections, entry/exit tapers can meet before a full-spacing plateau. Near junctions, inconsistent local bundle membership is explicitly diagnosed and automatic samples are declined; this does not infer topology. Folded paths and non-common proximity chains likewise return warnings. Budget exhaustion or a generated path exceeding the supported display extent returns the complete manual/base-path fallback atomically, including paths already processed. No partial budget-limited layout is published. The profile guard exits immediately at its cap, including from array callbacks.

Transient `layoutOrder` is finite within ±1,000,000; stable ID breaks ties. `displayOffsetPixels` retains T1A's ±64px canonical-direction meaning. For backward compatibility, explicit nonzero base offsets opt out of automatic layout unless `autoLayout: true` is supplied. `autoLayout: false` explicitly opts out. These renderer/API settings do not persist or have a production UI.

## Renderer integration

Projection rebuilds call the kernel once after input/camera/style changes. The final returned path supplies the native line vertices and every static/animated arrow position and bearing. The animation callback still only samples cached final paths and updates the shared Point source; it never calls layout.

T1A remains: 24 movements, 1,000 canonical vertices/input, 512 total arrows, one scheduler with 40ms minimum update interval, two shared sources, one line layer, one symbol layer, one generated SDF image, four owned listeners. Static/reduced-motion behavior, Page Visibility, full-style hydration, destroy/remount and input rejection remain covered. No dependencies, controller architecture, React frame state, DOM arrows, project history/storage, provider credentials, snapping or engineering kernels change.

Diagnostics expose layout rebuilds, sample/candidate/profile checks, local matches, qualifying pair runs, warning details/suppression, fallback state and unchanged T1A scheduler/resource/update metrics. `sharedRuns` counts qualifying pair runs, not road/lane groups. A fallback sets accepted run count to zero while retaining detected local-match counts.

## Fixture evidence

Pure command: `npx tsx tests/directional-layout.test.ts`. Seventeen named fixtures pass, including the fifteen mandatory behaviors and added correspondence/budget/manual-input/extent assertions.

| Required fixture | Evidence |
| --- | --- |
| Shared same-direction approach then divergence | Separate ±7px plateau, 40px taper, zero offset downstream |
| Three-way left/through/U-turn approach | Stable −14/0/+14px slots |
| Opposite-direction corridor | Common reference frame, stable ±7px sides |
| Downstream merge | Untouched upstream path and smooth entry to shared track |
| Curved corridor | Separate finite tracks and local bearings |
| U-turn beside through movement | Shared approach separated, return leg untouched |
| Genuine crossing | 30/60/90-degree crossing inputs retain exact display paths; native browser crossing has both rendered lines |
| Already-distinct parallels | 12.01px separation remains untouched |
| Short tangent/near-touch | 40px run and brief tangency do not qualify |
| Animation/pan/zoom/style ordering | Pure translated/scaled/input-reordered cases; native browser ordering after animation and two full replacements |
| Forward/Reverse side preservation | Same final paths after semantic reversal; actual browser line-source equality |
| Line/static/animated alignment | Native rendered line and symbol hits on sampled tapered tracks, plus screenshot inspection |
| Transient manual override | Order/base/disable-auto pure tests; actual browser manual-order change |
| Canonical WGS84 immutability | Input snapshots and browser fixture coordinate JSON unchanged through lifecycle |
| Bounded work off frame loop | Sample/candidate/profile overflow fixtures return atomic fallback; browser layout counts remain constant while updates advance |

Additional fixtures cover near-identical but non-coincident centerlines, staggered bundle membership, folded/non-common ambiguity, warning detail bounds, deterministic budget results, invalid override rejection and atomic fallback at both ±1e8 display-extent boundaries. The extent regression addresses independent review's REQUIRED P2 finding that generated offsets could throw outside the renderer's per-input projection handler. T1A's 24 × 1,000-vertex, 504-arrow maximum proof still passes with explicit manual tracks.

Browser proof: `npm run test:directional:browser` passes 4/4 (three retained T1A cases plus T1B). Full suite: `npm run test:browser:ci` passes 17/17, including provider/credential, project workflow/recovery, snapping, geodesic bundle, authoring/history and T1A lifecycle gates. Chromium uses the existing ignored `.cache/ms-playwright` cache. Synthetic OSM tiles/styles and the synthetic CARTO credential qualify deterministic renderer behavior only, not live provider service validity.

- [Static actual-render screenshot](evidence/t1b-static.png): visibly separate shared approaches/opposite tracks/curves, tapered divergence, preserved true crossing.
- [Runtime diagnostic observation](evidence/t1b-diagnostics.json): sample/candidate/profile counts and resources before/after 1,050ms of animation. Timing is synchronous arrow sampling plus `setData`, excluding asynchronous worker/GPU cost.

The sandboxed browser attempt could not access localhost sockets and left preview resources briefly occupied. Cancelling that attempt and running the same project-local browser command with authorized localhost access resolved the environment boundary; no firewall, global browser, PATH, service or system setting was changed.

## Validation and review state

`npm ci --cache .cache/npm --no-audit --no-fund`, focused kernel fixtures, `npm test`, `npm run typecheck`, `npm run build`, `git diff --check`, focused browser and complete browser suites passed locally on Node 24.14.0. The existing Vite large-chunk advisory remains. CI independently uses Node 22.

Final commit, PR, exact-head CI and independent-review outcome are recorded in the PR and completion report so this file does not encode a self-referential SHA. Review must follow the execution packet: false crossings/corridors, ordering, tapers, bounds, actual alignment, immutability, T1A lifecycle and scope. Resolve BLOCKER/REQUIRED findings before control-plane acceptance. Security review is not required for this unchanged boundary.

External writes: authorized push/PR/review/CI only once performed. Global/system changes: none. Destructive commands: none. T2 and #30 remain separate.
