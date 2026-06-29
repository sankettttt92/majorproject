"""
schemas/incident_out.py
What the React dashboard receives from GET /incidents/active.
All fields must match columns in models/incident.py exactly.
"""
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # fixed: was model_configAC

    id: uuid.UUID
    user_id: str
    device_id: str | None

    # Location
    latitude: float
    longitude: float
    accuracy_meters: float | None
    address: str | None
    zone: str | None

    # Classification
    incident_type: str
    severity: str
    status: str
    detail: str | None

    # Scores
    trust_score: int
    risk_score: int
    priority: int

    created_at: datetime
    updated_at: datetime