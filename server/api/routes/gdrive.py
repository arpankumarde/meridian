"""Google Drive connector API routes.

v1 is deliberately minimal — the OAuth flow itself is a desktop flow that
the user runs via ``meridian gdrive auth`` at the CLI (Google rejects
headless OAuth for desktop apps anyway). These endpoints expose:

    POST  /api/gdrive/sync     — kick off an incremental or full sync
    GET   /api/gdrive/status   — auth + sync state snapshot
    GET   /api/gdrive/search   — preview semantic search over the internal corpus
                                 (used by the new-check form's internal-doc picker)

Long-running syncs run in the background via FastAPI's BackgroundTasks so
the HTTP response returns immediately.
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field

from engine.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/gdrive", tags=["gdrive"])

# Single in-flight sync at a time — Drive quotas make concurrent syncs
# counter-productive and the sync state file is not thread-safe.
_sync_in_progress: bool = False
_sync_last_result: dict[str, Any] = {}


class SyncRequest(BaseModel):
    full: bool = Field(default=False, description="Force a full re-sync")
    max_files: int | None = Field(default=None, description="Safety cap on files processed")


class SearchResponse(BaseModel):
    query: str
    results: list[dict]


@router.get("/status")
async def gdrive_status():
    """Return the connector's current auth + sync state."""
    from engine.ingest.gdrive import GDriveAuth
    from engine.ingest.gdrive.models import SyncState
    from engine.ingest.gdrive.sync import SYNC_STATE_PATH

    auth = GDriveAuth()
    state = SyncState.load(SYNC_STATE_PATH)

    return {
        "authenticated": auth.has_token(),
        "has_client_config": auth.has_client_config(),
        "file_count": state.file_count,
        "last_sync_at": state.last_full_sync_at or None,
        "start_page_token": state.start_page_token or None,
        "last_error": state.last_error or None,
        "sync_in_progress": _sync_in_progress,
        "last_sync_result": _sync_last_result or None,
    }


@router.post("/sync")
async def gdrive_sync(request: SyncRequest, background_tasks: BackgroundTasks):
    """Kick off a sync run in the background. Returns immediately.

    Poll ``GET /api/gdrive/status`` for progress.
    """
    from engine.ingest.gdrive import GDriveAuth

    global _sync_in_progress
    if _sync_in_progress:
        raise HTTPException(
            status_code=409, detail="A Drive sync is already in progress.",
        )

    auth = GDriveAuth()
    if not auth.has_token():
        raise HTTPException(
            status_code=400,
            detail=(
                "Google Drive not authenticated. Run `meridian gdrive auth` "
                "at the CLI first (desktop OAuth flow requires a local browser)."
            ),
        )

    background_tasks.add_task(_run_sync, request.full, request.max_files)
    return {
        "status": "started",
        "full": request.full,
        "max_files": request.max_files,
    }


def _run_sync(full: bool, max_files: int | None) -> None:
    """Background task body — updates module state as it runs."""
    global _sync_in_progress, _sync_last_result
    _sync_in_progress = True
    try:
        from engine.ingest.gdrive import GDriveAuth, GDriveIndexer, GDriveSync

        auth = GDriveAuth()
        indexer = GDriveIndexer()
        sync = GDriveSync(indexer=indexer, auth=auth)

        if full:
            state = sync.full_sync(max_files=max_files)
        else:
            state = sync.incremental_sync()

        _sync_last_result = {
            "ok": True,
            "file_count": state.file_count,
            "last_sync_at": state.last_full_sync_at,
        }
        logger.info("gdrive background sync complete: %s", _sync_last_result)
    except Exception as exc:
        _sync_last_result = {"ok": False, "error": str(exc)}
        logger.error("gdrive background sync failed: %s", exc, exc_info=True)
    finally:
        _sync_in_progress = False


@router.get("/search", response_model=SearchResponse)
async def gdrive_search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(default=10, ge=1, le=50),
):
    """Semantic search over the internal corpus.

    Used by the frontend internal-doc picker (Phase 7.1). Returns an empty
    list if gdrive isn't configured — the caller should treat that as
    "internal corpus not available yet".
    """
    from engine.tools.gdrive_search import GDriveSearchTool

    tool = GDriveSearchTool(max_results=limit)

    # gdrive_search is async-safe (uses asyncio.to_thread internally)
    try:
        results, _summary = await tool.search(q)
    except Exception as exc:
        logger.warning("gdrive_search failed: %s", exc, exc_info=True)
        return SearchResponse(query=q, results=[])

    return SearchResponse(
        query=q,
        results=[
            {
                "title": r.title,
                "url": r.url,
                "snippet": r.snippet,
                "content": r.content,
                "corpus": r.corpus,
            }
            for r in results
        ],
    )
