// import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
// import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
// import L from "leaflet";
// import { Search, Radio, AlertTriangle, Layers, RefreshCw, Users, X, Loader, MapPin, Navigation } from "lucide-react";
// import { api } from "../lib/api";
// import "leaflet/dist/leaflet.css";

// // ── constants ─────────────────────────────────────────────────────────────────
// const SEVERITY_COLOR = { CRITICAL: "#ef4444", HIGH: "#f97316", MODERATE: "#3b82f6", LOW: "#6b7280" };
// const STATUS_RING    = { PENDING: "#f97316", VERIFIED: "#3b82f6", DISPATCHED: "#22c55e", RESOLVED: "#6b7280" };
// const TEAM_STATUS_COLOR = { AVAILABLE: "#16a34a", DEPLOYED: "#2563eb", MAINTENANCE: "#94a3b8", OFFLINE: "#ef4444" };
// const PLACE_TYPE_PILL = { hospital: "red", school: "blue", ngo: "green" };
// const PLACE_TYPE_LABEL = { hospital: "Hospital", school: "School", ngo: "NGO / Social" };

// const OVERPASS_URL  = "https://overpass.kumi.systems/api/interpreter";
// const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// // Animation speed: meters per second (simulated ~30 km/h)
// const SIM_SPEED_MPS = 8;

// // Only re-render React state this often (ms) — 10x/sec prevents freeze
// const RENDER_INTERVAL_MS = 100;

// // ── OSM helpers ───────────────────────────────────────────────────────────────
// async function fetchNearbyFromOverpass(lat, lng) {
//   const query = `
// [out:json][timeout:10];
// (
//   node["amenity"~"hospital|clinic|school|college|social_facility|community_centre"](around:5000,${lat},${lng});
//   way["amenity"~"hospital|clinic|school|college|social_facility|community_centre"](around:5000,${lat},${lng});
// );
// out center 30;`;
//   const res = await fetch(OVERPASS_URL, {
//     method: "POST",
//     body: new URLSearchParams({ data: query }),
//     headers: { "User-Agent": "Rakshak-DisasterResponse/2.0" },
//   });
//   if (!res.ok) throw new Error("Overpass failed");
//   const data = await res.json();
//   const TYPE_MAP = {
//     hospital: "hospital", clinic: "hospital",
//     school: "school", college: "school",
//     social_facility: "ngo", community_centre: "ngo",
//   };
//   const seen = new Set();
//   return data.elements.map((el) => {
//     const amenity = el.tags?.amenity || "";
//     const place_type = TYPE_MAP[amenity];
//     if (!place_type) return null;
//     const elLat = el.type === "way" ? el.center?.lat : el.lat;
//     const elLng = el.type === "way" ? el.center?.lon : el.lon;
//     if (!elLat || !elLng) return null;
//     const place_id = `osm:${el.type}:${el.id}`;
//     if (seen.has(place_id)) return null;
//     seen.add(place_id);
//     return { place_id, place_name: el.tags?.name || amenity.replace("_", " "), place_type, latitude: elLat, longitude: elLng };
//   }).filter(Boolean);
// }

// async function fetchPlaceMatchesFromNominatim(placeName) {
//   const url = `${NOMINATIM_URL}?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(placeName)}`;
//   const res = await fetch(url, { headers: { "User-Agent": "Rakshak-DisasterResponse/2.0" } });
//   if (!res.ok) throw new Error("Nominatim failed");
//   const data = await res.json();
//   return data.map((r) => ({
//     place_id: `nominatim:${r.place_id}`,
//     display_name: r.display_name,
//     latitude: parseFloat(r.lat),
//     longitude: parseFloat(r.lon),
//   }));
// }

// // ── haversine (metres) ────────────────────────────────────────────────────────
// function haversineM(lat1, lng1, lat2, lng2) {
//   const R = 6371000;
//   const dLat = ((lat2 - lat1) * Math.PI) / 180;
//   const dLng = ((lng2 - lng1) * Math.PI) / 180;
//   const a =
//     Math.sin(dLat / 2) ** 2 +
//     Math.cos((lat1 * Math.PI) / 180) *
//       Math.cos((lat2 * Math.PI) / 180) *
//       Math.sin(dLng / 2) ** 2;
//   return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
// }

// // Build cumulative distances along a polyline (metres)
// function buildCumulativeDistances(coords) {
//   const dists = [0];
//   for (let i = 1; i < coords.length; i++) {
//     const d = haversineM(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
//     dists.push(dists[i - 1] + d);
//   }
//   return dists;
// }

// // ── FIX 1: Binary search replaces linear O(n) scan ───────────────────────────
// // Previously this was a for-loop scanning every point from the start.
// // With 150-point routes at 10 ticks/sec × multiple teams, that O(n) cost
// // was compounding into a freeze. Binary search cuts it to O(log n).
// // Returns { pos: [lat, lng], idx: number } so callers can also get the index
// // for cheap array slicing in RouteLayer without a second scan.
// function interpolateAlongRoute(coords, cumDists, travelledM) {
//   const total = cumDists[cumDists.length - 1];
//   const clamped = Math.min(travelledM, total);

//   // Binary search for the segment containing clamped distance
//   let lo = 0, hi = cumDists.length - 1;
//   while (lo < hi - 1) {
//     const mid = (lo + hi) >> 1;
//     if (cumDists[mid] < clamped) lo = mid; else hi = mid;
//   }

//   const seg = cumDists[hi] - cumDists[lo];
//   const t = seg === 0 ? 0 : (clamped - cumDists[lo]) / seg;
//   const lat = coords[lo][0] + t * (coords[hi][0] - coords[lo][0]);
//   const lng = coords[lo][1] + t * (coords[hi][1] - coords[lo][1]);
//   return { pos: [lat, lng], idx: lo };
// }

// // ── ROUTE SIMPLIFICATION (Ramer–Douglas–Peucker) ─────────────────────────────
// function perpendicularDistanceM(point, lineStart, lineEnd) {
//   const latRef = (lineStart[0] + lineEnd[0]) / 2;
//   const mPerDegLat = 111320;
//   const mPerDegLng = 111320 * Math.cos((latRef * Math.PI) / 180);

//   const x  = point[1]     * mPerDegLng, y  = point[0]     * mPerDegLat;
//   const x1 = lineStart[1] * mPerDegLng, y1 = lineStart[0] * mPerDegLat;
//   const x2 = lineEnd[1]   * mPerDegLng, y2 = lineEnd[0]   * mPerDegLat;

//   const dx = x2 - x1, dy = y2 - y1;
//   const lenSq = dx * dx + dy * dy;
//   if (lenSq === 0) return Math.hypot(x - x1, y - y1);

//   const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
//   const projX = x1 + t * dx, projY = y1 + t * dy;
//   return Math.hypot(x - projX, y - projY);
// }

// function simplifyRouteRDP(coords, toleranceM) {
//   if (coords.length <= 2) return coords;

//   function rdp(points) {
//     if (points.length <= 2) return points;
//     const [start, end] = [points[0], points[points.length - 1]];
//     let maxDist = -1, maxIdx = 0;
//     for (let i = 1; i < points.length - 1; i++) {
//       const d = perpendicularDistanceM(points[i], start, end);
//       if (d > maxDist) { maxDist = d; maxIdx = i; }
//     }
//     if (maxDist > toleranceM) {
//       const left  = rdp(points.slice(0, maxIdx + 1));
//       const right = rdp(points.slice(maxIdx));
//       return [...left.slice(0, -1), ...right];
//     }
//     return [start, end];
//   }

//   return rdp(coords);
// }

// const MAX_ROUTE_POINTS = 150;
// function getSimplifiedRoute(coords) {
//   if (!coords || coords.length <= MAX_ROUTE_POINTS) return coords;

//   let tolerance = 8;
//   let simplified = simplifyRouteRDP(coords, tolerance);

//   let attempts = 0;
//   while (simplified.length > MAX_ROUTE_POINTS && attempts < 6) {
//     tolerance *= 2;
//     simplified = simplifyRouteRDP(coords, tolerance);
//     attempts++;
//   }
//   return simplified;
// }

// // ── icon factories ────────────────────────────────────────────────────────────
// function makeIncidentIcon(severity, status, isSelected) {
//   const fill  = SEVERITY_COLOR[severity] || "#6b7280";
//   const ring  = STATUS_RING[status]      || "#6b7280";
//   const scale = isSelected ? 1.4 : 1;
//   const svg = `
//     <svg xmlns="http://www.w3.org/2000/svg" width="${36*scale}" height="${44*scale}" viewBox="0 0 36 44">
//       <circle cx="18" cy="18" r="16" fill="${ring}" opacity="0.2"/>
//       <circle cx="18" cy="18" r="11" fill="${fill}" stroke="#ffffff" stroke-width="2"/>
//       ${isSelected ? `<circle cx="18" cy="18" r="16" fill="none" stroke="${fill}" stroke-width="2" stroke-dasharray="4 3" opacity="0.9"/>` : ""}
//       <line x1="18" y1="29" x2="18" y2="43" stroke="${fill}" stroke-width="2.5" stroke-linecap="round"/>
//     </svg>`;
//   return L.divIcon({ html: svg, className: "", iconSize: [36*scale,44*scale], iconAnchor: [18*scale,43*scale], popupAnchor: [0,-(44*scale)] });
// }

// function makeTeamIcon(status, isSelected) {
//   const col   = TEAM_STATUS_COLOR[status] || "#6b7280";
//   const scale = isSelected ? 1.3 : 1;
//   const svg = `
//     <svg xmlns="http://www.w3.org/2000/svg" width="${32*scale}" height="${32*scale}" viewBox="0 0 32 32">
//       <rect x="2" y="2" width="28" height="28" rx="6" fill="${col}" opacity="0.15" stroke="${col}" stroke-width="1.5"/>
//       <rect x="7" y="7" width="18" height="18" rx="3" fill="${col}" stroke="#ffffff" stroke-width="1.5"/>
//       ${isSelected ? `<rect x="2" y="2" width="28" height="28" rx="6" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="4 3"/>` : ""}
//     </svg>`;
//   return L.divIcon({ html: svg, className: "", iconSize: [32*scale,32*scale], iconAnchor: [16*scale,16*scale], popupAnchor: [0,-(18*scale)] });
// }

// function makeMovingTeamIcon(teamName) {
//   const svg = `
//     <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
//       <circle cx="18" cy="18" r="16" fill="#2563eb" opacity="0.15"/>
//       <circle cx="18" cy="18" r="10" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
//       <circle cx="18" cy="18" r="16" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.7">
//         <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="3s" repeatCount="indefinite"/>
//       </circle>
//     </svg>`;
//   return L.divIcon({
//     html: `<div style="position:relative">
//       ${svg}
//       <div style="position:absolute;top:38px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(37,99,235,0.9);color:#fff;font-size:9px;font-weight:700;padding:2px 5px;border-radius:3px;font-family:monospace">${teamName}</div>
//     </div>`,
//     className: "",
//     iconSize: [36, 36],
//     iconAnchor: [18, 18],
//     popupAnchor: [0, -20],
//   });
// }

// function makeFacilityIcon(place_type) {
//   const COL = { hospital: "#ef4444", school: "#3b82f6", ngo: "#16a34a" };
//   const col = COL[place_type] || "#6b7280";
//   const svg = `
//     <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
//       <path d="M14 2C8.477 2 4 6.477 4 12c0 7.5 10 22 10 22s10-14.5 10-22c0-5.523-4.477-10-10-10z"
//             fill="${col}" stroke="#ffffff" stroke-width="2"/>
//       <circle cx="14" cy="12" r="4" fill="#ffffff"/>
//     </svg>`;
//   return L.divIcon({ html: svg, className: "", iconSize: [28,36], iconAnchor: [14,35], popupAnchor: [0,-36] });
// }

// // ── FIX 2: Icon caches — prevent L.divIcon() DOM teardown on every render ─────
// // Moving team icons: built once per team name, never rebuilt.
// const movingIconCache = {};
// function getMovingTeamIcon(teamName) {
//   if (!movingIconCache[teamName]) movingIconCache[teamName] = makeMovingTeamIcon(teamName);
//   return movingIconCache[teamName];
// }

// // Arrived/deployed team icons: built once per status+selected combo.
// const teamIconCache = {};
// function getCachedTeamIcon(status, isSelected) {
//   const key = `${status}-${isSelected}`;
//   if (!teamIconCache[key]) teamIconCache[key] = makeTeamIcon(status, isSelected);
//   return teamIconCache[key];
// }

// // ── fly-to helper ─────────────────────────────────────────────────────────────
// function FlyTo({ target }) {
//   const map = useMap();
//   useEffect(() => {
//     if (target) map.flyTo([target.latitude, target.longitude], 14, { duration: 1 });
//   }, [target]);
//   return null;
// }

// // ── helpers ───────────────────────────────────────────────────────────────────
// const SEV_TONE  = { CRITICAL: "red", HIGH: "orange", MODERATE: "blue", LOW: "muted" };
// const STAT_TONE = { PENDING: "orange", VERIFIED: "blue", DISPATCHED: "green", RESOLVED: "green" };

// function timeAgo(iso) {
//   try {
//     const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
//     if (diff < 60)   return `${diff}s ago`;
//     if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
//     return `${Math.floor(diff/3600)}h ago`;
//   } catch { return ""; }
// }

// const FILTER_TABS    = ["ALL","CRITICAL","HIGH","MODERATE","LOW"];
// const PANEL_TABS     = ["INCIDENTS","TEAMS","DISPATCH"];
// const TEAM_STAT_TONE = { AVAILABLE: "green", DEPLOYED: "blue", MAINTENANCE: "muted", OFFLINE: "red" };

// const ROUTE_COLORS = ["#2563eb","#16a34a","#dc2626","#d97706","#7c3aed","#0891b2"];

// // ── RouteLayer — isolated + memoized per-route rendering ──────────────────────
// // FIX 3: RouteLayer now receives precomputed `pos` and `posIdx` from state,
// // eliminating ALL math from the render path. The only work here is array
// // slicing (O(1) index lookup) and Leaflet position updates.
// // Using React.memo with a custom comparator so it only re-renders when the
// // fields that actually affect visuals change — not on every parent render.
// const RouteLayer = React.memo(function RouteLayer({ route }) {
//   // pos and posIdx are now precomputed in the animation engine (see tick()),
//   // so this component does zero interpolation work itself.
//   const { pos, posIdx, routeCoords, done, color, teamName, remainingKm, remainingMin, progress } = route;

//   // FIX 4: Slice uses precomputed posIdx — O(1) lookup, no scan needed.
//   const aheadCoords = useMemo(() => {
//     if (done || !pos || posIdx == null) return [];
//     return [pos, ...routeCoords.slice(posIdx + 1)];
//   }, [done, pos, posIdx, routeCoords]);

//   const behindCoords = useMemo(() => {
//     if (!pos || posIdx == null) return [];
//     return [...routeCoords.slice(0, posIdx + 1), pos];
//   }, [pos, posIdx, routeCoords]);

//   // Icons are stable references from cache — Leaflet never tears down the DOM node.
//   const movingIcon  = useMemo(() => getMovingTeamIcon(teamName), [teamName]);
//   const arrivedIcon = useMemo(() => getCachedTeamIcon("DEPLOYED", false), []);

//   if (!pos) return null;

