# Acknowledgements and provenance

This record documents the bounded provenance review for the R0B truth and security remediation. No third-party source code, data, or visual asset was intentionally embedded by this change.

## Conceptual inspiration

- [raynbowy23/Axon-City](https://github.com/raynbowy23/Axon-City) was reviewed as conceptual prior art for map-based urban exploration and analysis. The bounded repository scan found no copied or adapted Axon-City source, data, or asset in this repository. Public repository metadata was checked on 2026-09-12 and reports Apache-2.0. Axon-City is not used as this product's name or engine.

## Methodology and prior-art research

- [Space Syntax OpenMapping](https://github.com/spacesyntax/OpenMapping) was reviewed as methodology/prior-art research only. The current prototype does not use OpenMapping code, data, or content, and OpenMapping is not the local analytical engine. Public repository metadata was checked on 2026-09-12 and reports CC BY-SA 4.0; no OpenMapping material is redistributed here.

## Current shell runtime libraries

The current static shell records these direct npm runtime dependencies in its committed
lockfile. Package metadata was checked on 2026-09-13; this is a dependency record, not
a repository-wide license selection or a claim that provider data is redistributed.

- `maplibre-gl` 6.9.0 — BSD-3-Clause.
- `terra-draw` 1.31.0 — MIT. It supplies transient LineString/Polygon editor state.
- `terra-draw-maplibre-gl-adapter` 1.4.1 — MIT.
- `@turf/buffer` 7.4.0 — MIT. It supplies bounded, explicitly unvalidated derived
  buffer geometry; the application preserves source/method/parameter provenance.
- `react` 19.3.0 and `react-dom` 19.3.0 — MIT.

The shell uses optional OpenStreetMap raster and CARTO Voyager basemap requests with
visible attribution, capability/error state, and links to provider policy/terms. No
provider dataset, map style, API key, or third-party source asset is vendored.

## Legacy R0 prototype runtime inventory

The preserved reference prototype uses MapLibre GL JS, Turf.js, Lucide, Tailwind CSS
via CDN, Nominatim search, and optional OSM, Esri, CARTO, and OpenTopoMap basemap
providers. That inventory belongs to the reference prototype, not the current shell.
Routing/accessibility providers are not active in the current revision, and external
provider terms and availability remain constraints.

## Bounded scan and license decision

The scan covered the current tracked tree, repository history, user-facing references, and obvious vendor/asset locations. It found no vendored third-party source, data, binary asset, LICENSE, or NOTICE file. The repository history begins with a single-file prototype commit, so complete source lineage cannot be established from the local tree alone. No repository LICENSE is selected until a complete provenance review resolves that remaining uncertainty.
