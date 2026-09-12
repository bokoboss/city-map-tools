# City Map Tools

> Static-first browser map annotation prototype. This README describes the current revision only; it is not a claim of production readiness or validated engineering analysis.

Repository: <https://github.com/bokoboss/city-map-tools>
Live application: <https://bokoboss.github.io/city-map-tools/>

## Current scope

The application is a single-file MapLibre/Turf prototype for local annotation work. It stores feature geometry as WGS84 longitude/latitude and keeps metric units and provider limitations explicit where they apply.

Current working behavior includes:

- Displaying the map with OpenStreetMap, ESRI, OpenTopoMap, and CARTO basemap options. Providers are best-effort and attribution is shown by the map/provider style.
- Drawing points, polylines, and polygons with client-side vertex/midpoint snapping.
- Dragging markers, editing names/styles, toggling visibility, undoing changes, and creating Turf.js buffer geometry.
- Creating a user-authored desire line between selected centroids when the user supplies a demand value. The demand is not validated and is not a traffic assignment result.
- Best-effort Nominatim place search. External routing/accessibility preview is disabled until a pedestrian method and provider contract are validated; no fallback geometry is fabricated.
- GeoJSON import/export. Exported features carry a validationStatus and provenance object so authored, imported, experimental, and unvalidated data cannot be mistaken for validated engineering results.
- A 3D Buildings control that is enabled only when the selected vector basemap exposes a compatible building source. It is disabled on raster/incompatible basemaps.

## Capability status

| Status | Capability | Current truth |
| --- | --- | --- |
| Validated | Engineering analytics | None. No analytical method in this prototype is accepted as validated engineering analysis. |
| Functional but unvalidated | Annotation, drawing, snapping, marker drag/undo, buffers, GeoJSON import/export | Useful prototype behavior; geometry and imported/user-authored values still require review for project use. |
| Experimental | Basemap providers, Nominatim search, 3D buildings on compatible vector styles, user-authored desire lines | External services and outputs are best-effort or authored; attribution, provider policy, method, and limitations remain material. |
| Disabled/Planned | Network centrality / Space Syntax, pedestrian routing and travel-time catchments, elevation/DEM profiles, all-pairs OD demand generation | Quarantined until separately validated methods, sources, and evidence are accepted. No pseudo or synthetic replacement is generated. |

Motor-vehicle routing, traffic-aware isochrones, real DEM analysis, persistence architecture, and the future modular React/TypeScript migration are outside this R0 remediation.

## Development

Prerequisites: Node.js 18+ and npm.

~~~bash
npm install
npm run dev
~~~

The development server uses the Vite shell and serves the application under the /city-map-tools/ path. The production smoke check is:

~~~bash
npm run build
~~~

The prototype intentionally does not yet define a full lint, typecheck, unit, or end-to-end test suite. Browser smoke evidence is run manually for behavior that crosses the DOM, MapLibre, and provider boundaries.

## Providers and attribution

- OpenStreetMap tiles and Nominatim search are community/open services with usage policies and best-effort availability.
- ESRI, CARTO, and OpenTopoMap basemaps retain provider attribution where required by their styles/tiles.
- Routing/accessibility provider integration is not active in this revision; a future provider must be pedestrian-scoped and separately validated.
- Direct undocumented Google tile endpoints are not included. A supported Google Maps Platform integration, if ever added, must be separately designed with authentication, billing, attribution, and usage review.
- Provider errors are surfaced in the UI; local annotations remain client-side.

## Provenance and licensing

See [ACKNOWLEDGEMENTS.md](ACKNOWLEDGEMENTS.md) for the bounded provenance findings and the distinction between conceptual inspiration, methodology research, and embedded material.

A repository license has not been selected while the complete source lineage remains unresolved. No third-party source, dataset, or asset is intentionally redistributed by this revision.
