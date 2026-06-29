"""
services/astar.py
A* dispatch algorithm for Rakshak v2.

Graph:
  - Start node  : victim SOS location
  - Goal nodes  : nearby facilities that have a pre-assigned AVAILABLE team
  - Edge weight : real road distance from OSRM (g cost)
  - Heuristic   : haversine straight-line distance to victim (h cost, admissible)
  - f(n)        : g(n) + h(n)

Multi-team allocation (new):
  run_astar_multi() picks the best N teams for a single incident by running
  A* repeatedly, excluding already-selected teams each round (greedy optimal).
"""
import math
import heapq
from dataclasses import dataclass, field
from typing import Optional

from services.places import OSRMResult, _haversine


@dataclass(order=True)
class _Node:
    f: float                          # priority key for the heap
    g: float = field(compare=False)   # road distance from origin (km)
    h: float = field(compare=False)   # haversine to origin (km) — used as tiebreaker label
    result: OSRMResult = field(compare=False)
    label: str = field(compare=False)


def run_astar(
    victim_lat: float,
    victim_lng: float,
    osrm_results: list[OSRMResult],
) -> Optional[tuple[OSRMResult, list[str]]]:
    """
    Run A* over the candidate facility results returned by places.fetch_road_distances.
    Each OSRMResult is one graph node (one hop from victim).

    Returns (best_result, path_labels) or None if no candidates exist.

    path_labels is a human-readable list like:
      ["Victim (19.0760, 72.8777)", "→ City Hospital (osm:node:123) — 2.3 km, 4.1 min"]
    used by SuggestionPanel for debug / display.
    """
    if not osrm_results:
        return None

    heap: list[_Node] = []

    for result in osrm_results:
        f_lat = result["facility"]["latitude"]
        f_lng = result["facility"]["longitude"]
        fname = result["facility"]["place_name"]
        fid   = result["facility"]["place_id"]

        g = result["distance_km"]
        h = _haversine(victim_lat, victim_lng, f_lat, f_lng)
        f = g + h

        label = (
            f"→ {fname} ({fid}) — "
            f"{result['distance_km']} km, {result['eta_minutes']} min"
        )

        heapq.heappush(
            heap,
            _Node(f=f, g=g, h=h, result=result, label=label),
        )

    # Pop the node with lowest f — that is our A* winner
    winner = heapq.heappop(heap)

    origin_label = f"Victim ({victim_lat:.4f}, {victim_lng:.4f})"
    path_labels = [origin_label, winner.label]

    return winner.result, path_labels


def run_astar_multi(
    victim_lat: float,
    victim_lng: float,
    osrm_results: list[OSRMResult],
    team_facility_map: dict[str, str],   # place_id → team_id
    n_teams: int = 1,
    exclude_team_ids: set[str] | None = None,
) -> list[tuple[OSRMResult, list[str]]]:
    """
    Run A* repeatedly to select up to `n_teams` best distinct teams for one incident.

    Each iteration:
      1. Builds a heap from all candidate OSRMResults whose facility has an
         AVAILABLE team not yet selected.
      2. Pops the winner (lowest f = road_dist + haversine heuristic).
      3. Records that team as selected so it cannot be picked again.
      4. Repeats until n_teams assignments are made or candidates are exhausted.

    Args:
        victim_lat / victim_lng : SOS coordinates
        osrm_results            : road distances from OSRM for each candidate facility
        team_facility_map       : { place_id: team_id } for AVAILABLE teams only
        n_teams                 : how many teams to assign
        exclude_team_ids        : team IDs already DEPLOYED (skip them)

    Returns:
        Ordered list of (OSRMResult, path_labels) tuples, best first.
        May be shorter than n_teams if not enough candidates exist.
    """
    excluded = set(exclude_team_ids or [])
    selected_team_ids: set[str] = set()
    assignments: list[tuple[OSRMResult, list[str]]] = []

    origin_label = f"Victim ({victim_lat:.4f}, {victim_lng:.4f})"

    for _ in range(n_teams):
        heap: list[_Node] = []

        for result in osrm_results:
            place_id = result["facility"]["place_id"]
            team_id  = team_facility_map.get(place_id)

            # Skip if no team assigned, already selected, or excluded (DEPLOYED)
            if not team_id:
                continue
            if team_id in selected_team_ids:
                continue
            if team_id in excluded:
                continue

            f_lat = result["facility"]["latitude"]
            f_lng = result["facility"]["longitude"]
            fname = result["facility"]["place_name"]

            g = result["distance_km"]
            h = _haversine(victim_lat, victim_lng, f_lat, f_lng)
            f = g + h

            label = (
                f"→ {fname} ({place_id}) — "
                f"{result['distance_km']} km, {result['eta_minutes']} min"
            )

            heapq.heappush(
                heap,
                _Node(f=f, g=g, h=h, result=result, label=label),
            )

        if not heap:
            break  # no more candidates

        winner = heapq.heappop(heap)
        winning_team_id = team_facility_map[winner.result["facility"]["place_id"]]
        selected_team_ids.add(winning_team_id)

        path_labels = [origin_label, winner.label]
        assignments.append((winner.result, path_labels))

    return assignments