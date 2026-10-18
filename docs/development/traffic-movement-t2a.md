# Issue #29 T2A execution and acceptance evidence

Work mode: STRICT; confidence high. Executor: GPT-6.1 Sol / High, fresh task.
Writable filesystem boundary: `C:\MyRD\city-map-tools` only. Workflow pin: 1.7.4;
managed hashes verified before edits. No other repository/system mutations.

## Authority and scope

Verified fetched `origin/main`: `d0f1ca3512dc489440b5435865692a780e596924`.
Product baseline: `2d6d46bf1e37b60b60fd6be5e86b54e8e8fc132b` (PR #57).
Initial worktree clean on accepted T1B head `73c1837686f2fb0d31bfdd053a45719949f6dd6e`.
New branch: `codex/traffic-movement-domain-v2-t2a`, created from exact remote main.
No unknown work was overwritten. Existing main and T1B branches were retained.

Read full Issue #29, comments 5653293765, 5970795209, 6247514870 and the three
mandatory records: [architecture](https://github.com/bokoboss/city-map-tools/issues/29#issuecomment-6247947126),
[packet](https://github.com/bokoboss/city-map-tools/issues/29#issuecomment-6247960807),
[authorization](https://github.com/bokoboss/city-map-tools/issues/29#issuecomment-6248361988).
Read accepted PR #55/#57 metadata, AGENTS, PROJECT_PROFILE, PRODUCT_DIRECTION,
v1 architecture and pinned router/mode/workspace/core/context/model/acceptance
policies plus focused research, scrutiny, long-task and independent-review skills.

Research/scrutiny decision reused: GO WITH CONDITIONS, frozen contract unchanged.
Conditions carried into the gates below. Scope: strict v2, lazy loss-preserving
compatibility, transactional backup/CAS, domain history, deterministic tests/docs.
T2B UI, renderer lifecycle integration, export, traffic metrics, routing and merge
are excluded. Stop on loss of any v1 field, non-atomic backup/CAS, changed DB/store,
incompatible history/switch behavior or scope expansion. None was required.

## Mandatory acceptance matrix

All groups are mandatory. Test names/assertions in the listed files are the
reproducible evidence; final exact SHA, local outcomes, hosted CI and independent
review records are returned with the PR handoff, after verification.

| Group | Acceptance obligation | Evidence |
|---|---|---|
| 1 | Independent strict v1 and strict v2 round trips | `project-document.test.ts` (explicit v1 module), `traffic-movement.test.ts` |
| 2 | Lossless detached logical v2, metadata, geometry, lineage, buffers, Point style, weird IDs | same tests, field-by-field equality |
| 3 | Exact 2,000,000-character normalized v1 fits v2; oversized v2 rejected | exported v1 boundary fixture reused by `traffic-movement.test.ts`; v2 history aggregate overflow |
| 4 | Invalid/future/malformed/unknown fields reject and preserve raw | strict unit tests; project recovery browser suites |
| 5 | No semantic inference; only authored LineStrings convert | `traffic-movement.test.ts` |
| 6 | 24th accepted/25th rejected without partial mutation | `traffic-movement.test.ts` |
| 7 | Defaults, every numeric boundary, enum/NaN/Infinity rejection, prototype IDs | `traffic-movement.test.ts` |
| 8 | Direction/style/unconvert/delete + Undo/Redo preserve WGS84 | `traffic-movement.test.ts`; real IDB Undo/Redo/reload browser test |
| 9 | Apply retains annotation/stales buffer; Cancel preserves committed state | `traffic-movement.test.ts`; existing history/editor browser suite |
| 10 | Visibility/Point style/unrelated commands preserved | domain adapter and existing history/unit/browser regressions |
| 11 | v1 read/list/Open/Save-now do not write; truthful Saved | unit restore/bootstrap no-write checks; first v2 browser test |
| 12 | Exact-byte legacy migration then later edit backup | first v2 browser test; accepted #5D workflow tests |
| 13 | One transaction stores raw backup+v2; DB/store/index/pointer unchanged | first v2 browser test + held real transaction and rollback tests |
| 14 | Abort/quota/write rollback, unsaved retained, retry safe | three injected browser failure tests, persistence unit failures |
| 15 | Exact raw CAS on v1 and repeated v2 writes, conflicts preserve all data | browser stale-session test; unit expected-raw progression |
| 16 | Existing/corrupt/undefined backup never overwritten | three collision browser tests using actual IDB count |
| 17 | New/Open/Save/reload/mixed/recovery, no semantic leakage | workflow + v2 browser suites, catalogue tests |
| 18 | In-flight autosave, New/Open wait, failed flush blocks switch | four v2 browser tests keep a real IDB transaction pending until release/abort |
| 19 | Old v1/future-v3/recovery, no transient or credential persistence | strict v1/v2 tests, recovery/provider/workflow browser regressions |
| 20 | Production-preview actual IDB and protected T1A/T1B/provider/snapping regressions | `npm run test:browser:ci` |
| 21 | Install/unit/typecheck/build/diff/browser/exact-head CI | required commands and PR checks recorded in handoff |
| 22 | Fresh exact-head schema/data-loss review, no unresolved BLOCKER/REQUIRED | independent review record in PR handoff |

## Test method and limitations

The initial new regression failed on the old implementation (`schemaVersion` was
1 rather than logical 2), then passed with v2 dispatch/no-write persistence.
The full original v1 suite now imports the explicit v1 module directly.
Old future-v2 sentinels in runtime tests became future-v3; genuine v1 rejection
fixtures still reject version 2. Legacy browser fixtures remain genuine v1.
One shared-validator defect was reproduced and corrected: the empty-string key
escaped the unknown-property check because of a truthiness test. It is now rejected
in v1 and v2, as required by their existing strict contracts; no valid v1 field or
value changed. Dedicated failing-before/passing-after regressions cover it.

The test-only `__project_v2_probe.mjs` uses production schema/history/catalogue/
persistence/IndexedDB modules; it is built only by browser test commands and is
absent from normal production builds. Failure injection overrides browser IDB
methods to abort or throw quota/write errors after backup scheduling. It proves
rollback handling, not an actual storage-exhaustion event. In-flight tests keep
the actual transaction alive with pending reads; catalogue New/Open uses the same
flush callback sequence as App. Existing UI tests cover buttons and recovery.
Playwright's object transport drops a literal `__proto__` property, so assertions
read scalar values inside the page or inspect stored JSON strings directly.

Local dependencies installed via `npm ci --offline --no-audit --no-fund` using the
existing project-local cache. Local Node is 24.14.0; hosted CI independently runs
the required Node 22 baseline. Browser uses the existing project-local Chromium
cache. No global installations/settings were needed. The existing Vite large
chunk warning is retained; this tranche makes no performance improvement claim.

Residual limits: older unguarded tabs, browser eviction/OS loss, no automatic
backup recovery/retention or portable export, and T2B product authoring still
pending. Issue #29 remains open. Control-plane acceptance is required before merge.
