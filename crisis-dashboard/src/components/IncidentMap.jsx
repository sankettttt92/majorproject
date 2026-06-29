import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DELHI_CENTER = [28.6139, 77.2090];
const DEFAULT_ZOOM = 11;
const FOCUS_ZOOM = 14;

const SEVERITY_COLOR = {
  CRITICAL: "#D93A3A",
  HIGH: "#C9740B",
  MODERATE: "#2A5BE0",
  LOW: "#9AA1AC",
};

function hasValidCoords(obj) {
  // ── v2 fix: guard against null/undefined obj before reading props ──
  if (!obj) return false;
  return (
    typeof obj.latitude === "number" &&
    typeof obj.longitude === "number" &&
    !Number.isNaN(obj.latitude) &&
    !Number.isNaN(obj.longitude)
  );
}

function FollowLatestIncident({ latestIncident }) {
  const map = useMap();
  const lastSeenId = useRef(null);

  useEffect(() => {
    if (!latestIncident) return;
    if (latestIncident.id === lastSeenId.current) return;

    lastSeenId.current = latestIncident.id;
    map.flyTo([latestIncident.latitude, latestIncident.longitude], FOCUS_ZOOM, {
      duration: 1.2,
    });
  }, [latestIncident, map]);

  return null;
}

export default function IncidentMap({ incidents, teams }) {
  // ── v2 fix: guard against undefined props so socket-pushed renders don't crash ──
  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  const safeTeams = Array.isArray(teams) ? teams : [];

  const plottableIncidents = safeIncidents.filter(hasValidCoords);
  const plottableTeams = safeTeams.filter(hasValidCoords);
  // ────────────────────────────────────────────────────────────────────────────

  const latestIncident = plottableIncidents[0] || null;

  return (
    <div className="map-card">
      <div className="map-card-header">
        <span>LIVE INCIDENT MAP · DELHI NCR</span>
        <span className="map-marker-count mono">{plottableIncidents.length} markers</span>
      </div>
      <div className="map-wrap">
        <MapContainer
          center={DELHI_CENTER}
          zoom={DEFAULT_ZOOM}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FollowLatestIncident latestIncident={latestIncident} />

          {plottableIncidents.map((inc) => (
            <CircleMarker
              key={inc.id}
              center={[inc.latitude, inc.longitude]}
              radius={8}
              pathOptions={{
                color: "#fff",
                weight: 2,
                fillColor: SEVERITY_COLOR[inc.severity] || "#9AA1AC",
                fillOpacity: 1,
              }}
            >
              <Tooltip>
                {String(inc.id).slice(0, 8).toUpperCase()} · {inc.user_id} · {inc.severity}
              </Tooltip>
            </CircleMarker>
          ))}
          {plottableTeams.map((team) => (
            <CircleMarker
              key={team.id}
              center={[team.latitude, team.longitude]}
              radius={7}
              pathOptions={{
                color: "#fff",
                weight: 2,
                fillColor: team.status === "AVAILABLE" ? "#2A5BE0" : "#1A8754",
                fillOpacity: 1,
              }}
            >
              <Tooltip>{team.name} · {team.status}</Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>

        <div className="map-legend">
          <div><span className="dot" style={{ background: SEVERITY_COLOR.CRITICAL }} /> Critical Incident</div>
          <div><span className="dot" style={{ background: SEVERITY_COLOR.HIGH }} /> High</div>
          <div><span className="dot" style={{ background: "#2A5BE0" }} /> Rescue Team</div>
          <div><span className="dot" style={{ background: "#1A8754" }} /> Medical Unit</div>
        </div>
      </div>
    </div>
  );
}