// 台指期近月即時行情 proxy
// /api/taifex?type=quote  → 當前報價快照
// /api/taifex?type=bars   → 近日 1 分 K 線歷史

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

// 抓 TAIFEX MIS 即時報價（近月 TXF）
async function fetchTaifexQuote() {
  const url = 'https://mis.taifex.com.tw/futures/api/getQuoteListV1/';
  const body = new URLSearchParams({
    MarketType: '0',
    SymbolType: 'F',
    KindID: '1',
    CID: 'TXF',
    ExpireMonth: '',
    RowSize: '全部',
    PageNum: '1'
  }).toString();

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://mis.taifex.com.tw/futures/',
      'Origin': 'https://mis.taifex.com.tw',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    },
    body
  });
  if (!resp.ok) throw new Error(`TAIFEX ${resp.status}`);
  const json = await resp.json();
  const rows = json?.RtData?.QuoteList || json?.RtData?.Quote || [];
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('TAIFEX empty');

  // 第一筆通常就是近月
  const q = rows[0];
  const num = v => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const price = num(q.CLastPrice) ?? num(q.CLastTradePrice) ?? num(q.CRefPrice);
  if (price == null) throw new Error('TAIFEX no price');

  return {
    source: 'taifex',
    symbol: q.SymbolID || q.CommodityID || 'TXF',
    name: q.DispCName || q.DispEName || '台指期近月',
    price,
    open: num(q.COpenPrice) ?? price,
    high: num(q.CHighPrice) ?? price,
    low: num(q.CLowPrice) ?? price,
    prevClose: num(q.CRefPrice) ?? price,
    change: num(q.CDiff) ?? 0,
    changePct: num(q.CDiffPct) ?? 0,
    volume: parseInt(q.CTotalVolume) || 0,
    timestamp: Math.floor(Date.now() / 1000),
    rawTime: q.CTime || q.CDate || null
  };
}

// 備援：Yahoo ^TWII（15 分鐘延遲的加權指數）
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
  const price = Math.round(meta.regularMarketPrice ?? closes[lastIdx] ?? 0);
  return {
    source: 'yahoo-twii',
    symbol: '^TWII',
    name: '台股加權指數（Yahoo 備援，約 15 分鐘延遲）',
    price,
    open: Math.round(meta.regularMarketOpen ?? price),
    high: Math.round(meta.regularMarketDayHigh ?? price),
    low: Math.round(meta.regularMarketDayLow ?? price),
    prevClose: Math.round(meta.chartPreviousClose ?? meta.previousClose ?? price),
    change: Math.round((meta.regularMarketPrice ?? price) - (meta.chartPreviousClose ?? price)),
    changePct: 0,
    volume: meta.regularMarketVolume || 0,
    timestamp: meta.regularMarketTime || Math.floor(Date.now() / 1000),
    rawTime: null
  };
}

async function fetchQuote() {
  try { return await fetchTaifexQuote(); }
  catch (e) { console.log('TAIFEX quote failed:', e.message); }
  return await fetchYahooQuote();
}

// 1 分 K 歷史：嘗試 TAIFEX 圖表資料，失敗退 Yahoo
async function fetchTaifexBars(symbol) {
  const url = 'https://mis.taifex.com.tw/futures/api/getChartData1m/';
  const body = new URLSearchParams({ symbol }).toString();
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://mis.taifex.com.tw/futures/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body
  });
  if (!resp.ok) throw new Error(`TAIFEX bars ${resp.status}`);
  const json = await resp.json();
  const raw = json?.RtData?.Quote || json?.data || json?.RtData?.QuoteList || [];
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('TAIFEX bars empty');

  const bars = [];
  for (const r of raw) {
    const close = parseFloat(r.Close ?? r.close ?? r.CLastPrice);
    if (!Number.isFinite(close)) continue;
    bars.push({
      time: parseTime(r.DateTime || r.Time || r.time || r.CDate),
      open: parseFloat(r.Open ?? r.open ?? close),
      high: parseFloat(r.High ?? r.high ?? close),
      low: parseFloat(r.Low ?? r.low ?? close),
      close,
      volume: parseInt(r.Volume ?? r.volume) || 0
    });
  }
  return bars;
}

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
      open: Math.round(q.open[i]),
      high: Math.round(q.high[i] ?? q.close[i]),
      low: Math.round(q.low[i] ?? q.close[i]),
      close: Math.round(q.close[i]),
      volume: q.volume?.[i] || 0
    });
  }
  return bars;
}

async function fetchBars() {
  // 先取得近月代號
  let symbol = null;
  try {
    const q = await fetchTaifexQuote();
    symbol = q.symbol;
  } catch (e) {}

  if (symbol) {
    try {
      const bars = await fetchTaifexBars(symbol);
      if (bars.length > 0) return { source: 'taifex', symbol, bars };
    } catch (e) { console.log('TAIFEX bars failed:', e.message); }
  }

  const bars = await fetchYahooBars();
  return { source: 'yahoo-twii', symbol: '^TWII', bars };
}

function parseTime(t) {
  if (!t) return Math.floor(Date.now() / 1000);
  if (typeof t === 'number') return t > 1e12 ? Math.floor(t / 1000) : t;
  // 格式可能："20240101 13:45:00" 或 ISO 字串
  const s = String(t).trim();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    // 台北時區 UTC+8
    const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+08:00`;
    return Math.floor(new Date(iso).getTime() / 1000);
  }
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? Math.floor(d.getTime() / 1000) : Math.floor(Date.now() / 1000);
}
