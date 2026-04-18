"""File-type-aware text extractors for the Google Drive connector.

v1 handles:
    - Google Docs (application/vnd.google-apps.document) — export as text/plain
    - Google Slides (application/vnd.google-apps.presentation) — export as text/plain
    - PDFs (application/pdf) — extract via pdfplumber
    - Plain text and markdown — pass-through

Unsupported types raise ``UnsupportedMimeType`` so the caller can skip them
with a log line rather than crashing the sync.
"""

from __future__ import annotations

import io
from typing import Any

from ...logging_config import get_logger
from .models import GDriveFile

logger = get_logger(__name__)


class UnsupportedMimeType(Exception):
    """Raised when we don't have an extractor for a given MIME type."""


# Google native MIME types that we export via files.export
_GOOGLE_DOC_TYPES = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.presentation": "text/plain",
}

# Binary MIME types we download via files.get(media)
_BINARY_DOWNLOAD_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
}


def extract_text(service: Any, file: GDriveFile) -> str:
    """Extract plain text from a Drive file.

    `service` is a Drive v3 API service client (from auth.get_service()).
    Returns the extracted text as a single string (possibly with \\n
    separators between pages/slides). Empty string is a legal return for
    truly empty files — the caller decides whether to skip them.
    """
    if file.mime_type in _GOOGLE_DOC_TYPES:
        return _export_google_doc(service, file)

    if file.mime_type in _BINARY_DOWNLOAD_TYPES:
        raw = _download_binary(service, file)
        return _decode_binary(file, raw)

    raise UnsupportedMimeType(
        f"No extractor for mimeType={file.mime_type} (file={file.file_id})"
    )


def _export_google_doc(service: Any, file: GDriveFile) -> str:
    """Export a Google Doc / Slides file as text/plain."""
    target_mime = _GOOGLE_DOC_TYPES[file.mime_type]
    logger.debug("gdrive export: file=%s mime=%s", file.file_id, target_mime)
    request = service.files().export_media(
        fileId=file.file_id, mimeType=target_mime,
    )
    return _run_download(request).decode("utf-8", errors="replace")


def _download_binary(service: Any, file: GDriveFile) -> bytes:
    """Download a binary file (PDF, plain text) as raw bytes."""
    logger.debug("gdrive download: file=%s mime=%s", file.file_id, file.mime_type)
    request = service.files().get_media(fileId=file.file_id)
    return _run_download(request)


def _run_download(request: Any) -> bytes:
    """Run a Drive API download request to completion.

    google-api-python-client wants a file-like object to stream into;
    we use an in-memory BytesIO and return the buffer contents.
    """
    from googleapiclient.http import MediaIoBaseDownload

    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _status, done = downloader.next_chunk()
    return buffer.getvalue()


def _decode_binary(file: GDriveFile, raw: bytes) -> str:
    """Turn downloaded bytes into extracted text.

    PDFs go through pdfplumber; text/plain and text/markdown are decoded
    directly as UTF-8 with replacement for malformed bytes.
    """
    if file.mime_type == "application/pdf":
        return _extract_pdf_text(raw)

    return raw.decode("utf-8", errors="replace")


def _extract_pdf_text(raw: bytes) -> str:
    """Extract text from a PDF using pdfplumber.

    Returns concatenated page text separated by form-feed characters so
    downstream chunkers can split on page boundaries if they want to.
    """
    try:
        import pdfplumber
    except ImportError:
        logger.warning("pdfplumber not installed — cannot extract PDF text")
        return ""

    pages: list[str] = []
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        for page in pdf.pages:
            try:
                text = page.extract_text() or ""
            except Exception as exc:
                logger.debug("pdfplumber page extract failed: %s", exc)
                text = ""
            pages.append(text)
    return "\f".join(pages)
