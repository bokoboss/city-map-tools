# Project Document v2 — Issue #29 T2A

Contract: [frozen architecture/migration decision](https://github.com/bokoboss/city-map-tools/issues/29#issuecomment-6247947126).
The existing format, metadata/timestamps, EPSG:4326 longitude-latitude degrees,
layers, feature geometry/lineage/provenance, derived-buffer validation and
`presentation.points` retain their strict [v1 rules](project-document-v1.md).

V2 changes `schemaVersion` to `2` and requires exactly one additional root:
`trafficMovements: Record<featureId, { direction, style }>`. Its own-key membership
is the semantic role. Only a currently present authored LineString may be referenced;
there are no aliases, orphan entries or feature-level role flag. At most 24 entries
are allowed. Generic and imported lines remain ordinary lines.

`direction` is `forward` or `reverse`, relative to canonical first-to-last traversal.
Neither direction nor display settings change canonical coordinates. Style has
exactly these required fields:

| Field | Accepted values | Conversion default |
|---|---|---|
| color | six-digit hex | `#2563eb` |
| opacity | finite 0–1 | 1 |
| lineWidthPixels | finite 1–16 CSS px | 3 |
| arrowSizePixels | finite 8–48 CSS px | 24 |
| arrowSpacingPixels | finite 24–256 CSS px | 80 |
| animationEnabled | boolean | true |
| animationRate | slow / medium / fast | medium |
| autoLayout | boolean | true |
| displayOffsetPixels | finite −64–64 CSS px | 0 |
| layoutOrder | integer −24–24; stable ID tie-break in T1B | 0 |

Conversion starts with `forward`. The pure `trafficMovementInputs` adapter maps
visual rates to 20/40/80 CSS px per second and filters feature/layer visibility.
It is not connected to React, map objects or the production renderer lifecycle.
No speed, volume, lane centerline, headway, routing or simulation claim is made.

## Strict compatibility

`projectDocumentV1.ts` retains the explicit strict v1 decoder, parser, serializer
and 2,000,000-character bound. Its common geometry/provenance validation is reused
by v2 with a separate 2,500,000-character bound; both input text and normalized
serialization are bounded. Arrays remain dense. Nothing is truncated/defaulted
at the read boundary. Required movement/style fields cannot be omitted. Unknown
fields, invalid versions and unsupported/future versions are rejected.

The version-dispatch reader validates v1 independently and returns a detached v2
document with an empty movement map. All other fields and timestamps are retained.
Prototype-sensitive legal feature IDs use own-key/Map/null-prototype lookups.
New projects are v2. History has only v2 snapshots and never downgrades storage.

## Lazy migration and optimistic saves

The database remains `city-map-tools`, version 1, one `project-state` store, no
indexes. Catalogue Open/list/read do not rewrite project records. A v1 logical
upgrade is already Saved: persistence tracks normalized logical content separately
from the exact last-persisted raw text. Save now and no-edit Open/New flushes do
not trigger an upgrade. Pointer changes retain the accepted #5D behavior.

Each save validates the candidate and, in one readwrite transaction, compares
`project:<id>` to the session's exact expected raw value (or checks absence for a
new record). A mismatch aborts as `conflict`. For the first v1 edit, the same
transaction also checks absence of `migration-backup:v1:<id>`, adds the unchanged
raw v1 backup and puts serialized v2. Any existing backup, including malformed or
undefined-valued records, fails closed. This transaction never writes the active
pointer or legacy recovery key. Subsequent saves compare the last successfully
committed v2 raw value. Expectations advance only after transaction completion.

Saved is reported only after `transaction.oncomplete`, never request success.
Abort/quota/write/conflict failures retain in-memory edits with visible Error;
no automatic tight retry, partial backup, pointer switch or overwrite is accepted.
Existing per-project serial drain/flushNow ordering is retained. New/Open await
the complete drain before switching and fail without switching on failed flush.

The legacy `last-accepted-project` migration still copies exact validated text to
`project:<id>`, sets the pointer and deletes the legacy key in one atomic #5D
transaction. Only a later real edit triggers the separate v1 backup/v2 save.
Backup keys are outside the `project:` namespace and never appear as projects.
There is no automatic backup deletion, restore or retention workflow; those need
separate approval. Invalid active/future records remain preserved for recovery.

This guard detects stale writers; it does not merge tabs or provide locking.
Older already-open application versions can still write without the guard. Close
old tabs and reload before editing after upgrading. Transaction completion is not
a promise of immunity to OS/storage loss or browser eviction. Browser-local Save
is not portable backup/export; #13 retains that separate scope.

## Commands and exclusions

Convert rejects duplicates, ineligible features and the 25th annotation atomically.
Unconvert on an existing ordinary feature is an explicit idempotent no-op; missing
features are errors. Direction and style commands require an existing annotation.
Patches reject unknown/invalid fields before construction. Equal patches create
no history step. Accepted edits each create one step in the existing bounded
history. Delete also removes the annotation; Undo restores geometry and exact
style/direction. Geometry Apply retains the annotation and existing buffer
staleness/snapshot rules. Cancel leaves committed state untouched.

No animation phase, generated display paths/tracks/offsets, arrow positions,
camera, selection, hover, draft, global pause, credentials or history stacks are
serialized. T2B owns UI/inspector/renderer lifecycle integration. No analytical
feature, routing, new dependency/backend or IndexedDB schema is introduced.
