// 台指期日 K 自動同步（Vercel Cron 每交易日收盤後執行，見 vercel.json）
// 不用開網頁：抓期交所最近 14 天 TX 主力合約日 K，upsert 進 Firestore `taifex_daily/{YYYYMMDD}`。
// 需要環境變數：CRON_SECRET、FIREBASE_SA。
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SA)) });
const db = getFirestore();

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end();

  const end = new Date();
  const start = new Date(end.getTime() - 14 * 86400000);
  try {
    const bars = await fetchTaifexRange(start, end);
    let written = 0;
    for (const b of bars) {
      await db.doc(`taifex_daily/${b.dateKey}`).set(b, { merge: true });
      written++;
    }
    return res.status(200).json({ ok: true, written, latest: bars.length ? bars[bars.length - 1].dateKey : null });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

const fmtSlash = d => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

export async function fetchTaifexRange(start, end) {
  const resp = await fetch('https://www.taifex.com.tw/cht/3/futDataDown', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Referer': 'https://www.taifex.com.tw/cht/3/futAndOptDailyMarketReport'
    },
    body: new URLSearchParams({
      down_type: '1',
      queryStartDate: fmtSlash(start), queryEndDate: fmtSlash(end),
      commodity_id: 'TX', commodity_idt: 'TX', MarketCode: '0', doQuery: '1'
    }).toString()
  });
  const buf = await resp.arrayBuffer();
  let text;
  try { text = new TextDecoder('big5').decode(buf); }        // 正確解 Big5 才能辨識「一般/盤後」欄
  catch { text = Buffer.from(buf).toString('latin1'); }
  return parseTaifexCsv(text);
}

// 期交所 CSV：每日每合約有「一般」(日盤) 與「盤後」(夜盤) 兩列。
// 固定取「一般」時段中成交量最大的合約當主力日K（時段混用會產生假跳動，如 2025/04/08 股災日）；
// 若整天沒有可辨識的「一般」列（編碼異常），才退回全列取量最大。
export function parseTaifexCsv(text) {
  const lines = text.split(/\r?\n/);
  const byDate = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = (lines[i] || '').split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 10) continue;
    if (cols[1] !== 'TX') continue;
    if (!cols[2] || cols[2].includes('/')) continue;          // 排除價差合約
    if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(cols[0])) continue;
    const [o, h, l, c] = [3, 4, 5, 6].map(j => parseFloat(cols[j]));
    const v = parseInt(cols[9]) || 0;
    if (![o, h, l, c].every(x => Number.isFinite(x) && x > 0)) continue;
    const session = cols[17] || '';                            // 交易時段：一般 / 盤後
    const isDay = session.includes('一般');
    const cand = { isDay, o, h, l, c, v, dateStr: cols[0] };
    const curBest = byDate[cols[0]];
    // 優先序：一般 > 盤後；同時段比成交量
    if (!curBest || (cand.isDay && !curBest.isDay) || (cand.isDay === curBest.isDay && v > curBest.v)) {
      byDate[cols[0]] = cand;
    }
  }
  return Object.values(byDate).map(x => {
    const [y, m, d] = x.dateStr.split('/').map(Number);
    return {
      dateKey: `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`,
      date: `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`,
      time: Math.floor(Date.UTC(y, m - 1, d, 0, 45) / 1000),
      open: x.o, high: x.h, low: x.l, close: x.c, volume: x.v,
      session: x.isDay ? 'day' : 'unknown'
    };
  }).sort((a, b) => a.time - b.time);
}
