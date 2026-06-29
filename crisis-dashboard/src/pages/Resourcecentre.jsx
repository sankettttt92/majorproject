import { useEffect, useMemo, useState } from "react";
import { Anchor, HeartPulse, Plus, Search, Shield, Users, X } from "lucide-react";
import { api, socket } from "../lib/api";
import { usePolling } from "../hooks/usePolling";
import { SuggestionCard } from "../components/SuggestionPanel";

const ORG_TYPES = ["NDRF", "SDRF", "POLICE", "NGO", "RED_CROSS", "FIRE", "MEDICAL", "CIVIL_DEFENCE"];

const ORG_LABEL = {
  NDRF: "NDRF", SDRF: "SDRF", POLICE: "Police", NGO: "NGO",
  RED_CROSS: "Red Cross", FIRE: "Fire Dept.", MEDICAL: "Medical", CIVIL_DEFENCE: "Civil Defence",
};

const STATUS_TONE = {
  AVAILABLE: "green", DEPLOYED: "blue", MAINTENANCE: "muted", OFFLINE: "red",
};

const CATEGORY_META = {
  rescue_team: { label: "Rescue Teams", icon: Users },
  boat: { label: "Boats", icon: Anchor },
  medical_unit: { label: "Medical Units", icon: HeartPulse },
  security_unit: { label: "Police / Security", icon: Shield },
};

const CATEGORY_ORDER = ["rescue_team", "boat", "medical_unit", "security_unit"];
const EMPTY_TEAM_FORM = { name: "", org_type: "NDRF", capacity: "", base: "", latitude: "", longitude: "" };

function shortId(id) { return String(id).slice(0, 8).toUpperCase(); }
function coordsLabel(asset) {
  if (asset.latitude == null || asset.longitude == null) return "—";
  return `${Number(asset.latitude).toFixed(4)}°, ${Number(asset.longitude).toFixed(4)}°`;
}

