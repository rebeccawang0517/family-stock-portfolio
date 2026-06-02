"""End-to-end pipeline: fetch Taishin Securities confirmation emails -> parse PDFs -> upload trades.

For each matching email:
  1. Download the PDF attachment
  2. Parse it (pdfplumber + fixed password)
  3. POST trades to the upload endpoint(s)

Designed to be idempotent — both the upload endpoints dedupe on stable keys, so
re-running on the same emails is safe.

Usage:
    python mail_to_firestore.py \\
        --token secrets/gmail_token_rebecca.json \\
        --client-secret secrets/gmail_oauth_client.json \\
        --base-url http://localhost:3000 \\
        --user-email rebeccawang0517@gmail.com \\
        --holder Rebecca \\
        --secret <STOCK_TRADES_UPLOAD_SECRET> \\
        [--gmail-query 'from:service@billu.tssco.com.tw subject:確認書 has:attachment'] \\
        [--pdf-password 4801] \\
        [--max 200] \\
        [--save-pdfs ./pdfs] \\
        [--targets supabase,firestore] \\
        [--dry-run]
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import re
import sys
import zipfile
from datetime import datetime
from email.header import decode_header, make_header
from pathlib import Path
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

import parse_taishin_pdf       # 海外股「確認書」
import parse_taishin_tw_pdf    # 台股「交割憑單」(PDF)
import parse_taishin_tw_html   # 台股「交割憑單」(舊版 HTML in ZIP)

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
ENDPOINTS = {
    "supabase":  "/api/stock-trades/upload",
    "firestore": "/api/stock-trades/firestore-upload",
}

MODES = {
    "overseas": {
        "query": "from:service@billu.tssco.com.tw subject:確認書 has:attachment",
        "parser": "overseas",
    },
    "tw": {
        "query": "from:service@billu.tssco.com.tw subject:交割憑單 has:attachment",
        "parser": "tw",
    },
}

# 從台股 email 主旨抓日期，例：「台新證券 2026.5.6 交割憑單」
TW_DATE_RE = re.compile(r'(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})')


def extract_tw_trade_date(subject: str) -> str | None:
    m = TW_DATE_RE.search(subject or '')
    if not m:
        return None
    y, mo, d = m.groups()
    return f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"


def decode_mime(s: str | None) -> str:
    if not s:
        return ''
    try:
        return str(make_header(decode_header(s)))
    except Exception:
        return s


def extract_to_name(payload: dict) -> str:
    """從 To header 抽出收件人姓名（去掉 email 部分）"""
    to_raw = decode_mime(get_header(payload, 'To') or '')
    name = to_raw.split('<')[0].strip().strip('"').strip()
    return name


def load_holders_config(path: Path) -> dict:
    """holders 設定檔格式：
    {
      "王宣雅": {"holder": "Rebecca", "user_email": "...", "passwords": ["4801"], "account_no": "..."},
      "魯睿恩": {"holder": "Eric",    "user_email": "...", "passwords": ["XXXX"], "account_no": "..."}
    }
    """
    return json.loads(path.read_text(encoding='utf-8'))


# ─────────────────────────────────────────────────────────────────────
# Gmail
# ─────────────────────────────────────────────────────────────────────
def load_creds(token_path: Path, client_secret_path: Path) -> Credentials:
    creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        token_path.write_text(creds.to_json(), encoding="utf-8")
        print(f"[ok] refreshed gmail token")
    return creds


def list_message_ids(svc, query: str, max_results: int) -> list[str]:
    ids: list[str] = []
    page_token = None
    while len(ids) < max_results:
        resp = svc.users().messages().list(
            userId="me", q=query, pageToken=page_token,
            maxResults=min(100, max_results - len(ids)),
        ).execute()
        for m in resp.get("messages", []):
            ids.append(m["id"])
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return ids


def get_message(svc, msg_id: str) -> dict:
    return svc.users().messages().get(userId="me", id=msg_id, format="full").execute()


def get_header(payload: dict, name: str) -> str | None:
    for h in payload.get("headers", []):
        if h.get("name", "").lower() == name.lower():
            return h.get("value")
    return None


def iter_useful_attachments(payload: dict):
    """Yield (filename, attachment_id, kind) where kind ∈ {'pdf', 'zip'}."""
    parts = payload.get("parts") or [payload]
    stack = list(parts)
    while stack:
        p = stack.pop()
        if p.get("parts"):
            stack.extend(p["parts"])
            continue
        filename = (p.get("filename") or "").strip()
        low = filename.lower()
        kind = None
        if low.endswith(".pdf"):
            kind = "pdf"
        elif low.endswith(".zip"):
            kind = "zip"
        else:
            continue
        att_id = p.get("body", {}).get("attachmentId")
        if not att_id:
            continue
        yield filename, att_id, kind


def extract_html_from_zip(zip_bytes: bytes, passwords: list[str]) -> tuple[str, str] | None:
    """Try each password; return (inner_filename, html_text) or None."""
    z = zipfile.ZipFile(io.BytesIO(zip_bytes))
    inner_names = [n for n in z.namelist() if n.lower().endswith(('.html', '.htm'))]
    if not inner_names:
        return None
    target = inner_names[0]
    for pw in passwords:
        try:
            z.setpassword(pw.encode())
            data = z.read(target)
            return target, data.decode('utf-8', errors='replace')
        except Exception:
            continue
    return None


def fetch_attachment(svc, msg_id: str, att_id: str) -> bytes:
    a = svc.users().messages().attachments().get(
        userId="me", messageId=msg_id, id=att_id,
    ).execute()
    return base64.urlsafe_b64decode(a["data"])


# ─────────────────────────────────────────────────────────────────────
# Upload
# ─────────────────────────────────────────────────────────────────────
def post_json(url: str, body: bytes, secret: str) -> tuple[int, str]:
    req = urlrequest.Request(
        url, data=body, method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {secret}",
        },
    )
    try:
        with urlrequest.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read().decode("utf-8")
    except HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except URLError as e:
        return 0, f"network error: {e}"


def upload_trades(payload: dict, base_url: str, secret: str, targets: list[str]) -> dict:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    out = {}
    for tgt in targets:
        url = base_url.rstrip("/") + ENDPOINTS[tgt]
        status, text = post_json(url, body, secret)
        out[tgt] = {"status": status, "body": text}
    return out


# ─────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--token", type=Path, required=True)
    ap.add_argument("--client-secret", type=Path, required=True)
    ap.add_argument("--base-url", default="http://localhost:3000")
    ap.add_argument("--user-email", default=None,
                    help="若用 --holders-config 則由 config 帶入")
    ap.add_argument("--holder", default=None,
                    help="若用 --holders-config 則由 config 帶入")
    ap.add_argument("--platform", default="台新證券")
    ap.add_argument("--broker", default="taishin")
    ap.add_argument("--account-no", default=None)
    ap.add_argument("--secret", required=True)
    ap.add_argument("--holders-config", type=Path, default=None,
                    help="JSON 對照檔：to_name → {holder, user_email, passwords, ...}")
    ap.add_argument("--mode", choices=list(MODES.keys()), default="overseas",
                    help="overseas (確認書) or tw (交割憑單)")
    ap.add_argument("--gmail-query", default=None,
                    help="覆蓋 mode 預設的查詢")
    ap.add_argument("--after", default=None,
                    help="只抓此日期之後的信，格式 YYYY/MM/DD（會 append 到 query）")
    ap.add_argument("--pdf-passwords", default="4801",
                    help="comma-separated; tried in order")
    ap.add_argument("--max", type=int, default=200)
    ap.add_argument("--save-pdfs", type=Path, default=None,
                    help="if set, persist downloaded PDFs to this dir")
    ap.add_argument("--targets", default="supabase,firestore")
    ap.add_argument("--dry-run", action="store_true",
                    help="parse only, do not POST")
    args = ap.parse_args()

    targets = [t.strip() for t in args.targets.split(",") if t.strip()]
    default_passwords = [p.strip() for p in args.pdf_passwords.split(",") if p.strip()]
    holders_cfg = load_holders_config(args.holders_config) if args.holders_config else {}
    if not holders_cfg and (not args.user_email or not args.holder):
        raise SystemExit("must provide --holders-config OR (--user-email + --holder)")
    creds = load_creds(args.token, args.client_secret)
    svc = build("gmail", "v1", credentials=creds, cache_discovery=False)

    mode_cfg = MODES[args.mode]
    query = args.gmail_query or mode_cfg["query"]
    parser_kind = mode_cfg["parser"]
    if args.after:
        query = f"{query} after:{args.after}"
    print(f"[gmail] mode={args.mode} query: {query}")
    msg_ids = list_message_ids(svc, query, args.max)
    print(f"[gmail] matched messages: {len(msg_ids)}")

    if args.save_pdfs:
        args.save_pdfs.mkdir(parents=True, exist_ok=True)

    total_emails = 0
    total_pdfs = 0
    total_trades_parsed = 0
    summary = []

    for msg_id in msg_ids:
        msg = get_message(svc, msg_id)
        payload = msg.get("payload", {})
        subject = decode_mime(get_header(payload, "Subject") or "")
        date_hdr = get_header(payload, "Date") or ""
        to_name = extract_to_name(payload)
        atts = list(iter_useful_attachments(payload))
        if not atts:
            continue
        total_emails += 1

        # 決定 holder + 密碼
        if holders_cfg:
            cfg = holders_cfg.get(to_name)
            if not cfg:
                print(f"[skip] 收件人 '{to_name}' 不在 holders-config 裡", file=sys.stderr)
                continue
            this_holder      = cfg["holder"]
            this_user_email  = cfg["user_email"]
            this_account_no  = cfg.get("account_no", args.account_no)
            this_passwords   = cfg.get("passwords", default_passwords)
        else:
            this_holder      = args.holder
            this_user_email  = args.user_email
            this_account_no  = args.account_no
            this_passwords   = default_passwords

        for filename, att_id, kind in atts:
            data = fetch_attachment(svc, msg_id, att_id)
            total_pdfs += 1

            # Persist
            if args.save_pdfs:
                safe_name = f"{msg_id}__{filename}".replace("/", "_")
                file_path = args.save_pdfs / safe_name
                file_path.write_bytes(data)
            else:
                ext = '.zip' if kind == 'zip' else '.pdf'
                file_path = Path.cwd() / f"_tmp_{msg_id}{ext}"
                file_path.write_bytes(data)

            trades: list[dict] = []
            last_err = None

            if kind == "zip":
                # 舊版台股：HTML in encrypted ZIP
                trade_date = extract_tw_trade_date(subject)
                if not trade_date:
                    print(f"[error] 主旨抓不到日期: {subject}", file=sys.stderr)
                else:
                    extracted = extract_html_from_zip(data, this_passwords)
                    if extracted is None:
                        print(f"[error] 無法解 zip: {filename} ({msg_id})", file=sys.stderr)
                    else:
                        _inner_name, html = extracted
                        try:
                            trades = parse_taishin_tw_html.parse_html(html, trade_date)
                        except Exception as e:
                            print(f"[error] HTML parse 失敗 {filename}: {e}", file=sys.stderr)
            else:
                # PDF
                parsed = None
                for pw in this_passwords:
                    try:
                        if parser_kind == "tw":
                            trade_date = extract_tw_trade_date(subject)
                            if not trade_date:
                                print(f"[error] 主旨抓不到日期: {subject}", file=sys.stderr)
                                break
                            parsed = parse_taishin_tw_pdf.parse_pdf(file_path, pw, trade_date)
                        else:
                            parsed = parse_taishin_pdf.parse_pdf(file_path, pw)
                        break
                    except Exception as e:
                        last_err = e
                        continue
                if parsed is None:
                    print(f"[error] all passwords failed for {filename} ({msg_id}): {last_err}", file=sys.stderr)
                else:
                    trades = parsed["trades"]

            if not trades:
                if not args.save_pdfs and file_path.exists():
                    file_path.unlink()
                continue

            total_trades_parsed += len(trades)

            payload_obj = {
                "user_email": this_user_email,
                "holder": this_holder,
                "broker": args.broker,
                "platform": args.platform,
                "account_no": this_account_no,
                "source_file": filename,
                "gmail_message_id": msg_id,
                "trades": trades,
            }

            tag = f"{subject[:40]} ({len(trades)} trades)"
            if args.dry_run:
                print(f"[dry] {msg_id} {tag}")
            else:
                results = upload_trades(payload_obj, args.base_url, args.secret, targets)
                ok = all(200 <= r["status"] < 300 for r in results.values())
                marker = "[ok]" if ok else "[fail]"
                summary_line = f"{marker} {msg_id} {tag} | " + " | ".join(
                    f"{t}={results[t]['status']}" for t in targets
                )
                print(summary_line)
                summary.append({
                    "message_id": msg_id, "subject": subject, "date": date_hdr,
                    "filename": filename, "trades": len(trades), "results": results,
                })

            if not args.save_pdfs and file_path.exists():
                file_path.unlink()

    print(f"\n[done] emails={total_emails} attachments={total_pdfs} trades_parsed={total_trades_parsed}")
    if not args.dry_run and summary:
        log_path = Path.cwd() / f"mail_run_{datetime.now().strftime('%Y%m%dT%H%M%S')}.log.json"
        log_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[log] {log_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
