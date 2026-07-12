# -*- coding: utf-8 -*-
"""直接用服務帳號把交易寫入 Firestore（不經過 Vercel API）。

行為對齊 family-finance/src/app/api/stock-trades/firestore-upload/route.ts：
  - 確定性 doc id（同一封信同一筆交易重跑只寫一次），數字格式模擬 JS String()
  - transactions schema 與 route 相同
  - 上傳後重算受影響持股（時序重播 → 更新 stocks、補賣出的 realizedProfit）

供 mail_to_firestore.py 的 target "firestore-direct" 使用（CI 免架 API 伺服器）。
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

MARKET_TO_REGION = {"美國市場": "美股", "台灣市場": "台股", "香港市場": "港股"}
EPS = 1e-4


def js_num_str(v) -> str:
    """模擬 JS String(number)：10.0 → '10'、300.5 → '300.5'、None → 'null'"""
    if v is None:
        return "null"
    f = float(v)
    if f == int(f):
        return str(int(f))
    return repr(f)


def region_from_market(market) -> str:
    if not market:
        return "美股"
    return MARKET_TO_REGION.get(market, market)


def num(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def fees_total(t: dict) -> float:
    return (num(t.get("commission_fee")) + num(t.get("trade_fee"))
            + num(t.get("settle_fee")) + num(t.get("frc_ptp_fee")))


def tax_total(t: dict) -> float:
    return num(t.get("stamp_tax")) + num(t.get("exchange_levy"))


def deterministic_id(payload: dict, t: dict) -> str:
    parts = [
        "taishin",
        payload.get("gmail_message_id") or payload.get("source_file") or "unknown",
        t["ticker"], t["side"], t["trade_date"],
        js_num_str(t.get("shares")), js_num_str(t.get("unit_price")),
    ]
    return re.sub(r"[^A-Za-z0-9_.-]", "_", "__".join(parts))[:256]


def map_to_doc(payload: dict, t: dict) -> dict:
    fee = fees_total(t)
    tax = tax_total(t)
    gross = num(t.get("gross_amount"))
    amount = gross + fee if t["side"] == "B" else gross - fee - tax
    return {
        "date": f"{t['trade_date']}T12:00:00.000Z",
        "type": "買入" if t["side"] == "B" else "賣出",
        "symbol": t["ticker"],
        "companyName": t.get("name") or t["ticker"],
        "shares": num(t.get("shares")),
        "price": num(t.get("unit_price")),
        "fee": fee, "tax": tax, "amount": amount,
        "holder": payload["holder"],
        "platform": payload.get("platform") or "台新證券",
        "region": region_from_market(t.get("market")),
        "createdBy": payload["user_email"],
        "createdAt": now_iso(),
        "isEmailImport": True,
        "sourceEmail": payload.get("gmail_message_id"),
        "sourcePdf": payload.get("source_file"),
    }


def _find_stock(db, symbol, holder, platform, region):
    q = (db.collection("stocks")
         .where("symbol", "==", symbol).where("holder", "==", holder)
         .where("platform", "==", platform).where("region", "==", region)
         .limit(1).get())
    return q[0] if q else None


def rebuild_holding(db, symbol, holder, platform, region) -> dict:
    """時序重播 transactions → 更新 stocks doc、補缺漏的 realizedProfit"""
    snap = (db.collection("transactions")
            .where("symbol", "==", symbol).where("holder", "==", holder)
            .where("platform", "==", platform).where("region", "==", region).get())
    txs = [{**d.to_dict(), "__id": d.id} for d in snap]
    txs.sort(key=lambda t: str(t.get("date", "")))
    shares, cost, realized_filled = 0.0, 0.0, 0
    last = txs[-1] if txs else {}
    for t in txs:
        s, amt = num(t.get("shares")), num(t.get("amount"))
        if t.get("type") == "買入":
            shares += s
            cost += amt
        elif t.get("type") == "賣出":
            avg = cost / shares if shares > 0 else 0
            if t.get("realizedProfit") is None:
                db.collection("transactions").document(t["__id"]).update({
                    "realizedProfit": amt - s * avg,
                    "realizedProfitSource": "firestore-direct",
                })
                realized_filled += 1
            cost -= s * avg
            shares -= s
    cost = max(0.0, cost)
    existing = _find_stock(db, symbol, holder, platform, region)
    if shares > EPS:
        fields = {
            "shares": shares, "investmentCost": cost,
            "companyName": last.get("companyName") or symbol,
            "lastModified": now_iso(), "modifiedBy": "firestore-direct",
            "rebuiltFromTransactions": True,
        }
        if existing:
            existing.reference.update(fields)
        else:
            db.collection("stocks").add({
                "region": region, "symbol": symbol, "holder": holder,
                "platform": platform, "currentPrice": num(last.get("price")),
                "changePercent": 0, "createdAt": now_iso(),
                "createdBy": last.get("createdBy") or "firestore-direct", **fields,
            })
        return {"action": "upsert", "shares": shares, "realizedFilled": realized_filled}
    if existing:
        existing.reference.delete()
        return {"action": "delete", "shares": 0, "realizedFilled": realized_filled}
    return {"action": "noop", "shares": 0, "realizedFilled": realized_filled}


def upload_payload(db, payload: dict) -> tuple[int, str]:
    """回傳 (status, body)：介面對齊 HTTP 端點，讓 mail_to_firestore 統一處理"""
    trades = payload.get("trades") or []
    if not trades:
        return 200, '{"inserted": 0, "message": "No trades to upload"}'
    col = db.collection("transactions")
    inserted, skipped = 0, 0
    errors = []
    affected = {}
    for t in trades:
        doc_id = deterministic_id(payload, t)
        ref = col.document(doc_id)
        try:
            if ref.get().exists:
                skipped += 1
                continue
            ref.set(map_to_doc(payload, t))
            inserted += 1
            key = (t["ticker"], payload["holder"],
                   payload.get("platform") or "台新證券", region_from_market(t.get("market")))
            affected[key] = True
        except Exception as e:  # noqa: BLE001
            errors.append(f"{t.get('ticker')}: {e}")
    rebuilds = []
    for key in affected:
        try:
            r = rebuild_holding(db, *key)
            rebuilds.append(f"{key[0]}={r['shares']:g}")
        except Exception as e:  # noqa: BLE001
            errors.append(f"rebuild {key[0]}: {e}")
    status = 200 if not errors else 500
    body = (f'{{"inserted": {inserted}, "skipped_duplicates": {skipped}, '
            f'"rebuilds": "{";".join(rebuilds)}", "errors": "{";".join(errors)}"}}')
    return status, body
