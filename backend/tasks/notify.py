"""
tasks/notify.py
Stub for SMS / push notification dispatch. Wire up a real provider later.
"""


async def notify_rescue_team(incident_id: str, zone: str | None):
    # TODO: integrate with your SMS/push provider here.
    print(f"[notify] (stub) would alert teams in zone={zone} about incident={incident_id}")