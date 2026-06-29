import { Circle } from "lucide-react";

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

export default function LiveActivityPanel({ entries, connected }) {
  return (
    <aside className="activity-panel">
      <div className="activity-header">
        <span>LIVE ACTIVITY</span>
        <span className="streaming-chip">
          <Circle size={8} fill={connected ? "#1A8754" : "#9AA1AC"} color={connected ? "#1A8754" : "#9AA1AC"} />
          {connected ? "STREAMING" : "PAUSED"}
        </span>
      </div>

      <div className="activity-list">
        {entries.length === 0 && (
          <div className="activity-empty">Waiting for field reports…</div>
        )}
        {entries.map((e) => (
          <div className="activity-row" key={e.id}>
            <div className="activity-time mono">{formatTime(e.ts)}</div>
            <div className="activity-body">
              <span className={`activity-tag activity-tag--${e.tag?.toLowerCase()}`}>{e.tag}</span>
              <div className="activity-msg">{e.message}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}