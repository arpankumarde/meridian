"""Google Drive indexer — chunks, embeds, and writes to the shared vector store.

Reuses Meridian's existing retrieval stack:
    - engine.retrieval.embeddings.EmbeddingService (BGE)
    - engine.retrieval.vectorstore.VectorStore     (ChromaDB)

Each chunk is stored with metadata:
    - corpus="internal"        — drives cross-corpus KG edge detection
    - file_id, file_name       — so the GDriveSearchTool can return
                                   human-readable SearchResult rows
    - chunk_index, n_chunks    — for reconstruction
    - mime_type, modified_time — for ranking / staleness checks
    - web_view_link            — so the Manager can cite the source

The chunker is character-based with sentence-boundary preference. We don't
need the full sophistication of the retrieval pipeline's reranker — the
semantic search will re-score at query time.
"""

from __future__ import annotations

from typing import Any

from ...logging_config import get_logger
from .models import GDriveFile

logger = get_logger(__name__)

# Chunking parameters — match the PRD defaults (800 tokens, 100 overlap).
# Tokens are approximated as 4 characters each for BGE's tokenizer.
_CHARS_PER_TOKEN = 4
_CHUNK_CHARS = 800 * _CHARS_PER_TOKEN   # ~3200 chars
_OVERLAP_CHARS = 100 * _CHARS_PER_TOKEN  # ~400 chars

# Internal-corpus collection name in the shared Chroma store.
INTERNAL_COLLECTION = "meridian_internal_corpus"


class GDriveIndexer:
    """Writes Google Drive files as internal-corpus chunks into the vector store.

    The vector store / embedding service are injected rather than imported
    eagerly — this keeps the ingest module importable in environments where
    the heavy ML deps (sentence-transformers, chromadb) aren't installed.
    """

    def __init__(
        self,
        vector_store: Any = None,
        embedding_service: Any = None,
        collection_name: str = INTERNAL_COLLECTION,
    ):
        self.vector_store = vector_store
        self.embedding_service = embedding_service
        self.collection_name = collection_name
        self._indexed_file_ids: set[str] = set()

    def _lazy_init(self) -> None:
        """Instantiate the embedding service and vector store on first use.

        Deferred so a failed ML import doesn't crash the whole engine at
        startup — only users who actually run `meridian gdrive sync` pay.
        """
        if self.embedding_service is None:
            from ...retrieval.embeddings import EmbeddingService

            self.embedding_service = EmbeddingService()
        if self.vector_store is None:
            from ...retrieval.vectorstore import VectorStore, VectorStoreConfig

            config = VectorStoreConfig(collection_name=self.collection_name)
            self.vector_store = VectorStore(
                embedding_service=self.embedding_service,
                config=config,
            )

    def index_document(self, file: GDriveFile, text: str) -> int:
        """Chunk + embed + upsert a single document. Returns chunk count."""
        self._lazy_init()

        from ...retrieval.vectorstore import Document

        chunks = list(_chunk_text(text))
        if not chunks:
            logger.debug("gdrive indexer: no chunks for %s", file.file_id)
            return 0

        logger.info(
            "gdrive indexer: file=%s name=%s chunks=%d",
            file.file_id, file.name, len(chunks),
        )

        docs: list[Document] = []
        for i, chunk in enumerate(chunks):
            docs.append(
                Document(
                    id=f"gdrive::{file.file_id}::{i}",
                    content=chunk,
                    metadata={
                        "corpus": "internal",
                        "source": "gdrive",
                        "file_id": file.file_id,
                        "file_name": file.name,
                        "mime_type": file.mime_type,
                        "modified_time": file.modified_time,
                        "web_view_link": file.web_view_link or "",
                        "chunk_index": i,
                        "n_chunks": len(chunks),
                    },
                )
            )

        # Idempotent upsert: delete any existing chunks for this file_id
        # first so re-indexing unchanged files doesn't produce duplicates.
        try:
            self.vector_store.delete_by_filter({"file_id": file.file_id})
        except Exception:
            # delete_by_filter is best-effort — empty selections are fine
            pass

        self.vector_store.add(docs)
        self._indexed_file_ids.add(file.file_id)
        return len(chunks)

    def remove_file(self, file_id: str) -> int:
        """Delete every chunk belonging to a file (for incremental removals).

        Returns 1 on success, 0 on failure. Precise chunk counts aren't
        available from the underlying vector store.
        """
        self._lazy_init()
        try:
            self.vector_store.delete_by_filter({"file_id": file_id})
        except Exception as exc:
            logger.warning("gdrive indexer: remove_file %s failed: %s", file_id, exc)
            return 0
        self._indexed_file_ids.discard(file_id)
        return 1


def _chunk_text(text: str):
    """Sliding-window character chunker with sentence-boundary preference.

    Yields chunks roughly ``_CHUNK_CHARS`` long with ``_OVERLAP_CHARS`` of
    overlap between consecutive chunks. When a sentence boundary (``. ``,
    ``\\n\\n``, ``\\f``) falls near the end of a window, the split snaps to
    that boundary so chunks don't cut mid-sentence.
    """
    if not text:
        return

    cleaned = text.strip()
    n = len(cleaned)
    if n <= _CHUNK_CHARS:
        yield cleaned
        return

    start = 0
    while start < n:
        end = min(start + _CHUNK_CHARS, n)
        if end < n:
            # Try to snap to a sentence boundary in the last 20% of the window.
            window_start = max(start + int(_CHUNK_CHARS * 0.8), start + 1)
            for marker in ("\n\n", ".\n", ". ", "\f"):
                idx = cleaned.rfind(marker, window_start, end)
                if idx != -1:
                    end = idx + len(marker)
                    break

        chunk = cleaned[start:end].strip()
        if chunk:
            yield chunk

        if end >= n:
            break
        start = max(end - _OVERLAP_CHARS, start + 1)
