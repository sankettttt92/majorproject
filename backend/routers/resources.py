# """
# routers/resources.py
# Resource Allocation Center endpoints — teams, incidents, allocation, and
# the new v2 facility management + A*-backed allocation guard.

# New in v2:
#   POST /facilities/assign-team          → pre-assign a team to an OSM facility
#   GET  /facilities/nearby/{incident_id} → list eligible facilities near an incident
#   POST /incidents/{id}/allocate         → guards against DEPLOYED teams:
#                                           returns 409 + A* suggestion instead of error string

# New in v3 (multi-team):
#   POST /incidents/{id}/allocate-multi   → A* selects best N available teams,
#                                           fetches routes for all concurrently,
#                                           deploys them and returns ranked assignments

# New in v4:
#   DELETE /teams/{id}                    → delete a team (blocked while DEPLOYED).
#                                           Relies on DB-level ON DELETE CASCADE for
#                                           FacilityTeam and IncidentAllocation rows.
# """
# from datetime import datetime

# from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
# from sqlalchemy.ext.asyncio import AsyncSession
# from sqlalchemy import select

# from database import get_db
# from models.team import Team, TeamStatus
# from models.incident import Incident, IncidentStatus
# from models.incident_allocation import IncidentAllocation
# from models.facility_team import FacilityTeam
# from schemas.team_out import TeamOut
# from schemas.team_create import TeamCreate
# from schemas.incident_out import IncidentOut
# from schemas.facility_team_create import FacilityTeamCreate
# from schemas.facility_team_out import (
#     FacilityTeamOut,
#     SuggestionOut,
#     TeamAssignmentOut,
#     MultiSuggestionOut,
# )
# from socket_manager import emit_incident
# from services.places import (
#     fetch_nearby_facilities,
#     fetch_road_distances,
#     fetch_route_polyline,
#     fetch_route_polylines_multi,
# )

# from services.astar import run_astar, run_astar_multi

# router = APIRouter(tags=["resources"])


# # ── Teams ──────────────────────────────────────────────────────────────────────

# @router.get("/teams", response_model=list[TeamOut])
# async def get_teams(db: AsyncSession = Depends(get_db)):
#     result = await db.execute(select(Team).order_by(Team.category, Team.name))
#     return result.scalars().all()


# @router.post("/teams", response_model=TeamOut, status_code=201)
# async def create_team(payload: TeamCreate, db: AsyncSession = Depends(get_db)):
#     team = Team(
#         name=payload.name,
#         category=payload.category,
#         org_type=payload.org_type,
#         capacity=payload.capacity,
#         base=payload.base,
#         latitude=payload.latitude,
#         longitude=payload.longitude,
#         status=TeamStatus.AVAILABLE,
#     )
#     db.add(team)
#     await db.commit()
#     await db.refresh(team)
#     return team


# @router.delete("/teams/{team_id}", status_code=204)
# async def delete_team(team_id: str, db: AsyncSession = Depends(get_db)):
#     """
#     Delete a team.
#     DELETE /teams/{id}

#     Blocked while the team is DEPLOYED — caller must unallocate first.
#     FacilityTeam and IncidentAllocation rows for this team are removed
#     automatically by the DB's ON DELETE CASCADE (see models/team.py FKs).
#     """
#     team_result = await db.execute(select(Team).where(Team.id == team_id))
#     team = team_result.scalar_one_or_none()
#     if not team:
#         raise HTTPException(status_code=404, detail="Team not found")

#     if team.status == TeamStatus.DEPLOYED:
#         raise HTTPException(
#             status_code=409,
#             detail="Cannot delete a team that is currently deployed. Unallocate it first.",
#         )

#     await db.delete(team)
#     await db.commit()
#     return None


# # ── Facility–Team Assignment ───────────────────────────────────────────────────

# @router.post("/facilities/assign-team", response_model=FacilityTeamOut, status_code=201)
# async def assign_team_to_facility(
#     payload: FacilityTeamCreate,
#     db: AsyncSession = Depends(get_db),
# ):
#     team_result = await db.execute(select(Team).where(Team.id == payload.team_id))
#     team = team_result.scalar_one_or_none()
#     if not team:
#         raise HTTPException(status_code=404, detail="Team not found")

