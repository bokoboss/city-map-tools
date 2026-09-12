# Development and Architecture Log: City Map Tools

> This log records prototype history and accepted process decisions. It is not a substitute for the current capability contract in README.md.

## Project record

- Repository: <https://github.com/bokoboss/city-map-tools>
- Live deployment target: <https://bokoboss.github.io/city-map-tools/>
- Package label: 2.2.0 (not a production-readiness claim)
- Current implementation: single-file HTML/CSS/JavaScript prototype with a Vite build shell
- Target architecture: Vite + React + TypeScript, pure domain modules, local-first persistence, and bounded provider adapters. This target remains future work.

## Initial prototype history

The initial prototype commit introduced a visually complete MapLibre annotation shell with ambitious labels for network centrality, accessibility, elevation, OD flow, 3D buildings, and external providers. Those paths were not independently validated engineering methods. The initial implementation also contained synthetic values, direct undocumented tile endpoints, unsafe external-string HTML interpolation, a missing modal reference, and a silent 3D layer failure.

Historical feature names are retained here only to explain why the R0B truth pass was required. They are not current product claims.

## R0A workflow baseline

Issue #2 established the project-local Engineering Development Workflow v1.7.4, project safety rules, and a durable handoff record. The accepted post-#2 baseline is:

- Branch: main
- Commit: b030483a14f640cdc0322697241950cd54122e02
- Pull request: #24

## R0B truth, security, and quarantine remediation

Issue #3 is the current remediation boundary. The prototype now:

- fails closed by removing synthetic network centrality, radial fallback, travel-time catchment, fabricated elevation, and all-pairs OD generation;
- keeps user-authored desire lines visibly unvalidated and records provenance/status in GeoJSON export;
- removes direct Google tile URLs and the public demo style endpoint, adds provider attribution, and surfaces provider errors;
- disables 3D Buildings unless a compatible vector building source is available;
- renders imported GeoJSON names, remote search strings, layer names, and feature names through safe text/DOM APIs;
- records marker drag history at dragstart so undo restores the exact pre-drag state;
- removes unimplemented shortcut claims and dead modal handlers;
- quarantines the former OSRM driving route preview because no pedestrian routing method is validated; no route fallback or motor-vehicle route is generated.

No architecture migration, real DEM implementation, walking-network implementation, Space Syntax implementation, persistence work, or Issue #6 Phase A work is included in this change.

## Provenance and licensing record

A bounded scan of the current repository found no vendored third-party source, data, binary assets, LICENSE, or NOTICE file. Git history begins with the single-file prototype commit, so complete source lineage cannot be established from the local tree alone.

- raynbowy23/Axon-City is recorded as conceptual inspiration only; no copied or adapted Axon-City source, data, or asset was identified in the bounded scan.
- Space Syntax OpenMapping is recorded as methodology/prior-art research only; no OpenMapping dataset, code, or content is used by the current prototype.
- The repository license remains intentionally unselected until a complete provenance review resolves the remaining lineage uncertainty.
