"""
validation/scorer.py
Combines all validation signals into trust_score, risk_score, priority, severity, status.
"""
from dataclasses import dataclass

from models.incident import IncidentSeverity, IncidentStatus
from validation.device_trust import DeviceTrustResult
from validation.identity import IdentityResult
from validation.location import LocationResult
from validation.crowd import CrowdResult


@dataclass
class ScoreResult:
    trust_score: int
    risk_score: int
    priority: int
    severity: IncidentSeverity
    status: IncidentStatus


def score_incident(
    device: DeviceTrustResult,
    identity: IdentityResult,
    location: LocationResult,
    crowd: CrowdResult,
) -> ScoreResult:
    trust_score = round((device.score + identity.score + location.score) / 3)

    risk_score = crowd.score
    if not location.plausible:
        risk_score = min(100, risk_score + 15)

    priority = round(trust_score * 0.4 + risk_score * 0.6)

    if risk_score >= 75:
        severity = IncidentSeverity.CRITICAL
    elif risk_score >= 50:
        severity = IncidentSeverity.HIGH
    elif risk_score >= 25:
        severity = IncidentSeverity.MODERATE
    else:
        severity = IncidentSeverity.LOW

    if not device.passed:
        status = IncidentStatus.REJECTED
    elif trust_score >= 60:
        status = IncidentStatus.VERIFIED
    else:
        status = IncidentStatus.PENDING

    return ScoreResult(
        trust_score=trust_score,
        risk_score=risk_score,
        priority=priority,
        severity=severity,
        status=status,
    )