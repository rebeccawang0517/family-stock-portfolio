// 期交所歷史日 K 自動抓取 proxy
// /api/taifex-history?from=YYYYMMDD&to=YYYYMMDD
// 從期交所「期貨每日交易行情」CSV 下載端點抓 TX 主力合約日 K
// 回傳：{ bars: [{time, open, high, low, close, volume}], from, to, count }

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

  // 期交所「歷史每日行情」表單下載端點
  // POST 表單：queryStartDate, queryEndDate, commodity_id, MarketCode, doQuery
  const url = 'https://www.taifex.com.tw/cht/3/futDataDown';
  const body = new URLSearchParams({
    queryStartDate: fromDate,
    queryEndDate: toDate,
    commodity_id: 'TX',
    MarketCode: '0', // 0=一般、1=盤後（合約上一日結算後到下日早上，避免重複）
    commodity_idt: 'TX',
    doQuery: '1'
  }).toString();

  let csvText;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Accept': 'text/csv,text/html,*/*',
        'Accept-Language': 'zh-TW,zh;q=0.9'
      },
      body
    });
    if (!resp.ok) throw new Error(`TAIFEX ${resp.status}`);
    // 期交所 CSV 是 Big5 編碼，需以 buffer 取再轉 UTF-8
    const buf = await resp.arrayBuffer();
    csvText = decodeBig5(buf);
  } catch (e) {
    return res.status(502).json({ error: 'TAIFEX fetch failed: ' + e.message });
  }

  // 解析 CSV
  let bars;
  try {
    bars = parseTaifexHistoryCsv(csvText);
  } catch (e) {
    return res.status(500).json({ error: 'CSV parse failed: ' + e.message, preview: csvText.slice(0, 500) });
  }

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  res.status(200).json({ bars, from: fromStr, to: toStr, count: bars.length });
}

// 簡易 Big5 解碼：Vercel Node 不支援 'big5' encoding label，用查表
// 為避免巨大查表表格，這裡只處理 ASCII + 數字 + 中文常見字（足以解析表頭與數值）
function decodeBig5(buf) {
  // Node 18+ 的 Buffer 不直接支援 big5，但用第三方 library 又無 npm
  // 解決方案：因為 CSV 內容主要是數字+逗號+少量 ASCII 標點，header 中文我們用「位置」非「文字」識別
  // 直接用 latin1（每 byte 一字）保留原始 byte 序列；後續解析只看數字和逗號
  return Buffer.from(buf).toString('latin1');
}

// 解析期交所「每日行情」CSV
// 因為內容是 Big5 但 latin1 解碼，header 會是亂碼。我們改用「欄位數量」與「典型內容模式」識別
// 每行典型格式：交易日期,契約,到期月份,開盤,最高,最低,收盤,漲跌,...,成交量,...
function parseTaifexHistoryCsv(text) {
  const lines = text.split(/\r?\n/);
  const bars = [];
  // 每日可能有多個合約，挑成交量最大者當主力
  const dateBuckets = {};

  for (let i = 1; i < lines.length; i++) { // 跳 header
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 10) continue;
    // 期望欄位序：[0]日期 [1]契約代號 [2]到期月份 [3]開 [4]高 [5]低 [6]收 [7]漲跌 [8]漲跌% [9]成交量
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
    const time = Math.floor(Date.UTC(y, m - 1, d, 0, 45) / 1000); // 用日盤開盤時間做 K 線時間（UTC）
    if (!dateBuckets[dateStr]) dateBuckets[dateStr] = [];
    dateBuckets[dateStr].push({ time, open, high, low, close, volume, expiry });
  }

  for (const date in dateBuckets) {
    const rows = dateBuckets[date].sort((a, b) => b.volume - a.volume);
    const main = rows[0];
    bars.push({ time: main.time, open: main.open, high: main.high, low: main.low, close: main.close, volume: main.volume });
  }
  bars.sort((a, b) => a.time - b.time);
  return bars;
}
