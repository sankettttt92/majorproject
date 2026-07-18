"""
schemas/media_upload.py
Request/response models for the /media endpoints.
MediaUploadCreate mirrors the fields the client sends when registering a
photo/audio file already uploaded to Supabase Storage (see routers/media.py
and models/media_upload.py for why incident_id has no FK constraint).
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class MediaUploadCreate(BaseModel):
    media_type: str = Field(..., description="'photo' or 'audio'")
    file_path: str = Field(..., description="Supabase public URL of the uploaded file")
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    uploaded_by: Optional[str] = None
    incident_id: Optional[UUID] = Field(
        None,
        description="Client-generated incident id — may not correspond to an "
                    "existing Incident row yet if uploaded before /sos is called",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "media_type": "photo",
                "file_path": "https://xyzcompany.supabase.co/storage/v1/object/public/media/abc123.jpg",
                "file_size_bytes": 245678,
                "mime_type": "image/jpeg",
                "uploaded_by": "guest",
                "incident_id": "b3f1c2a0-1234-4a5b-9c6d-abcdef123456",
            }
        }
    )


class MediaUploadOut(BaseModel):
    id: UUID
    media_type: str
    file_path: str
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    uploaded_by: Optional[str] = None
    uploaded_at: datetime
    incident_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)