export default function ResourceCenter() {
  const { data: teams, loading: teamsLoading, error: teamsError, refetch: refetchTeams } =
    usePolling(api.getTeams, { intervalMs: 5000 });

  const { data: pendingIncidents, refetch: refetchIncidents } =
    usePolling(api.getPendingIncidents, { intervalMs: 5000 });

  const [orgFilter, setOrgFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  // allocate drawer
  const [allocateTarget, setAllocateTarget] = useState(null);
  const [allocating, setAllocating] = useState(false);
  const [allocateError, setAllocateError] = useState(null);
  const [conflictSuggestion, setConflictSuggestion] = useState(null);

  // add-team form
  const [openFormCategory, setOpenFormCategory] = useState(null);
  const [teamForm, setTeamForm] = useState(EMPTY_TEAM_FORM);
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamFormError, setTeamFormError] = useState(null);

  useEffect(() => {
    function handleIncidentEvent() { refetchIncidents(); refetchTeams(); }
    socket.on("incident:new", handleIncidentEvent);
    socket.on("incident:update", handleIncidentEvent);
    return () => {
      socket.off("incident:new", handleIncidentEvent);
      socket.off("incident:update", handleIncidentEvent);
    };
  }, [refetchIncidents, refetchTeams]);

  const allTeams = teams || [];

  const grouped = useMemo(() => {
    const filtered = allTeams.filter((t) => {
      if (orgFilter !== "ALL" && t.org_type !== orgFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        String(t.id).toLowerCase().includes(q) ||
        (t.name || "").toLowerCase().includes(q) ||
        (t.base || "").toLowerCase().includes(q)
      );
    });
    const byCategory = {};
    for (const cat of CATEGORY_ORDER) byCategory[cat] = [];
    for (const t of filtered) {
      const cat = t.category || "rescue_team";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(t);
    }
    return byCategory;
  }, [allTeams, orgFilter, query]);

  async function handleAllocate(incidentId) {
    if (!allocateTarget) return;
    setAllocating(true);
    setAllocateError(null);
    setConflictSuggestion(null);
    try {
      await api.allocateTeams(incidentId, [allocateTarget.id]);
      setAllocateTarget(null);
      refetchTeams();
      refetchIncidents();
    } catch (err) {
      if (err.status === 409 && err.data?.conflict) {
        setConflictSuggestion(err.data.suggestion ?? null);
        setAllocateError(`${err.data.deployed_teams?.join(", ")} is already deployed. See suggestion below.`);
      } else {
        setAllocateError("Couldn't allocate this team. Try again.");
      }
    } finally {
      setAllocating(false);
    }
  }

  async function handleConfirmSuggestion(incidentId, teamId) {
    setAllocating(true);
    setAllocateError(null);
    try {
      await api.confirmSuggestion(incidentId, teamId);
      setAllocateTarget(null);
      setConflictSuggestion(null);
      refetchTeams();
      refetchIncidents();
    } catch (err) {
      setAllocateError("Couldn't confirm suggestion. Try again.");
    } finally {
      setAllocating(false);
    }
  }

  function openAddTeamForm(category) { setOpenFormCategory(category); setTeamForm(EMPTY_TEAM_FORM); setTeamFormError(null); }
  function closeAddTeamForm() { setOpenFormCategory(null); setTeamFormError(null); }
  function updateTeamForm(field, value) { setTeamForm((prev) => ({ ...prev, [field]: value })); }

  async function handleCreateTeam(e, category) {
    e.preventDefault();
    if (!teamForm.name.trim()) { setTeamFormError("Name is required."); return; }
    setSavingTeam(true);
    setTeamFormError(null);
    try {
      await api.createTeam({
        name: teamForm.name.trim(), category, org_type: teamForm.org_type,
        capacity: teamForm.capacity ? Number(teamForm.capacity) : null,
        base: teamForm.base.trim() || null,
        latitude: teamForm.latitude ? Number(teamForm.latitude) : null,
        longitude: teamForm.longitude ? Number(teamForm.longitude) : null,
      });
      closeAddTeamForm();
      refetchTeams();
    } catch (err) {
      setTeamFormError("Couldn't save this team. Check the fields and try again.");
    } finally {
      setSavingTeam(false);
    }
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h1>Resource Allocation Center</h1>
          <p>Inventory across all field assets · assign teams to incidents directly</p>
        </div>
        <div className="search-box">
          <Search size={15} />
          <input placeholder="Search ID, name, base…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="tabs">
        <button className={"tab" + (orgFilter === "ALL" ? " tab--active" : "")} onClick={() => setOrgFilter("ALL")}>ALL</button>
        {ORG_TYPES.map((org) => (
          <button key={org} className={"tab" + (orgFilter === org ? " tab--active" : "")} onClick={() => setOrgFilter(org)}>
            {ORG_LABEL[org]}
          </button>
        ))}
        <span className="tab-count mono">{allTeams.length} assets total</span>
      </div>

      {teamsError && <div className="banner banner--error">Couldn't reach the resource feed. Retrying automatically.</div>}

      {teamsLoading && !teams ? (
        <div className="empty-state">Loading field assets…</div>
      ) : (
        CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat] || [];
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          const availableCount = items.filter((t) => t.status === "AVAILABLE").length;

          return (
            <div className="table-card" key={cat}>
              <div className="table-card-header">
                <span className="table-card-title"><Icon size={15} /> {meta.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span className="text-secondary mono">{availableCount} available · {items.length} total</span>
                  <button className="btn-secondary btn-small" onClick={() => (openFormCategory === cat ? closeAddTeamForm() : openAddTeamForm(cat))}>
                    <Plus size={13} style={{ marginRight: 4, verticalAlign: "text-bottom" }} />Add team
                  </button>
                </div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th><th>NAME</th><th>ORG</th><th>STATUS</th>
                    <th>CAPACITY</th><th>BASE</th><th>COORDS</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {openFormCategory === cat && (
                    <tr className="add-team-row">
                      <td colSpan={8}>
                        <form className="add-team-form" onSubmit={(e) => handleCreateTeam(e, cat)}>
                          <input className="add-team-input" placeholder="Team / asset name" value={teamForm.name} onChange={(e) => updateTeamForm("name", e.target.value)} autoFocus />
                          <select className="add-team-input" value={teamForm.org_type} onChange={(e) => updateTeamForm("org_type", e.target.value)}>
                            {ORG_TYPES.map((org) => <option key={org} value={org}>{ORG_LABEL[org]}</option>)}
                          </select>
                          <input className="add-team-input add-team-input--narrow" placeholder="Capacity" type="number" min="0" value={teamForm.capacity} onChange={(e) => updateTeamForm("capacity", e.target.value)} />
                          <input className="add-team-input" placeholder="Base / location name" value={teamForm.base} onChange={(e) => updateTeamForm("base", e.target.value)} />
                          <input className="add-team-input add-team-input--narrow" placeholder="Latitude" type="number" step="any" value={teamForm.latitude} onChange={(e) => updateTeamForm("latitude", e.target.value)} />
                          <input className="add-team-input add-team-input--narrow" placeholder="Longitude" type="number" step="any" value={teamForm.longitude} onChange={(e) => updateTeamForm("longitude", e.target.value)} />
                          <button className="btn-secondary btn-small" type="submit" disabled={savingTeam}>{savingTeam ? "Saving…" : "Save"}</button>
                          <button className="btn-secondary btn-small" type="button" onClick={closeAddTeamForm} disabled={savingTeam}>Cancel</button>
                          {teamFormError && <span className="add-team-error">{teamFormError}</span>}
                        </form>
                      </td>
                    </tr>
                  )}
                  {items.map((t) => (
                    <tr key={t.id} className="data-row">
                      <td className="mono link-cell">{t.id}</td>
                      <td>{t.name}</td>
                      <td><span className="pill pill--purple">{ORG_LABEL[t.org_type] || t.org_type}</span></td>
                      <td><span className={`pill pill--${STATUS_TONE[t.status] || "muted"}`}>{t.status}</span></td>
                      <td className="mono">{t.capacity ?? "—"}</td>
                      <td>{t.base || "—"}</td>
                      <td className="mono">{coordsLabel(t)}</td>
                      <td>
                        <button className="btn-secondary btn-small" disabled={t.status !== "AVAILABLE"} onClick={() => setAllocateTarget(t)}>
                          Assign
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={8} className="empty-row">No assets in this category yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })
      )}

      {allocateTarget && (
        <div className="drawer-backdrop" onClick={() => { setAllocateTarget(null); setConflictSuggestion(null); }}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <span className="mono">{allocateTarget.id}</span>
              <button onClick={() => { setAllocateTarget(null); setConflictSuggestion(null); }} className="drawer-close"><X size={16} /></button>
            </div>
            <h2>{allocateTarget.name}</h2>
            <p className="text-secondary">{ORG_LABEL[allocateTarget.org_type] || allocateTarget.org_type} · {allocateTarget.base || "Base unknown"}</p>
            <h3>Assign to incident</h3>
            {allocateError && <div className="banner banner--error">{allocateError}</div>}
            {conflictSuggestion && (
              <SuggestionCard suggestion={conflictSuggestion} onConfirm={handleConfirmSuggestion} onDismiss={() => setConflictSuggestion(null)} />
            )}
            {!pendingIncidents || pendingIncidents.length === 0 ? (
              <p className="text-secondary">No incidents awaiting allocation right now.</p>
            ) : (
              <div className="allocate-list">
                {pendingIncidents.map((inc) => (
                  <button key={inc.id} className="allocate-row" disabled={allocating} onClick={() => handleAllocate(inc.id)}>
                    <div>
                      <span className="mono link-cell">#{shortId(inc.id)}</span>
                      <span className="text-secondary"> · {inc.user_id}</span>
                    </div>
                    <span className={`pill pill--${inc.severity === "CRITICAL" ? "red" : "orange"}`}>{inc.severity}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}