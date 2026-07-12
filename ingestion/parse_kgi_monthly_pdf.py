# -*- coding: utf-8 -*-
"""凱基證券「有價證券月電子對帳單」解析（Eric 用）。

格式（第一頁 交易記錄，一行一筆成交）：
  買:   06/01 上市@零買2337旺 宏 10 169.00 1,690 1 新台幣 -1,691
  賣:   07/22 櫃檯@現賣6274台 燿 2,000 153.00 306,000 261 918 新台幣 304,821
  買沖: 05/07 上市@買沖2337旺 宏 1,000 168.00 168,000 143 新台幣
  賣沖: 05/07 上市@賣沖2337旺 宏 1,000 161.00 161,000 137 241 新台幣
  現沖: 05/07 上市 現沖2337旺 宏 1,000 新台幣 -7,521   ← 當沖損益彙總列，略過

輸出 schema 對齊 parse_taishin_tw_pdf（trade_date/ticker/side/shares/...）。
"""
from __future__ import annotations

import re
from pathlib import Path

import pdfplumber

LINE_RE = re.compile(
    r'^(\d{2})/(\d{2})\s+(上市|櫃檯|興櫃)\s*@?\s*'
    r'(零買|現買|買沖|零賣|現賣|賣沖|現沖|強買|強賣)\s*'
    r'([0-9A-Z]{4,6})\s*(.*?)\s+'
    r'([\d,]+)\s+'                                            # 股數
    r'(?:([\d,.]+)\s+([\d,]+)\s+([\d,]+)\s+(?:([\d,]+)\s+)?)?'  # 單價 金額 手續費 [交易稅]
    r'新台幣\s*(-?[\d,]+)?\s*$'
)


def _n(s):
    if s is None or s == '':
        return None
    return float(str(s).replace(',', ''))


def parse_pdf(pdf_path: Path, password: str, year_month: str) -> dict:
    """year_month: 'YYYYMM'（對帳單月份，補足交易日期的年份）"""
    yyyy = int(year_month[:4])
    trades: list[dict] = []
    with pdfplumber.open(str(pdf_path), password=password) as pdf:
        for page in pdf.pages:
            txt = page.extract_text() or ''
            # 只解析交易記錄頁（交割專戶頁的摘要列不會匹配 LINE_RE）
            for line in txt.split('\n'):
                m = LINE_RE.match(line.strip())
                if not m:
                    continue
                mm, dd, _market, cat, code, name, sh, price, gross, fee, tax, net = m.groups()
                if cat == '現沖':          # 當沖彙總列（無單價），非成交
                    continue
                if price is None:
                    continue
                side = 'B' if '買' in cat else 'S'
                shares = _n(sh)
                gross_v = _n(gross) or 0.0
                fee_v = _n(fee) or 0.0
                tax_v = _n(tax) or 0.0
                net_v = _n(net)
                if net_v is None:  # 沖銷列沒有應收付欄，自行計算
                    net_v = -(gross_v + fee_v) if side == 'B' else gross_v - fee_v - tax_v
                trades.append({
                    'trade_date': f'{yyyy:04d}-{int(mm):02d}-{int(dd):02d}',
                    'settle_date': None,
                    'payment_date': None,
                    'trade_currency': 'TWD',
                    'settle_currency': 'TWD',
                    'ticker': code,
                    'name': name.replace(' ', '') or code,
                    'side': side,
                    'shares': shares,
                    'unit_price': _n(price),
                    'gross_amount': gross_v,
                    'commission_fee': fee_v,
                    'trade_fee': 0.0,
                    'settle_fee': 0.0,
                    'stamp_tax': tax_v,
                    'exchange_levy': 0.0,
                    'frc_ptp_fee': 0.0,
                    'net_amount': net_v,
                    'market': '台灣市場',
                })
    return {'trades': trades, 'source_file': Path(pdf_path).name}


if __name__ == '__main__':
    import json
    import sys
    r = parse_pdf(Path(sys.argv[1]), sys.argv[2], sys.argv[3])
    print(json.dumps(r, ensure_ascii=False, indent=1))
