// ===== AI 分析頁面 =====
(function(){
  'use strict';

  let _aiSelectedSymbol = null;
  let _aiSelectedRegion = null;
  let _aiInited = false;

  const ANALYSIS_CATEGORIES = [
    '產業分析','產業龍頭','財務分析','風險分析','護城河','技術分析','籌碼分析'
  ];

  // ===== 初始化 =====
  window.aiInit = async function() {
    // 確保 dashboard 資料已載入（固定資產、現金、負債）
    if (typeof dbRender === 'function' && !window.dbAssetData) {
      await dbRender();
    }
    // 確保 cashflow 資料已載入（貸款明細）
    if (typeof cfLoad === 'function' && !window.cfExpenseRef) {
      cfLoad();
    }
    aiLoadStockList();
    aiLoadAssetOverview();
    aiLoadGoalProgress();
    if (!_aiInited) aiLoadMacro();
    _aiInited = true;
  };

  // ===== 持股清單（連動持股總覽） =====
  function aiLoadStockList() {
    const stocks = window.stocks || [];
    const listEl = document.getElementById('ai-stock-list');
    const summaryEl = document.getElementById('ai-sb-summary');
    if (!listEl) return;

    let totalValue = 0;
    let html = '';
    stocks.forEach(s => {
      const price = s.currentPrice || s.avgCost || 0;
      const value = price * (s.shares || 0);
      const region = s.region || '台股';
      const isTW = region === '台股';
      const rate = window.exchangeRate || 30;
      const valueTWD = isTW ? value : value * rate;
      totalValue += valueTWD;

      const change = s.changePercent || 0;
      const pctClass = change >= 0 ? 'ai-pct-up' : 'ai-pct-down';
      const pctText = (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
      const displayVal = isTW ? '$' + Math.round(value).toLocaleString() : 'US$' + Math.round(value).toLocaleString();

      html += `<div class="ai-sb-item${_aiSelectedSymbol === s.symbol ? ' active' : ''}" onclick="aiSelectStock('${s.symbol}','${region}')">
        <div class="ai-sb-item-info"><div class="ai-sb-item-sym">${s.symbol}</div><div class="ai-sb-item-name">${s.company || s.symbol}</div></div>
        <div class="ai-sb-item-right"><div class="ai-sb-item-shares">${(s.shares||0).toLocaleString()} 股</div><div class="ai-sb-item-val">${displayVal}</div><div><span class="ai-sb-item-pct ${pctClass}">${pctText}</span></div></div>
      </div>`;
    });
    listEl.innerHTML = html || '<div style="padding:20px;text-align:center;color:#7a7872;font-size:12px">尚無持股資料</div>';
    summaryEl.innerHTML = `共 ${stocks.length} 檔 · 總市值 <strong>$${Math.round(totalValue).toLocaleString()}</strong>`;
  }

  // ===== 選擇股票 =====
  window.aiSelectStock = function(symbol, region) {
    _aiSelectedSymbol = symbol;
    _aiSelectedRegion = region;
    aiLoadStockList();
    aiLoadTradingView(symbol, region);

    const stock = (window.stocks || []).find(s => s.symbol === symbol);
    document.getElementById('ai-tv-symbol').textContent = symbol;
    document.getElementById('ai-tv-name').textContent = stock ? (stock.company || symbol) : symbol;
    const price = stock ? (stock.currentPrice || 0) : 0;
    const change = stock ? (stock.changePercent || 0) : 0;
    const priceEl = document.getElementById('ai-tv-price');
    priceEl.textContent = (region === '台股' ? '$' : 'US$') + price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ' + (change>=0?'+':'') + change.toFixed(2) + '%';
    priceEl.style.color = change >= 0 ? '#4aad6e' : '#e8675a';

    document.getElementById('ai-analyze-status').textContent = `已選擇 ${symbol} · 按下按鈕觸發 AI 分析`;
  };

  // ===== 股票圖表（lightweight-charts + Yahoo 真實 OHLCV） =====
  let _aiChart = null;
  let _aiCandleSeries = null;
  let _aiVolumeSeries = null;

  function aiLoadTradingView(symbol, region) {
    const container = document.getElementById('ai-tv-chart');
    if (!container) return;
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#7a7872;font-size:13px">載入圖表中...</div>';

    const yahooSymbol = region === '台股' ? symbol + '.TW' : symbol;
    const intervalMap = { 'D':'1d', 'W':'1wk', 'M':'1mo', '5':'5m', '15':'15m', '60':'60m' };
    const selVal = document.getElementById('ai-tv-interval').value || 'D';
    const interval = intervalMap[selVal] || '1d';
    const rangeMap = { '1d':'6mo', '1wk':'2y', '1mo':'5y', '5m':'5d', '15m':'5d', '60m':'1mo' };
    const range = rangeMap[interval] || '6mo';

    fetch(`/api/stock?symbol=${encodeURIComponent(yahooSymbol)}&interval=${interval}&range=${range}`)
      .then(r => r.ok ? r.json() : Promise.reject('API error'))
      .then(data => {
        const result = data?.chart?.result?.[0];
        if (!result || !result.timestamp) throw new Error('No data');

        const ts = result.timestamp;
        const q = result.indicators?.quote?.[0];
        if (!q) throw new Error('No quotes');

        const candles = [];
        const vols = [];
        for (let i = 0; i < ts.length; i++) {
          if (q.close[i] == null) continue;
          const t = ts[i];
          candles.push({ time: t, open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i] });
          vols.push({ time: t, value: q.volume[i] || 0, color: q.close[i] >= q.open[i] ? 'rgba(232,65,66,.5)' : 'rgba(38,166,154,.5)' });
        }
        if (candles.length < 2) throw new Error('Insufficient data');

        container.innerHTML = '';
        if (_aiChart) { _aiChart.remove(); _aiChart = null; }

        _aiChart = LightweightCharts.createChart(container, {
          width: container.clientWidth,
          height: container.clientHeight,
          layout: { background: { color: '#1e1e1e' }, textColor: '#9a9890' },
          grid: { vertLines: { color: 'rgba(255,255,255,.04)' }, horzLines: { color: 'rgba(255,255,255,.04)' } },
          crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
          rightPriceScale: { borderColor: 'rgba(255,255,255,.1)' },
          timeScale: { borderColor: 'rgba(255,255,255,.1)', timeVisible: interval.includes('m'), secondsVisible: false },
        });

        _aiCandleSeries = _aiChart.addCandlestickSeries({
          upColor: '#e84142', downColor: '#26a69a',
          borderUpColor: '#e84142', borderDownColor: '#26a69a',
          wickUpColor: '#e84142', wickDownColor: '#26a69a',
        });
        _aiCandleSeries.setData(candles);

        _aiVolumeSeries = _aiChart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: 'vol',
        });
        _aiChart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
        _aiVolumeSeries.setData(vols);

        _aiChart.timeScale().fitContent();

        // OHLCV tooltip
        const tooltip = document.createElement('div');
        tooltip.style.cssText = 'position:absolute;top:8px;left:70px;font-size:11px;font-family:var(--mono);color:#ccc9bf;pointer-events:none;z-index:10;display:flex;gap:12px;background:rgba(30,30,30,.85);padding:4px 10px;border-radius:4px';
        container.style.position = 'relative';
        container.appendChild(tooltip);

        _aiChart.subscribeCrosshairMove(param => {
          if (!param.time || !param.seriesData) { tooltip.style.display = 'none'; return; }
          const c = param.seriesData.get(_aiCandleSeries);
          const v = param.seriesData.get(_aiVolumeSeries);
          if (!c) { tooltip.style.display = 'none'; return; }
          tooltip.style.display = 'flex';
          const chg = c.open ? ((c.close - c.open) / c.open * 100) : 0;
          const chgColor = chg >= 0 ? '#e84142' : '#26a69a';
          tooltip.innerHTML =
            `<span>開 <b>${c.open?.toFixed(2)}</b></span>` +
            `<span>高 <b style="color:#e84142">${c.high?.toFixed(2)}</b></span>` +
            `<span>低 <b style="color:#26a69a">${c.low?.toFixed(2)}</b></span>` +
            `<span>收 <b style="color:${chgColor}">${c.close?.toFixed(2)}</b></span>` +
            `<span style="color:${chgColor}">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</span>` +
            `<span>量 <b>${v?.value ? (v.value >= 1e6 ? (v.value/1e6).toFixed(1)+'M' : v.value >= 1e3 ? (v.value/1e3).toFixed(0)+'K' : v.value) : '--'}</b></span>`;
        });

        // resize observer
        const ro = new ResizeObserver(() => {
          if (_aiChart) _aiChart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
        });
        ro.observe(container);
      })
      .catch(e => {
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#7a7872;font-size:13px">圖表載入失敗：${e.message || e}</div>`;
      });
  }

  window.aiChangeInterval = function() {
    if (_aiSelectedSymbol) {
      aiLoadTradingView(_aiSelectedSymbol, _aiSelectedRegion);
    }
  };

  // ===== 資產概況 =====
  function aiLoadAssetOverview() {
    const stocks = window.stocks || [];
    const rate = window.exchangeRate || 30;

    let stockTW = 0, stockUS = 0, twCount = 0, usCount = 0;
    stocks.forEach(s => {
      const val = (s.currentPrice || s.avgCost || 0) * (s.shares || 0);
      if (s.region === '台股') { stockTW += val; twCount++; }
      else { stockUS += val; usCount++; }
    });
    const totalStock = stockTW + stockUS * rate;
    document.getElementById('ai-asset-stock').textContent = '$' + Math.round(totalStock).toLocaleString();
    document.getElementById('ai-asset-stock-detail').innerHTML =
      `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>台股（${twCount} 檔）</span><span style="font-family:var(--mono);color:#ccc9bf">$${Math.round(stockTW).toLocaleString()}</span></div>` +
      `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>美股（${usCount} 檔）</span><span style="font-family:var(--mono);color:#ccc9bf">$${Math.round(stockUS * rate).toLocaleString()}</span></div>`;

    // 固定資產 & 現金 from dashboard data
    const dbData = window.dbAssetData || {};
    const propVal = dbData.fixedAsset || 0;
    document.getElementById('ai-asset-prop').textContent = '$' + Math.round(propVal).toLocaleString();
    const propDetail = (dbData.fixedAssetItems || []);
    document.getElementById('ai-asset-prop-detail').innerHTML = propDetail.length
      ? propDetail.map(i => `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>${i.name}</span><span style="font-family:var(--mono);color:#ccc9bf">$${Math.round(i.value).toLocaleString()}</span></div>`).join('')
      : '<div style="color:#7a7872">請在資產總覽設定</div>';

    const cashVal = dbData.cash || 0;
    document.getElementById('ai-asset-cash').textContent = '$' + Math.round(cashVal).toLocaleString();
    const cashDetail = (dbData.cashItems || []);
    document.getElementById('ai-asset-cash-detail').innerHTML = cashDetail.length
      ? cashDetail.map(i => `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>${i.name}</span><span style="font-family:var(--mono);color:#ccc9bf">$${Math.round(i.value).toLocaleString()}</span></div>`).join('')
      : '<div style="color:#7a7872">請在資產總覽設定</div>';

    // 負債 from cashflow
    const cfExpense = window.cfExpenseRef || [];
    let totalDebt = 0;
    let debtHtml = '';
    const catMap = {loan_mortgage:'房貸', loan_credit:'信貸', loan_other:'其他貸款'};
    (Array.isArray(cfExpense) ? cfExpense : Object.values(cfExpense)).forEach(r => {
      if (r.etype && r.etype.startsWith('loan_')) {
        const ld = r.loanData || {};
        const loanAmt = parseFloat(ld['lc-p']) || 0;
        const loanRate = parseFloat(ld['lc-r']) || 0;
        const monthPay = parseFloat(r.amt) || 0;
        totalDebt += loanAmt;
        debtHtml += `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>${r.name || catMap[r.etype] || '貸款'}</span><span style="font-family:var(--mono);color:#ccc9bf">-$${Math.round(loanAmt).toLocaleString()}</span></div>`;
        if (loanRate || monthPay) {
          debtHtml += `<div style="padding-left:8px;font-size:9px;color:#7a7872;font-family:var(--mono)">`;
          if (loanRate) debtHtml += `利率 ${loanRate}%`;
          if (loanRate && monthPay) debtHtml += ` · `;
          if (monthPay) debtHtml += `月付 $${Math.round(monthPay).toLocaleString()}`;
          debtHtml += `</div>`;
        }
      }
    });
    document.getElementById('ai-asset-debt').textContent = totalDebt ? '-$' + Math.round(totalDebt).toLocaleString() : '$0';
    document.getElementById('ai-asset-debt-detail').innerHTML = debtHtml || '<div style="color:#7a7872">無貸款資料</div>';
  }

  // ===== 目標進度 =====
  function aiLoadGoalProgress() {
    const stocks = window.stocks || [];
    const rate = window.exchangeRate || 30;
    const dbData = window.dbAssetData || {};

    let stockVal = 0;
    stocks.forEach(s => {
      const v = (s.currentPrice || s.avgCost || 0) * (s.shares || 0);
      stockVal += s.region === '台股' ? v : v * rate;
    });
    // 計算負債總額
    const cfExpense = window.cfExpenseRef || [];
    const cfArr = Array.isArray(cfExpense) ? cfExpense : Object.values(cfExpense);
    let debtTotal = 0;
    cfArr.forEach(r => {
      if (r.etype && r.etype.startsWith('loan_')) {
        debtTotal += parseFloat((r.loanData || {})['lc-p']) || 0;
      }
    });
    // 也加上 dashboard 的負債數據（兩者取較大值，避免重複）
    const dbDebt = dbData.debtTotal || 0;
    const finalDebt = Math.max(debtTotal, dbDebt);
    const netAsset = stockVal + (dbData.fixedAsset || 0) + (dbData.cash || 0) - finalDebt;
    const target = parseInt((document.getElementById('ai-goal-amount-input').value || '50000000').replace(/,/g, '')) || 50000000;
    const years = parseInt(document.getElementById('ai-goal-years-input').value) || 5;
    const pct = Math.min(100, Math.max(0, (netAsset / target * 100)));

    document.getElementById('ai-goal-current').textContent = '$' + Math.round(netAsset).toLocaleString();
    document.getElementById('ai-goal-gap').textContent = '$' + Math.round(Math.max(0, target - netAsset)).toLocaleString();
    document.getElementById('ai-goal-target').textContent = '$' + target.toLocaleString();
    document.getElementById('ai-goal-bar').style.width = pct.toFixed(1) + '%';
    document.getElementById('ai-goal-pct').textContent = pct.toFixed(1) + '%';

    const startYear = new Date().getFullYear();
    const timelineEl = document.getElementById('ai-goal-timeline');
    let tlHtml = '';
    for (let i = 0; i <= years; i++) {
      const yr = startYear + i;
      const amt = Math.round(netAsset + (target - netAsset) * (i / years));
      const isFirst = i === 0;
      const isLast = i === years;
      const dotClass = isFirst ? 'ai-gp-dot-now' : 'ai-gp-dot-future';
      const highlight = (isFirst || isLast) ? ' style="font-weight:700"' : '';
      tlHtml += `<div class="ai-gp-year"><div class="ai-gp-year-dot ${dotClass}"${isLast ? ' style="background:#c8b89a"' : ''}></div><div class="ai-gp-year-label"${highlight}>${yr}</div><div class="ai-gp-year-amt">${Math.round(amt/10000).toLocaleString()}萬</div></div>`;
    }
    timelineEl.innerHTML = tlHtml;
  }

  // ===== 宏觀指標 =====
  function aiLoadMacro() {
    const macroSymbols = {
      vix: { symbol: '^VIX', elId: 'ai-macro-vix' },
      oil: { symbol: 'CL=F', elId: 'ai-macro-oil' },
    };

    Object.entries(macroSymbols).forEach(([key, cfg]) => {
      fetch('/api/stock?symbol=' + encodeURIComponent(cfg.symbol))
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return;
          try {
            const meta = data.chart.result[0].meta;
            const price = meta.regularMarketPrice;
            const prevClose = meta.chartPreviousClose || meta.previousClose;
            const chg = prevClose ? ((price - prevClose) / prevClose * 100) : 0;
            const el = document.getElementById(cfg.elId);
            if (el) {
              const prefix = key === 'oil' ? '$' : '';
              el.innerHTML = prefix + price.toFixed(2) + ' <span style="font-size:10px;color:' + (chg >= 0 ? '#4aad6e' : '#e8675a') + '">' + (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%</span>';
            }
          } catch(e) {}
        })
        .catch(() => {});
    });

    const fedEl = document.getElementById('ai-macro-fed');
    if (fedEl) fedEl.textContent = '4.25-4.50%';
    const cpiEl = document.getElementById('ai-macro-cpi');
    if (cpiEl) cpiEl.textContent = '2.4%';
  }

  // ===== 重新抓取 =====
  window.aiRefreshAllData = function() {
    aiLoadMacro();
    if (typeof updateAllPricesAndRate === 'function') {
      updateAllPricesAndRate().then(() => {
        aiLoadStockList();
        aiLoadAssetOverview();
        aiLoadGoalProgress();
      });
    }
    const now = new Date();
    const ts = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0') + ':' + now.getSeconds().toString().padStart(2,'0');
    document.getElementById('ai-ds-stock-time').textContent = ts;
    document.getElementById('ai-ds-macro-time').textContent = ts;
    document.getElementById('ai-ds-fx-time').textContent = ts;
  };

  // ===== AI 策略建議（全面資產） =====
  let _lastStrategyPrompt = null;

  window.aiGenerateStrategy = function() {
    const target = parseInt((document.getElementById('ai-goal-amount-input').value || '50000000').replace(/,/g, '')) || 50000000;
    const years = parseInt(document.getElementById('ai-goal-years-input').value) || 5;
    const monthly = parseInt((document.getElementById('ai-goal-monthly-input').value || '50000').replace(/,/g, '')) || 50000;

    const assetData = aiCollectAllAssetData();
    _lastStrategyPrompt = aiBuildStrategyPrompt(assetData, target, years, monthly);

    ['claude','gemini','grok'].forEach(engine => aiRunStrategy(engine));
  };

  window.aiRetryStrategy = function(engine) {
    if (_lastStrategyPrompt) aiRunStrategy(engine);
  };

  function aiRunStrategy(engine) {
    const col = document.getElementById('ai-strategy-' + engine);
    const head = col.querySelector('.ai-goal-ai-head').outerHTML;
    col.innerHTML = head + '<div style="padding:18px 0;text-align:center;color:#c8b89a;font-size:12px">分析中...</div>';

    fetch('/api/ai-' + engine, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ prompt: _lastStrategyPrompt, type: 'strategy' })
    })
    .then(r => r.ok ? r.json() : Promise.reject('API error'))
    .then(data => aiRenderStrategy(engine, data))
    .catch(e => {
      col.innerHTML = head + `<div style="padding:18px 0;text-align:center;color:#e8675a;font-size:12px">分析失敗：${e}<br><button onclick="aiRetryStrategy('${engine}')" style="margin-top:8px;background:#3d3c38;border:1px solid rgba(255,255,255,.1);color:#c8b89a;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:12px">重新分析此 AI</button></div>`;
    });
  }

  function aiCollectAllAssetData() {
    const stocks = window.stocks || [];
    const rate = window.exchangeRate || 30;
    const dbData = window.dbAssetData || {};
    const cfExpense = window.cfExpenseRef || {};

    let holdings = stocks.map(s => ({
      symbol: s.symbol, company: s.company, region: s.region,
      shares: s.shares, avgCost: s.avgCost, currentPrice: s.currentPrice,
      changePercent: s.changePercent,
      valueTWD: s.region === '台股' ? (s.currentPrice||0)*(s.shares||0) : (s.currentPrice||0)*(s.shares||0)*rate
    }));

    let loans = [];
    const cfArr = Array.isArray(cfExpense) ? cfExpense : Object.values(cfExpense);
    cfArr.forEach(r => {
      if (r.etype && r.etype.startsWith('loan_')) {
        const ld = r.loanData || {};
        loans.push({
          name: r.name, type: r.etype,
          amount: parseFloat(ld['lc-p']) || 0,
          rate: parseFloat(ld['lc-r']) || 0,
          monthlyPay: parseFloat(r.amt) || 0,
          startDate: ld['lc-s'] || '', endDate: ld['lc-e'] || '',
          gracePeriod: ld['lc-grace'] || 0
        });
      }
    });

    // 收入明細
    const cfIncome = window.cfIncomeRef || [];
    const incomeArr = Array.isArray(cfIncome) ? cfIncome : Object.values(cfIncome);
    const incomes = incomeArr.map(r => ({
      name: r.name, owner: r.owner, freq: r.freq,
      amt: parseFloat(r.amt) || 0
    })).filter(r => r.amt > 0);

    // 固定支出（非貸款）
    const fixedExpenses = cfArr.filter(r => !r.etype || r.etype === 'general').map(r => ({
      name: r.name, owner: r.owner, freq: r.freq,
      amt: parseFloat(r.amt) || 0
    })).filter(r => r.amt > 0);

    // 信用卡 = 變動支出
    const cfCards = window.cfCardsRef || [];
    const cardArr = Array.isArray(cfCards) ? cfCards : Object.values(cfCards);
    const cards = cardArr.map(r => ({
      name: r.name || r.bank, amt: parseFloat(r.amt) || 0
    })).filter(r => r.amt > 0);

    return {
      holdings,
      fixedAsset: dbData.fixedAsset || 0,
      fixedAssetItems: dbData.fixedAssetItems || [],
      cash: dbData.cash || 0,
      cashItems: dbData.cashItems || [],
      loans,
      incomes,
      fixedExpenses,
      cards,
      exchangeRate: rate
    };
  }

  function aiBuildStrategyPrompt(data, target, years, monthly) {
    const totalStock = data.holdings.reduce((s,h) => s + h.valueTWD, 0);
    const totalDebt = data.loans.reduce((s,l) => s + (l.amount||0), 0);
    const netAsset = totalStock + data.fixedAsset + data.cash - totalDebt;

    return `你是專業的家族財務顧問。以下是完整的資產狀況，請做全面配置診斷與策略建議。

【目標】${years} 年內淨資產達到 NT$${target.toLocaleString()}（目前 NT$${Math.round(netAsset).toLocaleString()}）
【每月可投入】NT$${monthly.toLocaleString()}

【股票持股】總市值 NT$${Math.round(totalStock).toLocaleString()}
${data.holdings.map(h => `- ${h.symbol} ${h.company} | ${h.shares}股 | 均價${h.avgCost} | 現價${h.currentPrice} | 市值NT$${Math.round(h.valueTWD).toLocaleString()}`).join('\n')}

【固定資產】NT$${Math.round(data.fixedAsset).toLocaleString()}
${data.fixedAssetItems.map(i => `- ${i.name}: NT$${Math.round(i.value).toLocaleString()}`).join('\n') || '（未設定）'}

【現金存款】NT$${Math.round(data.cash).toLocaleString()}
${data.cashItems.map(i => `- ${i.name}: NT$${Math.round(i.value).toLocaleString()}`).join('\n') || '（未設定）'}

【負債明細】總額 NT$${Math.round(totalDebt).toLocaleString()}
${data.loans.map(l => `- ${l.name}(${l.type}): 金額NT$${Math.round(l.amount||0).toLocaleString()} | 利率${l.rate}% | 月付NT$${Math.round(l.monthlyPay||0).toLocaleString()} | ${l.startDate||''}~${l.endDate||''}`).join('\n') || '（無貸款）'}

【每月收入明細】
${data.incomes.map(i => `- ${i.name}(${i.owner}): NT$${Math.round(i.amt).toLocaleString()}/${i.freq==='monthly'?'月':i.freq==='yearly'?'年':'次'}`).join('\n') || '（未設定）'}

【每月固定支出】
${data.fixedExpenses.map(e => `- ${e.name}(${e.owner}): NT$${Math.round(e.amt).toLocaleString()}/${e.freq==='monthly'?'月':e.freq==='yearly'?'年':'次'}`).join('\n') || '（未設定）'}

【信用卡/變動支出】
${data.cards.map(c => `- ${c.name}: NT$${Math.round(c.amt).toLocaleString()}/月`).join('\n') || '（未設定）'}

請依以下格式回覆（JSON）：
{
  "diagnosis": "全面資產診斷（含負債評估）",
  "strategy": "調整策略（含賣出/買入/持有/現金/負債處理）",
  "path": "達成路徑（含需年化報酬率、成功率）",
  "risk": "風險警示"
}`;
  }

  function aiRenderStrategy(engine, data) {
    const col = document.getElementById('ai-strategy-' + engine);
    const head = col.querySelector('.ai-goal-ai-head').outerHTML;
    const r = data.result || data;
    col.innerHTML = head +
      `<div style="margin-bottom:14px"><div style="font-size:10px;font-weight:700;color:#c8b89a;letter-spacing:.04em;margin-bottom:4px">全面資產診斷</div><div style="font-size:12px;color:#ccc9bf;line-height:1.65">${r.diagnosis || ''}</div></div>` +
      `<div style="margin-bottom:14px"><div style="font-size:10px;font-weight:700;color:#c8b89a;letter-spacing:.04em;margin-bottom:4px">調整策略</div><div style="font-size:12px;color:#ccc9bf;line-height:1.65">${r.strategy || ''}</div></div>` +
      `<div style="margin-bottom:14px"><div style="font-size:10px;font-weight:700;color:#c8b89a;letter-spacing:.04em;margin-bottom:4px">達成路徑</div><div style="font-size:12px;color:#ccc9bf;line-height:1.65">${r.path || ''}</div></div>` +
      `<div><div style="font-size:10px;font-weight:700;color:#c8b89a;letter-spacing:.04em;margin-bottom:4px">風險警示</div><div style="font-size:12px;color:#e8675a;line-height:1.65">${r.risk || ''}</div></div>`;
  }

  // ===== AI 個股分析 =====
  let _lastStockPrompt = null;

  window.aiAnalyzeStock = function() {
    if (!_aiSelectedSymbol) {
      document.getElementById('ai-analyze-status').textContent = '請先選擇左側持股';
      return;
    }
    const stock = (window.stocks || []).find(s => s.symbol === _aiSelectedSymbol);
    if (!stock) return;

    document.getElementById('ai-analyze-status').textContent = `正在分析 ${_aiSelectedSymbol}...`;
    _lastStockPrompt = aiBuildStockPrompt(stock);

    ['claude','gemini','grok'].forEach(engine => aiRunStockAnalysis(engine));
  };

  window.aiRetryStock = function(engine) {
    if (_lastStockPrompt) aiRunStockAnalysis(engine);
  };

  function aiRunStockAnalysis(engine) {
    const body = document.getElementById('ai-stock-' + engine);
    body.innerHTML = '<div style="padding:20px;text-align:center;color:#c8b89a;font-size:12px">分析中...</div>';

    fetch('/api/ai-' + engine, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ prompt: _lastStockPrompt, type: 'stock', symbol: _aiSelectedSymbol })
    })
    .then(r => r.ok ? r.json() : Promise.reject('API error'))
    .then(data => aiRenderStockAnalysis(engine, data))
    .catch(e => {
      body.innerHTML = `<div style="padding:20px;text-align:center;color:#e8675a;font-size:12px">分析失敗：${e}<br><button onclick="aiRetryStock('${engine}')" style="margin-top:8px;background:#3d3c38;border:1px solid rgba(255,255,255,.1);color:#c8b89a;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:12px">重新分析此 AI</button></div>`;
    });
  }

  function aiBuildStockPrompt(stock) {
    return `你是專業股票分析師。請分析以下股票，依照七大類別回覆。

股票：${stock.symbol} ${stock.company}
地區：${stock.region}
持股：${stock.shares} 股
均價：${stock.avgCost}
現價：${stock.currentPrice}
漲跌：${stock.changePercent}%

請依以下格式回覆（JSON），每個類別約 50-80 字：
{
  "產業分析": "...",
  "產業龍頭": "...",
  "財務分析": "...",
  "風險分析": "...",
  "護城河": "...",
  "技術分析": "...",
  "籌碼分析": "..."
}`;
  }

  function aiRenderStockAnalysis(engine, data) {
    const body = document.getElementById('ai-stock-' + engine);
    const r = data.result || data;
    let html = '';
    ANALYSIS_CATEGORIES.forEach(cat => {
      html += `<div class="ai-sec"><div class="ai-sec-title">${cat}</div><div class="ai-sec-body">${r[cat] || '暫無資料'}</div></div>`;
    });
    body.innerHTML = html;
    document.getElementById('ai-analyze-status').textContent = `${_aiSelectedSymbol} 分析完成`;
  }

})();
