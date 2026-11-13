/* ===== 質押維持率分頁（持股清單制 · 持有人層級）=====
 * 最上面：質借成數 / 追繳線 / 處分線（全域，所有標的共用）
 * 依「持有人」分組，列出每人可質押的台股庫存（滿一張才列、以整張計）
 * 每位持有人輸入「目前借款」→ 直接顯示「目前維持率」＝該人台股擔保品現值÷目前借款
 *   並附：到追繳/處分還能跌幾%、下跌試算；每檔可點開看「單獨質押借滿」的追繳/處分價
 * 全域設定、各人借款/試算存本機 localStorage（不上雲、不影響其他頁）。
 */
(function () {
  const LS_KEY = 'pledgeView_v2';
  const LOT = 1000;
  let st = load();

  function load() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) {}
    return { ltv: s.ltv || 60, callRatio: s.callRatio || 130, liqRatio: s.liqRatio || 120,
             loans: s.loans || {}, stress: s.stress || {}, open: s.open || {} };
  }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) {} }

  const money = v => '$' + Math.round(v).toLocaleString('en-US');
  const price = (p, dp) => dp === 2 ? '$' + p.toFixed(2) : Math.round(p).toLocaleString('en-US');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
  function calcHolding(hld) {
    const lots = Math.floor(hld.shares / LOT), pledgeShares = lots * LOT;
    const collateral = pledgeShares * hld.price;
    return { lots, pledgeShares, collateral, maxLoan: collateral * st.ltv / 100 };
  }

  function controlsBar() {
    const inp = (g, val, title) => `<input type="number" min="1" step="1" value="${val}" data-g="${g}" title="${title}"
      style="width:78px;background:#2c2b27;border:1px solid rgba(255,255,255,.15);color:#f0ede6;font-size:14px;font-weight:700;padding:6px 10px;border-radius:6px;text-align:right;outline:none">`;
    return `<div style="position:sticky;top:0;z-index:5;background:#1b1d22;border:1px solid var(--gold-line,#3a3f48);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;gap:22px;flex-wrap:wrap;align-items:flex-end">
      <div style="font-weight:800;color:#e9ebee;align-self:center">全域參數<br><span style="font-size:11px;color:#8a8a8a;font-weight:400">所有標的共用</span></div>
      <label style="font-size:12.5px;color:#b9b4a9">質借成數(%)<br>${inp('ltv', st.ltv, '可借款＝擔保品現值×成數，台股常見約60%')}</label>
      <label style="font-size:12.5px;color:#b9b4a9">追繳線(%)<br>${inp('callRatio', st.callRatio, '維持率低於此→追繳')}</label>
      <label style="font-size:12.5px;color:#b9b4a9">處分線(%)<br>${inp('liqRatio', st.liqRatio, '維持率低於此→斷頭處分')}</label>
      <div style="font-size:12px;color:#8a8a8a;align-self:center;max-width:300px">每位持有人填「目前借款」即顯示<b style="color:#8fc0f0">目前維持率</b>；借滿成數時維持率＝<b style="color:#8fc0f0">${Math.round(10000 / st.ltv)}%</b>。</div>
    </div>`;
  }

  // 每檔（點開看「單獨質押此檔借滿」的追繳/處分價，純參考）
  function holdingRow(h, hld) {
    const key = h + '|' + hld.symbol, d = calcHolding(hld), open = !!st.open[key];
    const dp = hld.price < 1000 ? 2 : 0;
    const cell = (txt, w, col) => `<div style="flex:0 0 ${w};text-align:right;font-family:var(--mono,monospace)${col ? ';color:' + col : ''}">${txt}</div>`;
    const head = `<div data-toggle="${esc(key)}" style="display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;border-top:1px solid rgba(255,255,255,.06)">
      <div style="flex:0 0 14px;color:#8a8a8a">${open ? '▾' : '▸'}</div>
      <div style="flex:1;min-width:150px"><b style="color:#f0ede6">${esc(hld.symbol)}</b> <span style="color:#9aa1ab">${esc(hld.name)}</span></div>
      ${cell(d.lots + ' 張', '64px', '#b9b4a9')}
      ${cell(price(hld.price, dp), '84px', '#b9b4a9')}
      ${cell(money(d.collateral), '120px', '#cfe8d6')}
      ${cell(money(d.maxLoan), '120px', '#8fc0f0')}
    </div>`;
    if (!open) return `<div data-key="${esc(key)}">${head}</div>`;
    // 單獨質押此檔借滿：追繳/處分價 = 現價 × 成數 × (追繳或處分線) / 10000
    const pCall = hld.price * st.ltv * st.callRatio / 10000, pLiq = hld.price * st.ltv * st.liqRatio / 10000;
    const detail = `<div style="padding:8px 14px 12px 36px;background:#17181c;border-top:1px dashed rgba(255,255,255,.08);font-size:12.5px;color:#9fb3a8">
      單獨質押此檔 ${d.lots} 張、借滿 ${money(d.maxLoan)}（維持率 ${Math.round(10000 / st.ltv)}%）：
      追繳價 <b style="color:#e8944a">${price(pCall, dp)}</b>（跌 ${((1 - pCall / hld.price) * 100).toFixed(1)}%）
      · 處分價 <b style="color:#e8675a">${price(pLiq, dp)}</b>（跌 ${((1 - pLiq / hld.price) * 100).toFixed(1)}%）
    </div>`;
    return `<div data-key="${esc(key)}">${head}${detail}</div>`;
  }

  function holderSection(h, syms) {
    const list = Object.values(syms).filter(x => x.shares >= LOT).sort((a, b) => a.symbol.localeCompare(b.symbol));
    if (!list.length) return '';
    let coll = 0, maxL = 0;
    list.forEach(x => { const d = calcHolding(x); coll += d.collateral; maxL += d.maxLoan; });
    const loan = Number(st.loans[h]) || 0;
    const ratio = loan > 0 ? coll / loan * 100 : Infinity;
    const sA = statusOf(ratio, loan, st.callRatio, st.liqRatio);
    const callLine = loan * st.callRatio / 100, liqLine = loan * st.liqRatio / 100;
    const dropCall = loan > 0 && coll > 0 ? Math.max(0, (coll - callLine) / coll * 100) : 0;
    const dropLiq = loan > 0 && coll > 0 ? Math.max(0, (coll - liqLine) / coll * 100) : 0;
    const stress = (st.stress[h] == null ? 10 : Number(st.stress[h])) || 0;
    const ratioAfter = loan > 0 ? coll * (1 - stress / 100) / loan * 100 : Infinity;
    const sB = statusOf(ratioAfter, loan, st.callRatio, st.liqRatio);

    const loanBar = `<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;padding:12px 16px;background:#1b1d22;border-bottom:1px solid #2e3036">
      <label style="font-size:12.5px;color:#b9b4a9">目前借款(TWD)<br>
        <input type="number" min="0" step="1000" value="${loan || ''}" placeholder="填入實際借款" data-loan="${esc(h)}"
          style="width:160px;background:#2c2b27;border:1px solid rgba(255,255,255,.15);color:#f0ede6;font-size:14px;padding:6px 10px;border-radius:6px;text-align:right;font-family:var(--mono,monospace);outline:none">
        <button data-fill="${esc(h)}" title="借滿可借額度" style="margin-left:6px;background:none;border:1px solid rgba(143,192,240,.5);color:#8fc0f0;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer">借滿 ${money(maxL)}</button></label>
      <div style="font-size:12.5px;color:#b9b4a9">目前維持率<br>
        <span style="font-size:24px;font-weight:800;color:${sA.color};font-family:var(--mono,monospace)">${loan > 0 && isFinite(ratio) ? ratio.toFixed(1) + '%' : '—'}</span>
        <span style="background:${sA.color}22;color:${sA.color};padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700;margin-left:4px">${sA.status}</span></div>
      ${loan > 0 ? `<div style="font-size:12px;color:#9fb3a8;align-self:center">到追繳線還能跌 <b style="color:#e8944a">${dropCall.toFixed(1)}%</b> · 到處分線 <b style="color:#e8675a">${dropLiq.toFixed(1)}%</b><br>
        再跌 <input type="number" min="0" max="99" step="1" value="${stress}" data-stress="${esc(h)}" style="width:56px;background:#2c2b27;border:1px solid rgba(255,255,255,.15);color:#f0ede6;font-size:12px;padding:3px 6px;border-radius:5px;text-align:right;outline:none">% → 維持率 <b style="color:${sB.color}">${isFinite(ratioAfter) ? ratioAfter.toFixed(1) + '%' : '—'}</b> ${sB.status}</div>` : '<div style="font-size:12px;color:#8a8a8a;align-self:center">填入目前借款即顯示目前維持率</div>'}
    </div>`;

    return `<div class="bg-slate-800 border border-slate-700 rounded-lg shadow-xl mb-5" style="overflow:hidden;border-left:4px solid ${loan > 0 ? sA.color : '#2e3036'}">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 16px;background:linear-gradient(180deg,#232428,#1c1d21);border-bottom:1px solid #2e3036">
        <div style="font-size:16px;font-weight:800;color:#f0ede6">👤 ${esc(h)}</div>
        <div style="font-size:12.5px;color:#9aa1ab">可質押 ${list.length} 檔</div>
        <div style="margin-left:auto;font-size:12.5px;color:#b9b4a9">擔保品現值 <b style="color:#cfe8d6;font-family:var(--mono,monospace)">${money(coll)}</b> · 可借款 <b style="color:#8fc0f0;font-family:var(--mono,monospace)">${money(maxL)}</b></div>
      </div>
      ${loanBar}
      <div style="display:flex;align-items:center;gap:10px;padding:6px 12px;color:#8a8a8a;font-size:11.5px;border-bottom:1px solid rgba(255,255,255,.06)">
        <div style="flex:0 0 14px"></div><div style="flex:1;min-width:150px">擔保品明細（點開看單檔追繳/處分價）</div>
        <div style="flex:0 0 64px;text-align:right">張數</div><div style="flex:0 0 84px;text-align:right">現價</div>
        <div style="flex:0 0 120px;text-align:right">現值</div><div style="flex:0 0 120px;text-align:right">可借款</div>
      </div>
      ${list.map(x => holdingRow(h, x)).join('')}
    </div>`;
  }

  function renderSummary(hh) {
    const box = document.getElementById('pl-summary'); if (!box) return;
    let coll = 0, maxL = 0, cnt = 0, holders = 0, loanSum = 0, collLoaned = 0;
    Object.keys(hh).forEach(h => {
      const list = Object.values(hh[h]).filter(x => x.shares >= LOT);
      if (!list.length) return; holders++;
      let hc = 0; list.forEach(x => { const d = calcHolding(x); coll += d.collateral; maxL += d.maxLoan; hc += d.collateral; cnt++; });
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
    root.onchange = e => {
      const t = e.target; if (!t.dataset) return;
      if (t.dataset.g) { st[t.dataset.g] = parseFloat(t.value) || 0; save(); render(); return; }
      if (t.dataset.loan != null) { st.loans[t.dataset.loan] = t.value === '' ? 0 : (parseFloat(t.value) || 0); save(); render(); return; }
      if (t.dataset.stress != null) { st.stress[t.dataset.stress] = parseFloat(t.value) || 0; save(); render(); return; }
    };
    root.onclick = e => {
      const tog = e.target.closest('[data-toggle]');
      if (tog) { const k = tog.dataset.toggle; st.open[k] = !st.open[k]; save(); render(); return; }
      const fill = e.target.closest('[data-fill]');
      if (fill) {
        const h = fill.dataset.fill, hh = holderHoldings();
        let maxL = 0; Object.values(hh[h] || {}).filter(x => x.shares >= LOT).forEach(x => maxL += calcHolding(x).maxLoan);
        st.loans[h] = Math.round(maxL); save(); render();
      }
    };
  }

  window.pledgeRender = render;
})();
