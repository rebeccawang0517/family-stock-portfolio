// 期交所歷史日 K 自動抓取
// /api/taifex-history?from=YYYYMMDD&to=YYYYMMDD
//
// 策略：直連期交所每日 ZIP（URL 模式穩定多年）
//   https://www.taifex.com.tw/file/taifex/Dailydownload/DailydownloadCSV/Daily_YYYY_MM_DD.zip
// 每個 ZIP 內含當日所有期貨契約的 CSV
// 平行抓多日（concurrency 限制避免被擋），每日挑 TX 成交量最大合約當主力
// 回傳：{ bars: [{time, open, high, low, close, volume}], from, to, count, days_fetched, days_skipped }

import JSZip from 'jszip';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const fromStr = String(req.query.from || '').replace(/-/g, '');
  const toStr = String(req.query.to || '').replace(/-/g, '');
  if (!/^\d{8}$/.test(fromStr) || !/^\d{8}$/.test(toStr)) {
    return res.status(400).json({ error: 'from and to required, format YYYYMMDD' });
  }

  const fromDate = parseYmd(fromStr);
  const toDate = parseYmd(toStr);
  if (!fromDate || !toDate || fromDate > toDate) {
    return res.status(400).json({ error: 'invalid date range' });
  }

  // 建日期清單，跳週末（期交所收盤日不抓 ZIP）
  const dates = [];
  const cur = new Date(fromDate);
  while (cur <= toDate) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(formatYmdParts(cur));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  if (!dates.length) return res.status(200).json({ bars: [], from: fromStr, to: toStr, count: 0 });

  // 平行抓 ZIP，每批 10 個避免被擋
  const concurrency = 10;
  const results = [];
  let okCount = 0, missCount = 0;
  for (let i = 0; i < dates.length; i += concurrency) {
    const batch = dates.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(d => fetchOneDay(d.y, d.m, d.d)));
    for (let j = 0; j < batch.length; j++) {
      const r = batchResults[j];
      if (r) { results.push({ ...r, dateInfo: batch[j] }); okCount++; }
      else missCount++;
    }
  }

  // 每日挑成交量最大的 TX 契約當主力
  const bars = results.map(r => ({
    time: r.time,
    open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume
  })).sort((a, b) => a.time - b.time);

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  res.status(200).json({
    bars, from: fromStr, to: toStr, count: bars.length,
    days_fetched: okCount, days_skipped: missCount
  });
}

function parseYmd(s) {
  const y = parseInt(s.slice(0, 4));
  const m = parseInt(s.slice(4, 6));
  const d = parseInt(s.slice(6, 8));
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYmdParts(d) {
  return {
    y: d.getUTCFullYear(),
    m: String(d.getUTCMonth() + 1).padStart(2, '0'),
    d: String(d.getUTCDate()).padStart(2, '0')
  };
}

async function fetchOneDay(y, m, d) {
  const url = `https://www.taifex.com.tw/file/taifex/Dailydownload/DailydownloadCSV/Daily_${y}_${m}_${d}.zip`;
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Referer': 'https://www.taifex.com.tw/'
      }
    });
    if (!resp.ok) return null; // 假日/未上架日 → 404
    const buf = await resp.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const fileName = Object.keys(zip.files).find(n => n.toLowerCase().endsWith('.csv'));
    if (!fileName) return null;
    const u8 = await zip.files[fileName].async('uint8array');
    // CSV 是 Big5；我們只需 ASCII 部分（"TX"、數字、逗號），latin1 byte-by-byte 解碼即可
    const text = Buffer.from(u8).toString('latin1');
    const main = pickTxMain(text);
    if (!main) return null;
    const time = Math.floor(Date.UTC(y, parseInt(m) - 1, parseInt(d), 0, 45) / 1000);
    return { time, ...main };
  } catch (e) {
    console.error(`fetchOneDay ${y}-${m}-${d} 失敗:`, e.message);
    return null;
  }
}

// 從每日 CSV 挑 TX 成交量最大合約當主力，回傳 OHLCV
function pickTxMain(csvText) {
  const lines = csvText.split(/\r?\n/);
  const txRows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 10) continue;
    // 期交所每日 CSV 典型欄位序：
    // 0:交易日期 1:契約 2:到期月份 3:開盤價 4:最高價 5:最低價 6:收盤價 7:漲跌價 8:漲跌% 9:成交量 ...
    const contract = cols[1];
    const expiry = cols[2];
    if (contract !== 'TX') continue;
    if (!expiry || expiry.includes('/')) continue; // 跳價差
    const open = parseFloat(cols[3]);
    const high = parseFloat(cols[4]);
    const low = parseFloat(cols[5]);
    const close = parseFloat(cols[6]);
    const volume = parseInt(cols[9]) || 0;
    if (![open, high, low, close].every(x => Number.isFinite(x) && x > 0)) continue;
    txRows.push({ open, high, low, close, volume, expiry });
  }
  if (!txRows.length) return null;
  // 挑成交量最大者當主力
  txRows.sort((a, b) => b.volume - a.volume);
  return txRows[0];
}
