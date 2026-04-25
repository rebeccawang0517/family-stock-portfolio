// 期交所歷史日 K 自動抓取
// /api/taifex-history?from=YYYYMMDD&to=YYYYMMDD
//
// 改用 TAIFEX 官方表單下載端點（直接回 CSV、不需 ZIP）
//   POST https://www.taifex.com.tw/cht/3/futDataDown
// 一次可拿一段日期範圍的 TX 主力合約日 K

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const fromStr = String(req.query.from || '').replace(/-/g, '');
  const toStr = String(req.query.to || '').replace(/-/g, '');
  if (!/^\d{8}$/.test(fromStr) || !/^\d{8}$/.test(toStr)) {
    return res.status(400).json({ error: 'from and to required, format YYYYMMDD' });
  }

  const fromDate = `${fromStr.slice(0,4)}/${fromStr.slice(4,6)}/${fromStr.slice(6,8)}`;
  const toDate = `${toStr.slice(0,4)}/${toStr.slice(4,6)}/${toStr.slice(6,8)}`;

  // 嘗試多個 TAIFEX URL pattern
  const attempts = [
    {
      name: 'futDataDown',
      url: 'https://www.taifex.com.tw/cht/3/futDataDown',
      body: new URLSearchParams({
        queryStartDate: fromDate, queryEndDate: toDate,
        commodity_id: 'TX', commodity_idt: 'TX',
        MarketCode: '0', doQuery: '1'
      }).toString()
    },
    {
      name: 'futAndOptDailyMarketReport',
      url: 'https://www.taifex.com.tw/cht/3/futAndOptDailyMarketReport',
      body: new URLSearchParams({
        queryStartDate: fromDate, queryEndDate: toDate,
        commodity_id: 'TX', MarketCode: '0', doQuery: '1'
      }).toString()
    },
    {
      name: 'dlFutDataDown',
      url: 'https://www.taifex.com.tw/cht/3/dlFutDataDown',
      body: new URLSearchParams({
        queryStartDate: fromDate, queryEndDate: toDate,
        commodity_id: 'TX', commodity_idt: 'TX',
        MarketCode: '0', doQuery: '1'
      }).toString()
    }
  ];

  const diag = [];
  let csvText = null, usedEndpoint = null;
  for (const att of attempts) {
    try {
      const resp = await fetch(att.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
          'Accept': 'text/csv,text/html,*/*',
          'Accept-Language': 'zh-TW,zh;q=0.9',
          'Referer': 'https://www.taifex.com.tw/cht/3/futAndOptDailyMarketReport'
        },
        body: att.body
      });
      const ctype = resp.headers.get('content-type') || '';
      if (!resp.ok) {
        diag.push({ ep: att.name, status: resp.status, ctype });
        continue;
      }
      const buf = await resp.arrayBuffer();
      const text = Buffer.from(buf).toString('latin1');
      const sniff = text.slice(0, 80).replace(/\r?\n/g, '\\n');
      // 確認看起來是 CSV（含逗號 + 數字 + 'TX'）
      const looksLikeCsv = text.includes('TX') && text.includes(',') && /\d{4}/.test(text);
      if (!looksLikeCsv) {
        diag.push({ ep: att.name, status: resp.status, ctype, size: buf.byteLength, sniff });
        continue;
      }
      csvText = text;
      usedEndpoint = att.name;
      diag.push({ ep: att.name, status: resp.status, ctype, size: buf.byteLength, ok: true });
      break;
    } catch (e) {
      diag.push({ ep: att.name, error: e.message.slice(0, 100) });
    }
  }

  if (!csvText) {
    return res.status(502).json({ error: 'all TAIFEX endpoints failed', diag });
  }

  let bars;
  try {
    bars = parseTaifexHistoryCsv(csvText);
  } catch (e) {
    return res.status(500).json({ error: 'CSV parse failed: ' + e.message, diag, preview: csvText.slice(0, 300) });
  }

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  res.status(200).json({
    bars, from: fromStr, to: toStr, count: bars.length,
    days_fetched: bars.length,
    days_attempted: bars.length,
    days_skipped: 0,
    endpoint: usedEndpoint,
    failureSamples: diag.filter(d => !d.ok)
  });
}

// 期交所每日行情 CSV 解析；一日可能多合約，挑成交量最大者當主力
function parseTaifexHistoryCsv(text) {
  const lines = text.split(/\r?\n/);
  const dateBuckets = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 10) continue;
    // 期望：[0]日期 [1]契約 [2]到期月份 [3]開 [4]高 [5]低 [6]收 [7]漲跌 [8]漲跌% [9]量
    const dateStr = cols[0];
    const contract = cols[1];
    const expiry = cols[2];
    if (contract !== 'TX') continue;
    if (!expiry || expiry.includes('/')) continue;
    if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) continue;
    const open = parseFloat(cols[3]);
    const high = parseFloat(cols[4]);
    const low = parseFloat(cols[5]);
    const close = parseFloat(cols[6]);
    const volume = parseInt(cols[9]) || 0;
    if (![open, high, low, close].every(x => Number.isFinite(x) && x > 0)) continue;
    const [y, m, d] = dateStr.split('/').map(s => parseInt(s));
    const time = Math.floor(Date.UTC(y, m - 1, d, 0, 45) / 1000);
    if (!dateBuckets[dateStr]) dateBuckets[dateStr] = [];
    dateBuckets[dateStr].push({ time, open, high, low, close, volume, expiry });
  }

  const bars = [];
  for (const date in dateBuckets) {
    const rows = dateBuckets[date].sort((a, b) => b.volume - a.volume);
    const main = rows[0];
    bars.push({ time: main.time, open: main.open, high: main.high, low: main.low, close: main.close, volume: main.volume });
  }
  bars.sort((a, b) => a.time - b.time);
  return bars;
}
