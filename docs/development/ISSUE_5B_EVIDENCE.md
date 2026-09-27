# Issue #5B execution and acceptance evidence

Scope: Project Document v1-backed runtime ownership and bounded in-memory history.

## Contract and starting state

- Authoritative contract: [Issue #5 comment 5853575614](https://github.com/bokoboss/city-map-tools/issues/5#issuecomment-5853575614).
- Work mode: STRICT. Scrutiny outcome: GO WITH CONDITIONS; timestamp injection,
  strict v1 candidate validation, a 20-snapshot history bound, transient-state
  separation, production browser evidence, and independent review are mandatory.
- Accepted base: `bf3129730d78843142d4f96cd9aef369bff562e8`.
- Implementation branch: `codex/r1b-project-state-history`, created from that exact
  base. The worktree was clean before edits; `origin/main`, `HEAD`, and the merge base
  all matched the accepted SHA at implementation start.
- `.engineering-workflow.json` pins v1.7.4. The project-local managed snapshot was
  present and matched the pin across all 29 managed files after line-ending
  normalization. No workflow upgrade was made.
- Writable boundary: `C:\MyRD\city-map-tools`. No merge is authorized.

## Implementation and representability self-review

`src/project/projectHistory.ts` owns pure commands and history over complete
`ProjectDocumentV1` values. Each command candidate is passed through
`createProjectDocument` before it can become the current document or a transaction
draft. Loaded documents are decoded before entering history. Undo and redo restore a
validated project snapshot and stamp the resulting revision time; `createdAt` stays
unchanged. Pure command/history code uses no clock, random ID source, browser object,
MapLibre object, or Terra Draw object.

| Command surface | v1 representation and audit result |
| --- | --- |
| Create Point | Authored Point feature, stable generated ID, accepted Point layer and provenance; complete candidate is validated before commit. |
| Create LineString / Polygon | Authored geometry in the matching v1 feature and built-in layer shape; geometry and document bounds are checked before commit. |
| Apply LineString / Polygon geometry | Replaces only authored geometry of the matching type; dependent buffers receive the existing stale transition; the resulting full document is validated. |
| Create derived buffer | Uses the existing bounded Turf derivation with source snapshot, method, units, radius, version, steps, status and limitations; strict v1 checks the complete result. |
| Import accepted Points | Parser remains outside history; accepted Point features are inserted as one validated command after checking the captured project revision. |
| Delete feature | Feature and its PointPresentation are removed atomically; dependent buffers preserve stale/orphan provenance; Undo restores all of them. |
| Rename / feature visibility / layer visibility | Writes only the corresponding existing v1 fields; schema limits and references remain enforced. |
| PointPresentation | Writes only `presentation.points`; v1 enum/reference checks remain in force and null-prototype maps protect special IDs. |
| Point coordinate move seam | Pure `movePoint` command writes canonical WGS84 coordinates and preserves dependent-buffer stale behavior; transaction test proves several updates produce one undo step. No map drag UI was added. |
| Project metadata rename | Not introduced because there is no project-name editing UI in this integration. |

The project schema file is unchanged. Candidate rejection remains atomic for feature
count and normalized serialized-size overflow; each current, past, future, and
transaction-draft document is v1-valid and within its 2,000,000-character bound.
Past plus future are capped at 20 snapshots. No inverse-command/event-sourcing layer
was added.

The following remain transient and are absent from serialized documents and history:
selection, editor mode, Terra Draw drafts/edit state, hover/focus/modal/delete
confirmation, feature-name draft, import/editor status, map loading/error/camera/
basemap state, map-session count, buffer input text, and credentials. Runtime ownership
for features, layers, and PointPresentation now comes from the current v1 document.
History and project state remain in memory and are lost on reload. IndexedDB, autosave,
recovery, actual marker dragging, and #29–#34 product features remain out of scope.

## Local unit, runtime, and browser gates

Environment: Windows, Node 24.14.0 / npm 11.14.1; repository CI remains the exact-head
Node 22 gate. `npm ci` completed with 112 packages and 0 reported vulnerabilities;
the project-local npm cache is ignored. No dependency or lockfile changed.

| Gate | Result |
| --- | --- |
| `npm test` | PASS. Existing #5A/#19/#20 regressions and the new project-history suite passed, including command undo/redo, stale/orphan buffers, atomic delete/presentation restore, no-op timestamps, 20-snapshot trimming, transactions, move seam, transient exclusion, and feature-count/aggregate-size rejection. |
| `npm run typecheck` | PASS (`tsc --noEmit`). |
| `npm run build` | PASS; 172 modules. Vite retained the existing non-blocking warning for the 1.79 MB application chunk. |
| `git diff --check` | PASS on the final staged diff, including this evidence file, before commit. |

Production preview: `http://127.0.0.1:4173/city-map-tools/`.

| Browser fixture | Result and covered behavior |
| --- | --- |
| `tests/project-history-browser.js` | PASS; no page errors or console warnings/errors. Point creation, commit-on-Enter rename, rename undo/redo, PointPresentation undo/redo, layer/feature visibility undo/redo, buffer undo/redo and read-only state, drawing history lock/draft retention, LineString and Polygon creation. |
| `tests/geometry-browser.js` | PASS; no page errors or console warnings/errors. Geometry Apply undo/redo, edit history lock, buffer stale semantics, OSM/CARTO style replacement, cancellation, selection, and derived read-only behavior. |
| `tests/import-lifecycle-browser.js` | PASS; no page errors or console warnings/errors. Existing interaction guards and delayed import rejection after the authoritative project revision changes. |
| `tests/geojson-browser.js` | PASS; no page errors. Import trust, round-trip, XSS inertness, transactional rejection, and 500 accepted / 501 rejected. |
| `tests/marker-hotspot-browser.js` | PASS; no page errors or console warnings/errors. Point presentation preserves canonical geometry and hotspot through style replacement. |
| `tests/map-lifecycle-browser.js` | PASS; no page errors or unexpected console warnings/errors. Provider failure was intentionally injected and the UI recovered through CARTO. |
| `tests/terradraw-compat-browser.js` | PASS; no page errors or console warnings/errors. MapLibre 6/Terra Draw create, edit, finish, cancel, clear, and teardown. |

The existing GeoJSON browser assertion was updated to commit rename on Enter. The
geometry browser assertion was updated to expect the existing no-op Apply status. Both
fixtures passed after those expectation updates.

## Pre-push audit and remaining remote gates

Pre-push self-review: PASS. The final source diff was reviewed for scope, schema
immutability, strict v1 representability, failure atomicity, transient-state exclusion,
timestamp ownership, and regression coverage. `package.json`, `package-lock.json`, and
`src/project/projectDocument.ts` are unchanged. The exact PR-head Actions result and
targeted independent Code Review are recorded after the PR is open; neither is claimed
by local evidence. Do not merge.

External writes before push: none. Global/system changes: none.
