// 台指期近一行情 proxy
// /api/taifex?type=quote  → 即時 TXF 報價（Yahoo TW scrape，盤中 ~5 秒延遲）
// /api/taifex?type=bars   → 近日 1 分 K 線（Yahoo ^TWII + TXF-TAIEX 價差 offset）

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

// 從 Yahoo TW /future/WTX& SSR HTML 抓 JSON 取得真實台指期報價
async function fetchYahooTwFuture() {
  const url = 'https://tw.stock.yahoo.com/future/WTX%26?_=' + Date.now();
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });
  if (!resp.ok) throw new Error(`Yahoo TW ${resp.status}`);
  const html = await resp.text();

  const startMarker = '"quote":{"data":{';
  const idx = html.indexOf(startMarker);
  if (idx < 0) throw new Error('Yahoo TW marker missing');
  const s = idx + startMarker.length - 1;
  let depth = 0, end = s;
  for (let i = s; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const d = JSON.parse(html.slice(s, end + 1));
  const num = v => {
    if (v == null) return null;
    const n = parseFloat(typeof v === 'object' ? v.raw : v);
    return Number.isFinite(n) ? n : null;
  };
  const price = num(d.price);
  if (price == null) throw new Error('Yahoo TW no price');
  const prevClose = num(d.regularMarketPreviousClose) ?? price;
  const timestamp = d.regularMarketTime
    ? Math.floor(new Date(d.regularMarketTime).getTime() / 1000)
    : Math.floor(Date.now() / 1000);

  return {
    source: 'yahoo-tw-txf',
    symbol: d.symbol || 'WTX&',
    name: d.symbolName || '台指期近一',
    price,
    open: num(d.regularMarketOpen) ?? price,
    high: num(d.regularMarketDayHigh) ?? price,
    low: num(d.regularMarketDayLow) ?? price,
    prevClose,
    change: num(d.change) ?? (price - prevClose),
    changePct: parseFloat(String(d.changePercent || '').replace('%', '')) || 0,
    volume: parseInt(d.volume) || 0,
    timestamp,
    rawTime: d.regularMarketTime || null,
    bid: num(d.bid),
    ask: num(d.ask),
    marketStatus: d.marketStatus || null
  };
}

// 備援 1：TWSE 即時加權指數（無延遲但不是期貨）
async function fetchTwseQuote() {
  const url = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_t00.tw&json=1&delay=0&_=' + Date.now();
  const resp = await fetch(url, {
    headers: {
      'Referer': 'https://mis.twse.com.tw/stock/fibest.jsp?stock=t00',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  if (!resp.ok) throw new Error(`TWSE ${resp.status}`);
  const json = await resp.json();
  const q = json?.msgArray?.[0];
  if (!q) throw new Error('TWSE empty');
  const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
  const price = num(q.z) ?? num(q.l) ?? num(q.y);
  if (price == null) throw new Error('TWSE no price');
  const prevClose = num(q.y) ?? price;
  const tlong = parseInt(q.tlong);
  return {
    source: 'twse-realtime',
    symbol: 't00',
    name: '加權指數（即時）',
    price, open: num(q.o) ?? price, high: num(q.h) ?? price, low: num(q.l) ?? price,
    prevClose, change: price - prevClose,
    changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
    volume: parseInt(q.v) || 0,
    timestamp: Number.isFinite(tlong) ? Math.floor(tlong / 1000) : Math.floor(Date.now() / 1000),
    rawTime: q.t || null
  };
}

// 備援 2：Yahoo ^TWII（約 15 分鐘延遲）
async function fetchYahooTwiiQuote() {
  const resp = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/^TWII?interval=1m&range=1d', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!resp.ok) throw new Error(`Yahoo ^TWII ${resp.status}`);
  const data = await resp.json();
  const r = data.chart?.result?.[0];
  if (!r) throw new Error('Yahoo ^TWII empty');
  const meta = r.meta;
  const price = meta.regularMarketPrice ?? 0;
  const prevClose = meta.chartPreviousClose ?? price;
  return {
    source: 'yahoo-twii',
    symbol: '^TWII',
    name: '台股加權指數（延遲）',
    price, open: meta.regularMarketOpen ?? price,
    high: meta.regularMarketDayHigh ?? price,
    low: meta.regularMarketDayLow ?? price,
    prevClose, change: price - prevClose,
    changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
    volume: meta.regularMarketVolume || 0,
    timestamp: meta.regularMarketTime || Math.floor(Date.now() / 1000),
    rawTime: null
  };
}

async function fetchQuote() {
  try { return await fetchYahooTwFuture(); }
  catch (e) { console.log('Yahoo TW TXF failed:', e.message); }
  try { return await fetchTwseQuote(); }
  catch (e) { console.log('TWSE failed:', e.message); }
  return await fetchYahooTwiiQuote();
}

// Yahoo ^TWII 5 日 1 分 K，再套用當前 TXF-TAIEX 價差 offset
async function fetchYahooBars() {
  const resp = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/^TWII?interval=1m&range=5d', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!resp.ok) throw new Error(`Yahoo ^TWII bars ${resp.status}`);
  const data = await resp.json();
  const r = data.chart?.result?.[0];
  if (!r) throw new Error('Yahoo ^TWII bars empty');
  const times = r.timestamp || [];
  const q = r.indicators?.quote?.[0] || {};
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

  // 計算當前 TXF 與 TAIEX 價差，套用到歷史 bars 讓圖表對齊台指期尺度
  let offset = 0;
  let source = 'yahoo-twii';
  try {
    const [txf, taiex] = await Promise.all([fetchYahooTwFuture(), fetchTwseQuote()]);
    if (Number.isFinite(txf.price) && Number.isFinite(taiex.price)) {
      offset = txf.price - taiex.price;
      source = 'yahoo-twii+txf-offset';
    }
  } catch (e) { console.log('offset calc failed:', e.message); }

  if (offset !== 0) {
    for (const b of bars) {
      b.open += offset; b.high += offset; b.low += offset; b.close += offset;
    }
  }

  return { source, symbol: 'WTX&', offset, bars };
}
