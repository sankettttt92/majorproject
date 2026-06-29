"""
schemas/facility_team_create.py
Request body for POST /facilities/assign-team.
The caller provides the team UUID and the OSM facility details —
we never look up Place data from the DB; OSM fields are cached here
so reads are free (no repeat Overpass calls for the same facility).
"""
import uuid
from pydantic import BaseModel, Field
from typing import Literal


class FacilityTeamCreate(BaseModel):
    team_id: uuid.UUID

    # OpenStreetMap identifiers
    place_id: str = Field(..., description="OSM node/way ID, e.g. 'osm:node:123456'")
    place_name: str = Field(..., max_length=255)
    place_type: Literal["hospital", "school", "ngo"]

    latitude: float
    longitude: float