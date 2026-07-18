"""
routers/teams.py
Handles field-device GPS pings from React Native.
POST /teams/{id}/location  →  updates DB + emits team:location socket event
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from datetime import datetime, timezone

from database import get_db
from socket_manager import sio

router = APIRouter(prefix="/teams", tags=["teams"])


class LocationPing(BaseModel):
    latitude: float
    longitude: float


@router.post("/{team_id}/location")
async def update_team_location(
    team_id: str,
    body: LocationPing,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("SELECT id FROM teams WHERE id = :id"),
        {"id": team_id},
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Team not found")

    await db.execute(
        text("""
            UPDATE teams
               SET current_lat  = :lat,
                   current_lng  = :lng,
                   last_ping_at = :ts
             WHERE id = :id
        """),
        {
            "lat": body.latitude,
            "lng": body.longitude,
            "ts":  datetime.now(timezone.utc),
            "id":  team_id,
        },
    )
    await db.commit()

    # broadcast to all connected dashboard clients
    await sio.emit("team:location", {
        "team_id":   team_id,
        "latitude":  body.latitude,
        "longitude": body.longitude,
    })

    return {"ok": True}
