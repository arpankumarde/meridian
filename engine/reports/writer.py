"""Intelligence Report Writer — generates comprehensive R&D landscape reports."""

import asyncio
import json
import random
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from urllib.parse import parse_qs, unquote, urlparse, urlunparse

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, TextBlock, query

from ..logging_config import get_logger
from ..models.evidence import Evidence, CheckSession, is_meta_question

logger = get_logger(__name__)


class SectionType(str, Enum):
    """Types of sections that can appear in a dynamic intelligence report."""

    FINDING_SUMMARY = "finding_summary"  # Overall finding with confidence / consensus / diversity
    TLDR = "tldr"  # 2-3 sentence summary
    FLASH_NUMBERS = "flash_numbers"  # Key metrics callouts
    STATS_TABLE = "stats_table"  # Tabular comparisons
    COMPARISON = "comparison"  # Side-by-side analysis
    TIMELINE = "timeline"  # Chronological view
    NARRATIVE = "narrative"  # Standard prose section
    ANALYSIS = "analysis"  # Deep synthesis
    GAPS = "gaps"  # Open questions
    CONCLUSIONS = "conclusions"
    REFERENCES = "references"


@dataclass
class PlannedSection:
    """A planned section in the dynamic report structure."""

    section_type: SectionType
    title: str
    description: str
    priority: int = 5
    content: str = ""


# Maximum tokens for prompts to avoid overflows
MAX_EVIDENCE_CHARS = 15000  # ~4k tokens for evidence context


# --- Section generation configuration ---

_SECTION_SYSTEM_PROMPT = "You are writing a sourced, evidence-based R&D intelligence landscape report."

_CITATION_INSTRUCTIONS = """\
CITATION INSTRUCTIONS:
- Each piece of evidence includes a source like [Source: [N] domain].
- Cite claims inline using [N] notation, e.g., "accuracy improved 40% [3]."
- Aim for 3-8 citations per section. Do NOT list references at the end."""


@dataclass
class _SectionConfig:
    """Configuration for generating a specific section type."""

    prompt_template: str
    system_suffix: str = (
        " Every major claim must cite its source using [N]."
        " When evidence disagrees or contradicts, explicitly note the tension:"
        " 'Source A claims X, while Source B claims Y.'"
        " Do not present conflicting claims as if both are uncontested facts."
    )
    use_citations: bool = True
    use_kg_context: bool = True
    max_evidence: int = 20
    max_evidence_chars: int | None = None
    selection_title: str | None = None
    selection_description: str | None = None
    pre_filter: str | None = None
    skip_selection: bool = False
    allow_empty: bool = False


def _filter_meta_questions(evidence: list) -> list:
    """Filter out meta-questions and placeholder content."""
    return [e for e in evidence if not is_meta_question(e.content)]


def _filter_numeric(evidence: list) -> list:
    """Keep only evidence containing numeric data."""
    return [e for e in evidence if any(c.isdigit() for c in e.content)][:20]


def _filter_temporal(evidence: list) -> list:
    """Keep evidence with temporal references."""
    current_year = datetime.now().year
    year_keywords = [str(y) for y in range(current_year - 5, current_year + 1)]
    temporal_keywords = [
        *year_keywords,
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december",
        "released", "launched", "announced", "introduced",
    ]
    result = [
        e for e in evidence
        if any(kw in e.content.lower() for kw in temporal_keywords)
    ][:25]
    return result if result else evidence[:20]


_PRE_FILTERS: dict[str, Callable] = {
    "meta_questions": _filter_meta_questions,
    "numeric": _filter_numeric,
    "temporal": _filter_temporal,
}

_SECTION_CONFIGS: dict[SectionType, _SectionConfig] = {
    SectionType.FINDING_SUMMARY: _SectionConfig(
        prompt_template="""\
Write a Finding Summary for this R&D intelligence audit.

RESEARCH BRIEF: {claim}

KEY EVIDENCE:
{evidence}

Write a finding summary that:
1. States what the evidence actually shows (no TRUE/FALSE verdict — describe the landscape)
2. Provides a 2-3 sentence synthesis citing the strongest evidence
3. Notes the overall confidence level and where consensus exists vs where sources disagree
4. Highlights any contested areas or notable gaps in the literature

Format as:

[2-3 sentence synthesis with inline [N] citations]

**Confidence:** [HIGH/MEDIUM/LOW] based on [brief reason]
**Consensus:** [HIGH/MEDIUM/LOW] — [note where sources agree or disagree]

Output ONLY the finding summary content.""",
        system_suffix=(
            " Deliver a clear, evidence-based landscape finding. "
            "Do not output a TRUE/FALSE/MIXED verdict — describe the landscape, "
            "what is corroborated, what is contested, and what is missing."
        ),
        use_citations=True,
        use_kg_context=False,
        max_evidence=20,
        selection_title="Finding summary overall landscape",
        selection_description="Overall finding from the evidence landscape",
        pre_filter="meta_questions",
    ),
    SectionType.TLDR: _SectionConfig(
        prompt_template="""\
Write a TL;DR (Too Long; Didn't Read) for this R&D intelligence audit.

RESEARCH BRIEF: {claim}

KEY EVIDENCE (focus on these substantive findings):
{evidence}

Write 2-3 sentences that state the most important finding and the strongest evidence.
Be specific — use exact numbers, names, and details from evidence.
Do NOT output a TRUE/FALSE/MIXED verdict. Do NOT claim the audit is incomplete — summarize what was actually found.

Format as a blockquote (start each line with >).
Output ONLY the blockquote, nothing else.""",
        system_suffix=" Distill evidence into a precise landscape summary.",
        use_citations=False,
        use_kg_context=False,
        max_evidence=15,
        selection_title="TL;DR summary",
        selection_description="Bottom-line landscape finding",
        pre_filter="meta_questions",
    ),
    SectionType.FLASH_NUMBERS: _SectionConfig(
        prompt_template="""\
Extract the most impactful numbers/statistics from this fact-check evidence.

CLAIM BEING CHECKED: {claim}

EVIDENCE WITH DATA:
{evidence}

Format each key metric as:
**[NUMBER/STAT]** — [Brief description of what it means] [N]

Where [N] is the source reference number from the evidence.

Example:
**94.4%** — Sources confirming the central claim [3]
**3 of 7** — Independent studies supporting the claim [7]

Select 3-6 of the most compelling, relevant statistics.
Output ONLY the formatted metrics, one per line. No introductory text.""",
        system_suffix=" Highlight key statistics with their sources.",
        use_citations=False,
        use_kg_context=False,
        pre_filter="numeric",
        skip_selection=True,
        allow_empty=True,
    ),
    SectionType.STATS_TABLE: _SectionConfig(
        prompt_template="""\
Create a comparison table from this fact-check evidence.

CLAIM BEING CHECKED: {claim}
SECTION DESCRIPTION: {description}

EVIDENCE:
{evidence}

Create a markdown table comparing the key items/sources/claims found during the fact-check.
Choose appropriate column headers based on what's being compared.
Include a "Source" column with [N] references where data comes from specific evidence.

Output ONLY the markdown table. No introductory text.""",
        system_suffix=" Create precise comparison tables.",
        use_citations=False,
        use_kg_context=False,
        max_evidence=25,
    ),
    SectionType.COMPARISON: _SectionConfig(
        prompt_template="""\
Write a side-by-side comparison analysis of evidence for and against the claim.

CLAIM BEING CHECKED: {claim}
SECTION TITLE: {title}
SECTION DESCRIPTION: {description}

AVAILABLE EVIDENCE:
{evidence}
{kg_context}{citations}

Write 3-4 paragraphs that:
1. Identify the key sources and their positions
2. Analyze the strength of evidence on each side
3. Highlight key differentiators and contradictions
4. Assess which side has stronger evidentiary support

Name specific sources, organizations, or studies when available.
Use exact numbers, dates, and details from evidence.
Use subheadings if helpful.
Output ONLY the comparison content.""",
    ),
    SectionType.TIMELINE: _SectionConfig(
        prompt_template="""\
Create a chronological timeline from this fact-check evidence.

CLAIM BEING CHECKED: {claim}
SECTION TITLE: {title}

EVIDENCE:
{evidence}
{citations}

Format as a timeline with clear dates/periods:

**[Date/Period]**: [Event/Development] [N]
- Key details

Order from earliest to most recent.
Output ONLY the timeline content.""",
        system_suffix=" Every major claim must cite its source using [N].",
        use_kg_context=False,
        pre_filter="temporal",
        skip_selection=True,
    ),
    SectionType.GAPS: _SectionConfig(
        prompt_template="""\
Identify knowledge gaps and open questions from this fact-check.

CLAIM BEING CHECKED: {claim}

EVIDENCE:
{evidence}
{kg_context}{citations}

Write 2-3 paragraphs covering:
1. What important questions remain unanswered
2. Areas where more investigation is needed
3. Any contradictions or debates that aren't resolved
4. Limitations of current evidence

If evidence is marked [VERIFIED], note where confidence is high.
If [UNVERIFIED] or [FLAGGED], note these as areas needing further investigation.
Be specific about what we don't know yet.
Output ONLY the gaps content.""",
        selection_title="Open questions gaps unknowns",
        selection_description="Knowledge gaps and uncertainties",
    ),
    SectionType.NARRATIVE: _SectionConfig(
        prompt_template="""\
Write a section of an R&D intelligence landscape report.

RESEARCH BRIEF: {claim}
SECTION TITLE: {title}
SECTION DESCRIPTION: {description}

AVAILABLE EVIDENCE:
{evidence}
{kg_context}{citations}

Write 4-6 paragraphs that:
1. Open with the key insight for this theme
2. Develop with supporting details and evidence
3. Explain significance and implications for the landscape
4. Connect to the broader research brief

Guidelines:
- Write flowing prose, not bullet points
- Name specific sources, papers, patents, or organizations when available
- Use exact numbers, dates, and details from evidence
- If marked [VERIFIED], state with confidence. If [UNVERIFIED], hedge appropriately.
- When internal and external sources agree, say so. When they disagree, explicitly name the tension — that is the most valuable signal.

Output ONLY the section content, no headers.""",
        max_evidence_chars=12000,
    ),
    SectionType.ANALYSIS: _SectionConfig(
        prompt_template="""\
Write an analysis section synthesizing the evidence.

RESEARCH BRIEF: {claim}
SECTION TITLE: {title}
SECTION DESCRIPTION: {description}

AVAILABLE EVIDENCE:
{evidence}
{kg_context}{citations}

Write 3-4 paragraphs that:
1. Synthesize the most important evidence
2. Identify patterns, trends, and connections
3. Address contradictions or debates between sources
4. Note where the research landscape has high confidence vs. contested areas

Name specific sources, papers, patents, or organizations when available.
If marked [VERIFIED], state with confidence. If [UNVERIFIED], hedge appropriately.
Output ONLY the analysis content.""",
    ),
    SectionType.CONCLUSIONS: _SectionConfig(
        prompt_template="""\
Write the conclusions section of an R&D intelligence landscape report.

RESEARCH BRIEF: {claim}

KEY EVIDENCE:
{evidence}
{kg_context}{citations}

Write 2-3 paragraphs that:
1. Summarize the strongest findings and the evidence that supports them
2. Note contested areas and white space (gaps the literature has not covered)
3. Provide actionable context for the researcher
4. Suggest next research directions

Be definitive where evidence is [VERIFIED], hedged where [UNVERIFIED]. Do NOT output a TRUE/FALSE verdict.
Output ONLY the conclusions content.""",
        system_suffix=" Every major claim must cite its source using [N].",
        selection_title="Conclusions recommendations next steps",
        selection_description="Final landscape synthesis and recommendations",
    ),
}


