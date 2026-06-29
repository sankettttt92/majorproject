/**
 * components/SuggestionPanel.jsx
 * Shows the A* dispatch suggestion inside the allocation drawer (conflict case)
 * AND as a floating toast when the socket fires "incident:suggestion" on a new SOS.
 *
 * Props (drawer / conflict use):
 *   suggestion  — SuggestionOut object from the 409 error body
 *   onConfirm   — (incidentId, teamId) => void
 *   onDismiss   — () => void
 *
 * Socket use: import and place once in App.jsx or CommandDashboard.jsx —
 * it self-listens to "incident:suggestion" and shows itself as a toast.
 */
import { useEffect, useState } from "react";
import { CheckCircle, X, Navigation, Clock, MapPin } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from "react-leaflet";
import { socket } from "../lib/api";
import "leaflet/dist/leaflet.css";

// ── Inline suggestion card (used inside the drawer on 409 conflict) ───────────
export function SuggestionCard({ suggestion, onConfirm, onDismiss, confirming, error }) {
  if (!suggestion) return null;

  const { incident_id, facility_team, team_name, team_category, team_org_type,
          distance_km, eta_minutes, route_coords, path_labels } = suggestion;

  const hasRoute = Array.isArray(route_coords) && route_coords.length >= 2;
  const mapCenter = hasRoute ? route_coords[0] : [20.5937, 78.9629];

  return (
    <div className="suggestion-card">
      <div className="suggestion-card-header">
        <span className="suggestion-label">⚡ A* Suggestion</span>
        <button className="drawer-close" onClick={onDismiss}><X size={14} /></button>
      </div>

      <div className="suggestion-meta">
        <div className="suggestion-team">
          <strong>{team_name}</strong>
          <span className="pill pill--purple" style={{ marginLeft: 8 }}>{team_org_type}</span>
        </div>
        <div className="suggestion-stats">
          <span><Navigation size={13} /> {distance_km} km</span>
          <span><Clock size={13} /> {eta_minutes} min ETA</span>
          <span><MapPin size={13} /> {facility_team.place_name}</span>
        </div>
      </div>

      {hasRoute && (
        <div className="suggestion-map">
          <MapContainer
            center={mapCenter}
            zoom={13}
            scrollWheelZoom={false}
            style={{ height: "180px", width: "100%", borderRadius: 6 }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Polyline positions={route_coords} pathOptions={{ color: "#2A5BE0", weight: 3 }} />
            <CircleMarker
              center={route_coords[0]}
              radius={7}
              pathOptions={{ fillColor: "#D93A3A", color: "#fff", weight: 2, fillOpacity: 1 }}
            >
              <Tooltip permanent>Victim</Tooltip>
            </CircleMarker>
            <CircleMarker
              center={route_coords[route_coords.length - 1]}
              radius={7}
              pathOptions={{ fillColor: "#1A8754", color: "#fff", weight: 2, fillOpacity: 1 }}
            >
              <Tooltip permanent>{facility_team.place_name}</Tooltip>
            </CircleMarker>
          </MapContainer>
        </div>
      )}

      {Array.isArray(path_labels) && (
        <div className="suggestion-path">
          {path_labels.map((label, i) => (
            <div key={i} className="suggestion-path-step mono">{label}</div>
          ))}
        </div>
      )}

      {/* NEW: surface stale-suggestion / re-deploy errors instead of failing silently */}
      {error && <div className="banner banner--error" style={{ marginTop: 8 }}>{error}</div>}

      <div className="suggestion-actions">
        <button
          className="btn-primary btn-small"
          disabled={confirming}
          onClick={() => onConfirm(incident_id, facility_team.team_id)}
        >
          <CheckCircle size={13} style={{ marginRight: 5 }} />
          {confirming ? "Confirming…" : `Confirm — Deploy ${team_name}`}
        </button>
        <button className="btn-secondary btn-small" disabled={confirming} onClick={onDismiss}>
          Override manually
        </button>
      </div>
    </div>
  );
}

// ── Default export: floating toast that self-listens to socket ────────────────
// Place this once in CommandDashboard.jsx or App.jsx:
//   import SuggestionPanel from "../components/SuggestionPanel";
//   <SuggestionPanel onConfirm={(incidentId, teamId) => api.confirmSuggestion(incidentId, teamId)} />
export default function SuggestionPanel({ onConfirm }) {
  const [suggestion, setSuggestion] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    function handleSuggestion(data) {
      setError(null);
      setSuggestion(data);
    }
    socket.on("incident:suggestion", handleSuggestion);
    return () => socket.off("incident:suggestion", handleSuggestion);
  }, []);

  if (!suggestion) return null;

  async function handleConfirm(incidentId, teamId) {
    setConfirming(true);
    setError(null);
    try {
      await onConfirm?.(incidentId, teamId);
      setSuggestion(null);
    } catch (err) {
      // v2 guard: backend returns 409 + a *new* suggestion if the originally
      // suggested team got deployed elsewhere before this confirm landed.
      // Swap it in instead of leaving the stale toast stuck on screen.
      if (err.status === 409 && err.data?.conflict) {
        if (err.data.suggestion) {
          setSuggestion(err.data.suggestion);
          setError(
            `${err.data.deployed_teams?.join(", ") || "That team"} was deployed elsewhere — showing the next best option.`
          );
        } else {
          setSuggestion(null);
          setError(null);
        }
      } else {
        setError("Couldn't confirm this deployment. Try again or assign manually.");
      }
    } finally {
      setConfirming(false);
    }
  }

  function handleDismiss() {
    setSuggestion(null);
    setError(null);
  }

  return (
    <div className="suggestion-toast-backdrop">
      <div className="suggestion-toast">
        <div className="suggestion-toast-title">
          🚨 New SOS — Dispatch Suggestion Ready
        </div>
        <SuggestionCard
          suggestion={suggestion}
          confirming={confirming}
          error={error}
          onConfirm={handleConfirm}
          onDismiss={handleDismiss}
        />
      </div>
    </div>
  );
}