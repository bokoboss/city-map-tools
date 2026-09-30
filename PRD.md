# Product Requirement Document (PRD) & Technical Specification

> **Document status: target/product specification.** `PRODUCT_DIRECTION.md` is the product North Star. `README.md` describes accepted current capability. Issues and acceptance contracts govern implementation. Nothing in this document is considered implemented merely because it is specified here.

## Project: City Map Tools

**Target users:** Transportation & Traffic Engineers, Urban Planners, GIS Practitioners, Field Surveyors

## 1. Product vision

City Map Tools is a browser-based **engineering map authoring, spatial-analysis, and presentation workspace**. It combines a modern MapLibre canvas, local-first project state, CAD-like editing, engineering spatial tools, traffic/access authoring, professional cartographic presentation, and auditable integration of external engineering results.

The product is static-first/local-first and should remain usable without a mandatory paid backend.

The product does **not** attempt to replace QGIS/ArcGIS/AutoCAD, a traffic assignment model, Vissim/SUMO, or specialist analysis software. It should instead provide a reliable map-centric workspace that can author engineering diagrams and consume trustworthy results from those tools.

## 2. Product principles

1. **Truth before visual plausibility.** No synthetic/demo/pseudo value is presented or exported as a validated engineering result.
2. **Canonical geometry is explicit.** Persisted geographic geometry is WGS84 longitude/latitude; presentation pixels, label offsets, icon hotspots, and animation never silently alter it.
3. **Calculations are method-explicit.** Distance/area/network/result semantics declare method, units, source, version, quality state, and limitations.
4. **Specialist results keep provenance.** Imported traffic/simulation/OD data remain traceable to source tool/file/scenario/period/unit.
5. **Static-first/local-first.** Core workflows do not require a mandatory backend or server-held secret.
6. **Provider behavior is explicit.** Attribution, capabilities, failure states, credentials, licensing, and best-effort limits are visible.
7. **Task-oriented extensibility, not a plugin platform.** Add bounded tools and panels around stable engineering workflows.
8. **Product value governs priority.** Infrastructure is justified by a named user workflow; it is not the product itself.

## 3. Current technical foundation

Accepted direction/current stack:
- React + strict TypeScript + Vite;
- MapLibre GL JS for the map/runtime;
- Terra Draw for supported transient geometry creation/editing;
- Project Document v1 as authoritative persistent project truth;
- bounded transaction/history semantics with Undo/Redo;
- native IndexedDB committed-state autosave/recovery;
- deterministic pure tests, strict typecheck/build, and hosted Chromium smoke;
- WGS84 ellipsoidal geodesic kernel for protected distance/bearing/perimeter/area work.

Exact accepted implementation state is maintained in `PROJECT_PROFILE.md`.

## 4. Capability modules and priority

### Module A — Core Map & Project Workspace

Purpose: reliable engineering workspace foundation.

