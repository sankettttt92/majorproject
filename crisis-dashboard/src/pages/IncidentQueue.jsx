import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../lib/api";

const TABS = ["ALL", "CRITICAL", "HIGH", "MODERATE", "LOW"];

const SEVERITY_TONE = { CRITICAL: "red", HIGH: "orange", MODERATE: "blue", LOW: "muted" };
const STATUS_TONE = {
  PENDING: "orange",
  VERIFIED: "blue",
  DISPATCHED: "green",
  RESOLVED: "green",
  REJECTED: "muted",
};

const STATUS_OPTIONS = ["PENDING", "VERIFIED", "DISPATCHED", "RESOLVED", "REJECTED"];

function timeOf(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  catch { return ""; }
}

function shortId(id) {
  return String(id).slice(0, 8).toUpperCase();
}

export default function IncidentQueue({ incidents, onStatusChange }) {
  const [tab, setTab] = useState("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(false);

  const filtered = useMemo(() => {
    return incidents
      .filter((i) => i.status !== "REJECTED")
      .filter((i) => tab === "ALL" || i.severity === tab)
      .filter((i) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        const idMatch = String(i.id).toLowerCase().includes(q);
        const userMatch = (i.user_id || "").toLowerCase().includes(q);
        const locationMatch = (i.address || i.zone || "").toLowerCase().includes(q);
        return idMatch || userMatch || locationMatch;
      });
  }, [incidents, tab, query]);

  const locationLabel = (inc) =>
    inc.address || inc.zone ||
    (inc.latitude && inc.longitude
      ? `${Number(inc.latitude).toFixed(4)}° N, ${Number(inc.longitude).toFixed(4)}° E`
      : "Location unknown");

  async function handleStatusChange(newStatus) {
    if (!selected) return;
    setUpdating(true);
    try {
      const updated = await api.updateIncidentStatus(selected.id, newStatus);
      onStatusChange?.(updated);
      setSelected(updated);
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h1>Incident Queue</h1>
          <p>All active and recently closed incidents · prioritized by validation risk score</p>
        </div>
        <div className="search-box">
          <Search size={15} />
          <input
            placeholder="Search ID, user, location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={"tab" + (tab === t ? " tab--active" : "")} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        <span className="tab-count mono">{filtered.length} results</span>
      </div>

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th><th>USER</th><th>LOCATION</th>
              <th>SEVERITY</th><th>TRUST</th><th>RISK</th>
              <th>DETAIL</th><th>STATUS</th><th>WHEN</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inc) => (
              <tr key={inc.id} onClick={() => setSelected(inc)} className="data-row">
                <td className="mono link-cell">#{shortId(inc.id)}</td>
                <td>{inc.user_id}</td>
                <td>{locationLabel(inc)}</td>
                <td><span className={`pill pill--${SEVERITY_TONE[inc.severity] || "muted"}`}>{inc.severity}</span></td>
                <td className="mono">{inc.trust_score}</td>
                <td className="mono">{inc.risk_score}</td>
                <td>{inc.detail || "—"}</td>
                <td><span className={`pill pill--${STATUS_TONE[inc.status] || "muted"}`}>{inc.status}</span></td>
                <td className="mono">{timeOf(inc.created_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="empty-row">No incidents match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <span className="mono">#{shortId(selected.id)}</span>
              <button onClick={() => setSelected(null)} className="drawer-close">✕</button>
            </div>
            <h2>{selected.user_id}</h2>
            <p className="text-secondary">{locationLabel(selected)}</p>

            <div className="drawer-scores">
              <div><span className="text-secondary">Trust score</span><div className="mono drawer-score">{selected.trust_score}</div></div>
              <div><span className="text-secondary">Risk score</span><div className="mono drawer-score">{selected.risk_score}</div></div>
              <div><span className="text-secondary">Priority</span><div className="mono drawer-score">{selected.priority}</div></div>
            </div>

            {selected.detail && (
              <>
                <h3>Report detail</h3>
                <p>{selected.detail}</p>
              </>
            )}

            <h3>Update status</h3>
            <div className="status-actions">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  disabled={updating || selected.status === s}
                  onClick={() => handleStatusChange(s)}
                  className={"status-btn" + (selected.status === s ? " status-btn--active" : "")}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}