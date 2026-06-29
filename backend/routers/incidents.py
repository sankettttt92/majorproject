"""
routers/incidents.py
Read endpoints the React dashboard polls/calls.
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from database import get_db
from models.incident import Incident, IncidentStatus
from schemas.incident_out import IncidentOut

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("/active", response_model=list[IncidentOut])
async def get_active_incidents(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=100, le=500),
):
    """
    Returns all non-terminal incidents — what the dashboard shows live.
    PENDING + VERIFIED + DISPATCHED are all "in flight".
    RESOLVED and REJECTED are excluded (they're done).
    """
    result = await db.execute(
        select(Incident)
        .where(
            Incident.status.in_([
                IncidentStatus.PENDING,
                IncidentStatus.VERIFIED,
                IncidentStatus.DISPATCHED,
            ])
        )
        .order_by(desc(Incident.priority), desc(Incident.created_at))
        .limit(limit)
    )
    return result.scalars().all()


@router.get("", response_model=list[IncidentOut])
async def get_all_incidents(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=200, le=1000),
):
    """All incidents regardless of status — for the full history view."""
    result = await db.execute(
        select(Incident).order_by(desc(Incident.created_at)).limit(limit)
    )
    return result.scalars().all()


@router.get("/{incident_id}", response_model=IncidentOut)
async def get_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.patch("/{incident_id}/status", response_model=IncidentOut)
async def update_incident_status(
    incident_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Let the dashboard manually move an incident through the pipeline.
    PATCH /incidents/{id}/status   body: { "status": "DISPATCHED" }
    """
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    new_status = body.get("status")
    if new_status not in IncidentStatus.__members__:
        raise HTTPException(status_code=422, detail=f"Invalid status: {new_status}")

    incident.status = IncidentStatus[new_status]
    await db.commit()
    await db.refresh(incident)
    return incident