//   return (
//     <>
//       {/* Travelled portion — solid, faded */}
//       {behindCoords.length >= 2 && (
//         <Polyline
//           positions={behindCoords}
//           pathOptions={{ color, weight: 4, opacity: 0.45 }}
//         />
//       )}
//       {/* Ahead portion — dashed */}
//       {aheadCoords.length >= 2 && (
//         <Polyline
//           positions={aheadCoords}
//           pathOptions={{ color, weight: 3, opacity: 0.9, dashArray: "8 5" }}
//         />
//       )}
//       {/* Moving team marker */}
//       {!done && (
//         <Marker position={pos} icon={movingIcon}>
//           <Popup className="rakshak-popup">
//             <div style={{ minWidth:160, fontFamily:"monospace" }}>
//               <div style={{ fontWeight:700, marginBottom:4, color:"#2563eb" }}>{teamName}</div>
//               <div style={{ fontSize:11, color:"#64748b", marginBottom:2 }}>EN ROUTE</div>
//               <div style={{ fontSize:12, color:"#1e293b" }}>{remainingKm} km remaining</div>
//               <div style={{ fontSize:12, color:"#1e293b" }}>ETA ~{remainingMin} min</div>
//               <div style={{ marginTop:6, background:"#f1f5f9", borderRadius:4, height:4, overflow:"hidden" }}>
//                 <div style={{ width:`${(progress*100).toFixed(1)}%`, height:"100%", background:"#2563eb", borderRadius:4, transition:"width 0.3s" }} />
//               </div>
//             </div>
//           </Popup>
//         </Marker>
//       )}
//       {/* Arrived marker */}
//       {done && (
//         <Marker position={pos} icon={arrivedIcon}>
//           <Popup className="rakshak-popup">
//             <div style={{ minWidth:140, fontFamily:"monospace" }}>
//               <div style={{ fontWeight:700, color:"#16a34a", marginBottom:3 }}>{teamName}</div>
//               <div style={{ fontSize:11 }}>✓ Arrived at incident</div>
//             </div>
//           </Popup>
//         </Marker>
//       )}
//     </>
//   );
// }, (prev, next) => {
//   // Custom comparator: only re-render if visually meaningful fields changed.
//   // This prevents re-renders caused by unrelated parent state updates.
//   const r1 = prev.route, r2 = next.route;
//   return (
//     r1.pos === r2.pos &&
//     r1.posIdx === r2.posIdx &&
//     r1.done === r2.done &&
//     r1.progress === r2.progress &&
//     r1.remainingKm === r2.remainingKm &&
//     r1.remainingMin === r2.remainingMin &&
//     r1.routeCoords === r2.routeCoords
//   );
// });

// // ── main ──────────────────────────────────────────────────────────────────────
// export default function MapCoordination() {
//   const [mapStyle, setMapStyle]   = useState("light");
//   const [flyTarget, setFlyTarget] = useState(null);

//   const [incidents, setIncidents] = useState([]);
//   const [incLoading, setIncLoading] = useState(true);
//   const [selectedInc, setSelectedInc] = useState(null);
//   const [sevTab, setSevTab]       = useState("ALL");
//   const [incQuery, setIncQuery]   = useState("");
//   const [refreshing, setRefreshing] = useState(false);

//   const [teams, setTeams]         = useState([]);
//   const [teamQuery, setTeamQuery] = useState("");
//   const [selectedTeam, setSelectedTeam] = useState(null);

//   const [facilityPins, setFacilityPins] = useState({});
//   const [panelTab, setPanelTab]   = useState("INCIDENTS");

//   const [facilityTarget, setFacilityTarget]     = useState(null);
//   const [facilityResults, setFacilityResults]   = useState([]);
//   const [facilityLoading, setFacilityLoading]   = useState(false);
//   const [facilityError, setFacilityError]       = useState(null);
//   const [assigningFacility, setAssigningFacility] = useState(null);
//   const [assignedPlaceId, setAssignedPlaceId]   = useState(null);
//   const [searchMode, setSearchMode]             = useState("place");
//   const [coordInput, setCoordInput]             = useState("");
//   const [placeQuery, setPlaceQuery]             = useState("");
//   const [placeMatches, setPlaceMatches]         = useState([]);
//   const [placeSearching, setPlaceSearching]     = useState(false);
//   const [placeError, setPlaceError]             = useState(null);
//   const [selectedPlace, setSelectedPlace]       = useState(null);

//   // activeRoutes shape: { [teamId]: { teamName, routeCoords, cumDists, totalM,
//   //   travelledM, pos, posIdx, remainingKm, remainingMin, distanceKm,
//   //   etaMinutes, incidentId, color, progress, done } }
//   const [activeRoutes, setActiveRoutes] = useState({});

//   const animFrameRef  = useRef({});  // { teamId: rAF id }
//   const lastTsRef     = useRef({});  // { teamId: timestamp }
//   const lastRenderRef = useRef({});  // { teamId: timestamp } — throttle
//   const animGenRef    = useRef({});  // { teamId: generation } — stale loop guard

//   const incListRef  = useRef(null);
//   const teamListRef = useRef(null);

//   // ── data loading ──────────────────────────────────────────────────────────
//   async function loadIncidents() {
//     try {
//       const data = await api.getIncidents();
//       setIncidents(data.filter((i) => i.latitude && i.longitude && i.status !== "REJECTED"));
//     } catch (e) { console.error(e); }
//     finally { setIncLoading(false); }
//   }

//   async function loadTeams() {
//     try { setTeams(await api.getTeams()); }
//     catch (e) { console.error(e); }
//   }

//   useEffect(() => { loadIncidents(); loadTeams(); }, []);

//   async function handleRefresh() {
//     setRefreshing(true);
//     await Promise.all([loadIncidents(), loadTeams()]);
//     setRefreshing(false);
//   }

//   // ── FIX 5: ANIMATION ENGINE — all fixes applied ───────────────────────────
//   //
//   // Key changes vs original:
//   //
//   // (a) cancelAnimationFrame BEFORE bumping generation. In the original, the
//   //     gen bump happened first. If the old tick() had already been queued by
//   //     the time cancelAnimationFrame ran, it would see the new gen, pass the
//   //     stale-guard, and run as a phantom second loop. Cancelling first
//   //     guarantees the old frame never fires.
//   //
//   // (b) interpolateAlongRoute (binary search) is called INSIDE the tick, and
//   //     its result (pos + posIdx) is stored directly in state. RouteLayer reads
//   //     these precomputed values — it does zero math itself.
//   //
//   // (c) The shouldRender throttle now also guards the setActiveRoutes call,
//   //     not just the rAF reschedule. This means React's reconciler only runs
//   //     ~10x/sec regardless of monitor refresh rate.
//   const startAnimation = useCallback((teamId) => {
//     // (a) Cancel old frame FIRST, then bump generation
//     if (animFrameRef.current[teamId]) {
//       cancelAnimationFrame(animFrameRef.current[teamId]);
//       animFrameRef.current[teamId] = null;
//     }

//     const myGen = (animGenRef.current[teamId] || 0) + 1;
//     animGenRef.current[teamId] = myGen;

//     lastTsRef.current[teamId]     = performance.now();
//     lastRenderRef.current[teamId] = performance.now();

//     function tick(now) {
//       // Stale loop guard
//       if (animGenRef.current[teamId] !== myGen) return;

//       const dt = (now - lastTsRef.current[teamId]) / 1000;
//       lastTsRef.current[teamId] = now;

//       const shouldRender = (now - (lastRenderRef.current[teamId] || 0)) >= RENDER_INTERVAL_MS;

//       if (!shouldRender) {
//         // Not time to render yet — reschedule without touching state at all.
//         // This is cheaper than calling setActiveRoutes with an unchanged value.
//         animFrameRef.current[teamId] = requestAnimationFrame(tick);
//         return;
//       }

//       lastRenderRef.current[teamId] = now;

//       setActiveRoutes((prev) => {
//         const route = prev[teamId];
//         if (!route || route.done) return prev;

//         const newTravelled = route.travelledM + SIM_SPEED_MPS * dt;
//         const done = newTravelled >= route.totalM;
//         const travelledM = done ? route.totalM : newTravelled;

//         // (b) Precompute position + index here so RouteLayer does zero work
//         const { pos, idx: posIdx } = interpolateAlongRoute(
//           route.routeCoords,
//           route.cumDists,
//           travelledM
//         );

//         const remainingM   = Math.max(0, route.totalM - travelledM);
//         const remainingMin = (remainingM / SIM_SPEED_MPS / 60);

//         if (!done) {
//           animFrameRef.current[teamId] = requestAnimationFrame(tick);
//         }

//         return {
//           ...prev,
//           [teamId]: {
//             ...route,
//             travelledM,
//             pos,
//             posIdx,
//             remainingKm: (remainingM / 1000).toFixed(2),
//             remainingMin: remainingMin.toFixed(1),
//             progress: travelledM / route.totalM,
//             done,
//           },
//         };
//       });
//     }

//     animFrameRef.current[teamId] = requestAnimationFrame(tick);
//   }, []);

//   // Clean up all animation frames on unmount
//   useEffect(() => {
//     return () => {
//       Object.values(animFrameRef.current).forEach((id) => {
//         if (id) cancelAnimationFrame(id);
//       });
//     };
//   }, []);

//   // ── Register routes from multi-allocation API response ────────────────────
//   function registerMultiAllocation(multiSuggestion) {
//     multiSuggestion.assignments.forEach((assignment, idx) => {
//       const teamId   = assignment.team_id;
//       const rawCoords = assignment.route_coords;
//       if (!rawCoords || rawCoords.length < 2) return;

//       const coords   = getSimplifiedRoute(rawCoords);
//       const cumDists = buildCumulativeDistances(coords);
//       const totalM   = cumDists[cumDists.length - 1];

//       // Compute initial pos so RouteLayer can render immediately
//       const { pos, idx: posIdx } = interpolateAlongRoute(coords, cumDists, 0);

//       setActiveRoutes((prev) => ({
//         ...prev,
//         [teamId]: {
//           teamId,
//           teamName: assignment.team_name,
//           routeCoords: coords,
//           cumDists,
//           totalM,
//           travelledM: 0,
//           pos,
//           posIdx,
//           remainingKm: (totalM / 1000).toFixed(2),
//           remainingMin: (totalM / SIM_SPEED_MPS / 60).toFixed(1),
//           distanceKm: assignment.distance_km,
//           etaMinutes: assignment.eta_minutes,
//           incidentId: multiSuggestion.incident_id,
//           color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
//           progress: 0,
//           done: false,
//         },
//       }));

//       startAnimation(teamId);
//     });

//     setPanelTab("DISPATCH");
//   }

//   // ── filtered lists ────────────────────────────────────────────────────────
//   const filteredInc = useMemo(() => incidents
//     .filter((i) => sevTab === "ALL" || i.severity === sevTab)
//     .filter((i) => {
//       if (!incQuery.trim()) return true;
//       const q = incQuery.toLowerCase();
//       return String(i.id).toLowerCase().includes(q) ||
//         (i.user_id||"").toLowerCase().includes(q) ||
//         (i.address||"").toLowerCase().includes(q);
//     }), [incidents, sevTab, incQuery]);

//   const filteredTeams = useMemo(() => teams.filter((t) => {
//     if (!teamQuery.trim()) return true;
//     const q = teamQuery.toLowerCase();
//     return (t.name||"").toLowerCase().includes(q) ||
//       String(t.id).toLowerCase().includes(q) ||
//       (t.base||"").toLowerCase().includes(q);
//   }), [teams, teamQuery]);

//   useEffect(() => {
//     if (!selectedInc || !incListRef.current) return;
//     incListRef.current.querySelector(`[data-id="${selectedInc.id}"]`)
//       ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
//   }, [selectedInc]);

//   // ── facility drawer ───────────────────────────────────────────────────────
//   function openFacilityDrawer(team) {
//     setFacilityTarget(team);
//     setFacilityResults([]); setFacilityError(null);
//     setAssignedPlaceId(null); setCoordInput("");
//     setSearchMode("place"); setPlaceQuery("");
//     setPlaceMatches([]); setPlaceError(null); setSelectedPlace(null);
//     if (team.latitude && team.longitude) searchFacilities(team.latitude, team.longitude);
//   }

//   function closeFacilityDrawer() {
//     setFacilityTarget(null); setFacilityResults([]);
//     setFacilityError(null); setAssignedPlaceId(null);
//     setPlaceQuery(""); setPlaceMatches([]);
//     setPlaceError(null); setSelectedPlace(null);
//   }

//   async function searchFacilities(lat, lng) {
//     setFacilityLoading(true); setFacilityError(null); setFacilityResults([]);
//     try {
//       const results = await fetchNearbyFromOverpass(lat, lng);
//       if (!results.length) setFacilityError("No hospitals, schools or NGOs found within 5km.");
//       setFacilityResults(results);
//     } catch { setFacilityError("Couldn't reach Overpass API. Check your connection."); }
//     finally { setFacilityLoading(false); }
//   }

//   function handleCoordSubmit(e) {
//     e.preventDefault();
//     const parts = coordInput.split(",").map((s) => parseFloat(s.trim()));
//     if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
//       setFacilityError("Enter as: latitude, longitude (e.g. 19.0760, 72.8777)"); return;
//     }
//     searchFacilities(parts[0], parts[1]);
//   }

//   async function handlePlaceSubmit(e) {
//     e.preventDefault();
//     if (!placeQuery.trim()) { setPlaceError("Type a place name first."); return; }
//     setPlaceSearching(true); setPlaceError(null); setPlaceMatches([]); setSelectedPlace(null);
//     try {
//       const matches = await fetchPlaceMatchesFromNominatim(placeQuery.trim());
//       if (!matches.length) setPlaceError("No locations found. Try a more specific name.");
//       setPlaceMatches(matches);
//     } catch { setPlaceError("Couldn't reach place search. Check your connection."); }
//     finally { setPlaceSearching(false); }
//   }

//   function handleSelectPlaceMatch(match) {
//     setSelectedPlace(match); setPlaceMatches([]);
//     searchFacilities(match.latitude, match.longitude);
//   }

//   async function handleAssignFacility(facility) {
//     if (!facilityTarget) return;
//     setAssigningFacility(facility.place_id); setFacilityError(null);
//     try {
//       await api.assignTeamToFacility({
//         team_id: facilityTarget.id,
//         place_id: facility.place_id,
//         place_name: facility.place_name,
//         place_type: facility.place_type,
//         latitude: facility.latitude,
//         longitude: facility.longitude,
//       });
//       setAssignedPlaceId(facility.place_id);
//       setFacilityPins((prev) => ({ ...prev, [facilityTarget.id]: { ...facility, team_id: facilityTarget.id, team_name: facilityTarget.name } }));
//       loadTeams();
//     } catch { setFacilityError("Couldn't assign facility. Try again."); }
//     finally { setAssigningFacility(null); }
//   }

//   // ── map tiles ─────────────────────────────────────────────────────────────
//   const tileUrl = mapStyle === "light"
//     ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
//     : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
//   const tileAttr = mapStyle === "light"
//     ? '© <a href="https://carto.com">CARTO</a>'
//     : '© <a href="https://www.esri.com">Esri</a>';

//   const center = useMemo(() => {
//     if (!filteredInc.length) return [19.076, 72.8777];
//     const lat = filteredInc.reduce((s,i) => s + Number(i.latitude), 0) / filteredInc.length;
//     const lng = filteredInc.reduce((s,i) => s + Number(i.longitude), 0) / filteredInc.length;
//     return [lat, lng];
//   }, [incidents]);

//   const facilityPinList = Object.values(facilityPins);
//   const activeRouteList = Object.values(activeRoutes);

//   // ── render ────────────────────────────────────────────────────────────────
//   return (
//     <div style={S.shell}>

//       {/* ════ MAP ════ */}
//       <div style={S.mapPane}>
//         <div style={S.mapToolbar}>
//           <div style={S.mapTitle}>
//             <Radio size={13} color="#22c55e" />
//             <span style={S.mapTitleText}>LIVE MAP</span>
//             <span style={S.mapCount}>
//               {filteredInc.length} incidents · {facilityPinList.length} facilities
//               {activeRouteList.filter(r => !r.done).length > 0 &&
//                 ` · ${activeRouteList.filter(r => !r.done).length} en route`}
//             </span>
//           </div>
//           <button
//             style={{ ...S.iconBtn, ...(mapStyle === "satellite" ? S.iconBtnActive : {}) }}
//             onClick={() => setMapStyle(s => s === "light" ? "satellite" : "light")}
//             title="Toggle satellite"
//           >
//             <Layers size={14} />
//           </button>
//         </div>

//         {/* preferCanvas keeps polyline updates off the SVG DOM entirely */}
//         <MapContainer
//           center={center}
//           zoom={10}
//           style={{ width:"100%", height:"100%" }}
//           zoomControl={false}
//           preferCanvas={true}
//         >
//           <TileLayer url={tileUrl} attribution={tileAttr} />
//           <FlyTo target={flyTarget} />

