# Project Profile

## Identity
- Project name: City Map Tools
- Repository URL: https://github.com/bokoboss/city-map-tools
- Authoritative local path: `C:\MyRD\city-map-tools`
- Primary branch: `main`
- Package/application version: `2.2.0` (current package label; not a claim of production readiness)

## Current accepted baseline
- Accepted branch: `main`
- Accepted HEAD SHA: `a0691f98c3b6289c95243cad1bf0851291b9904d`
- Accepted date: 2026-09-12 (commit authored in the project timezone, UTC+07:00)
- Current phase/milestone: R0 productionization of prototype — workflow baseline, truth/security remediation, early CI
- Durable program record: GitHub Issue #1
- Handoff checkpoint: GitHub Issue #23

## Technology stack
### Current implemented stack
- Single-file HTML/CSS/JavaScript prototype in `index.html` (111,961 bytes at the accepted baseline)
- Vite 6 development/build shell from `vite.config.ts`
- Browser/CDN-loaded Tailwind CSS, MapLibre GL JS 5.1.1, Turf.js 7, and Lucide dependencies in the legacy prototype
- No React application architecture or TypeScript application modules yet
- No established persistent project storage
- No established automated unit or end-to-end test suite

### Accepted target direction
- Vite + React + TypeScript for modular UI/application structure
- MapLibre for the map canvas
- Pure TypeScript domain/analysis modules independent of React
- Local-first IndexedDB persistence
- Web Workers where bounded heavy client-side analysis needs them
- Optional provider adapters only for concrete external capabilities
- Static deployable artifact for GitHub Pages; Vercel Hobby is optional

The target direction is planned architecture, not current implementation.

## Package manager / dependency state
- Package manager: npm
- `package.json` currently contains Vite only as a development dependency.
- No lockfile exists at the accepted baseline; reproducible install is not yet established. #6/#18 must create and verify a deterministic lockfile before `npm ci` becomes an accepted gate.

## Standard commands
### Current local development
```text
npm run dev
```

### Current build smoke
```text
npm run build
```

### Current preview
```text
npm run preview
```

### Current fast/full validation
No accepted lint, typecheck, unit, or E2E command exists yet. Do not invent one. #6 introduces staged CI and #18+ introduces TypeScript/test gates.

## Architecture / invariants
- The core app is personal/hobby, low-volume, static-first, and local-first.
- Core functionality must not require a mandatory paid backend.
- No synthetic or demo analytical value may be presented or exported as a validated engineering result.
- `README.md` describes current capability; `PRD.md` and product-vision text may describe planned capability only when clearly labelled.
- Canonical persisted geographic geometry direction is WGS84 longitude/latitude; metric-analysis method and CRS must be explicit.
- Engineering/spatial results must carry method, source, units, parameters, version, status, and limitations appropriate to the claim.
- External services are optional capabilities with attribution, failure behavior, policy/licensing, and credential handling explicit.
- Browser API keys are not secrets; optional BYOK credentials are runtime-memory-only by default and are not persisted.
- Current network-accessibility scope is pedestrian only. Do not implement motor-vehicle routing or traffic-aware isochrones in the current program.
- Analytical/domain logic must remain independent of React/DOM state.
- UX must remain extensible through bounded task-oriented surfaces without becoming a speculative plugin framework.

## Protected behavior / product truth
Changes must not:
- re-enable quarantined pseudo Space Syntax, synthetic isochrone, synthetic elevation, or synthetic OD demand;
- represent experimental or unvalidated results as validated;
- silently guess CRS, units, provider capability, or missing engineering values;
- persist secrets or API keys;
- remove required attribution or provenance;
- conflate geometry snapping, map matching, and routing;
- make a polished export hide `Experimental`, `Stale`, or warning state.

## Important paths
- Legacy prototype/application source: `index.html`
- Vite config: `vite.config.ts`
- Package metadata: `package.json`
- Product vision: `PRD.md`
- Current/user-facing documentation: `README.md`
- Development history: `DEVELOPMENT_LOG.md`
- Project workflow profile: `PROJECT_PROFILE.md`
- Agent rules: `AGENTS.md`
- GitHub issue templates: `.github/ISSUE_TEMPLATE/`
- GitHub workflows: `.github/workflows/deploy.yml`
- Installed/pinned workflow after #2: `.engineering-workflow/`
- Workflow manifest: `.engineering-workflow.json`
- Future modular source/tests (after #18+): `src/`, `tests/`
- Local-only/sensitive/licensed data: none required for current development; do not commit secrets or proprietary inputs.

## Validation matrix
| Gate | Command / Method | Required now? |
|---|---|---|
| Workflow installer | v1.7.4 `setup_project.py inspect/upgrade/validate` | Yes for #2 |
| Build smoke | `npm run build` | Yes when dependencies are available |
| Static/diff hygiene | `git diff --check` | Yes for implementation PRs |
| Unit / targeted | Not established yet | Added incrementally by #3/#18+ |
| TypeScript | Not established yet | Added by #18 |
| Browser/UI | Manual/browser smoke for the current prototype | Required where behavior changes |
| Real-data/reference | Method-specific deterministic/open fixtures | Required for accepted analytical methods |
| CI | Phase A in #6, expanded later | Required as established |

## Execution characteristics
- Typical task ambiguity: medium; prototype claims and implementation may conflict, so inspect source before preserving behavior.
- High-risk areas: geospatial units/CRS, analytical methodology, provider/licensing, DOM security, persistence/schema, and engineering-result/export truthfulness.
- Safe to parallelize only when file and semantic ownership are clearly separated.
- Architecture migration is intentionally split into Issues #18–#21; do not perform a big-bang rewrite.
- Prefer fresh bounded execution contexts at phase or risk changes.

## Workspace / Git policy
- Default writable boundary for Codex: `C:\MyRD\city-map-tools` only.
- Do not modify the shared workflow checkout, another repository, global config, PATH/registry, credentials, or system state without explicit human approval.
- Preserve unknown/untracked user work; no destructive reset/clean as convenience.
- Work on focused task branches; review actual diff, tests, and CI before acceptance.
- GitHub Issue/PR/commit/CI and project files are durable truth; chat history is not authoritative.
- Use GitHub noreply identity; never expose the user's private email.

## Current known limitations / risks
- Pre-R0 application is a monolithic ~112 KB `index.html` prototype.
- Current README/PRD overstate some implemented analytical capability.
- Known pseudo/synthetic analytics and DOM-XSS/provider/dead-control defects are tracked in #3.
- No persistence/autosave.
- No deterministic lockfile at the accepted baseline.
- Historical GitHub Actions runs `34681081318` and `34681441457` failed at the `Setup Pages` step because GitHub Pages was not enabled/configured for GitHub Actions at that time; `.github/workflows/deploy.yml` exists in this checkout.
- Space Syntax #10 is deferred research and is not part of v1 implementation.
- Future traffic-result overlay #16 and 3D simulation replay #22 are deferred.

## Current next objective
Complete #2, then #3 and #6 Phase A according to Issue #1/#23 sequence.
