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

// 期交所 CSV：每日每合約有「一般」(日盤 08:45-13:45) 與「盤後」(夜盤，前一日15:00→當日05:00，交易日掛在次一營業日) 兩列。
// 全時段日K：同一交易日「盤後(夜盤)＋一般(日盤)」合併＝開盤用夜盤開、收盤用日盤收、高低取兩盤極值、量相加。
// 主力合約以「日盤成交量最大」認定，夜盤用同一個合約的盤後列（避免跨合約假跳動，如 2025/04/08 股災日）。
export function parseTaifexCsv(text) {
  const lines = text.split(/\r?\n/);
  const byDate = {};   // date -> { day:{contract->row}, night:{contract->row} }
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
    const isDay = session.includes('一般'), isNight = session.includes('盤後');
    if (!isDay && !isNight) continue;                          // 無法辨識時段的列略過
    const rec = byDate[cols[0]] || (byDate[cols[0]] = { day: {}, night: {} });
    (isDay ? rec.day : rec.night)[cols[2]] = { contract: cols[2], o, h, l, c, v };
  }
  const pickMain = obj => { let best = null; for (const k in obj) if (!best || obj[k].v > best.v) best = obj[k]; return best; };
  return Object.entries(byDate).map(([dateStr, rec]) => {
    const day = pickMain(rec.day);
    // 夜盤優先用「日盤主力合約」的盤後列；日盤缺漏才退回夜盤自己的量最大合約
    let night = day && rec.night[day.contract] ? rec.night[day.contract] : pickMain(rec.night);
    let open, high, low, close, vol, sess;
    if (day && night) { open = night.o; close = day.c; high = Math.max(day.h, night.h); low = Math.min(day.l, night.l); vol = day.v + night.v; sess = 'full'; }
    else if (day) { open = day.o; high = day.h; low = day.l; close = day.c; vol = day.v; sess = 'day'; }
    else if (night) { open = night.o; high = night.h; low = night.l; close = night.c; vol = night.v; sess = 'night'; }
    else return null;
    const [y, m, d] = dateStr.split('/').map(Number);
    return {
      dateKey: `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`,
      date: `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`,
      time: Math.floor(Date.UTC(y, m - 1, d, 0, 45) / 1000),
      open, high, low, close, volume: vol,
      session: sess
    };
  }).filter(Boolean).sort((a, b) => a.time - b.time);
}
