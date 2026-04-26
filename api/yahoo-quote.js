// 通用 Yahoo Finance 即時報價 proxy
// /api/yahoo-quote?symbol=2330.TW
// 回傳：{ symbol, price, timestamp }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbol = String(req.query.symbol || '').trim();
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) throw new Error(`Yahoo ${resp.status}`);
    const data = await resp.json();
    const r = data.chart?.result?.[0];
    if (!r) throw new Error('Yahoo empty');
    const meta = r.meta;
    const price = meta.regularMarketPrice;
    if (price == null) throw new Error('no price');
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    res.status(200).json({
      symbol,
      price,
      timestamp: meta.regularMarketTime || Math.floor(Date.now() / 1000),
      currency: meta.currency || 'TWD'
    });
  } catch (e) {
    res.status(502).json({ error: e.message, symbol });
  }
}