//           {/* Incident pins */}
//           {filteredInc.map((inc) => (
//             <Marker
//               key={`inc-${inc.id}`}
//               position={[inc.latitude, inc.longitude]}
//               icon={makeIncidentIcon(inc.severity, inc.status, selectedInc?.id === inc.id)}
//               eventHandlers={{ click: () => { setSelectedInc(inc); setFlyTarget(inc); setPanelTab("INCIDENTS"); } }}
//             >
//               <Popup className="rakshak-popup">
//                 <div style={{ minWidth: 180, fontFamily: "monospace" }}>
//                   <div style={{ fontWeight:700, marginBottom:4, color: SEVERITY_COLOR[inc.severity] }}>
//                     #{String(inc.id).slice(0,8).toUpperCase()}
//                   </div>
//                   <div style={{ fontSize:12, color:"#475569", marginBottom:2 }}>{inc.user_id}</div>
//                   <div style={{ fontSize:11, color:"#94a3b8" }}>
//                     {inc.address || `${Number(inc.latitude).toFixed(4)}°N, ${Number(inc.longitude).toFixed(4)}°E`}
//                   </div>
//                   <div style={{ marginTop:6, display:"flex", gap:6 }}>
//                     <span style={{ background: SEVERITY_COLOR[inc.severity], color:"#fff", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:600 }}>{inc.severity}</span>
//                     <span style={{ background:"#f1f5f9", color:"#64748b", borderRadius:4, padding:"1px 6px", fontSize:10, border:"1px solid #e2e8f0" }}>{inc.status}</span>
//                   </div>
//                 </div>
//               </Popup>
//             </Marker>
//           ))}

//           {/* Static team pins (not currently moving) */}
//           {teams.filter(t => t.latitude && t.longitude && !activeRoutes[t.id]).map((t) => (
//             <Marker
//               key={`team-${t.id}`}
//               position={[t.latitude, t.longitude]}
//               icon={getCachedTeamIcon(t.status, selectedTeam?.id === t.id)}
//               eventHandlers={{ click: () => { setSelectedTeam(t); setFlyTarget(t); setPanelTab("TEAMS"); } }}
//             >
//               <Popup className="rakshak-popup">
//                 <div style={{ minWidth:160, fontFamily:"monospace" }}>
//                   <div style={{ fontWeight:700, marginBottom:3, color: TEAM_STATUS_COLOR[t.status] }}>{t.name}</div>
//                   <div style={{ fontSize:11, color:"#64748b" }}>{t.base || "Base unknown"}</div>
//                   <div style={{ marginTop:6 }}>
//                     <span style={{ background: TEAM_STATUS_COLOR[t.status], color:"#fff", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:600 }}>{t.status}</span>
//                   </div>
//                 </div>
//               </Popup>
//             </Marker>
//           ))}

//           {/* Facility pins */}
//           {facilityPinList.map((f) => (
//             <Marker
//               key={`fac-${f.place_id}`}
//               position={[f.latitude, f.longitude]}
//               icon={makeFacilityIcon(f.place_type)}
//             >
//               <Popup className="rakshak-popup">
//                 <div style={{ minWidth:160, fontFamily:"monospace" }}>
//                   <div style={{ fontWeight:700, marginBottom:3, color:"#0f172a" }}>{f.place_name}</div>
//                   <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>Base for: {f.team_name}</div>
//                   <span style={{ background: PLACE_TYPE_PILL[f.place_type] === "red" ? "#ef4444" : PLACE_TYPE_PILL[f.place_type] === "blue" ? "#3b82f6" : "#16a34a", color:"#fff", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:600 }}>
//                     {PLACE_TYPE_LABEL[f.place_type]}
//                   </span>
//                 </div>
//               </Popup>
//             </Marker>
//           ))}

//           {/* Route polylines + moving markers — each isolated in RouteLayer */}
//           {activeRouteList.map((route) => (
//             <RouteLayer key={`route-${route.teamId}`} route={route} />
//           ))}
//         </MapContainer>

//         {/* Legend */}
//         <div style={S.legend}>
//           {Object.entries(SEVERITY_COLOR).map(([sev, col]) => (
//             <div key={sev} style={S.legendItem}>
//               <span style={{ ...S.legendDot, background:col }} />
//               <span style={S.legendLabel}>{sev}</span>
//             </div>
//           ))}
//           <div style={{ ...S.legendItem, marginLeft:8, paddingLeft:8, borderLeft:"1px solid #e2e8f0" }}>
//             <span style={{ ...S.legendDot, borderRadius:2, background:"#16a34a" }} />
//             <span style={S.legendLabel}>TEAM</span>
//           </div>
//           <div style={S.legendItem}>
//             <span style={{ ...S.legendDot, background:"#ef4444", borderRadius:"50% 50% 50% 0", transform:"rotate(-45deg)" }} />
//             <span style={S.legendLabel}>FACILITY</span>
//           </div>
//           <div style={S.legendItem}>
//             <span style={{ ...S.legendDot, background:"#2563eb" }} />
//             <span style={S.legendLabel}>EN ROUTE</span>
//           </div>
//         </div>
//       </div>

//       {/* ════ RIGHT PANEL ════ */}
//       <div style={S.panel}>
//         <div style={S.panelHeader}>
//           <div>
//             <h2 style={S.panelTitle}>Map Coordination</h2>
//             <p style={S.panelSub}>Incidents · Teams · Dispatch</p>
//           </div>
//           <button style={S.refreshBtn} onClick={handleRefresh} disabled={refreshing} title="Refresh">
//             <RefreshCw size={14} style={refreshing ? { animation:"spin 1s linear infinite" } : {}} />
//           </button>
//         </div>

//         {/* Panel tabs */}
//         <div style={S.panelTabs}>
//           {PANEL_TABS.map((t) => (
//             <button
//               key={t}
//               style={{ ...S.panelTab, ...(panelTab === t ? S.panelTabActive : {}) }}
//               onClick={() => setPanelTab(t)}
//             >
//               {t === "INCIDENTS" && <Radio size={11} style={{ marginRight:4 }} />}
//               {t === "TEAMS" && <Users size={11} style={{ marginRight:4 }} />}
//               {t === "DISPATCH" && <Navigation size={11} style={{ marginRight:4 }} />}
//               {t}
//               {t === "DISPATCH" && activeRouteList.filter(r => !r.done).length > 0 && (
//                 <span style={{ marginLeft:4, background:"#2563eb", color:"#fff", borderRadius:"50%", fontSize:9, fontWeight:700, padding:"1px 5px" }}>
//                   {activeRouteList.filter(r => !r.done).length}
//                 </span>
//               )}
//             </button>
//           ))}
//         </div>

//         {/* ── INCIDENTS tab ── */}
//         {panelTab === "INCIDENTS" && (
//           <>
//             <div style={S.searchBox}>
//               <Search size={13} color="#94a3b8" />
//               <input style={S.searchInput} placeholder="Search ID, user, location…"
//                 value={incQuery} onChange={(e) => setIncQuery(e.target.value)} />
//             </div>
//             <div style={S.filterTabs}>
//               {FILTER_TABS.map((t) => (
//                 <button key={t} style={{ ...S.filterTab, ...(sevTab===t ? S.filterTabActive : {}) }} onClick={() => setSevTab(t)}>{t}</button>
//               ))}
//             </div>
//             <div style={S.list} ref={incListRef}>
//               {incLoading && <div style={S.empty}>Loading incidents…</div>}
//               {!incLoading && filteredInc.length === 0 && (
//                 <div style={S.empty}>
//                   <AlertTriangle size={20} color="#cbd5e1" style={{ marginBottom:6 }} />
//                   No incidents match this filter.
//                 </div>
//               )}
//               {filteredInc.map((inc) => {
//                 const isActive = selectedInc?.id === inc.id;
//                 return (
//                   <div key={inc.id} data-id={inc.id}
//                     style={{ ...S.card, ...(isActive ? S.cardActive : {}) }}
//                     onClick={() => { setSelectedInc(isActive ? null : inc); if (!isActive) setFlyTarget(inc); }}
//                   >
//                     <div style={S.cardRow}>
//                       <div style={S.cardLeft}>
//                         <span style={{ ...S.severityBar, background: SEVERITY_COLOR[inc.severity]||"#94a3b8" }} />
//                         <div>
//                           <div style={S.cardId}>#{String(inc.id).slice(0,8).toUpperCase()}</div>
//                           <div style={S.cardUser}>{inc.user_id}</div>
//                         </div>
//                       </div>
//                       <span style={{ ...S.pill, ...PILL[SEV_TONE[inc.severity]||"muted"] }}>{inc.severity}</span>
//                     </div>
//                     <div style={S.cardLocation}>
//                       {inc.address || (inc.latitude && `${Number(inc.latitude).toFixed(4)}° N, ${Number(inc.longitude).toFixed(4)}° E`) || "Location unknown"}
//                     </div>
//                     <div style={S.cardMeta}>
//                       <span style={{ ...S.pill, ...PILL[STAT_TONE[inc.status]||"muted"] }}>{inc.status}</span>
//                       <span style={S.cardTime}>{timeAgo(inc.created_at)}</span>
//                     </div>
//                     {isActive && inc.detail && <div style={S.cardDetail}>{inc.detail}</div>}
//                     {isActive && (
//                       <div style={S.cardScores}>
//                         {[["Trust", inc.trust_score], ["Risk", inc.risk_score], ["Priority", inc.priority]].map(([label, val]) => (
//                           <div key={label} style={S.scoreItem}>
//                             <span style={S.scoreLabel}>{label}</span>
//                             <span style={S.scoreVal}>{val ?? "—"}</span>
//                           </div>
//                         ))}
//                       </div>
//                     )}
//                     {isActive && inc.status === "VERIFIED" && (
//                       <DispatchButton
//                         incident={inc}
//                         onDispatched={registerMultiAllocation}
//                         onRefresh={() => { loadIncidents(); loadTeams(); }}
//                       />
//                     )}
//                   </div>
//                 );
//               })}
//             </div>
//           </>
//         )}

//         {/* ── TEAMS tab ── */}
//         {panelTab === "TEAMS" && (
//           <>
//             <div style={S.searchBox}>
//               <Search size={13} color="#94a3b8" />
//               <input style={S.searchInput} placeholder="Search name, ID, base…"
//                 value={teamQuery} onChange={(e) => setTeamQuery(e.target.value)} />
//             </div>
//             <div style={{ padding:"8px 16px 4px", fontSize:11, color:"#94a3b8", borderBottom:"1px solid #f1f5f9" }}>
//               {filteredTeams.length} teams · click a team to assign a base facility
//             </div>
//             <div style={S.list} ref={teamListRef}>
//               {filteredTeams.length === 0 && (
//                 <div style={S.empty}><Users size={20} color="#cbd5e1" style={{ marginBottom:6 }} />No teams found.</div>
//               )}
//               {filteredTeams.map((t) => {
//                 const isActive   = selectedTeam?.id === t.id;
//                 const hasFacility = !!facilityPins[t.id];
//                 const routeState  = activeRoutes[t.id];
//                 const isMoving    = !!routeState && !routeState.done;
//                 return (
//                   <div key={t.id}
//                     style={{ ...S.card, ...(isActive ? S.cardActive : {}) }}
//                     onClick={() => { setSelectedTeam(isActive ? null : t); if (t.latitude && t.longitude && !isActive) setFlyTarget(t); }}
//                   >
//                     <div style={S.cardRow}>
//                       <div style={S.cardLeft}>
//                         <span style={{ ...S.severityBar, background: TEAM_STATUS_COLOR[t.status]||"#94a3b8" }} />
//                         <div>
//                           <div style={S.cardId}>{String(t.id).slice(0,8).toUpperCase()}</div>
//                           <div style={S.cardUser}>{t.name}</div>
//                         </div>
//                       </div>
//                       <span style={{ ...S.pill, ...PILL[TEAM_STAT_TONE[t.status]||"muted"] }}>{t.status}</span>
//                     </div>
//                     <div style={S.cardLocation}>{t.base || "Base unknown"}</div>
//                     {hasFacility && (
//                       <div style={{ ...S.cardLocation, color:"#16a34a", display:"flex", alignItems:"center", gap:4 }}>
//                         <MapPin size={10} /> Facility: {facilityPins[t.id].place_name}
//                       </div>
//                     )}
//                     {isMoving && (
//                       <div style={{ marginTop:4, paddingLeft:11 }}>
//                         <div style={{ fontSize:10, color:"#2563eb", fontWeight:600, marginBottom:3 }}>
//                           EN ROUTE · {routeState.remainingKm} km · ~{routeState.remainingMin} min
//                         </div>
//                         <div style={{ background:"#e2e8f0", borderRadius:4, height:3, overflow:"hidden" }}>
//                           <div style={{ width:`${(routeState.progress*100).toFixed(1)}%`, height:"100%", background:"#2563eb", borderRadius:4 }} />
//                         </div>
//                       </div>
//                     )}
//                     {isActive && (
//                       <div style={{ paddingTop:8, borderTop:"1px solid #f1f5f9", marginTop:8 }}>
//                         <button
//                           style={S.assignBtn}
//                           onClick={(e) => { e.stopPropagation(); openFacilityDrawer(t); }}
//                         >
//                           <MapPin size={12} style={{ marginRight:5 }} />
//                           {hasFacility ? "Change base facility" : "Assign base facility"}
//                         </button>
//                       </div>
//                     )}
//                   </div>
//                 );
//               })}
//             </div>
//           </>
//         )}

//         {/* ── DISPATCH tab ── */}
//         {panelTab === "DISPATCH" && (
//           <div style={S.list}>
//             {activeRouteList.length === 0 && (
//               <div style={S.empty}>
//                 <Navigation size={20} color="#cbd5e1" style={{ marginBottom:6 }} />
//                 No active dispatches. Use A* Dispatch on a verified incident.
//               </div>
//             )}
//             {activeRouteList.map((route) => (
//               <div key={route.teamId} style={{ ...S.card, borderLeft:`3px solid ${route.color}` }}>
//                 <div style={S.cardRow}>
//                   <div style={S.cardLeft}>
//                     <div>
//                       <div style={{ fontSize:11, fontFamily:"monospace", fontWeight:700, color: route.color }}>
//                         {route.teamName}
//                       </div>
//                       <div style={{ fontSize:10, color:"#94a3b8", marginTop:1 }}>
//                         INC #{String(route.incidentId).slice(0,8).toUpperCase()}
//                       </div>
//                     </div>
//                   </div>
//                   <span style={{ ...S.pill, ...(route.done ? PILL.green : PILL.blue) }}>
//                     {route.done ? "ARRIVED" : "EN ROUTE"}
//                   </span>
//                 </div>

//                 <div style={{ display:"flex", gap:16, marginBottom:8 }}>
//                   <div style={S.scoreItem}>
//                     <span style={S.scoreLabel}>REMAINING</span>
//                     <span style={{ ...S.scoreVal, color: route.color }}>{route.done ? "0.00" : route.remainingKm} km</span>
//                   </div>
//                   <div style={S.scoreItem}>
//                     <span style={S.scoreLabel}>ETA</span>
//                     <span style={{ ...S.scoreVal, color: route.color }}>{route.done ? "0.0" : route.remainingMin} min</span>
//                   </div>
//                   <div style={S.scoreItem}>
//                     <span style={S.scoreLabel}>TOTAL</span>
//                     <span style={S.scoreVal}>{route.distanceKm} km</span>
//                   </div>
//                 </div>

//                 <div style={{ background:"#f1f5f9", borderRadius:4, height:6, overflow:"hidden", marginBottom:6 }}>
//                   <div style={{
//                     width: `${(route.progress * 100).toFixed(1)}%`,
//                     height: "100%",
//                     background: route.done ? "#16a34a" : route.color,
//                     borderRadius: 4,
//                     transition: "width 0.2s linear",
//                   }} />
//                 </div>
//                 <div style={{ fontSize:10, color:"#94a3b8", display:"flex", justifyContent:"space-between" }}>
//                   <span>Start</span>
//                   <span>{(route.progress * 100).toFixed(0)}%</span>
//                   <span>Incident</span>
//                 </div>

