"""
tasks/suggest.py
Background task fired by routers/sos.py on every new SOS.

Pipeline:
  1. Fetch nearby facilities from Overpass (OSM) within 5km
  2. Query facility_teams table for pre-assigned AVAILABLE teams
  3. Filter OSRM results to only facilities with an available team
  4. Run A* to pick the best facility+team
  5. Fetch route polyline for the winning facility
  6. Emit "incident:suggestion" socket event to all connected dashboards

The dispatcher then sees the SuggestionPanel and can Confirm or Override.
If no eligible teams exist, no socket event is emitted — the dispatcher
falls back to manual allocation as before.
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import AsyncSessionLocal
from models.team import Team, TeamStatus
from models.facility_team import FacilityTeam
from schemas.facility_team_out import FacilityTeamOut, SuggestionOut
from services.places import fetch_nearby_facilities, fetch_road_distances, fetch_route_polyline
from services.astar import run_astar
from socket_manager import sio

SEARCH_RADIUS_M = 5000   # 5 km


async def run_suggest_pipeline(incident_id: str, victim_lat: float, victim_lng: float):
    """
    Entry point called by BackgroundTasks in routers/sos.py.
    Opens its own DB session (background tasks can't reuse the request session).
    Silently no-ops on any error so a suggestion failure never breaks the SOS flow.
    """
    try:
        await _suggest(incident_id, victim_lat, victim_lng)
    except Exception as exc:
        # Log but never raise — the SOS was already persisted successfully
        print(f"[suggest] pipeline error for incident {incident_id}: {exc}")


async def _suggest(incident_id: str, victim_lat: float, victim_lng: float):
    # ── Step 1: Overpass → nearby facilities ──────────────────────────────
    facilities = await fetch_nearby_facilities(victim_lat, victim_lng, SEARCH_RADIUS_M)
    if not facilities:
        print(f"[suggest] no Overpass facilities found near {victim_lat},{victim_lng}")
        return

    place_ids = [f["place_id"] for f in facilities]

    # ── Step 2: DB → facility_teams with AVAILABLE teams ──────────────────
    async with AsyncSessionLocal() as db:
        ft_result = await db.execute(
            select(FacilityTeam, Team)
            .join(Team, Team.id == FacilityTeam.team_id)
            .where(
                FacilityTeam.place_id.in_(place_ids),
                Team.status == TeamStatus.AVAILABLE,
            )
        )
        rows = ft_result.all()   # list of (FacilityTeam, Team) tuples

    if not rows:
        print(f"[suggest] no AVAILABLE teams at nearby facilities for incident {incident_id}")
        return

    # Build a lookup: place_id → (FacilityTeam, Team)
    facility_team_map: dict[str, tuple[FacilityTeam, Team]] = {
        row.FacilityTeam.place_id: (row.FacilityTeam, row.Team)
        for row in rows
    }

    # ── Step 3: Filter facilities to only those with an available team ─────
    eligible_facilities = [f for f in facilities if f["place_id"] in facility_team_map]
    if not eligible_facilities:
        return

    # ── Step 4: OSRM Table → road distances ───────────────────────────────
    osrm_results = await fetch_road_distances(victim_lat, victim_lng, eligible_facilities)
    if not osrm_results:
        return

    # ── Step 5: A* → winning facility ─────────────────────────────────────
    astar_out = run_astar(victim_lat, victim_lng, osrm_results)
    if not astar_out:
        return

    best_result, path_labels = astar_out
    best_place_id = best_result["facility"]["place_id"]
    facility_team, team = facility_team_map[best_place_id]

    # ── Step 6: Route polyline for Leaflet map ─────────────────────────────
    route_coords = await fetch_route_polyline(
        victim_lat, victim_lng,
        facility_team.latitude, facility_team.longitude,
    )

    # ── Step 7: Emit socket event ──────────────────────────────────────────
    suggestion = SuggestionOut(
        incident_id=incident_id,
        facility_team=FacilityTeamOut.model_validate(facility_team),
        team_name=team.name,
        team_category=team.category,
        team_org_type=team.org_type,
        distance_km=best_result["distance_km"],
        eta_minutes=best_result["eta_minutes"],
        route_coords=route_coords,
        path_labels=path_labels,
    )

    await sio.emit("incident:suggestion", suggestion.model_dump(mode="json"))
    print(
        f"[suggest] emitted suggestion for incident {incident_id}: "
        f"{team.name} @ {facility_team.place_name} "
        f"({best_result['distance_km']} km, {best_result['eta_minutes']} min)"
    )