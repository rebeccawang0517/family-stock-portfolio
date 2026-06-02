"""First-time OAuth authorization flow for Gmail API (Desktop app).

Opens a browser asking for Gmail read-only permission, then writes a token
JSON we can reuse silently in cron jobs (auto-refreshes).

Usage:
    python gmail_auth.py \\
        --client-secret secrets/gmail_oauth_client.json \\
        --token-out secrets/gmail_token_rebecca.json
"""

from __future__ import annotations

import argparse
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def authorize(client_secret: Path, token_out: Path) -> None:
    creds: Credentials | None = None
    if token_out.exists():
        creds = Credentials.from_authorized_user_file(str(token_out), SCOPES)

    if creds and creds.valid:
        print(f"[ok] existing token still valid: {token_out}")
        return

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            token_out.write_text(creds.to_json(), encoding="utf-8")
            print(f"[ok] refreshed token: {token_out}")
            return
        except Exception as e:
            print(f"[warn] refresh failed ({e}); re-running interactive flow")

    flow = InstalledAppFlow.from_client_secrets_file(str(client_secret), SCOPES)
    # Opens browser; uses local loopback redirect (Desktop app type)
    creds = flow.run_local_server(port=0)
    token_out.parent.mkdir(parents=True, exist_ok=True)
    token_out.write_text(creds.to_json(), encoding="utf-8")
    print(f"[ok] new token saved: {token_out}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--client-secret", type=Path, required=True)
    ap.add_argument("--token-out", type=Path, required=True)
    args = ap.parse_args()

    if not args.client_secret.exists():
        raise SystemExit(f"client secret not found: {args.client_secret}")

    authorize(args.client_secret, args.token_out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
