"""
tasks/cleanup.py
Periodic sweep for orphaned media_uploads rows.

Since media_uploads.incident_id has no FK constraint (photos can be
uploaded before /sos creates the Incident row — see models/media_upload.py),
it's possible for a row to sit there forever with an incident_id that never
gets claimed: e.g. the user photographs the scene, then backs out and never
actually presses SOS.

Run this on a schedule (cron / APScheduler / Celery beat, whatever the
project already uses) to delete those after a grace window, so storage
metadata doesn't grow unbounded with abandoned uploads.

Usage:
    await cleanup_orphaned_media(db)
"""
from datetime import datetime, timedelta
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from models.media_upload import MediaUpload
from models.incident import Incident

GRACE_PERIOD = timedelta(hours=24)


async def cleanup_orphaned_media(db: AsyncSession) -> int:
    """
    Deletes media_uploads rows whose incident_id:
      - is not null, and
      - does not match any existing Incident, and
      - was uploaded more than GRACE_PERIOD ago.
    Returns the number of rows deleted.
    """
    cutoff = datetime.utcnow() - GRACE_PERIOD

    known_incident_ids = select(Incident.id)

    stmt = (
        delete(MediaUpload)
        .where(MediaUpload.incident_id.is_not(None))
        .where(MediaUpload.incident_id.not_in(known_incident_ids))
        .where(MediaUpload.uploaded_at < cutoff)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount or 0