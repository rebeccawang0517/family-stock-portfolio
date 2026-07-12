# -*- coding: utf-8 -*-
"""2026-07-12 持股修復：
A) 還原被 rebuild 誤刪的手動持股（Eric 全部 + Rebecca VOO 信託）— 依 2026-05-07 備份
B) 補「期初持股基準」交易（信件歷史起點之前就持有的部位）：
   2330 +100股 / VOO +4股 / 6669 +17股（Rebecca / 台新證券）
C) 依完整交易紀錄重算這三檔的 stocks 文件（含賣出的已實現損益修正）

冪等：重複執行不會重複寫入。
Usage:
    python fix_holdings_20260712.py --service-account ../family-finance/.firebase-admin.json [--apply]
    （預設 dry-run，加 --apply 才實際寫入）
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from google.cloud import firestore

BACKUP = Path(__file__).parent / "backups" / "stocks_20260507T082057Z.json"

# A) 直接還原的 stocks 文件（無信件來源的手動持股，key = symbol/holder/platform/region）
RESTORE_KEYS = [
    ("2330", "Eric", "證券", "台股"),
    ("2454", "Eric", "證券", "台股"),
    ("AAPL", "Eric", "信託", "美股"),
    ("GOOGL", "Eric", "信託", "美股"),
    ("VOO", "Rebecca", "信託", "美股"),
]

# B) 期初基準交易（date 早於所有信件交易，重播時最先生效）
BASELINES = [
    {"symbol": "2330", "region": "台股", "companyName": "台積電",
     "shares": 100, "amount": 64200.0,  # 成本以 2024-01 賣出價 642 回推（原始成本不可考）
     "note": "期初持股基準：2026-05-07 手動紀錄 510 股 − 信件重算 410 股"},
    {"symbol": "VOO", "region": "美股", "companyName": "Vanguard S&P 500 ETF",
     "shares": 4, "amount": 1832.52,
     "note": "期初持股基準：2026-05-07 手動紀錄 23 股 − 信件重算 19 股"},
    {"symbol": "6669", "region": "台股", "companyName": "緯穎",
     "shares": 17, "amount": 79515.0,
     "note": "期初持股基準：2026-05-07 手動紀錄 17 股（信件期間買賣淨額為 0）"},
]
BASELINE_HOLDER = "Rebecca"
BASELINE_PLATFORM = "台新證券"
BASELINE_DATE = "2019-01-01T12:00:00.000Z"
MARK = "fix-20260712"


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def find_stock(db, symbol, holder, platform, region):
    q = (db.collection("stocks")
         .where("symbol", "==", symbol).where("holder", "==", holder)
         .where("platform", "==", platform).where("region", "==", region)
         .limit(1).get())
    return q[0] if q else None


def restore_deleted_stocks(db, apply: bool):
    backup = json.loads(BACKUP.read_text(encoding="utf-8"))
    by_key = {(s.get("symbol"), s.get("holder"), s.get("platform"), s.get("region")): s
              for s in backup}
    for key in RESTORE_KEYS:
        src = by_key.get(key)
        if not src:
            print(f"[warn] 備份中找不到 {key}")
            continue
        if find_stock(db, *key):
            print(f"[skip] 已存在，不還原: {key}")
            continue
        doc = {
            "symbol": src["symbol"], "holder": src["holder"],
            "platform": src["platform"], "region": src["region"],
            "companyName": src.get("companyName") or src["symbol"],
            "shares": num(src.get("shares")),
            "investmentCost": num(src.get("investmentCost")),
            "currentPrice": num(src.get("currentPrice")),
            "changePercent": num(src.get("changePercent")),
            "createdAt": src.get("createdAt") or now_iso(),
            "createdBy": src.get("createdBy") or "fix",
            "lastModified": now_iso(), "modifiedBy": MARK,
            "restoredFrom": "backup-20260507",
        }
        print(f"[restore] {key} shares={doc['shares']:g} cost={doc['investmentCost']:g}")
        if apply:
            db.collection("stocks").add(doc)


def insert_baselines(db, apply: bool):
    col = db.collection("transactions")
    for b in BASELINES:
        doc_id = f"baseline__{b['symbol']}__{BASELINE_HOLDER}__{BASELINE_PLATFORM}__{b['region']}"
        ref = col.document(doc_id)
        if ref.get().exists:
            print(f"[skip] 基準交易已存在: {doc_id}")
            continue
        doc = {
            "date": BASELINE_DATE, "type": "買入",
            "symbol": b["symbol"], "companyName": b["companyName"],
            "shares": b["shares"], "price": round(b["amount"] / b["shares"], 2),
            "fee": 0, "tax": 0, "amount": b["amount"],
            "holder": BASELINE_HOLDER, "platform": BASELINE_PLATFORM, "region": b["region"],
            "createdBy": "rebeccawang0517@gmail.com", "createdAt": now_iso(),
            "isBaseline": True, "note": b["note"], "modifiedBy": MARK,
        }
        print(f"[baseline] {b['symbol']} +{b['shares']}股 amount={b['amount']:g}")
        if apply:
            ref.set(doc)


def rebuild(db, symbol, holder, platform, region, apply: bool):
    """對齊 firestore-upload route 的 rebuildHolding：時序重播 + 更新 stocks + 修賣出已實現損益"""
    snap = (db.collection("transactions")
            .where("symbol", "==", symbol).where("holder", "==", holder)
            .where("platform", "==", platform).where("region", "==", region).get())
    txs = [{**d.to_dict(), "__id": d.id} for d in snap]
    txs.sort(key=lambda t: str(t.get("date", "")))
    shares, cost = 0.0, 0.0
    last = txs[-1] if txs else {}
    for t in txs:
        s, amt = num(t.get("shares")), num(t.get("amount"))
        if t.get("type") == "買入":
            shares += s
            cost += amt
        elif t.get("type") == "賣出":
            avg = cost / shares if shares > 0 else 0
            realized = amt - s * avg
            old_rp = t.get("realizedProfit")
            if old_rp is None or abs(num(old_rp) - realized) > 1:
                print(f"    [realized] {symbol} {str(t.get('date'))[:10]} 賣{s:g}股 "
                      f"已實現損益 {num(old_rp):,.0f} → {realized:,.0f}")
                if apply:
                    db.collection("transactions").document(t["__id"]).update(
                        {"realizedProfit": realized, "realizedProfitSource": MARK})
            cost -= s * avg
            shares -= s
    cost = max(0.0, cost)
    existing = find_stock(db, symbol, holder, platform, region)
    print(f"[rebuild] {symbol} {holder} {platform} {region}: "
          f"{num(existing.to_dict().get('shares')) if existing else '(無)'} → {shares:g}股 cost={cost:,.0f}")
    if not apply:
        return
    if shares > 1e-4:
        fields = {
            "shares": shares, "investmentCost": cost,
            "companyName": last.get("companyName") or symbol,
            "lastModified": now_iso(), "modifiedBy": MARK,
            "rebuiltFromTransactions": True,
        }
        if existing:
            existing.reference.update(fields)
        else:
            db.collection("stocks").add({
                "region": region, "symbol": symbol, "holder": holder, "platform": platform,
                "currentPrice": num(last.get("price")), "changePercent": 0,
                "createdAt": now_iso(), "createdBy": "fix", **fields,
            })
    elif existing:
        existing.reference.delete()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--service-account", type=Path, required=True)
    ap.add_argument("--apply", action="store_true", help="實際寫入（預設 dry-run）")
    args = ap.parse_args()
    db = firestore.Client.from_service_account_json(str(args.service_account))
    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"=== {mode} ===")
    print("\n-- A) 還原被誤刪的手動持股 --")
    restore_deleted_stocks(db, args.apply)
    print("\n-- B) 補期初基準交易 --")
    insert_baselines(db, args.apply)
    print("\n-- C) 重算受影響持股 --")
    for b in BASELINES:
        rebuild(db, b["symbol"], BASELINE_HOLDER, BASELINE_PLATFORM, b["region"], args.apply)
    print("\n[done]")


if __name__ == "__main__":
    main()
