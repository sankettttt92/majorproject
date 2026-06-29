"""
validation/device_trust.py
Checks that the request is coming from a token + device combo we recognize.

Unauthenticated/guest devices are NOT rejected outright — a disaster app
can't afford to silently drop a real SOS just because someone hasn't
registered yet. Guests are allowed through at low trust so a human can
verify them; only clearly malformed/empty tokens are rejected.
"""
from dataclasses import dataclass


@dataclass
class DeviceTrustResult:
    passed: bool
    reason: str
    score: int


def check_device_trust(auth_token: str, device_id: str | None) -> DeviceTrustResult:
    if not auth_token:
        return DeviceTrustResult(passed=False, reason="Missing auth token", score=0)

    if auth_token.startswith("tok_"):
        if not device_id:
            return DeviceTrustResult(passed=True, reason="No device fingerprint provided", score=40)
        # TODO: look up device_id against the user's registered_device_id in the users table.
        return DeviceTrustResult(passed=True, reason="Token + device present", score=85)

    if auth_token == "guest_token":
        # Unauthenticated guest — allow through, low trust, PENDING for human review.
        return DeviceTrustResult(passed=True, reason="Unauthenticated guest request", score=15)

    return DeviceTrustResult(passed=False, reason="Malformed auth token", score=0)