#     existing_result = await db.execute(
#         select(FacilityTeam).where(FacilityTeam.team_id == payload.team_id)
#     )
#     existing = existing_result.scalar_one_or_none()
#     if existing:
#         await db.delete(existing)
#         await db.flush()  # force DELETE before INSERT to avoid unique constraint hit

#     ft = FacilityTeam(
#         team_id=payload.team_id,
#         place_id=payload.place_id,
#         place_name=payload.place_name,
#         place_type=payload.place_type,
#         latitude=payload.latitude,
#         longitude=payload.longitude,
#     )
#     db.add(ft)
#     await db.commit()
#     await db.refresh(ft)
#     return ft


# @router.get("/facilities/nearby/{incident_id}", response_model=list[FacilityTeamOut])
# async def get_facilities_nearby(
#     incident_id: str,
#     db: AsyncSession = Depends(get_db),
# ):
#     incident_result = await db.execute(select(Incident).where(Incident.id == incident_id))
#     incident = incident_result.scalar_one_or_none()
#     if not incident:
#         raise HTTPException(status_code=404, detail="Incident not found")

#     nearby = await fetch_nearby_facilities(incident.latitude, incident.longitude)
#     if not nearby:
#         return []

#     place_ids = [f["place_id"] for f in nearby]

#     ft_result = await db.execute(
#         select(FacilityTeam)
#         .join(Team, Team.id == FacilityTeam.team_id)
#         .where(
#             FacilityTeam.place_id.in_(place_ids),
#             Team.status == TeamStatus.AVAILABLE,
#         )
#     )
#     return ft_result.scalars().all()


# # ── Incidents ─────────────────────────────────────────────────────────────────

# @router.get("/incidents/pending", response_model=list[IncidentOut])
# async def get_pending_incidents(db: AsyncSession = Depends(get_db)):
#     result = await db.execute(
#         select(Incident)
#         .where(Incident.status == IncidentStatus.VERIFIED)
#         .order_by(Incident.priority.desc(), Incident.created_at.desc())
#     )
#     return result.scalars().all()


# @router.post("/incidents/{incident_id}/allocate")
# async def allocate_teams(
#     incident_id: str,
#     body: dict,
#     background_tasks: BackgroundTasks,
#     db: AsyncSession = Depends(get_db),
# ):
#     team_ids = body.get("team_ids") or []
#     if not team_ids:
#         raise HTTPException(status_code=422, detail="team_ids is required")

#     incident_result = await db.execute(select(Incident).where(Incident.id == incident_id))
#     incident = incident_result.scalar_one_or_none()
#     if not incident:
#         raise HTTPException(status_code=404, detail="Incident not found")

#     teams_result = await db.execute(select(Team).where(Team.id.in_(team_ids)))
#     teams = teams_result.scalars().all()
#     if len(teams) != len(team_ids):
#         raise HTTPException(status_code=404, detail="One or more teams not found")

#     # ── v2 GUARD: any team DEPLOYED? ─────────────────────────────────────
#     deployed = [t for t in teams if t.status == TeamStatus.DEPLOYED]
#     if deployed:
#         suggestion = await _build_astar_suggestion(
#             db, incident_id, incident.latitude, incident.longitude,
#             exclude_team_ids={str(t.id) for t in deployed},
#         )
#         raise HTTPException(
#             status_code=409,
#             detail={
#                 "conflict": True,
#                 "deployed_teams": [t.name for t in deployed],
#                 "suggestion": suggestion.model_dump(mode="json") if suggestion else None,
#             },
#         )
#     # ─────────────────────────────────────────────────────────────────────

#     for team in teams:
#         db.add(IncidentAllocation(incident_id=incident.id, team_id=team.id))
#         team.status = TeamStatus.DEPLOYED

#     incident.status = IncidentStatus.DISPATCHED

#     await db.commit()
#     await db.refresh(incident)

#     incident_out = IncidentOut.model_validate(incident)
#     background_tasks.add_task(emit_incident, incident_out.model_dump(mode="json"))

#     return incident_out


