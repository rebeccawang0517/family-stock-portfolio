"""Parse Taishin Securities overseas-stock confirmation PDF into normalized trades.

The PDF table layout uses *two physical rows per trade*:

  Row A (primary):  trade_date | settle_date | trade_currency | ticker | side(B/S)
                    | shares  | gross_amount | trade_fee | settle_fee | frc_ptp_fee
                    | net_amount

  Row B (continuation): market | payment_date | settle_currency | name | (blank)
                    | unit_price | commission_fee | stamp_tax | exchange_levy
                    | (blank) | (blank)

Usage:
    python parse_taishin_pdf.py <pdf_path> [--password 4801] [--out trades.json]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import pdfplumber

DATE_RE = re.compile(r"^\d{4}/\d{1,2}/\d{1,2}$")


def to_iso_date(s: str | None) -> str | None:
    if not s or not DATE_RE.match(s.strip()):
        return None
    y, m, d = s.strip().split("/")
    return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"


def to_number(s: str | None) -> float | None:
    if s is None:
        return None
    s = s.replace(",", "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def is_primary_row(row: list[str | None]) -> bool:
    """Primary row starts with a date (trade_date)."""
    return bool(row) and bool(row[0]) and bool(DATE_RE.match(str(row[0]).strip()))


def normalize_trades(raw_pages: list[dict]) -> list[dict]:
    trades: list[dict] = []
    for page in raw_pages:
        for table in page.get("tables", []):
            i = 0
            while i < len(table):
                row = table[i]
                if not is_primary_row(row):
                    i += 1
                    continue
                cont = table[i + 1] if i + 1 < len(table) else [None] * 11
                trade = {
                    "trade_date": to_iso_date(row[0]),
                    "settle_date": to_iso_date(row[1]),
                    "trade_currency": (row[2] or "").strip() or None,
                    "ticker": (row[3] or "").strip() or None,
                    "side": (row[4] or "").strip() or None,
                    "shares": to_number(row[5]),
                    "gross_amount": to_number(row[6]),
                    "trade_fee": to_number(row[7]),
                    "settle_fee": to_number(row[8]),
                    "frc_ptp_fee": to_number(row[9]),
                    "net_amount": to_number(row[10]),
                    "market": (cont[0] or "").strip() or None,
                    "payment_date": to_iso_date(cont[1]),
                    "settle_currency": (cont[2] or "").strip() or None,
                    "name": (cont[3] or "").strip() or None,
                    "unit_price": to_number(cont[5]),
                    "commission_fee": to_number(cont[6]),
                    "stamp_tax": to_number(cont[7]),
                    "exchange_levy": to_number(cont[8]),
                }
                _normalize_legacy_layout(trade)
                trades.append(trade)
                i += 2
    return trades


def _normalize_legacy_layout(t: dict) -> None:
    """Older PDFs (≤2025-12) shift columns: row[6] is unit_price, row[7] is
    gross_amount, row[8] is trade_fee, row[9] is settle_fee. Detect by checking
    if unit_price is missing AND shares × row[6] ≈ row[7]."""
    if t.get("unit_price") is not None:
        return
    shares = t.get("shares") or 0
    g = t.get("gross_amount") or 0       # actually unit_price in legacy
    f = t.get("trade_fee") or 0          # actually gross_amount in legacy
    if shares <= 0 or g <= 0 or f <= 0:
        return
    # Tolerance: 1% of the gross amount or $1, whichever larger — accommodates
    # cent-level rounding between unit_price × shares and the actual gross.
    if abs(shares * g - f) > max(1.0, 0.01 * f):
        return
    t["unit_price"] = g
    t["gross_amount"] = f
    t["trade_fee"] = t.get("settle_fee") or 0
    t["settle_fee"] = t.get("frc_ptp_fee") or 0
    t["frc_ptp_fee"] = 0


def parse_pdf(pdf_path: Path, password: str) -> dict:
    raw_pages: list[dict] = []
    with pdfplumber.open(pdf_path, password=password) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            raw_pages.append({
                "page": i,
                "text": page.extract_text() or "",
                "tables": page.extract_tables() or [],
            })
    return {
        "source_file": pdf_path.name,
        "raw_pages": raw_pages,
        "trades": normalize_trades(raw_pages),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf_path", type=Path)
    ap.add_argument("--password", default="4801")
    ap.add_argument("--out", type=Path, default=None,
                    help="output JSON file (defaults to <pdf_basename>.json next to PDF)")
    ap.add_argument("--trades-only", action="store_true",
                    help="emit only the normalized trades array")
    args = ap.parse_args()

    if not args.pdf_path.exists():
        print(f"[error] file not found: {args.pdf_path}", file=sys.stderr)
        return 2

    data = parse_pdf(args.pdf_path, args.password)
    payload = data["trades"] if args.trades_only else data

    out = args.out or args.pdf_path.with_suffix(".json")
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[ok] wrote {len(data['trades'])} trade(s) -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
