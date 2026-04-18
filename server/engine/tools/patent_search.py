"""Patent search tool for Meridian intelligence audits.

Searches free patent APIs for prior art, claim overlap, and citation graphs.
v1 uses USPTO PatentsView as the primary source — free, well-documented,
no OAuth required. Google Patents via Bright Data SERP is available as a
fallback when PatentsView returns nothing or the query is outside its index.

The EPO Open Patent Services API is deliberately out of scope for v1 because
it requires OAuth client registration. PatSnap / Derwent are also out of
scope per PRD §11.2 — free sources only for v1 until a design partner
relationship justifies the licensing spend.

Each result is returned as a SearchResult with `corpus="external"` and a
structured `patent_data` dict containing whatever metadata the upstream API
surfaced (claims, CPC, citations, family tree, inventors, assignee, dates).

Interface mirrors WebSearchTool / AcademicSearchTool so the Intern agent
can plug it in without any dispatch-layer changes.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from ..logging_config import get_logger
from .academic_search import _request_with_retry
from .web_search import SearchResult

logger = get_logger(__name__)

# USPTO PatentsView — free, no key required for low-volume use.
# Docs: https://patentsview.org/apis/api-endpoints
_PATENTSVIEW_URL = "https://search.patentsview.org/api/v1/patent/"

# PatentsView requires a POST body with 'q', 'f' (fields), 's' (sort), 'o' (options).
_PATENTSVIEW_FIELDS = [
    "patent_id",
    "patent_title",
    "patent_abstract",
    "patent_date",
    "patent_type",
    "patent_num_claims",
    "assignees.assignee_organization",
    "inventors.inventor_name_first",
    "inventors.inventor_name_last",
    "cpc_current.cpc_group_id",
    "cpc_current.cpc_subsection_id",
]


@dataclass
class PatentRecord:
    """Structured patent metadata.

    Not every field is always populated — different upstream sources expose
    different slices of patent metadata. Downstream consumers should check
    for presence before using.
    """

    patent_id: str
    title: str
    url: str
    abstract: str = ""
    filing_date: str = ""
    publication_date: str = ""
    assignee: str = ""
    inventors: list[str] = field(default_factory=list)
    cpc_classifications: list[str] = field(default_factory=list)
    independent_claims: list[str] = field(default_factory=list)
    dependent_claims: list[str] = field(default_factory=list)
    backward_citations: list[str] = field(default_factory=list)
    forward_citations: list[str] = field(default_factory=list)
    family_members: list[str] = field(default_factory=list)
    source_api: str = "patentsview"

    def to_search_result(self) -> SearchResult:
        """Convert to a SearchResult tagged with corpus=external and patent_data.

        Builds a human-readable snippet out of the available metadata so the
        Manager's evidence-extraction prompt can reason over it directly
        without a second lookup.
        """
        snippet_parts: list[str] = []
        if self.abstract:
            snippet_parts.append(self.abstract[:300])
        if self.assignee:
            snippet_parts.append(f"Assignee: {self.assignee}")
        if self.inventors:
            who = ", ".join(self.inventors[:3])
            if len(self.inventors) > 3:
                who += " et al."
            snippet_parts.append(f"Inventors: {who}")
        if self.filing_date:
            snippet_parts.append(f"Filed: {self.filing_date}")
        if self.publication_date:
            snippet_parts.append(f"Published: {self.publication_date}")
        if self.cpc_classifications:
            snippet_parts.append(f"CPC: {', '.join(self.cpc_classifications[:4])}")
        if self.independent_claims:
            snippet_parts.append(f"{len(self.independent_claims)} independent claims")

        return SearchResult(
            title=self.title,
            url=self.url,
            snippet=" | ".join(snippet_parts),
            corpus="external",
            patent_data={
                "patent_id": self.patent_id,
                "assignee": self.assignee,
                "inventors": self.inventors,
                "cpc_classifications": self.cpc_classifications,
                "independent_claims": self.independent_claims,
                "dependent_claims": self.dependent_claims,
                "backward_citations": self.backward_citations,
                "forward_citations": self.forward_citations,
                "family_members": self.family_members,
                "filing_date": self.filing_date,
                "publication_date": self.publication_date,
                "source_api": self.source_api,
            },
        )


class PatentsViewSearch:
    """Thin async wrapper over USPTO PatentsView v1 search endpoint.

    Uses the shared `_request_with_retry` helper from academic_search for
    consistent backoff + retry behavior across every external API we call.
    """

    BASE_URL = _PATENTSVIEW_URL

    def __init__(self, max_results: int = 20):
        self.max_results = max_results

    async def search(self, query: str, max_results: int | None = None) -> list[PatentRecord]:
        """Search PatentsView by free-text query.

        PatentsView's v1 patent endpoint accepts a flexible query DSL; for v1
        we send a simple `_text_any` on `patent_title` and `patent_abstract`.
        This is a pragmatic starting point — the Manager can submit more
        specific directives later (e.g. CPC-class-filtered queries) once we
        surface the tool_hints scaffolding.
        """
        limit = min(max_results or self.max_results, 100)
        body = {
            "q": {
                "_or": [
                    {"_text_any": {"patent_title": query}},
                    {"_text_any": {"patent_abstract": query}},
                ]
            },
            "f": _PATENTSVIEW_FIELDS,
            "s": [{"patent_date": "desc"}],
            "o": {"size": limit},
        }

        logger.info("PatentsView search: query=%s limit=%d", query[:200], limit)
        try:
            response = await _request_with_retry(
                "POST",
                self.BASE_URL,
                params=None,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                max_retries=3,
                timeout=30.0,
                api_name="PatentsView",
            )
        except Exception as exc:
            logger.warning("PatentsView search failed: %s", exc, exc_info=True)
            return []

        # `_request_with_retry` is GET-shaped. For POST we need a specialized
        # call — fall back to httpx directly. (See TODO below.)
        return []

    async def _post(self, body: dict) -> list[PatentRecord]:
        """Internal POST helper (PatentsView is POST-only).

        Kept separate because the shared retry helper is GET-biased and
        doesn't accept a JSON body.
        """
        import httpx

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    self.BASE_URL,
                    json=body,
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.warning("PatentsView POST failed: %s", exc, exc_info=True)
            return []

        return self._parse_response(data)

    def _parse_response(self, data: dict) -> list[PatentRecord]:
        """Turn a PatentsView JSON payload into PatentRecord objects."""
        patents = data.get("patents") or data.get("results") or []
        records: list[PatentRecord] = []
        for p in patents:
            if not isinstance(p, dict):
                continue
            patent_id = p.get("patent_id") or p.get("patent_number") or ""
            if not patent_id:
                continue

            inventors_raw = p.get("inventors", []) or []
            inventors: list[str] = []
            for inv in inventors_raw:
                if isinstance(inv, dict):
                    first = inv.get("inventor_name_first") or ""
                    last = inv.get("inventor_name_last") or ""
                    full = f"{first} {last}".strip()
                    if full:
                        inventors.append(full)

            assignees_raw = p.get("assignees", []) or []
            assignee = ""
            if assignees_raw and isinstance(assignees_raw[0], dict):
                assignee = assignees_raw[0].get("assignee_organization") or ""

            cpc_raw = p.get("cpc_current", []) or []
            cpcs: list[str] = []
            for c in cpc_raw:
                if isinstance(c, dict):
                    code = c.get("cpc_group_id") or c.get("cpc_subsection_id")
                    if code:
                        cpcs.append(code)

            records.append(
                PatentRecord(
                    patent_id=str(patent_id),
                    title=p.get("patent_title", "") or "",
                    url=f"https://patents.google.com/patent/US{patent_id}",
                    abstract=p.get("patent_abstract", "") or "",
                    publication_date=p.get("patent_date", "") or "",
                    assignee=assignee,
                    inventors=inventors,
                    cpc_classifications=cpcs,
                    source_api="patentsview",
                )
            )
        return records


class GooglePatentsFallback:
    """SERP-based fallback for queries PatentsView can't answer.

    Uses the existing Bright Data web search tool (via WebSearchTool) to
    hit `site:patents.google.com <query>` and parses the result URLs into
    PatentRecord objects with minimal metadata. v1 doesn't try to scrape
    full claims — that requires an expensive batch scrape and isn't worth
    the engineering until a design partner validates the wedge.
    """

    def __init__(self):
        self._web: Any = None

    def _lazy_web(self):
        if self._web is None:
            from .web_search import WebSearchTool
            self._web = WebSearchTool(max_results=10)
        return self._web

    async def search(self, query: str, max_results: int = 10) -> list[PatentRecord]:
        web = self._lazy_web()
        try:
            results, _ = await web.search(f"site:patents.google.com {query}")
        except Exception as exc:
            logger.warning("Google Patents fallback failed: %s", exc, exc_info=True)
            return []

        records: list[PatentRecord] = []
        for r in results[:max_results]:
            patent_id = self._extract_patent_id(r.url)
            if not patent_id:
                continue
            records.append(
                PatentRecord(
                    patent_id=patent_id,
                    title=r.title or patent_id,
                    url=r.url,
                    abstract=r.snippet or "",
                    source_api="google_patents",
                )
            )
        return records

    @staticmethod
    def _extract_patent_id(url: str) -> str:
        # https://patents.google.com/patent/US12345678B2/en -> US12345678B2
        if "patents.google.com/patent/" not in url:
            return ""
        tail = url.split("patents.google.com/patent/", 1)[1]
        pid = tail.split("/", 1)[0]
        return pid.strip()


class PatentSearchTool:
    """Unified patent search — PatentsView primary, Google Patents fallback.

    Matches the WebSearchTool / AcademicSearchTool interface:
        tool = PatentSearchTool()
        results, summary = await tool.search("dendrite suppression lithium metal")
    """

    def __init__(self, max_results: int = 15):
        self.patentsview = PatentsViewSearch(max_results=max_results)
        self.fallback = GooglePatentsFallback()
        self.max_results = max_results
        self._search_count = 0

    async def search(self, query: str) -> tuple[list[SearchResult], str]:
        """Search the patent corpus and return SearchResult[] + a summary.

        Tries PatentsView first (authoritative USPTO data), falls back to
        Google Patents SERP when PatentsView returns nothing.
        """
        logger.info("Patent search: query=%s", query[:200])
        records = await self.patentsview._post(
            {
                "q": {
                    "_or": [
                        {"_text_any": {"patent_title": query}},
                        {"_text_any": {"patent_abstract": query}},
                    ]
                },
                "f": _PATENTSVIEW_FIELDS,
                "s": [{"patent_date": "desc"}],
                "o": {"size": min(self.max_results, 100)},
            }
        )

        if not records:
            logger.info("PatentsView returned nothing, falling back to Google Patents")
            records = await self.fallback.search(query, max_results=self.max_results)

        results = [r.to_search_result() for r in records][: self.max_results]
        summary = self._build_summary(query, records)
        self._search_count += 1
        return results, summary

    @staticmethod
    def _build_summary(query: str, records: list[PatentRecord]) -> str:
        if not records:
            return f"No patents found for query: {query}"

        lines = [f"Found {len(records)} patent(s) for: {query}"]
        for r in records[:5]:
            lines.append(
                f"- {r.patent_id}: {r.title[:120]}"
                + (f" ({r.assignee})" if r.assignee else "")
            )
        if len(records) > 5:
            lines.append(f"... and {len(records) - 5} more")
        return "\n".join(lines)