# @router.post("/incidents/{incident_id}/allocate-multi", response_model=MultiSuggestionOut)
# async def allocate_teams_multi(
#     incident_id: str,
#     body: dict,
#     background_tasks: BackgroundTasks,
#     db: AsyncSession = Depends(get_db),
# ):
#     """
#     Multi-team A* allocation.
#     POST /incidents/{id}/allocate-multi
#     body: { "n_teams": 3 }   ← how many teams you want assigned (default 1)

#     1. Fetches nearby OSM facilities via Overpass.
#     2. Gets road distances to all of them via OSRM Table (one call).
#     3. Runs A* repeatedly to pick the best N available teams (closest first,
#        no team selected twice).
#     4. Fetches route polylines for all winners concurrently.
#     5. Deploys all selected teams + marks incident DISPATCHED.
#     6. Returns MultiSuggestionOut with ranked assignments.
#     """
#     n_teams = int(body.get("n_teams", 1))
#     if n_teams < 1:
#         raise HTTPException(status_code=422, detail="n_teams must be >= 1")

#     # ── 1. Load incident ──────────────────────────────────────────────────
#     incident_result = await db.execute(select(Incident).where(Incident.id == incident_id))
#     incident = incident_result.scalar_one_or_none()
#     if not incident:
#         raise HTTPException(status_code=404, detail="Incident not found")

#     # ── 2. Find nearby facilities from OSM ────────────────────────────────
#     facilities = await fetch_nearby_facilities(incident.latitude, incident.longitude)
#     if not facilities:
#         raise HTTPException(status_code=404, detail="No facilities found near this incident")

#     place_ids = [f["place_id"] for f in facilities]

#     # ── 3. Load facility→team assignments (AVAILABLE teams only) ──────────
#     ft_result = await db.execute(
#         select(FacilityTeam, Team)
#         .join(Team, Team.id == FacilityTeam.team_id)
#         .where(
#             FacilityTeam.place_id.in_(place_ids),
#             Team.status == TeamStatus.AVAILABLE,
#         )
#     )
#     rows = ft_result.all()
#     if not rows:
#         raise HTTPException(
#             status_code=409,
#             detail="No available teams are assigned to facilities near this incident",
#         )

#     # Build lookup maps
#     # place_id → (FacilityTeam ORM obj, Team ORM obj)
#     facility_team_map: dict[str, tuple[FacilityTeam, Team]] = {
#         row.FacilityTeam.place_id: (row.FacilityTeam, row.Team)
#         for row in rows
#     }
#     # place_id → team_id string  (needed by run_astar_multi)
#     place_to_team_id: dict[str, str] = {
#         place_id: str(ft.team_id)
#         for place_id, (ft, _) in facility_team_map.items()
#     }

#     # ── 4. OSRM road distances (one call for all facilities) ──────────────
#     osrm_results = await fetch_road_distances(
#         incident.latitude, incident.longitude, facilities
#     )
#     if not osrm_results:
#         raise HTTPException(status_code=502, detail="Could not reach routing service")

#     # ── 5. Multi-team A* ──────────────────────────────────────────────────
#     astar_assignments = run_astar_multi(
#         victim_lat=incident.latitude,
#         victim_lng=incident.longitude,
#         osrm_results=osrm_results,
#         team_facility_map=place_to_team_id,
#         n_teams=n_teams,
#     )
#     if not astar_assignments:
#         raise HTTPException(status_code=409, detail="A* found no reachable teams")

#     # ── 6. Fetch all route polylines concurrently ─────────────────────────
#     destinations = [
#         (
#             facility_team_map[result["facility"]["place_id"]][0].latitude,
#             facility_team_map[result["facility"]["place_id"]][0].longitude,
#         )
#         for result, _ in astar_assignments
#     ]
#     route_coords_list = await fetch_route_polylines_multi(
#         incident.latitude, incident.longitude, destinations
#     )

#     # ── 7. Persist: deploy teams + create allocations ─────────────────────
#     assignments_out: list[TeamAssignmentOut] = []

#     for (result, path_labels), route_coords in zip(astar_assignments, route_coords_list):
#         place_id = result["facility"]["place_id"]
#         facility_team_orm, team_orm = facility_team_map[place_id]