//                 {!route.done && route.pos && (
//                   <button
//                     style={{ ...S.assignBtn, marginTop:8 }}
//                     onClick={() => setFlyTarget({ latitude: route.pos[0], longitude: route.pos[1] })}
//                   >
//                     <Navigation size={12} style={{ marginRight:5 }} />
//                     Track on map
//                   </button>
//                 )}
//               </div>
//             ))}
//           </div>
//         )}
//       </div>

//       {/* ════ FACILITY DRAWER ════ */}
//       {facilityTarget && (
//         <div style={S.backdrop} onClick={closeFacilityDrawer}>
//           <div style={S.drawer} onClick={(e) => e.stopPropagation()}>
//             <div style={S.drawerHeader}>
//               <span style={{ fontFamily:"monospace", fontSize:12, color:"#94a3b8" }}>{facilityTarget.id}</span>
//               <button style={S.drawerClose} onClick={closeFacilityDrawer}><X size={16} /></button>
//             </div>
//             <h2 style={S.drawerTitle}>{facilityTarget.name}</h2>
//             <p style={S.drawerSub}>{facilityTarget.base || "Base unknown"}</p>

//             <h3 style={S.drawerSectionTitle}>SET BASE FACILITY</h3>
//             <p style={{ fontSize:12, color:"#64748b", marginBottom:14, lineHeight:1.5 }}>
//               Search for a nearby hospital, school, or NGO to pre-assign as this team's base.
//             </p>

//             {(!facilityTarget.latitude || !facilityTarget.longitude) && (
//               <>
//                 <div style={S.modeToggle}>
//                   {["place","coords"].map((mode) => (
//                     <button key={mode}
//                       style={{ ...S.modeBtn, ...(searchMode===mode ? S.modeBtnActive : {}) }}
//                       onClick={() => setSearchMode(mode)}
//                     >
//                       {mode === "place" ? "Search by place" : "Enter coordinates"}
//                     </button>
//                   ))}
//                 </div>

//                 {searchMode === "place" ? (
//                   <>
//                     <div style={S.searchRow}>
//                       <input style={S.drawerInput} placeholder="e.g. Bandra, Mumbai"
//                         value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)}
//                         onKeyDown={(e) => e.key === "Enter" && handlePlaceSubmit(e)} />
//                       <button style={S.drawerBtn} onClick={handlePlaceSubmit} disabled={placeSearching}>
//                         {placeSearching ? "…" : "Search"}
//                       </button>
//                     </div>
//                     {placeError && <div style={S.errorBanner}>{placeError}</div>}
//                     {placeSearching && (
//                       <div style={S.loadingRow}>
//                         <Loader size={14} style={{ animation:"spin 1s linear infinite" }} />
//                         <span>Looking up location…</span>
//                       </div>
//                     )}
//                     {placeMatches.length > 0 && (
//                       <div style={S.matchList}>
//                         {placeMatches.map((m) => (
//                           <div key={m.place_id} style={S.matchRow}>
//                             <div style={{ flex:1 }}>
//                               <div style={{ fontSize:12, color:"#1e293b", marginBottom:2 }}>{m.display_name}</div>
//                               <div style={{ fontSize:10, fontFamily:"monospace", color:"#94a3b8" }}>{m.latitude.toFixed(4)}, {m.longitude.toFixed(4)}</div>
//                             </div>
//                             <button style={S.drawerBtn} onClick={() => handleSelectPlaceMatch(m)}>Use</button>
//                           </div>
//                         ))}
//                       </div>
//                     )}
//                     {selectedPlace && (
//                       <div style={{ fontSize:11, color:"#64748b", marginBottom:8 }}>
//                         Showing facilities near: <span style={{ color:"#1e293b" }}>{selectedPlace.display_name}</span>
//                       </div>
//                     )}
//                   </>
//                 ) : (
//                   <div style={S.searchRow}>
//                     <input style={S.drawerInput} placeholder="lat, lng  e.g. 19.0760, 72.8777"
//                       value={coordInput} onChange={(e) => setCoordInput(e.target.value)}
//                       onKeyDown={(e) => e.key === "Enter" && handleCoordSubmit(e)} />
//                     <button style={S.drawerBtn} onClick={handleCoordSubmit} disabled={facilityLoading}>
//                       {facilityLoading ? "…" : "Search"}
//                     </button>
//                   </div>
//                 )}
//               </>
//             )}

//             {facilityTarget.latitude && facilityTarget.longitude && (
//               <div style={{ fontSize:11, color:"#64748b", marginBottom:10, fontFamily:"monospace" }}>
//                 Searching near team base: {Number(facilityTarget.latitude).toFixed(4)}, {Number(facilityTarget.longitude).toFixed(4)}
//               </div>
//             )}

//             {facilityError && <div style={S.errorBanner}>{facilityError}</div>}
//             {facilityLoading && (
//               <div style={S.loadingRow}>
//                 <Loader size={14} style={{ animation:"spin 1s linear infinite" }} />
//                 <span>Querying OpenStreetMap…</span>
//               </div>
//             )}
//             {assignedPlaceId && <div style={S.successBanner}>✓ Facility assigned — pin added to map.</div>}

//             {facilityResults.length > 0 && (
//               <div style={S.facilityList}>
//                 {facilityResults.map((f) => (
//                   <div key={f.place_id} style={{ ...S.facilityRow, ...(assignedPlaceId===f.place_id ? S.facilityRowAssigned : {}) }}>
//                     <div style={{ flex:1, minWidth:0 }}>
//                       <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
//                         <span style={{ ...S.pill, ...PILL[PLACE_TYPE_PILL[f.place_type]||"muted"], fontSize:9 }}>
//                           {PLACE_TYPE_LABEL[f.place_type]}
//                         </span>
//                         <span style={{ fontSize:12, color:"#1e293b", fontWeight:500 }}>{f.place_name}</span>
//                       </div>
//                       <div style={{ fontSize:10, fontFamily:"monospace", color:"#94a3b8" }}>{f.latitude.toFixed(4)}, {f.longitude.toFixed(4)}</div>
//                     </div>
//                     <button
//                       style={{ ...S.drawerBtn, ...(assignedPlaceId===f.place_id ? { background:"#dcfce7", color:"#16a34a", borderColor:"#bbf7d0" } : {}) }}
//                       disabled={!!assigningFacility || assignedPlaceId===f.place_id}
//                       onClick={() => handleAssignFacility(f)}
//                     >
//                       {assigningFacility===f.place_id ? "Saving…" : assignedPlaceId===f.place_id ? "✓ Set" : "Select"}
//                     </button>
//                   </div>
//                 ))}
//               </div>
//             )}
//           </div>
//         </div>
//       )}

//       <style>{`
//         @keyframes spin { to { transform: rotate(360deg); } }
//         .rakshak-popup .leaflet-popup-content-wrapper {
//           background:#ffffff; border:1px solid #e2e8f0; border-radius:10px;
//           box-shadow:0 4px 20px rgba(0,0,0,0.10); color:#1e293b;
//         }
//         .rakshak-popup .leaflet-popup-tip { background:#ffffff; }
//         .leaflet-popup-close-button { color:#94a3b8 !important; }
//       `}</style>
//     </div>
//   );
// }

// // ── DispatchButton ────────────────────────────────────────────────────────────
// // FIX 6: ref-based double-dispatch guard.
// // React batching means two clicks in the same event flush can both see
// // loading===false before the first setState fires. A ref is synchronous —
// // it's set before any await, so the second click sees it immediately.
// function DispatchButton({ incident, onDispatched, onRefresh }) {
//   const [nTeams, setNTeams]   = useState(2);
//   const [loading, setLoading] = useState(false);
//   const [error, setError]     = useState(null);
//   const [success, setSuccess] = useState(false);
//   const dispatchingRef        = useRef(false);  // synchronous guard

//   async function handleDispatch() {
//     if (dispatchingRef.current) return;  // blocks re-entrant calls synchronously
//     dispatchingRef.current = true;
//     setLoading(true); setError(null); setSuccess(false);
//     try {
//       const result = await api.allocateTeamsMulti(incident.id, nTeams);
//       setSuccess(true);
//       onDispatched(result);
//       onRefresh();
//     } catch (err) {
//       setError(err.data?.detail || "Dispatch failed. Ensure teams are assigned to nearby facilities.");
//     } finally {
//       setLoading(false);
//       dispatchingRef.current = false;
//     }
//   }

//   return (
//     <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #f1f5f9" }}>
//       <div style={{ fontSize:10, color:"#94a3b8", fontWeight:700, letterSpacing:"0.06em", marginBottom:6 }}>A* MULTI-TEAM DISPATCH</div>
//       <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:6 }}>
//         <span style={{ fontSize:11, color:"#64748b" }}>Teams:</span>
//         {[1,2,3,4].map(n => (
//           <button key={n}
//             style={{ ...S.filterTab, ...(nTeams===n ? S.filterTabActive : {}), padding:"2px 8px" }}
//             onClick={(e) => { e.stopPropagation(); setNTeams(n); }}
//           >{n}</button>
//         ))}
//       </div>
//       {error && <div style={{ ...S.cardDetail, color:"#dc2626", borderTop:"none", paddingTop:0, marginLeft:0 }}>{error}</div>}
//       {success && <div style={{ ...S.cardDetail, color:"#16a34a", borderTop:"none", paddingTop:0, marginLeft:0 }}>✓ {nTeams} team(s) dispatched — see Dispatch tab</div>}
//       <button
//         style={{ ...S.assignBtn, background: loading ? "#f1f5f9" : "#1e293b", color: loading ? "#94a3b8" : "#ffffff", marginTop:4 }}
//         disabled={loading}
//         onClick={(e) => { e.stopPropagation(); handleDispatch(); }}
//       >
//         {loading
//           ? <><Loader size={12} style={{ marginRight:5, animation:"spin 1s linear infinite" }} />Running A*…</>
//           : <><Navigation size={12} style={{ marginRight:5 }} />Dispatch {nTeams} Nearest Team{nTeams>1?"s":""}</>
//         }
//       </button>
//     </div>
//   );
// }

// // ── pill styles ───────────────────────────────────────────────────────────────
// const PILL = {
//   red:    { background:"rgba(239,68,68,0.10)",   color:"#dc2626", border:"1px solid rgba(239,68,68,0.25)"    },
//   orange: { background:"rgba(249,115,22,0.10)",  color:"#ea580c", border:"1px solid rgba(249,115,22,0.25)"   },
//   blue:   { background:"rgba(59,130,246,0.10)",  color:"#2563eb", border:"1px solid rgba(59,130,246,0.25)"   },
//   green:  { background:"rgba(34,197,94,0.10)",   color:"#16a34a", border:"1px solid rgba(34,197,94,0.25)"    },
//   muted:  { background:"rgba(100,116,139,0.10)", color:"#64748b", border:"1px solid rgba(100,116,139,0.25)"  },
// };

// // ── styles ────────────────────────────────────────────────────────────────────
// const S = {
//   shell:   { display:"flex", height:"100vh", width:"100%", background:"#f8fafc", overflow:"hidden", fontFamily:"'Inter',system-ui,sans-serif" },
//   mapPane: { flex:1, position:"relative", display:"flex", flexDirection:"column", minWidth:0 },
//   mapToolbar: { position:"absolute", top:12, left:12, right:12, zIndex:1000, display:"flex", justifyContent:"space-between", alignItems:"center", pointerEvents:"none" },
//   mapTitle: { display:"flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.92)", backdropFilter:"blur(8px)", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", boxShadow:"0 1px 6px rgba(0,0,0,0.08)", pointerEvents:"auto" },
//   mapTitleText: { fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"#1e293b" },
//   mapCount:     { fontSize:10, color:"#94a3b8", marginLeft:4 },
//   iconBtn: { background:"rgba(255,255,255,0.92)", backdropFilter:"blur(8px)", border:"1px solid #e2e8f0", borderRadius:8, color:"#64748b", padding:"6px 10px", cursor:"pointer", display:"flex", alignItems:"center", boxShadow:"0 1px 6px rgba(0,0,0,0.08)", pointerEvents:"auto", transition:"border-color 0.15s" },
//   iconBtnActive: { borderColor:"#3b82f6", color:"#2563eb" },
//   legend: { position:"absolute", bottom:16, left:12, zIndex:1000, display:"flex", gap:10, background:"rgba(255,255,255,0.92)", backdropFilter:"blur(8px)", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", boxShadow:"0 1px 6px rgba(0,0,0,0.08)", alignItems:"center" },
//   legendItem:  { display:"flex", alignItems:"center", gap:5 },
//   legendDot:   { width:8, height:8, borderRadius:"50%", flexShrink:0 },
//   legendLabel: { fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.05em" },
//   panel: { width:340, flexShrink:0, background:"#ffffff", borderLeft:"1px solid #e2e8f0", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"-2px 0 12px rgba(0,0,0,0.04)" },
//   panelHeader: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"20px 16px 14px", borderBottom:"1px solid #f1f5f9" },
//   panelTitle: { margin:0, fontSize:16, fontWeight:700, color:"#0f172a" },
//   panelSub:   { margin:"2px 0 0", fontSize:11, color:"#94a3b8" },
//   refreshBtn: { background:"transparent", border:"1px solid #e2e8f0", borderRadius:6, color:"#94a3b8", padding:"6px 8px", cursor:"pointer", display:"flex", alignItems:"center" },
//   panelTabs: { display:"flex", borderBottom:"1px solid #f1f5f9" },
//   panelTab: { flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:4, padding:"10px 0", fontSize:11, fontWeight:600, letterSpacing:"0.06em", background:"transparent", border:"none", color:"#94a3b8", cursor:"pointer", borderBottom:"2px solid transparent", transition:"all 0.15s" },
//   panelTabActive: { color:"#1e293b", borderBottomColor:"#1e293b" },
//   searchBox: { display:"flex", alignItems:"center", gap:8, margin:"12px 16px 0", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"7px 12px" },
//   searchInput: { flex:1, background:"transparent", border:"none", outline:"none", fontSize:12, color:"#1e293b", fontFamily:"inherit" },
//   filterTabs: { display:"flex", gap:4, padding:"8px 16px", borderBottom:"1px solid #f1f5f9", overflowX:"auto", scrollbarWidth:"none" },
//   filterTab: { background:"transparent", border:"1px solid #e2e8f0", borderRadius:6, color:"#94a3b8", fontSize:10, fontWeight:600, letterSpacing:"0.06em", padding:"3px 8px", cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.15s" },
//   filterTabActive: { background:"#f1f5f9", borderColor:"#cbd5e1", color:"#1e293b" },
//   list: { flex:1, overflowY:"auto", padding:"8px 12px 16px", scrollbarWidth:"thin", scrollbarColor:"#e2e8f0 transparent" },
//   empty: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"48px 0", fontSize:13, color:"#94a3b8", textAlign:"center" },
//   card: { background:"#ffffff", border:"1px solid #f1f5f9", borderRadius:10, padding:"10px 12px", marginBottom:8, cursor:"pointer", transition:"border-color 0.15s, box-shadow 0.15s", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" },
//   cardActive: { borderColor:"#e2e8f0", boxShadow:"0 2px 10px rgba(0,0,0,0.08)", background:"#fafbfd" },
//   cardRow: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 },
//   cardLeft: { display:"flex", alignItems:"flex-start", gap:8 },
//   severityBar: { width:3, height:32, borderRadius:2, marginTop:2, flexShrink:0 },
//   cardId:       { fontSize:11, fontFamily:"monospace", fontWeight:700, color:"#94a3b8", letterSpacing:"0.04em" },
//   cardUser:     { fontSize:12, color:"#1e293b", fontWeight:500, marginTop:2 },
//   cardLocation: { fontSize:11, color:"#94a3b8", marginBottom:6, paddingLeft:11 },
//   cardMeta: { display:"flex", justifyContent:"space-between", alignItems:"center", paddingLeft:11 },
//   cardTime: { fontSize:10, color:"#cbd5e1", fontFamily:"monospace" },
//   pill: { display:"inline-block", fontSize:10, fontWeight:600, letterSpacing:"0.05em", borderRadius:4, padding:"2px 7px" },
//   cardDetail: { marginTop:10, marginLeft:11, fontSize:12, color:"#64748b", lineHeight:1.6, borderTop:"1px solid #f1f5f9", paddingTop:8 },
//   cardScores: { display:"flex", gap:16, marginTop:10, marginLeft:11, paddingTop:8, borderTop:"1px solid #f1f5f9" },
//   scoreItem: { display:"flex", flexDirection:"column", gap:2 },
//   scoreLabel: { fontSize:10, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.06em" },
//   scoreVal:   { fontSize:14, fontFamily:"monospace", fontWeight:700, color:"#0f172a" },
//   assignBtn: { display:"flex", alignItems:"center", width:"100%", justifyContent:"center", padding:"7px 0", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:7, fontSize:12, color:"#1e293b", fontWeight:600, cursor:"pointer" },
//   backdrop: { position:"fixed", inset:0, background:"rgba(15,23,42,0.25)", zIndex:2000, display:"flex", justifyContent:"flex-end" },
//   drawer: { width:380, background:"#ffffff", height:"100%", overflowY:"auto", padding:"24px 20px", boxShadow:"-4px 0 24px rgba(0,0,0,0.10)" },
//   drawerHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 },
//   drawerClose: { background:"transparent", border:"none", color:"#94a3b8", cursor:"pointer", display:"flex", alignItems:"center", padding:4 },
//   drawerTitle: { margin:"0 0 2px", fontSize:18, fontWeight:700, color:"#0f172a" },
//   drawerSub:   { margin:"0 0 16px", fontSize:12, color:"#64748b" },
//   drawerSectionTitle: { fontSize:11, fontWeight:700, letterSpacing:"0.08em", color:"#94a3b8", margin:"0 0 8px" },
//   modeToggle: { display:"flex", gap:6, marginBottom:12 },
//   modeBtn: { flex:1, padding:"6px 0", fontSize:11, fontWeight:600, border:"1px solid #e2e8f0", borderRadius:6, background:"transparent", color:"#64748b", cursor:"pointer" },
//   modeBtnActive: { background:"#f1f5f9", borderColor:"#cbd5e1", color:"#1e293b" },
//   searchRow: { display:"flex", gap:8, marginBottom:10 },
//   drawerInput: { flex:1, padding:"7px 10px", border:"1px solid #e2e8f0", borderRadius:7, fontSize:12, color:"#1e293b", outline:"none", background:"#f8fafc" },
//   drawerBtn: { padding:"7px 14px", background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:7, fontSize:11, fontWeight:600, color:"#1e293b", cursor:"pointer", whiteSpace:"nowrap" },
//   errorBanner:   { background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:7, padding:"8px 12px", fontSize:12, color:"#dc2626", marginBottom:10 },
//   successBanner: { background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:7, padding:"8px 12px", fontSize:12, color:"#16a34a", marginBottom:10 },
//   loadingRow: { display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#64748b", padding:"8px 0" },
//   matchList: { display:"flex", flexDirection:"column", gap:6, marginBottom:10 },
//   matchRow: { display:"flex", alignItems:"flex-start", gap:10, padding:"8px 10px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8 },
//   facilityList: { display:"flex", flexDirection:"column", gap:6, marginTop:10 },
//   facilityRow: { display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8 },
//   facilityRowAssigned: { background:"#f0fdf4", borderColor:"#bbf7d0" },
// };

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Search, Radio, AlertTriangle, Layers, RefreshCw, Users, X, Loader, MapPin, Navigation } from "lucide-react";
import { api } from "../lib/api";
import "leaflet/dist/leaflet.css";

