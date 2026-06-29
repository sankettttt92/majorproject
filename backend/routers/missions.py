"""
routers/missions.py
GET /missions/active
Returns every ACTIVE/RESPONDING incident that has at least one allocated team,
including that team's current GPS and the stored OSRM route_coords.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from database import get_db

router = APIRouter(prefix="/missions", tags=["missions"])


@router.get("/active")
async def get_active_missions(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(text("""
        SELECT
            i.id            AS incident_id,
            i.latitude      AS victim_lat,
            i.longitude     AS victim_lng,
            i.severity,
            i.status        AS incident_status,
            i.description,
            t.id            AS team_id,
            t.name          AS team_name,
            t.org_type,
            t.status        AS team_status,
            t.current_lat,
            t.current_lng,
            t.last_ping_at,
            ia.route_coords,
            ia.eta_minutes,
            ia.distance_km,
            ft.place_name   AS base_facility_name,
            ft.place_type   AS base_facility_type,
            ft.latitude     AS base_lat,
            ft.longitude    AS base_lng
        FROM incidents i
        JOIN incident_allocations ia ON ia.incident_id = i.id
        JOIN teams t                 ON t.id = ia.team_id
        LEFT JOIN facility_teams ft  ON ft.team_id = t.id
        WHERE i.status IN ('ACTIVE', 'RESPONDING')
        ORDER BY i.created_at DESC
    """))

    # group teams under their incident
    missions: dict = {}
    for r in rows.mappings():
        iid = str(r["incident_id"])
        if iid not in missions:
            missions[iid] = {
                "incident_id":     iid,
                "victim_lat":      r["victim_lat"],
                "victim_lng":      r["victim_lng"],
                "severity":        r["severity"],
                "status":          r["incident_status"],
                "description":     r["description"],
                "allocated_teams": [],
            }
        missions[iid]["allocated_teams"].append({
            "team_id":             str(r["team_id"]),
            "team_name":           r["team_name"],
            "org_type":            r["org_type"],
            "team_status":         r["team_status"],
            "current_lat":         r["current_lat"],
            "current_lng":         r["current_lng"],
            "last_ping_at":        str(r["last_ping_at"]) if r["last_ping_at"] else None,
            "route_coords":        r["route_coords"],
            "eta_minutes":         r["eta_minutes"],
            "distance_km":         r["distance_km"],
            "base_facility_name":  r["base_facility_name"],
            "base_facility_type":  r["base_facility_type"],
            "base_lat":            r["base_lat"],
            "base_lng":            r["base_lng"],
        })

    return list(missions.values())