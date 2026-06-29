/**
 * CommandDashboard.jsx
 * Receives incidents, stats, teams as props from App.jsx.
 * App.jsx owns all data fetching and socket listeners — no duplication here.
 */
import { useMemo } from "react";
import { AlertTriangle, Flame, Users, CheckCircle2, Boxes, Clock } from "lucide-react";
import StatCard from "../components/StatCard";
import IncidentMap from "../components/IncidentMap";
import ActiveMissionsPanel from "../components/ActiveMissionPanel";

export default function CommandDashboard({ incidents = [], stats = {}, teams = [] }) {

  const derived = useMemo(() => {
    const critical = incidents.filter((i) => i.severity === "CRITICAL").length;
    const resolvedToday = incidents.filter((i) => {
      if (i.status !== "RESOLVED") return false;
      return new Date(i.updated_at).toDateString() === new Date().toDateString();
    }).length;

    return {
      active_incidents: incidents.length,
      critical_incidents: critical,
      teams_deployed: teams.filter((t) => t.status === "deployed").length,
      teams_total: teams.length,
      rescued_today: resolvedToday,
    };
  }, [incidents, teams]);

  return (
    <div className="page">
      <div className="stat-grid">
        <StatCard
          icon={AlertTriangle}
          label="ACTIVE INCIDENTS"
          value={derived.active_incidents ?? "—"}
          sub="Live across all zones"
          tone="neutral"
        />
        <StatCard
          icon={Flame}
          label="CRITICAL"
          value={derived.critical_incidents ?? "—"}
          sub="Tier-1 priority"
          tone="red"
        />
        <StatCard
          icon={Users}
          label="TEAMS ACTIVE"
          value={`${derived.teams_deployed ?? 0} / ${derived.teams_total ?? 0}`}
          sub="Deployed / total"
          tone="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="RESCUED TODAY"
          value={derived.rescued_today ?? "—"}
          sub="Closed missions"
          tone="green"
        />
        <StatCard
          icon={Boxes}
          label="AVAILABLE RESOURCES"
          value="—"
          sub="Boats, medics, shelters"
          tone="neutral"
        />
        <StatCard
          icon={Clock}
          label="AVG RESPONSE"
          value="—"
          sub="Last 24 hours"
          tone="blue"
        />
      </div>

      <div className="dashboard-main-grid">
        <IncidentMap incidents={incidents} teams={teams} />
        <ActiveMissionsPanel incidents={incidents} />
      </div>
    </div>
  );
}