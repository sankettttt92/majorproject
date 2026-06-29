"""
tasks/persist.py
Writes the scored incident to Postgres.
"""
from sqlalchemy.ext.asyncio import AsyncSession

from models.incident import Incident


async def persist_incident(db: AsyncSession, incident: Incident) -> Incident:
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return incident