#         # Create allocation record
#         db.add(IncidentAllocation(
#             incident_id=incident.id,
#             team_id=team_orm.id,
#         ))

#         # Mark team as DEPLOYED
#         team_orm.status = TeamStatus.DEPLOYED

#         assignments_out.append(
#             TeamAssignmentOut(
#                 facility_team=FacilityTeamOut.model_validate(facility_team_orm),
#                 team_id=str(team_orm.id),
#                 team_name=team_orm.name,
#                 team_category=team_orm.category,
#                 team_org_type=team_orm.org_type,
#                 distance_km=result["distance_km"],
#                 eta_minutes=result["eta_minutes"],
#                 route_coords=route_coords,
#                 path_labels=path_labels,
#             )
#         )

#     incident.status = IncidentStatus.DISPATCHED

#     await db.commit()
#     await db.refresh(incident)

#     incident_out = IncidentOut.model_validate(incident)
#     background_tasks.add_task(emit_incident, incident_out.model_dump(mode="json"))

#     return MultiSuggestionOut(
#         incident_id=incident_id,
#         assignments=assignments_out,
#         total_teams_found=len(assignments_out),
#         total_teams_requested=n_teams,
#     )


# @router.post("/incidents/{incident_id}/unallocate", response_model=IncidentOut)
# async def unallocate_team(
#     incident_id: str,
#     body: dict,
#     background_tasks: BackgroundTasks,
#     db: AsyncSession = Depends(get_db),
# ):
#     team_id = body.get("team_id")
#     if not team_id:
#         raise HTTPException(status_code=422, detail="team_id is required")

#     incident_result = await db.execute(select(Incident).where(Incident.id == incident_id))
#     incident = incident_result.scalar_one_or_none()
#     if not incident:
#         raise HTTPException(status_code=404, detail="Incident not found")

#     allocation_result = await db.execute(
#         select(IncidentAllocation).where(
#             IncidentAllocation.incident_id == incident_id,
#             IncidentAllocation.team_id == team_id,
#             IncidentAllocation.released_at.is_(None),
#         )
#     )
#     allocation = allocation_result.scalar_one_or_none()
#     if not allocation:
#         raise HTTPException(status_code=404, detail="Active allocation not found")

#     allocation.released_at = datetime.utcnow()

#     team_result = await db.execute(select(Team).where(Team.id == team_id))
#     team = team_result.scalar_one_or_none()
#     if team:
#         team.status = TeamStatus.AVAILABLE

#     remaining_result = await db.execute(
#         select(IncidentAllocation).where(
#             IncidentAllocation.incident_id == incident_id,
#             IncidentAllocation.released_at.is_(None),
#         )
#     )
#     remaining = remaining_result.scalars().all()
#     if not remaining:
#         incident.status = IncidentStatus.VERIFIED

#     await db.commit()
#     await db.refresh(incident)

#     incident_out = IncidentOut.model_validate(incident)
#     background_tasks.add_task(emit_incident, incident_out.model_dump(mode="json"))

#     return incident_out


# # ── Internal helper ───────────────────────────────────────────────────────────

# async def _build_astar_suggestion(
#     db: AsyncSession,
#     incident_id: str,
#     victim_lat: float,
#     victim_lng: float,
#     exclude_team_ids: set[str],
# ) -> SuggestionOut | None:
#     """
#     Re-run the full A* pipeline for a conflict response.
#     Excludes the already-DEPLOYED teams from consideration.
#     Returns SuggestionOut or None if no alternative exists.
#     """
#     facilities = await fetch_nearby_facilities(victim_lat, victim_lng)
#     if not facilities:
#         return None

#     place_ids = [f["place_id"] for f in facilities]

#     ft_result = await db.execute(
#         select(FacilityTeam, Team)
#         .join(Team, Team.id == FacilityTeam.team_id)
#         .where(
#             FacilityTeam.place_id.in_(place_ids),
#             Team.status == TeamStatus.AVAILABLE,
#             Team.id.not_in(exclude_team_ids),
#         )
#     )
#     rows = ft_result.all()
#     if not rows:
#         return None

