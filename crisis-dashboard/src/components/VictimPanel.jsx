// src/components/VictimPanel.jsx
import { useEffect, useState } from "react";
import { metersLabel } from "../lib/geo";

function formatClockTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Ticks locally every second so "offline for Xm Ys" stays accurate between
// polls instead of freezing at whatever value the last API response had.
function useLiveOfflineDuration(lastRecordedAt) {
  const [label, setLabel] = useState("—");

  useEffect(() => {
    if (!lastRecordedAt) {
      setLabel("—");
      return;
    }
    const tick = () => {
      const secs = Math.max(0, Math.floor((Date.now() - new Date(lastRecordedAt).getTime()) / 1000));
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      setLabel(`${m}m ${String(s).padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastRecordedAt]);

  return label;
}

export default function VictimPanel({ incident, prediction, onSendToVolunteer, sending }) {
  const offlineLabel = useLiveOfflineDuration(prediction?.last_recorded_at);

  if (!incident) {
    return (
      <div className="victim-panel victim-panel--empty">
        <p>Select an incident to see live details.</p>
      </div>
    );
  }

  const isOffline = prediction?.is_offline;

  return (
    <div className="victim-panel">
      <div className="victim-panel__row victim-panel__row--top">
        <div>
          <p className="victim-panel__label">Victim</p>
          <h2 className="victim-panel__name">{incident.detail || incident.zone || "Unnamed"}</h2>
        </div>
        <span className={`status-pill status-pill--${isOffline ? "offline" : "online"}`}>
          {isOffline ? "Offline" : "Live"}
        </span>
      </div>

      <dl className="victim-panel__stats">
        <div>
          <dt>Last seen</dt>
          <dd>{formatClockTime(prediction?.last_recorded_at)}</dd>
        </div>
        <div>
          <dt>{isOffline ? "Offline for" : "Last ping"}</dt>
          <dd className="mono">{offlineLabel}</dd>
        </div>
        <div>
          <dt>Speed</dt>
          <dd className="mono">{prediction?.average_speed != null ? `${prediction.average_speed.toFixed(1)} m/s` : "—"}</dd>
        </div>
        <div>
          <dt>Heading</dt>
          <dd className="mono">{prediction?.heading != null ? `${Math.round(prediction.heading)}°` : "—"}</dd>
        </div>
        <div>
          <dt>Est. search radius</dt>
          <dd className="mono">{metersLabel(prediction?.estimated_distance_meters)}</dd>
        </div>
      </dl>

      <button
        type="button"
        className="victim-panel__dispatch"
        onClick={onSendToVolunteer}
        disabled={sending}
      >
        {sending ? "Sending…" : "Send to volunteer"}
      </button>
    </div>
  );
}