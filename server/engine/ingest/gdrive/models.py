"""Data models for the Google Drive connector."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path


@dataclass
class GDriveFile:
    """A Google Drive file pulled for indexing.

    Only the fields Meridian actually uses are modeled here. The full Drive
    file resource has ~30 fields; most are not relevant to research.
    """

    file_id: str
    name: str
    mime_type: str
    modified_time: str  # ISO 8601
    web_view_link: str = ""
    size_bytes: int | None = None
    owners: list[str] = field(default_factory=list)
    parents: list[str] = field(default_factory=list)
    md5_checksum: str = ""

    @property
    def is_supported(self) -> bool:
        """Whether v1 can extract text from this file type."""
        return self.mime_type in _SUPPORTED_MIME_TYPES

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_drive_api(cls, data: dict) -> "GDriveFile":
        """Build from the JSON shape returned by the Drive API."""
        owners = []
        for o in data.get("owners") or []:
            if isinstance(o, dict):
                who = o.get("displayName") or o.get("emailAddress") or ""
                if who:
                    owners.append(who)
        return cls(
            file_id=data["id"],
            name=data.get("name", ""),
            mime_type=data.get("mimeType", ""),
            modified_time=data.get("modifiedTime", ""),
            web_view_link=data.get("webViewLink", ""),
            size_bytes=int(data["size"]) if data.get("size") else None,
            owners=owners,
            parents=list(data.get("parents") or []),
            md5_checksum=data.get("md5Checksum", ""),
        )


# v1 supported MIME types. Everything else is skipped. Adding a new type is
# a two-line change here + an extractor in extractors.py.
_SUPPORTED_MIME_TYPES: frozenset[str] = frozenset({
    "application/vnd.google-apps.document",  # Google Docs
    "application/vnd.google-apps.presentation",  # Google Slides
    "application/pdf",
    "text/plain",
    "text/markdown",
})


@dataclass
class SyncState:
    """Persistent state for incremental Drive sync.

    Holds:
        - start_page_token: the cursor returned by Drive changes.getStartPageToken,
          advanced after every sync run so repeat runs only fetch deltas.
        - last_full_sync_at: wall-clock timestamp of the last full sync run.
        - file_count: how many files are currently indexed.
    """

    start_page_token: str = ""
    last_full_sync_at: str = ""
    file_count: int = 0
    last_error: str = ""

    @classmethod
    def load(cls, path: Path) -> "SyncState":
        if not path.exists():
            return cls()
        try:
            data = json.loads(path.read_text())
            return cls(**data)
        except Exception:
            return cls()

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(asdict(self), indent=2))

    def mark_synced(self, new_token: str, file_count: int) -> None:
        self.start_page_token = new_token
        self.last_full_sync_at = datetime.utcnow().isoformat() + "Z"
        self.file_count = file_count
        self.last_error = ""
