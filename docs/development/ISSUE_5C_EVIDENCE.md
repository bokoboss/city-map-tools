# Issue #5C — IndexedDB persistence evidence

## Contract and scope

- Work mode: **STRICT**. Architecture scrutiny: **GO WITH CONDITIONS** under
  [Issue #5 comment 5854261326](https://github.com/bokoboss/city-map-tools/issues/5#issuecomment-5854261326).
- Accepted baseline: `4dcf0be42da30bb14a26e7ca54b92b9ff7a92b5c`.
  Local `main` and `origin/main` were verified at this commit before the branch.
  The worktree was clean. `.engineering-workflow.json` names v1.7.4, and every
  managed-file SHA-256 matched after normalizing checkout CRLF to source LF.
- Branch: `codex/r1b-indexeddb-persistence`.
- Scope: native IndexedDB adapter; committed Project Document v1 autosave and
  restore; save-state indicator; deterministic unit/browser evidence.
- The v1 schema, dependency manifests, marker dragging, project workflow,
  provider preferences, and browser CI configuration are unchanged.
  [Issue #6 Phase B2](https://github.com/bokoboss/city-map-tools/issues/6#issuecomment-5854262566)
  remains separate.

## Pre-push lifecycle and self-review audit

The complete path was reviewed as one sequence:
`bootstrap → valid/no/invalid record → committed project command → 500 ms debounce →
in-flight save → newer edit → transaction completion/failure → reload`.

| Risk | Audit result |
| --- | --- |
| Startup overwrite | Editable `MapCanvas` is not mounted until `bootstrap()` resolves. A valid record is parsed before replacing the fallback; an invalid/read-failed record pauses autosave. A no-record fallback is queued only after the read completes. Unit delayed-load and browser clear/reload cases exercise this. |
| Stale save completion | The coordinator permits one in-flight adapter write. A newer edit immediately becomes Unsaved; it waits for its own 500 ms debounce and the older write's completion. Only an exact current serialized document may become Saved. Deferred-write unit test proves order and status. |
| Save status | Saved follows a completed IndexedDB transaction or a completed read of an existing valid record. Unsaved is immediate for committed edits; Saving denotes a write in flight; failures report Error. The adapter never resolves on put-request success alone. |
| Persisted scope | `App` passes `next.present` to persistence only when the committed document reference changes. The coordinator serializes through `serializeProjectDocument`; no history, transaction draft, selection, tool, editor/map state, rename/buffer input, provider setting, or credential enters the adapter. No-op/transient actions do not call `commit`. |
| Invalid/future/corrupt record | Strict bounded `parseProjectDocumentJson()` gates restore. The adapter checks key existence separately from value because IndexedDB returns `undefined` for both missing and stored-undefined values. Failed parse, non-text record, and read/open errors retain a fresh in-memory session, show Error, pause autosave, and never delete or overwrite the record. Browser fixture injects malformed, future v2, object, and undefined records, edits the memory session, and rereads the unchanged record. |
| Timestamp ownership | Persistence does not alter `createdAt` or `updatedAt`; it serializes the command/history result. Reload uses `createProjectHistory(restored)` without changing metadata. |
| Quota/abort/write failure | Adapter waits for transaction completion and classifies quota using request or transaction errors. A failure preserves the current in-memory document and reports Error. Pending automatic retry is cancelled; a later committed edit may retry. Unit tests cover quota/error/retry. |
| Reload/history reset | Valid restore creates a fresh history root with empty past/future and no transaction. Browser fixture checks exact feature name, layer visibility, PointPresentation, disabled Undo/Redo, and default selection/tool. |
| Canonical payload | The adapter receives only v1 JSON from `serializeProjectDocument`; database/store/key are `city-map-tools` v1 / `project-state` / `last-accepted-project`. Unit and browser fixtures inspect the text and exclusion of history/transient keys. |

The native connection closes after each read/write and on `versionchange`. An
open blocked by another tab reports an actionable Error. Stored contents are not
included in error messages or logs. This audit found no BLOCKER or REQUIRED
mismatch within the frozen #5C contract before push.

## Local gates

Environment: Windows, Node 24.14.0 / npm 11.14.1. Existing `node_modules`
and the unchanged lockfile were used; `npm ci` was not rerun. The accepted #5B
evidence records the clean deterministic install, and exact-head Node 22 CI will
run `npm ci` for this PR.

| Gate | Result |
| --- | --- |
| `npm test` | PASS. New fake-adapter/scheduler cases cover delayed bootstrap, valid/no/invalid/future read, coalescing, in-flight save ordering, status, quota/error/retry, canonical payload, history/transient exclusion, and no-op. Existing suites pass. |
| `npm run typecheck` | PASS, strict `tsc --noEmit`. |
| `npm run build` | PASS, 174 modules. Existing non-blocking large-chunk advisory remains. |
| `git diff --check` | PASS on the final staged diff after the non-text record correction. |
| `tests/project-persistence-browser.js` | PASS on production preview after the non-text record correction, with no page errors or console warnings/errors. Verifies fresh database, committed Point/layer/presentation, exact reload, history/transient reset, malformed/future/object/undefined recovery preservation, and memory-only edit on Error. |
| `tests/project-history-browser.js` | PASS after test database reset; no page errors or console warnings/errors. |
| `tests/import-lifecycle-browser.js` | PASS after test database reset; no page errors or console warnings/errors. |
| `tests/geometry-browser.js` | PASS after test database reset; no page errors or console warnings/errors. |
| `tests/map-lifecycle-browser.js` | PASS after test database reset with loopback tile server; no page errors or unexpected console warnings/errors. |

Production preview: `http://127.0.0.1:4173/city-map-tools/`. The browser used
the previously cached `@playwright/cli` runtime; no browser package or CI matrix
was added to this repository. The map lifecycle fixture intentionally injects a
provider failure and verifies recovery. Other unaffected #19/#20/#5A fixture
results remain in the accepted #5B evidence and were not rerun mechanically.

## Remote gates and limits

At this pre-push checkpoint, PR, exact-head CI, targeted Code Review, and
Security Review remain pending. Do not merge before those results are inspected
and any BLOCKER/REQUIRED findings are resolved. #5D owns New/Open/Save and an
explicit recovery/reset workflow. Browser storage is origin-local and can be
evicted by the browser; a failed save remains in memory only until a later
committed edit retries.

External writes before push: none. Global/system changes: none. Destructive
repository commands: none. Browser fixture changes were limited to the local
app-origin test IndexedDB record.
