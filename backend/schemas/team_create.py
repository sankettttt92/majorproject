"""
schemas/team_create.py
Request body for POST /teams — the Resource Allocation Center's
"+ Add team" form, one per category, posts this shape.
"""
from pydantic import BaseModel

from models.team import TeamCategory, TeamOrgType


class TeamCreate(BaseModel):
    name: str
    category: TeamCategory
    org_type: TeamOrgType

    capacity: int | None = None
    base: str | None = None
    latitude: float | None = None
    longitude: float | None = None