#     facility_team_map = {
#         row.FacilityTeam.place_id: (row.FacilityTeam, row.Team)
#         for row in rows
#     }

#     eligible = [f for f in facilities if f["place_id"] in facility_team_map]
#     if not eligible:
#         return None

#     osrm_results = await fetch_road_distances(victim_lat, victim_lng, eligible)
#     if not osrm_results:
#         return None

#     astar_out = run_astar(victim_lat, victim_lng, osrm_results)
#     if not astar_out:
#         return None

#     best_result, path_labels = astar_out
#     facility_team, team = facility_team_map[best_result["facility"]["place_id"]]

#     route_coords = await fetch_route_polyline(
#         victim_lat, victim_lng,
#         facility_team.latitude, facility_team.longitude,
#     )

#     return SuggestionOut(
#         incident_id=incident_id,
#         facility_team=FacilityTeamOut.model_validate(facility_team),
#         team_name=team.name,
#         team_category=team.category,
#         team_org_type=team.org_type,
#         distance_km=best_result["distance_km"],
#         eta_minutes=best_result["eta_minutes"],
#         route_coords=route_coords,
#         path_labels=path_labels,
#     )

"""
routers/resources.py
Resource Allocation Center endpoints — teams, incidents, allocation, and
the new v2 facility management + A*-backed allocation guard.

New in v2:
  POST /facilities/assign-team          → pre-assign a team to an OSM facility
  GET  /facilities/nearby/{incident_id} → list eligible facilities near an incident
  POST /incidents/{id}/allocate         → guards against DEPLOYED teams:
                                          returns 409 + A* suggestion instead of error string

New in v3 (multi-team):
  POST /incidents/{id}/allocate-multi   → A* selects best N available teams,
                                          fetches routes for all concurrently,
                                          deploys them and returns ranked assignments

New in v4:
  PATCH /teams/{id}/status              → manually set a team's status
  DELETE /teams/{id}                    → delete a team (only allowed once COMPLETED).
                                          Relies on DB-level ON DELETE CASCADE for
                                          FacilityTeam and IncidentAllocation rows.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models.team import Team, TeamStatus
from models.incident import Incident, IncidentStatus
from models.incident_allocation import IncidentAllocation
from models.facility_team import FacilityTeam
from schemas.team_out import TeamOut
from schemas.team_create import TeamCreate
from schemas.team_status_update import TeamStatusUpdate
from schemas.incident_out import IncidentOut
from schemas.facility_team_create import FacilityTeamCreate
from schemas.facility_team_out import (
    FacilityTeamOut,
    SuggestionOut,
    TeamAssignmentOut,
    MultiSuggestionOut,
)
from socket_manager import emit_incident
from services.places import (
    fetch_nearby_facilities,
    fetch_road_distances,
    fetch_route_polyline,
    fetch_route_polylines_multi,
)
from schemas.facility_search_out import FacilitySearchOut

from services.astar import run_astar, run_astar_multi

router = APIRouter(tags=["resources"])


# ── Teams ──────────────────────────────────────────────────────────────────────

@router.get("/teams", response_model=list[TeamOut])
async def get_teams(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Team).order_by(Team.category, Team.name))
    return result.scalars().all()


@router.post("/teams", response_model=TeamOut, status_code=201)
async def create_team(payload: TeamCreate, db: AsyncSession = Depends(get_db)):
    team = Team(
        name=payload.name,
        category=payload.category,
        org_type=payload.org_type,
        capacity=payload.capacity,
        base=payload.base,
        latitude=payload.latitude,
        longitude=payload.longitude,
        status=TeamStatus.AVAILABLE,
    )
    db.add(team)
    await db.commit()
    await db.refresh(team)
    return team


@router.patch("/teams/{team_id}/status", response_model=TeamOut)
async def update_team_status(
    team_id: str,
    payload: TeamStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    Manually set a team's status from the dashboard dialog.
    PATCH /teams/{id}/status   body: { "status": "COMPLETED" }
    """
    team_result = await db.execute(select(Team).where(Team.id == team_id))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    team.status = payload.status
    await db.commit()
    await db.refresh(team)
    return team


