
// import { io } from "socket.io-client";

// export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// export const socket = io(API_BASE, {
//   autoConnect: true,
//   transports: ["websocket", "polling"],
// });

// async function request(path, options = {}) {
//   const res = await fetch(`${API_BASE}${path}`, {
//     headers: { "Content-Type": "application/json" },
//     ...options,
//   });

//   if (!res.ok) {
//     // v2: parse JSON error bodies (e.g. 409 conflict with suggestion payload)
//     const contentType = res.headers.get("content-type") || "";
//     if (contentType.includes("application/json")) {
//       const json = await res.json().catch(() => null);
//       const err = new Error(`${res.status} ${res.statusText}`);
//       err.status = res.status;
//       err.data = json?.detail ?? json;
//       throw err;
//     }
//     const text = await res.text().catch(() => "");
//     throw new Error(`${res.status} ${res.statusText} — ${text}`);
//   }

//   // 204 No Content has no body to parse
//   if (res.status === 204) return null;

//   return res.json();
// }

// export const api = {
//   // ── Incidents ────────────────────────────────────────────────────────────
//   getIncidents: () => request("/incidents/active"),

//   updateIncidentStatus: (id, status) =>
//     request(`/incidents/${id}/status`, {
//       method: "PATCH",
//       body: JSON.stringify({ status }),
//     }),

//   // ── Resource Center — teams & allocation ─────────────────────────────────
//   getTeams: () => request("/teams"),

//   createTeam: (team) =>
//     request("/teams", {
//       method: "POST",
//       body: JSON.stringify(team),
//     }),

//   deleteTeam: (id) =>
//     request(`/teams/${id}`, { method: "DELETE" }),

//   updateTeamStatus: (id, status) =>
//     request(`/teams/${id}/status`, {
//       method: "PATCH",
//       body: JSON.stringify({ status }),
//     }),

//   getPendingIncidents: () => request("/incidents/pending"),

//   // v2: now throws a structured error on 409 — catch err.data.suggestion
//   allocateTeams: (incidentId, teamIds) =>
//     request(`/incidents/${incidentId}/allocate`, {
//       method: "POST",
//       body: JSON.stringify({ team_ids: teamIds }),
//     }),

//   unallocateTeam: (incidentId, teamId) =>
//     request(`/incidents/${incidentId}/unallocate`, {
//       method: "POST",
//       body: JSON.stringify({ team_id: teamId }),
//     }),

//   // ── v2: Facility–Team assignment ─────────────────────────────────────────
//   assignTeamToFacility: (data) =>
//     request("/facilities/assign-team", {
//       method: "POST",
//       body: JSON.stringify(data),
//     }),

//   getFacilitiesNearby: (incidentId) =>
//     request(`/facilities/nearby/${incidentId}`),

//   confirmSuggestion: (incidentId, teamId) =>
//     request(`/incidents/${incidentId}/allocate`, {
//       method: "POST",
//       body: JSON.stringify({ team_ids: [teamId] }),
//     }),

//   // ── Mission Coordination ────────────────────────────────────────────────
//   getMissionsActive: () => request("/missions/active"),

//   patchTeamLocation: (teamId, latitude, longitude) =>
//     request(`/teams/${teamId}/location`, {
//       method: "POST",
//       body: JSON.stringify({ latitude, longitude }),
//     }),

//   allocateTeamsMulti: (incidentId, nTeams) =>
//     request(`/incidents/${incidentId}/allocate-multi`, {
//       method: "POST",
//       body: JSON.stringify({ n_teams: nTeams }),
//     }),

//   // ── Media ────────────────────────────────────────────────────────────────
//   getMediaForIncident: (incidentId) =>
//     request(`/media/incident/${incidentId}`),

//   // ── Stubs ────────────────────────────────────────────────────────────────
//   getStats: () => Promise.resolve({}),
//   getActivity: () => Promise.resolve([]),
// };

import { io } from "socket.io-client";

export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export const socket = io(API_BASE, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options, // Preserves method, body, and signal (must be passed as { signal })
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

  // 204 No Content has no body to parse
  if (res.status === 204) return null;

  return res.json();
}

export const api = {
  // ── Incidents ────────────────────────────────────────────────────────────
  // options: { signal } — pass an AbortController's signal to cancel on unmount
  getIncidents: (options) => request("/incidents/active", options),

  // FIX: backend route is /incidents/{id}/location (routers/location.py),
  // not /incidents/{id}/history
  getIncidentLocationHistory: (id, options) =>
    request(`/incidents/${id}/location`, options),

  getIncidentPrediction: (id, options) =>
    request(`/incidents/${id}/prediction`, options),

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

  deleteTeam: (id) =>
    request(`/teams/${id}`, { method: "DELETE" }),

  updateTeamStatus: (id, status) =>
    request(`/teams/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
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

  // ── Resource Dispatch / Auto-allocation ──────────────────────────────────
  dispatchAutomatedVolunteer: (incidentId) =>
    request(`/incidents/${incidentId}/allocate-multi`, {
      method: "POST",
      body: JSON.stringify({ n_teams: 1 }),
    }),

  // ── v2: Facility–Team assignment ─────────────────────────────────────────
  assignTeamToFacility: (data) =>
    request("/facilities/assign-team", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getFacilitiesNearby: (incidentId) =>
    request(`/facilities/nearby/${incidentId}`),

  confirmSuggestion: (incidentId, teamId) =>
    request(`/incidents/${incidentId}/allocate`, {
      method: "POST",
      body: JSON.stringify({ team_ids: [teamId] }),
    }),

  // ── Mission Coordination ────────────────────────────────────────────────
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

  // ── Media ────────────────────────────────────────────────────────────────
  getMediaForIncident: (incidentId) =>
    request(`/media/incident/${incidentId}`),

  // ── Stubs ────────────────────────────────────────────────────────────────
  getStats: () => Promise.resolve({}),
  getActivity: () => Promise.resolve([]),
};