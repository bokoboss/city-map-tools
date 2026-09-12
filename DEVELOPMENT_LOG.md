# Development & Architecture Log: City Map Tools

## Project Information
* **Target Repository**: [bokoboss/city-map-tools](https://github.com/bokoboss/city-map-tools)
* **Live Deployment URL**: [https://bokoboss.github.io/city-map-tools/](https://bokoboss.github.io/city-map-tools/)
* **Release Version**: 2.2.0
* **Date**: September 12, 2026
* **Author / Collaborator**: Kittipat Tangittinunt (BU-TR) & Gemini Spark

---

## 1. Executive Changelog Summary

### Version 2.2.0: Space Syntax, Desire Lines & GitHub Repository Architecture
* **Space Syntax Integration ([OpenMapping Concept](https://github.com/spacesyntax/OpenMapping))**:
  * Purely browser-based and open-source: No desktop GIS or Shapefile dependency.
  * Real-time extraction of OSM highway networks for active viewports via Overpass API with local fallback.
  * Measures calculated:
    * **Spatial Integration** (Closeness Centrality / To-Movement Potential)
    * **Spatial Choice** (Betweenness Centrality / Through-Movement Potential)
  * Metric radii: 800m (Pedestrian), 2km (Neighborhood/Transit), 5km (Citywide).
  * Color ramp: Standard Space Syntax spectrum from Red (Top 10% Core) to Blue (Cul-de-sacs).
* **Desire Lines & OD Flow Analysis**:
  * Dynamic centroid linking using `turf.centroid` for both Polygons (Parcels, TAZ) and Circles (Station Catchment Buffers).
  * User-specified flow/demand attribute (trips/hour, passengers, vehicles).
  * Real-time **Stroke Width Scaling** based on demand value and dynamic scale multiplier ($0.5\times$ to $4.0\times$).
  * 1-Click All-Pairs Matrix generator connecting all zones across the active workspace.
* **GitHub Repository Structural Optimization**:
  * Clean, industry-standard directory structure tailored for GitHub Pages.
  * Automated `.github/workflows/deploy.yml` GitHub Actions pipeline.
  * Dual-mode architecture: Runs as a zero-build static single-page app or via modern Vite development server.
