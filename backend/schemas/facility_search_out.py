"""
schemas/facility_search_out.py
Response shape for GET /facilities/search — a raw lat/lng Overpass lookup
(no team/DB association, unlike FacilityTeamOut). Used by the frontend's
facility-assignment drawer when searching near an arbitrary point
(team base, a geocoded place, or manually entered coordinates).
"""
from typing import Literal
from pydantic import BaseModel


class FacilitySearchOut(BaseModel):
    place_id: str
    place_name: str
    place_type: Literal["hospital", "school", "ngo"]
    latitude: float
    longitude: float