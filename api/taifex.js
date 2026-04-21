// 台股加權指數即時行情 proxy（台指期追蹤標的）
// /api/taifex?type=quote  → 即時報價（TWSE 真實即時，無延遲）
// /api/taifex?type=bars   → 近日 1 分 K 線歷史（Yahoo）

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const type = (req.query.type || 'quote').toString();

  try {
    if (type === 'bars') {
      const result = await fetchBars();
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
      res.status(200).json(result);
      return;
    }
    const result = await fetchQuote();
    res.setHeader('Cache-Control', 's-maxage=3, stale-while-revalidate=15');
    res.status(200).json(result);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}

// TWSE 即時加權指數（無延遲，盤中每 5 秒更新）
async function fetchTwseQuote() {
  const url = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_t00.tw&json=1&delay=0&_=' + Date.now();
  const resp = await fetch(url, {
    headers: {
      'Referer': 'https://mis.twse.com.tw/stock/fibest.jsp?stock=t00',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    }
  });
  if (!resp.ok) throw new Error(`TWSE ${resp.status}`);
  const json = await resp.json();
  const q = json?.msgArray?.[0];
  if (!q) throw new Error('TWSE empty');

  const num = v => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const price = num(q.z) ?? num(q.l) ?? num(q.y);
  if (price == null) throw new Error('TWSE no price');

  const prevClose = num(q.y) ?? price;
  const open = num(q.o) ?? price;
  const high = num(q.h) ?? price;
  const low = num(q.l) ?? price;
  const change = price - prevClose;
  const changePct = prevClose ? (change / prevClose) * 100 : 0;
  const tlong = parseInt(q.tlong);
  const timestamp = Number.isFinite(tlong) ? Math.floor(tlong / 1000) : Math.floor(Date.now() / 1000);

  return {
    source: 'twse-realtime',
    symbol: 't00',
    name: '加權指數（即時）',
    price,
    open,
    high,
    low,
    prevClose,
    change,
    changePct,
    volume: parseInt(q.v) || 0,
    timestamp,
    rawTime: q.t || null
  };
}

// 備援：Yahoo ^TWII（15 分鐘延遲）
async function fetchYahooQuote() {
  const resp = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/^TWII?interval=1m&range=1d', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!resp.ok) throw new Error(`Yahoo ${resp.status}`);
  const data = await resp.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('Yahoo empty');
  const meta = result.meta;
  const q = result.indicators?.quote?.[0] || {};
  const closes = q.close || [];
  let lastIdx = closes.length - 1;
  while (lastIdx > 0 && closes[lastIdx] == null) lastIdx--;
  const price = meta.regularMarketPrice ?? closes[lastIdx] ?? 0;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
  return {
    source: 'yahoo-twii',
    symbol: '^TWII',
    name: '台股加權指數（Yahoo 備援，約 15 分鐘延遲）',
    price,
    open: meta.regularMarketOpen ?? price,
    high: meta.regularMarketDayHigh ?? price,
    low: meta.regularMarketDayLow ?? price,
    prevClose,
    change: price - prevClose,
    changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
    volume: meta.regularMarketVolume || 0,
    timestamp: meta.regularMarketTime || Math.floor(Date.now() / 1000),
    rawTime: null
  };
}

async function fetchQuote() {
  try { return await fetchTwseQuote(); }
  catch (e) { console.log('TWSE quote failed:', e.message); }
  return await fetchYahooQuote();
}

// 1 分 K 歷史：Yahoo ^TWII 5 日資料
async function fetchYahooBars() {
  const resp = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/^TWII?interval=1m&range=5d', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!resp.ok) throw new Error(`Yahoo ${resp.status}`);
  const data = await resp.json();
  const result = data.chart?.result?.[0];
  if (!result) throw new Error('Yahoo empty');
  const times = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const bars = [];
  for (let i = 0; i < times.length; i++) {
    if (q.close?.[i] == null) continue;
    bars.push({
      time: times[i],
      open: q.open[i] ?? q.close[i],
      high: q.high[i] ?? q.close[i],
      low: q.low[i] ?? q.close[i],
      close: q.close[i],
      volume: q.volume?.[i] || 0
    });
  }
  return bars;
}

async function fetchBars() {
  const bars = await fetchYahooBars();
  return { source: 'yahoo-twii', symbol: '^TWII', bars };
}