// ── constants ─────────────────────────────────────────────────────────────────
const SEVERITY_COLOR = { CRITICAL: "#ef4444", HIGH: "#f97316", MODERATE: "#3b82f6", LOW: "#6b7280" };
const STATUS_RING    = { PENDING: "#f97316", VERIFIED: "#3b82f6", DISPATCHED: "#22c55e", RESOLVED: "#6b7280" };
const TEAM_STATUS_COLOR = { AVAILABLE: "#16a34a", DEPLOYED: "#2563eb", MAINTENANCE: "#94a3b8", OFFLINE: "#ef4444" };
const PLACE_TYPE_PILL = { hospital: "red", school: "blue", ngo: "green" };
const PLACE_TYPE_LABEL = { hospital: "Hospital", school: "School", ngo: "NGO / Social" };

// ── OSM helpers ───────────────────────────────────────────────────────────────
// Multiple mirrors tried in order — the original single kumi.systems mirror
// was flaky/overloaded and 504ing. This tries a more stable one first, then
// falls back automatically. Same function signature/behavior as before, so
// nothing else in this file needs to change.
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

// In-memory cache keyed by rounded lat/lng so re-opening the drawer for the
// same team doesn't re-hit Overpass. Cleared on full page reload only.
const overpassCache = new Map();

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Animation speed: meters per second (simulated ~30 km/h)
const SIM_SPEED_MPS = 8;

// Only re-render React state this often (ms) — 10x/sec prevents freeze
const RENDER_INTERVAL_MS = 100;

function parseOverpassElements(data) {
  const TYPE_MAP = {
    hospital: "hospital", clinic: "hospital",
    school: "school", college: "school",
    social_facility: "ngo", community_centre: "ngo",
  };
  const seen = new Set();
  return data.elements.map((el) => {
    const amenity = el.tags?.amenity || "";
    const place_type = TYPE_MAP[amenity];
    if (!place_type) return null;
    const elLat = el.type === "way" ? el.center?.lat : el.lat;
    const elLng = el.type === "way" ? el.center?.lon : el.lon;
    if (!elLat || !elLng) return null;
    const place_id = `osm:${el.type}:${el.id}`;
    if (seen.has(place_id)) return null;
    seen.add(place_id);
    return { place_id, place_name: el.tags?.name || amenity.replace("_", " "), place_type, latitude: elLat, longitude: elLng };
  }).filter(Boolean);
}

async function fetchNearbyFromOverpass(lat, lng) {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (overpassCache.has(cacheKey)) return overpassCache.get(cacheKey);

  const query = `
[out:json][timeout:10];
(
  node["amenity"~"hospital|clinic|school|college|social_facility|community_centre"](around:5000,${lat},${lng});
  way["amenity"~"hospital|clinic|school|college|social_facility|community_centre"](around:5000,${lat},${lng});
);
out center 30;`;

  let lastError;
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        body: new URLSearchParams({ data: query }),
        headers: { "User-Agent": "Rakshak-DisasterResponse/2.0" },
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) throw new Error(`Overpass mirror ${url} returned ${res.status}`);
      const data = await res.json();
      const results = parseOverpassElements(data);
      overpassCache.set(cacheKey, results);
      return results;
    } catch (err) {
      console.warn(`Overpass mirror failed: ${url}`, err);
      lastError = err;
      continue;
    }
  }
  throw lastError || new Error("Overpass failed");
}

async function fetchPlaceMatchesFromNominatim(placeName) {
  const url = `${NOMINATIM_URL}?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(placeName)}`;
  const res = await fetch(url, { headers: { "User-Agent": "Rakshak-DisasterResponse/2.0" } });
  if (!res.ok) throw new Error("Nominatim failed");
  const data = await res.json();
  return data.map((r) => ({
    place_id: `nominatim:${r.place_id}`,
    display_name: r.display_name,
    latitude: parseFloat(r.lat),
    longitude: parseFloat(r.lon),
  }));
}

// ── haversine (metres) ────────────────────────────────────────────────────────
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Build cumulative distances along a polyline (metres)
function buildCumulativeDistances(coords) {
  const dists = [0];
  for (let i = 1; i < coords.length; i++) {
    const d = haversineM(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    dists.push(dists[i - 1] + d);
  }
  return dists;
}

// ── FIX 1: Binary search replaces linear O(n) scan ───────────────────────────
// Previously this was a for-loop scanning every point from the start.
// With 150-point routes at 10 ticks/sec × multiple teams, that O(n) cost
// was compounding into a freeze. Binary search cuts it to O(log n).
// Returns { pos: [lat, lng], idx: number } so callers can also get the index
// for cheap array slicing in RouteLayer without a second scan.
function interpolateAlongRoute(coords, cumDists, travelledM) {
  const total = cumDists[cumDists.length - 1];
  const clamped = Math.min(travelledM, total);

  // Binary search for the segment containing clamped distance
  let lo = 0, hi = cumDists.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumDists[mid] < clamped) lo = mid; else hi = mid;
  }

  const seg = cumDists[hi] - cumDists[lo];
  const t = seg === 0 ? 0 : (clamped - cumDists[lo]) / seg;
  const lat = coords[lo][0] + t * (coords[hi][0] - coords[lo][0]);
  const lng = coords[lo][1] + t * (coords[hi][1] - coords[lo][1]);
  return { pos: [lat, lng], idx: lo };
}

// ── ROUTE SIMPLIFICATION (Ramer–Douglas–Peucker) ─────────────────────────────
function perpendicularDistanceM(point, lineStart, lineEnd) {
  const latRef = (lineStart[0] + lineEnd[0]) / 2;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((latRef * Math.PI) / 180);

  const x  = point[1]     * mPerDegLng, y  = point[0]     * mPerDegLat;
  const x1 = lineStart[1] * mPerDegLng, y1 = lineStart[0] * mPerDegLat;
  const x2 = lineEnd[1]   * mPerDegLng, y2 = lineEnd[0]   * mPerDegLat;

  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(x - x1, y - y1);

  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
  const projX = x1 + t * dx, projY = y1 + t * dy;
  return Math.hypot(x - projX, y - projY);
}

function simplifyRouteRDP(coords, toleranceM) {
  if (coords.length <= 2) return coords;

  function rdp(points) {
    if (points.length <= 2) return points;
    const [start, end] = [points[0], points[points.length - 1]];
    let maxDist = -1, maxIdx = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const d = perpendicularDistanceM(points[i], start, end);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }
    if (maxDist > toleranceM) {
      const left  = rdp(points.slice(0, maxIdx + 1));
      const right = rdp(points.slice(maxIdx));
      return [...left.slice(0, -1), ...right];
    }
    return [start, end];
  }

  return rdp(coords);
}

const MAX_ROUTE_POINTS = 150;
function getSimplifiedRoute(coords) {
  if (!coords || coords.length <= MAX_ROUTE_POINTS) return coords;

  let tolerance = 8;
  let simplified = simplifyRouteRDP(coords, tolerance);

  let attempts = 0;
  while (simplified.length > MAX_ROUTE_POINTS && attempts < 6) {
    tolerance *= 2;
    simplified = simplifyRouteRDP(coords, tolerance);
    attempts++;
  }
  return simplified;
}

// ── icon factories ────────────────────────────────────────────────────────────
function makeIncidentIcon(severity, status, isSelected) {
  const fill  = SEVERITY_COLOR[severity] || "#6b7280";
  const ring  = STATUS_RING[status]      || "#6b7280";
  const scale = isSelected ? 1.4 : 1;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${36*scale}" height="${44*scale}" viewBox="0 0 36 44">
      <circle cx="18" cy="18" r="16" fill="${ring}" opacity="0.2"/>
      <circle cx="18" cy="18" r="11" fill="${fill}" stroke="#ffffff" stroke-width="2"/>
      ${isSelected ? `<circle cx="18" cy="18" r="16" fill="none" stroke="${fill}" stroke-width="2" stroke-dasharray="4 3" opacity="0.9"/>` : ""}
      <line x1="18" y1="29" x2="18" y2="43" stroke="${fill}" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [36*scale,44*scale], iconAnchor: [18*scale,43*scale], popupAnchor: [0,-(44*scale)] });
}

function makeTeamIcon(status, isSelected) {
  const col   = TEAM_STATUS_COLOR[status] || "#6b7280";
  const scale = isSelected ? 1.3 : 1;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${32*scale}" height="${32*scale}" viewBox="0 0 32 32">
      <rect x="2" y="2" width="28" height="28" rx="6" fill="${col}" opacity="0.15" stroke="${col}" stroke-width="1.5"/>
      <rect x="7" y="7" width="18" height="18" rx="3" fill="${col}" stroke="#ffffff" stroke-width="1.5"/>
      ${isSelected ? `<rect x="2" y="2" width="28" height="28" rx="6" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="4 3"/>` : ""}
    </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [32*scale,32*scale], iconAnchor: [16*scale,16*scale], popupAnchor: [0,-(18*scale)] });
}

function makeMovingTeamIcon(teamName) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="16" fill="#2563eb" opacity="0.15"/>
      <circle cx="18" cy="18" r="10" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
      <circle cx="18" cy="18" r="16" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.7">
        <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="3s" repeatCount="indefinite"/>
      </circle>
    </svg>`;
  return L.divIcon({
    html: `<div style="position:relative">
      ${svg}
      <div style="position:absolute;top:38px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(37,99,235,0.9);color:#fff;font-size:9px;font-weight:700;padding:2px 5px;border-radius:3px;font-family:monospace">${teamName}</div>
    </div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function makeFacilityIcon(place_type) {
  const COL = { hospital: "#ef4444", school: "#3b82f6", ngo: "#16a34a" };
  const col = COL[place_type] || "#6b7280";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
      <path d="M14 2C8.477 2 4 6.477 4 12c0 7.5 10 22 10 22s10-14.5 10-22c0-5.523-4.477-10-10-10z"
            fill="${col}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="14" cy="12" r="4" fill="#ffffff"/>
    </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [28,36], iconAnchor: [14,35], popupAnchor: [0,-36] });
}

// ── FIX 2: Icon caches — prevent L.divIcon() DOM teardown on every render ─────
// Moving team icons: built once per team name, never rebuilt.
const movingIconCache = {};
function getMovingTeamIcon(teamName) {
  if (!movingIconCache[teamName]) movingIconCache[teamName] = makeMovingTeamIcon(teamName);
  return movingIconCache[teamName];
}

// Arrived/deployed team icons: built once per status+selected combo.
const teamIconCache = {};
function getCachedTeamIcon(status, isSelected) {
  const key = `${status}-${isSelected}`;
  if (!teamIconCache[key]) teamIconCache[key] = makeTeamIcon(status, isSelected);
  return teamIconCache[key];
}

// ── fly-to helper ─────────────────────────────────────────────────────────────
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.latitude, target.longitude], 14, { duration: 1 });
  }, [target]);
  return null;
}

// ── helpers ───────────────────────────────────────────────────────────────────
const SEV_TONE  = { CRITICAL: "red", HIGH: "orange", MODERATE: "blue", LOW: "muted" };
const STAT_TONE = { PENDING: "orange", VERIFIED: "blue", DISPATCHED: "green", RESOLVED: "green" };

function timeAgo(iso) {
  try {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    return `${Math.floor(diff/3600)}h ago`;
  } catch { return ""; }
}

const FILTER_TABS    = ["ALL","CRITICAL","HIGH","MODERATE","LOW"];
const PANEL_TABS     = ["INCIDENTS","TEAMS","DISPATCH"];
const TEAM_STAT_TONE = { AVAILABLE: "green", DEPLOYED: "blue", MAINTENANCE: "muted", OFFLINE: "red" };

const ROUTE_COLORS = ["#2563eb","#16a34a","#dc2626","#d97706","#7c3aed","#0891b2"];

