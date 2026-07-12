# -*- coding: utf-8 -*-
"""2026-07-13 Eric 凱基對帳單歷史匯入：
1. 解析 pdfs_eric_kgi/ 下全部月對帳單 → 以 firestore-direct 逐信上傳
   （payload 帶 gmail_message_id，與未來自動抓信的去重 id 完全一致）
2. 刪除過時的手動持股 doc（證券 2330×772、2454×350 — 5/7 備份值已過期）
   ※ 信託 doc 不動（使用者手動維護）

Usage: python import_eric_kgi_20260713.py --service-account ../family-finance/.firebase-admin.json [--apply]
"""
from __future__ import annotations

import argparse
import glob
from pathlib import Path

from google.cloud import firestore

import firestore_direct
import parse_kgi_monthly_pdf as kgi
from mail_to_firestore import merge_identical_fills

PASSWORD = "23810927"
HOLDER, PLATFORM, EMAIL = "Eric", "凱基證券", "sclu.eric@gmail.com"

# 過時的手動 doc（symbol, holder, platform, region）
STALE_MANUAL_DOCS = [
    ("2330", "Eric", "證券", "台股"),
    ("2454", "Eric", "證券", "台股"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--service-account", type=Path, required=True)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    db = firestore.Client.from_service_account_json(str(args.service_account))
    print(f"=== {'APPLY' if args.apply else 'DRY-RUN'} ===")

    print("\n-- 刪除過時手動持股 doc --")
    for sym, holder, plat, region in STALE_MANUAL_DOCS:
        q = (db.collection("stocks")
             .where("symbol", "==", sym).where("holder", "==", holder)
             .where("platform", "==", plat).where("region", "==", region).get())
        for d in q:
            print(f"[delete-stock] {sym} {holder}/{plat} shares={d.to_dict().get('shares')}（5/7 備份過時值，改由對帳單重建）")
            if args.apply:
                d.reference.delete()

    print("\n-- 匯入凱基月對帳單交易 --")
    total = 0
    for f in sorted(glob.glob("pdfs_eric_kgi/*.pdf")):
        name = Path(f).name          # 202606__<gmail_id>.pdf
        ym, mid = name[:-4].split("__")
        parsed = kgi.parse_pdf(Path(f), PASSWORD, ym)
        trades = merge_identical_fills(parsed["trades"])
        if not trades:
            continue
        payload = {
            "user_email": EMAIL, "holder": HOLDER, "platform": PLATFORM,
            "broker": "kgi", "account_no": None,
            "source_file": f"KGI_Stock_{ym}.pdf", "gmail_message_id": mid,
            "trades": trades,
        }
        total += len(trades)
        if args.apply:
            status, body = firestore_direct.upload_payload(db, payload)
            print(f"[{ym}] {len(trades)} 筆 → {status} {body[:110]}")
        else:
            for t in trades:
                print(f"[{ym}] {t['trade_date']} {t['ticker']} {t['side']} {t['shares']:g}股 @{t['unit_price']:g}")
    print(f"\n共 {total} 筆")


if __name__ == "__main__":
    main()
