# Project Profile

## Identity
- Project: City Map Tools
- Repository: https://github.com/bokoboss/city-map-tools
- Authoritative local path: `C:\MyRD\city-map-tools`
- Primary branch: `main`
- Package version: `2.2.0` (package label, not a production-readiness claim)

## Current accepted baseline
- Accepted pre-#20 main: `8c5ac1c1648a54370017977be38f88ed2a05dd71`
- Accepted date: 2026-09-13, project timezone UTC+07:00
- #2 workflow baseline, #3 R0B truth/security/quarantine remediation (PR #25), and
  #6 Phase A deterministic install/CI (PR #26) are accepted and merged.
- Durable program record: Issue #1. Latest checkpoint: Issue #23.
- Issue #18 is accepted and merged (PR #27); Issue #19 is accepted and merged
  (PR #28). Issue #20 is the current bounded geometry-editor implementation slice.

## Current implemented stack
- Vite 6 + React + strict TypeScript + npm/ESM MapLibre GL JS v6.
- Minimal root `index.html`, React bootstrap, dedicated MapLibre lifecycle adapter,
  small typed basemap config, and plain build-time CSS.
- Production scope: map navigation, OSM raster/CARTO Voyager vector switching,
  loading/error recovery, and explicit compatible/unavailable 3D state.
- Issue #19 scope remains: typed Point features/layers, point creation/selection/
  rename, layer visibility, and transactional safe Point-only GeoJSON import/export.
- Issue #20 scope: authored WGS84 Point, LineString, and single-exterior-ring Polygon
  workspace features; transient Terra Draw line/polygon creation and edit sessions;
  derived Turf buffers with explicit source snapshots, metres, library version, steps,
  stale/orphan state, and read-only derived geometry.
- Point presentation is a deliberately small runtime-only layer: dot center or pin-tip
  hotspot, 18/24/32 px marker size, and visible label placement in eight named positions.
  Presentation never changes canonical coordinates, buffer input, provenance, or exports.
- Accepted R0 monolithic prototype preserved unchanged as non-production reference
  at `legacy/r0-safe-prototype.html`; excluded from `dist/`.
- No persistence, history, multi-ring/MultiPolygon editor, full icon catalogue, or
  analytical engine. Workspace and point presentation state are in-memory only.
- Focused pure and production-preview browser fixtures cover the bounded spatial and
  MapLibre boundary behavior; they are not a claim of a general automated E2E suite.

## Accepted target direction
- Modular UI/application structure with pure TypeScript domain/analysis modules
  independent of React, DOM, and MapLibre.
- Local-first IndexedDB persistence and bounded workers for heavy analysis in
  separately authorized future slices.
- Optional provider adapters only for concrete needs; no speculative plugin platform.
- Static GitHub Pages artifact; no mandatory paid backend. Vercel Hobby is optional.

Future direction is not a claim of implemented capability.

## Package manager / commands
- npm with a committed deterministic `package-lock.json`; `npm ci` is established.
- Direct runtime dependencies: React, ReactDOM, MapLibre GL JS, Terra Draw,
  `terra-draw-maplibre-gl-adapter`, and `@turf/buffer`.
- Tooling: Vite 6, compatible plugin-react 4, TypeScript, React types.
- Exact installed versions are recorded by the lockfile.
- Node 22 is the CI baseline.

```text
npm ci
npm run dev
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
git diff --check
```

Typecheck is a real strict `tsc --noEmit` gate. No lint/unit/E2E script exists.
Production preview URL: `http://127.0.0.1:4173/city-map-tools/`.

## Architecture / protected invariants
- Personal/hobby, low-volume, static-first and local-first core.
- Never present/export synthetic, demo, experimental, or unvalidated results as
  validated engineering outputs. Quarantined analytics remain unavailable.
- `README.md` describes the current shell; `PRD.md` describes planned capability.
- Canonical geographic storage is WGS84 longitude/latitude. The map displays Web
  Mercator with approximate metric scale. The #20 buffer input is the exact canonical
  Point/LineString/Polygon snapshot; `@turf/buffer@7.4.0` receives a radius in metres
  and 8 steps, and returns a WGS84 Polygon. This is a functional, unvalidated derived
  spatial output, not surveyed/cadastral/validated engineering geometry.
- DOM bounds, icon pixels, labels, and marker hotspot presentation must never influence
  geometry, buffer input, provenance, export, or stored WGS84 coordinates.
- Engineering outputs must preserve source, method, parameters, units, version,
  validation status, stale state, and limitations through review/export.
- Authored/imported data must remain distinct from derived engineering results.
- Optional services require attribution, failure behavior, usage/licensing notes,
  and explicit capability state. Browser BYOK, if later authorized, stays in runtime
  memory by default and must never enter storage, exports, logs, or analytics.
- Never silently guess provider capability, CRS, units, or missing engineering values.
- Current future network-accessibility scope is pedestrian only; no motor-vehicle
  routing or traffic-aware isochrones. Snapping, map matching, and routing are distinct.
- Space Syntax #10 is deferred research requiring a future explicit GO/GO WITH
  CONDITIONS. Traffic overlay #16 and simulation replay #22 remain deferred.
- Follow bounded migration Issues #18–#21; no big-bang rewrite or dead deferred controls.

## Important paths
- Production: `index.html`, `src/main.tsx`, `src/App.tsx`, `src/map/`, `src/styles.css`
- Legacy reference: `legacy/r0-safe-prototype.html`, `legacy/README.md`
- Build/dependencies: `vite.config.ts`, `tsconfig.json`, `package.json`, `package-lock.json`
- Documentation: `README.md`, `PRD.md`, `ACKNOWLEDGEMENTS.md`, `DEVELOPMENT_LOG.md`
- Workflow: `AGENTS.md`, `.engineering-workflow/` (pinned v1.7.4), `.engineering-workflow.json`
- CI/deploy: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- No sensitive/licensed local data is required; never commit secrets or proprietary inputs.

## Validation matrix
| Gate | Method | Required |
|---|---|---|
| Deterministic install | `npm ci` | Yes |
| Strict TypeScript | `npm run typecheck` | Yes |
| Production artifact | `npm run build` | Yes |
| Diff hygiene | `git diff --check` | Yes |
| Browser | Production preview at configured base path; map/navigation/style/capability/error/cleanup plus focused geometry/hotspot fixtures | For runtime changes |
| CI | Exact PR-head stable `build` check: install + typecheck + build on Node 22 | Yes |
| Independent review | Actual diff/evidence according to applicable Issue/workflow risk | As required |
| Analytical/reference data | Method-specific deterministic/open fixtures | Before any analytical acceptance |

Deploy typechecks/builds and uploads only `dist/`. Pages repository configuration
is still a separate human-controlled blocker; do not alter it as part of #18.

## Workspace / execution policy
- Default writable boundary: `C:\MyRD\city-map-tools` only.
- Do not modify another repository, global/system configuration, PATH, registry,
  credentials, or shared workflow checkout without explicit approval.
- Preserve unknown/untracked work; no destructive reset/clean for convenience.
- Use focused branches and GitHub noreply identity; never expose private email.
- Reconstruct truth from Git/GitHub/project files, not prior chat history.
- Parallelize only with separated file/semantic ownership.
- Review actual diff and evidence. Do not claim completion with mandatory gates blocked.
- Report external writes and global/system changes explicitly.

## Current objective and remaining limitations
Complete/review #20 from accepted main.
Sequence: #18 → #19 → #20 → (#5 + #6 Phase B) → #21.

Provider availability/coverage is best-effort, 3D is visualization only, project
storage/history is absent, GeoJSON remains Point-only, and no engineering analytics
are validated. Derived buffers are bounded, read-only, structurally checked, and
explicitly unvalidated; they do not support antimeridian/pathological spans or
MultiPolygon output. The legacy reference retains prototype behavior and quarantine
but is not the current production app.
