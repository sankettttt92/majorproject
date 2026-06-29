"""
schemas/facility_team_out.py
Response shape for facility-team endpoints and the A* suggestion payload.
"""
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class FacilityTeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    team_id: uuid.UUID

    place_id: str
    place_name: str
    place_type: str

    latitude: float
    longitude: float

    assigned_at: datetime


class SuggestionOut(BaseModel):
    """
    Emitted on the 'incident:suggestion' socket event after A* completes.
    Also returned as the body of a 409 conflict on POST /incidents/{id}/allocate
    when the requested team is already DEPLOYED.
    """
    incident_id: str

    facility_team: FacilityTeamOut
    team_name: str
    team_category: str
    team_org_type: str

    distance_km: float
    eta_minutes: float

    route_coords: list[list[float]]
    path_labels: list[str]


class TeamAssignmentOut(BaseModel):
    """Single team assignment result within a multi-team suggestion."""
    facility_team: FacilityTeamOut
    team_id: str
    team_name: str
    team_category: str
    team_org_type: str
    distance_km: float
    eta_minutes: float
    route_coords: list[list[float]]
    path_labels: list[str]


class MultiSuggestionOut(BaseModel):
    """
    Returned by POST /incidents/{id}/allocate-multi.
    Contains an ordered list of the best team assignments (closest first)
    selected by the multi-team A* algorithm.
    """
    incident_id: str
    assignments: list[TeamAssignmentOut]   # ordered best → worst distance
    total_teams_found: int
    total_teams_requested: int