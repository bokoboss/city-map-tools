# City Map Tools (`city-map-tools`) 🏙️🗺️⚡
> **Next-Gen 3D Geospatial Annotation, Space Syntax & Transport Flow Web Canvas**  
> GitHub Repository: [https://github.com/bokoboss/city-map-tools](https://github.com/bokoboss/city-map-tools)  
> Live Application: [https://bokoboss.github.io/city-map-tools/](https://bokoboss.github.io/city-map-tools/)

---

## 🌟 Key Features

### 1. 🔬 Space Syntax Analysis (Online OpenMapping Engine)
* **Zero-File Setup**: No Shapefiles required. Pulls live OpenStreetMap road network data via Overpass API in real-time.
* **Topological Centrality**:
  * **Spatial Integration** (To-Movement / Closeness Centrality): Identifies primary urban cores and retail hubs.
  * **Spatial Choice** (Through-Movement / Betweenness Centrality): Detects major traffic spines and vehicular flow corridors.
* **Metric Radii Options**: $R = 800\text{ m}$ (Pedestrian), $R = 2\text{ km}$ (Transit/Neighborhood), $R = 5\text{ km}$ (Citywide).
* **Color Ramp**: Red (Top 10% Integration Core) ➔ Orange ➔ Yellow ➔ Green ➔ Blue (Cul-de-sacs).

### 2. ⚡ Desire Lines (OD Demand / Flow Matrix)
* Automatically connects the **geometric Centroids** (`turf.centroid`) of any drawn Zones (Polygons, Parcels, or Circular Buffers).
* **Dynamic Attribute Scaling**: Line thickness automatically scales with trip demand volume ($Q$).
* **Real-time Scale Multiplier ($0.5\times - 4.0\times$)** to dynamically emphasize high-volume corridors.
* **1-Click All-Pairs Matrix Generator**: Automatically interconnects all active zones on the map into an Origin-Destination flow web.

### 3. ⌛ Accessibility & Catchment (Axon-City Style)
* **Dual Representation**:
  * **Isochrone Area Contours**: 5, 10, 15-minute catchment polygons.
  * **Network Reachable Paths**: Street infrastructure tree highlighting walkable/drivable road segments.
* **Travel Modes**: Walking (4.5 km/h), Cycling (15 km/h), Driving (40 km/h).

### 4. 🧲 CAD Precision Snapping & Bézier Smoothing
* **Magnetic Snapping**: 15px snap radius to vertices (Green) and midpoints (Orange) with R-Tree spatial indexing.
* **Road Snapping (OSRM)**: Snaps polylines to real-world road networks with distance metrics.
* **Bézier Curves**: Converts angular line segments into aerodynamic curves via Turf.js spline interpolation.

### 5. ⛰️ Interactive Elevation Profile
* Real-time elevation sampling along routes from Terrain DEM.
* Bottom drawer interactive chart with bidirectional map marker tracking.

### 6. 📍 Dynamic Draggable Markers & Radius Buffers
* Freely drag pins across the map with live attached circle buffer and label synchronization.
* Configurable Radius Buffer (50m–10km) with metric ($km^2$) and Thai units (~Rai) area calculation.
* 8 Marker Icons & 10 Color Swatches presets.

### 7. 🛰️ 12+ High-Definition Basemaps
* Google Hybrid, Google Satellite, Google Streets, Google Terrain
* ESRI World Imagery, ESRI Streets, ESRI Topo
* Carto Dark Matter, Carto Positron, Carto Voyager, OSM Liberty, OpenTopoMap

---

## 🚀 Deployment Instructions for `bokoboss/city-map-tools`

### Initial Setup & Git Push
```bash
# 1. Clone your new repository (or navigate to your local folder)
git clone https://github.com/bokoboss/city-map-tools.git
cd city-map-tools

# 2. Extract the files from city-map-tools-github.zip into this folder
# 3. Stage and push to GitHub
git add .
git commit -m "feat: initial commit for City Map Tools v2.2"
git branch -M main
git push -u origin main
```

### Enable GitHub Pages
1. Go to your repository on GitHub: `https://github.com/bokoboss/city-map-tools`
2. Navigate to **Settings** ➔ **Pages**
3. Under **Build and deployment** ➔ **Source**, select **GitHub Actions**
4. The workflow will run automatically and your app will be live at:
   👉 **`https://bokoboss.github.io/city-map-tools/`**
