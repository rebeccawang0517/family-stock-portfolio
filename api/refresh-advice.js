// 每週一晚（週一~週五 21:00 台北，見 vercel.json）觸發。
// 只有「①持股股價當天已更新 ＋ ②上月收入已填 ＋ 上月信用卡帳單已填」都到位才生成 AI 建議；
// 否則記錄「等待中」，隔晚再試，直到補齊當晚才生成，之後同一週不再重跑。
// 需要環境變數：CRON_SECRET、CLAUDE_API_KEY、FIREBASE_SA（Firebase 服務帳戶 JSON 字串）。
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SA)) });
const db = getFirestore();

const TZ = 'Asia/Taipei';
const inTaipei = () => new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
const isToday = ms => { const d = new Date(ms), n = inTaipei(); return d.toDateString() === n.toDateString(); };
const prevMonthKey = () => { const n = inTaipei(), d = new Date(n.getFullYear(), n.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };            // 例 "2026-06"
const weekKey = () => { const n = inTaipei(), s = new Date(n.getFullYear(), 0, 1);
  return n.getFullYear() + '-W' + Math.ceil(((n - s) / 864e5 + s.getDay() + 1) / 7); };
const fmt = v => '$' + Math.round(Number(v) || 0).toLocaleString('en-US');

// ── 主動把持股股價抓到今天（沿用前端 fetchStockInfo 的代號轉換 + Yahoo 來源）──
function apiSymbolOf(symbol, region) {
  if (region === '台股') return (symbol.startsWith('00') && symbol.includes('B')) ? symbol + '.TWO' : symbol + '.TW';
  return symbol; // 美股原樣
}
async function fetchPrice(apiSymbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(apiSymbol)}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) return null;
  const meta = (await r.json())?.chart?.result?.[0]?.meta;
  if (!meta) return null;
  const price = meta.regularMarketPrice ?? meta.previousClose;
  if (!price) return null;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
  return { price: Math.abs(price), changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0 };
}
async function refreshPrices() {
  const snap = await db.collection('stocks').get();
  const groups = new Map(); // key: apiSymbol → [docId...]
  snap.forEach(d => {
    const s = d.data();
    const key = apiSymbolOf(s.symbol, s.region);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d.id);
  });
  const keys = [...groups.keys()];
  const now = new Date().toISOString();
  for (let i = 0; i < keys.length; i += 5) {                      // 一次最多 5 檔並發
    await Promise.all(keys.slice(i, i + 5).map(async key => {
      try {
        const info = await fetchPrice(key);
        if (!info) return;
        await Promise.all(groups.get(key).map(id =>
          db.doc(`stocks/${id}`).set({ currentPrice: info.price, changePercent: info.changePercent, lastPriceUpdate: now }, { merge: true })
        ));
      } catch (e) { /* 單檔失敗略過，不擋整批 */ }
    }));
    if (i + 5 < keys.length) await new Promise(r => setTimeout(r, 400));
  }
}

// ── 前置條件 ──
async function pricesFreshToday() {
  const snap = await db.collection('stocks').get();
  let newest = 0; snap.forEach(d => { const t = Date.parse(d.data().lastPriceUpdate || 0); if (t > newest) newest = t; });
  return newest > 0 && isToday(newest);
}
async function cashflowReady(lastMonth) {
  const cf = (await db.doc('cashflow/data').get()).data() || {};
  const incomeOK = (cf.income || []).some(r => parseFloat(r.monthly?.[lastMonth]) > 0);   // 上月收入已填
  const cardsOK  = (cf.cards  || []).some(c => c.month === lastMonth && parseFloat(c.amt) > 0); // 上月信用卡已填
  return { ok: incomeOK && cardsOK, incomeOK, cardsOK };
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end();

  const ref = db.doc('advice/latest');
  const prev = (await ref.get()).data() || {};
  if (prev.weekKey === weekKey()) return res.json({ ran: false, reason: 'done-this-week' }); // 本週已生成

  const lastMonth = prevMonthKey();

  // ① 先主動把股價抓到今天（best-effort；抓不到就靠下面的 gate 等隔晚）
  try { await refreshPrices(); } catch (e) { /* ignore */ }

  const pricesOK = await pricesFreshToday();
  const cf = await cashflowReady(lastMonth);

  // 任一未就緒 → 記錄等待，明晚再試
  if (!pricesOK || !cf.ok) {
    await ref.set({ status: 'waiting', checkedAt: Date.now(), waitingFor: [
      !cf.incomeOK && `上月收入未填（${lastMonth}）`,
      !cf.cardsOK  && `上月信用卡帳單未填（${lastMonth}）`,
      !pricesOK    && '持股股價今天尚未更新',
    ].filter(Boolean) }, { merge: true });
    return res.json({ ran: false, waiting: true });
  }

  // 兩者皆就緒 → 讀前端已算好的快照
  const s = (await db.doc('dashboard/snapshot').get()).data();
  if (!s) {
    await ref.set({ status: 'waiting', checkedAt: Date.now(), waitingFor: ['尚無 dashboard/snapshot（需先開啟一次儀表板）'] }, { merge: true });
    return res.json({ ran: false, waiting: true });
  }

  // 呼叫 Claude（沿用 ai-claude.js 的 raw fetch 風格）
  const prompt =
    `你是 Rebecca、Eric 兩人家庭的私人財務顧問，風險偏好穩健偏保守。\n` +
    `根據下列數字給 4 條具體、可執行的建議（繁體中文，每條含數字），聚焦：現金配置、投資集中度、5000萬退休目標、負債管理。\n` +
    `淨資產 ${fmt(s.netWorth)}，總資產 ${fmt(s.totalAsset)}（股票 ${fmt(s.stockValue)}、固定資產 ${fmt(s.fixedAsset)}、現金 ${fmt(s.cash)}），負債 ${fmt(s.debt)}、負債比 ${(+s.debtRatio).toFixed(1)}%。\n` +
    `年收入 ${fmt(s.yearIncome)}、年支出 ${fmt(s.yearExpense)}、年結餘 ${fmt(s.yearNet)}、儲蓄率 ${(+s.savingsRate).toFixed(1)}%。5000萬目標達成 ${(+s.goalPct).toFixed(1)}%、尚差 ${fmt(s.goalRemain)}。收支資料截至 ${lastMonth}。\n` +
    `只回覆 JSON：{"advice":[{"title":"一句結論","detail":"一句說明含數字","severity":"good|warn|info|bad"}]}，不要 markdown。`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] })
  });
  const data = await r.json();
  let advice;
  try { advice = JSON.parse(data.content[0].text).advice; }
  catch { advice = [{ title: '解析失敗', detail: (data.content?.[0]?.text || JSON.stringify(data)).slice(0, 140), severity: 'warn' }]; }

  await ref.set({
    advice, status: 'ok', weekKey: weekKey(), generatedAt: Date.now(),
    dataAsOf: { holdings: new Date().toISOString(), cashflowMonth: lastMonth }
  });
  res.json({ ran: true, points: advice.length });
}
