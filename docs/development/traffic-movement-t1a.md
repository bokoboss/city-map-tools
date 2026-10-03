# Issue #29 T1A — directional renderer proof

This tranche adds reusable renderer infrastructure and deterministic synthetic proof fixtures. Traffic Movement is not yet exposed as a complete product feature. Automatic shared-corridor inference/layout remains **T1B**; persistence, domain semantics, inspector and authoring UI remain **T2**. Project Document v1 and IndexedDB v1 are unchanged.

## Execution contract and scrutiny

- Mode: **STANDARD**, high confidence; bounded presentation/lifecycle work, no analytical method, credential-boundary change or schema migration.
- Verified starting main: `67bc1b2d79861a79e95380863b4710940ebb80b9`; accepted product baseline: `9c05cc19ec2af22cc01334a10574358b991a8ae5`.
- Branch: `codex/traffic-movement-renderer-t1a`.
- Durable contract: [Issue #29](https://github.com/bokoboss/city-map-tools/issues/29), [overlap contract](https://github.com/bokoboss/city-map-tools/issues/29#issuecomment-5653293765), [T1A qualification](https://github.com/bokoboss/city-map-tools/issues/29#issuecomment-5967917282), and the user's bounded execution request.
- Local workflow: pinned version 1.7.4, manifest hashes verified after CRLF → LF normalization. Applied router, mode/safety, core workflow, context/model routing, acceptance, scrutiny, long-task guard, independent review and systematic debug when the browser gate failed.
- Workspace: only `C:\MyRD\city-map-tools`. Authorized external actions: one branch, normal push, one PR, review comments and resulting CI. No merge or global/system changes.
- Execution follows the user's explicit Sol/High override of the older qualification's executor recommendation, in the fresh task.
- Scrutiny: **GO WITH CONDITIONS**. The existing controller supplies the lifecycle seam; a small cached native renderer avoids a map-owner rewrite. Conditions: prove exact display-track alignment at corners, bounded worker/source workload, style reconstruction, motion/visibility cleanup and canonical immutability before acceptance. Tests must inspect actual rendered layers, not just desired GeoJSON. No additional research dependency or rendering framework is needed.
- Stop if canonical/schema mutation, a runtime dependency, automatic overlap inference, engineering traffic quantities, custom WebGL/deck.gl, or broad controller redesign becomes necessary. Routing, topology, scenarios and trajectories remain out of scope.
- Independent review: fresh `@codex review` after exact-head CI, focused on renderer/scheduler/lifecycle/caps/immutability/scope. Resolve BLOCKER and REQUIRED findings; control-plane acceptance owns merging.

## Input and resource contract

`DirectionalInput` is a transient renderer-owned snapshot: stable id; WGS84 LineString coordinates; forward/reverse; hex color; opacity; CSS-pixel line width, icon size and visual spacing; animation enabled; visual CSS pixels/second; explicit signed display offset. These values are presentation settings and do not imply vehicle speed, headway, volume or surveyed lanes.

| Bound | Value / behavior |
|---|---|
| Inputs | 24 simultaneously; an oversized update is rejected atomically and prior rendering retained |
| Vertices | 1,000 per input, reusing the accepted project LineString bound |
| Arrow Points | 512 total, including static symbols; at 24 saturated movements equal quotas produce 504 |
| Cadence | Minimum 40 ms between scheduler updates: at most 25 updates/second |
| Line width | 1–16 CSS px |
| Icon image size | 8–48 CSS px, including transparent SDF padding |
| Requested spacing | 24–256 CSS px; actual equal spacing may increase under the arrow budget |
| Visual animation rate | 0–120 CSS px/second, presentation only |
| Explicit track offset | −64…+64 CSS px; positive is right of canonical first-to-last traversal |
| Projection scope | Web Mercator latitudes ±85°, no antimeridian crossing; invalid/degenerate projection reports a local limitation |

24 is a conservative low-volume diagram workspace limit, not an engineering standard or a scalability claim. Together with 1,000 vertices it bounds geometry/serialization work. 512 bounds every update's arrow allocation and source serialization; the browser fixture exercises 24 × 1,000 vertices and 504 animated arrows. Resource overflow increases display spacing truthfully while preserving every accepted track and canonical input. Invalid input updates never discard the prior inputs. Per-path projection failure is diagnostic and recoverable by changing the camera or input.

The active renderer owns exactly **two shared GeoJSON sources**, **one LineLayer**, **one SymbolLayer**, **one generated 40×40 SDF arrow image**, and **one scheduler**. No resource count depends on arrow count. The production controller creates the renderer lazily; without fixture inputs it owns no movement sources/layers. There are no DOM arrows, React frame state, Turf frame operations, runtime dependencies or external sprite/glyph resources.

## Sampler, tracks and direction

Input validation copies coordinate arrays. Equivalent input snapshots reuse the cache; changed geometry or presentation invalidates it. Camera move/resize and style reconstruction rebuild the projected cache explicitly, separately counted from input changes. Animation frames never rebuild or sum the path.

The pure sampler caches cumulative CSS-pixel segment distances and uses binary lookup for each arrow. Zero-length projected segments are skipped; a completely degenerate path reports a local limitation. Bearings are clockwise from viewport-up. Forward samples first-to-last; reverse samples last-to-first and adds 180° to local bearing. No canonical coordinate is reversed, offset or smoothed.

A bounded screen-space miter/bevel computes the explicitly supplied whole-path track once. The renderer unprojects those transient vertices for the native line source; both static and animated Points sample that **same** track. This is chosen over independent native `line-offset` and `icon-offset` because independent offsets can disagree at joins and reverse traversal. The track offset is always relative to canonical direction, so Reverse does not swap track sides. This is a presentation cache, never an authored/project/export geometry.

Static mode uses the same native point SymbolLayer and cached repeated samples, with phase zero, rather than a separate line-placement implementation. This provides identical spacing, direction, caps and join alignment for Animation Off and reduced motion. Curve/U-turn bearings follow each polyline segment, not the first-to-last chord. T1A accepts explicit offsets only; it has no intersection/shared-corridor detector or track assignment. A true crossing with zero offsets stays a crossing.

## Lifecycle ownership

`createMap` retains the renderer beside the editor, feeds only explicit transient inputs, suspends before full `setStyle({diff:false})`, and calls renderer hydration through its existing `style.load`/bounded `idle` hydration path. Sources/layers/images are reconstructed idempotently from retained inputs. The renderer adds no style listener or second Map owner. Equivalent hydration calls do not rebuild a live cache.

The renderer owns map `move` and `resize`, document `visibilitychange`, and reduced-motion media `change`: four listeners, plus one RAF token. `performance.now()` supplies monotonic absolute elapsed time. Skipped frames compute the latest phase once; there is no catch-up loop. Pause freezes elapsed presentation time. Hidden documents cancel scheduled animation; visible documents resume with one token and reproject only if the camera/input changed while hidden. Reduced motion cancels animation and publishes readable phase-zero arrows. Static inputs schedule no continuous work.

Destroy cancels RAF, removes all four listeners, removes both layers/sources and the image, and clears retained geometry/cache references. The controller destroys it before removing the Map. The fixture checks actual listener add/remove calls, retained old-controller update counts after remount, resource ids and pending-token counts. Renderer inputs never enter Terra Draw; future T2 must feed committed Apply geometry, not editor drafts.

## Evidence and acceptance gates

Pure tests: `npx tsx tests/directional-renderer.test.ts`; full pure suite: `npm test`.

Browser proof: build production first, then `npm run test:directional:browser`. Full browser regressions: `npm run test:browser:ci`. Both browser commands build the proof module separately; normal `npm run build` contains no fixture entry. Use the existing ignored project-local Chromium cache via `PLAYWRIGHT_BROWSERS_PATH=.cache/ms-playwright`; no global installation is required.

The browser fixture routes OSM to local synthetic tiles and CARTO-style requests to a deterministic synthetic background. The test uses a synthetic credential only; it does not qualify live CARTO service behavior. Visibility is exercised by deterministic document-hidden/event injection because headless focus is not a reliable visibility mechanism; actual production visibility listeners handle those events. Chromium media emulation sets reduced motion before renderer construction, proving the static default. Subsequent preference changes use emulated values and explicit notification to the actual media listener: native headless media change delivery was inconsistent (matches changed without a delivered event), including with observer hooks removed. This is deterministic handler/default evidence, not a claim of native OS-event delivery qualification. The scheduler also checks motion/visibility at its update boundary to prevent continuous work across delayed event delivery.

| Required gate | Evidence | State |
|---|---|---|
| Baseline, clean initial tree and pinned workflow | Git fetch, exact SHA and normalized manifest hashes | PASS |
| Deterministic local install | `npm ci --cache .cache/npm --no-audit --no-fund` | PASS |
| Targeted pure sampler/clock contracts | Forward/reverse, curves/U-turn/hairpin, bearings, offsets, degeneracy, bounds, immutable input, single loop/time/pause/destroy | PASS |
| Full pure regressions | `npm test` | PASS |
| Typecheck/build/diff hygiene | `npm run typecheck`, `npm run build`, `git diff --check` | PASS |
| Dedicated browser proof | 3/3 pass: actual symbol/line hit alignment; animated direction; static screenshots; motion/visibility; four full style replacements; cleanup/remount; canonical immutability; max workload | PASS |
| Existing browser regressions | `npm run test:browser:ci`, 16/16 pass (including the 3 proof tests) | PASS |
| Exact-head CI | build and browser-smoke on final PR head / merge test revision | PENDING |
| Fresh independent review | Actual diff and this evidence, findings classified BLOCKER/REQUIRED/FOLLOW-UP | PENDING |

Diagnostics report input and projection rebuilds separately, scheduler updates/pending frames/running state, arrow counts, source update counts, sources/layers/listeners, reduced-motion/hidden state and actionable limitations. Synchronous arrow sampling + `setData` call mean/max duration is reported; it excludes asynchronous worker/GPU time and is not a general performance guarantee. Browser rendered-feature checks cover completion of the actual native rendering work.

Local evidence captured 2026-10-03 on Node 24.14.0 / project-local Chromium with SwiftShader (CI independently uses Node 22):

- [Static synthetic renderer screenshot](evidence/t1a-static.png): separate straight/curved tracks, forward/reverse arrows, a U-turn and a true crossing. All are presentation fixtures, not engineering results.
- [Ordinary runtime diagnostics](evidence/t1a-ordinary.json): 7 inputs / 45 arrows, 21 updates in a 1,050 ms observation window, input/projection rebuilds unchanged at 3; 2 sources / 2 layers / one pending frame; synchronous arrow-update mean 0.10 ms and max 0.30 ms in this run.
- [Maximum workload diagnostics](evidence/t1a-maximum.json): 24 inputs × 1,000 vertices / 504 arrows, 20 updates in a 1,000 ms observation window, input/projection rebuilds unchanged at 2; 2 sources / 2 layers / one pending frame; synchronous arrow-update mean 0.245 ms and max 0.50 ms in this run. The cap warning explicitly reports increased display spacing.
- Teardown instrumentation observed 4 listener registrations and 4 matching removals. The destroyed renderer reports zero sources/layers/Points/pending frames and does not advance after remount; the new renderer has one pending frame. Canonical fixture-coordinate JSON remains unchanged through the complete lifecycle.

Self-review inspected the actual controller diff and all new modules/tests. No project/schema/provider credential code, dependencies, engineering kernels or production UI were changed. No source/layer/RAF is allocated per arrow or per movement. Deferred overlap inference and product integration remain explicit.

Final SHA, PR, CI and review status are recorded in the PR/conversation, avoiding a self-referential commit hash in this file. No merge is authorized by this evidence record.

External writes: authorized branch/push/PR/review/CI only (once performed). Global/system changes: none. Destructive commands: none. No protected project/domain/spatial/provider file is changed except the bounded controller lifecycle seam.
