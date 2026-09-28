# Issue #41 R2A-1 evidence

## Contract and baseline

- Work mode: STRICT. Accepted `main` and `origin/main` before branching:
  `b1ecdf46fcb1c268957805d1eb3ce9f3fae4aadb`; worktree clean.
- Branch: `codex/r2a1-geodesic-kernel` from that commit.
- Authoritative contract: [Issue #41 comment 5857245478](https://github.com/bokoboss/city-map-tools/issues/41#issuecomment-5857245478).
  Parent research/scrutiny: [Issue #7 comment 5857183608](https://github.com/bokoboss/city-map-tools/issues/7#issuecomment-5857183608).
- `.engineering-workflow.json` pins workflow v1.7.4; all 29 managed files matched
  their SHA-256 manifest entries after CRLF-to-LF normalization.
- Pre-implementation scrutiny: GO WITH CONDITIONS under the frozen child scope.
  The conditions are existing WGS84 types/validators, pure math, explicit units,
  reference fixtures, no v1 schema migration, no UI/buffer changes, and final
  independent review. Final acceptance remains pending CI and review.

## Dependency qualification

- `geographiclib-geodesic` is pinned exactly to `2.2.0` in `package.json` and
  `package-lock.json`; `npm ls --depth=0` resolved `2.2.0`.
- npm/package metadata declares `types/geographiclib-geodesic.d.ts`, MIT license,
  and no `dependencies`, `peerDependencies`, or `optionalDependencies`. The
  lockfile adds one package node with no transitive package edges. Bundled
  `LICENSE.txt` identifies the MIT/X11 terms and Charles Karney copyright.
- `npm run typecheck` passed with strict TypeScript and Bundler resolution, with
  no shims, `any`, or config weakening.
- The production Vite build and hosted browser smoke passed. As the pure kernel
  is not connected to app UI yet, a separate Vite library-entry probe bundled
  `src/spatial/geodesic.ts` to a 36.92 kB ESM file (10.76 kB gzip). Executing
  that bundle returned the Bangkok reference values below.

## Deterministic fixtures

`tests/geodesic.test.ts` runs through the committed `npm test` entry. The global
distance is from the official GeographicLib 2.2.0 documentation (rounded to
millimetres). Bangkok, antimeridian, and polygon reference constants are the
control-plane WGS84 GeographicLib calculations in Issue #41's contract.

| Fixture | Actual | Expected | Tolerance |
| --- | ---: | ---: | ---: |
| Wellington to Salamanca distance (m) | 19,959,679.26735382 | 19,959,679.267 | 0.001 m |
| Bangkok distance (m) | 3,717.1938537033648 | 3,717.1938537033648 | 0.000001 m |
| Bangkok initial bearing (degrees) | 74.98867206119132 | 74.9886720611913 | 0.000000001° |
| Antimeridian distance (m) | 22,263.898158653446 | 22,263.898158653446 | 0.000001 m |
| Antimeridian initial bearing (degrees) | 90 | 90 | exact |
| Bangkok polygon perimeter (m) | 4,375.690804507745 | 4,375.690804507745 | 0.000001 m |
| Bangkok polygon area magnitude (m²) | 1,196,511.9269070625 | 1,196,511.9269070625 | 0.0001 m² |

The suite also checks westbound normalization to 270°, zero distance with null
bearing (including equivalent antimeridian longitudes), line length as a sum of
accepted inverse segments, reverse-winding equality, and explicit rejection of
invalid/non-finite Point, LineString, and Polygon inputs.

## Local gates

Run on Windows with Node 24.14.0 / npm 11.14.1; CI uses Node 22.

| Gate | Result |
| --- | --- |
| `npm ci --offline=false --cache .cache/npm` | PASS; clean install, 0 audit vulnerabilities |
| `npm test` | PASS, including all geodesic reference fixtures |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; existing large-chunk advisory only |
| `npm run test:browser:ci` | PASS; hosted Chromium smoke 1/1 after installing project-local Chromium |
| Vite geodesic bundle probe and runtime Bangkok calculation | PASS |
| `git diff --check` | PASS |

The first local browser attempt could not launch because Chromium was absent.
Playwright Chromium was installed under the repository's ignored `.cache` path;
the same smoke command then passed. The first sandboxed `npm test` attempt was
blocked by child-process `EPERM`; the permitted rerun passed.

## Protected-math self-review before push

- **Coordinate order:** project validation yields `[longitude, latitude]`;
  `Inverse` and each polygon `AddPoint` explicitly receive `(latitude, longitude)`.
  The asymmetric global/Bangkok fixtures detect an accidental swap.
- **Units and bearing:** inverse `s12`, line sum, and perimeter are metres;
  area is square metres. `azi1` is normalized to `[0, 360)`, tested westbound.
- **Coincidence:** zero inverse distance returns a null bearing, including
  equivalent +180/-180 longitude points.
- **Ring and winding:** the validated explicit closing vertex is not fed to
  `Polygon.AddPoint`; `Compute(false, true)` supplies perimeter and signed
  algebraic area, and the public area is its absolute magnitude. Reverse-winding
  reference values pass. This is not topology qualification.
- **Failure behavior:** existing WGS84 validators reject malformed or non-finite
  coordinates/shapes. Non-finite library outputs and negative distances or
  perimeters throw. No spherical, Web Mercator, or degree fallback exists.
- **Dependency:** exact version, declarations, dependency graph, MIT/X11 license,
  TypeScript, Vite bundle probe, build, and smoke were checked as a set.
- **Scope:** diff changes only the pure module, tests, dependency files, method/
  evidence docs, and current project descriptions. No Project Document schema,
  App/MapCanvas, buffer implementation, measurement UI, snapping, provider,
  projection, or Thai-area change.

Exact-head `build` and `browser-smoke` CI and targeted `@codex` review are PR
gates; their final outcome is recorded in the PR and completion report.

External writes: none. Global/system changes: none. No destructive reset/clean.
