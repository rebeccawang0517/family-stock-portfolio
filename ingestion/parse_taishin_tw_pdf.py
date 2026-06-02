"""Parse Taishin Securities Taiwan-stock confirmation (交割憑單) PDF.

Layout (single row per trade):
  類別 | 股票 | 數量 | 現沖數量 | 成交價 | 價金 | 手續費 | 交易稅 |
  融資金額/融券擔保品 | 融資自備款/融券保證金 | 融券手續費/標借費用 |
  融資/券利息 | 債息/證所稅 | 補充保費 | 應收付金額

Notes:
- "現買" → side B; "現賣" → side S
- Other 類別 (融資/融券/...) currently ignored (warn)
- 股票 column is Chinese name only — needs reverse lookup → ticker
- Trade date is in the email subject, NOT in the PDF; pass via --trade-date
- Last row is "小計" — skipped

Usage:
    python parse_taishin_tw_pdf.py <pdf_path> --trade-date 2026-05-06 [--password 4801]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pdfplumber

import tw_stock_lookup as twl


SIDE_MAP = {'現買': 'B', '現賣': 'S'}


def _to_number(s):
    if s is None:
        return None
    s = str(s).replace(',', '').strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def normalize_trades(raw_pages: list[dict], trade_date: str) -> list[dict]:
    trades: list[dict] = []
    for page in raw_pages:
        for table in page.get('tables', []):
            for row in table:
                if not row or not row[0]:
                    continue
                first = str(row[0]).strip()
                if first in ('類別',) or first.startswith('小計'):
                    continue
                side = SIDE_MAP.get(first)
                if side is None:
                    # 非現股交易（融資/融券等）暫時略過
                    print(f"[warn] 略過非現股類別: {first}", file=sys.stderr)
                    continue

                pdf_name = str(row[1] or '').replace('\n', '').strip()
                ticker = twl.resolve_ticker(pdf_name)
                if not ticker:
                    print(f"[warn] 找不到代號 for '{pdf_name}'", file=sys.stderr)
                    ticker = pdf_name  # fallback

                shares    = _to_number(row[2])
                price     = _to_number(row[4])
                gross     = _to_number(row[5])
                fee       = _to_number(row[6]) or 0.0
                tax       = _to_number(row[7]) or 0.0
                net       = _to_number(row[14])

                trade = {
                    'trade_date': trade_date,
                    'settle_date': None,        # 台股 T+2 但 PDF 沒寫
                    'payment_date': None,
                    'trade_currency': 'TWD',
                    'settle_currency': 'TWD',
                    'ticker': ticker,
                    'name': pdf_name,
                    'side': side,
                    'shares': shares,
                    'unit_price': price,
                    'gross_amount': gross,
                    'commission_fee': fee,
                    'trade_fee': 0.0,
                    'settle_fee': 0.0,
                    'stamp_tax': tax,           # 台股 證交稅 借這欄
                    'exchange_levy': 0.0,
                    'frc_ptp_fee': 0.0,
                    'net_amount': net,
                    'market': '台灣市場',
                }
                trades.append(trade)
    return trades


def parse_pdf(pdf_path: Path, password: str, trade_date: str) -> dict:
    raw_pages: list[dict] = []
    with pdfplumber.open(pdf_path, password=password) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            raw_pages.append({
                'page': i,
                'text': page.extract_text() or '',
                'tables': page.extract_tables() or [],
            })
    return {
        'source_file': pdf_path.name,
        'raw_pages': raw_pages,
        'trades': normalize_trades(raw_pages, trade_date),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf_path', type=Path)
    ap.add_argument('--password', default='4801')
    ap.add_argument('--trade-date', required=True, help='YYYY-MM-DD（從 email 主旨抓）')
    ap.add_argument('--out', type=Path, default=None)
    ap.add_argument('--trades-only', action='store_true')
    args = ap.parse_args()

    if not args.pdf_path.exists():
        print(f"[error] file not found: {args.pdf_path}", file=sys.stderr)
        return 2

    data = parse_pdf(args.pdf_path, args.password, args.trade_date)
    payload = data['trades'] if args.trades_only else data

    out = args.out or args.pdf_path.with_suffix('.json')
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"[ok] wrote {len(data['trades'])} trade(s) -> {out}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
