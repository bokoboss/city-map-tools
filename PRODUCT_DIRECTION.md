# Product Direction

Status: **authoritative product North Star** for City Map Tools.

This document answers **why the product exists, who it is for, and which capabilities are product priorities**. It is intentionally more stable than implementation Issues and less detailed than `PRD.md`.

## 1. Product identity

City Map Tools is a browser-based **engineering map authoring, spatial-analysis, and presentation workspace** for transportation/traffic engineers, urban planners, GIS practitioners, and field/site-study workflows.

Its primary value is not to reproduce a full desktop GIS or every specialist traffic-analysis package. Its value is to let a user create, inspect, analyze, combine, and present engineering map information quickly and truthfully in one local-first workspace.

The product should be especially strong at workflows such as:

- project/site access and circulation diagrams;
- traffic-management and construction-stage figures;
- authored directional movements and access routes;
- spatial measurements, buffers, zones, and OD/desire-line visualization;
- overlaying site/master plans with geographic context;
- professional labels, callouts, styling, saved views, legends, and report figures;
- importing validated engineering results from specialist tools and visualizing them without inventing missing methodology;
- later, replaying simulation trajectories as an advanced visualization capability.

## 2. Product pillars

### A. Engineering Map Authoring
The map is an engineering drawing/annotation canvas, not just a viewer.

Core direction:
- reliable Point / LineString / Polygon authoring and editing;
- CAD-style snapping and deterministic geometry editing;
- Traffic Movement annotations (#29);
- Site Access Route branch/merge networks (#30);
- semantic traffic/access annotations (#34) when the compact catalog is justified;
- scenario/stage support (#31) after the underlying authoring and project workflow are stable.

### B. Spatial and Engineering Tools
Calculations must be explicit, testable, and proportionate to their claim.

Core direction:
- geodesic distance, bearing, perimeter, and area (#14);
- buffers and other bounded geometry operations;
- user-defined transport/activity centroids where modelling workflows need them;
- auditable OD / Desire Line visualization from user/imported demand (#11);
- pedestrian walking-network accessibility only when its network/method contract is validated (#9).

### C. Professional Cartographic Presentation
A major product goal is to reduce the need to finish engineering figures manually in PowerPoint/Illustrator.

Core direction:
- labels, callouts, line casing, presentation styles, presets, and Saved Views (#32);
- local Site Plan / Master Plan overlay (#33);
- report-ready map composition, legends, scale, north arrow, attribution, title blocks, and high-DPI export (#13);
- presentation state must never silently alter canonical WGS84 geometry or engineering values.

### D. Data and Engineering-Result Integration
City Map Tools should cooperate with specialist tools rather than reimplementing all of them.

Core direction:
- GIS/CAD interoperability and explicit import mapping (#13);
- traffic-engineering result visualization (#16) as a **planned core integration direction**, with source units/method/scenario/provenance preserved;
- field notes/photos/evidence (#15) where they support study workflows;
- no inferred LOS, traffic volume, speed, delay, demand, or other engineering value unless an accepted method/source provides it.

### E. Advanced Visualization
Advanced features are allowed when they reuse the map/project foundation and have a concrete engineering workflow.

Planned major capability:
- Vissim/simulation trajectory 3D replay (#22).

This is intentionally later than the core authoring/presentation workflow because it has a larger parser, rendering, data-volume, and georeferencing surface. It is **planned**, not a disposable nice-to-have.

## 3. Product priority classes

### Core product
These define what City Map Tools is intended to become:
- project/local-first workflow and reliable geometry editing;
- CAD snapping and engineering measurement;
- #29 Traffic Movement;
- #30 Site Access Route;
- #32 cartographic presentation / labels / callouts / Saved Views;
- #33 Site Plan overlay;
- #11 Desire Line / OD;
- professional interoperability/reporting under #13.

### Planned core integration
Important domain value after the core authoring workspace is mature:
- #16 traffic-engineering result visualization;
- #15 field evidence where useful;
- #9 validated pedestrian walkshed.

### Planned major capability
- #22 Vissim/simulation trajectory replay.

### Deferred research / removed from current plan
- #10 Space Syntax / angular segment analysis: research-only until a future explicit GO / GO WITH CONDITIONS.
- #8 DEM/elevation profile: closed as `not planned`; do not reintroduce merely because it existed in the original PRD.
- motor-vehicle routing, traffic-aware routing, and vehicle isochrones: not current product scope.

## 4. Roadmap guardrail

The implementation sequence may change for dependencies, but product priority must not silently drift because infrastructure work is easier to schedule.

Current high-level direction after the accepted R1B and R2 foundation:

`#29/#30/#32/#33 -> #14/#11 -> #12 -> #13/#15/#16 -> #9 when justified -> #22`

Notes:
- #31 and #34 should enter when their dependencies and concrete study workflow justify them; they must not block the first useful authoring/presentation set.
- #6 Phase C (Pages deployment) should be completed when repository configuration and accepted release timing make it practical; deployment work must not displace higher-value product capability indefinitely.
- technical prerequisites may move earlier, but a prerequisite must have a named product capability it enables.

## 5. Anti-drift gate

Before creating or materially reprioritizing an implementation Issue, the control plane must answer:

1. **North Star:** Which product pillar or user workflow does this improve?
2. **User value:** Is this solving a real transportation/traffic/GIS/field workflow, or mainly an interesting technical problem?
3. **Dependency:** Is it genuinely required before a higher-value feature, or can it be deferred?
4. **Truthfulness:** Can the capability be implemented and presented without fabricated engineering meaning or unsupported precision?
5. **Opportunity cost:** Is there a higher-value core feature already ready to implement?

If those questions do not have a credible answer, default to defer/research rather than expanding the critical path.

## 6. Non-goals

City Map Tools is not intended to become:
- a full replacement for QGIS/ArcGIS/AutoCAD;
- a complete traffic assignment or microsimulation engine;
- a generic plugin platform;
- a cloud collaboration SaaS requiring a mandatory backend;
- a collection of pseudo-analytical visual effects presented as engineering results.

Specialist analysis software remains appropriate for specialist methods. City Map Tools may import, visualize, compare, annotate, and report those results with provenance.

## 7. Source-of-truth hierarchy

Use these documents for different questions:

1. **`PRODUCT_DIRECTION.md`** — why the product exists and what product capabilities matter.
2. **`PRD.md`** — target capability specification and roadmap modules.
3. **Issue #1 + current child Issues** — execution sequence, decisions, and acceptance contracts.
4. **`PROJECT_PROFILE.md`** — current accepted repository state and immediate objective.
5. **`README.md`** — what the accepted application can actually do now.

Conversation history is not the durable roadmap. When chat and repository documents disagree, reconcile the repository documents explicitly.

## 8. Governance

Changes to the North Star, removal of a Core Product item, or promotion of a major new capability into the critical path require an explicit control-plane product-direction review and a durable Issue #1 checkpoint.

Architecture may evolve. The product should not lose sight of its primary outcome: **a practical, professional engineering map workspace for creating and communicating transportation/site-access information and integrating trustworthy spatial/engineering data.**
