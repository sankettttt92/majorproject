import { useEffect, useState, useCallback } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import LiveActivityPanel from "./components/LiveActivityPanel";
import CommandDashboard from "./pages/CommandDashboard";
import IncidentQueue from "./pages/IncidentQueue";
import ResourceCenter from "./pages/Resourcecentre";
import ComingSoon from "./pages/ComingSoon";
import SuggestionPanel from "./components/SuggestionPanel"; // ← v2
import { api, socket } from "./lib/api";
import MissionCoordination from "./pages/MissionCoordination";

const CRUMBS = {
  "/": "OPS / COMMAND DASHBOARD",
  "/incidents": "OPS / INCIDENTS",
  "/resources": "OPS / RESOURCES",
  "/missions": "OPS / MISSIONS",
  "/victim-app": "FIELD / VICTIM APP PREVIEW",
};

export default function App() {
  const location = useLocation();
  const [connected, setConnected] = useState(socket.connected);
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({});
  const [teams, setTeams] = useState([]);
  const [activity, setActivity] = useState([]);

  const upsertIncident = useCallback((incident) => {
    setIncidents((prev) => {
      const others = prev.filter((i) => i.id !== incident.id);
      return [incident, ...others];
    });
  }, []);

  useEffect(() => {
    api.getIncidents().then(setIncidents).catch(() => {});
    api.getStats().then(setStats).catch(() => {});
    api.getTeams().then(setTeams).catch(() => {});
    api.getActivity().then(setActivity).catch(() => {});

    function onConnect() { setConnected(true); }
    function onDisconnect() { setConnected(false); }
    function onIncidentNew(data) { upsertIncident(data); }
    function onIncidentUpdate(data) { upsertIncident(data); }
    function onStats(data) { setStats(data); }
    function onActivity(entry) { setActivity((prev) => [entry, ...prev].slice(0, 100)); }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("incident:new", onIncidentNew);
    socket.on("incident:update", onIncidentUpdate);
    socket.on("stats:update", onStats);
    socket.on("activity:new", onActivity);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("incident:new", onIncidentNew);
      socket.off("incident:update", onIncidentUpdate);
      socket.off("stats:update", onStats);
      socket.off("activity:new", onActivity);
    };
  }, [upsertIncident]);

  return (
    <div className="app-shell">
      <Sidebar connected={connected} />
      <div className="app-main">
        <TopBar crumb={CRUMBS[location.pathname] || "OPS"} notifications={1} />
        <div className="app-body">
          <div className="app-content">
            <Routes>
              <Route path="/" element={<CommandDashboard incidents={incidents} stats={stats} teams={teams} />} />
              <Route path="/incidents" element={<IncidentQueue incidents={incidents} onStatusChange={upsertIncident} />} />
              <Route path="/resources" element={<ResourceCenter />} />
             
              <Route path="/victim-app" element={<ComingSoon title="Victim App Preview" blurb="A live preview of the mobile reporting app will live here." />} />
             
              <Route path="/missions" element={<MissionCoordination />} />
            </Routes>
          </div>
          <LiveActivityPanel entries={activity} connected={connected} />
        </div>
      </div>

      {/* v2: global A* suggestion toast — fires on every "incident:suggestion" socket event */}
      <SuggestionPanel onConfirm={(incidentId, teamId) => api.confirmSuggestion(incidentId, teamId)} />
    </div>
  );
}