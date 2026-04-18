"""Regulatory search tool for Meridian intelligence audits.

Searches free regulatory APIs for filings, guidance, and authorization
records from three bodies:

    - SEC EDGAR  — US public company filings (10-K, 10-Q, 8-K, S-1, etc.)
    - openFDA    — FDA drug, device, recall, enforcement, and adverse-event records
    - EMA        — European Medicines Agency public authorization records

All three are free and well-documented. EMA doesn't have a stable JSON
search API (their public interface is HTML-only), so v1 reaches EMA via
a SERP site filter through the existing WebSearchTool. SEC EDGAR and
openFDA use their native REST APIs.

Interface mirrors WebSearchTool / AcademicSearchTool / PatentSearchTool.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote

import httpx

from ..logging_config import get_logger
from .web_search import SearchResult

logger = get_logger(__name__)


# SEC EDGAR — full-text search. Requires a User-Agent with a contact email.
# Docs: https://efts.sec.gov/LATEST/search-index
_EDGAR_SEARCH_URL = "https://efts.sec.gov/LATEST/search-index"
_EDGAR_FILING_URL = "https://www.sec.gov/Archives/edgar/data"
_EDGAR_USER_AGENT = "Meridian Research Bot contact@meridian.local"

# openFDA — drug, device, food, enforcement endpoints.
# Docs: https://open.fda.gov/apis/
_OPENFDA_BASE = "https://api.fda.gov"
_OPENFDA_ENDPOINTS = [
    ("drug_label", "/drug/label.json"),
    ("drug_event", "/drug/event.json"),
    ("device_recall", "/device/recall.json"),
    ("drug_enforcement", "/drug/enforcement.json"),
]


@dataclass
class RegulatoryRecord:
    """Structured regulatory filing / guidance metadata."""

    body: str  # SEC | FDA | EMA
    doc_type: str  # 10-K | drug_label | enforcement | ...
    identifier: str  # CIK / accession / application number / EMA ID
    title: str
    url: str
    summary: str = ""
    filing_date: str = ""
    applicant: str = ""  # filer / sponsor / marketing authorization holder
    jurisdiction: str = ""  # US | EU | global
    extras: dict = field(default_factory=dict)

    def to_search_result(self) -> SearchResult:
        snippet_parts: list[str] = []
        if self.summary:
            snippet_parts.append(self.summary[:300])
        if self.applicant:
            snippet_parts.append(f"Filer: {self.applicant}")
        if self.filing_date:
            snippet_parts.append(f"Date: {self.filing_date}")
        if self.doc_type:
            snippet_parts.append(f"Type: {self.doc_type}")
        snippet_parts.append(f"Body: {self.body}")

        return SearchResult(
            title=self.title,
            url=self.url,
            snippet=" | ".join(snippet_parts),
            corpus="external",
        )


class EdgarSearch:
    """SEC EDGAR full-text search via the efts.sec.gov endpoint."""

    def __init__(self, max_results: int = 10):
        self.max_results = max_results

    async def search(self, query: str) -> list[RegulatoryRecord]:
        params = {
            "q": f'"{query}"',
            "dateRange": "custom",
            "startdt": "2020-01-01",
            "enddt": "2030-12-31",
            "forms": "10-K,10-Q,8-K,S-1,20-F,DEF 14A",
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    _EDGAR_SEARCH_URL,
                    params=params,
                    headers={"User-Agent": _EDGAR_USER_AGENT},
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.warning("EDGAR search failed: %s", exc, exc_info=True)
            return []

        hits = (data.get("hits") or {}).get("hits") or []
        records: list[RegulatoryRecord] = []
        for h in hits[: self.max_results]:
            source = h.get("_source") or {}
            accession = (h.get("_id") or "").split(":")[0]
            form = source.get("form", "filing")
            display_names = source.get("display_names") or []
            applicant = display_names[0] if display_names else ""
            filing_date = source.get("file_date", "")
            adsh = source.get("adsh", accession)
            cik = ""
            ciks = source.get("ciks") or []
            if ciks:
                cik = str(ciks[0]).lstrip("0") or "0"
            url = (
                f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}"
                if cik
                else f"https://efts.sec.gov/LATEST/search-index?q={quote(query)}"
            )
            records.append(
                RegulatoryRecord(
                    body="SEC",
                    doc_type=form,
                    identifier=adsh,
                    title=f"{applicant or 'Filer'} — {form}",
                    url=url,
                    summary=(source.get("file_type") or form),
                    filing_date=filing_date,
                    applicant=applicant,
                    jurisdiction="US",
                    extras={"cik": cik, "accession": adsh},
                )
            )
        return records


class OpenFDASearch:
    """openFDA REST search across drug, device, and enforcement endpoints."""

    def __init__(self, max_results: int = 10):
        self.max_results = max_results

    async def search(self, query: str) -> list[RegulatoryRecord]:
        # openFDA accepts a field-searchable query; for a broad free-text
        # query we just pass it through as a `search` param. It's permissive
        # about unmatched fields — the API returns empty results rather than
        # 400 when the query doesn't match its schema.
        per_endpoint = max(1, self.max_results // len(_OPENFDA_ENDPOINTS))
        tasks = [
            self._hit_endpoint(doc_type, path, query, per_endpoint)
            for doc_type, path in _OPENFDA_ENDPOINTS
        ]
        bucketed = await asyncio.gather(*tasks, return_exceptions=True)
        records: list[RegulatoryRecord] = []
        for bucket in bucketed:
            if isinstance(bucket, Exception):
                logger.warning("openFDA sub-search failed: %s", bucket)
                continue
            records.extend(bucket)
        return records[: self.max_results]

    async def _hit_endpoint(
        self, doc_type: str, path: str, query: str, limit: int
    ) -> list[RegulatoryRecord]:
        url = f"{_OPENFDA_BASE}{path}"
        params = {"search": query, "limit": str(limit)}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 404:
                    return []  # openFDA returns 404 for zero hits
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.debug("openFDA %s failed: %s", doc_type, exc)
            return []

        results = data.get("results") or []
        records: list[RegulatoryRecord] = []
        for item in results:
            record = self._parse_item(doc_type, item)
            if record:
                records.append(record)
        return records

    def _parse_item(self, doc_type: str, item: dict) -> RegulatoryRecord | None:
        if not isinstance(item, dict):
            return None

        brand = ""
        applicant = ""
        summary = ""
        identifier = ""
        filing_date = ""

        if doc_type == "drug_label":
            openfda = item.get("openfda") or {}
            brand_list = openfda.get("brand_name") or []
            brand = brand_list[0] if brand_list else ""
            manufacturer = openfda.get("manufacturer_name") or []
            applicant = manufacturer[0] if manufacturer else ""
            indications = item.get("indications_and_usage") or []
            summary = (indications[0] if indications else "")[:300]
            identifier = (item.get("id") or item.get("set_id") or "")[:30]
        elif doc_type == "drug_event":
            patient = item.get("patient") or {}
            drugs = patient.get("drug") or []
            if drugs:
                brand = drugs[0].get("medicinalproduct", "") or ""
            summary = item.get("primarysource", {}).get("qualification", "") or ""
            identifier = item.get("safetyreportid", "")[:30]
            filing_date = item.get("receivedate", "")
        elif doc_type == "device_recall":
            brand = item.get("product_description", "") or ""
            applicant = item.get("recalling_firm", "") or ""
            summary = item.get("reason_for_recall", "") or ""
            identifier = item.get("res_event_number", "")[:30]
            filing_date = item.get("event_date_initiated", "")
        elif doc_type == "drug_enforcement":
            brand = item.get("product_description", "") or ""
            applicant = item.get("recalling_firm", "") or ""
            summary = item.get("reason_for_recall", "") or ""
            identifier = item.get("recall_number", "")[:30]
            filing_date = item.get("recall_initiation_date", "")

        if not (brand or summary):
            return None

        return RegulatoryRecord(
            body="FDA",
            doc_type=doc_type,
            identifier=identifier,
            title=brand or f"FDA {doc_type} record",
            url=f"https://open.fda.gov/apis/{doc_type}/",
            summary=summary,
            filing_date=filing_date,
            applicant=applicant,
            jurisdiction="US",
            extras={},
        )


class EmaSerpSearch:
    """EMA doesn't expose a stable JSON search API — fall back to SERP."""

    def __init__(self, max_results: int = 8):
        self.max_results = max_results
        self._web: Any = None

    def _lazy_web(self):
        if self._web is None:
            from .web_search import WebSearchTool
            self._web = WebSearchTool(max_results=5)
        return self._web

    async def search(self, query: str) -> list[RegulatoryRecord]:
        web = self._lazy_web()
        try:
            results, _ = await web.search(f"site:ema.europa.eu {query}")
        except Exception as exc:
            logger.warning("EMA SERP search failed: %s", exc, exc_info=True)
            return []

        records: list[RegulatoryRecord] = []
        for r in results[: self.max_results]:
            if "ema.europa.eu" not in r.url:
                continue
            records.append(
                RegulatoryRecord(
                    body="EMA",
                    doc_type="ema_document",
                    identifier=r.url.split("/")[-1][:60],
                    title=r.title or "EMA document",
                    url=r.url,
                    summary=r.snippet or "",
                    jurisdiction="EU",
                )
            )
        return records


