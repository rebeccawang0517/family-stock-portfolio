// 一次性重抓：把 taifex_daily 從指定日期重新抓成「全時段日K」(覆蓋舊的日盤版)。
// 用法（瀏覽器開網址即可）：/api/taifex-refetch?key=<CRON_SECRET>&from=2017-05-15
//   夜盤 2017/05/15 才上線，早於此重抓也只會是日盤(無夜盤可併)，一般從分界日或 2017-05-15 開始即可。
// 資料量大時 60 秒內做不完 → 會回傳 { partial:true, nextFrom }，再用該日期當 from 呼叫一次即可續抓。
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { fetchTaifexRange } from './taifex-daily-sync.js';

if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SA)) });
const db = getFirestore();
export const config = { maxDuration: 60 };

const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default async function handler(req, res) {
  if ((req.query.key || '') !== process.env.CRON_SECRET) return res.status(401).json({ error: 'bad key' });
  const fromStr = (req.query.from || '').replace(/\//g, '-');
  const from = new Date(fromStr + 'T00:00:00Z');
  if (!fromStr || isNaN(from)) return res.status(400).json({ error: 'need from=YYYY-MM-DD' });

  const end = new Date();
  const cur = new Date(from);
  const t0 = Date.now();
  let written = 0, segs = 0;
  try {
    while (cur < end) {
      const segEnd = new Date(Math.min(cur.getTime() + 28 * 86400000, end.getTime()));
      const bars = await fetchTaifexRange(cur, segEnd);
      for (let i = 0; i < bars.length; i += 450) {
        const batch = db.batch();
        bars.slice(i, i + 450).forEach(b => batch.set(db.doc(`taifex_daily/${b.dateKey}`), b, { merge: true }));
        await batch.commit();
      }
      written += bars.length; segs++;
      cur.setTime(segEnd.getTime() + 86400000);
      if (Date.now() - t0 > 45000 && cur < end) {   // 快超時 → 回報續抓點
        return res.status(200).json({ ok: true, partial: true, nextFrom: fmt(cur), written, segs, note: '再用 from=nextFrom 呼叫一次繼續' });
      }
    }
    return res.status(200).json({ ok: true, done: true, from: fromStr, written, segs });
  } catch (e) {
    return res.status(502).json({ error: e.message, writtenSoFar: written, retryFrom: fmt(cur) });
  }
}
