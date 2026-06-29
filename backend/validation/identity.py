"""
validation/identity.py
Confirms the user_id sent with the SOS actually exists in our users table.
"""
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.user import User


@dataclass
class IdentityResult:
    user: User | None
    found: bool
    score: int


async def check_identity(db: AsyncSession, user_id: str) -> IdentityResult:
    result = await db.execute(select(User).where(User.external_id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        return IdentityResult(user=None, found=False, score=20)

    score = 90 if user.is_verified else 60
    return IdentityResult(user=user, found=True, score=score)