/* ===== 夏普值分頁 =====
 * 讀 window.stocks（Firestore 持股）→ /api/stock 抓 Yahoo 日K → 逐檔算 年化報酬/年化波動/最大回撤/夏普值
 * 另算「整體組合」夏普：各檔日報酬按目前市值(TWD)加權合成組合日報酬再算，分散效果會直接反映在數字上
 */
(function () {
  const histCache = {};            // `${yahooSymbol}_${range}` → {dates:[], closes:[]}
  let lastKey = '';                // 上次計算的參數簽名（range|rf|持股簽名），一樣就不重抓

  function yahooSym(s) {
    if (s.region === '台股') return (s.symbol.startsWith('00') && s.symbol.includes('B')) ? s.symbol + '.TWO' : s.symbol + '.TW';
    return s.symbol;               // 美股直接用代號
  }

  async function fetchHist(sym, range) {
    const k = sym + '_' + range;
    if (histCache[k]) return histCache[k];
    const r = await fetch('/api/stock?symbol=' + encodeURIComponent(sym) + '&interval=1d&range=' + range);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    const res = d.chart && d.chart.result && d.chart.result[0];
    if (!res || !res.timestamp) throw new Error('無資料');
    const ts = res.timestamp, cl = (res.indicators && res.indicators.quote && res.indicators.quote[0].close) || [];
    const dates = [], closes = [];
    for (let i = 0; i < ts.length; i++) {
      if (cl[i] != null && isFinite(cl[i]) && cl[i] > 0) { dates.push(new Date(ts[i] * 1000).toISOString().slice(0, 10)); closes.push(cl[i]); }
    }
    if (closes.length < 30) throw new Error('資料不足(' + closes.length + '根)');
    return (histCache[k] = { dates, closes });
  }

  // 由收盤序列算指標：年化報酬(CAGR)、年化波動(日報酬標準差×√252)、最大回撤、夏普
  function calcStats(closes, rf) {
    const rets = [];
    for (let i = 1; i < closes.length; i++) rets.push(closes[i] / closes[i - 1] - 1);
    const n = rets.length;
    const mean = rets.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1));
    const annVol = sd * Math.sqrt(252);
    const annRet = Math.pow(closes[closes.length - 1] / closes[0], 252 / n) - 1;
    let pk = closes[0], mdd = 0;
    for (const c of closes) { if (c > pk) pk = c; const dd = (pk - c) / pk; if (dd > mdd) mdd = dd; }
    return { annRet, annVol, mdd, sharpe: annVol > 0 ? (annRet - rf) / annVol : 0, n };
  }

  function grade(s) {
    if (s >= 2) return ['很好', '#4aad6e'];
    if (s >= 1) return ['好', '#57b877'];
    if (s >= 0.5) return ['可', '#e0a14a'];
    if (s >= 0) return ['弱', '#c8b89a'];
    return ['差', '#e8675a'];
  }
  const pct = v => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
  const money = v => '$' + Math.round(v).toLocaleString('en-US');

  window.sharpeRender = async function (force) {
    const status = document.getElementById('sh-status'), tbl = document.getElementById('sh-tbl'),
          portBox = document.getElementById('sh-port');
    if (!status) return;
    const stocks = window.stocks || [];
    if (!stocks.length) { status.textContent = '尚無持股資料（請先等持股載入，或到「持股明細」新增）'; return; }

    const range = document.getElementById('sh-range').value;
    const rf = (parseFloat(document.getElementById('sh-rf').value) || 0) / 100;
    const fx = window.exchangeRate || 32;

    // 同一檔多持有人/平台 → 合併成一列（市值加總）
    const bySym = {};
    stocks.forEach(s => {
      const key = s.region + '|' + s.symbol;
      const valTWD = (s.shares || 0) * (s.currentPrice || 0) * (s.region === '美股' ? fx : 1);
      if (!bySym[key]) bySym[key] = { symbol: s.symbol, region: s.region, name: s.companyName || s.symbol, valTWD: 0 };
      bySym[key].valTWD += valTWD;
    });
    const list = Object.values(bySym).filter(s => s.valTWD > 0);
    const totalVal = list.reduce((a, s) => a + s.valTWD, 0);

    const sig = range + '|' + rf + '|' + list.map(s => s.symbol + ':' + Math.round(s.valTWD)).join(',');
    if (!force && sig === lastKey) return;   // 參數沒變不重算
    lastKey = sig;

    status.innerHTML = '<span class="loading-spinner" style="margin-right:8px"></span>正在抓 ' + list.length + ' 檔歷史價格並計算…';
    tbl.innerHTML = ''; portBox.style.display = 'none';

    // 逐檔抓歷史（小併發）＋算指標
    const rows = [];
    const queue = list.slice();
    async function worker() {
      while (queue.length) {
        const s = queue.shift();
        try {
          const h = await fetchHist(yahooSym(s), range);
          const st = calcStats(h.closes, rf);
          rows.push({ ...s, ...st, dates: h.dates, closes: h.closes, err: null });
        } catch (e) { rows.push({ ...s, err: e.message }); }
        status.innerHTML = '<span class="loading-spinner" style="margin-right:8px"></span>計算中… ' + rows.length + ' / ' + list.length;
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);

    const ok = rows.filter(r => !r.err);
    // ── 整體組合夏普：取「所有檔都有報價」的共同交易日，日報酬按市值權重合成 ──
    let port = null;
    if (ok.length >= 1) {
      const retMaps = ok.map(r => { const m = {}; for (let i = 1; i < r.closes.length; i++) m[r.dates[i]] = r.closes[i] / r.closes[i - 1] - 1; return m; });
      let common = Object.keys(retMaps[0]);
      for (let i = 1; i < retMaps.length; i++) common = common.filter(d => d in retMaps[i]);
      common.sort();
      if (common.length >= 30) {
        const okVal = ok.reduce((a, r) => a + r.valTWD, 0);
        const pr = common.map(d => ok.reduce((a, r, i) => a + (r.valTWD / okVal) * retMaps[i][d], 0));
        const n = pr.length, mean = pr.reduce((a, b) => a + b, 0) / n;
        const sd = Math.sqrt(pr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1));
        const annVol = sd * Math.sqrt(252);
        const cum = pr.reduce((a, b) => a * (1 + b), 1);
        const annRet = Math.pow(cum, 252 / n) - 1;
        let eq = 1, pk = 1, mdd = 0; pr.forEach(x => { eq *= 1 + x; if (eq > pk) pk = eq; const dd = (pk - eq) / pk; if (dd > mdd) mdd = dd; });
        port = { annRet, annVol, mdd, sharpe: annVol > 0 ? (annRet - rf) / annVol : 0, days: n };
      }
    }

    // ── 渲染 ──
    if (port) {
      const [g, c] = grade(port.sharpe);
      document.getElementById('sh-port-sharpe').innerHTML = port.sharpe.toFixed(2) + ' <span style="font-size:14px;color:' + c + '">' + g + '</span>';
      document.getElementById('sh-port-ret').textContent = pct(port.annRet);
      document.getElementById('sh-port-ret').style.color = port.annRet >= 0 ? '#4aad6e' : '#e8675a';
      document.getElementById('sh-port-vol').textContent = (port.annVol * 100).toFixed(1) + '%';
      document.getElementById('sh-port-mdd').textContent = '-' + (port.mdd * 100).toFixed(1) + '%';
      portBox.style.display = '';
    }

    ok.sort((a, b) => b.sharpe - a.sharpe);
    const bad = rows.filter(r => r.err);
    let h = '<table class="w-full text-sm"><thead><tr class="text-slate-400 border-b border-slate-700">'
      + '<th class="text-left py-2 px-3">代號</th><th class="text-left py-2 px-3">名稱</th><th class="text-left py-2 px-3">區域</th>'
      + '<th class="text-right py-2 px-3">占比</th><th class="text-right py-2 px-3">年化報酬</th><th class="text-right py-2 px-3">年化波動</th>'
      + '<th class="text-right py-2 px-3">最大回撤</th><th class="text-right py-2 px-3">夏普值</th><th class="text-center py-2 px-3">評級</th></tr></thead><tbody>';
    ok.forEach(r => {
      const [g, c] = grade(r.sharpe);
      h += '<tr class="border-b border-slate-700/50 hover:bg-slate-700/30">'
        + '<td class="py-2 px-3 font-mono text-slate-200">' + r.symbol + '</td>'
        + '<td class="py-2 px-3 text-slate-300">' + r.name + '</td>'
        + '<td class="py-2 px-3 text-slate-400">' + r.region + '</td>'
        + '<td class="py-2 px-3 text-right text-slate-300">' + (r.valTWD / totalVal * 100).toFixed(1) + '%</td>'
        + '<td class="py-2 px-3 text-right" style="color:' + (r.annRet >= 0 ? '#4aad6e' : '#e8675a') + '">' + pct(r.annRet) + '</td>'
        + '<td class="py-2 px-3 text-right text-slate-300">' + (r.annVol * 100).toFixed(1) + '%</td>'
        + '<td class="py-2 px-3 text-right" style="color:#e0a14a">-' + (r.mdd * 100).toFixed(1) + '%</td>'
        + '<td class="py-2 px-3 text-right font-bold" style="color:' + c + '">' + r.sharpe.toFixed(2) + '</td>'
        + '<td class="py-2 px-3 text-center"><span style="background:' + c + '22;color:' + c + ';padding:2px 10px;border-radius:10px;font-size:12px">' + g + '</span></td></tr>';
    });
    bad.forEach(r => {
      h += '<tr class="border-b border-slate-700/50 opacity-50"><td class="py-2 px-3 font-mono">' + r.symbol + '</td>'
        + '<td class="py-2 px-3">' + r.name + '</td><td class="py-2 px-3">' + r.region + '</td>'
        + '<td class="py-2 px-3 text-right">' + (r.valTWD / totalVal * 100).toFixed(1) + '%</td>'
        + '<td colspan="5" class="py-2 px-3 text-slate-500">無法取得歷史資料（' + r.err + '）</td></tr>';
    });
    h += '</tbody></table>';
    tbl.innerHTML = h;
    status.textContent = '✓ 已計算 ' + ok.length + ' 檔' + (bad.length ? '（' + bad.length + ' 檔無資料）' : '') + '　·　持股市值合計 ' + money(totalVal) + '　·　資料來源 Yahoo Finance 日收盤';
  };
})();
