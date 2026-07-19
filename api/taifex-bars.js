// 台指期日 K 讀取端點（公開、含 CORS）：回傳 Firestore `taifex_daily` 全部日 K。
// 若庫存太少（首次使用），自動向期交所回補近 2 年再回傳 —— 前端永遠拿得到資料。
// GET /api/taifex-bars  →  { bars:[{date,time,open,high,low,close,volume}], count, backfilled }
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { fetchTaifexRange } from './taifex-daily-sync.js';

if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SA)) });
const db = getFirestore();

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let snap = await db.collection('taifex_daily').orderBy('time').get();
    let backfilled = 0;

    if (snap.size < 100) {
      // 首次使用：分季回補近 2 年（期交所單次查詢範圍有限制）
      const end = new Date();
      const cur = new Date(end.getTime() - 2 * 365 * 86400000);
      while (cur < end) {
        const segEnd = new Date(Math.min(cur.getTime() + 92 * 86400000, end.getTime()));
        try {
          const bars = await fetchTaifexRange(cur, segEnd);
          for (const b of bars) { await db.doc(`taifex_daily/${b.dateKey}`).set(b, { merge: true }); backfilled++; }
        } catch (e) { /* 單段失敗不擋整批 */ }
        cur.setTime(segEnd.getTime() + 86400000);
      }
      snap = await db.collection('taifex_daily').orderBy('time').get();
    }

    const bars = snap.docs.map(d => {
      const b = d.data();
      return { date: b.date, time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
    });
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json({ bars, count: bars.length, backfilled });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
