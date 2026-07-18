// src/lib/geo.js
// Small geometry helpers used to draw the direction arrow (V4) and the
// prediction wedge (V6) on top of the raw lat/lng points. Pure functions,
// no React/Leaflet imports here so they're easy to unit test on their own.

const EARTH_RADIUS_M = 6371000;

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/**
 * Given a start point, a bearing (0-360, 0 = north) and a distance in
 * meters, return the destination [lat, lng].
 */
export function destinationPoint(lat, lng, bearingDeg, distanceMeters) {
  const δ = distanceMeters / EARTH_RADIUS_M;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(lat);
  const λ1 = toRad(lng);

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

  return [toDeg(φ2), ((toDeg(λ2) + 540) % 360) - 180];
}

/**
 * Build a fan/wedge polygon centered on `headingDeg`, `spreadDeg` wide,
 * reaching `distanceMeters` out from [lat, lng]. Used for the "high
 * probability search area" cone in V6.
 */
export function computeWedgePolygon(
  lat,
  lng,
  headingDeg,
  distanceMeters,
  spreadDeg = 50,
  steps = 12
) {
  if (!distanceMeters || distanceMeters <= 0) return [];

  const points = [[lat, lng]];
  const start = headingDeg - spreadDeg / 2;
  const end = headingDeg + spreadDeg / 2;

  for (let i = 0; i <= steps; i++) {
    const bearing = start + ((end - start) * i) / steps;
    points.push(destinationPoint(lat, lng, bearing, distanceMeters));
  }
  points.push([lat, lng]);
  return points;
}

/**
 * Endpoint for the short direction-arrow segment drawn off the last
 * known marker (V4). `pixelLikeMeters` is a fixed visual length in
 * meters that reads well at typical zoom levels (~15-16).
 */
export function computeArrowEndpoint(lat, lng, headingDeg, lengthMeters = 120) {
  if (headingDeg === null || headingDeg === undefined) return null;
  return destinationPoint(lat, lng, headingDeg, lengthMeters);
}

export function metersLabel(m) {
  if (m === null || m === undefined) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}