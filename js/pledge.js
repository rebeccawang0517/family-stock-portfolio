/* ===== 質押維持率分頁（持股清單制 · 持有人層級）=====
 * 最上面：質借成數 / 追繳線 / 處分線（全域，所有標的共用）
 * 依「持有人」分組，列出每人可質押的台股庫存（滿一張才列、以整張計）
 * 每位持有人輸入「目前借款」→ 直接顯示「目前維持率」＝該人台股擔保品現值÷目前借款
 *   並附：到追繳/處分還能跌幾%、下跌試算；每檔可點開看「單獨質押借滿」的追繳/處分價
 * 全域設定、各人借款/試算存本機 localStorage（不上雲、不影響其他頁）。
 * 版面：所有數字（含輸入框）統一 var(--mono) + tabular-nums；≤640px 改為手機卡片排版。
 */
(function () {
  const LS_KEY = 'pledgeView_v2';
  const LOT = 1000;
  const AMBER = '#e0a14a';
  let st = load();

  function load() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) {}
    return { ltv: s.ltv || 60, callRatio: s.callRatio || 130, liqRatio: s.liqRatio || 120,
             loans: s.loans || {}, stress: s.stress || {}, open: s.open || {}, pledged: s.pledged || {}, px: s.px || {} };
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) {} }

  const money = v => '$' + Math.round(v).toLocaleString('en-US');
  const price = (p, dp) => dp === 2 ? '$' + p.toFixed(2) : Math.round(p).toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- 樣式：數字統一字型；手機排版 ----
  const CSS = `
  #pl-root{--pl-num:var(--mono,'SF Mono',Consolas,Menlo,monospace)}
  #pl-root .n,#pl-root .pl-in{font-family:var(--pl-num);font-variant-numeric:tabular-nums;letter-spacing:0}
  #pl-root .pl-in{background:#2c2b27;border:1px solid rgba(255,255,255,.15);color:#f0ede6;font-size:15px;font-weight:600;
    padding:7px 10px;border-radius:6px;text-align:right;outline:none;min-height:36px;box-sizing:border-box;-moz-appearance:textfield}
  #pl-root .pl-in::-webkit-outer-spin-button,#pl-root .pl-in::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
  #pl-root .pl-in:focus{border-color:#5b9bd5;box-shadow:0 0 0 2px rgba(91,155,213,.25)}
  #pl-root .pl-in.ov{background:#3a3320;border-color:${AMBER};color:${AMBER};font-weight:700}
  #pl-root .pl-lbl{font-size:12.5px;color:#b9b4a9;display:flex;flex-direction:column;gap:4px}
  #pl-root .pl-btn{border-radius:8px;font-size:14px;cursor:pointer;min-height:40px;padding:0 16px}
  #pl-root .pl-ctl{position:sticky;top:0;z-index:5;background:#1b1d22;border:1px solid var(--gold-line,#3a3f48);border-radius:10px;
    padding:12px 16px;margin-bottom:16px;display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end}
  #pl-root .pl-ctl .pl-in{width:88px}
  #pl-root .pl-hint{font-size:12px;color:#8a8a8a;align-self:center;max-width:230px}
  #pl-root .pl-btns{display:flex;gap:10px;margin-left:auto;align-self:center}
  #pl-root .pl-loan{display:flex;gap:20px;flex-wrap:wrap;align-items:center;padding:12px 16px;background:#1b1d22;border-bottom:1px solid #2e3036}
  #pl-root .pl-loanin{display:flex;gap:6px;align-items:center}
  #pl-root .pl-loanin .pl-in{width:170px}
  #pl-root .pl-side{font-size:12.5px;color:#9fb3a8;line-height:1.8}
  #pl-root .pl-preset{border-left:1px solid #2e3036;padding-left:16px}
  #pl-root .pl-row{display:grid;grid-template-columns:minmax(150px,1fr) 170px 120px 124px 124px;gap:10px;align-items:center;padding:9px 12px;border-top:1px solid rgba(255,255,255,.06)}
  #pl-root .pl-row.hd{color:#8a8a8a;font-size:11.5px;border-top:none;border-bottom:1px solid rgba(255,255,255,.06);padding:6px 12px}
  #pl-root .pl-row.hd>div:not(:first-child){text-align:right}
  #pl-root .pl-row.sim{background:rgba(224,161,74,.06)}
  #pl-root .pl-c{text-align:right;font-size:14px;white-space:nowrap}
  #pl-root .pl-c .pl-in{width:100%;max-width:110px}
  #pl-root .pl-c .pl-lot{width:60px}
  #pl-root .pl-c::before{content:none}
  #pl-root .pl-name{cursor:pointer;display:flex;gap:8px;align-items:center;min-width:0}
  #pl-root .pl-name .arr{color:#8a8a8a;width:12px;flex:0 0 12px}
  #pl-root .pl-sub{font-size:11px;color:#8a8a8a;margin-top:2px}
  #pl-root .pl-det{padding:8px 14px 12px 34px;background:#17181c;border-top:1px dashed rgba(255,255,255,.08);font-size:13px;color:#9fb3a8;line-height:1.8}
  @media (max-width:640px){
    #pl-root .pl-in{min-width:0}
    #pl-root .pl-ctl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:10px 12px}
    #pl-root .pl-ctl .pl-title{grid-column:1/-1}
    #pl-root .pl-ctl .pl-title br,#pl-root .pl-ctl .pl-title span{display:none}
    #pl-root .pl-ctl .pl-in{width:100%;font-size:16px}
    #pl-root .pl-hint{display:none}
    #pl-root .pl-btns{grid-column:1/-1;margin:0;display:grid;grid-template-columns:1fr 2fr}
    #pl-root .pl-in{font-size:16px}                /* ≥16px：iOS 點擊不自動放大 */
    #pl-root .pl-loan{flex-direction:column;align-items:stretch;gap:12px;padding:12px}
    #pl-root .pl-loanin{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
    #pl-root .pl-loanin .pl-in{width:100%}
    #pl-root .pl-preset{border-left:none;padding-left:0;border-top:1px solid #2e3036;padding-top:10px}
    #pl-root .pl-row.hd{display:none}
    #pl-root .pl-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 12px;padding:12px}
    #pl-root .pl-name{grid-column:1/-1}
    #pl-root .pl-c{text-align:left;font-size:15px}
    #pl-root .pl-c::before{content:attr(data-label);display:block;font-family:inherit;font-size:11px;color:#8a8a8a;margin-bottom:3px;font-variant-numeric:normal}
    #pl-root .pl-c .pl-in{max-width:none}
    #pl-root .pl-c .pl-lot{width:56px;padding:7px 8px}
    #pl-root .pl-det{padding:10px 12px}
    #pl-root .pl-hh-meta{margin-left:0!important;width:100%}
  }`;
  function ensureStyle() {
    if (document.getElementById('pl-style')) return;
    const s = document.createElement('style'); s.id = 'pl-style'; s.textContent = CSS; document.head.appendChild(s);
  }
  // 數字輸入框：type=number + inputmode → 手機跳數字鍵盤
  const numIn = (attrs, val, cls, extra) =>
    `<input type="number" inputmode="decimal" class="pl-in${cls ? ' ' + cls : ''}" value="${val}" ${attrs}${extra ? ' ' + extra : ''}>`;

  function statusOf(ratio, loan, call, liq) {
    if (!(loan > 0)) return { status: '未設借款', color: '#8a8a8a' };
    if (ratio < liq) return { status: '已達處分(斷頭)', color: '#e8675a' };
    if (ratio < call) return { status: '已達追繳', color: '#e8944a' };
    if (ratio < call * 1.1) return { status: '注意(接近追繳)', color: '#e0c04a' };
    return { status: '安全', color: '#4aad6e' };
  }

  function holderHoldings() {
    const m = {};
    (window.stocks || []).forEach(s => {
      if ((s.region || '') !== '台股') return;
      const h = (s.holder || '未分持有人').trim() || '未分持有人';
      const k = s.symbol;
      m[h] = m[h] || {};
      if (!m[h][k]) m[h][k] = { symbol: k, name: s.companyName || k, price: Math.abs(Number(s.currentPrice) || 0), shares: 0 };
      m[h][k].shares += Number(s.shares) || 0;
      if (!m[h][k].price) m[h][k].price = Math.abs(Number(s.currentPrice) || 0);
    });
    return m;
  }
  const heldLots = hld => Math.floor((hld.shares || 0) / LOT);
  // 質押張數：未設→預設全部整張；設了→可自由調整(≥0整張，不再限制上限)
  function pledgedLots(key, hld) { const v = st.pledged[key]; return v == null ? heldLots(hld) : Math.max(0, Math.floor(v)); }
  // 股價：可手動覆寫；未覆寫→用即時現價
  function priceOf(key, hld) { const v = st.px[key]; return (v == null || v === '') ? hld.price : (Number(v) || 0); }
  function calcHolding(hld, pLots, px) {
    const lots = pLots == null ? heldLots(hld) : pLots, pledgeShares = lots * LOT;
    const p = px == null ? hld.price : px, collateral = pledgeShares * p;
    return { held: heldLots(hld), lots, px: p, pledgeShares, collateral, maxLoan: collateral * st.ltv / 100 };
  }

  function controlsBar() {
    const g = (k, title) => numIn(`min="1" step="1" data-g="${k}" title="${title}"`, st[k]);
    return `<div class="pl-ctl">
      <div class="pl-title" style="font-weight:800;color:#e9ebee;align-self:center">全域參數<br><span style="font-size:11px;color:#8a8a8a;font-weight:400">所有標的共用</span></div>
      <label class="pl-lbl">質借成數(%)${g('ltv', '可借款＝擔保品現值×成數，台股常見約60%')}</label>
      <label class="pl-lbl">追繳線(%)${g('callRatio', '維持率低於此→追繳')}</label>
      <label class="pl-lbl">處分線(%)${g('liqRatio', '維持率低於此→斷頭處分')}</label>
      <div class="pl-hint">試算：可改股價/質押張數/借款/參數，按「計算」套用（不影響實際持股）。</div>
      <div class="pl-btns">
        <button data-reset class="pl-btn" title="清除所有試算：股價回即時現價、質押張數回全部整張" style="background:none;border:1px solid rgba(255,255,255,.2);color:#b9b4a9">↺ 還原</button>
        <button data-calc class="pl-btn" style="background:#2c6ba8;border:none;color:#fff;font-weight:700;padding:0 22px">✓ 計算</button>
      </div>
    </div>`;
  }

  // 每檔（點開看「單獨質押此檔借滿」的追繳/處分價，純參考）
  function holdingRow(h, hld) {
    const key = h + '|' + hld.symbol, pLots = pledgedLots(key, hld), px = priceOf(key, hld), d = calcHolding(hld, pLots, px), open = !!st.open[key];
    // 試算覆寫偵測：張數或股價被改過 → 以琥珀色明顯標示，與實際區分
    const lotsOv = st.pledged[key] != null && Math.floor(st.pledged[key]) !== d.held;
    const pxOv = st.px[key] != null && st.px[key] !== '' && Number(st.px[key]) !== hld.price;
    const sim = lotsOv || pxOv;
    const dp0 = hld.price < 1000 ? 2 : 0;
    const simChip = sim ? `<span style="background:${AMBER}22;color:${AMBER};padding:1px 7px;border-radius:999px;font-size:10.5px;font-weight:700">試算</span>` : '';
    const row = `<div class="pl-row${sim ? ' sim' : ''}">
      <div class="pl-name" data-toggle="${esc(key)}">
        <span class="arr">${open ? '▾' : '▸'}</span>
        <b class="n" style="color:#f0ede6">${esc(hld.symbol)}</b><span style="color:#9aa1ab;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(hld.name)}</span>${simChip}
      </div>
      <div class="pl-c n" data-label="目前 / 質押張數" style="color:#b9b4a9">${d.held} 張 / ${numIn(`min="0" step="1" data-pledge="${esc(key)}"`, pLots, 'pl-lot' + (lotsOv ? ' ov' : ''))} 張</div>
      <div class="pl-c" data-label="現價（可試算）">${numIn(`min="0" step="0.01" data-px="${esc(key)}" title="試算股價（覆寫即時現價，不影響實際持股）"`, px, pxOv ? 'ov' : '')}
        ${pxOv ? `<div class="pl-sub n">實 ${price(hld.price, dp0)}</div>` : ''}</div>
      <div class="pl-c n" data-label="現值" style="color:${sim ? AMBER : '#cfe8d6'}">${money(d.collateral)}</div>
      <div class="pl-c n" data-label="可借款" style="color:#8fc0f0">${money(d.maxLoan)}</div>
    </div>`;
    if (!open) return `<div data-key="${esc(key)}">${row}</div>`;
    const dp = px < 1000 ? 2 : 0;
    // 單獨質押此檔借滿：追繳/處分價 = 股價 × 成數 × (追繳或處分線) / 10000
    const pCall = px * st.ltv * st.callRatio / 10000, pLiq = px * st.ltv * st.liqRatio / 10000;
    const detail = `<div class="pl-det">
      單獨質押此檔 <span class="n">${d.lots}</span> 張、借滿 <span class="n">${money(d.maxLoan)}</span>（維持率 <span class="n">${Math.round(10000 / st.ltv)}%</span>）：<br>
      追繳價 <b class="n" style="color:#e8944a">${price(pCall, dp)}</b>（跌 <span class="n">${px > 0 ? ((1 - pCall / px) * 100).toFixed(1) : '0'}%</span>）
      · 處分價 <b class="n" style="color:#e8675a">${price(pLiq, dp)}</b>（跌 <span class="n">${px > 0 ? ((1 - pLiq / px) * 100).toFixed(1) : '0'}%</span>）
    </div>`;
    return `<div data-key="${esc(key)}">${row}${detail}</div>`;
  }

  function holderSection(h, syms) {
    const list = Object.values(syms).filter(x => x.shares >= LOT).sort((a, b) => a.symbol.localeCompare(b.symbol));
    if (!list.length) return '';
    let coll = 0, maxL = 0;
    list.forEach(x => { const k = h + '|' + x.symbol; const d = calcHolding(x, pledgedLots(k, x), priceOf(k, x)); coll += d.collateral; maxL += d.maxLoan; });
    const hasSim = list.some(x => { const k = h + '|' + x.symbol; return (st.pledged[k] != null && Math.floor(st.pledged[k]) !== heldLots(x)) || (st.px[k] != null && st.px[k] !== '' && Number(st.px[k]) !== x.price); });
    const loan = Number(st.loans[h]) || 0;
    const ratio = loan > 0 ? coll / loan * 100 : Infinity;
    const sA = statusOf(ratio, loan, st.callRatio, st.liqRatio);
    const callLine = loan * st.callRatio / 100, liqLine = loan * st.liqRatio / 100;
    const dropCall = loan > 0 && coll > 0 ? Math.max(0, (coll - callLine) / coll * 100) : 0;
    const dropLiq = loan > 0 && coll > 0 ? Math.max(0, (coll - liqLine) / coll * 100) : 0;
    const stress = (st.stress[h] == null ? 10 : Number(st.stress[h])) || 0;
    const ratioAfter = loan > 0 ? coll * (1 - stress / 100) / loan * 100 : Infinity;
    const sB = statusOf(ratioAfter, loan, st.callRatio, st.liqRatio);
    // 全部下跌 10/20/30% 快速試算（擔保品整體下跌後的維持率與狀態）
    const dropView = p => { const r2 = loan > 0 ? coll * (1 - p / 100) / loan * 100 : Infinity; const sp = statusOf(r2, loan, st.callRatio, st.liqRatio); return `<span style="white-space:nowrap">跌<span class="n">${p}%</span> <b class="n" style="color:${sp.color}">${isFinite(r2) ? r2.toFixed(1) + '%' : '—'}</b></span>`; };
    const presetLine = loan > 0 ? `<div class="pl-side pl-preset">📉 全部下跌試算<br>${dropView(10)}　${dropView(20)}　${dropView(30)}</div>` : '';

    const loanBar = `<div class="pl-loan">
      <label class="pl-lbl">目前借款(TWD)
        <span class="pl-loanin">${numIn(`min="0" step="1000" placeholder="填入實際借款" data-loan="${esc(h)}"`, loan || '')}
        <button data-fill="${esc(h)}" class="pl-btn" title="借滿可借額度" style="background:none;border:1px solid rgba(143,192,240,.5);color:#8fc0f0;font-size:12.5px;padding:0 10px;white-space:nowrap">借滿 <span class="n">${money(maxL)}</span></button></span></label>
      <div style="font-size:12.5px;color:#b9b4a9">目前維持率${hasSim ? ` <span style="color:${AMBER};font-weight:700">(含試算)</span>` : ''}<br>
        <span class="n" style="font-size:24px;font-weight:800;color:${sA.color}">${loan > 0 && isFinite(ratio) ? ratio.toFixed(1) + '%' : '—'}</span>
        <span style="background:${sA.color}22;color:${sA.color};padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700;margin-left:4px">${sA.status}</span></div>
      ${loan > 0 ? `<div class="pl-side">到追繳線還能跌 <b class="n" style="color:#e8944a">${dropCall.toFixed(1)}%</b> · 到處分線 <b class="n" style="color:#e8675a">${dropLiq.toFixed(1)}%</b><br>
        再跌 ${numIn(`min="0" max="99" step="1" data-stress="${esc(h)}"`, stress, '', 'style="width:64px;min-height:32px;padding:4px 8px"')} % → 維持率 <b class="n" style="color:${sB.color}">${isFinite(ratioAfter) ? ratioAfter.toFixed(1) + '%' : '—'}</b> ${sB.status}</div>` : '<div style="font-size:12px;color:#8a8a8a">填入目前借款即顯示目前維持率</div>'}
      ${presetLine}
    </div>`;

    return `<div class="bg-slate-800 border border-slate-700 rounded-lg shadow-xl mb-5" style="overflow:hidden;border-left:4px solid ${loan > 0 ? sA.color : '#2e3036'}">
      <div style="display:flex;align-items:center;gap:8px 14px;flex-wrap:wrap;padding:12px 16px;background:linear-gradient(180deg,#232428,#1c1d21);border-bottom:1px solid #2e3036">
        <div style="font-size:16px;font-weight:800;color:#f0ede6">👤 ${esc(h)}</div>
        <div style="font-size:12.5px;color:#9aa1ab">可質押 <span class="n">${list.length}</span> 檔</div>
        <div class="pl-hh-meta" style="margin-left:auto;font-size:12.5px;color:#b9b4a9">擔保品現值 <b class="n" style="color:#cfe8d6">${money(coll)}</b> · 可借款 <b class="n" style="color:#8fc0f0">${money(maxL)}</b></div>
      </div>
      ${loanBar}
      <div class="pl-row hd"><div>擔保品明細（點開看單檔追繳/處分價）</div><div>目前/質押張數</div><div>現價(可試算)</div><div>現值</div><div>可借款</div></div>
      ${list.map(x => holdingRow(h, x)).join('')}
    </div>`;
  }

  function renderSummary(hh) {
    const box = document.getElementById('pl-summary'); if (!box) return;
    let coll = 0, maxL = 0, cnt = 0, holders = 0, loanSum = 0, collLoaned = 0;
    Object.keys(hh).forEach(h => {
      const list = Object.values(hh[h]).filter(x => x.shares >= LOT);
      if (!list.length) return; holders++;
      let hc = 0; list.forEach(x => { const k = h + '|' + x.symbol; const d = calcHolding(x, pledgedLots(k, x), priceOf(k, x)); coll += d.collateral; maxL += d.maxLoan; hc += d.collateral; cnt++; });
      const loan = Number(st.loans[h]) || 0; if (loan > 0) { loanSum += loan; collLoaned += hc; }
    });
    if (!cnt) { box.style.display = 'none'; return; }
    const curRatio = loanSum > 0 ? collLoaned / loanSum * 100 : null;
    const sC = statusOf(curRatio == null ? Infinity : curRatio, loanSum, st.callRatio, st.liqRatio);
    const K = (l, v, c) => `<div class="db-kpi-card db-kpi-card-sm"><div class="db-kpi-body"><div class="db-kpi-label">${l}</div><div class="db-kpi-value db-kpi-value-sm"${c ? ` style="color:${c}"` : ''}>${v}</div></div></div>`;
    box.innerHTML = K('可質押標的', cnt + ' 檔（' + holders + ' 人）') + K('台股擔保品現值', money(coll)) +
      K('可借款總額', money(maxL), '#8fc0f0') +
      K('整體目前維持率', curRatio == null ? '未借款' : curRatio.toFixed(1) + '%', curRatio == null ? '#8a8a8a' : sC.color);
    box.style.display = '';
  }

  function render() {
    ensureStyle();
    const root = document.getElementById('pl-root'); if (!root) return;
    if (!(window.stocks && window.stocks.length)) {
      root.innerHTML = controlsBar() + '<div class="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center text-slate-400">持股資料載入中…</div>';
      bind(root); const sb = document.getElementById('pl-summary'); if (sb) sb.style.display = 'none'; return;
    }
    const hh = holderHoldings();
    const sections = Object.keys(hh).sort().map(h => holderSection(h, hh[h])).filter(Boolean).join('');
    root.innerHTML = controlsBar() + (sections || '<div class="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center text-slate-400">沒有可質押的台股庫存（需滿 1 張＝1000 股）。</div>');
    renderSummary(hh);
    bind(root);
  }

  function bind(root) {
    // 輸入只更新狀態、先不重算；按「計算」才套用（避免每改一格就跳動）
    root.onchange = e => {
      const t = e.target; if (!t.dataset) return;
      if (t.dataset.g) { st[t.dataset.g] = parseFloat(t.value) || 0; save(); }
      else if (t.dataset.loan != null) { st.loans[t.dataset.loan] = t.value === '' ? 0 : (parseFloat(t.value) || 0); save(); }
      else if (t.dataset.stress != null) { st.stress[t.dataset.stress] = parseFloat(t.value) || 0; save(); }
      else if (t.dataset.pledge != null) { st.pledged[t.dataset.pledge] = Math.max(0, Math.floor(parseFloat(t.value) || 0)); save(); }
      else if (t.dataset.px != null) { st.px[t.dataset.px] = t.value === '' ? null : (parseFloat(t.value) || 0); save(); }
    };
    // 手機：輸入框按 Enter（鍵盤「完成/前往」）直接套用計算
    root.onkeydown = e => { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('pl-in')) { e.target.dispatchEvent(new Event('change', { bubbles: true })); render(); } };
    root.onclick = e => {
      if (e.target.closest('[data-calc]')) { render(); return; }     // 計算：套用所有輸入
      if (e.target.closest('[data-reset]')) { st.px = {}; st.pledged = {}; save(); render(); return; }   // 還原試算
      if (e.target.closest('input')) return;                          // 點輸入框不展開/收合
      const tog = e.target.closest('[data-toggle]');
      if (tog) { const k = tog.dataset.toggle; st.open[k] = !st.open[k]; save(); render(); return; }
      const fill = e.target.closest('[data-fill]');
      if (fill) {
        const h = fill.dataset.fill, hh = holderHoldings();
        let maxL = 0; Object.values(hh[h] || {}).filter(x => x.shares >= LOT).forEach(x => { const k = h + '|' + x.symbol; maxL += calcHolding(x, pledgedLots(k, x), priceOf(k, x)).maxLoan; });
        st.loans[h] = Math.round(maxL); save(); render();
      }
    };
  }

  window.pledgeRender = render;
})();
