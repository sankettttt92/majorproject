"""
validation/location.py
Sanity-checks the incoming GPS fix against the user's last known location.
"""
import math
from dataclasses import dataclass
from datetime import datetime

from config import MAX_LOCATION_JUMP_METERS


@dataclass
class LocationResult:
    plausible: bool
    distance_from_last_known_m: float | None
    reason: str
    score: int


def _haversine_meters(lat1, lon1, lat2, lon2) -> float:
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def check_location(
    lat: float,
    lon: float,
    accuracy_meters: float | None,
    last_known_lat: float | None,
    last_known_lon: float | None,
    last_seen_at: datetime | None,
) -> LocationResult:
    if last_known_lat is None or last_known_lon is None:
        return LocationResult(plausible=True, distance_from_last_known_m=None,
                               reason="No prior location on file", score=70)

    distance = _haversine_meters(lat, lon, last_known_lat, last_known_lon)

    if distance > MAX_LOCATION_JUMP_METERS:
        return LocationResult(
            plausible=False,
            distance_from_last_known_m=distance,
            reason=f"Location jumped {distance/1000:.1f}km since last known fix",
            score=10,
        )

    if accuracy_meters is not None and accuracy_meters > 1000:
        return LocationResult(
            plausible=True,
            distance_from_last_known_m=distance,
            reason="Low GPS accuracy reported",
            score=50,
        )

    return LocationResult(plausible=True, distance_from_last_known_m=distance,
                           reason="Within plausible range", score=90)