class RegulatorySearchTool:
    """Unified regulatory search — SEC EDGAR + openFDA + EMA.

    Matches the WebSearchTool interface:
        tool = RegulatorySearchTool()
        results, summary = await tool.search("GLP-1 receptor agonist")

    All three bodies are queried in parallel via asyncio.gather. Results are
    concatenated, deduplicated by URL, and returned as SearchResult[] with
    corpus="external".
    """

    def __init__(self, max_results: int = 12):
        self.edgar = EdgarSearch(max_results=max_results // 3 or 3)
        self.openfda = OpenFDASearch(max_results=max_results // 3 or 3)
        self.ema = EmaSerpSearch(max_results=max_results // 3 or 3)
        self.max_results = max_results
        self._search_count = 0

    async def search(self, query: str) -> tuple[list[SearchResult], str]:
        logger.info("Regulatory search: query=%s", query[:200])

        results_lists = await asyncio.gather(
            self.edgar.search(query),
            self.openfda.search(query),
            self.ema.search(query),
            return_exceptions=True,
        )

        all_records: list[RegulatoryRecord] = []
        for bucket in results_lists:
            if isinstance(bucket, Exception):
                logger.warning("Regulatory sub-search failed: %s", bucket)
                continue
            all_records.extend(bucket)

        # Deduplicate by URL
        seen: set[str] = set()
        unique: list[RegulatoryRecord] = []
        for r in all_records:
            if r.url in seen:
                continue
            seen.add(r.url)
            unique.append(r)

        results = [r.to_search_result() for r in unique][: self.max_results]
        summary = self._build_summary(query, unique)
        self._search_count += 1
        return results, summary

    @staticmethod
    def _build_summary(query: str, records: list[RegulatoryRecord]) -> str:
        if not records:
            return f"No regulatory filings found for query: {query}"
        by_body: dict[str, int] = {}
        for r in records:
            by_body[r.body] = by_body.get(r.body, 0) + 1

        lines = [
            f"Found {len(records)} regulatory record(s) for: {query}",
            "By body: " + ", ".join(f"{b}={n}" for b, n in sorted(by_body.items())),
        ]
        for r in records[:5]:
            lines.append(
                f"- [{r.body}/{r.doc_type}] {r.title[:120]}"
                + (f" ({r.applicant})" if r.applicant else "")
            )
        if len(records) > 5:
            lines.append(f"... and {len(records) - 5} more")
        return "\n".join(lines)
