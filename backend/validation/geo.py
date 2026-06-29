"""
validation/geo.py
Maps a lat/lon to a named operational zone/sector.
"""
from dataclasses import dataclass

# Define your sectors as (name, min_lat, max_lat, min_lon, max_lon).
ZONES = [
    ("DELHI SECTOR 4", 28.50, 28.65, 77.20, 77.40),
    ("DELHI SECTOR 7", 28.65, 28.80, 77.20, 77.40),
]


@dataclass
class GeoResult:
    zone: str | None
    address: str | None


def resolve_zone(lat: float, lon: float) -> GeoResult:
    for name, min_lat, max_lat, min_lon, max_lon in ZONES:
        if min_lat <= lat <= max_lat and min_lon <= lon <= max_lon:
            return GeoResult(zone=name, address=None)
    return GeoResult(zone="UNASSIGNED ZONE", address=None)


async def reverse_geocode(lat: float, lon: float) -> str | None:
    # TODO: call a real reverse geocoding API here.
    return None