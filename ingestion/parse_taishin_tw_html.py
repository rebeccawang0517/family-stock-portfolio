"""Parse Taishin Securities Taiwan-stock 交割憑單 (legacy HTML format).

舊版台股對帳單是 HTML 包在 ZIP 裡（zip 密碼 4801）。
表頭跟新版 PDF 相同（15 欄），但 layout 用 HTML <table>。

Usage:
    python parse_taishin_tw_html.py <html_path> --trade-date 2024-01-31
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup

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


def _clean(s):
    return re.sub(r'\s+', '', s or '')


def parse_html(html: str, trade_date: str) -> list[dict]:
    soup = BeautifulSoup(html, 'html.parser')
    trades: list[dict] = []
    for tr in soup.find_all('tr'):
        tds = tr.find_all('td')
        if len(tds) < 15:
            continue
        first = _clean(tds[0].get_text())
        side = SIDE_MAP.get(first)
        if side is None:
            continue

        pdf_name = _clean(tds[1].get_text())
        ticker = twl.resolve_ticker(pdf_name) or pdf_name
        if ticker == pdf_name:
            print(f"[warn] 找不到代號 for '{pdf_name}'", file=sys.stderr)

        shares = _to_number(_clean(tds[2].get_text()))
        price  = _to_number(_clean(tds[4].get_text()))
        gross  = _to_number(_clean(tds[5].get_text()))
        fee    = _to_number(_clean(tds[6].get_text())) or 0.0
        tax    = _to_number(_clean(tds[7].get_text())) or 0.0
        net    = _to_number(_clean(tds[14].get_text()))

        trades.append({
            'trade_date': trade_date,
            'settle_date': None,
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
            'stamp_tax': tax,
            'exchange_levy': 0.0,
            'frc_ptp_fee': 0.0,
            'net_amount': net,
            'market': '台灣市場',
        })
    return trades


def parse_html_file(path: Path, trade_date: str) -> dict:
    return {
        'source_file': path.name,
        'trades': parse_html(path.read_text(encoding='utf-8'), trade_date),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('html_path', type=Path)
    ap.add_argument('--trade-date', required=True)
    ap.add_argument('--out', type=Path, default=None)
    args = ap.parse_args()

    if not args.html_path.exists():
        raise SystemExit(f"file not found: {args.html_path}")

    data = parse_html_file(args.html_path, args.trade_date)
    out = args.out or args.html_path.with_suffix('.json')
    out.write_text(json.dumps(data['trades'], ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"[ok] {len(data['trades'])} trade(s) -> {out}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