@router.delete("/teams/{team_id}", status_code=204)
async def delete_team(team_id: str, db: AsyncSession = Depends(get_db)):
    """
    Delete a team. Only allowed once status is COMPLETED.
    DELETE /teams/{id}
    """
    team_result = await db.execute(select(Team).where(Team.id == team_id))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.status != TeamStatus.COMPLETED:
        raise HTTPException(
            status_code=409,
            detail="Only teams marked COMPLETED can be deleted.",
        )
    await db.delete(team)
    await db.commit()
    return None


# ── Facility–Team Assignment ───────────────────────────────────────────────────

@router.post("/facilities/assign-team", response_model=FacilityTeamOut, status_code=201)
async def assign_team_to_facility(
    payload: FacilityTeamCreate,
    db: AsyncSession = Depends(get_db),
):
    team_result = await db.execute(select(Team).where(Team.id == payload.team_id))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    existing_result = await db.execute(
        select(FacilityTeam).where(FacilityTeam.team_id == payload.team_id)
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.flush()  # force DELETE before INSERT to avoid unique constraint hit

    ft = FacilityTeam(
        team_id=payload.team_id,
        place_id=payload.place_id,
        place_name=payload.place_name,
        place_type=payload.place_type,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(ft)
    await db.commit()
    await db.refresh(ft)
    return ft


@router.get("/facilities/nearby/{incident_id}", response_model=list[FacilityTeamOut])
async def get_facilities_nearby(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
):
    incident_result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = incident_result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    nearby = await fetch_nearby_facilities(incident.latitude, incident.longitude)
    if not nearby:
        return []

    place_ids = [f["place_id"] for f in nearby]

    ft_result = await db.execute(
        select(FacilityTeam)
        .join(Team, Team.id == FacilityTeam.team_id)
        .where(
            FacilityTeam.place_id.in_(place_ids),
            Team.status == TeamStatus.AVAILABLE,
        )
    )
    return ft_result.scalars().all()

@router.get("/facilities/search", response_model=list[FacilitySearchOut])
async def search_facilities(lat: float, lng: float, radius_m: int = 5000):
    """
    Raw lat/lng facility search — proxies Overpass server-side to avoid
    CORS issues when calling it directly from the browser.
    GET /facilities/search?lat=19.076&lng=72.8777&radius_m=5000

    Used by the frontend facility-assignment drawer for team bases,
    geocoded places, or manually entered coordinates — unlike
    /facilities/nearby/{incident_id}, this doesn't require an incident
    or filter by team availability.
    """
    facilities = await fetch_nearby_facilities(lat, lng, radius_m)
    return facilities


# ── Incidents ─────────────────────────────────────────────────────────────────

@router.get("/incidents/pending", response_model=list[IncidentOut])
async def get_pending_incidents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Incident)
        .where(Incident.status == IncidentStatus.VERIFIED)
        .order_by(Incident.priority.desc(), Incident.created_at.desc())
    )
    return result.scalars().all()


