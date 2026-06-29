"""
services/places.py
Wraps the Overpass API (OpenStreetMap) to find nearby emergency facilities —
hospitals, schools, and NGOs — within a given radius of a victim's location.
No API key required. Respects fair-use: 1 req/sec, User-Agent header set.

Also wraps the OSRM Table service to get real road distances + ETAs from
a single origin (victim) to N destinations (candidate facilities) in one call.
"""
import asyncio
import math
import httpx
from typing import TypedDict

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OSRM_URL = "https://router.project-osrm.org"
USER_AGENT = "Rakshak-DisasterResponse/2.0 (disaster-response-platform)"

# Overpass amenity tags → our internal place_type labels
PLACE_TYPE_MAP = {
    "hospital": "hospital",
    "clinic": "hospital",
    "school": "school",
    "college": "school",
    "university": "school",
    "social_facility": "ngo",
    "community_centre": "ngo",
    "ngo": "ngo",
}


class Facility(TypedDict):
    place_id: str        # e.g. "osm:node:123456"
    place_name: str
    place_type: str      # "hospital" | "school" | "ngo"
    latitude: float
    longitude: float


class OSRMResult(TypedDict):
    facility: Facility
    distance_km: float
    eta_minutes: float
    route_coords: list[list[float]]   # [[lat, lng], ...] for Leaflet polyline


async def fetch_nearby_facilities(
    lat: float,
    lng: float,
    radius_m: int = 5000,
) -> list[Facility]:
    """
    Query Overpass for hospitals, schools, and NGOs within `radius_m` metres
    of (lat, lng). Returns a list of Facility dicts, deduped by place_id.
    """
    amenity_filter = "|".join(PLACE_TYPE_MAP.keys())
    query = f"""
[out:json][timeout:10];
(
  node["amenity"~"{amenity_filter}"](around:{radius_m},{lat},{lng});
  way["amenity"~"{amenity_filter}"](around:{radius_m},{lat},{lng});
);
out center 50;
"""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": USER_AGENT},
        )
        resp.raise_for_status()
        data = resp.json()

    facilities: list[Facility] = []
    seen: set[str] = set()

    for element in data.get("elements", []):
        tags = element.get("tags", {})
        amenity = tags.get("amenity", "")
        place_type = PLACE_TYPE_MAP.get(amenity)
        if not place_type:
            continue

        if element["type"] == "way":
            center = element.get("center", {})
            f_lat = center.get("lat")
            f_lng = center.get("lon")
        else:
            f_lat = element.get("lat")
            f_lng = element.get("lon")

        if f_lat is None or f_lng is None:
            continue

        place_id = f"osm:{element['type']}:{element['id']}"
        if place_id in seen:
            continue
        seen.add(place_id)

        name = (
            tags.get("name")
            or tags.get("name:en")
            or amenity.replace("_", " ").title()
        )

        facilities.append(
            Facility(
                place_id=place_id,
                place_name=name,
                place_type=place_type,
                latitude=f_lat,
                longitude=f_lng,
            )
        )

    return facilities


async def fetch_road_distances(
    origin_lat: float,
    origin_lng: float,
    facilities: list[Facility],
) -> list[OSRMResult]:
    """
    Use OSRM Table service to get road distance + duration from the victim
    (origin) to every facility in one HTTP call.
    Falls back to haversine distance if OSRM is unreachable.
    """
    if not facilities:
        return []

    coords = f"{origin_lng},{origin_lat}"
    for f in facilities:
        coords += f";{f['longitude']},{f['latitude']}"

    url = (
        f"{OSRM_URL}/table/v1/driving/{coords}"
        f"?sources=0&annotations=duration,distance"
    )

    results: list[OSRMResult] = []

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(url, headers={"User-Agent": USER_AGENT})
            resp.raise_for_status()
            data = resp.json()

        durations = data["durations"][0]
        distances = data["distances"][0]

        for i, facility in enumerate(facilities):
            duration_s = durations[i + 1]
            distance_m = distances[i + 1]

            results.append(
                OSRMResult(
                    facility=facility,
                    distance_km=round(distance_m / 1000, 2),
                    eta_minutes=round(duration_s / 60, 1),
                    route_coords=[],
                )
            )

    except Exception:
        for facility in facilities:
            dist_km = _haversine(origin_lat, origin_lng, facility["latitude"], facility["longitude"])
            results.append(
                OSRMResult(
                    facility=facility,
                    distance_km=round(dist_km, 2),
                    eta_minutes=round((dist_km / 40) * 60, 1),
                    route_coords=[],
                )
            )

    return results


async def fetch_route_polyline(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
) -> list[list[float]]:
    """
    Fetch the full route geometry from OSRM Route for the winning facility
    so the frontend can draw a polyline on the Leaflet map.
    Returns [[lat, lng], ...]. Falls back to straight line on error.
    """
    url = (
        f"{OSRM_URL}/route/v1/driving/"
        f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
        f"?overview=full&geometries=geojson"
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers={"User-Agent": USER_AGENT})
            resp.raise_for_status()
            data = resp.json()

        coords = data["routes"][0]["geometry"]["coordinates"]
        return [[c[1], c[0]] for c in coords]

    except Exception:
        return [
            [origin_lat, origin_lng],
            [dest_lat, dest_lng],
        ]


async def fetch_route_polylines_multi(
    origin_lat: float,
    origin_lng: float,
    destinations: list[tuple[float, float]],
) -> list[list[list[float]]]:
    """
    Fetch route polylines for multiple destinations concurrently.
    Returns a list of route_coords in the same order as destinations.
    Each entry is [[lat, lng], ...] for Leaflet polyline rendering.
    """
    tasks = [
        fetch_route_polyline(origin_lat, origin_lng, dest_lat, dest_lng)
        for dest_lat, dest_lng in destinations
    ]
    return await asyncio.gather(*tasks)


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Straight-line distance in km between two lat/lng points."""
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))