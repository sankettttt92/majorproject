"""
schemas/team_status_update.py
Request body for PATCH /teams/{id}/status
"""
from pydantic import BaseModel
from models.team import TeamStatus


class TeamStatusUpdate(BaseModel):
    status: TeamStatus