"""
routers/media.py
Registers uploaded photo/audio metadata after the file itself has already
been uploaded to Supabase Storage by the mobile app.

NEW: after each successful insert, emits a "new_media" Socket.IO event so
the NGO dashboard can append it live to an already-open incident drawer,
instead of only picking it up on the next manual fetch.
"""
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models.media_upload import MediaUpload
from schemas.media_upload import MediaUploadCreate, MediaUploadOut
from socket_manager import emit_media

router = APIRouter(prefix="/media", tags=["media"])


@router.post("", response_model=MediaUploadOut)
async def create_media_upload(
    payload: MediaUploadCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    record = MediaUpload(**payload.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)

    media_out = MediaUploadOut.model_validate(record)
    background_tasks.add_task(emit_media, media_out.model_dump(mode="json"))

    return media_out


@router.get("", response_model=list[MediaUploadOut])
async def list_media_uploads(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MediaUpload).order_by(MediaUpload.uploaded_at.desc())
    )
    return result.scalars().all()


@router.get("/incident/{incident_id}", response_model=list[MediaUploadOut])
async def get_media_for_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MediaUpload)
        .where(MediaUpload.incident_id == incident_id)
        .order_by(MediaUpload.uploaded_at.asc())
    )
    return result.scalars().all()