# Acknowledgements and provenance

This record documents the bounded provenance review for the R0B truth and security remediation. No third-party source code, data, or visual asset was intentionally embedded by this change.

## Conceptual inspiration

- [raynbowy23/Axon-City](https://github.com/raynbowy23/Axon-City) was reviewed as conceptual prior art for map-based urban exploration and analysis. The bounded repository scan found no copied or adapted Axon-City source, data, or asset in this repository. Public repository metadata was checked on 2026-09-12 and reports Apache-2.0. Axon-City is not used as this product's name or engine.

## Methodology and prior-art research

- [Space Syntax OpenMapping](https://github.com/spacesyntax/OpenMapping) was reviewed as methodology/prior-art research only. The current prototype does not use OpenMapping code, data, or content, and OpenMapping is not the local analytical engine. Public repository metadata was checked on 2026-09-12 and reports CC BY-SA 4.0; no OpenMapping material is redistributed here.

## Runtime providers and libraries

The prototype uses MapLibre GL JS, Turf.js, Lucide, Tailwind CSS via CDN, Nominatim search, and optional OSM, Esri, CARTO, and OpenTopoMap basemap providers. Current UI attribution and provider failure behavior are part of the R0B capability contract; routing/accessibility providers are not active in this revision, and external provider terms and availability remain constraints.

## Bounded scan and license decision

The scan covered the current tracked tree, repository history, user-facing references, and obvious vendor/asset locations. It found no vendored third-party source, data, binary asset, LICENSE, or NOTICE file. The repository history begins with a single-file prototype commit, so complete source lineage cannot be established from the local tree alone. No repository LICENSE is selected until a complete provenance review resolves that remaining uncertainty.