Required direction:
- MapLibre navigation, camera, and truthful basemap/style capability state;
- project metadata and Project Document persistence;
- bounded Undo/Redo and transaction semantics;
- explicit New / Open / Save-or-equivalent local project workflow (#5D);
- layer visibility and typed authored/imported/derived distinction;
- deterministic recovery/error behavior;
- GitHub Pages/static deployment without mandatory backend.

Current accepted foundation covers most runtime/project state; #5D and #6 Phase C remain.

### Module B — CAD / Geometry Authoring

Purpose: precise and predictable engineering geometry editing.

Required direction:
- Point / LineString / Polygon create/select/edit;
- derived buffers with explicit units/provenance/stale state;
- authored Point dragging with one-gesture transaction semantics;
- CAD snapping (#42): screen-space tolerance, vertex + nearest-on-segment, deterministic target eligibility/ties, bounded lookup, no routing/map-matching conflation;
- future tracing/reuse existing geometry only as a deliberate editing operation, not shortest-path routing;
- geometry smoothing may be presentation-only unless a separately accepted canonical-geometry transform is defined.

### Module C — Traffic & Site-Access Authoring

Purpose: make practical transport-planning/site-access figures directly on the map.

#### C1. Traffic Movement (#29)
- semantic role over authored LineString;
- forward/reverse direction without canonical coordinate reversal for presentation only;
- static directional symbols and optional animated arrows;
- animation rate/density are visual-only unless a validated engineering source supplies physical meaning;
- geometry edit Apply/Cancel, history, layer/style remount, reduced-motion behavior, and persistence must remain correct.

#### C2. Site Access Route (#30)
- authored branch/merge route networks;
- shared trunk represented once rather than duplicated near-coincident LineStrings;
- explicit branch/join topology operations;
- inbound/outbound route communication;
- no automatic shortest-path or assignment claim.

#### C3. Semantic Traffic Annotations (#34)
- compact typed catalog for entrance/exit, closure/barrier, parking/drop-off/loading, crossing, work zone, etc.;
- locally controlled assets/hotspots/provenance;
- author intent, not automatic legal/operational truth.

#### C4. Scenario / Construction Stage (#31)
- Existing / Proposed / Option / Construction Stage states;
- deterministic scenario membership/variants without deep-cloning whole projects on every switch;
- no traffic assignment computation implied by scenario switching.

### Module D — Engineering Spatial Tools

Purpose: trustworthy lightweight engineering/GIS calculations.

#### D1. Live Measurement (#14)
- geodesic segment/cumulative line length;
- true/geodesic initial bearing where specified;
- polygon perimeter/area;
- SI units first, derived Thai area units where useful;
- transient live measurement does not create project data unless explicitly saved.

#### D2. Desire Line / OD (#11)
- typed OD records with origin/destination IDs, demand, units, period/scenario/mode/direction, and provenance;
- user-defined transport/activity centroid supported where modelling workflows need it;
- no synthetic demand generation;
- visualization scaling is display transformation only; raw OD values remain unchanged and inspectable.

#### D3. Pedestrian Walking Walkshed (#9)
- pedestrian-only current routing/accessibility scope;
- OSM/Overpass walking-network ingestion with explicit access/topology filtering;
- deterministic graph + Dijkstra/equivalent validated shortest-path distance;
- reachable network first; filled polygon only with separately validated contour methodology;
- walking time only from explicit assumed speed, never observed-time implication;
- provider/no-data failure never fabricates result.

### Module E — Professional Cartographic Presentation

Purpose: produce client/report-ready engineering figures without requiring extensive cleanup in PowerPoint/Illustrator.

#### E1. Presentation System (#32)
- labels and manual placement;
- callouts/leader lines;
- line casing/halo, opacity, style presets;
- presentation-only route smoothing where accepted;
- Saved Views / Figure Bookmarks;
- batch style operations where history semantics support them;
- presentation state never changes canonical geometry or engineering values.

#### E2. Site Plan / Master Plan Overlay (#33)
- local raster image import;
- explicit four-corner/manual placement first;
- opacity, visibility, lock;
- style remount and local persistence lifecycle;
- manual alignment labelled truthfully, not survey-grade georeferencing;
- no external upload by default.

### Module F — Engineering Data & Result Integration

Purpose: work with specialist-tool outputs rather than reimplementing their methods.

#### F1. Traffic-Engineering Result Visualization (#16)
Status: **planned core integration direction**.

Candidate inputs may include CUBE/eBUM, Vissim/SUMO, HCM/capacity tools, spreadsheets, CSV/GeoJSON, or study outputs.

Requirements before each adapter:
- one concrete source schema/use case;
- explicit units/grain/scenario/period/direction;
- spatial matching contract;
- provenance and validation status;
- deterministic fixture.

City Map Tools must not infer LOS, flow, speed, delay, v/c, queue, or other values not present or calculated by an accepted method.

#### F2. Field Evidence (#15)
- local notes/tags/photos linked by stable attachment IDs;
- no automatic cloud upload;
- explicit EXIF/privacy/export behavior;
- quota/storage failure must not corrupt project truth.

### Module G — Interoperability & Reporting (#13)

Purpose: portable data and reproducible professional outputs.

Priority direction:
- GeoJSON strengthened round-trip;
- CSV with explicit field mapping;
- KML/GPX where semantics map cleanly;
- Shapefile/GeoPackage only after browser/library/CRS feasibility review;
- DXF only with explicit CRS/layer/block conventions; never emit WGS84 degrees as CAD metres silently;
- A4/A3, orientation, DPI, title/subtitle, legend, scale bar, north arrow, provider attribution, CRS/method statement;
- analytical status/warnings/provenance survive export.

### Module H — Advanced 3D / Simulation Visualization

#### H1. Simulation Trajectory Replay (#22)
Status: **planned major capability**.

First target: Vissim vehicle-record (`*.fzp`) replay.

Direction:
- client-side parser/worker;
- normalized per-vehicle trajectory store;
- play/pause/scrub/speed controls;
- 3D/simple vehicle rendering and trails;
- direct WGS84 replay where available;
- explicit georeferencing transform when local coordinates are used;
- source timestamps/units/version/provenance preserved;
- visualization interpolation is not additional simulation output.

This module follows the core authoring/presentation/reporting workspace because of its larger data/render/georeferencing surface.

## 5. Provider / basemap contract (#43)

- Current accepted basemaps/providers must have typed capability metadata, attribution, usage/policy notes, and truthful failure state.
- 3D buildings/terrain controls are enabled only when the loaded style/source actually supports them.
- Browser BYOK may be used only for providers that support direct browser credentials; keys are runtime-memory-only by default and never enter IndexedDB/project/export/log/Git.
- No undocumented Google tile endpoint or mandatory secret-bearing backend.
- Public OSM services are best-effort and replaceable, not SLA-backed core infrastructure.

## 6. Removed / deferred items

### Elevation / DEM (#8)
**Not planned.** Closed. Do not reintroduce merely because it appeared in the original PRD.

### Space Syntax (#10)
**Deferred research only.** No production engine until methodology, preprocessing, radius/cost/normalization, canonical reference outputs, licensing, and performance receive a future explicit GO / GO WITH CONDITIONS.

### Motor-vehicle routing / traffic-aware isochrone
Not current product scope. Snapping, tracing, map matching, routing, accessibility, and authored route diagrams remain distinct operations.

## 7. Product roadmap

The roadmap is dependency-aware but product-value led.

### R0/R1 — Truthful modular foundation
Accepted substantially complete:
- workflow/project baseline;
- truth/security quarantine;
- modular React/TypeScript/MapLibre migration;
- project document/history/autosave foundation;
- CI browser smoke;
- legacy retirement.

### R2 — Spatial/editor foundation
Current:
1. #41 WGS84 geodesic kernel — accepted;
2. #42 indexed CAD snapping — active until its acceptance gates pass;
3. #43 provider/basemap capability contracts;
4. close remaining #7 acceptance gaps explicitly rather than assuming #41–#43 cover them.

### R2.5 — Complete project workflow
- #5D New/Open/Save-or-equivalent local workflow and recovery UX.

### R3 — Core Engineering Authoring
Priority set:
- #29 Traffic Movement;
- #30 Site Access Route;
- #32 Cartographic Presentation;
- #33 Site Plan Overlay;
- introduce #31/#34 when concrete workflow/dependencies justify them.

### R4 — Engineering Tools
- #14 live measurement;
- #11 Desire Line / OD.

### R5 — Professional Workspace
- #12 task-oriented desktop/tablet/mobile workspace around actual implemented workflows.

### R6 — Interoperability / Domain Integration
- #13 engineering-grade import/export/cartographic package;
- #15 local-first field evidence;
- #16 traffic-engineering result visualization;
- #9 pedestrian walking-network accessibility when its method/provider work is justified.

### R7 — Advanced Visualization
- #22 Vissim/simulation trajectory replay.

### Release infrastructure
- #6 Phase C GitHub Pages deployment after required quality gates and repository configuration are ready. Deployment is necessary for release readiness but should not silently become the product roadmap.

## 8. Anti-drift product gate

Before adding or materially reprioritizing implementation work, answer:
- Which `PRODUCT_DIRECTION.md` pillar and user workflow does this enable?
- Is it a real user need or primarily technical curiosity?
- Is it a true dependency for higher-value work?
- Can it be implemented truthfully and validated proportionately?
- What ready core capability is delayed if this enters the critical path?

Record material priority changes in Issue #1.

## 9. Product acceptance

City Map Tools may be considered engineering-ready only when:
- no known pseudo/synthetic analysis is exposed as real engineering output;
- accepted calculations have proportional reference validation;
- core project save/recovery/history behavior is reliable;
- core authoring/presentation workflows are usable and browser-tested;
- engineering result imports retain source semantics/provenance;
- map/provider attribution and failure state are explicit;
- report/export outputs preserve units, method/status, warnings, and attribution;
- deployment builds and serves the accepted artifact successfully;
- `PRODUCT_DIRECTION.md`, this PRD, Issue #1, `PROJECT_PROFILE.md`, and `README.md` agree on product priority vs current truth.
