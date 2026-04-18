"""Data models for the Meridian engine."""

from .evidence import (
    AgentMessage,
    AgentRole,
    CheckSession,
    Evidence,
    EvidenceType,
    EvidenceReport,
    Finding,
    InternReport,
    LandscapeReport,
    ManagerDirective,
    ManagerReport,
    SubClaim,
    VerificationDirective,
    VerdictReport,
    is_meta_question,
)

# Backward-compat aliases used by some modules
FindingType = EvidenceType
ResearchSession = CheckSession
ResearchTopic = SubClaim

__all__ = [
    "AgentMessage",
    "AgentRole",
    "CheckSession",
    "Evidence",
    "EvidenceReport",
    "EvidenceType",
    "Finding",
    "FindingType",
    "InternReport",
    "LandscapeReport",
    "ManagerDirective",
    "ManagerReport",
    "ResearchSession",
    "ResearchTopic",
    "SubClaim",
    "VerdictReport",
    "VerificationDirective",
    "is_meta_question",
]
