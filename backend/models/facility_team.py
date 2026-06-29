"""
models/facility_team.py
ORM model for the facility_teams table.
Links a pre-assigned rescue team to a real-world facility (hospital/school/NGO)
identified by its OpenStreetMap node ID. One team → one facility at a time
(enforced by UNIQUE constraint on team_id in schema_additions_v2.sql).
"""
import uuid
from datetime import datetime

from sqlalchemy import String, Float, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class FacilityTeam(Base):
    __tablename__ = "facility_teams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,   # mirrors UNIQUE(team_id) in SQL
    )

    # OpenStreetMap identifier, e.g. "osm:node:123456"
    place_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    place_name: Mapped[str] = mapped_column(String(255), nullable=False)
    place_type: Mapped[str] = mapped_column(String(64), nullable=False)  # hospital | school | ngo

    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)