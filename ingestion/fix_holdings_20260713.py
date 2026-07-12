# -*- coding: utf-8 -*-
"""2026-07-13 依券商對帳單核對後的修正（Rebecca / 台新證券）：
A) 補 4 筆被「同信相同成交去重」吃掉的台股成交（對帳單為準）
   2330 4/13 +10@1985、2330 5/11 +10@2250、2327 4/14 +50@310、+50@310.5
B) 刪除 2026-07-12 誤補的基準交易（對帳單證明已全部賣出）：VOO +4、6669 +17
C) 修正 2303 → 8299（「群聯電子」被 fuzzy 對照誤判成聯電）
D) 重算受影響持股 + 修正已實現損益

驗證目標（券商庫存截圖 2026-07-13）：2330=560 股/成本 1,075,915、2454=22、
無 6669 / 3135 / VOO。
Usage: python fix_holdings_20260713.py --service-account ../family-finance/.firebase-admin.json [--apply]
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

from google.cloud import firestore

MARK = "fix-20260713-statement"
HOLDER, PLATFORM = "Rebecca", "台新證券"

# A) 對帳單有、DB 缺的成交（fee/amount 直接取自對帳單）
MISSING_TRADES = [
    {"date": "2026-04-13", "symbol": "2330", "companyName": "台積電",
     "shares": 10, "price": 1985.0, "fee": 28, "tax": 0, "amount": 19878.0, "seq": 2},
    {"date": "2026-05-11", "symbol": "2330", "companyName": "台積電",
     "shares": 10, "price": 2250.0, "fee": 32, "tax": 0, "amount": 22532.0, "seq": 2},
    {"date": "2026-04-14", "symbol": "2327", "companyName": "國巨",
     "shares": 50, "price": 310.0, "fee": 22, "tax": 0, "amount": 15522.0, "seq": 2},
    {"date": "2026-04-14", "symbol": "2327", "companyName": "國巨",
     "shares": 50, "price": 310.5, "fee": 22, "tax": 0, "amount": 15547.0, "seq": 2},
]

# B) 要刪除的錯誤基準交易
BAD_BASELINES = [
    "baseline__VOO__Rebecca__台新證券__美股",
    "baseline__6669__Rebecca__台新證券__台股",
]

REBUILD_KEYS = [
    ("2330", "台股"), ("2327", "台股"), ("6669", "台股"),
    ("8299", "台股"), ("2303", "台股"), ("VOO", "美股"),
]


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def insert_missing(db, apply):
    col = db.collection("transactions")
    for t in MISSING_TRADES:
        doc_id = (f"stmt__tw__{t['symbol']}__B__{t['date']}"
                  f"__{t['shares']:g}__{t['price']:g}__{t['seq']}")
        ref = col.document(doc_id)
        if ref.get().exists:
            print(f"[skip] 已存在: {doc_id}")
            continue
        print(f"[insert] {t['date']} {t['symbol']} 買入 {t['shares']}股 @{t['price']:g} amount={t['amount']:g}")
        if apply:
            ref.set({
                "date": f"{t['date']}T12:00:00.000Z", "type": "買入",
                "symbol": t["symbol"], "companyName": t["companyName"],
                "shares": t["shares"], "price": t["price"],
                "fee": t["fee"], "tax": t["tax"], "amount": t["amount"],
                "holder": HOLDER, "platform": PLATFORM, "region": "台股",
                "createdBy": "rebeccawang0517@gmail.com", "createdAt": now_iso(),
                "isEmailImport": False, "modifiedBy": MARK,
                "source": "statement-import",
                "note": "依台股對帳單補回：同信相同成交曾被去重機制誤刪",
            })


def delete_bad_baselines(db, apply):
    for doc_id in BAD_BASELINES:
        ref = db.collection("transactions").document(doc_id)
        if not ref.get().exists:
            print(f"[skip] 不存在: {doc_id}")
            continue
        print(f"[delete] {doc_id}（對帳單證明該部位已全數賣出）")
        if apply:
            ref.delete()


def fix_2303(db, apply):
    snap = (db.collection("transactions")
            .where("symbol", "==", "2303").where("holder", "==", HOLDER)
            .where("platform", "==", PLATFORM).get())
    for d in snap:
        t = d.to_dict()
        print(f"[relabel] {str(t.get('date'))[:10]} {t.get('type')} {t.get('shares')}股 2303 → 8299 群聯")
        if apply:
            d.reference.update({
                "symbol": "8299", "companyName": "群聯",
                "modifiedBy": MARK,
                "note": "原誤判為 2303（群聯電子 fuzzy 對照錯誤），依對帳單更正",
            })


def find_stock(db, symbol, region):
    q = (db.collection("stocks")
         .where("symbol", "==", symbol).where("holder", "==", HOLDER)
         .where("platform", "==", PLATFORM).where("region", "==", region)
         .limit(1).get())
    return q[0] if q else None


def rebuild(db, symbol, region, apply):
    snap = (db.collection("transactions")
            .where("symbol", "==", symbol).where("holder", "==", HOLDER)
            .where("platform", "==", PLATFORM).where("region", "==", region).get())
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
            old = t.get("realizedProfit")
            if old is None or abs(num(old) - realized) > 1:
                print(f"    [realized] {symbol} {str(t.get('date'))[:10]} 賣{s:g}股 "
                      f"{num(old):,.0f} → {realized:,.0f}")
                if apply:
                    db.collection("transactions").document(t["__id"]).update(
                        {"realizedProfit": realized, "realizedProfitSource": MARK})
            cost -= s * avg
            shares -= s
    cost = max(0.0, cost)
    existing = find_stock(db, symbol, region)
    cur = num(existing.to_dict().get("shares")) if existing else "(無)"
    print(f"[rebuild] {symbol} {region}: {cur} → {shares:g}股 cost={cost:,.0f}")
    if not apply:
        return
    if shares > 1e-4:
        fields = {"shares": shares, "investmentCost": cost,
                  "companyName": last.get("companyName") or symbol,
                  "lastModified": now_iso(), "modifiedBy": MARK,
                  "rebuiltFromTransactions": True}
        if existing:
            existing.reference.update(fields)
        else:
            db.collection("stocks").add({
                "region": region, "symbol": symbol, "holder": HOLDER,
                "platform": PLATFORM, "currentPrice": num(last.get("price")),
                "changePercent": 0, "createdAt": now_iso(), "createdBy": MARK,
                **fields})
    elif existing:
        print(f"    [delete-stock] {symbol}（已無持股）")
        existing.reference.delete()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--service-account", type=Path, required=True)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    db = firestore.Client.from_service_account_json(str(args.service_account))
    print(f"=== {'APPLY' if args.apply else 'DRY-RUN'} ===")
    print("\n-- A) 補對帳單缺漏成交 --")
    insert_missing(db, args.apply)
    print("\n-- B) 刪除錯誤基準 --")
    delete_bad_baselines(db, args.apply)
    print("\n-- C) 2303 → 8299 --")
    fix_2303(db, args.apply)
    print("\n-- D) 重算持股 --")
    for sym, region in REBUILD_KEYS:
        rebuild(db, sym, region, args.apply)
    print("\n[done]")


if __name__ == "__main__":
    main()
