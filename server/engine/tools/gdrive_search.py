"""Google Drive search tool — queries the indexed internal corpus.

This is the Intern's plugin for the internal corpus. It runs semantic
search against Meridian's shared ChromaDB vector store, filtered to
`corpus="internal"` so it only returns chunks that came in via the
GDrive connector (not the external-corpus chunks the retrieval system
uses for general evidence).

Each returned `SearchResult` carries `corpus="internal"` so the
`InternAgent._process_search_results` path writes `Evidence.corpus="internal"`
automatically (see Phase 4.0), which then propagates to KG nodes for
cross-corpus edge detection.

Interface mirrors WebSearchTool / AcademicSearchTool / PatentSearchTool /
StandardsSearchTool / RegulatorySearchTool.
"""

from __future__ import annotations

import asyncio
from typing import Any

from ..ingest.gdrive.indexer import INTERNAL_COLLECTION
from ..logging_config import get_logger
from .web_search import SearchResult

logger = get_logger(__name__)


class GDriveSearchTool:
    """Semantic search over the indexed internal Google Drive corpus.

    Matches the WebSearchTool interface:
        tool = GDriveSearchTool()
        results, summary = await tool.search("our results on X")
    """

    def __init__(self, max_results: int = 8, collection_name: str = INTERNAL_COLLECTION):
        self.max_results = max_results
        self.collection_name = collection_name
        self._vector_store: Any = None
        self._embedding_service: Any = None
        self._search_count = 0
        self._unavailable = False
        self._unavailable_reason = ""

    def _is_gdrive_configured(self) -> bool:
        """Cheap fast-path check: has the user ever synced Google Drive?

        If ``~/.meridian/gdrive_sync_state.json`` doesn't exist the user
        hasn't run ``meridian gdrive sync``, so there's nothing to search
        and we don't need to pay the ~3-second cost of loading the BGE
        embedding model.
        """
        from ..ingest.gdrive.auth import TOKEN_PATH
        from ..ingest.gdrive.sync import SYNC_STATE_PATH

        return TOKEN_PATH.exists() and SYNC_STATE_PATH.exists()

    def _lazy_init(self) -> bool:
        """Initialize vector store on first use. Returns True on success.

        Three fast-exit paths:
            1. Previously marked unavailable
            2. gdrive not configured (no token / no sync state)
            3. Retrieval deps missing

        Only once all three gates pass do we actually load the embedding
        model and open the Chroma collection.
        """
        if self._unavailable:
            return False
        if self._vector_store is not None:
            return True

        if not self._is_gdrive_configured():
            self._unavailable = True
            self._unavailable_reason = (
                "Google Drive not configured. Run `meridian gdrive auth` and "
                "`meridian gdrive sync` to enable internal corpus search."
            )
            logger.info("gdrive_search skipped: %s", self._unavailable_reason)
            return False

        try:
            from ..retrieval.embeddings import EmbeddingService
            from ..retrieval.vectorstore import VectorStore, VectorStoreConfig
        except ImportError as exc:
            self._unavailable = True
            self._unavailable_reason = f"retrieval deps not installed: {exc}"
            logger.warning("gdrive_search unavailable: %s", exc)
            return False

        try:
            self._embedding_service = EmbeddingService()
            config = VectorStoreConfig(collection_name=self.collection_name)
            self._vector_store = VectorStore(
                embedding_service=self._embedding_service,
                config=config,
            )
        except Exception as exc:
            self._unavailable = True
            self._unavailable_reason = f"vector store init failed: {exc}"
            logger.warning("gdrive_search init failed: %s", exc, exc_info=True)
            return False

        return True

    async def search(self, query: str) -> tuple[list[SearchResult], str]:
        """Search the internal corpus and return SearchResult[] + summary.

        If the collection doesn't exist yet (user hasn't run `meridian gdrive
        sync`) or the retrieval stack isn't installed, returns an empty list
        and a descriptive summary. The Intern treats this as "no internal
        evidence available" and falls back to its other tools.
        """
        if not self._lazy_init():
            return [], (
                "Internal corpus search unavailable: "
                f"{self._unavailable_reason}"
            )

        # VectorStore.search is synchronous — run it in a thread so we don't
        # block the async intern pool.
        try:
            matches = await asyncio.to_thread(
                self._vector_store.search,
                query,
                self.max_results,
                {"corpus": "internal"},  # Chroma metadata filter
            )
        except Exception as exc:
            logger.warning("gdrive_search query failed: %s", exc, exc_info=True)
            return [], f"Internal corpus search error: {exc}"

        if not matches:
            return [], f"No internal corpus results for: {query}"

        results: list[SearchResult] = []
        for doc, score in matches:
            meta = doc.metadata or {}
            url = meta.get("web_view_link") or f"gdrive://{meta.get('file_id', doc.id)}"
            file_name = meta.get("file_name") or "Internal document"
            chunk_index = meta.get("chunk_index", 0)
            n_chunks = meta.get("n_chunks", 1)

            title = file_name
            if n_chunks and n_chunks > 1:
                title = f"{file_name} (chunk {chunk_index + 1}/{n_chunks})"

            snippet_parts = [doc.content[:400]]
            modified = meta.get("modified_time")
            if modified:
                snippet_parts.append(f"Modified: {modified}")
            snippet_parts.append(f"Relevance: {score:.2f}")

            results.append(
                SearchResult(
                    title=title,
                    url=url,
                    snippet=" | ".join(snippet_parts),
                    content=doc.content,
                    engine="gdrive",
                    corpus="internal",
                )
            )

        self._search_count += 1
        summary = self._build_summary(query, results)
        return results, summary

    @staticmethod
    def _build_summary(query: str, results: list[SearchResult]) -> str:
        if not results:
            return f"No internal corpus matches for: {query}"
        lines = [f"Found {len(results)} internal corpus match(es) for: {query}"]
        for r in results[:5]:
            lines.append(f"- {r.title[:120]}")
        if len(results) > 5:
            lines.append(f"... and {len(results) - 5} more")
        return "\n".join(lines)
