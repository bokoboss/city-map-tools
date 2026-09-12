# Issue #18 execution and local acceptance evidence

Date: 2026-09-12. Scope: R1A-1 modular shell + MapLibre foundation only.

## Contract and authoritative state

- Work mode STANDARD, high confidence, per explicit Issue/user override. Requested
  execution routing: GPT-6 Astra High, fresh context, coherent end-to-end pass.
- Initial branch `codex/r0-ci-phase-a`, HEAD
  `9ac1d63283656eb96df73494ddcf25754919ad55`, clean worktree.
- Remote main verified as `37417ff12c8adb5ec2de83da99aa3fdae720c09c`.
  Initial branch was PR #26's merged head; tree matched accepted main exactly.
- Implementation branch: `codex/r1a1-react-map-shell`, created from accepted main.
- Authoritative [execution packet](https://github.com/bokoboss/city-map-tools/issues/18#issuecomment-5646536284),
  [routing addendum](https://github.com/bokoboss/city-map-tools/issues/18#issuecomment-5646556977),
  and [Issue #23 checkpoint](https://github.com/bokoboss/city-map-tools/issues/23#issuecomment-5646536970)
  read before source mutation.
- Writable boundary: `C:\MyRD\city-map-tools`; only the requested commit/push/PR
  operations are authorized external repository mutations. No merge or Pages setting change.

Scrutiny: GO WITH CONDITIONS before implementation: preserve the accepted legacy
blob, use only accepted providers, prove the production worker/vector path, expose
failure and incompatible 3D truthfully, and resolve independent review plus all
local/browser/exact-head CI gates. No feature/editor/persistence/analytics work is
needed. Stop on Vite-major, provider/license/credential decisions, unreliable worker
integration, unexplained user work, or scope/workspace expansion.

UI workflow: view/navigate map → choose basemap → inspect loading/ready/error and
3D availability → optionally toggle visualization → switch/reload for recovery.
Native labelled controls, visible disabled reasons, live status, keyboard map
navigation, and a narrow viewport layout are included. No deferred dead controls.

## Dependencies and production integration

| Dependency | Exact lockfile version | Purpose |
|---|---|---|
| react | 19.3.0 | UI |
| react-dom | 19.3.0 | Browser React root |
| maplibre-gl | 6.9.0 | Map rendering |
| typescript | 5.9.3 | Strict typecheck, compatible established compiler line |
| @types/react | 19.3.0 | React typing |
| @types/react-dom | 19.3.0 | Browser root typing |
| @vitejs/plugin-react | 4.7.0 | Vite React integration |
| vite | 6.4.3, unchanged | Existing build tool |

`npm view @vitejs/plugin-react@4.7.0 peerDependencies --json` returned
`^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0`; the existing locked Vite 6.4.3 satisfies it.
No scaffolder or Vite-major upgrade was used. No analytical, UI framework, router,
state, persistence, Turf, or test-framework package was added.

The adapter uses `maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url` and calls
`setWorkerUrl(workerUrl)` before creating a map, following
[official MapLibre Vite guidance](https://maplibre.org/maplibre-gl-js/docs/#installation).
MapLibre CSS is imported at build time. No runtime CDN globals are used by the shell.

## Local gates

Environment: Windows, Node 24.14.0 / npm 11.14.1 locally; CI remains Node 22.

| Gate | Result / evidence |
|---|---|
| Clean `npm ci --cache .cache/npm` | PASS, 94 packages installed, 0 reported vulnerabilities |
| `npm run typecheck` | PASS, strict `tsc --noEmit`, including app and Vite config |
| `npm run build` | PASS, Vite 6.4.3; non-blocking large-chunk advisory retained |
| `git diff --check` | PASS |
| Legacy equivalence | PASS: baseline `index.html` and `legacy/r0-safe-prototype.html` both Git blob `d05b78a71e38720391152b4495fb959e7b386803` |
| Production isolation | PASS: `dist/` contains only minimal HTML and bundled JS/CSS/worker; no legacy HTML |
| Scope/quarantine | PASS: source contains no editor/data/history/persistence/analytical migration |
| Independent code/config/docs review | PASS after one P2 remediation described below |

The original legacy snapshot contains four whitespace-only lines. A path-specific
`.gitattributes` rule tolerates their inherited trailing whitespace so the snapshot
remains byte-identical; production files retain normal diff whitespace checks.

Built assets tested (SHA-256):

- `index-CKwHtlFN.js`: `5c1b6234b7d5cb4b2bd6f8a9d94529a7468270ad23ab50e53c8d3697b5f0e4df`
- `index-DsX4zSah.css`: `3b902bd682a2bfda8b597e03d21ab0a031bf5fb54b51eea3275226fe49d4dd67`
- `maplibre-gl-worker-PcuQ6pji.js`: `5bd3d3530819d942b3e7f8f5ec4e52449a208adb10e4d6ebad85c12163c42963`

## Production browser evidence

Server: `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`.
Exact URL: **http://127.0.0.1:4173/city-map-tools/**.
Browser: Microsoft Edge 153.0.4234.32 driven by Playwright CLI; desktop 1440×960,
mobile viewport 390×844. Screenshots were visually inspected.

| Scenario | Result |
|---|---|
| OSM real raster rendering | PASS, visible labelled Bangkok map, attribution, Ready |
| Pan | PASS, center moved from 100.50180 E / 13.75630 N to 100.49424 E / 13.75835 N at zoom 14 |
| Zoom | PASS, zoom 14 → 15 using navigation control |
| OSM → CARTO and return | PASS, real vector tiles/labels, retained location/zoom and attribution |
| Production worker | PASS, worker loaded from `/city-map-tools/assets/maplibre-gl-worker-PcuQ6pji.js` |
| Incompatible 3D | PASS, OSM visibly unavailable, native button disabled |
| Compatible 3D | PASS, CARTO buildings visibly extruded; toggle on/off; provider height/coverage limitation visible |
| Style lifecycle | PASS, switching clears 3D; rapid Voyager/OSM/Voyager settles ready with 3D off |
| Tile failure while 3D on | PASS, injected aborted vector request; UI unavailable, toggle disabled/unpressed, pitch zero, extrusion visibly absent |
| Style provider failure | PASS, injected style HTTP 503; explicit error and disabled 3D; switching to OSM recovers |
| React unmount/remount | PASS, three Reload map cycles; each old canvas detached, one canvas remains |
| Observer/worker growth | PASS, active observers 2 → 2, disconnected observers 0 → 6, shared workers 1 → 1 |
| Narrow viewport | PASS, readable controls/map, no horizontal overflow, attribution visible |
| Console | PASS, zero uncaught page errors and zero normal-flow console errors; one expected HTTP 503 console entry from deliberate failure injection |

MapLibre v6 retains a shared global-dispatcher worker across map instances
(`src/util/dispatcher.ts` in the installed library). Worker termination on every
React remount is therefore not claimed; stable worker count, detached old canvas,
observer cleanup, and `map.remove()` are the lifecycle evidence.

Local reproducible QA artifacts are ignored working outputs, not a new test suite:
`output/playwright/issue18-smoke.js`, `production-smoke-result.txt`, `pan-check.js`,
`pan-result.txt`, and screenshots `01-osm-final.png`, `02-voyager-3d-final.png`,
`03-resource-error-flat.png`, `04-style-error.png`, `05-mobile.png`.
The CLI was run via project-cached npx; no global package/browser install was used.

## Independent review and remaining gates

A fresh-context read-only reviewer inspected the actual adapter, config/CI diff,
legacy blob, installed MapLibre lifecycle internals, and final documentation.
It found a P2: resource failure reported unavailable while an enabled extrusion
remained visible. The error handler now hides the layer and resets pitch, guards
synchronous reentry, and exposes reload guidance if rendering itself fails.
The reviewer re-exercised the actual transpiled adapter and returned PASS.
The production-browser failure injection above independently verified the fix.

The final commit SHA, PR URL, and exact-head GitHub Actions `build` run/conclusion
are recorded in the PR/task completion report after pushing this revision.
Local evidence alone does not substitute for that mandatory CI gate. No merge is authorized.

Residual limitations: online providers are best-effort; 3D is visualization with
provider-supplied heights, not engineering validation; large map bundle advisory;
Pages repository configuration remains human-controlled; later migration slices
remain separate.

External filesystem writes: none. Global/system changes: none. No destructive
reset/clean or unrelated repository mutation. Requested GitHub branch push and PR
creation are reported separately in the completion report.