@router.post("/incidents/{incident_id}/allocate")
async def allocate_teams(
    incident_id: str,
    body: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    team_ids = body.get("team_ids") or []
    if not team_ids:
        raise HTTPException(status_code=422, detail="team_ids is required")

    incident_result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = incident_result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    teams_result = await db.execute(select(Team).where(Team.id.in_(team_ids)))
    teams = teams_result.scalars().all()
    if len(teams) != len(team_ids):
        raise HTTPException(status_code=404, detail="One or more teams not found")

    # ── v2 GUARD: any team DEPLOYED? ─────────────────────────────────────
    deployed = [t for t in teams if t.status == TeamStatus.DEPLOYED]
    if deployed:
        suggestion = await _build_astar_suggestion(
            db, incident_id, incident.latitude, incident.longitude,
            exclude_team_ids={str(t.id) for t in deployed},
        )
        raise HTTPException(
            status_code=409,
            detail={
                "conflict": True,
                "deployed_teams": [t.name for t in deployed],
                "suggestion": suggestion.model_dump(mode="json") if suggestion else None,
            },
        )
    # ─────────────────────────────────────────────────────────────────────

    for team in teams:
        db.add(IncidentAllocation(incident_id=incident.id, team_id=team.id))
        team.status = TeamStatus.DEPLOYED

    incident.status = IncidentStatus.DISPATCHED

    await db.commit()
    await db.refresh(incident)

    incident_out = IncidentOut.model_validate(incident)
    background_tasks.add_task(emit_incident, incident_out.model_dump(mode="json"))

    return incident_out


@router.post("/incidents/{incident_id}/allocate-multi", response_model=MultiSuggestionOut)
async def allocate_teams_multi(
    incident_id: str,
    body: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Multi-team A* allocation.
    POST /incidents/{id}/allocate-multi
    body: { "n_teams": 3 }   ← how many teams you want assigned (default 1)

    1. Fetches nearby OSM facilities via Overpass.
    2. Gets road distances to all of them via OSRM Table (one call).
    3. Runs A* repeatedly to pick the best N available teams (closest first,
       no team selected twice).
    4. Fetches route polylines for all winners concurrently.
    5. Deploys all selected teams + marks incident DISPATCHED.
    6. Returns MultiSuggestionOut with ranked assignments.
    """
    n_teams = int(body.get("n_teams", 1))
    if n_teams < 1:
        raise HTTPException(status_code=422, detail="n_teams must be >= 1")

    # ── 1. Load incident ──────────────────────────────────────────────────
    incident_result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = incident_result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    # ── 2. Find nearby facilities from OSM ────────────────────────────────
    facilities = await fetch_nearby_facilities(incident.latitude, incident.longitude)
    if not facilities:
        raise HTTPException(status_code=404, detail="No facilities found near this incident")

    place_ids = [f["place_id"] for f in facilities]

    # ── 3. Load facility→team assignments (AVAILABLE teams only) ──────────
    ft_result = await db.execute(
        select(FacilityTeam, Team)
        .join(Team, Team.id == FacilityTeam.team_id)
        .where(
            FacilityTeam.place_id.in_(place_ids),
            Team.status == TeamStatus.AVAILABLE,
        )
    )
    rows = ft_result.all()
    if not rows:
        raise HTTPException(
            status_code=409,
            detail="No available teams are assigned to facilities near this incident",
        )

    # Build lookup maps
    # place_id → (FacilityTeam ORM obj, Team ORM obj)
    facility_team_map: dict[str, tuple[FacilityTeam, Team]] = {
        row.FacilityTeam.place_id: (row.FacilityTeam, row.Team)
        for row in rows
    }
    # place_id → team_id string  (needed by run_astar_multi)
    place_to_team_id: dict[str, str] = {
        place_id: str(ft.team_id)
        for place_id, (ft, _) in facility_team_map.items()
    }

    # ── 4. OSRM road distances (one call for all facilities) ──────────────
    osrm_results = await fetch_road_distances(
        incident.latitude, incident.longitude, facilities
    )
    if not osrm_results:
        raise HTTPException(status_code=502, detail="Could not reach routing service")

    # ── 5. Multi-team A* ──────────────────────────────────────────────────
    astar_assignments = run_astar_multi(
        victim_lat=incident.latitude,
        victim_lng=incident.longitude,
        osrm_results=osrm_results,
        team_facility_map=place_to_team_id,
        n_teams=n_teams,
    )
    if not astar_assignments:
        raise HTTPException(status_code=409, detail="A* found no reachable teams")

    # ── 6. Fetch all route polylines concurrently ─────────────────────────
    destinations = [
        (
            facility_team_map[result["facility"]["place_id"]][0].latitude,
            facility_team_map[result["facility"]["place_id"]][0].longitude,
        )
        for result, _ in astar_assignments
    ]
    route_coords_list = await fetch_route_polylines_multi(
        incident.latitude, incident.longitude, destinations
    )

    # ── 7. Persist: deploy teams + create allocations ─────────────────────
    assignments_out: list[TeamAssignmentOut] = []

    for (result, path_labels), route_coords in zip(astar_assignments, route_coords_list):
        place_id = result["facility"]["place_id"]
        facility_team_orm, team_orm = facility_team_map[place_id]

        # Create allocation record
        db.add(IncidentAllocation(
            incident_id=incident.id,
            team_id=team_orm.id,
        ))

        # Mark team as DEPLOYED
        team_orm.status = TeamStatus.DEPLOYED

        assignments_out.append(
            TeamAssignmentOut(
                facility_team=FacilityTeamOut.model_validate(facility_team_orm),
                team_id=str(team_orm.id),
                team_name=team_orm.name,
                team_category=team_orm.category,
                team_org_type=team_orm.org_type,
                distance_km=result["distance_km"],
                eta_minutes=result["eta_minutes"],
                route_coords=route_coords,
                path_labels=path_labels,
            )
        )

    incident.status = IncidentStatus.DISPATCHED

    await db.commit()
    await db.refresh(incident)

    incident_out = IncidentOut.model_validate(incident)
    background_tasks.add_task(emit_incident, incident_out.model_dump(mode="json"))

    return MultiSuggestionOut(
        incident_id=incident_id,
        assignments=assignments_out,
        total_teams_found=len(assignments_out),
        total_teams_requested=n_teams,
    )


@router.post("/incidents/{incident_id}/unallocate", response_model=IncidentOut)
async def unallocate_team(
    incident_id: str,
    body: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    team_id = body.get("team_id")
    if not team_id:
        raise HTTPException(status_code=422, detail="team_id is required")

    incident_result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = incident_result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    allocation_result = await db.execute(
        select(IncidentAllocation).where(
            IncidentAllocation.incident_id == incident_id,
            IncidentAllocation.team_id == team_id,
            IncidentAllocation.released_at.is_(None),
        )
    )
    allocation = allocation_result.scalar_one_or_none()
    if not allocation:
        raise HTTPException(status_code=404, detail="Active allocation not found")

    allocation.released_at = datetime.utcnow()

    team_result = await db.execute(select(Team).where(Team.id == team_id))
    team = team_result.scalar_one_or_none()
    if team:
        team.status = TeamStatus.AVAILABLE

    remaining_result = await db.execute(
        select(IncidentAllocation).where(
            IncidentAllocation.incident_id == incident_id,
            IncidentAllocation.released_at.is_(None),
        )
    )
    remaining = remaining_result.scalars().all()
    if not remaining:
        incident.status = IncidentStatus.VERIFIED

    await db.commit()
    await db.refresh(incident)

    incident_out = IncidentOut.model_validate(incident)
    background_tasks.add_task(emit_incident, incident_out.model_dump(mode="json"))

    return incident_out


# ── Internal helper ───────────────────────────────────────────────────────────

async def _build_astar_suggestion(
    db: AsyncSession,
    incident_id: str,
    victim_lat: float,
    victim_lng: float,
    exclude_team_ids: set[str],
) -> SuggestionOut | None:
    """
    Re-run the full A* pipeline for a conflict response.
    Excludes the already-DEPLOYED teams from consideration.
    Returns SuggestionOut or None if no alternative exists.
    """
    facilities = await fetch_nearby_facilities(victim_lat, victim_lng)
    if not facilities:
        return None

    place_ids = [f["place_id"] for f in facilities]

    ft_result = await db.execute(
        select(FacilityTeam, Team)
        .join(Team, Team.id == FacilityTeam.team_id)
        .where(
            FacilityTeam.place_id.in_(place_ids),
            Team.status == TeamStatus.AVAILABLE,
            Team.id.not_in(exclude_team_ids),
        )
    )
    rows = ft_result.all()
    if not rows:
        return None

    facility_team_map = {
        row.FacilityTeam.place_id: (row.FacilityTeam, row.Team)
        for row in rows
    }

    eligible = [f for f in facilities if f["place_id"] in facility_team_map]
    if not eligible:
        return None

    osrm_results = await fetch_road_distances(victim_lat, victim_lng, eligible)
    if not osrm_results:
        return None

    astar_out = run_astar(victim_lat, victim_lng, osrm_results)
    if not astar_out:
        return None

    best_result, path_labels = astar_out
    facility_team, team = facility_team_map[best_result["facility"]["place_id"]]

    route_coords = await fetch_route_polyline(
        victim_lat, victim_lng,
        facility_team.latitude, facility_team.longitude,
    )

    return SuggestionOut(
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