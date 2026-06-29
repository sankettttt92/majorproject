"""
validation/crowd.py
Counts recent SOS calls clustered near this location — a real flood
produces nearby clusters, a spoofed call usually doesn't.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.incident import Incident
from validation.location import _haversine_meters


@dataclass
class CrowdResult:
    nearby_incident_count: int
    score: int


async def check_crowd_density(db: AsyncSession, lat: float, lon: float, radius_m: float = 1000) -> CrowdResult:
    window_start = datetime.utcnow() - timedelta(minutes=30)
    result = await db.execute(
        select(Incident).where(Incident.created_at >= window_start)
    )
    recent = result.scalars().all()

    nearby = [
        inc for inc in recent
        if _haversine_meters(lat, lon, inc.latitude, inc.longitude) <= radius_m
    ]
    count = len(nearby)
    score = min(100, count * 20)
    return CrowdResult(nearby_incident_count=count, score=score)