// ── RouteLayer — isolated + memoized per-route rendering ──────────────────────
// FIX 3: RouteLayer now receives precomputed `pos` and `posIdx` from state,
// eliminating ALL math from the render path. The only work here is array
// slicing (O(1) index lookup) and Leaflet position updates.
// Using React.memo with a custom comparator so it only re-renders when the
// fields that actually affect visuals change — not on every parent render.
const RouteLayer = React.memo(function RouteLayer({ route }) {
  // pos and posIdx are now precomputed in the animation engine (see tick()),
  // so this component does zero interpolation work itself.
  const { pos, posIdx, routeCoords, done, color, teamName, remainingKm, remainingMin, progress } = route;

  // FIX 4: Slice uses precomputed posIdx — O(1) lookup, no scan needed.
  const aheadCoords = useMemo(() => {
    if (done || !pos || posIdx == null) return [];
    return [pos, ...routeCoords.slice(posIdx + 1)];
  }, [done, pos, posIdx, routeCoords]);

  const behindCoords = useMemo(() => {
    if (!pos || posIdx == null) return [];
    return [...routeCoords.slice(0, posIdx + 1), pos];
  }, [pos, posIdx, routeCoords]);

  // Icons are stable references from cache — Leaflet never tears down the DOM node.
  const movingIcon  = useMemo(() => getMovingTeamIcon(teamName), [teamName]);
  const arrivedIcon = useMemo(() => getCachedTeamIcon("DEPLOYED", false), []);

  if (!pos) return null;

  return (
    <>
      {/* Travelled portion — solid, faded */}
      {behindCoords.length >= 2 && (
        <Polyline
          positions={behindCoords}
          pathOptions={{ color, weight: 4, opacity: 0.45 }}
        />
      )}
      {/* Ahead portion — dashed */}
      {aheadCoords.length >= 2 && (
        <Polyline
          positions={aheadCoords}
          pathOptions={{ color, weight: 3, opacity: 0.9, dashArray: "8 5" }}
        />
      )}
      {/* Moving team marker */}
      {!done && (
        <Marker position={pos} icon={movingIcon}>
          <Popup className="rakshak-popup">
            <div style={{ minWidth:160, fontFamily:"monospace" }}>
              <div style={{ fontWeight:700, marginBottom:4, color:"#2563eb" }}>{teamName}</div>
              <div style={{ fontSize:11, color:"#64748b", marginBottom:2 }}>EN ROUTE</div>
              <div style={{ fontSize:12, color:"#1e293b" }}>{remainingKm} km remaining</div>
              <div style={{ fontSize:12, color:"#1e293b" }}>ETA ~{remainingMin} min</div>
              <div style={{ marginTop:6, background:"#f1f5f9", borderRadius:4, height:4, overflow:"hidden" }}>
                <div style={{ width:`${(progress*100).toFixed(1)}%`, height:"100%", background:"#2563eb", borderRadius:4, transition:"width 0.3s" }} />
              </div>
            </div>
          </Popup>
        </Marker>
      )}
      {/* Arrived marker */}
      {done && (
        <Marker position={pos} icon={arrivedIcon}>
          <Popup className="rakshak-popup">
            <div style={{ minWidth:140, fontFamily:"monospace" }}>
              <div style={{ fontWeight:700, color:"#16a34a", marginBottom:3 }}>{teamName}</div>
              <div style={{ fontSize:11 }}>✓ Arrived at incident</div>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}, (prev, next) => {
  // Custom comparator: only re-render if visually meaningful fields changed.
  // This prevents re-renders caused by unrelated parent state updates.
  const r1 = prev.route, r2 = next.route;
  return (
    r1.pos === r2.pos &&
    r1.posIdx === r2.posIdx &&
    r1.done === r2.done &&
    r1.progress === r2.progress &&
    r1.remainingKm === r2.remainingKm &&
    r1.remainingMin === r2.remainingMin &&
    r1.routeCoords === r2.routeCoords
  );
});

// ── main ──────────────────────────────────────────────────────────────────────
export default function MapCoordination() {
  const [mapStyle, setMapStyle]   = useState("light");
  const [flyTarget, setFlyTarget] = useState(null);

  const [incidents, setIncidents] = useState([]);
  const [incLoading, setIncLoading] = useState(true);
  const [selectedInc, setSelectedInc] = useState(null);
  const [sevTab, setSevTab]       = useState("ALL");
  const [incQuery, setIncQuery]   = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [teams, setTeams]         = useState([]);
  const [teamQuery, setTeamQuery] = useState("");
  const [selectedTeam, setSelectedTeam] = useState(null);

  const [facilityPins, setFacilityPins] = useState({});
  const [panelTab, setPanelTab]   = useState("INCIDENTS");

  const [facilityTarget, setFacilityTarget]     = useState(null);
  const [facilityResults, setFacilityResults]   = useState([]);
  const [facilityLoading, setFacilityLoading]   = useState(false);
  const [facilityError, setFacilityError]       = useState(null);
  const [assigningFacility, setAssigningFacility] = useState(null);
  const [assignedPlaceId, setAssignedPlaceId]   = useState(null);
  const [searchMode, setSearchMode]             = useState("place");
  const [coordInput, setCoordInput]             = useState("");
  const [placeQuery, setPlaceQuery]             = useState("");
  const [placeMatches, setPlaceMatches]         = useState([]);
  const [placeSearching, setPlaceSearching]     = useState(false);
  const [placeError, setPlaceError]             = useState(null);
  const [selectedPlace, setSelectedPlace]       = useState(null);

  // activeRoutes shape: { [teamId]: { teamName, routeCoords, cumDists, totalM,
  //   travelledM, pos, posIdx, remainingKm, remainingMin, distanceKm,
  //   etaMinutes, incidentId, color, progress, done } }
  const [activeRoutes, setActiveRoutes] = useState({});

  const animFrameRef  = useRef({});  // { teamId: rAF id }
  const lastTsRef     = useRef({});  // { teamId: timestamp }
  const lastRenderRef = useRef({});  // { teamId: timestamp } — throttle
  const animGenRef    = useRef({});  // { teamId: generation } — stale loop guard

  const incListRef  = useRef(null);
  const teamListRef = useRef(null);

  // ── data loading ──────────────────────────────────────────────────────────
  async function loadIncidents() {
    try {
      const data = await api.getIncidents();
      setIncidents(data.filter((i) => i.latitude && i.longitude && i.status !== "REJECTED"));
    } catch (e) { console.error(e); }
    finally { setIncLoading(false); }
  }

  async function loadTeams() {
    try { setTeams(await api.getTeams()); }
    catch (e) { console.error(e); }
  }

  useEffect(() => { loadIncidents(); loadTeams(); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadIncidents(), loadTeams()]);
    setRefreshing(false);
  }

  // ── FIX 5: ANIMATION ENGINE — all fixes applied ───────────────────────────
  //
  // Key changes vs original:
  //
  // (a) cancelAnimationFrame BEFORE bumping generation. In the original, the
  //     gen bump happened first. If the old tick() had already been queued by
  //     the time cancelAnimationFrame ran, it would see the new gen, pass the
  //     stale-guard, and run as a phantom second loop. Cancelling first
  //     guarantees the old frame never fires.
  //
  // (b) interpolateAlongRoute (binary search) is called INSIDE the tick, and
  //     its result (pos + posIdx) is stored directly in state. RouteLayer reads
  //     these precomputed values — it does zero math itself.
  //
  // (c) The shouldRender throttle now also guards the setActiveRoutes call,
  //     not just the rAF reschedule. This means React's reconciler only runs
  //     ~10x/sec regardless of monitor refresh rate.
  const startAnimation = useCallback((teamId) => {
    // (a) Cancel old frame FIRST, then bump generation
    if (animFrameRef.current[teamId]) {
      cancelAnimationFrame(animFrameRef.current[teamId]);
      animFrameRef.current[teamId] = null;
    }

    const myGen = (animGenRef.current[teamId] || 0) + 1;
    animGenRef.current[teamId] = myGen;

    lastTsRef.current[teamId]     = performance.now();
    lastRenderRef.current[teamId] = performance.now();

    function tick(now) {
      // Stale loop guard
      if (animGenRef.current[teamId] !== myGen) return;

      const dt = (now - lastTsRef.current[teamId]) / 1000;
      lastTsRef.current[teamId] = now;

      const shouldRender = (now - (lastRenderRef.current[teamId] || 0)) >= RENDER_INTERVAL_MS;

      if (!shouldRender) {
        // Not time to render yet — reschedule without touching state at all.
        // This is cheaper than calling setActiveRoutes with an unchanged value.
        animFrameRef.current[teamId] = requestAnimationFrame(tick);
        return;
      }

      lastRenderRef.current[teamId] = now;

      setActiveRoutes((prev) => {
        const route = prev[teamId];
        if (!route || route.done) return prev;

        const newTravelled = route.travelledM + SIM_SPEED_MPS * dt;
        const done = newTravelled >= route.totalM;
        const travelledM = done ? route.totalM : newTravelled;

        // (b) Precompute position + index here so RouteLayer does zero work
        const { pos, idx: posIdx } = interpolateAlongRoute(
          route.routeCoords,
          route.cumDists,
          travelledM
        );

        const remainingM   = Math.max(0, route.totalM - travelledM);
        const remainingMin = (remainingM / SIM_SPEED_MPS / 60);

        if (!done) {
          animFrameRef.current[teamId] = requestAnimationFrame(tick);
        }

        return {
          ...prev,
          [teamId]: {
            ...route,
            travelledM,
            pos,
            posIdx,
            remainingKm: (remainingM / 1000).toFixed(2),
            remainingMin: remainingMin.toFixed(1),
            progress: travelledM / route.totalM,
            done,
          },
        };
      });
    }

    animFrameRef.current[teamId] = requestAnimationFrame(tick);
  }, []);

  // Clean up all animation frames on unmount
  useEffect(() => {
    return () => {
      Object.values(animFrameRef.current).forEach((id) => {
        if (id) cancelAnimationFrame(id);
      });
    };
  }, []);

  // ── Register routes from multi-allocation API response ────────────────────
  function registerMultiAllocation(multiSuggestion) {
    multiSuggestion.assignments.forEach((assignment, idx) => {
      const teamId   = assignment.team_id;
      const rawCoords = assignment.route_coords;
      if (!rawCoords || rawCoords.length < 2) return;

      const coords   = getSimplifiedRoute(rawCoords);
      const cumDists = buildCumulativeDistances(coords);
      const totalM   = cumDists[cumDists.length - 1];

      // Compute initial pos so RouteLayer can render immediately
      const { pos, idx: posIdx } = interpolateAlongRoute(coords, cumDists, 0);

      setActiveRoutes((prev) => ({
        ...prev,
        [teamId]: {
          teamId,
          teamName: assignment.team_name,
          routeCoords: coords,
          cumDists,
          totalM,
          travelledM: 0,
          pos,
          posIdx,
          remainingKm: (totalM / 1000).toFixed(2),
          remainingMin: (totalM / SIM_SPEED_MPS / 60).toFixed(1),
          distanceKm: assignment.distance_km,
          etaMinutes: assignment.eta_minutes,
          incidentId: multiSuggestion.incident_id,
          color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
          progress: 0,
          done: false,
        },
      }));

      startAnimation(teamId);
    });

    setPanelTab("DISPATCH");
  }

  // ── filtered lists ────────────────────────────────────────────────────────
  const filteredInc = useMemo(() => incidents
    .filter((i) => sevTab === "ALL" || i.severity === sevTab)
    .filter((i) => {
      if (!incQuery.trim()) return true;
      const q = incQuery.toLowerCase();
      return String(i.id).toLowerCase().includes(q) ||
        (i.user_id||"").toLowerCase().includes(q) ||
        (i.address||"").toLowerCase().includes(q);
    }), [incidents, sevTab, incQuery]);

  const filteredTeams = useMemo(() => teams.filter((t) => {
    if (!teamQuery.trim()) return true;
    const q = teamQuery.toLowerCase();
    return (t.name||"").toLowerCase().includes(q) ||
      String(t.id).toLowerCase().includes(q) ||
      (t.base||"").toLowerCase().includes(q);
  }), [teams, teamQuery]);

  useEffect(() => {
    if (!selectedInc || !incListRef.current) return;
    incListRef.current.querySelector(`[data-id="${selectedInc.id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedInc]);

  // ── facility drawer ───────────────────────────────────────────────────────
  function openFacilityDrawer(team) {
    setFacilityTarget(team);
    setFacilityResults([]); setFacilityError(null);
    setAssignedPlaceId(null); setCoordInput("");
    setSearchMode("place"); setPlaceQuery("");
    setPlaceMatches([]); setPlaceError(null); setSelectedPlace(null);
    if (team.latitude && team.longitude) searchFacilities(team.latitude, team.longitude);
  }

  function closeFacilityDrawer() {
    setFacilityTarget(null); setFacilityResults([]);
    setFacilityError(null); setAssignedPlaceId(null);
    setPlaceQuery(""); setPlaceMatches([]);
    setPlaceError(null); setSelectedPlace(null);
  }

  async function searchFacilities(lat, lng) {
    setFacilityLoading(true); setFacilityError(null); setFacilityResults([]);
    try {
      const results = await fetchNearbyFromOverpass(lat, lng);
      if (!results.length) setFacilityError("No hospitals, schools or NGOs found within 5km.");
      setFacilityResults(results);
    } catch { setFacilityError("Couldn't reach Overpass API. Check your connection."); }
    finally { setFacilityLoading(false); }
  }

  function handleCoordSubmit(e) {
    e.preventDefault();
    const parts = coordInput.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      setFacilityError("Enter as: latitude, longitude (e.g. 19.0760, 72.8777)"); return;
    }
    searchFacilities(parts[0], parts[1]);
  }

  async function handlePlaceSubmit(e) {
    e.preventDefault();
    if (!placeQuery.trim()) { setPlaceError("Type a place name first."); return; }
    setPlaceSearching(true); setPlaceError(null); setPlaceMatches([]); setSelectedPlace(null);
    try {
      const matches = await fetchPlaceMatchesFromNominatim(placeQuery.trim());
      if (!matches.length) setPlaceError("No locations found. Try a more specific name.");
      setPlaceMatches(matches);
    } catch { setPlaceError("Couldn't reach place search. Check your connection."); }
    finally { setPlaceSearching(false); }
  }

  function handleSelectPlaceMatch(match) {
    setSelectedPlace(match); setPlaceMatches([]);
    searchFacilities(match.latitude, match.longitude);
  }

  async function handleAssignFacility(facility) {
    if (!facilityTarget) return;
    setAssigningFacility(facility.place_id); setFacilityError(null);
    try {
      await api.assignTeamToFacility({
        team_id: facilityTarget.id,
        place_id: facility.place_id,
        place_name: facility.place_name,
        place_type: facility.place_type,
        latitude: facility.latitude,
        longitude: facility.longitude,
      });
      setAssignedPlaceId(facility.place_id);
      setFacilityPins((prev) => ({ ...prev, [facilityTarget.id]: { ...facility, team_id: facilityTarget.id, team_name: facilityTarget.name } }));
      loadTeams();
    } catch { setFacilityError("Couldn't assign facility. Try again."); }
    finally { setAssigningFacility(null); }
  }

  // ── map tiles ─────────────────────────────────────────────────────────────
  const tileUrl = mapStyle === "light"
    ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
    : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const tileAttr = mapStyle === "light"
    ? '© <a href="https://carto.com">CARTO</a>'
    : '© <a href="https://www.esri.com">Esri</a>';

  const center = useMemo(() => {
    if (!filteredInc.length) return [19.076, 72.8777];
    const lat = filteredInc.reduce((s,i) => s + Number(i.latitude), 0) / filteredInc.length;
    const lng = filteredInc.reduce((s,i) => s + Number(i.longitude), 0) / filteredInc.length;
    return [lat, lng];
  }, [incidents]);

  const facilityPinList = Object.values(facilityPins);
  const activeRouteList = Object.values(activeRoutes);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={S.shell}>

      {/* ════ MAP ════ */}
      <div style={S.mapPane}>
        <div style={S.mapToolbar}>
          <div style={S.mapTitle}>
            <Radio size={13} color="#22c55e" />
            <span style={S.mapTitleText}>LIVE MAP</span>
            <span style={S.mapCount}>
              {filteredInc.length} incidents · {facilityPinList.length} facilities
              {activeRouteList.filter(r => !r.done).length > 0 &&
                ` · ${activeRouteList.filter(r => !r.done).length} en route`}
            </span>
          </div>
          <button
            style={{ ...S.iconBtn, ...(mapStyle === "satellite" ? S.iconBtnActive : {}) }}
            onClick={() => setMapStyle(s => s === "light" ? "satellite" : "light")}
            title="Toggle satellite"
          >
            <Layers size={14} />
          </button>
        </div>

        {/* preferCanvas keeps polyline updates off the SVG DOM entirely */}
        <MapContainer
          center={center}
          zoom={10}
          style={{ width:"100%", height:"100%" }}
          zoomControl={false}
          preferCanvas={true}
        >
          <TileLayer url={tileUrl} attribution={tileAttr} />
          <FlyTo target={flyTarget} />

          {/* Incident pins */}
          {filteredInc.map((inc) => (
            <Marker
              key={`inc-${inc.id}`}
              position={[inc.latitude, inc.longitude]}
              icon={makeIncidentIcon(inc.severity, inc.status, selectedInc?.id === inc.id)}
              eventHandlers={{ click: () => { setSelectedInc(inc); setFlyTarget(inc); setPanelTab("INCIDENTS"); } }}
            >
              <Popup className="rakshak-popup">
                <div style={{ minWidth: 180, fontFamily: "monospace" }}>
                  <div style={{ fontWeight:700, marginBottom:4, color: SEVERITY_COLOR[inc.severity] }}>
                    #{String(inc.id).slice(0,8).toUpperCase()}
                  </div>
                  <div style={{ fontSize:12, color:"#475569", marginBottom:2 }}>{inc.user_id}</div>
                  <div style={{ fontSize:11, color:"#94a3b8" }}>
                    {inc.address || `${Number(inc.latitude).toFixed(4)}°N, ${Number(inc.longitude).toFixed(4)}°E`}
                  </div>
                  <div style={{ marginTop:6, display:"flex", gap:6 }}>
                    <span style={{ background: SEVERITY_COLOR[inc.severity], color:"#fff", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:600 }}>{inc.severity}</span>
                    <span style={{ background:"#f1f5f9", color:"#64748b", borderRadius:4, padding:"1px 6px", fontSize:10, border:"1px solid #e2e8f0" }}>{inc.status}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Static team pins (not currently moving) */}
          {teams.filter(t => t.latitude && t.longitude && !activeRoutes[t.id]).map((t) => (
            <Marker
              key={`team-${t.id}`}
              position={[t.latitude, t.longitude]}
              icon={getCachedTeamIcon(t.status, selectedTeam?.id === t.id)}
              eventHandlers={{ click: () => { setSelectedTeam(t); setFlyTarget(t); setPanelTab("TEAMS"); } }}
            >
              <Popup className="rakshak-popup">
                <div style={{ minWidth:160, fontFamily:"monospace" }}>
                  <div style={{ fontWeight:700, marginBottom:3, color: TEAM_STATUS_COLOR[t.status] }}>{t.name}</div>
                  <div style={{ fontSize:11, color:"#64748b" }}>{t.base || "Base unknown"}</div>
                  <div style={{ marginTop:6 }}>
                    <span style={{ background: TEAM_STATUS_COLOR[t.status], color:"#fff", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:600 }}>{t.status}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Facility pins */}
          {facilityPinList.map((f) => (
            <Marker
              key={`fac-${f.place_id}`}
              position={[f.latitude, f.longitude]}
              icon={makeFacilityIcon(f.place_type)}
            >
              <Popup className="rakshak-popup">
                <div style={{ minWidth:160, fontFamily:"monospace" }}>
                  <div style={{ fontWeight:700, marginBottom:3, color:"#0f172a" }}>{f.place_name}</div>
                  <div style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>Base for: {f.team_name}</div>
                  <span style={{ background: PLACE_TYPE_PILL[f.place_type] === "red" ? "#ef4444" : PLACE_TYPE_PILL[f.place_type] === "blue" ? "#3b82f6" : "#16a34a", color:"#fff", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:600 }}>
                    {PLACE_TYPE_LABEL[f.place_type]}
                  </span>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Route polylines + moving markers — each isolated in RouteLayer */}
          {activeRouteList.map((route) => (
            <RouteLayer key={`route-${route.teamId}`} route={route} />
          ))}
        </MapContainer>

        {/* Legend */}
        <div style={S.legend}>
          {Object.entries(SEVERITY_COLOR).map(([sev, col]) => (
            <div key={sev} style={S.legendItem}>
              <span style={{ ...S.legendDot, background:col }} />
              <span style={S.legendLabel}>{sev}</span>
            </div>
          ))}
          <div style={{ ...S.legendItem, marginLeft:8, paddingLeft:8, borderLeft:"1px solid #e2e8f0" }}>
            <span style={{ ...S.legendDot, borderRadius:2, background:"#16a34a" }} />
            <span style={S.legendLabel}>TEAM</span>
          </div>
          <div style={S.legendItem}>
            <span style={{ ...S.legendDot, background:"#ef4444", borderRadius:"50% 50% 50% 0", transform:"rotate(-45deg)" }} />
            <span style={S.legendLabel}>FACILITY</span>
          </div>
          <div style={S.legendItem}>
            <span style={{ ...S.legendDot, background:"#2563eb" }} />
            <span style={S.legendLabel}>EN ROUTE</span>
          </div>
        </div>
      </div>

      {/* ════ RIGHT PANEL ════ */}
      <div style={S.panel}>
        <div style={S.panelHeader}>
          <div>
            <h2 style={S.panelTitle}>Map Coordination</h2>
            <p style={S.panelSub}>Incidents · Teams · Dispatch</p>
          </div>
          <button style={S.refreshBtn} onClick={handleRefresh} disabled={refreshing} title="Refresh">
            <RefreshCw size={14} style={refreshing ? { animation:"spin 1s linear infinite" } : {}} />
          </button>
        </div>

        {/* Panel tabs */}
        <div style={S.panelTabs}>
          {PANEL_TABS.map((t) => (
            <button
              key={t}
              style={{ ...S.panelTab, ...(panelTab === t ? S.panelTabActive : {}) }}
              onClick={() => setPanelTab(t)}
            >
              {t === "INCIDENTS" && <Radio size={11} style={{ marginRight:4 }} />}
              {t === "TEAMS" && <Users size={11} style={{ marginRight:4 }} />}
              {t === "DISPATCH" && <Navigation size={11} style={{ marginRight:4 }} />}
              {t}
              {t === "DISPATCH" && activeRouteList.filter(r => !r.done).length > 0 && (
                <span style={{ marginLeft:4, background:"#2563eb", color:"#fff", borderRadius:"50%", fontSize:9, fontWeight:700, padding:"1px 5px" }}>
                  {activeRouteList.filter(r => !r.done).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── INCIDENTS tab ── */}
        {panelTab === "INCIDENTS" && (
          <>
            <div style={S.searchBox}>
              <Search size={13} color="#94a3b8" />
              <input style={S.searchInput} placeholder="Search ID, user, location…"
                value={incQuery} onChange={(e) => setIncQuery(e.target.value)} />
            </div>
            <div style={S.filterTabs}>
              {FILTER_TABS.map((t) => (
                <button key={t} style={{ ...S.filterTab, ...(sevTab===t ? S.filterTabActive : {}) }} onClick={() => setSevTab(t)}>{t}</button>
              ))}
            </div>
            <div style={S.list} ref={incListRef}>
              {incLoading && <div style={S.empty}>Loading incidents…</div>}
              {!incLoading && filteredInc.length === 0 && (
                <div style={S.empty}>
                  <AlertTriangle size={20} color="#cbd5e1" style={{ marginBottom:6 }} />
                  No incidents match this filter.
                </div>
              )}
              {filteredInc.map((inc) => {
                const isActive = selectedInc?.id === inc.id;
                return (
                  <div key={inc.id} data-id={inc.id}
                    style={{ ...S.card, ...(isActive ? S.cardActive : {}) }}
                    onClick={() => { setSelectedInc(isActive ? null : inc); if (!isActive) setFlyTarget(inc); }}
                  >
                    <div style={S.cardRow}>
                      <div style={S.cardLeft}>
                        <span style={{ ...S.severityBar, background: SEVERITY_COLOR[inc.severity]||"#94a3b8" }} />
                        <div>
                          <div style={S.cardId}>#{String(inc.id).slice(0,8).toUpperCase()}</div>
                          <div style={S.cardUser}>{inc.user_id}</div>
                        </div>
                      </div>
                      <span style={{ ...S.pill, ...PILL[SEV_TONE[inc.severity]||"muted"] }}>{inc.severity}</span>
                    </div>
                    <div style={S.cardLocation}>
                      {inc.address || (inc.latitude && `${Number(inc.latitude).toFixed(4)}° N, ${Number(inc.longitude).toFixed(4)}° E`) || "Location unknown"}
                    </div>
                    <div style={S.cardMeta}>
                      <span style={{ ...S.pill, ...PILL[STAT_TONE[inc.status]||"muted"] }}>{inc.status}</span>
                      <span style={S.cardTime}>{timeAgo(inc.created_at)}</span>
                    </div>
                    {isActive && inc.detail && <div style={S.cardDetail}>{inc.detail}</div>}
                    {isActive && (
                      <div style={S.cardScores}>
                        {[["Trust", inc.trust_score], ["Risk", inc.risk_score], ["Priority", inc.priority]].map(([label, val]) => (
                          <div key={label} style={S.scoreItem}>
                            <span style={S.scoreLabel}>{label}</span>
                            <span style={S.scoreVal}>{val ?? "—"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {isActive && inc.status === "VERIFIED" && (
                      <DispatchButton
                        incident={inc}
                        onDispatched={registerMultiAllocation}
                        onRefresh={() => { loadIncidents(); loadTeams(); }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── TEAMS tab ── */}
        {panelTab === "TEAMS" && (
          <>
            <div style={S.searchBox}>
              <Search size={13} color="#94a3b8" />
              <input style={S.searchInput} placeholder="Search name, ID, base…"
                value={teamQuery} onChange={(e) => setTeamQuery(e.target.value)} />
            </div>
            <div style={{ padding:"8px 16px 4px", fontSize:11, color:"#94a3b8", borderBottom:"1px solid #f1f5f9" }}>
              {filteredTeams.length} teams · click a team to assign a base facility
            </div>
            <div style={S.list} ref={teamListRef}>
              {filteredTeams.length === 0 && (
                <div style={S.empty}><Users size={20} color="#cbd5e1" style={{ marginBottom:6 }} />No teams found.</div>
              )}
              {filteredTeams.map((t) => {
                const isActive   = selectedTeam?.id === t.id;
                const hasFacility = !!facilityPins[t.id];
                const routeState  = activeRoutes[t.id];
                const isMoving    = !!routeState && !routeState.done;
                return (
                  <div key={t.id}
                    style={{ ...S.card, ...(isActive ? S.cardActive : {}) }}
                    onClick={() => { setSelectedTeam(isActive ? null : t); if (t.latitude && t.longitude && !isActive) setFlyTarget(t); }}
                  >
                    <div style={S.cardRow}>
                      <div style={S.cardLeft}>
                        <span style={{ ...S.severityBar, background: TEAM_STATUS_COLOR[t.status]||"#94a3b8" }} />
                        <div>
                          <div style={S.cardId}>{String(t.id).slice(0,8).toUpperCase()}</div>
                          <div style={S.cardUser}>{t.name}</div>
                        </div>
                      </div>
                      <span style={{ ...S.pill, ...PILL[TEAM_STAT_TONE[t.status]||"muted"] }}>{t.status}</span>
                    </div>
                    <div style={S.cardLocation}>{t.base || "Base unknown"}</div>
                    {hasFacility && (
                      <div style={{ ...S.cardLocation, color:"#16a34a", display:"flex", alignItems:"center", gap:4 }}>
                        <MapPin size={10} /> Facility: {facilityPins[t.id].place_name}
                      </div>
                    )}
                    {isMoving && (
                      <div style={{ marginTop:4, paddingLeft:11 }}>
                        <div style={{ fontSize:10, color:"#2563eb", fontWeight:600, marginBottom:3 }}>
                          EN ROUTE · {routeState.remainingKm} km · ~{routeState.remainingMin} min
                        </div>
                        <div style={{ background:"#e2e8f0", borderRadius:4, height:3, overflow:"hidden" }}>
                          <div style={{ width:`${(routeState.progress*100).toFixed(1)}%`, height:"100%", background:"#2563eb", borderRadius:4 }} />
                        </div>
                      </div>
                    )}
                    {isActive && (
                      <div style={{ paddingTop:8, borderTop:"1px solid #f1f5f9", marginTop:8 }}>
                        <button
                          style={S.assignBtn}
                          onClick={(e) => { e.stopPropagation(); openFacilityDrawer(t); }}
                        >
                          <MapPin size={12} style={{ marginRight:5 }} />
                          {hasFacility ? "Change base facility" : "Assign base facility"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── DISPATCH tab ── */}
        {panelTab === "DISPATCH" && (
          <div style={S.list}>
            {activeRouteList.length === 0 && (
              <div style={S.empty}>
                <Navigation size={20} color="#cbd5e1" style={{ marginBottom:6 }} />
                No active dispatches. Use A* Dispatch on a verified incident.
              </div>
            )}
            {activeRouteList.map((route) => (
              <div key={route.teamId} style={{ ...S.card, borderLeft:`3px solid ${route.color}` }}>
                <div style={S.cardRow}>
                  <div style={S.cardLeft}>
                    <div>
                      <div style={{ fontSize:11, fontFamily:"monospace", fontWeight:700, color: route.color }}>
                        {route.teamName}
                      </div>
                      <div style={{ fontSize:10, color:"#94a3b8", marginTop:1 }}>
                        INC #{String(route.incidentId).slice(0,8).toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <span style={{ ...S.pill, ...(route.done ? PILL.green : PILL.blue) }}>
                    {route.done ? "ARRIVED" : "EN ROUTE"}
                  </span>
                </div>

                <div style={{ display:"flex", gap:16, marginBottom:8 }}>
                  <div style={S.scoreItem}>
                    <span style={S.scoreLabel}>REMAINING</span>
                    <span style={{ ...S.scoreVal, color: route.color }}>{route.done ? "0.00" : route.remainingKm} km</span>
                  </div>
                  <div style={S.scoreItem}>
                    <span style={S.scoreLabel}>ETA</span>
                    <span style={{ ...S.scoreVal, color: route.color }}>{route.done ? "0.0" : route.remainingMin} min</span>
                  </div>
                  <div style={S.scoreItem}>
                    <span style={S.scoreLabel}>TOTAL</span>
                    <span style={S.scoreVal}>{route.distanceKm} km</span>
                  </div>
                </div>

                <div style={{ background:"#f1f5f9", borderRadius:4, height:6, overflow:"hidden", marginBottom:6 }}>
                  <div style={{
                    width: `${(route.progress * 100).toFixed(1)}%`,
                    height: "100%",
                    background: route.done ? "#16a34a" : route.color,
                    borderRadius: 4,
                    transition: "width 0.2s linear",
                  }} />
                </div>
                <div style={{ fontSize:10, color:"#94a3b8", display:"flex", justifyContent:"space-between" }}>
                  <span>Start</span>
                  <span>{(route.progress * 100).toFixed(0)}%</span>
                  <span>Incident</span>
                </div>

                {!route.done && route.pos && (
                  <button
                    style={{ ...S.assignBtn, marginTop:8 }}
                    onClick={() => setFlyTarget({ latitude: route.pos[0], longitude: route.pos[1] })}
                  >
                    <Navigation size={12} style={{ marginRight:5 }} />
                    Track on map
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════ FACILITY DRAWER ════ */}
      {facilityTarget && (
        <div style={S.backdrop} onClick={closeFacilityDrawer}>
          <div style={S.drawer} onClick={(e) => e.stopPropagation()}>
            <div style={S.drawerHeader}>
              <span style={{ fontFamily:"monospace", fontSize:12, color:"#94a3b8" }}>{facilityTarget.id}</span>
              <button style={S.drawerClose} onClick={closeFacilityDrawer}><X size={16} /></button>
            </div>
            <h2 style={S.drawerTitle}>{facilityTarget.name}</h2>
            <p style={S.drawerSub}>{facilityTarget.base || "Base unknown"}</p>

            <h3 style={S.drawerSectionTitle}>SET BASE FACILITY</h3>
            <p style={{ fontSize:12, color:"#64748b", marginBottom:14, lineHeight:1.5 }}>
              Search for a nearby hospital, school, or NGO to pre-assign as this team's base.
            </p>

            {(!facilityTarget.latitude || !facilityTarget.longitude) && (
              <>
                <div style={S.modeToggle}>
                  {["place","coords"].map((mode) => (
                    <button key={mode}
                      style={{ ...S.modeBtn, ...(searchMode===mode ? S.modeBtnActive : {}) }}
                      onClick={() => setSearchMode(mode)}
                    >
                      {mode === "place" ? "Search by place" : "Enter coordinates"}
                    </button>
                  ))}
                </div>

                {searchMode === "place" ? (
                  <>
                    <div style={S.searchRow}>
                      <input style={S.drawerInput} placeholder="e.g. Bandra, Mumbai"
                        value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePlaceSubmit(e)} />
                      <button style={S.drawerBtn} onClick={handlePlaceSubmit} disabled={placeSearching}>
                        {placeSearching ? "…" : "Search"}
                      </button>
                    </div>
                    {placeError && <div style={S.errorBanner}>{placeError}</div>}
                    {placeSearching && (
                      <div style={S.loadingRow}>
                        <Loader size={14} style={{ animation:"spin 1s linear infinite" }} />
                        <span>Looking up location…</span>
                      </div>
                    )}
                    {placeMatches.length > 0 && (
                      <div style={S.matchList}>
                        {placeMatches.map((m) => (
                          <div key={m.place_id} style={S.matchRow}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:12, color:"#1e293b", marginBottom:2 }}>{m.display_name}</div>
                              <div style={{ fontSize:10, fontFamily:"monospace", color:"#94a3b8" }}>{m.latitude.toFixed(4)}, {m.longitude.toFixed(4)}</div>
                            </div>
                            <button style={S.drawerBtn} onClick={() => handleSelectPlaceMatch(m)}>Use</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedPlace && (
                      <div style={{ fontSize:11, color:"#64748b", marginBottom:8 }}>
                        Showing facilities near: <span style={{ color:"#1e293b" }}>{selectedPlace.display_name}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={S.searchRow}>
                    <input style={S.drawerInput} placeholder="lat, lng  e.g. 19.0760, 72.8777"
                      value={coordInput} onChange={(e) => setCoordInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCoordSubmit(e)} />
                    <button style={S.drawerBtn} onClick={handleCoordSubmit} disabled={facilityLoading}>
                      {facilityLoading ? "…" : "Search"}
                    </button>
                  </div>
                )}
              </>
            )}

            {facilityTarget.latitude && facilityTarget.longitude && (
              <div style={{ fontSize:11, color:"#64748b", marginBottom:10, fontFamily:"monospace" }}>
                Searching near team base: {Number(facilityTarget.latitude).toFixed(4)}, {Number(facilityTarget.longitude).toFixed(4)}
              </div>
            )}

            {facilityError && <div style={S.errorBanner}>{facilityError}</div>}
            {facilityLoading && (
              <div style={S.loadingRow}>
                <Loader size={14} style={{ animation:"spin 1s linear infinite" }} />
                <span>Querying OpenStreetMap…</span>
              </div>
            )}
            {assignedPlaceId && <div style={S.successBanner}>✓ Facility assigned — pin added to map.</div>}

            {facilityResults.length > 0 && (
              <div style={S.facilityList}>
                {facilityResults.map((f) => (
                  <div key={f.place_id} style={{ ...S.facilityRow, ...(assignedPlaceId===f.place_id ? S.facilityRowAssigned : {}) }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                        <span style={{ ...S.pill, ...PILL[PLACE_TYPE_PILL[f.place_type]||"muted"], fontSize:9 }}>
                          {PLACE_TYPE_LABEL[f.place_type]}
                        </span>
                        <span style={{ fontSize:12, color:"#1e293b", fontWeight:500 }}>{f.place_name}</span>
                      </div>
                      <div style={{ fontSize:10, fontFamily:"monospace", color:"#94a3b8" }}>{f.latitude.toFixed(4)}, {f.longitude.toFixed(4)}</div>
                    </div>
                    <button
                      style={{ ...S.drawerBtn, ...(assignedPlaceId===f.place_id ? { background:"#dcfce7", color:"#16a34a", borderColor:"#bbf7d0" } : {}) }}
                      disabled={!!assigningFacility || assignedPlaceId===f.place_id}
                      onClick={() => handleAssignFacility(f)}
                    >
                      {assigningFacility===f.place_id ? "Saving…" : assignedPlaceId===f.place_id ? "✓ Set" : "Select"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .rakshak-popup .leaflet-popup-content-wrapper {
          background:#ffffff; border:1px solid #e2e8f0; border-radius:10px;
          box-shadow:0 4px 20px rgba(0,0,0,0.10); color:#1e293b;
        }
        .rakshak-popup .leaflet-popup-tip { background:#ffffff; }
        .leaflet-popup-close-button { color:#94a3b8 !important; }
      `}</style>
    </div>
  );
}

// ── DispatchButton ────────────────────────────────────────────────────────────
// FIX 6: ref-based double-dispatch guard.
// React batching means two clicks in the same event flush can both see
// loading===false before the first setState fires. A ref is synchronous —
// it's set before any await, so the second click sees it immediately.
function DispatchButton({ incident, onDispatched, onRefresh }) {
  const [nTeams, setNTeams]   = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [success, setSuccess] = useState(false);
  const dispatchingRef        = useRef(false);  // synchronous guard

  async function handleDispatch() {
    if (dispatchingRef.current) return;  // blocks re-entrant calls synchronously
    dispatchingRef.current = true;
    setLoading(true); setError(null); setSuccess(false);
    try {
      const result = await api.allocateTeamsMulti(incident.id, nTeams);
      setSuccess(true);
      onDispatched(result);
      onRefresh();
    } catch (err) {
      setError(err.data?.detail || "Dispatch failed. Ensure teams are assigned to nearby facilities.");
    } finally {
      setLoading(false);
      dispatchingRef.current = false;
    }
  }

  return (
    <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #f1f5f9" }}>
      <div style={{ fontSize:10, color:"#94a3b8", fontWeight:700, letterSpacing:"0.06em", marginBottom:6 }}>A* MULTI-TEAM DISPATCH</div>
      <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:6 }}>
        <span style={{ fontSize:11, color:"#64748b" }}>Teams:</span>
        {[1,2,3,4].map(n => (
          <button key={n}
            style={{ ...S.filterTab, ...(nTeams===n ? S.filterTabActive : {}), padding:"2px 8px" }}
            onClick={(e) => { e.stopPropagation(); setNTeams(n); }}
          >{n}</button>
        ))}
      </div>
      {error && <div style={{ ...S.cardDetail, color:"#dc2626", borderTop:"none", paddingTop:0, marginLeft:0 }}>{error}</div>}
      {success && <div style={{ ...S.cardDetail, color:"#16a34a", borderTop:"none", paddingTop:0, marginLeft:0 }}>✓ {nTeams} team(s) dispatched — see Dispatch tab</div>}
      <button
        style={{ ...S.assignBtn, background: loading ? "#f1f5f9" : "#1e293b", color: loading ? "#94a3b8" : "#ffffff", marginTop:4 }}
        disabled={loading}
        onClick={(e) => { e.stopPropagation(); handleDispatch(); }}
      >
        {loading
          ? <><Loader size={12} style={{ marginRight:5, animation:"spin 1s linear infinite" }} />Running A*…</>
          : <><Navigation size={12} style={{ marginRight:5 }} />Dispatch {nTeams} Nearest Team{nTeams>1?"s":""}</>
        }
      </button>
    </div>
  );
}

// ── pill styles ───────────────────────────────────────────────────────────────
const PILL = {
  red:    { background:"rgba(239,68,68,0.10)",   color:"#dc2626", border:"1px solid rgba(239,68,68,0.25)"    },
  orange: { background:"rgba(249,115,22,0.10)",  color:"#ea580c", border:"1px solid rgba(249,115,22,0.25)"   },
  blue:   { background:"rgba(59,130,246,0.10)",  color:"#2563eb", border:"1px solid rgba(59,130,246,0.25)"   },
  green:  { background:"rgba(34,197,94,0.10)",   color:"#16a34a", border:"1px solid rgba(34,197,94,0.25)"    },
  muted:  { background:"rgba(100,116,139,0.10)", color:"#64748b", border:"1px solid rgba(100,116,139,0.25)"  },
};

// ── styles ────────────────────────────────────────────────────────────────────
const S = {
  shell:   { display:"flex", height:"100vh", width:"100%", background:"#f8fafc", overflow:"hidden", fontFamily:"'Inter',system-ui,sans-serif" },
  mapPane: { flex:1, position:"relative", display:"flex", flexDirection:"column", minWidth:0 },
  mapToolbar: { position:"absolute", top:12, left:12, right:12, zIndex:1000, display:"flex", justifyContent:"space-between", alignItems:"center", pointerEvents:"none" },
  mapTitle: { display:"flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.92)", backdropFilter:"blur(8px)", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", boxShadow:"0 1px 6px rgba(0,0,0,0.08)", pointerEvents:"auto" },
  mapTitleText: { fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"#1e293b" },
  mapCount:     { fontSize:10, color:"#94a3b8", marginLeft:4 },
  iconBtn: { background:"rgba(255,255,255,0.92)", backdropFilter:"blur(8px)", border:"1px solid #e2e8f0", borderRadius:8, color:"#64748b", padding:"6px 10px", cursor:"pointer", display:"flex", alignItems:"center", boxShadow:"0 1px 6px rgba(0,0,0,0.08)", pointerEvents:"auto", transition:"border-color 0.15s" },
  iconBtnActive: { borderColor:"#3b82f6", color:"#2563eb" },
  legend: { position:"absolute", bottom:16, left:12, zIndex:1000, display:"flex", gap:10, background:"rgba(255,255,255,0.92)", backdropFilter:"blur(8px)", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", boxShadow:"0 1px 6px rgba(0,0,0,0.08)", alignItems:"center" },
  legendItem:  { display:"flex", alignItems:"center", gap:5 },
  legendDot:   { width:8, height:8, borderRadius:"50%", flexShrink:0 },
  legendLabel: { fontSize:10, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.05em" },
  panel: { width:340, flexShrink:0, background:"#ffffff", borderLeft:"1px solid #e2e8f0", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"-2px 0 12px rgba(0,0,0,0.04)" },
  panelHeader: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"20px 16px 14px", borderBottom:"1px solid #f1f5f9" },
  panelTitle: { margin:0, fontSize:16, fontWeight:700, color:"#0f172a" },
  panelSub:   { margin:"2px 0 0", fontSize:11, color:"#94a3b8" },
  refreshBtn: { background:"transparent", border:"1px solid #e2e8f0", borderRadius:6, color:"#94a3b8", padding:"6px 8px", cursor:"pointer", display:"flex", alignItems:"center" },
  panelTabs: { display:"flex", borderBottom:"1px solid #f1f5f9" },
  panelTab: { flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:4, padding:"10px 0", fontSize:11, fontWeight:600, letterSpacing:"0.06em", background:"transparent", border:"none", color:"#94a3b8", cursor:"pointer", borderBottom:"2px solid transparent", transition:"all 0.15s" },
  panelTabActive: { color:"#1e293b", borderBottomColor:"#1e293b" },
  searchBox: { display:"flex", alignItems:"center", gap:8, margin:"12px 16px 0", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"7px 12px" },
  searchInput: { flex:1, background:"transparent", border:"none", outline:"none", fontSize:12, color:"#1e293b", fontFamily:"inherit" },
  filterTabs: { display:"flex", gap:4, padding:"8px 16px", borderBottom:"1px solid #f1f5f9", overflowX:"auto", scrollbarWidth:"none" },
  filterTab: { background:"transparent", border:"1px solid #e2e8f0", borderRadius:6, color:"#94a3b8", fontSize:10, fontWeight:600, letterSpacing:"0.06em", padding:"3px 8px", cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.15s" },
  filterTabActive: { background:"#f1f5f9", borderColor:"#cbd5e1", color:"#1e293b" },
  list: { flex:1, overflowY:"auto", padding:"8px 12px 16px", scrollbarWidth:"thin", scrollbarColor:"#e2e8f0 transparent" },
  empty: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"48px 0", fontSize:13, color:"#94a3b8", textAlign:"center" },
  card: { background:"#ffffff", border:"1px solid #f1f5f9", borderRadius:10, padding:"10px 12px", marginBottom:8, cursor:"pointer", transition:"border-color 0.15s, box-shadow 0.15s", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" },
  cardActive: { borderColor:"#e2e8f0", boxShadow:"0 2px 10px rgba(0,0,0,0.08)", background:"#fafbfd" },
  cardRow: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 },
  cardLeft: { display:"flex", alignItems:"flex-start", gap:8 },
  severityBar: { width:3, height:32, borderRadius:2, marginTop:2, flexShrink:0 },
  cardId:       { fontSize:11, fontFamily:"monospace", fontWeight:700, color:"#94a3b8", letterSpacing:"0.04em" },
  cardUser:     { fontSize:12, color:"#1e293b", fontWeight:500, marginTop:2 },
  cardLocation: { fontSize:11, color:"#94a3b8", marginBottom:6, paddingLeft:11 },
  cardMeta: { display:"flex", justifyContent:"space-between", alignItems:"center", paddingLeft:11 },
  cardTime: { fontSize:10, color:"#cbd5e1", fontFamily:"monospace" },
  pill: { display:"inline-block", fontSize:10, fontWeight:600, letterSpacing:"0.05em", borderRadius:4, padding:"2px 7px" },
  cardDetail: { marginTop:10, marginLeft:11, fontSize:12, color:"#64748b", lineHeight:1.6, borderTop:"1px solid #f1f5f9", paddingTop:8 },
  cardScores: { display:"flex", gap:16, marginTop:10, marginLeft:11, paddingTop:8, borderTop:"1px solid #f1f5f9" },
  scoreItem: { display:"flex", flexDirection:"column", gap:2 },
  scoreLabel: { fontSize:10, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.06em" },
  scoreVal:   { fontSize:14, fontFamily:"monospace", fontWeight:700, color:"#0f172a" },
  assignBtn: { display:"flex", alignItems:"center", width:"100%", justifyContent:"center", padding:"7px 0", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:7, fontSize:12, color:"#1e293b", fontWeight:600, cursor:"pointer" },
  backdrop: { position:"fixed", inset:0, background:"rgba(15,23,42,0.25)", zIndex:2000, display:"flex", justifyContent:"flex-end" },
  drawer: { width:380, background:"#ffffff", height:"100%", overflowY:"auto", padding:"24px 20px", boxShadow:"-4px 0 24px rgba(0,0,0,0.10)" },
  drawerHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 },
  drawerClose: { background:"transparent", border:"none", color:"#94a3b8", cursor:"pointer", display:"flex", alignItems:"center", padding:4 },
  drawerTitle: { margin:"0 0 2px", fontSize:18, fontWeight:700, color:"#0f172a" },
  drawerSub:   { margin:"0 0 16px", fontSize:12, color:"#64748b" },
  drawerSectionTitle: { fontSize:11, fontWeight:700, letterSpacing:"0.08em", color:"#94a3b8", margin:"0 0 8px" },
  modeToggle: { display:"flex", gap:6, marginBottom:12 },
  modeBtn: { flex:1, padding:"6px 0", fontSize:11, fontWeight:600, border:"1px solid #e2e8f0", borderRadius:6, background:"transparent", color:"#64748b", cursor:"pointer" },
  modeBtnActive: { background:"#f1f5f9", borderColor:"#cbd5e1", color:"#1e293b" },
  searchRow: { display:"flex", gap:8, marginBottom:10 },
  drawerInput: { flex:1, padding:"7px 10px", border:"1px solid #e2e8f0", borderRadius:7, fontSize:12, color:"#1e293b", outline:"none", background:"#f8fafc" },
  drawerBtn: { padding:"7px 14px", background:"#f1f5f9", border:"1px solid #e2e8f0", borderRadius:7, fontSize:11, fontWeight:600, color:"#1e293b", cursor:"pointer", whiteSpace:"nowrap" },
  errorBanner:   { background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:7, padding:"8px 12px", fontSize:12, color:"#dc2626", marginBottom:10 },
  successBanner: { background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.2)", borderRadius:7, padding:"8px 12px", fontSize:12, color:"#16a34a", marginBottom:10 },
  loadingRow: { display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#64748b", padding:"8px 0" },
  matchList: { display:"flex", flexDirection:"column", gap:6, marginBottom:10 },
  matchRow: { display:"flex", alignItems:"flex-start", gap:10, padding:"8px 10px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8 },
  facilityList: { display:"flex", flexDirection:"column", gap:6, marginTop:10 },
  facilityRow: { display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8 },
  facilityRowAssigned: { background:"#f0fdf4", borderColor:"#bbf7d0" },
};