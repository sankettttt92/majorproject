/**
 * ActiveMissionsPanel.jsx
 * Shows the latest incidents in priority order.
 * Status values must match IncidentStatus enum in models/incident.py exactly.
 */
import { Link } from "react-router-dom";

// Must match IncidentStatus in models/incident.py
const STATUS_TONE = {
  PENDING:    "orange",
  VERIFIED:   "blue",
  DISPATCHED: "green",
  RESOLVED:   "green",
  REJECTED:   "muted",
};

// Progress pipeline — order matters, drives the progress bar width
const STAGE_ORDER = ["PENDING", "VERIFIED", "DISPATCHED", "RESOLVED"];

// Human-readable labels for the pill
const STATUS_LABEL = {
  PENDING:    "Pending",
  VERIFIED:   "Verified",
  DISPATCHED: "Dispatched",
  RESOLVED:   "Resolved",
  REJECTED:   "Rejected",
};

export default function ActiveMissionsPanel({ incidents }) {
  const visible = incidents
    .filter((i) => i.status !== "REJECTED")
    .slice(0, 6);

  return (
    <div className="missions-card">
      <div className="missions-header">
        <span>ACTIVE MISSIONS</span>
        <Link to="/incidents" className="link-small">View all →</Link>
      </div>

      <div className="missions-list">
        {visible.length === 0 && (
          <div className="activity-empty">No incidents reported yet.</div>
        )}

        {visible.map((inc) => {
          const stageIdx = STAGE_ORDER.indexOf(inc.status);
          const pct = Math.max(8, ((stageIdx + 1) / STAGE_ORDER.length) * 100);

          // Shorten the UUID so it fits in the row
          const shortId = String(inc.id).slice(0, 8).toUpperCase();

          // Use address from geo-resolution, fall back to coords
          const locationLabel = inc.address
            ? inc.address
            : inc.latitude && inc.longitude
            ? `${Number(inc.latitude).toFixed(4)}° N, ${Number(inc.longitude).toFixed(4)}° E`
            : "Location unknown";

          return (
            <div className="mission-row" key={inc.id}>
              <div className="mission-row-top">
                <span className="mono mission-id">#{shortId}</span>
                <span className={`pill pill--${STATUS_TONE[inc.status] || "muted"}`}>
                  {STATUS_LABEL[inc.status] || inc.status}
                </span>
              </div>

              <div className="mission-row-sub">
                {inc.user_id} · {locationLabel}
              </div>

              {inc.detail && (
                <div className="mission-row-detail">{inc.detail}</div>
              )}

              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}