@dataclass
class ReportSection:
    """A section in the intelligence report."""

    title: str
    content: str
    subsections: list["ReportSection"] = None

    def __post_init__(self):
        if self.subsections is None:
            self.subsections = []


class IntelligenceReportWriter:
    """Generates comprehensive R&D intelligence landscape reports.

    Creates multi-page reports with:
    - Finding summary with confidence / consensus / source-diversity scores
    - Evidence corroborating and contradicting the brief
    - Sub-question analysis
    - Cross-corpus highlights (internal ↔ external)
    - Contested areas and white space
    - Narrative synthesis sections
    - Analysis and insights
    - Conclusions
    - Inline [N] citations and reference list at end
    """

    def __init__(self, model: str = "opus"):
        self.model = model

    async def _call_claude(
        self, prompt: str, system_prompt: str = "", model: str | None = None
    ) -> str:
        """Call Claude for report generation using Claude Agent SDK.

        Uses claude_agent_sdk.query() which works with both API keys and OAuth
        authentication (normal Claude Code accounts).
        Falls back to cheaper models if the primary model fails (e.g. rate limits).
        """
        # Combine system prompt with user prompt
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"

        use_model = model or self.model

        options = ClaudeAgentOptions(
            model=use_model,
            max_turns=1,  # Single turn for report generation
            allowed_tools=[],  # No tools needed for text generation
        )

        response_text = ""
        max_retries = 5
        base_delay = 5.0  # Start with 5s delay for rate limit recovery

        for attempt in range(max_retries):
            try:
                async for message in query(prompt=full_prompt, options=options):
                    if isinstance(message, AssistantMessage):
                        for block in message.content:
                            if isinstance(block, TextBlock):
                                response_text += block.text
                break  # Success, exit retry loop

            except Exception as e:
                error_str = str(e).lower()
                logger.warning("Report LLM call failed (attempt %d/%d, model=%s): %s", attempt + 1, max_retries, use_model, e, exc_info=True)

                if attempt < max_retries - 1:
                    delay = base_delay * (2**attempt) + random.uniform(0, 2.0)
                    logger.info("Retrying report LLM call in %.1fs...", delay)
                    await asyncio.sleep(delay)
                    response_text = ""  # Reset for retry
                else:
                    # All retries exhausted with primary model -- try fallback
                    if use_model == "opus":
                        logger.warning("Opus failed after %d attempts, falling back to sonnet", max_retries)
                        return await self._call_claude(prompt, system_prompt, model="sonnet")
                    return f"[Error generating report section: {str(e)[:200]}]"

        return response_text

    async def generate_report(
        self,
        session: CheckSession,
        evidence: list[Evidence],
        sub_claims_explored: list[str],
        sub_claims_remaining: list[str],
        kg_exports: dict = None,
        dynamic: bool = True,
        verification_metrics: dict = None,
        progress_callback: Callable[[str, int], Awaitable[None]] | None = None,
        user_sections: list[str] | None = None,
    ) -> str:
        """Generate a comprehensive R&D intelligence landscape report.

        Args:
            session: The research session
            evidence: All evidence from the research run
            sub_claims_explored: Sub-questions that were investigated
            sub_claims_remaining: Sub-questions that could be investigated with more time
            kg_exports: Optional knowledge graph exports (stats, visualization, gaps)
            dynamic: If True, use AI-driven dynamic section planning
            verification_metrics: Optional verification metrics from the pipeline
            user_sections: Optional list of section titles to use instead of AI planning

        Returns:
            Complete markdown intelligence report
        """
        logger.info("Report generation started: session=%s, evidence=%d", session.id, len(evidence))
        # Use dynamic report generation by default
        if dynamic:
            return await self.generate_dynamic_report(
                session=session,
                evidence=evidence,
                sub_claims_explored=sub_claims_explored,
                sub_claims_remaining=sub_claims_remaining,
                kg_exports=kg_exports,
                verification_metrics=verification_metrics,
                progress_callback=progress_callback,
                user_sections=user_sections,
            )

        # Fallback to legacy fixed structure
        evidence_by_type = self._organize_evidence(evidence)
        sources = self._extract_sources(evidence)

        # Generate report sections using Claude
        await _emit_progress(progress_callback, "Generating finding summary...", 10)
        logger.info("Generating finding summary...")
        finding_summary = await self._generate_finding_summary(
            session.claim, evidence, sub_claims_explored
        )

        await _emit_progress(progress_callback, "Generating introduction...", 25)
        logger.info("Generating introduction...")
        introduction = await self._generate_introduction(session.claim, evidence)

        await _emit_progress(progress_callback, "Generating main sections...", 45)
        logger.info("Generating main narrative sections...")
        main_sections = await self._generate_main_sections(session.claim, evidence)

        await _emit_progress(progress_callback, "Generating analysis and insights...", 70)
        logger.info("Generating analysis and insights...")
        analysis = await self._generate_analysis(session.claim, evidence, evidence_by_type)

        await _emit_progress(progress_callback, "Generating conclusions...", 85)
        logger.info("Generating conclusions...")
        conclusions = await self._generate_conclusions(session.claim, evidence, sub_claims_remaining)

        # Compile the full report
        await _emit_progress(progress_callback, "Compiling intelligence report...", 95)
        report = self._compile_report(
            session=session,
            finding_summary=finding_summary,
            introduction=introduction,
            main_sections=main_sections,
            analysis=analysis,
            conclusions=conclusions,
            sources=sources,
            evidence=evidence,
            sub_claims_explored=sub_claims_explored,
            kg_exports=kg_exports,
        )

        await _emit_progress(progress_callback, "Intelligence report complete", 100)
        return report

    def _organize_evidence(self, evidence: list[Evidence]) -> dict[str, list[Evidence]]:
        """Organize evidence by type."""
        by_type = {}
        for e in evidence:
            t = e.evidence_type.value
            by_type.setdefault(t, []).append(e)
        return by_type

    @staticmethod
    def _normalize_source_url(url: str) -> str:
        """Normalize a source URL so that different variants of the same resource
        collapse to a single canonical form.

        Handles:
        - Stripping query parameters (except essential ones like ``id=``)
        - Removing trailing slashes
        - arxiv: abs/pdf/export variants -> canonical ``arxiv.org/abs/XXXX``
        - ACL Anthology: strip ``.pdf`` suffix
        - DOI URLs: extract the DOI and use ``doi.org/<doi>`` as key
        - Semantic Scholar: extract paper ID
        """
        try:
            parsed = urlparse(url)
            host = parsed.netloc.lower().replace("www.", "")
            path = unquote(parsed.path).rstrip("/")

            # --- arxiv normalization ---
            arxiv_match = re.match(
                r"^/(?:abs|pdf|html)/(\d{4}\.\d{4,5}(?:v\d+)?)", path
            )
            if arxiv_match and ("arxiv.org" in host or "ar5iv" in host):
                paper_id = arxiv_match.group(1)
                paper_id = re.sub(r"v\d+$", "", paper_id)
                return f"https://arxiv.org/abs/{paper_id}"

            # --- DOI normalization ---
            if host in ("doi.org", "dx.doi.org"):
                doi = path.lstrip("/")
                return f"https://doi.org/{doi}"

            doi_match = re.search(r"(10\.\d{4,9}/[^\s?#]+)", url)
            if doi_match and host not in ("doi.org", "dx.doi.org"):
                doi = doi_match.group(1).rstrip("/.")
                return f"https://doi.org/{doi}"

            # --- Semantic Scholar normalization ---
            if "semanticscholar.org" in host:
                ss_match = re.search(r"/paper/(?:.+/)?([0-9a-f]{40})$", path)
                if ss_match:
                    return f"https://www.semanticscholar.org/paper/{ss_match.group(1)}"

            # --- ACL Anthology normalization ---
            if "aclanthology.org" in host:
                path = re.sub(r"\.pdf$", "", path)
                return f"https://aclanthology.org{path}"

            # --- Generic normalization ---
            essential_params = {"id", "doi", "paper_id", "article"}
            qs = parse_qs(parsed.query)
            filtered_qs = {
                k: v for k, v in qs.items() if k.lower() in essential_params
            }
            query_str = "&".join(
                f"{k}={v[0]}" for k, v in sorted(filtered_qs.items())
            )

            normalized = urlunparse((
                parsed.scheme or "https",
                host,
                path,
                "",  # params
                query_str,
                "",  # fragment
            ))
            return normalized
        except Exception:
            return url

    def _extract_sources(self, evidence: list[Evidence]) -> list[dict]:
        """Extract unique sources from evidence with titles.

        Uses URL normalization so that different variants of the same resource
        collapse into a single source entry.
        """
        sources: dict[str, dict] = {}
        self._url_to_normalized: dict[str, str] = {}

        for e in evidence:
            if not e.source_url:
                continue

            normalized = self._normalize_source_url(e.source_url)
            self._url_to_normalized[e.source_url] = normalized

            if normalized in sources:
                continue

            domain = ""
            title = ""
            try:
                parsed = urlparse(e.source_url)
                domain = parsed.netloc.replace("www.", "")

                path = unquote(parsed.path)
                path_parts = [
                    p for p in path.split("/") if p and p not in ["index", "html", "htm"]
                ]
                if path_parts:
                    title_part = path_parts[-1]
                    title_part = title_part.replace("-", " ").replace("_", " ")
                    title_part = (
                        title_part.replace(".html", "").replace(".htm", "").replace(".pdf", "")
                    )
                    title = title_part.title()

                if not title or len(title) < 5:
                    title = domain.split(".")[0].title()
            except Exception:
                logger.warning(
                    "Source URL parsing failed: %s", e.source_url[:100], exc_info=True
                )
                domain = e.source_url[:50]
                title = domain

            sources[normalized] = {
                "url": normalized,
                "domain": domain,
                "title": title,
            }
        return list(sources.values())

    def _format_evidence_for_prompt(self, e: Evidence) -> str:
        """Format a single piece of evidence for inclusion in LLM prompts.

        Includes verification badge, extended content (500 chars), and source reference.
        """
        vstatus = e.verification_status or "unverified"
        if vstatus == "verified":
            badge = "[VERIFIED]"
        elif vstatus == "flagged":
            badge = "[FLAGGED]"
        elif vstatus == "rejected":
            badge = "[REJECTED]"
        else:
            badge = "[UNVERIFIED]"

        source_ref = ""
        if e.source_url and hasattr(self, "_source_index"):
            ref_num = self._source_index.get(e.source_url)
            if ref_num:
                try:
                    domain = urlparse(e.source_url).netloc.replace("www.", "")
                except Exception:
                    logger.warning("Evidence source URL parsing failed", exc_info=True)
                    domain = e.source_url[:40]
                source_ref = f" [Source: [{ref_num}] {domain}]"

        content = e.content[:500]
        return f"- [{e.evidence_type.value.upper()}] {badge} {content}{source_ref}"

    def _format_evidence_block(self, evidence: list[Evidence], max_chars: int = None) -> str:
        """Format a list of evidence for prompt inclusion, with truncation."""
        max_chars = max_chars or MAX_EVIDENCE_CHARS
        lines = [self._format_evidence_for_prompt(e) for e in evidence]
        text = "\n".join(lines)
        if len(text) > max_chars:
            text = text[:max_chars] + "\n... [truncated for length]"
        return text

    def _select_evidence_for_section(
        self,
        evidence: list[Evidence],
        section_title: str,
        section_description: str = "",
        section_type: SectionType = SectionType.NARRATIVE,
        max_evidence: int = 20,
    ) -> list[Evidence]:
        """Select the most relevant evidence for a given section.

        Scores each piece of evidence by keyword match, type affinity, verification status,
        and confidence.
        """
        stop_words = {
            "the", "a", "an", "of", "in", "on", "at", "to", "for",
            "and", "or", "is", "are", "this", "that", "with", "from",
        }
        raw_keywords = (section_title + " " + section_description).lower().split()
        keywords = [w for w in raw_keywords if w not in stop_words and len(w) > 2]

        type_affinity: dict[SectionType, set[str]] = {
            SectionType.FINDING_SUMMARY: {"fact", "insight", "contradiction"},
            SectionType.ANALYSIS: {"insight", "connection", "contradiction"},
            SectionType.GAPS: {"question", "contradiction"},
            SectionType.CONCLUSIONS: {"insight", "fact", "connection"},
            SectionType.NARRATIVE: {"fact", "insight"},
            SectionType.COMPARISON: {"fact", "connection", "contradiction"},
            SectionType.TIMELINE: {"fact"},
            SectionType.FLASH_NUMBERS: {"fact"},
            SectionType.STATS_TABLE: {"fact"},
            SectionType.TLDR: {"fact", "insight"},
        }
        preferred_types = type_affinity.get(section_type, {"fact", "insight"})

        verification_weights = {
            "verified": 3.0,
            "unverified": 1.5,
            "flagged": 1.0,
            "rejected": -2.0,
        }

        scored: list[tuple[float, Evidence]] = []
        for e in evidence:
            score = 0.0

            # 1. Keyword match (0-3 pts)
            text = (e.content + " " + (e.search_query or "")).lower()
            kw_hits = sum(1 for kw in keywords if kw in text)
            score += min(3.0, kw_hits)

            # 2. Type affinity (0-2 pts)
            if e.evidence_type.value in preferred_types:
                score += 2.0

            # 3. Verification-weighted confidence (0-3 pts)
            vstatus = e.verification_status or "unverified"
            score += verification_weights.get(vstatus, 1.5)
            score += (e.kg_support_score or 0.0) * 1.0

            # 4. Raw confidence as tiebreaker (0-1 pts)
            score += e.confidence

            scored.append((score, e))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [e for _, e in scored[:max_evidence]]

    def _truncate_evidence_text(self, evidence_text: str, max_chars: int = None) -> str:
        """Truncate evidence text to stay within token limits."""
        max_chars = max_chars or MAX_EVIDENCE_CHARS
        if len(evidence_text) <= max_chars:
            return evidence_text
        return evidence_text[:max_chars] + "\n... [truncated for length]"

    async def _generate_finding_summary(
        self, claim: str, evidence: list[Evidence], sub_claims: list[str]
    ) -> str:
        """Generate finding summary section (replaces verdict summary)."""
        top_evidence = sorted(evidence, key=lambda e: e.confidence, reverse=True)[:20]
        evidence_text = "\n".join(
            [
                f"- [{e.evidence_type.value}] ({getattr(e, 'corpus', 'external')}) {e.content[:300]}"
                for e in top_evidence
            ]
        )
        evidence_text = self._truncate_evidence_text(evidence_text)

        prompt = f"""You are writing the Finding Summary for an R&D intelligence landscape report.

RESEARCH BRIEF: {claim}

SUB-QUESTIONS INVESTIGATED: {", ".join(sub_claims[:10])}

KEY EVIDENCE (with corpus tags — internal / external):
{evidence_text}

Write a compelling 3-4 paragraph finding summary that:
1. Opens with what the evidence actually shows (no TRUE/FALSE verdict)
2. Summarizes the strongest findings and the sources behind them
3. Highlights contested areas where sources disagree
4. Notes where internal and external evidence corroborate, contradict, or overlap

Write in a professional, authoritative tone. Be specific with facts and figures.
Do NOT include any citations or references in this section - those go at the end.
Do NOT output a TRUE/FALSE/MIXED verdict.
Output ONLY the finding summary text, no headers."""

        return await self._call_claude(
            prompt, "You are an expert R&D analyst writing a landscape finding summary."
        )

    async def _generate_introduction(self, claim: str, evidence: list[Evidence]) -> str:
        """Generate introduction section."""
        facts = [e for e in evidence if e.evidence_type.value == "fact"][:5]
        insights = [e for e in evidence if e.evidence_type.value == "insight"][:3]

        context = "\n".join([f"- {e.content}" for e in facts + insights])

        prompt = f"""You are writing the Introduction section for an R&D intelligence landscape report.

RESEARCH BRIEF: {claim}

CONTEXT FROM THE AUDIT:
{context}

Write a 2-3 paragraph introduction that:
1. Establishes why this research brief matters and its context
2. Provides necessary background for understanding the evidence
3. Outlines what the report will cover (methodology briefly, then evidence and findings)

Write in an engaging, informative style. Set up the reader to understand what follows.
Do NOT include any citations - those go at the end of the report.
Output ONLY the introduction text, no headers."""

        return await self._call_claude(prompt, "You are an expert R&D intelligence writer.")

    async def _generate_main_sections(
        self, claim: str, evidence: list[Evidence]
    ) -> list[ReportSection]:
        """Generate main narrative sections organized by theme."""
        top_evidence = sorted(evidence, key=lambda e: e.confidence, reverse=True)[:40]
        evidence_summary = "\n".join(
            [f"- [{e.evidence_type.value}] {e.content[:200]}" for e in top_evidence]
        )
        evidence_summary = self._truncate_evidence_text(evidence_summary, 10000)

        theme_prompt = f"""Analyze this evidence and identify 4-6 main thematic sections for organizing a comprehensive R&D intelligence landscape report.

CLAIM BEING CHECKED: {claim}

EVIDENCE SAMPLE:
{evidence_summary}

Return ONLY a JSON array of section titles, like:
["Section 1 Title", "Section 2 Title", "Section 3 Title", ...]

Choose themes that:
1. Cover the major aspects of the claim being checked
2. Group related evidence logically
3. Tell a coherent story from context to evidence to landscape findings
4. Are specific, not generic (e.g., "Statistical Evidence Analysis" not "Evidence")"""

        themes_response = await self._call_claude(theme_prompt)

        themes = []
        try:
            match = re.search(r"\[.*\]", themes_response, re.DOTALL)
            if match:
                themes = json.loads(match.group())
        except Exception:
            logger.warning("Theme parsing failed, using fallback themes", exc_info=True)
            themes = [
                "Background and Context",
                "Evidence Supporting the Claim",
                "Evidence Against the Claim",
                "Sub-claim Analysis",
            ]

        sections = []
        for theme in themes[:6]:
            section_content = await self._generate_section_content(claim, theme, evidence)
            sections.append(ReportSection(title=theme, content=section_content))

        return sections

    async def _generate_section_content(
        self, claim: str, section_title: str, evidence: list[Evidence]
    ) -> str:
        """Generate content for a specific section (legacy path)."""
        selected = self._select_evidence_for_section(
            evidence,
            section_title,
            "",
            section_type=SectionType.NARRATIVE,
            max_evidence=20,
        )
        evidence_text = self._format_evidence_block(selected, 12000)

        prompt = f"""You are writing a section of an R&D intelligence landscape report.

CLAIM BEING CHECKED: {claim}
SECTION TITLE: {section_title}

AVAILABLE EVIDENCE:
{evidence_text}

CITATION INSTRUCTIONS:
- Each piece of evidence includes a source like [Source: [N] domain].
- Cite claims inline using [N] notation, e.g., "accuracy improved 40% [3]."
- Aim for 3-8 citations per section. Do NOT list references at the end.

Write 4-6 paragraphs for this section that:
1. Opens with the key point or main evidence for this theme
2. Develops the narrative with supporting details and evidence
3. Explains significance and implications for the research landscape
4. Connects to the broader claim being checked
5. Notes any nuances, debates, or areas of uncertainty

Guidelines:
- Write flowing prose, not bullet points
- Name specific sources, organizations, or studies when available
- Use exact numbers, dates, and details from evidence

Output ONLY the section content, no headers."""

        return await self._call_claude(
            prompt,
            "You are writing a sourced, evidence-based fact-check report. Every major claim must cite its source using [N].",
        )

    async def _generate_analysis(
        self, claim: str, evidence: list[Evidence], evidence_by_type: dict
    ) -> str:
        """Generate analysis and key insights section."""
        insights = evidence_by_type.get("insight", [])[:10]
        connections = evidence_by_type.get("connection", [])[:5]
        contradictions = evidence_by_type.get("contradiction", [])[:3]
        questions = evidence_by_type.get("question", [])[:5]

        analysis_data = []
        if insights:
            analysis_data.append("INSIGHTS:\n" + "\n".join([f"- {i.content}" for i in insights]))
        if connections:
            analysis_data.append(
                "CONNECTIONS:\n" + "\n".join([f"- {c.content}" for c in connections])
            )
        if contradictions:
            analysis_data.append(
                "CONTRADICTIONS:\n" + "\n".join([f"- {c.content}" for c in contradictions])
            )
        if questions:
            analysis_data.append(
                "OPEN QUESTIONS:\n" + "\n".join([f"- {q.content}" for q in questions])
            )

        prompt = f"""You are writing the Analysis and Key Insights section of an R&D intelligence landscape report.

CLAIM BEING CHECKED: {claim}

{chr(10).join(analysis_data)}

Write 3-4 paragraphs of analysis that:
1. Synthesizes the most important evidence across all sources
2. Identifies patterns, trends, and connections
3. Addresses any contradictions or debates in the evidence
4. Highlights gaps in evidence or areas needing more investigation

Be analytical and thoughtful. Draw connections the reader might not see.
Do NOT include citations - those go at the end.
Output ONLY the analysis text, no headers."""

        return await self._call_claude(
            prompt, "You are an expert fact-checker providing deep synthesis and analysis."
        )

    async def _generate_conclusions(
        self, claim: str, evidence: list[Evidence], sub_claims_remaining: list[str]
    ) -> str:
        """Generate conclusions and recommendations."""
        top_evidence = sorted(evidence, key=lambda e: e.confidence, reverse=True)[:10]
        evidence_summary = "\n".join([f"- {e.content}" for e in top_evidence])

        prompt = f"""You are writing the Conclusions section of an R&D intelligence landscape report.

RESEARCH BRIEF: {claim}

KEY EVIDENCE:
{evidence_summary}

SUB-QUESTIONS FOR FURTHER INVESTIGATION: {", ".join(sub_claims_remaining[:5]) if sub_claims_remaining else "None identified"}

Write 2-3 paragraphs that:
1. Summarize the strongest findings and the evidence that supports them
2. Note contested areas (where sources disagree) and white space (gaps the literature has not covered)
3. Provide actionable context for the researcher
4. Suggest next research directions

Be definitive where evidence supports it, and appropriately hedged where uncertainty exists.
Do NOT output a TRUE/FALSE/MIXED verdict.
Output ONLY the conclusions text, no headers."""

        return await self._call_claude(
            prompt, "You are an expert R&D analyst writing landscape conclusions."
        )

    def _get_representative_evidence(
        self, evidence: list[Evidence], max_total: int = 80
    ) -> list[Evidence]:
        """Get a stratified sample of evidence grouped by search_query.

        Instead of taking top-N by confidence (which skews to one topic),
        take top 2-3 per search query group to give the planner a complete picture.
        """
        groups: dict[str, list[Evidence]] = {}
        for e in evidence:
            key = e.search_query or "__no_query__"
            groups.setdefault(key, []).append(e)

        for key in groups:
            groups[key].sort(key=lambda e: e.confidence, reverse=True)

        per_group = max(2, min(3, max_total // max(1, len(groups))))
        selected: list[Evidence] = []
        for key in groups:
            selected.extend(groups[key][:per_group])

        if len(selected) < max_total:
            selected_ids = {id(e) for e in selected}
            remaining = sorted(
                [e for e in evidence if id(e) not in selected_ids],
                key=lambda e: e.confidence,
                reverse=True,
            )
            selected.extend(remaining[: max_total - len(selected)])

        return selected[:max_total]

    _USER_SECTION_TYPE_MAP: dict[str, SectionType] = {
        "finding": SectionType.FINDING_SUMMARY,
        "finding summary": SectionType.FINDING_SUMMARY,
        "landscape": SectionType.FINDING_SUMMARY,
        "overview": SectionType.FINDING_SUMMARY,
        "tldr": SectionType.TLDR,
        "tl;dr": SectionType.TLDR,
        "tl dr": SectionType.TLDR,
        "summary": SectionType.TLDR,
        "executive summary": SectionType.TLDR,
        "gaps": SectionType.GAPS,
        "open questions": SectionType.GAPS,
        "limitations": SectionType.GAPS,
        "conclusions": SectionType.CONCLUSIONS,
        "conclusion": SectionType.CONCLUSIONS,
        "recommendations": SectionType.CONCLUSIONS,
        "analysis": SectionType.ANALYSIS,
        "insights": SectionType.ANALYSIS,
        "patterns": SectionType.ANALYSIS,
        "comparison": SectionType.COMPARISON,
        "timeline": SectionType.TIMELINE,
    }

    def _infer_section_type(self, title: str) -> SectionType:
        """Infer a SectionType from a user-provided section title."""
        normalized = title.strip().lower()
        for keyword, section_type in self._USER_SECTION_TYPE_MAP.items():
            if keyword in normalized:
                return section_type
        return SectionType.NARRATIVE

    async def _plan_report_structure(
        self,
        claim: str,
        evidence: list[Evidence],
        sub_claims_explored: list[str],
        user_sections: list[str] | None = None,
    ) -> list[PlannedSection]:
        """Have AI analyze evidence and plan what sections the report needs.

        If user_sections is provided, skip AI planning and build sections directly
        from the user's requested outline.
        """
        if user_sections:
            logger.info(
                "Using user-provided section structure: %s", user_sections
            )
            planned = []
            for i, title in enumerate(user_sections):
                section_type = self._infer_section_type(title)
                planned.append(
                    PlannedSection(
                        section_type=section_type,
                        title=title,
                        description=f"User-requested section: {title}",
                        priority=len(user_sections) - i,
                    )
                )
            return planned

        representative = self._get_representative_evidence(evidence, max_total=80)
        evidence_summary = self._format_evidence_block(representative, 12000)

        type_counts = {}
        for e in evidence:
            t = e.evidence_type.value
            type_counts[t] = type_counts.get(t, 0) + 1

        prompt = f"""Analyze this evidence and plan the optimal R&D intelligence landscape report structure.

RESEARCH BRIEF: {claim}

EVIDENCE COUNTS BY TYPE: {json.dumps(type_counts)}

SUB-QUESTIONS EXPLORED: {", ".join(sub_claims_explored[:10]) if sub_claims_explored else "Various"}

SAMPLE EVIDENCE:
{evidence_summary}

Your task: Decide what sections this intelligence report needs based on the content. Choose from these section types:

- finding_summary: The overall finding with confidence / consensus / diversity (ALWAYS include first)
- tldr: A 2-3 sentence bottom-line summary
- flash_numbers: Key metrics/statistics callouts if quantitative data exists
- stats_table: Tabular comparison if comparing multiple items
- comparison: Side-by-side analysis if comparing approaches/sources
- timeline: Chronological progression if temporal data exists
- narrative: Standard prose section for a specific theme
- analysis: Deep synthesis of patterns and insights
- gaps: Open questions, contested areas, and white space
- conclusions: Final takeaways and next research directions (always include near end)

Return a JSON array of sections in the order they should appear. Example format:
[
  {{"type": "finding_summary", "title": "Key Finding", "description": "Overall landscape finding with confidence, consensus, and diversity scores", "priority": 10}},
  {{"type": "tldr", "title": "TL;DR", "description": "Bottom-line landscape summary", "priority": 9}},
  {{"type": "narrative", "title": "Corroborating Evidence", "description": "Evidence agreeing with the dominant finding", "priority": 8}},
  {{"type": "narrative", "title": "Contested Areas", "description": "Evidence where sources disagree", "priority": 7}},
  {{"type": "narrative", "title": "Cross-corpus Signals", "description": "Where internal work meets the external literature", "priority": 6}},
  {{"type": "analysis", "title": "Patterns & Insights", "description": "Cross-cutting analysis", "priority": 5}},
  {{"type": "gaps", "title": "White Space", "description": "Questions the literature has not covered", "priority": 4}},
  {{"type": "conclusions", "title": "Conclusions", "description": "Recommended next research directions", "priority": 3}}
]

Guidelines:
- ALWAYS start with finding_summary
- Include sections for corroborating AND contested evidence
- Include flash_numbers ONLY if significant quantitative data exists
- Include stats_table or comparison ONLY if comparing multiple distinct items
- Include timeline ONLY if clear temporal progression exists
- Use 3-5 narrative sections with SPECIFIC titles
- ALWAYS end with conclusions
- Total sections should be 6-10

Return ONLY the JSON array, no explanation."""

        response = await self._call_claude(
            prompt, "You are an expert R&D analyst planning an intelligence report structure."
        )

        planned_sections = []
        try:
            match = re.search(r"\[.*\]", response, re.DOTALL)
            if match:
                sections_data = json.loads(match.group())
                for s in sections_data:
                    try:
                        section_type = SectionType(s.get("type", "narrative"))
                    except ValueError:
                        section_type = SectionType.NARRATIVE
                    planned_sections.append(
                        PlannedSection(
                            section_type=section_type,
                            title=s.get("title", "Section"),
                            description=s.get("description", ""),
                            priority=s.get("priority", 5),
                        )
                    )
        except (json.JSONDecodeError, KeyError):
            logger.warning("Report structure planning failed, using fallback", exc_info=True)
            planned_sections = [
                PlannedSection(SectionType.FINDING_SUMMARY, "Key Finding", "Overall landscape finding"),
                PlannedSection(SectionType.TLDR, "TL;DR", "Bottom-line landscape summary"),
                PlannedSection(SectionType.NARRATIVE, "Corroborating Evidence", "Evidence agreeing with the dominant finding"),
                PlannedSection(SectionType.NARRATIVE, "Contested Areas", "Evidence where sources disagree"),
                PlannedSection(SectionType.ANALYSIS, "Analysis", "Synthesis and insights"),
                PlannedSection(SectionType.CONCLUSIONS, "Conclusions", "Recommended next research directions"),
            ]

        return planned_sections

    def _format_kg_context(self, kg_exports: dict | None, section_type: SectionType) -> str:
        """Extract relevant KG data for a given section type."""
        if not kg_exports:
            return ""

        parts: list[str] = []

        if section_type in (SectionType.NARRATIVE, SectionType.ANALYSIS, SectionType.CONCLUSIONS, SectionType.FINDING_SUMMARY):
            key_concepts = kg_exports.get("key_concepts", [])
            if key_concepts:
                concepts_str = ", ".join(f"{c['name']} ({c['type']})" for c in key_concepts[:5])
                parts.append(f"Key concepts (by importance): {concepts_str}")

        if section_type in (
            SectionType.ANALYSIS,
            SectionType.GAPS,
            SectionType.NARRATIVE,
            SectionType.CONCLUSIONS,
            SectionType.COMPARISON,
            SectionType.FINDING_SUMMARY,
        ):
            contradictions = kg_exports.get("contradictions", [])
            if contradictions:
                contras = []
                for c in contradictions[:3]:
                    desc = c.get("description", c.get("recommendation", "Unknown"))
                    severity = c.get("severity", "unknown")
                    contras.append(f"- {desc} (severity: {severity})")
                parts.append("Contradictions detected:\n" + "\n".join(contras))

        if section_type == SectionType.GAPS:
            gaps = kg_exports.get("gaps", [])
            if gaps:
                gap_items = []
                for g in gaps[:5]:
                    rec = g.get("recommendation", g.get("gap_type", "Unknown"))
                    gap_items.append(f"- {rec}")
                parts.append("Knowledge gaps identified:\n" + "\n".join(gap_items))

        if not parts:
            return ""
        return "\nKNOWLEDGE GRAPH CONTEXT:\n" + "\n\n".join(parts) + "\n"

    # Tier 1-2 academic domains for coverage confidence scoring
    _ACADEMIC_DOMAINS: set[str] = {
        "arxiv.org",
        "aclanthology.org",
        "nature.com",
        "sciencedirect.com",
        "ieee.org",
        "dl.acm.org",
        "openreview.net",
        "semanticscholar.org",
        "researchgate.net",
        "pmc.ncbi.nlm.nih.gov",
    }

    def _assess_section_coverage(
        self, selected: list[Evidence]
    ) -> tuple[str, int, int]:
        """Assess coverage confidence for a set of selected evidence.

        Returns:
            Tuple of (confidence_level, unique_evidence_count, academic_source_count)
            where confidence_level is "HIGH", "MEDIUM", or "LOW".
        """
        n_evidence = len(selected)

        academic_urls: set[str] = set()
        for e in selected:
            if not e.source_url:
                continue
            try:
                domain = urlparse(e.source_url).netloc.replace("www.", "")
                if domain in self._ACADEMIC_DOMAINS:
                    normalized = self._url_to_normalized.get(e.source_url, e.source_url)
                    academic_urls.add(normalized)
            except Exception:
                continue
        n_academic = len(academic_urls)

        # For fact-checking, academic sources are rare — don't penalize for that.
        # Judge coverage by total evidence count alone.
        if n_evidence < 3:
            confidence = "LOW"
        elif n_evidence <= 8:
            confidence = "MEDIUM"
        else:
            confidence = "HIGH"

        logger.debug(
            "Section coverage: %s (%d evidence, %d academic sources)",
            confidence, n_evidence, n_academic,
        )
        return confidence, n_evidence, n_academic

    async def _generate_dynamic_section(
        self,
        section: PlannedSection,
        claim: str,
        evidence: list[Evidence],
        kg_exports: dict | None = None,
    ) -> str:
        """Generate content for a planned section based on its type.

        Uses data-driven _SECTION_CONFIGS to avoid duplicating scaffolding
        across section types.
        """
        config = _SECTION_CONFIGS.get(
            section.section_type, _SECTION_CONFIGS[SectionType.NARRATIVE]
        )

        filtered = evidence
        if config.pre_filter:
            filter_fn = _PRE_FILTERS.get(config.pre_filter)
            if filter_fn:
                filtered = filter_fn(evidence)
                if config.allow_empty and not filtered:
                    return ""

        if config.skip_selection:
            selected = filtered
        else:
            selected = self._select_evidence_for_section(
                filtered,
                config.selection_title or section.title,
                config.selection_description or section.description,
                section_type=section.section_type,
                max_evidence=config.max_evidence,
            )

        coverage_confidence, n_evidence, n_academic = self._assess_section_coverage(selected)

        evidence_text = self._format_evidence_block(selected, config.max_evidence_chars)
        kg_context = (
            self._format_kg_context(kg_exports, section.section_type)
            if config.use_kg_context else ""
        )
        citations = _CITATION_INSTRUCTIONS if config.use_citations else ""

        prompt = config.prompt_template.format(
            claim=claim,
            title=section.title,
            description=section.description,
            evidence=evidence_text,
            kg_context=kg_context,
            citations=citations,
        )

        if coverage_confidence == "LOW":
            prompt = (
                "NOTE: Focus on the available evidence. Do not pad with "
                "tangentially related material.\n\n"
                + prompt
            )

        content = await self._call_claude(
            prompt, _SECTION_SYSTEM_PROMPT + config.system_suffix
        )

        # Don't add disclaimers — the evidence gathered is sufficient for fact-checking

        return content

    async def generate_dynamic_report(
        self,
        session: CheckSession,
        evidence: list[Evidence],
        sub_claims_explored: list[str],
        sub_claims_remaining: list[str],  # noqa: ARG002 - kept for API compatibility
        kg_exports: dict = None,
        verification_metrics: dict = None,
        progress_callback: Callable[[str, int], Awaitable[None]] | None = None,
        user_sections: list[str] | None = None,
    ) -> str:
        """Generate a comprehensive intelligence report with AI-driven dynamic structure.

        Args:
            session: The research session
            evidence: All evidence from the audit
            sub_claims_explored: Sub-questions that were investigated
            sub_claims_remaining: Sub-questions that could be investigated with more time (unused in dynamic mode)
            kg_exports: Optional knowledge graph exports
            verification_metrics: Optional verification metrics from the pipeline
            user_sections: Optional list of section titles to use instead of AI planning

        Returns:
            Complete markdown intelligence report
        """
        del sub_claims_remaining  # Unused in dynamic mode, but kept for API compatibility
        sources = self._extract_sources(evidence)

        # Build source index for inline citations [N]
        self._source_index: dict[str, int] = {}
        for i, src in enumerate(sources, 1):
            self._source_index[src["url"]] = i
        for original_url, normalized_url in self._url_to_normalized.items():
            if normalized_url in self._source_index:
                self._source_index[original_url] = self._source_index[normalized_url]

        # Phase 1: Plan the report structure
        await _emit_progress(progress_callback, "Planning intelligence report structure...", 5)
        logger.info("Planning intelligence report structure...")
        planned_sections = await self._plan_report_structure(
            session.claim, evidence, sub_claims_explored, user_sections=user_sections
        )
        await _emit_progress(progress_callback, "Planned intelligence report structure", 10)
        logger.info("Planned %d sections: %s", len(planned_sections), [s.title for s in planned_sections])

        # Phase 2: Generate each section (with pacing to avoid rate limits)
        for i, section in enumerate(planned_sections):
            progress = 10 + int(((i + 1) / max(1, len(planned_sections))) * 80)
            await _emit_progress(
                progress_callback,
                f"Generating section {i + 1}/{len(planned_sections)}: {section.title}",
                progress,
            )
            logger.info("Generating section %d/%d: %s", i + 1, len(planned_sections), section.title)
            try:
                section.content = await self._generate_dynamic_section(
                    section, session.claim, evidence, kg_exports=kg_exports
                )
            except Exception as e:
                logger.error(
                    "Failed to generate section '%s': %s", section.title, e, exc_info=True
                )
                section.content = (
                    f"*[Section generation failed: {type(e).__name__}. "
                    f"The evidence for this section was collected but could not be synthesized.]*"
                )
            # Brief pause between sections to reduce rate limit pressure
            if i < len(planned_sections) - 1:
                await asyncio.sleep(2)

        # Compile the report
        logger.info("Intelligence report generation complete: %d sections", len(planned_sections))
        await _emit_progress(progress_callback, "Compiling intelligence report...", 95)
        return self._compile_dynamic_report(
            session=session,
            planned_sections=planned_sections,
            sources=sources,
            evidence=evidence,
            sub_claims_explored=sub_claims_explored,
            kg_exports=kg_exports,
            verification_metrics=verification_metrics,
        )

    @staticmethod
    def _scores_badge(session: CheckSession) -> str:
        """Render the confidence / consensus / diversity header badge."""
        def _fmt(v: float | None) -> str:
            if v is None:
                return "—"
            return f"{v * 100:.0f}%" if v <= 1.0 else f"{v:.2f}"

        return (
            f"**Confidence:** {_fmt(session.confidence)} · "
            f"**Consensus:** {_fmt(session.consensus)} · "
            f"**Source diversity:** {_fmt(session.source_diversity)}"
        )

    def _compile_dynamic_report(
        self,
        session: CheckSession,
        planned_sections: list[PlannedSection],
        sources: list[dict],
        evidence: list[Evidence],
        sub_claims_explored: list[str],
        kg_exports: dict = None,
        verification_metrics: dict = None,
    ) -> str:
        """Compile dynamically planned sections into the final intelligence report."""
        # Build table of contents
        toc_items = []
        for i, section in enumerate(planned_sections, 1):
            toc_items.append(f"{i}. {section.title}")
        toc_items.append(f"{len(planned_sections) + 1}. References")

        toc = "\n".join(
            [
                f"- [{item}](#{item.lower().replace(' ', '-').replace('.', '')})"
                for item in toc_items
            ]
        )

        # Landscape scores badge for the header
        scores_badge = self._scores_badge(session)

        # Build main content with type-specific formatting
        main_content = ""
        for i, section in enumerate(planned_sections, 1):
            main_content += f"\n## {i}. {section.title}\n\n"

            if section.section_type == SectionType.TLDR:
                content = section.content.strip()
                if not content.startswith(">"):
                    content = "> " + content.replace("\n", "\n> ")
                main_content += f"{content}\n"
            else:
                main_content += f"{section.content.strip()}\n"

            main_content += "\n---\n"

        # Build references
        references = []
        for i, source in enumerate(sources, 1):
            title = source.get("title", source["domain"])
            references.append(f"[{i}] {title}. *{source['domain']}*. {source['url']}")
        references_text = "\n\n".join(references)
        retrieval_date = datetime.now().strftime("%B %d, %Y")

        # Stats
        sub_claims_count = len(sub_claims_explored) if sub_claims_explored else len(sources)
        stats = f"""**Audit Statistics:**
- Total Evidence Collected: {len(evidence)}
- Sources Analyzed: {len(sources)}
- Sub-questions Investigated: {sub_claims_count}
- Run Duration: {session.started_at.strftime("%Y-%m-%d %H:%M")} to {session.ended_at.strftime("%Y-%m-%d %H:%M") if session.ended_at else "In Progress"}"""

        # Compile full report
        report = f"""# Meridian Intelligence Audit: {session.claim}

*Landscape Report*

{scores_badge}

---

**Generated:** {datetime.now().strftime("%B %d, %Y at %H:%M")}
**Session ID:** {session.id}

---

## Table of Contents

{toc}

---
{main_content}
## {len(planned_sections) + 1}. References

*All sources accessed on {retrieval_date}.*

{references_text}

---

## Appendix: Audit Methodology

This intelligence report was generated using a hierarchical multi-agent R&D research system:

1. **Brief Decomposition**: An AI director agent analyzed the research brief and decomposed it into investigable sub-questions.
2. **Evidence Gathering**: AI intern agents conducted {len(sources)} searches across web, academic, patent, standards, regulatory, and internal sources.
3. **Evidence Extraction**: {len(evidence)} discrete pieces of evidence were extracted, tagged by corpus (internal / external), and categorized by type.
4. **Report Structure Planning**: AI analyzed the evidence to determine optimal report sections (finding summary, corroborating evidence, contested areas, cross-corpus signals, etc.).
5. **Narrative Synthesis**: Each section was generated with inline [N] citations.
6. **Landscape Scoring**: Confidence, consensus, and source-diversity scores were computed heuristically from evidence weights, KG corroboration ratios, and domain Gini spread.

{stats}

**Sub-questions Investigated:**
{chr(10).join(["- " + t for t in sub_claims_explored[:15]]) if sub_claims_explored else "- " + session.claim}

{self._format_verification_section(verification_metrics, evidence) if verification_metrics else ""}

{self._format_kg_section(kg_exports) if kg_exports else ""}

---

*Intelligence report generated by Meridian — R&D Intelligence Platform*
"""
        return report

    def _compile_report(
        self,
        session: CheckSession,
        finding_summary: str,
        introduction: str,
        main_sections: list[ReportSection],
        analysis: str,
        conclusions: str,
        sources: list[dict],
        evidence: list[Evidence],
        sub_claims_explored: list[str],
        kg_exports: dict = None,
    ) -> str:
        """Compile all sections into the final intelligence report (legacy fixed structure)."""
        toc_items = [
            "1. Finding Summary",
            "2. Introduction",
        ]
        for i, section in enumerate(main_sections, 3):
            toc_items.append(f"{i}. {section.title}")
        toc_items.extend(
            [
                f"{len(main_sections) + 3}. Analysis and Key Insights",
                f"{len(main_sections) + 4}. Conclusions",
                f"{len(main_sections) + 5}. References",
            ]
        )

        toc = "\n".join(
            [
                f"- [{item}](#{item.lower().replace(' ', '-').replace('.', '')})"
                for item in toc_items
            ]
        )

        main_content = ""
        for i, section in enumerate(main_sections, 3):
            main_content += f"\n## {i}. {section.title}\n\n{section.content}\n"

        references = []
        for i, source in enumerate(sources, 1):
            title = source.get("title", source["domain"])
            references.append(f"[{i}] {title}. *{source['domain']}*. {source['url']}")
        references_text = "\n\n".join(references)

        retrieval_date = datetime.now().strftime("%B %d, %Y")
        scores_badge = self._scores_badge(session)

        sub_claims_count = len(sub_claims_explored) if sub_claims_explored else len(sources)
        stats = f"""**Audit Statistics:**
- Total Evidence Collected: {len(evidence)}
- Sources Analyzed: {len(sources)}
- Sub-questions Investigated: {sub_claims_count}
- Run Duration: {session.started_at.strftime("%Y-%m-%d %H:%M")} to {session.ended_at.strftime("%Y-%m-%d %H:%M") if session.ended_at else "In Progress"}"""

        report = f"""# Meridian Intelligence Audit: {session.claim}

*Landscape Report*

{scores_badge}

---

**Generated:** {datetime.now().strftime("%B %d, %Y at %H:%M")}
**Session ID:** {session.id}

---

## Table of Contents

{toc}

---

## 1. Finding Summary

{finding_summary}

---

## 2. Introduction

{introduction}

---
{main_content}
---

## {len(main_sections) + 3}. Analysis and Key Insights

{analysis}

---

## {len(main_sections) + 4}. Conclusions

{conclusions}

---

## {len(main_sections) + 5}. References

*All sources accessed on {retrieval_date}.*

{references_text}

---

## Appendix: Audit Methodology

This intelligence report was generated using a hierarchical multi-agent R&D research system:

1. **Brief Decomposition**: An AI director agent analyzed the research brief and decomposed it into investigable sub-questions.
2. **Evidence Gathering**: AI intern agents conducted {len(sources)} searches across web, academic, patent, standards, regulatory, and internal sources.
3. **Evidence Extraction**: {len(evidence)} discrete pieces of evidence were extracted, tagged by corpus (internal / external), and categorized by type.
4. **Critical Review**: Each batch of evidence was critiqued for accuracy, relevance, and gaps.
5. **Knowledge Graph Construction**: Evidence was integrated into a real-time knowledge graph for gap detection and contradiction analysis.
6. **Landscape Synthesis**: An AI writer (Claude Opus) synthesized the evidence into a confidence-scored landscape with contested areas and white space surfaced explicitly.

{stats}

**Sub-questions Investigated:**
{chr(10).join(["- " + t for t in sub_claims_explored[:15]]) if sub_claims_explored else "- " + session.claim}

{self._format_kg_section(kg_exports) if kg_exports else ""}

---

*Intelligence report generated by Meridian — R&D Intelligence Platform*
"""
        return report

    def _format_verification_section(
        self, verification_metrics: dict, evidence: list[Evidence]
    ) -> str:
        """Format verification section for the report."""
        if not verification_metrics:
            return ""

        sections = ["---", "", "## Appendix: Evidence Verification Analysis"]

        status = verification_metrics.get("status", {})
        verified = status.get("verified", 0)
        flagged = status.get("flagged", 0)
        rejected = status.get("rejected", 0)
        total = verification_metrics.get("total_verifications", 0)

        if total > 0:
            sections.append(f"""
**Verification Summary:**
- Total Evidence Verified: {total}
- High Confidence (Verified, >85%): {verified} ({verified / total * 100:.1f}%)
- Medium Confidence (Flagged, 50-85%): {flagged} ({flagged / total * 100:.1f}%)
- Low Confidence (Rejected, <50%): {rejected} ({rejected / total * 100:.1f}%)
""")

        confidence = verification_metrics.get("confidence", {})
        avg_delta = confidence.get("avg_delta", 0)
        if avg_delta != 0:
            direction = "increased" if avg_delta > 0 else "decreased"
            sections.append(
                f"**Confidence Calibration:** Average confidence {direction} by {abs(avg_delta) * 100:.1f}% after verification.\n"
            )

        contradictions = verification_metrics.get("contradictions", {})
        total_contradictions = contradictions.get("total", 0)
        if total_contradictions > 0:
            sections.append(f"""
**Contradictions Detected:** {total_contradictions}
These pieces of evidence had conflicting information that may require further investigation.
""")

        kg_int = verification_metrics.get("kg_integration", {})
        kg_matches = kg_int.get("matches", 0)
        if kg_matches > 0:
            sections.append(
                f"**Knowledge Graph Corroboration:** {kg_matches} pieces of evidence were corroborated by the knowledge graph.\n"
            )

        latency = verification_metrics.get("latency", {})
        streaming_avg = latency.get("streaming_avg_ms", 0)
        batch_avg = latency.get("batch_avg_ms", 0)
        if streaming_avg > 0 or batch_avg > 0:
            sections.append(f"""
**Verification Performance:**
- Streaming verification: {streaming_avg:.0f}ms avg (target <500ms)
- Batch verification: {batch_avg:.0f}ms avg (target <2000ms)
""")

        verified_evidence = [e for e in evidence if e.verification_status == "verified"][:5]
        flagged_evidence = [e for e in evidence if e.verification_status == "flagged"][:3]
        rejected_evidence = [e for e in evidence if e.verification_status == "rejected"][:3]

        if verified_evidence:
            sections.append("\n**Sample Verified Evidence (High Confidence):**")
            for e in verified_evidence:
                badge = f"[{e.confidence * 100:.0f}%]"
                sections.append(f"- {badge} {e.content[:150]}...")

        if flagged_evidence:
            sections.append("\n**Flagged Evidence (Needs Review):**")
            for e in flagged_evidence:
                badge = f"[{e.confidence * 100:.0f}%]"
                sections.append(f"- {badge} {e.content[:150]}...")

        if rejected_evidence:
            sections.append("\n**Rejected Evidence (Low Confidence):**")
            for e in rejected_evidence:
                badge = f"[{e.confidence * 100:.0f}%]"
                sections.append(f"- {badge} {e.content[:150]}...")

        sections.append("")
        return "\n".join(sections)

    def _format_kg_section(self, kg_exports: dict) -> str:
        """Format knowledge graph section for the report."""
        if not kg_exports:
            return ""

        sections = ["---", "", "## Appendix: Knowledge Graph Analysis"]

        stats = kg_exports.get("stats", {})
        if stats:
            sections.append(f"""
**Knowledge Graph Statistics:**
- Entities extracted: {stats.get("num_entities", 0)}
- Relations identified: {stats.get("num_relations", 0)}
- Connected components: {stats.get("num_components", 0)}
- Graph density: {stats.get("density", 0):.3f}
""")

        key_concepts = kg_exports.get("key_concepts", [])
        if key_concepts:
            sections.append("**Key Concepts by Importance (PageRank):**")
            for c in key_concepts[:5]:
                sections.append(f"- {c['name']} ({c['type']}) - importance: {c['importance']}")
            sections.append("")

        gaps = kg_exports.get("gaps", [])
        if gaps:
            sections.append(f"**Knowledge Gaps Identified ({len(gaps)}):**")
            for g in gaps[:5]:
                sections.append(f"- {g.get('recommendation', g.get('gap_type', 'Unknown'))}")
            sections.append("")

        contradictions = kg_exports.get("contradictions", [])
        if contradictions:
            sections.append(f"**Contradictions Detected ({len(contradictions)}):**")
            for c in contradictions[:3]:
                sections.append(f"- {c.get('description', c.get('recommendation', 'Unknown'))}")
            sections.append("")

        html_viz = kg_exports.get("html_visualization")
        if html_viz:
            sections.append(f"*Interactive visualization available at: {html_viz}*")
            sections.append("")

        return "\n".join(sections)


async def _emit_progress(
    callback: Callable[[str, int], Awaitable[None]] | None,
    message: str,
    progress: int,
) -> None:
    if callback is None:
        return
    try:
        await callback(message, progress)
    except Exception:
        logger.warning("Progress callback failed: %s", message, exc_info=True)
        return


# Backward-compat alias — kept so existing callers continue to work during the
# Phase 2 migration. New code should use `IntelligenceReportWriter` directly.
VerdictReportWriter = IntelligenceReportWriter
