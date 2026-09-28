# R2A-1 spatial method contract

Project Document v1 stores canonical geometry as WGS84 geographic degrees in
`[longitude, latitude]` order. That is also the position order used by RFC 7946
GeoJSON and MapLibre `LngLat`. Storage and project geometry types do not change.

`src/spatial/geodesic.ts` provides pure WGS84 ellipsoidal calculations through
`geographiclib-geodesic@2.2.0`. At every library call, project `[longitude,
latitude]` is passed as GeographicLib `(latitude, longitude)`. Inverse distance,
line length, and polygon perimeter are in metres; polygon area is in square
metres. An inverse bearing is the initial geodesic azimuth clockwise from true
north, normalized to `[0, 360)` degrees. Coincident positions have no bearing
and return `null`. The exported immutable method metadata identifies the method,
ellipsoid, exact library version, units, and azimuth convention for later use.

Line length is the sum of consecutive inverse distances. Polygon metrics use the
current single, explicitly closed exterior ring. The closing vertex is omitted
when adding vertices to GeographicLib because its polygon accumulator closes the
ring itself. Public area is the absolute magnitude of GeographicLib's algebraic
geodesic area, independent of ring winding. The existing project validators
reject invalid coordinates and out-of-contract shapes; non-finite library
outputs also fail explicitly. No spherical, Web Mercator, or degree-delta metric
fallback is used.

This kernel does not qualify polygon topology. A self-intersecting or otherwise
pathological ring can produce an algebraic area that is not a meaningful
engineering area. A future caller must enforce any stronger topology rule before
presenting an engineering measurement. These helpers do not create a `Validated`
feature or result and do not change the existing Turf buffer method.

No universal projected CRS is selected. Future planar operations must state and
justify their projection for their extent. Issue #14 owns the measurement UI and
its user-facing method/status disclosure; Issue #42 owns snapping. Neither is
implemented by this kernel.
