"""Google Drive OAuth 2.0 desktop flow + token persistence.

v1 assumes single-user local operation — the token lives under
``~/.meridian/gdrive_token.json``. Multi-user / SSO is deferred per PRD §10.

Client credentials come from the user-supplied ``~/.meridian/gdrive_client.json``
file (downloaded from Google Cloud Console → OAuth client ID → Desktop app).
We don't ship default client credentials because that would violate Google's
terms of service.

Usage:
    auth = GDriveAuth()
    service = auth.get_service()
    files = service.files().list(pageSize=10).execute()
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ...logging_config import get_logger

logger = get_logger(__name__)

# Read-only scope — Meridian never writes to the user's Drive in v1.
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

# Standard Meridian state directory
MERIDIAN_HOME = Path.home() / ".meridian"
CLIENT_CONFIG_PATH = MERIDIAN_HOME / "gdrive_client.json"
TOKEN_PATH = MERIDIAN_HOME / "gdrive_token.json"


class GDriveAuth:
    """OAuth desktop flow wrapper.

    Lazy-imports google-auth packages so the rest of Meridian doesn't pay
    the import cost unless the user actually runs ``meridian gdrive auth``.
    """

    def __init__(
        self,
        client_config_path: Path | None = None,
        token_path: Path | None = None,
    ):
        self.client_config_path = client_config_path or CLIENT_CONFIG_PATH
        self.token_path = token_path or TOKEN_PATH
        self._credentials: Any = None

    def has_token(self) -> bool:
        return self.token_path.exists()

    def has_client_config(self) -> bool:
        return self.client_config_path.exists()

    def load_credentials(self):
        """Load cached credentials, refreshing when expired.

        Returns a ``google.oauth2.credentials.Credentials`` object or None
        if no valid token is available.
        """
        if self._credentials and self._credentials.valid:
            return self._credentials

        if not self.token_path.exists():
            return None

        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials

        creds = Credentials.from_authorized_user_file(
            str(self.token_path), SCOPES,
        )
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                self._persist_token(creds)
            except Exception as exc:
                logger.warning("gdrive token refresh failed: %s", exc, exc_info=True)
                return None

        self._credentials = creds
        return creds

    def run_oauth_flow(self) -> bool:
        """Kick off the desktop OAuth flow, open the consent browser,
        persist the resulting token. Blocks until the user completes the
        flow in their browser.
        """
        if not self.has_client_config():
            raise FileNotFoundError(
                f"Google OAuth client config not found at {self.client_config_path}. "
                "Download the OAuth client ID (Desktop app) JSON from Google Cloud "
                "Console and save it to that path."
            )

        from google_auth_oauthlib.flow import InstalledAppFlow

        flow = InstalledAppFlow.from_client_secrets_file(
            str(self.client_config_path), SCOPES,
        )
        creds = flow.run_local_server(port=0, open_browser=True)
        self._persist_token(creds)
        self._credentials = creds
        logger.info("gdrive OAuth completed: token saved to %s", self.token_path)
        return True

    def _persist_token(self, creds) -> None:
        self.token_path.parent.mkdir(parents=True, exist_ok=True)
        self.token_path.write_text(creds.to_json())

    def get_service(self):
        """Build a Drive v3 API service client.

        Raises FileNotFoundError if no token is available — the caller is
        expected to run ``run_oauth_flow`` first.
        """
        creds = self.load_credentials()
        if not creds:
            raise FileNotFoundError(
                f"No valid Google Drive token at {self.token_path}. "
                "Run `meridian gdrive auth` to authenticate."
            )

        from googleapiclient.discovery import build

        return build("drive", "v3", credentials=creds, cache_discovery=False)

    def revoke(self) -> None:
        """Delete the cached token — forces re-auth on the next run."""
        if self.token_path.exists():
            self.token_path.unlink()
        self._credentials = None


def get_drive_service():
    """Convenience factory for the rest of the engine."""
    return GDriveAuth().get_service()
