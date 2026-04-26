// 期交所保證金頁面爬蟲（指數型期貨）
// /api/taifex-margin
// 回傳：{ updatedAt, items: [{ product, original, maintenance, settlement }] }
//
// 來源：https://www.taifex.com.tw/cht/5/indexMarging
// 期交所頁面是 HTML 表格，這邊用簡單 regex 抓主要列（大台/小台/微台）

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const resp = await fetch('https://www.taifex.com.tw/cht/5/indexMarging', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept-Language': 'zh-TW,zh;q=0.9'
      }
    });
    if (!resp.ok) throw new Error('TAIFEX ' + resp.status);
    const buf = await resp.arrayBuffer();
    // Big5 → 用 latin1 byte-by-byte 保留位元組（我們只需要 ASCII 數字 + 商品代號 TX/MTX/MX）
    const html = Buffer.from(buf).toString('latin1');

    // 抓更新日期（頁面有「資料更新日期」字樣，但 Big5 無法直接 match）
    // 改抓 yyyy/mm/dd 模式
    const dateMatch = html.match(/(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/);
    const updatedAt = dateMatch ? dateMatch[1] : null;

    // 期交所表格列每一行用 <tr>...</tr>，每格 <td>...</td>
    // 商品代號是 ASCII，可以直接 match
    const items = [];
    const productCodes = ['TX', 'MTX', 'MXF', 'TMF']; // 主要監控的指數型期貨
    const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
    for (const tr of trMatches) {
      // 抓 td 內容
      const tds = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || []).map(t =>
        t.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
      );
      if (tds.length < 4) continue;
      // 期交所表格通常 [契約代號 / 結算 / 維持 / 原始]
      const code = tds[0];
      // 找出契約代號（ASCII，含字母+可能空格）
      const cleanCode = code.replace(/[^A-Z0-9]/g, '');
      if (!productCodes.includes(cleanCode)) continue;
      // 解析三個保證金（最後三個數字欄位）
      const nums = tds.slice(1).map(t => parseInt(t.replace(/,/g, ''))).filter(n => Number.isFinite(n) && n > 0);
      if (nums.length < 3) continue;
      // 期交所順序：[結算, 維持, 原始]
      const [settlement, maintenance, original] = nums;
      items.push({ product: cleanCode, settlement, maintenance, original });
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400'); // 1 小時快取
    res.status(200).json({ updatedAt, items, count: items.length });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
