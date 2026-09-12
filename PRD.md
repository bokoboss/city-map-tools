# Product Requirement Document (PRD) & Technical Specification

## Project: Next-Gen Map Tools (`map-tools-v2`)
* **Upstream Baseline**: [bokoboss/map-tools](https://github.com/bokoboss/map-tools)
* **Version**: 2.0.0
* **Target Audience**: Transportation & Traffic Engineers, Urban Planners, GIS Specialists, Field Surveyors
* **Priority Sequence**: `A` ➔ `B` ➔ `C` ➔ `E` ➔ `F` ➔ `D` ➔ `G`

---

## 1. Executive Summary & Vision
Next-Gen Map Tools transforms a lightweight 2D Leaflet annotation toy into a professional-grade, browser-based **Geospatial Annotation & Spatial Analytics Canvas** (inspired by Felt, Placemark, and AutoCAD Map 3D). It combines high-performance 3D vector rendering with domain-specific engineering capabilities: road-network snapping, interactive elevation profiling, isochrone travel sheds, Figma-style layer management with infinite undo/redo, and high-DPI cartographic exports for engineering reports.

---

## 2. System Architecture & Tech Stack

```
+-------------------------------------------------------------------------+
|                              Next-Gen UI                                |
|   Tailwind CSS  |  shadcn/ui & Radix  |  Lucide Icons  |  Figma-style   |
+------------------------------------+------------------------------------+
|                         State & Action Layer                            |
|        Zustand Store  +  Zundo (Undo/Redo)  +  IndexedDB Cache          |
+------------------------------------+------------------------------------+
|                         Spatial Engine Layer                            |
|    MapLibre GL JS v4+ (3D WebGL2)  |  Turf.js  |  R-Tree (rbush)       |
+-------------------+----------------+--------------------+---------------+
| External Routing  | Elevation DEM  | GIS File Parsers   | Export Engine |
|   OSRM / Valhalla | Terrain RGB    | @loaders.gl, shpjs | jsPDF, Canvas |
+-------------------+----------------+--------------------+---------------+
```

### Core Technology Choices
* **Rendering Engine**: **MapLibre GL JS (v4+)**
  * Replaces Leaflet 2D DOM/Canvas.
  * Native WebGL2/WebGPU acceleration, 60fps rendering of 100,000+ vector features.
  * 3D camera controls (Pitch 0–85°, Bearing 0–360°), 3D building extrusions, and Terrain DEM support.
* **Spatial Algorithms**: **Turf.js + rbush**
  * Geometry calculations, buffer zones, Bézier curve splines, spatial indexing for CAD snapping.
* **Frontend Framework**: **React 19 + TypeScript + Vite**
  * Strict type safety for GIS features, clean modular component structure.
* **State Management**: **Zustand + Immer + Zundo**
  * Atomic state updates with infinite Undo/Redo stack and command pattern serialization.
* **Storage & Persistence**: **IndexedDB via idb-keyval**
  * Local-first persistence; projects persist safely across browser reloads without server dependency.

---

## 3. Prioritized Feature Modules Specification

### Module A: Core 3D Vector Engine (Priority 1)
1. **Multi-Style Vector Base Maps**:
   * Vector styles via free/open CDNs (Carto Voyager, Dark Matter, Positron, OSM Liberty, OpenFreeMap, and Satellite Hybrid).
   * Instant style switching without dropping active drawing layers.
2. **3D Camera & Buildings**:
   * Interactive camera controls: Right-click drag / Ctrl+Drag for 3D Pitch and Rotation.
   * Toggleable 3D Buildings layer (`fill-extrusion`) using OpenStreetMap `render_height` data with realistic sun angle shading.
3. **Terrain Elevation**:
   * Global elevation DEM support (MapLibre Terrain RGB raster source) for real-world topographic relief.

### Module B: Smart CAD & Snapping (Priority 2)
1. **Smart Road Snapping**:
   * Auto-routing Polyline mode: User clicks Waypoint A and Waypoint B -> App queries OSRM Routing Engine -> Returns accurate road-aligned LineString with distance and turn details.
   * Fallback to direct straight segment if no road is detected or if Shift key is held.
2. **CAD-Grade Magnetic Snapping**:
   * Client-side R-tree (`rbush`) indexing all vertices and line midpoints in active layers.
   * Configurable snap radius (10–20px screen space) with visual magnetic cursor indicator.
3. **Bézier Curves & Smoothing**:
   * One-click conversion of angular Polylines into smoothed curves via `turf.bezierSpline`.

### Module C: Pro Spatial Analytics (Priority 3)
1. **Dynamic Elevation Cross-Section Profile**:
   * Drawing or selecting a Polyline calculates elevation samples along the route.
   * Interactive cross-section chart rendered at the bottom drawer. Hovering over the elevation graph moves a sync marker along the 3D map line in real-time.
2. **Isochrone Travel-Time Reachability**:
   * Place a pin, pick travel mode (Walk, Bicycle, Drive), select threshold (5, 10, 15, 30 min).
   * Generates multi-ring travel polygon sheds showing accessibility zones.
3. **Buffer Zones**:
   * Generate instant buffer polygons around points, lines, or areas (e.g., 50m right-of-way, 500m transit catchment area) using `turf.buffer`.

### Module E: Figma-like UX/UI & State Management (Priority 4)
1. **Infinite Undo/Redo Engine**:
   * Full history tracking (`Ctrl+Z`, `Ctrl+Shift+Z` / `Ctrl+Y`) for geometry creation, node edits, style changes, and deletions.
2. **Figma-Style Layer Manager**:
   * Left sidebar layer tree: Drag-and-drop layer reordering (controls render z-index).
   * Per-layer controls: Visibility toggle (Eye), Lock position, Opacity slider (0–100%), Color swatch, Renaming, Grouping folders.
3. **Modern Floating Toolbars**:
   * Floating dock with tool shortcuts: Select (V), Hand (H), Marker (M), Polyline (L), Road Snap (R), Polygon (P), Buffer (B), Measure (D).

### Module F: High-DPI Cartographic Print (Priority 5)
1. **Publication-Ready Export Engine**:
   * Renders map on an off-screen high-resolution canvas at user-specified DPI (150, 300 DPI) and formats (A4/A3 Landscape/Portrait).
2. **Cartographic Overlays**:
   * Dynamic Scale Bar (calculated using true geodesic scale at center latitude).
   * SVG North Arrow with auto-orientation matching map bearing.
   * Auto-generated Legend block detailing layer colors, line types, and symbols.
   * Engineering Title Block (Project Title, Author, Date, Scale, Coordinate System WGS84).

### Module D: GIS & CAD Interoperability (Priority 6)
1. **Universal Drag-and-Drop Importer**:
   * Ingests GeoJSON, KML (`togeojson`), GPX, CSV (auto-detecting `lat`, `lon`, `x`, `y` columns via PapaParse), and zipped Shapefiles (`shpjs`).
2. **CAD DXF Export**:
   * Direct export to AutoCAD `.dxf` (using `dxf-writer`) mapping markers to Blocks/Points, polylines to LWPOLYLINE, and layers to corresponding CAD layers.
3. **Standard GIS Export**:
   * Export to standard GeoJSON FeatureCollection and KML.

### Module G: Rich Context & Multimedia (Priority 7)
1. **Rich Markdown Popups**:
   * Click any feature to inspect or edit details in rich text (Markdown, checkboxes, tags, status pills).
2. **Photo Attachments**:
   * Attach ground photos or survey snapshots stored locally via IndexedDB Blob URLs.
3. **Street View Quick-Peek**:
   * Context-menu action: "Open Street View Here" opens a floating Google Street View modal oriented to the road heading.

---

## 4. Unified GeoJSON Feature Data Schema

Every annotation feature follows strict GeoJSON specifications extended with custom properties:

```typescript
export interface MapToolsFeatureProperties {
  id: string;
  name: string;
  layerId: string;
  createdAt: number;
  updatedAt: number;
  
  // Style properties
  style: {
    color: string;
    strokeWidth: number;
    strokeOpacity: number;
    fillColor?: string;
    fillOpacity?: number;
    dashArray?: string;
    icon?: string;
    size?: number;
  };

  // Domain & Analytics Metadata
  meta: {
    description?: string;
    tags?: string[];
    photos?: string[]; // base64 or blob IDs
    isRoadSnapped?: boolean;
    distanceMeters?: number;
    areaSquareMeters?: number;
    elevationSamples?: Array<{ distance: number; elevation: number }>;
    isochroneMinutes?: number;
  };
}
```

---

## 5. Development Roadmap & Milestones

| Milestone | Deliverables | Target Status |
| :--- | :--- | :--- |
| **M1 (Sprint 1)** | Core MapLibre 3D engine, 3D buildings, style switcher, and Road Snapping tool with OSRM | **Phase 1 Scaffold** |
| **M2 (Sprint 2)** | Turf.js analytics, Elevation Profile chart, Isochrone generator, Buffer tool | Phase 2 |
| **M3 (Sprint 3)** | Figma-like layer manager, Infinite Undo/Redo (Zundo), IndexedDB local persistence | Phase 3 |
| **M4 (Sprint 4)** | 300 DPI Cartographic export with Scale Bar & North Arrow, DXF/Shapefile/KML parser, Media popups | Phase 4 |
