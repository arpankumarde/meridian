"""Incremental Google Drive sync driver.

Two modes:
    - full sync (first run): walks the user's Drive via files.list and
      indexes every supported file.
    - incremental sync (subsequent runs): walks Drive's changes.list from
      the persisted startPageToken and only re-indexes what changed.

Both modes call into a GDriveIndexer for the per-file extract + embed +
write work, so this module stays focused on Drive API mechanics.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from ...logging_config import get_logger
from .auth import GDriveAuth, MERIDIAN_HOME
from .extractors import UnsupportedMimeType, extract_text
from .models import GDriveFile, SyncState

logger = get_logger(__name__)

SYNC_STATE_PATH = MERIDIAN_HOME / "gdrive_sync_state.json"

# Drive file resource fields we actually need. Keep the list minimal —
# every field we request costs quota.
_FILE_FIELDS = (
    "id,name,mimeType,modifiedTime,webViewLink,size,owners,parents,md5Checksum"
)
_LIST_FIELDS = f"nextPageToken,files({_FILE_FIELDS})"
_CHANGES_FIELDS = f"nextPageToken,newStartPageToken,changes(fileId,removed,file({_FILE_FIELDS}))"


class GDriveSync:
    """Drives full + incremental sync cycles against Google Drive.

    Typical usage:
        sync = GDriveSync(indexer=my_indexer)
        sync.full_sync()          # first run
        sync.incremental_sync()   # every subsequent run
    """

    def __init__(
        self,
        indexer: Any,  # GDriveIndexer — avoid a circular import
        auth: GDriveAuth | None = None,
        state_path: Path | None = None,
        progress_callback: Callable[[str], None] | None = None,
    ):
        self.indexer = indexer
        self.auth = auth or GDriveAuth()
        self.state_path = state_path or SYNC_STATE_PATH
        self.state = SyncState.load(self.state_path)
        self.progress = progress_callback or (lambda msg: None)
        self._service: Any = None

    @property
    def service(self):
        if self._service is None:
            self._service = self.auth.get_service()
        return self._service

    def full_sync(self, max_files: int | None = None) -> SyncState:
        """Walk every supported file in the user's Drive and index it.

        Args:
            max_files: Optional safety cap — useful for first-time sync
                against large drives to avoid blowing the quota.

        Returns updated SyncState (also persisted to disk).
        """
        logger.info("gdrive full sync starting")
        self.progress("Starting full Drive sync...")

        page_token: str | None = None
        indexed = 0
        skipped = 0

        while True:
            try:
                response = (
                    self.service.files()
                    .list(
                        q="trashed=false",
                        spaces="drive",
                        fields=_LIST_FIELDS,
                        pageSize=100,
                        pageToken=page_token,
                        orderBy="modifiedTime desc",
                    )
                    .execute()
                )
            except Exception as exc:
                logger.error("gdrive list failed: %s", exc, exc_info=True)
                self.state.last_error = str(exc)
                self.state.save(self.state_path)
                raise

            for raw in response.get("files", []):
                file = GDriveFile.from_drive_api(raw)
                if not file.is_supported:
                    skipped += 1
                    continue

                ok = self._index_one(file)
                if ok:
                    indexed += 1
                    self.progress(f"Indexed {indexed}: {file.name[:60]}")
                else:
                    skipped += 1

                if max_files is not None and indexed >= max_files:
                    logger.info("gdrive full sync: hit max_files=%d cap", max_files)
                    break

            page_token = response.get("nextPageToken")
            if not page_token:
                break
            if max_files is not None and indexed >= max_files:
                break

        # Capture a fresh startPageToken for future incremental syncs.
        try:
            token_resp = self.service.changes().getStartPageToken().execute()
            new_token = token_resp.get("startPageToken", "")
        except Exception as exc:
            logger.warning("failed to fetch startPageToken: %s", exc)
            new_token = self.state.start_page_token

        self.state.mark_synced(new_token, self.state.file_count + indexed)
        self.state.save(self.state_path)
        logger.info("gdrive full sync done: indexed=%d skipped=%d", indexed, skipped)
        self.progress(f"Full sync complete: {indexed} indexed, {skipped} skipped")
        return self.state

    def incremental_sync(self) -> SyncState:
        """Pull only what changed since the last sync via Drive changes.list.

        Falls back to a full sync if we have no startPageToken yet.
        """
        if not self.state.start_page_token:
            logger.info("gdrive incremental sync: no startPageToken, running full sync")
            return self.full_sync()

        logger.info("gdrive incremental sync starting")
        self.progress("Starting incremental Drive sync...")

        page_token: str | None = self.state.start_page_token
        indexed = 0
        removed = 0
        new_start_token = page_token

        while page_token:
            try:
                response = (
                    self.service.changes()
                    .list(
                        pageToken=page_token,
                        fields=_CHANGES_FIELDS,
                        pageSize=100,
                        includeRemoved=True,
                        spaces="drive",
                    )
                    .execute()
                )
            except Exception as exc:
                logger.error("gdrive changes.list failed: %s", exc, exc_info=True)
                self.state.last_error = str(exc)
                self.state.save(self.state_path)
                raise

            for change in response.get("changes", []):
                file_id = change.get("fileId")
                if change.get("removed"):
                    self.indexer.remove_file(file_id)
                    removed += 1
                    continue
                raw = change.get("file")
                if not raw:
                    continue
                file = GDriveFile.from_drive_api(raw)
                if not file.is_supported:
                    continue
                if self._index_one(file):
                    indexed += 1
                    self.progress(f"Updated {indexed}: {file.name[:60]}")

            page_token = response.get("nextPageToken")
            new_start_token = response.get("newStartPageToken") or new_start_token

        self.state.mark_synced(new_start_token, self.state.file_count + indexed - removed)
        self.state.save(self.state_path)
        logger.info(
            "gdrive incremental sync done: indexed=%d removed=%d", indexed, removed,
        )
        self.progress(f"Incremental sync complete: {indexed} updated, {removed} removed")
        return self.state

    def _index_one(self, file: GDriveFile) -> bool:
        """Extract text and hand to the indexer. Returns True on success."""
        try:
            text = extract_text(self.service, file)
        except UnsupportedMimeType:
            return False
        except Exception as exc:
            logger.warning(
                "gdrive extract failed: file=%s err=%s", file.file_id, exc, exc_info=True,
            )
            return False

        if not text.strip():
            logger.debug("gdrive skip empty file: %s", file.file_id)
            return False

        try:
            self.indexer.index_document(file, text)
            return True
        except Exception as exc:
            logger.warning(
                "gdrive indexing failed: file=%s err=%s", file.file_id, exc, exc_info=True,
            )
            return False
