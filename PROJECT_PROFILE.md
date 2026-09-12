# Project Profile

## Identity
- Project: City Map Tools
- Repository: https://github.com/bokoboss/city-map-tools
- Authoritative local path: `C:\MyRD\city-map-tools`
- Primary branch: `main`
- Package version: `2.2.0` (package label, not a production-readiness claim)

## Current accepted baseline
- Accepted pre-#18 main: `37417ff12c8adb5ec2de83da99aa3fdae720c09c`
- Accepted date: 2026-09-12, project timezone UTC+07:00
- #2 workflow baseline, #3 R0B truth/security/quarantine remediation (PR #25), and
  #6 Phase A deterministic install/CI (PR #26) are accepted and merged.
- Durable program record: Issue #1. Latest checkpoint: Issue #23.
- Issue #18's execution packet and latest routing addendum authorize this first
  modular shell. This branch's implementation is pending PR acceptance; it does
  not change the accepted main SHA above.

## Current implemented stack
- Vite 6 + React + strict TypeScript + npm/ESM MapLibre GL JS v6.
- Minimal root `index.html`, React bootstrap, dedicated MapLibre lifecycle adapter,
  small typed basemap config, and plain build-time CSS.
- Production scope: map navigation, OSM raster/CARTO Voyager vector switching,
  loading/error recovery, and explicit compatible/unavailable 3D state.
- Accepted R0 monolithic prototype preserved unchanged as non-production reference
  at `legacy/r0-safe-prototype.html`; excluded from `dist/`.
- No production editor, GeoJSON workflow, persistence, history, or analytical engine.
- No established automated unit/E2E suite. Production-preview browser smoke is
  required for changes at the React/MapLibre/provider boundary.

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
- Direct runtime dependencies: React, ReactDOM, MapLibre GL JS.
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
- Canonical geographic storage direction is WGS84 longitude/latitude. The current
  map displays Web Mercator with approximate metric scale and performs no metric
  analysis. Future calculations must state method, CRS, units, and transformations.
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
| Browser | Production preview at configured base path; map/navigation/style/capability/error/cleanup | For runtime changes |
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
Complete/review #18, then reconstruct accepted main before #19.
Sequence: #18 → #19 → #20 → (#5 + #6 Phase B) → #21.

Provider availability/coverage is best-effort, 3D is visualization only, project
storage is absent, and no engineering analytics are validated. The legacy reference
retains prototype behavior and quarantine but is not the current production app.
