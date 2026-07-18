"""
models/incident_location_history.py
Stores the GPS trail for an incident/victim, used to predict a likely
search area if the victim's device goes offline.

Each row is one GPS ping (lat, lng, speed, heading, accuracy, timestamp).
We keep the last N points per incident (trimming is handled at write time
in tasks/persist.py or the router, not here).
"""
import uuid
from datetime import datetime

from sqlalchemy import Float, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class IncidentLocationHistory(Base):
    __tablename__ = "incident_location_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    incident_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    speed: Mapped[float] = mapped_column(Float, nullable=True)       # m/s
    heading: Mapped[float] = mapped_column(Float, nullable=True)     # 0-360°
    accuracy: Mapped[float] = mapped_column(Float, nullable=True)    # GPS accuracy in meters

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )

    __table_args__ = (
        # speeds up "give me the last 20 points for this incident, in order"
        Index("ix_incident_history_incident_recorded", "incident_id", "recorded_at"),
    )