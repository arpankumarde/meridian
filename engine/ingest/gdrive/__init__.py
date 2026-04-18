"""Google Drive connector for the internal R&D corpus.

The four modules here decompose the connector into single responsibilities:
    - auth.py        — OAuth desktop flow + token persistence
    - sync.py        — incremental sync via Drive changes.list
    - extractors.py  — per-MIME-type text extraction
    - indexer.py     — chunk, embed, and write to Chroma with corpus=internal
    - models.py      — GDriveFile + SyncState dataclasses

Public entry points for the rest of the engine are exposed here.
"""

from .auth import GDriveAuth, get_drive_service
from .indexer import GDriveIndexer
from .models import GDriveFile, SyncState
from .sync import GDriveSync

__all__ = [
    "GDriveAuth",
    "GDriveFile",
    "GDriveIndexer",
    "GDriveSync",
    "SyncState",
    "get_drive_service",
]
