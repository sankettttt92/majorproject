import { useCallback, useEffect, useState } from "react";
import IncidentList from "../components/IncidentList";
import IncidentMap from "../components/IncidentMap1";
import VictimPanel from "../components/VictimPanel";
import { api, socket } from "../lib/api";

export default function IncidentDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const [history, setHistory] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [sending, setSending] = useState(false);

  // 1. Initial Data Load & Real-Time Global Incident Streaming
  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialIncidents() {
      try {
        // FIX: signal must be wrapped in an options object
        const data = await api.getIncidents({ signal: controller.signal });
        setIncidents(data);
      } catch (err) {
        if (err.name !== "AbortError") console.error("Failed to load active incidents:", err);
      } finally {
        setIncidentsLoading(false);
      }
    }

    loadInitialIncidents();

    function handleIncidentUpdate(updatedIncident) {
      setIncidents((prev) => {
        if (updatedIncident.status === "RESOLVED" || updatedIncident.status === "CLOSED") {
          return prev.filter((i) => i.id !== updatedIncident.id);
        }
        const exists = prev.some((i) => i.id === updatedIncident.id);
        if (exists) {
          return prev.map((i) => (i.id === updatedIncident.id ? updatedIncident : i));
        }
        return [...prev, updatedIncident];
      });
    }

    socket.on("incident:update", handleIncidentUpdate);

    return () => {
      controller.abort();
      socket.off("incident:update", handleIncidentUpdate);
    };
  }, []);

  // Default selection to highest-priority active incident
  useEffect(() => {
    if (!selectedId && incidents.length > 0) {
      setSelectedId([...incidents].sort((a, b) => b.priority - a.priority)[0].id);
    }
  }, [incidents, selectedId]);

  // 2. Load Selected Incident Details & Stream Location Pings
  useEffect(() => {
    if (!selectedId) return;

    const controller = new AbortController();
    let isCancelled = false;

    async function loadDetails() {
      try {
        // FIX: signal wrapped in options object for both calls
        const [hist, pred] = await Promise.all([
          api.getIncidentLocationHistory(selectedId, { signal: controller.signal }),
          api.getIncidentPrediction(selectedId, { signal: controller.signal }),
        ]);
        if (isCancelled) return;
        setHistory(hist);
        setPrediction(pred);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to load incident detail endpoints:", err);
        }
      }
    }

    // Flush old state instantly to prevent visual overlap between incidents.
    // Note: the map itself stays mounted (see IncidentMap1.jsx) — only the
    // props change, so flyTo still animates smoothly from the old point.
    setHistory([]);
    setPrediction(null);
    loadDetails();

    function handleLocationPing(data) {
      if (data.incident_id !== selectedId) return;
      if (data.history) setHistory(data.history);
      if (data.prediction) setPrediction(data.prediction);
    }

    socket.on("location:ping", handleLocationPing);

    return () => {
      isCancelled = true;
      controller.abort();
      socket.off("location:ping", handleLocationPing);
    };
  }, [selectedId]);

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
  }, []);

  // 3. Send to Volunteer Action
  const handleSendToVolunteer = useCallback(async () => {
    if (!selectedId) return;
    setSending(true);
    try {
      await api.dispatchAutomatedVolunteer(selectedId);
    } catch (err) {
      console.error("Failed to dispatch automated volunteer allocation:", err);
    } finally {
      setSending(false);
    }
  }, [selectedId]);

  const selectedIncident = incidents.find((i) => i.id === selectedId) || null;

  return (
    <div className="incident-dashboard">
      <IncidentList
        incidents={incidents}
        selectedId={selectedId}
        onSelect={handleSelect}
        loading={incidentsLoading}
      />

      <main className="incident-dashboard__map-area">
        <IncidentMap
          history={history}
          prediction={prediction}
          severity={selectedIncident?.severity}
          showPrediction
        />
        <VictimPanel
          incident={selectedIncident}
          prediction={prediction}
          onSendToVolunteer={handleSendToVolunteer}
          sending={sending}
        />
      </main>
    </div>
  );
}