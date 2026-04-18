"""Data models for session evidence, findings, and agent communication."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

# Phrases that indicate an LLM produced a meta-question or placeholder
# instead of a real evidence finding/follow-up.  Shared by agents to
# filter these out consistently.
META_QUESTION_PHRASES: tuple[str, ...] = (
    "please provide",
    "what information",
    "could you clarify",
    "what are you looking for",
    "what topic",
    "what subject",
    "what would you like",
    "can you specify",
    "please specify",
    "more details",
    "template or placeholder",
)


def is_meta_question(text: str) -> bool:
    """Return True if *text* looks like a meta-question/placeholder."""
    lower = text.lower()
    return any(phrase in lower for phrase in META_QUESTION_PHRASES)


class EvidenceType(str, Enum):
    """Types of evidence gathered during a research session."""

    SUPPORTING = "supporting"
    CONTRADICTING = "contradicting"
    CONTEXTUAL = "contextual"
    SOURCE = "source"
    QUESTION = "question"
    # Keep backward compat aliases
    FACT = "fact"
    INSIGHT = "insight"
    CONNECTION = "connection"
    CONTRADICTION = "contradiction"


class AgentRole(str, Enum):
    """Agent roles in the hierarchy."""

    INTERN = "intern"
    MANAGER = "manager"
    DIRECTOR = "director"


class Evidence(BaseModel):
    """A single piece of evidence gathered during research."""

    id: int | None = None
    session_id: str  # 7-char hex ID
    content: str
    evidence_type: EvidenceType
    source_url: str | None = None
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)
    search_query: str | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    validated_by_manager: bool = False
    manager_notes: str | None = None

    topic_id: int | None = None

    # Corpus origin — "external" for web/academic/patent/standards/regulatory,
    # "internal" for documents pulled from the internal corpus (e.g. Google Drive).
    corpus: str = "external"

    # Verification fields
    verification_status: str | None = None  # verified/flagged/rejected/skipped
    verification_method: str | None = None  # cove/critic/kg_match/streaming/batch
    kg_support_score: float | None = None  # KG corroboration score (0-1)
    original_confidence: float | None = None  # Confidence before verification calibration


class SubClaim(BaseModel):
    """A sub-question or subtopic to investigate during a research session."""

    id: int | None = None
    session_id: str  # 7-char hex ID
    topic: str
    parent_topic_id: int | None = None
    depth: int = 0
    status: str = "pending"  # pending, in_progress, completed, blocked
    priority: int = Field(default=5, ge=1, le=10)
    assigned_at: datetime | None = None
    completed_at: datetime | None = None
    findings_count: int = 0


class CheckSession(BaseModel):
    """A research session with iteration-based control."""

    id: str | None = None  # 7-char hex ID
    claim: str
    slug: str | None = None  # AI-generated short name for output folder
    max_iterations: int = 5  # Manager ReAct loop iterations (controls research depth)
    time_limit_minutes: int = 0  # Kept for backward compat / display only
    started_at: datetime = Field(default_factory=datetime.now)
    ended_at: datetime | None = None
    status: str = "active"  # active, running, paused, crashed, completed, error, interrupted
    total_findings: int = 0
    total_searches: int = 0
    depth_reached: int = 0

    # Landscape scores (replaces the old TRUE/FALSE/MIXED verdict).
    confidence: float | None = None       # weighted mean of finding confidence * credibility
    consensus: float | None = None        # supports / (supports + contradicts) across KG relations
    source_diversity: float | None = None # 1 - Gini over unique source domains

    # Session mode — drives the Director intent router.  Set at creation time.
    mode: str = "question"  # question | hypothesis | topic | brief | internal_doc

    # Pause/resume/crash recovery fields
    elapsed_seconds: float = 0.0  # Accumulated run time across pause/resume cycles
    paused_at: datetime | None = None  # Timestamp when last paused (None if running)
    iteration_count: int = 0  # Manager ReAct loop iteration for resume
    phase: str = "init"  # init | parallel_init | react_loop | synthesis | done

    @property
    def goal(self) -> str:
        """Backward-compat alias for 'claim'."""
        return self.claim


class AgentMessage(BaseModel):
    """Message passed between agents in the hierarchy."""

    id: int | None = None
    session_id: str  # 7-char hex ID
    from_agent: AgentRole
    to_agent: AgentRole
    message_type: str  # task, report, critique, question, directive
    content: str
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)


class ManagerDirective(BaseModel):
    """Directive from Manager to Intern."""

    action: str  # search, deep_dive, verify, expand, stop
    topic: str
    instructions: str
    priority: int = Field(default=5, ge=1, le=10)
    max_searches: int = 5
    # Optional tool hints — e.g. ["patents", "web"] to steer the intern toward
    # specific search tools.  Empty list means "intern decides".
    tool_hints: list[str] = Field(default_factory=list)


class InternReport(BaseModel):
    """Report from Intern to Manager."""

    topic: str
    evidence: list[Evidence]
    searches_performed: int
    suggested_followups: list[str]
    blockers: list[str] = Field(default_factory=list)


class Finding(BaseModel):
    """An interpretive statement aggregating one or more Evidence rows.

    A Finding is what the Manager produces from evidence — it says "the literature
    shows X, with Y confidence, supported by these sources." Reports render
    Findings, not raw Evidence.
    """

    statement: str
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    consensus: float = Field(default=0.5, ge=0.0, le=1.0)
    source_diversity: float = Field(default=0.5, ge=0.0, le=1.0)
    supporting_evidence_ids: list[int] = Field(default_factory=list)
    contradicting_evidence_ids: list[int] = Field(default_factory=list)
    source_urls: list[str] = Field(default_factory=list)
    corpus_origin: str = "mixed"  # internal | external | mixed
    tags: list[str] = Field(default_factory=list)


class LandscapeReport(BaseModel):
    """Top-level research output from Manager to Director.

    Replaces the old TRUE/FALSE/MIXED verdict model with a confidence + consensus +
    source-diversity triple plus structured findings, contested areas, and
    white-space signals.
    """

    summary: str
    key_findings: list[Finding] = Field(default_factory=list)
    key_evidence: list[Evidence] = Field(default_factory=list)

    # Landscape scores (all 0-1, uncalibrated heuristics for v1)
    confidence: float = 0.0
    consensus: float = 0.0
    source_diversity: float = 0.0

    # High-value signals surfaced from the knowledge graph
    contested_areas: list[str] = Field(default_factory=list)
    white_space: list[str] = Field(default_factory=list)
    cross_corpus_highlights: list[str] = Field(default_factory=list)

    topics_explored: list[str] = Field(default_factory=list)
    topics_remaining: list[str] = Field(default_factory=list)
    quality_assessment: str = ""
    recommended_next_steps: list[str] = Field(default_factory=list)
    time_elapsed_minutes: float = 0.0
    iterations_completed: int = 0
    searches_performed: int = 0

    # Backward-compat aliases
    sub_claims_explored: list[str] = Field(default_factory=list)
    sub_claims_remaining: list[str] = Field(default_factory=list)

    def model_post_init(self, __context) -> None:
        """Sync backward-compat aliases with canonical fields."""
        if self.sub_claims_explored and not self.topics_explored:
            self.topics_explored = self.sub_claims_explored
        elif self.topics_explored and not self.sub_claims_explored:
            self.sub_claims_explored = self.topics_explored
        if self.sub_claims_remaining and not self.topics_remaining:
            self.topics_remaining = self.sub_claims_remaining
        elif self.topics_remaining and not self.sub_claims_remaining:
            self.sub_claims_remaining = self.topics_remaining


# Aliases used by various agent modules.  `ManagerReport` and `VerdictReport`
# are kept as deprecated aliases pointing at `LandscapeReport` so existing
# call sites keep compiling while we migrate them in Phase 2.3/2.4.
ManagerReport = LandscapeReport
VerdictReport = LandscapeReport
VerificationDirective = ManagerDirective
EvidenceReport = InternReport
FindingType = EvidenceType
ResearchSession = CheckSession
ResearchTopic = SubClaim
