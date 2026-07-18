// src/components/IncidentList.jsx
import { memo, useMemo, useState } from "react";

const SEVERITY_LABEL = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  CRITICAL: "Critical",
};

function timeAgo(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

// A single row. Memoized so re-rendering the list on poll doesn't force
// every row (and any nested DOM/listeners) to re-render — only the row
// whose data actually changed, plus whichever row's `selected` flag flipped.
const IncidentRow = memo(function IncidentRow({ incident, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`incident-row${selected ? " incident-row--selected" : ""}`}
      onClick={() => onSelect(incident.id)}
    >
      <span className={`severity-dot severity-dot--${incident.severity.toLowerCase()}`} />
      <span className="incident-row__body">
        <span className="incident-row__top">
          <span className="incident-row__zone">{incident.zone || "Unknown zone"}</span>
          <span className="incident-row__time">{timeAgo(incident.created_at)}</span>
        </span>
        <span className="incident-row__meta">
          {SEVERITY_LABEL[incident.severity] || incident.severity} · {incident.status}
        </span>
      </span>
      <span className="incident-row__priority" title="Priority score">
        {incident.priority}
      </span>
    </button>
  );
});

export default function IncidentList({ incidents, selectedId, onSelect, loading }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const sorted = [...incidents].sort((a, b) => b.priority - a.priority);
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(
      (i) =>
        (i.zone || "").toLowerCase().includes(q) ||
        (i.address || "").toLowerCase().includes(q) ||
        i.status.toLowerCase().includes(q)
    );
  }, [incidents, query]);

  return (
    <aside className="incident-list">
      <div className="incident-list__header">
        <h1 className="incident-list__title">Active incidents</h1>
        <span className="incident-list__count">{incidents.length}</span>
      </div>

      <input
        className="incident-list__search"
        placeholder="Filter by zone or status…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="incident-list__items">
        {loading && incidents.length === 0 && (
          <p className="incident-list__empty">Loading incidents…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="incident-list__empty">No incidents match.</p>
        )}
        {filtered.map((incident) => (
          <IncidentRow
            key={incident.id}
            incident={incident}
            selected={incident.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  );
}