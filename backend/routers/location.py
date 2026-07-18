"""
routers/location.py
- POST /incidents/{incident_id}/location   -> victim app pings this every 5-10 sec
- GET  /incidents/{incident_id}/location   -> recent GPS history (for dashboard map)
- GET  /incidents/{incident_id}/prediction -> basic offline prediction (distance + heading)

Note: this is the "v1" prediction (Step 1-6 of the design doc) - average speed,
offline duration, straight-line estimated distance, and heading. Road-snapping
and fork-branching (services/astar.py-style routing) is a v2 addition on top
of this, once the basic math is confirmed working.
"""
from datetime import datetime, timedelta
from statistics import mean

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.incident import Incident
from models.incident_location_history import IncidentLocationHistory
from schemas.location_ping import LocationPingCreate, LocationPingOut, PredictionOut

router = APIRouter(prefix="/incidents", tags=["location"])

MAX_HISTORY_POINTS = 20          # how many points we keep/consider per incident
OFFLINE_THRESHOLD_MINUTES = 5    # no ping for this long -> considered offline


async def _get_incident_or_404(db: AsyncSession, incident_id) -> Incident:
    incident = await db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.post("/{incident_id}/location", response_model=LocationPingOut)
async def add_location_ping(
    incident_id,
    payload: LocationPingCreate,
    db: AsyncSession = Depends(get_db),
):
    # confirm the incident actually exists before storing a ping for it
    await _get_incident_or_404(db, incident_id)

    ping = IncidentLocationHistory(
        incident_id=incident_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        speed=payload.speed,
        heading=payload.heading,
        accuracy=payload.accuracy,
    )
    db.add(ping)
    await db.commit()
    await db.refresh(ping)
    return ping


@router.get("/{incident_id}/location", response_model=list[LocationPingOut])
async def get_location_history(
    incident_id,
    limit: int = MAX_HISTORY_POINTS,
    db: AsyncSession = Depends(get_db),
):
    await _get_incident_or_404(db, incident_id)

    result = await db.execute(
        select(IncidentLocationHistory)
        .where(IncidentLocationHistory.incident_id == incident_id)
        .order_by(IncidentLocationHistory.recorded_at.desc())
        .limit(limit)
    )
    points = result.scalars().all()
    # return oldest -> newest, easier for the frontend to draw a path
    return list(reversed(points))


@router.get("/{incident_id}/prediction", response_model=PredictionOut)
async def get_prediction(
    incident_id,
    db: AsyncSession = Depends(get_db),
):
    await _get_incident_or_404(db, incident_id)

    result = await db.execute(
        select(IncidentLocationHistory)
        .where(IncidentLocationHistory.incident_id == incident_id)
        .order_by(IncidentLocationHistory.recorded_at.desc())
        .limit(MAX_HISTORY_POINTS)
    )
    points = list(reversed(result.scalars().all()))  # oldest -> newest

    if not points:
        raise HTTPException(
            status_code=404,
            detail="No location pings recorded yet for this incident",
        )

    last = points[-1]
    now = datetime.utcnow()
    offline_minutes = (now - last.recorded_at).total_seconds() / 60
    is_offline = offline_minutes >= OFFLINE_THRESHOLD_MINUTES

    speeds = [p.speed for p in points if p.speed is not None]
    average_speed = mean(speeds) if speeds else None

    estimated_distance = None
    if is_offline and average_speed is not None:
        estimated_distance = average_speed * (offline_minutes * 60)

    return PredictionOut(
        incident_id=incident_id,
        last_latitude=last.latitude,
        last_longitude=last.longitude,
        last_recorded_at=last.recorded_at,
        offline_minutes=round(offline_minutes, 2),
        average_speed=average_speed,
        heading=last.heading,
        estimated_distance_meters=(
            round(estimated_distance, 1) if estimated_distance is not None else None
        ),
        is_offline=is_offline,
        history=points,
    )