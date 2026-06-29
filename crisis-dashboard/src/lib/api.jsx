/**
 * lib/api.js
 * Single source of truth for all backend calls and the shared Socket.IO instance.
 */
import { io } from "socket.io-client";

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export const socket = io(API_BASE, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    // v2: parse JSON error bodies (e.g. 409 conflict with suggestion payload)
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await res.json().catch(() => null);
      const err = new Error(`${res.status} ${res.statusText}`);
      err.status = res.status;
      err.data = json?.detail ?? json;
      throw err;
    }
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${text}`);
  }

  return res.json();
}

export const api = {
  // ── Incidents ────────────────────────────────────────────────────────────
  getIncidents: () => request("/incidents/active"),

  updateIncidentStatus: (id, status) =>
    request(`/incidents/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // ── Resource Center — teams & allocation ─────────────────────────────────
  getTeams: () => request("/teams"),

  createTeam: (team) =>
    request("/teams", {
      method: "POST",
      body: JSON.stringify(team),
    }),

  getPendingIncidents: () => request("/incidents/pending"),

  // v2: now throws a structured error on 409 — catch err.data.suggestion
  allocateTeams: (incidentId, teamIds) =>
    request(`/incidents/${incidentId}/allocate`, {
      method: "POST",
      body: JSON.stringify({ team_ids: teamIds }),
    }),

  unallocateTeam: (incidentId, teamId) =>
    request(`/incidents/${incidentId}/unallocate`, {
      method: "POST",
      body: JSON.stringify({ team_id: teamId }),
    }),

  // ── v2: Facility–Team assignment ─────────────────────────────────────────
  // POST /facilities/assign-team
  // body: { team_id, place_id, place_name, place_type, latitude, longitude }
  assignTeamToFacility: (data) =>
    request("/facilities/assign-team", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // GET /facilities/nearby/{incidentId}
  // Returns facility_teams with AVAILABLE teams within 5km of the incident
  getFacilitiesNearby: (incidentId) =>
    request(`/facilities/nearby/${incidentId}`),

  // Confirm A* suggestion — just calls allocate with the suggested team
  confirmSuggestion: (incidentId, teamId) =>
    request(`/incidents/${incidentId}/allocate`, {
      method: "POST",
      body: JSON.stringify({ team_ids: [teamId] }),
    }),

  // ── Mission Coordination ─────────────────────────────────────────────────
  // paste inside the api = { ... } object, after confirmSuggestion:

getMissionsActive: () => request("/missions/active"),

patchTeamLocation: (teamId, latitude, longitude) =>
  request(`/teams/${teamId}/location`, {
    method: "POST",
    body: JSON.stringify({ latitude, longitude }),
  }),

  allocateTeamsMulti: (incidentId, nTeams) =>
  request(`/incidents/${incidentId}/allocate-multi`, {
    method: "POST",
    body: JSON.stringify({ n_teams: nTeams }),
  }),

  // ── Stubs ────────────────────────────────────────────────────────────────
  getStats: () => Promise.resolve({}),
  getActivity: () => Promise.resolve([]),
};
