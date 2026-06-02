"""一次性清除：因 lookup 表缺漏，Firestore 中存在 symbol 為中文名（非代號）的髒資料。

用法：
    python _cleanup_chinese_ticker.py \
        --service-account ../family-finance/.firebase-admin.json \
        --confirm I-HAVE-A-BACKUP

刪除目標：
    - transactions where symbol in BAD_SYMBOLS
    - stocks       where symbol in BAD_SYMBOLS
"""
from __future__ import annotations

import argparse
from pathlib import Path

from google.cloud import firestore

BAD_SYMBOLS = ['凌航科技', '台表黏科技', '晶豪科技', '欣興電子']


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--service-account', type=Path, required=True)
    ap.add_argument('--confirm', required=True)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    if args.confirm != 'I-HAVE-A-BACKUP':
        raise SystemExit("[abort] --confirm must be 'I-HAVE-A-BACKUP'")

    db = firestore.Client.from_service_account_json(str(args.service_account))

    for collection in ('transactions', 'stocks'):
        col = db.collection(collection)
        for sym in BAD_SYMBOLS:
            docs = list(col.where('symbol', '==', sym).stream())
            print(f'[{collection}] symbol={sym}: {len(docs)} doc(s)')
            for d in docs:
                data = d.to_dict() or {}
                print(f'   - id={d.id} holder={data.get("holder")} date={data.get("date")} shares={data.get("shares")}')
                if not args.dry_run:
                    d.reference.delete()
        if not args.dry_run:
            print(f'[{collection}] deletes flushed.')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
