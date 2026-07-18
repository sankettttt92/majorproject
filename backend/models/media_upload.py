"""
models/media_upload.py
Tracks every photo/audio file uploaded to Supabase Storage and links it back
to the incident it belongs to (if any).

NOTE ON incident_id (no ForeignKey):
The victim app generates `incident_id` client-side and may upload media
BEFORE the /sos endpoint is ever called (e.g. photo taken while still
deciding whether to press SOS). If incident_id were a strict ForeignKey to
incidents.id, that insert would fail with a FK violation since no Incident
row exists yet. Since /media and /sos are separate HTTP calls (not part of
one DB transaction), a DEFERRABLE FK does not help here either.

So incident_id is intentionally a plain, indexed, nullable UUID column with
no FK constraint. Referential correctness is enforced at the application
level:
  - /sos creates the Incident row using the same client-generated id, so
    any media rows already written with that incident_id become valid.
  - A periodic cleanup task (tasks/cleanup.py) sweeps media rows whose
    incident_id never got claimed by a real incident within 24h, since
    those represent uploads where the user backed out before pressing SOS.
"""
import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class MediaType(str, enum.Enum):
    PHOTO = "photo"
    AUDIO = "audio"


class MediaUpload(Base):
    __tablename__ = "media_uploads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    media_type: Mapped[str] = mapped_column(String(20), nullable=False)
    file_path: Mapped[str] = mapped_column(String, nullable=False)  # Supabase public URL
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str] = mapped_column(String(50), nullable=True)
    uploaded_by: Mapped[str] = mapped_column(String(255), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )

    # Intentionally NOT a ForeignKey — see module docstring above.
    incident_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    __table_args__ = (
        CheckConstraint("media_type IN ('photo', 'audio')", name="chk_media_type"),
    )