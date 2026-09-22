# Project Document v1

Issue #5A freezes a small native project contract. It is a pure domain boundary;
it does not provide browser persistence, autosave, project workflow UI, runtime
state migration, or history.

## Shape

```text
{
  format: "city-map-tools-project",
  schemaVersion: 1,
  metadata: {
    id: string,
    name: string,
    createdAt: canonical UTC ISO timestamp,
    updatedAt: canonical UTC ISO timestamp
  },
  spatialReference: {
    crs: "EPSG:4326",
    axisOrder: "longitude-latitude",
    units: "degrees"
  },
  layers: FeatureLayer[],
  features: SpatialFeature[],
  presentation: {
    points: { [featureId: string]: PointPresentation }
  }
}
```

`FeatureLayer` is the current `{ id, name, visible, color }` shape. Current
`SpatialFeature` records preserve Point, LineString, and single-exterior-ring
Polygon geometry, authored/imported/derived lineage, visibility, names,
optional descriptions, validation status, and the complete current provenance
shape. Point presentation preserves only the accepted dot/pin, 18/24/32 px,
label visibility, and eight-position choices.

Derived buffers remain Polygon features on `layer-buffers` with:

- `provenance.buffer`: `@turf/buffer@7.4.0`, radius in metres, and 8 steps;
- `provenance.derivedFrom`: source ID, name, geometry type, exact WGS84 source
  snapshot, source validation status, and source provenance;
- `Functional but unvalidated`, `Experimental`, or `Stale` active status;
- an optional `orphaned: true` flag when the source was deleted.

Stale buffers retain their derivation-time snapshot. An orphaned source ID must
not resolve to a current feature; the loader rejects a live replacement that
would silently reconnect historical provenance, and every orphaned derived
buffer must be `Stale`. A non-orphaned derived source must resolve to a live
non-derived feature of the recorded type. If that derived buffer is not
`Stale`, its live source geometry must exactly equal the recorded derivation
snapshot using canonical coordinate equality; `Stale` is the explicit state
that permits a preserved historical mismatch.

## Strict load and serialization rules

`decodeProjectDocument(unknown)` validates and returns a detached v1 document.
`parseProjectDocumentJson(text)` rejects malformed JSON or text above the
2,000,000-character bound before parsing. The normalized serialized JSON of a
schema-valid document must also be at or below that same bound during decode,
create, and serialization, so a document produced by the serializer is always
reopenable. No truncation is performed. `serializeProjectDocument(document)`
revalidates before deterministic JSON serialization. No malformed field is
trimmed, defaulted, truncated, or silently coerced, and unsupported properties
are rejected at every v1 object boundary. Every native v1 array must be dense;
missing indices are rejected explicitly before normalization, so serialization
cannot turn an accepted array hole into a non-reopenable `null`.

The loader rejects missing/wrong format, missing/non-integer/unsupported or
future schema versions, non-canonical timestamps, reversed metadata times,
wrong CRS/axis/units, duplicate or missing layer/feature references, invalid
geometry or vertex bounds, malformed provenance/buffer snapshots, invalid
presentation references/enums, and duplicate live IDs. IDs are bounded but may
literally be `__proto__`, `constructor`, or `prototype`; `Set`, `Map`, own-key
checks, and null-prototype presentation maps prevent inherited lookup or
prototype pollution.

Schema v1 rejects an active feature `validationStatus: "Validated"`. The
current product has no accepted validation-authority workflow that can create
that claim. A historical `derivedFrom.validationStatus: "Validated"` value may
be retained as provenance evidence, but it never promotes the active derived
result or source record.

The native document has no fields for selected feature, active tool/mode,
Terra Draw drafts, hover/focus/modal state, import status, map loading/error
state, camera state, remount counters, buffer-input UI state, 3D runtime state,
provider preferences, API keys, tokens, or credentials.

## Future-product pressure test

The v1 document is intentionally current and small. Future schema versions can
add typed top-level sections and migrations without changing the meaning of
the v1 geometry list:

| Future issue | v1 seam | Not implemented in #5A |
|---|---|---|
| #29 / #34 traffic semantics | add typed semantic-role records keyed by stable feature IDs; geometry remains generic | traffic annotations, renderer, analytics |
| #32 cartography | add project-level style/presentation resources keyed by stable IDs; keep geometry unchanged | presets, labels, callouts, Saved Views |
| #31 scenarios | add scenario/stage IDs, membership, and bounded variants that reference stable records | scenario manager or deep-cloned projects |
| #30 route topology | add typed composite/topological records with node/segment/path references | route-network editor or graph engine |
| #15 / #33 attachments | add attachment/blob IDs behind a storage adapter | site-plan UI, image blobs, field-photo storage |

No generic plugin/entity/analysis registry is needed. Current Turf buffer
provenance remains the only v1 derived-result shape. Future additions require a
new schema version and explicit migration/validation rules.
