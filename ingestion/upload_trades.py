"""POST normalized trades JSON to one or more upload endpoints.

預設同時打 Supabase（備援）+ Firestore（生產，給既有「交易紀錄」頁用）。

Usage:
    python upload_trades.py <trades.json> \\
        --user-email rebeccawang0517@gmail.com \\
        --holder Rebecca \\
        --secret <STOCK_TRADES_UPLOAD_SECRET> \\
        [--account-no 9B17-1111879] \\
        [--source-file <pdf-name>] \\
        [--gmail-message-id <id>] \\
        [--platform 台新證券] \\
        [--base-url http://localhost:3000] \\
        [--targets supabase,firestore]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

ENDPOINTS = {
    'supabase': '/api/stock-trades/upload',
    'firestore': '/api/stock-trades/firestore-upload',
}


def load_trades(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("trades"), list):
        return data["trades"]
    raise ValueError(f"unsupported JSON shape in {path}")


def post_json(url: str, body: bytes, secret: str) -> tuple[int, str]:
    req = urlrequest.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {secret}",
        },
    )
    try:
        with urlrequest.urlopen(req, timeout=30) as resp:
            return resp.status, resp.read().decode("utf-8")
    except HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except URLError as e:
        return 0, f"network error: {e}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("trades_json", type=Path)
    ap.add_argument("--base-url", default="http://localhost:3000")
    ap.add_argument("--targets", default="supabase,firestore",
                    help="comma-separated endpoints to POST to")
    ap.add_argument("--user-email", required=True)
    ap.add_argument("--holder", required=True, help="持有人顯示名稱（Rebecca / Eric）")
    ap.add_argument("--secret", default=os.environ.get("STOCK_TRADES_UPLOAD_SECRET"),
                    help="defaults to env STOCK_TRADES_UPLOAD_SECRET")
    ap.add_argument("--broker", default="taishin")
    ap.add_argument("--platform", default="台新證券")
    ap.add_argument("--account-no", default=None)
    ap.add_argument("--source-file", default=None)
    ap.add_argument("--gmail-message-id", default=None)
    args = ap.parse_args()

    if not args.secret:
        print("[error] need --secret or env STOCK_TRADES_UPLOAD_SECRET", file=sys.stderr)
        return 2
    if not args.trades_json.exists():
        print(f"[error] file not found: {args.trades_json}", file=sys.stderr)
        return 2

    trades = load_trades(args.trades_json)
    payload = {
        "user_email": args.user_email,
        "holder": args.holder,
        "broker": args.broker,
        "platform": args.platform,
        "account_no": args.account_no,
        "source_file": args.source_file or args.trades_json.name,
        "gmail_message_id": args.gmail_message_id,
        "trades": trades,
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    targets = [t.strip() for t in args.targets.split(",") if t.strip()]
    overall_ok = True
    for tgt in targets:
        if tgt not in ENDPOINTS:
            print(f"[skip] unknown target: {tgt}", file=sys.stderr)
            continue
        url = args.base_url.rstrip('/') + ENDPOINTS[tgt]
        status, text = post_json(url, body, args.secret)
        ok = 200 <= status < 300
        marker = "[ok]" if ok else "[fail]"
        print(f"{marker} {tgt:<10} [{status}] {text}")
        if not ok:
            overall_ok = False

    return 0 if overall_ok else 1


if __name__ == "__main__":
    sys.exit(main())
