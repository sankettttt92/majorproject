"""
schemas/team_out.py
Response shape for GET /teams — what the dashboard's Resource Allocation
Center table renders. Mirrors the conventions in schemas/incident_out.py.
All fields must match columns in models/team.py exactly.
"""
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str     # serialises TeamCategory enum as its string value
    org_type: str      # serialises TeamOrgType enum as its string value
    status: str         # serialises TeamStatus enum as its string value

    capacity: int | None
    base: str | None
    latitude: float | None
    longitude: float | None

    created_at: datetime
    updated_at: datetime