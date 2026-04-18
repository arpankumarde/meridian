"""Standards search tool for Meridian intelligence audits.

Searches for engineering, scientific, and safety standards from IEEE, ISO,
ASTM, and NIST. v1 is metadata + abstract only — the full text of most
standards is paywalled and would require negotiating per-publisher
agreements, which is deferred per PRD §6 ("best-effort") and §11.2.

Approach: Bright Data SERP scraping against each standards organization's
public catalog pages (site:ieee.org, site:iso.org, etc.). The abstract and
publication metadata that appear on listing pages are usually enough for
the Manager to assess whether a standard is relevant, cite it in a report,
and flag it as "full text would be valuable here".

Interface mirrors WebSearchTool / AcademicSearchTool / PatentSearchTool so
the Intern agent can plug it in without any dispatch-layer changes.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

from ..logging_config import get_logger
from .web_search import SearchResult

logger = get_logger(__name__)


# v1 coverage — each entry is (body name, SERP site filter, canonical domain).
# Ordering matters: the first site with a hit wins for deduplication.
STANDARDS_BODIES: list[tuple[str, str, str]] = [
    ("IEEE", "site:ieeexplore.ieee.org", "ieeexplore.ieee.org"),
    ("ISO", "site:iso.org", "iso.org"),
    ("ASTM", "site:astm.org", "astm.org"),
    ("NIST", "site:nist.gov", "nist.gov"),
]


@dataclass
class StandardRecord:
    """Structured standards-body metadata.

    v1 doesn't try to parse the full text — the goal is to give the Manager
    enough to cite the standard and flag when full-text access is needed.
    """

    body: str  # IEEE | ISO | ASTM | NIST
    standard_id: str  # e.g. "IEEE 802.11", "ISO/IEC 27001:2022"
    title: str
    url: str
    abstract: str = ""
    publication_date: str = ""
    scope: str = ""
    designation: list[str] = field(default_factory=list)

    def to_search_result(self) -> SearchResult:
        snippet_parts: list[str] = []
        if self.abstract:
            snippet_parts.append(self.abstract[:300])
        if self.standard_id:
            snippet_parts.append(f"Standard: {self.standard_id}")
        if self.publication_date:
            snippet_parts.append(f"Published: {self.publication_date}")
        snippet_parts.append(f"Body: {self.body}")

        return SearchResult(
            title=self.title,
            url=self.url,
            snippet=" | ".join(snippet_parts),
            corpus="external",
        )


class StandardsSearchTool:
    """Unified standards search across IEEE / ISO / ASTM / NIST.

    Matches the WebSearchTool interface:
        tool = StandardsSearchTool()
        results, summary = await tool.search("wireless power transfer")

    Implementation: fans out a SERP query to each standards body in parallel
    via the underlying WebSearchTool (Bright Data) and normalizes the
    top-ranked results into StandardRecord objects. Per PRD §6 this is a
    best-effort slice — we're not parsing the full standards text, just the
    listing-page metadata.
    """

    def __init__(self, max_results: int = 12):
        self.max_results = max_results
        self._search_count = 0
        self._web: Any = None

    def _lazy_web(self):
        if self._web is None:
            from .web_search import WebSearchTool
            self._web = WebSearchTool(max_results=5)
        return self._web

    async def search(self, query: str) -> tuple[list[SearchResult], str]:
        """Search the standards corpus and return SearchResult[] + summary."""
        logger.info("Standards search: query=%s", query[:200])
        web = self._lazy_web()

        # Fan out: one SERP call per standards body in parallel.
        tasks = [
            self._search_body(web, body, site_filter, domain, query)
            for body, site_filter, domain in STANDARDS_BODIES
        ]
        bucket_results = await asyncio.gather(*tasks, return_exceptions=True)

        records: list[StandardRecord] = []
        for bucket in bucket_results:
            if isinstance(bucket, Exception):
                logger.warning("Standards sub-search failed: %s", bucket)
                continue
            records.extend(bucket)

        # Deduplicate by URL, keep body-order priority
        seen_urls: set[str] = set()
        unique: list[StandardRecord] = []
        for r in records:
            if r.url in seen_urls:
                continue
            seen_urls.add(r.url)
            unique.append(r)

        results = [r.to_search_result() for r in unique][: self.max_results]
        summary = self._build_summary(query, unique)
        self._search_count += 1
        return results, summary

    async def _search_body(
        self,
        web: Any,
        body: str,
        site_filter: str,
        domain: str,
        query: str,
    ) -> list[StandardRecord]:
        """Fetch results from a single standards body via SERP site filter."""
        try:
            results, _ = await web.search(f"{site_filter} {query}")
        except Exception as e:
            logger.warning("Standards search (%s) failed: %s", body, e)
            return []

        records: list[StandardRecord] = []
        for r in results[:3]:
            if domain not in r.url:
                continue
            records.append(
                StandardRecord(
                    body=body,
                    standard_id=self._extract_standard_id(body, r.title, r.url),
                    title=r.title or f"{body} standard",
                    url=r.url,
                    abstract=r.snippet or "",
                )
            )
        return records

    @staticmethod
    def _extract_standard_id(body: str, title: str, url: str) -> str:
        """Pull a standard identifier out of a listing page title when possible.

        IEEE titles typically start with "IEEE 802.11 - …", ISO with "ISO/IEC …".
        Falls back to a body prefix when nothing is extractable.
        """
        t = (title or "").strip()
        if body == "IEEE" and "IEEE" in t.upper():
            head = t.split(" - ")[0] if " - " in t else t.split(":")[0]
            return head.strip()[:60]
        if body == "ISO" and "ISO" in t.upper():
            head = t.split(" - ")[0] if " - " in t else t.split(":")[0]
            return head.strip()[:60]
        if body == "ASTM" and "ASTM" in t.upper():
            return t.split(" - ")[0].strip()[:60]
        if body == "NIST" and "NIST" in t.upper():
            return t.split(" - ")[0].strip()[:60]
        return f"{body} standard"

    @staticmethod
    def _build_summary(query: str, records: list[StandardRecord]) -> str:
        if not records:
            return f"No standards found for query: {query}"
        lines = [f"Found {len(records)} standard(s) for: {query}"]
        for r in records[:5]:
            lines.append(f"- [{r.body}] {r.standard_id}: {r.title[:120]}")
        if len(records) > 5:
            lines.append(f"... and {len(records) - 5} more")
        return "\n".join(lines)
