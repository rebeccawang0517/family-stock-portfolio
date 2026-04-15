    (function(){
    const CF_STORE='cf_v9';
    const FREQS={weekly:'每週',monthly:'每月',quarterly:'每季',yearly:'每年',once:'單次'};
    const ETYPES={general:'一般',loan_mortgage:'房貸',loan_credit:'信貸',loan_other:'其他貸款'};
    const LOAN_TYPES=['loan_mortgage','loan_credit','loan_other'];
    const FUND_SOURCES=['薪資','信貸','信用額度','其他'];
    const FREQS_LIST=Object.entries(FREQS);
    const ETYPES_LIST=Object.entries(ETYPES);
    let cfYear=new Date().getFullYear();
    let cfMembers=['Rebecca','Eric','Ian','弟弟'];
    let cfIncome=[
      {id:'i1',name:'Rebecca 薪資',owner:'Rebecca',freq:'monthly',amt:''},
      {id:'i2',name:'Eric 薪資',owner:'Eric',freq:'monthly',amt:''},
      {id:'i3',name:'租金收入',owner:'Rebecca',freq:'monthly',amt:''},
      {id:'i4',name:'股票配息',owner:'Rebecca',freq:'yearly',amt:''},
      {id:'i5',name:'年終獎金',owner:'Eric',freq:'yearly',amt:''},
    ];
    let cfExpense=[
      {id:'e1',name:'禾川琚房貸',owner:'Rebecca',etype:'loan_mortgage',freq:'monthly',amt:'',loanData:null},
      {id:'e2',name:'上城房貸',owner:'Eric',etype:'loan_mortgage',freq:'monthly',amt:'',loanData:null},
      {id:'e3',name:'信貸還款',owner:'Rebecca',etype:'loan_credit',freq:'monthly',amt:'',loanData:null},
      {id:'e4',name:'水電瓦斯網路',owner:'Rebecca',etype:'general',freq:'monthly',amt:''},
      {id:'e5',name:'學費／安親班',owner:'Rebecca',etype:'general',freq:'monthly',amt:''},
      {id:'e6',name:'才藝課外活動',owner:'Rebecca',etype:'general',freq:'monthly',amt:''},
      {id:'e7',name:'嬰幼兒耗材',owner:'Rebecca',etype:'general',freq:'monthly',amt:''},
      {id:'e8',name:'保險費',owner:'Rebecca',etype:'general',freq:'yearly',amt:''},
    ];
    let cfBanks=['台新','中信','富邦','玉山','遠東'];
    let cfCards=[
      {id:'cr1',bank:'台新',owner:'Rebecca',month:'',amt:''},
      {id:'cr2',bank:'富邦',owner:'Eric',month:'',amt:''},
      {id:'cr3',bank:'中信',owner:'Eric',month:'',amt:''},
      {id:'cr4',bank:'玉山',owner:'Rebecca',month:'',amt:''},
    ];
    function bankOpts(sel){
      const list=[...cfBanks];
      if(sel&&!list.includes(sel))list.push(sel);
      return list.map(b=>`<option value="${b}"${b===sel?' selected':''}>${b}</option>`).join('')+`<option value="__other"${!sel?' selected':''}>其他...</option>`;
    }
    let cfInvest=[
      {id:'iv1',name:'信貸投入股市',owner:'Rebecca',freq:'once',amt:'',src:'信貸'},
      {id:'iv2',name:'定期定額',owner:'Rebecca',freq:'monthly',amt:'',src:'薪資'},
    ];
    let cfRedeem=[
      {id:'rd1',name:'股票賣出回收',owner:'Rebecca',freq:'once',amt:'',src:'tx'},
    ];
    let cfCtr=200;
    function nid(p){return p+(++cfCtr);}
    function toMo(amt,freq){
      const a=parseFloat(amt)||0;
      if(freq==='weekly')return a*52/12;
      if(freq==='monthly')return a;
      if(freq==='quarterly')return a/3;
      if(freq==='yearly')return a/12;
      return 0;
    }
    function cfFmt(n){return (n<0?'-':'')+'$'+Math.abs(Math.round(n)).toLocaleString();}
    function cfGetAmt(r){if(r.years&&r.years[cfYear]!==undefined)return r.years[cfYear];return r.amt||'';}
    function cfSetAmt(r,v){if(!r.years)r.years={};r.years[cfYear]=v;r.amt=v;}
    function mOpts(sel){return [...cfMembers,'共同'].map(m=>`<option value="${m}"${m===sel?' selected':''}>${m}</option>`).join('');}
    function fOpts(sel){return FREQS_LIST.map(([v,l])=>`<option value="${v}"${v===sel?' selected':''}>${l}</option>`).join('');}
    function eOpts(sel){return ETYPES_LIST.map(([v,l])=>`<option value="${v}"${v===sel?' selected':''}>${l}</option>`).join('');}
    function srcOpts(sel){return FUND_SOURCES.map(s=>`<option value="${s}"${s===sel?' selected':''}>${s}</option>`).join('');}
    function isLoan(et){return LOAN_TYPES.includes(et);}

    const CF_CSS=`.cf-tbl{width:100%;border-collapse:collapse;table-layout:fixed}.cf-tbl th{font-size:10px;color:#9a9890;font-weight:400;padding:3px 5px;text-align:left;border-bottom:1px solid rgba(26,25,22,.1);letter-spacing:.04em}.cf-tbl th.r{text-align:right}.cf-tbl td{border-bottom:1px solid rgba(26,25,22,.08);padding:0 2px;vertical-align:middle}.cf-tbl tr:last-child td{border-bottom:none}.cf-tbl tr.cf-sub td{background:#f5f4f0;border-top:1px solid rgba(26,25,22,.15);border-bottom:none}.cf-te{width:100%;border:none;background:transparent;font-size:13px;color:#1a1916;outline:none;padding:7px 4px;font-family:inherit}.cf-te:focus{background:#f5f4f0;border-radius:4px}.cf-te.r{text-align:right;font-family:'Courier New',monospace}.cf-sel{width:100%;border:1px solid rgba(26,25,22,.18);background:#f5f4f0;color:#1a1916;font-size:11px;padding:4px 3px;border-radius:4px;outline:none;font-family:inherit}.cf-del{width:18px;height:18px;border-radius:50%;border:1px solid rgba(26,25,22,.18);background:transparent;color:#9a9890;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;margin:auto;flex-shrink:0}.cf-del:hover{background:#b83030;color:#fff;border-color:#b83030}.cf-add-btn{display:flex;align-items:center;gap:5px;font-size:11px;color:#9a9890;cursor:pointer;padding:6px 4px;background:none;border:none;width:100%;font-family:inherit;letter-spacing:.02em}.cf-add-btn:hover{color:#5a5852}.cf-loan-btn{background:none;border:1px solid rgba(26,25,22,.18);color:#9a9890;font-size:10px;padding:2px 5px;border-radius:3px;cursor:pointer;white-space:nowrap;font-family:inherit;flex-shrink:0}.cf-loan-btn:hover{background:#f5f4f0;color:#5a5852}.cf-sec{display:flex;align-items:center;gap:10px;margin:1.5rem 0 .5rem;padding-bottom:5px;border-bottom:1px solid rgba(26,25,22,.15)}.cf-sec-lbl{font-size:10px;font-weight:500;color:#9a9890;letter-spacing:.1em;text-transform:uppercase}.cf-sec-bar{flex:1;height:1px;background:rgba(26,25,22,.08)}.cf-sec-tot{font-size:11px;font-family:'Courier New',monospace;color:#5a5852}.cf-metric{background:#f5f4f0;border-radius:6px;padding:12px 14px;border:1px solid rgba(26,25,22,.1)}.cf-metric-lbl{font-size:10px;color:#9a9890;margin-bottom:4px;letter-spacing:.04em;text-transform:uppercase}.cf-metric-val{font-size:17px;font-weight:500;font-family:'Courier New',monospace}.cf-bar-track{flex:1;height:5px;background:#eceae4;border-radius:3px;overflow:hidden}.cf-bar-fill{height:100%;border-radius:3px;transition:width .4s ease}.cf-mtag{display:inline-flex;align-items:center;gap:4px;background:#f5f4f0;border:1px solid rgba(26,25,22,.15);border-radius:20px;padding:3px 10px;font-size:12px;color:#5a5852}.cf-mdel{background:none;border:none;cursor:pointer;color:#9a9890;font-size:12px;line-height:1;padding:0 0 0 2px;font-family:inherit}.cf-mdel:hover{color:#b83030}.cf-sub-lbl{font-size:11px;color:#9a9890;padding:7px 5px;text-align:right}.cf-sub-val{font-size:12px;font-weight:500;font-family:'Courier New',monospace;text-align:right;padding:7px 5px;color:#1a1916}`;
    if(!document.getElementById('cf-style')){const st=document.createElement('style');st.id='cf-style';st.textContent=CF_CSS;document.head.appendChild(st);}

    function cfRenderMembers(){
      const el=document.getElementById('cf-member-tags');if(!el)return;
      el.innerHTML=cfMembers.map(m=>`<span class="cf-mtag">${m}<button class="cf-mdel" onclick="cfDelMember('${m}')">×</button></span>`).join('');
      cfRenderAll();
    }
    window.cfDelMember=function(m){cfMembers=cfMembers.filter(x=>x!==m);cfSave();cfRenderMembers();};
    window.cfAddMember=function(){
      const el=document.getElementById('cf-new-member');const v=el.value.trim();
      if(v&&!cfMembers.includes(v)){cfMembers.push(v);el.value='';cfSave();cfRenderMembers();}
    };

    // 收入按月記錄，每項有 monthly: {"2026-01": "50000", ...}
    function cfIncomeMonthAmt(r,ym){return r.monthly?.[ym]??'';}
    function cfIncomeMonthTotal(ym){return cfIncome.reduce((s,r)=>s+(parseFloat(cfIncomeMonthAmt(r,ym))||0),0);}
    function expenseRow(r){
      const a=cfGetAmt(r);const mo=r.freq==='once'?'—':cfFmt(toMo(a,r.freq));
      const et=r.etype||'general';
      const typeLabel = et === 'general' ? '一般' : et === 'loan_mortgage' ? '房貸' : et === 'loan_personal' ? '信貸' : '其他';
      const freqLabel = r.freq === 'monthly' ? '月' : r.freq === 'quarterly' ? '季' : r.freq === 'annually' ? '年' : '單次';
      const displayName = `${r.name} (${typeLabel}·${r.owner}·${freqLabel})`;
      // 所有支出行都打開統一的編輯對話框
      const nameCell=`<span onclick="cfOpenUnifiedExpenseModal('${r.id}')" style="cursor:pointer;color:#c8b89a;text-decoration:underline;font-size:12px;display:inline-block;padding:4px 0" title="點擊編輯">${displayName}</span>`;
      return `<tr id="tr-${r.id}">
        <td colspan="5">${nameCell}</td>
        <td><input class="cf-te r" type="number" id="cf-amt-${r.id}" value="${a}" placeholder="0" oninput="cfSa('expense','${r.id}',this.value)"></td>
        <td style="text-align:right;font-size:12px;font-family:'Courier New',monospace;color:#9a9890;padding:7px 4px" id="cf-mo-${r.id}">${mo}</td>
        <td><button class="cf-del" onclick="cfDelRow('expense','${r.id}')">×</button></td>
      </tr>`;
    }
    function investRow(r,type){
      const mo=r.freq==='once'?'—':cfFmt(toMo(r.amt,r.freq));
      return `<tr><td colspan="2"><input class="cf-te" value="${r.name}" placeholder="項目說明" oninput="cfSf('${type}','${r.id}','name',this.value)"></td><td><select class="cf-sel" onchange="cfSf('${type}','${r.id}','owner',this.value)">${mOpts(r.owner)}</select></td><td><select class="cf-sel" onchange="cfSfq('${type}','${r.id}',this.value)">${fOpts(r.freq)}</select></td><td><input class="cf-te r" type="number" value="${r.amt}" placeholder="0" oninput="cfSa('${type}','${r.id}',this.value)"></td><td style="text-align:right;font-size:12px;font-family:'Courier New',monospace;color:#9a9890;padding:7px 4px" id="cf-mo-${r.id}">${mo}</td><td></td><td><button class="cf-del" onclick="cfDelRow('${type}','${r.id}')">×</button></td></tr>`;
    }
    function subRow(val,label,colspan,extra){
      return `<tr class="cf-sub"><td colspan="${colspan}" class="cf-sub-lbl">${label}</td><td class="cf-sub-val">${cfFmt(val)}</td>${extra||''}</tr>`;
    }

    function cfRenderIncome(){
      const el=document.getElementById('cf-income-body');if(!el)return;
      const yrStr=String(cfYear);
      let yearTotal=0;
      let html='';
      for(let m=1;m<=12;m++){
        const ym=yrStr+'-'+String(m).padStart(2,'0');
        const mTot=cfIncomeMonthTotal(ym);
        yearTotal+=mTot;
        const cnt=cfIncome.filter(r=>parseFloat(cfIncomeMonthAmt(r,ym))||0).length;
        const label=yrStr+'年'+String(m).padStart(2,'0')+'月';
        html+=`<tr onclick="cfOpenIncomeMonth('${ym}')" style="cursor:pointer" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background=''">
          <td colspan="3" style="padding:8px 5px;font-size:13px;color:#c8b89a;font-weight:500">${label}</td>
          <td style="font-size:12px;color:#9a9890;padding:8px 4px">${cnt} 筆</td>
          <td colspan="2" style="text-align:right;font-size:13px;font-family:var(--mono);color:${mTot?'#4aad6e':'#9a9890'};padding:8px 4px">${mTot?cfFmt(mTot):'—'}</td>
          <td></td><td></td></tr>`;
      }
      // 如果全年無資料，顯示複製上年度按鈕
      if(yearTotal===0){
        const prevYr=String(cfYear-1);
        let prevTotal=0;
        for(let m=1;m<=12;m++){prevTotal+=cfIncomeMonthTotal(prevYr+'-'+String(m).padStart(2,'0'));}
        if(prevTotal>0){
          html+=`<tr><td colspan="8" style="padding:10px 5px;text-align:center">
            <button onclick="cfCopyIncomeFromYear(${cfYear-1})" style="background:#2c2b27;border:1px solid rgba(255,255,255,.15);color:#c8b89a;padding:8px 18px;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit">📋 複製 ${prevYr} 年收入資料</button>
          </td></tr>`;
        }
      }
      html+=subRow(yearTotal,'年收入合計',5,'<td colspan="2"></td>');
      el.innerHTML=html;
      const moAvg=yearTotal/12;
      const st=document.getElementById('cf-st-income');if(st)st.textContent=cfFmt(moAvg)+'/月均';
    }
    window.cfCopyIncomeFromYear=function(fromYr){
      const fromStr=String(fromYr);const toStr=String(cfYear);
      cfIncome.forEach(r=>{
        if(!r.monthly)return;
        for(let m=1;m<=12;m++){
          const mm=String(m).padStart(2,'0');
          const fromKey=fromStr+'-'+mm;const toKey=toStr+'-'+mm;
          if(r.monthly[fromKey]&&!r.monthly[toKey]){
            r.monthly[toKey]=r.monthly[fromKey];
          }
        }
      });
      cfSave();cfRenderIncome();cfCalc();
    };
    // 收入月份彈窗
    window.cfOpenIncomeMonth=function(ym){
      const label=ym.replace('-','年')+'月';
      const wrap=document.createElement('div');
      wrap.id='cf-income-modal-overlay';
      wrap.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:9999;padding:12px';
      wrap.onclick=function(e){if(e.target===wrap)cfCloseIncomeModal();};
      const iS='border:1px solid rgba(26,25,22,.15);background:#f5f4f0;color:#1a1916;padding:5px 6px;border-radius:4px;outline:none;box-sizing:border-box;font-family:inherit;font-size:12px;width:100%;';
      const hS='font-size:11px;color:#9a9890;font-weight:600;padding:0 0 6px;';
      const cW=['flex:4 0 0','flex:2 0 0','flex:3 0 0'];
      const rowS='display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(26,25,22,.06)';
      function render(){
        const tot=cfIncomeMonthTotal(ym);
        return `<div style="background:#fff;border-radius:8px;padding:1.25rem;width:460px;max-width:100%;max-height:85vh;overflow-y:auto;font-family:inherit;box-sizing:border-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <div style="font-size:16px;font-weight:600;color:#1a1916">${label} 收入明細</div>
            <button onclick="cfCloseIncomeModal()" style="background:none;border:none;color:#9a9890;font-size:18px;cursor:pointer;line-height:1;padding:4px 8px">×</button>
          </div>
          <div style="display:flex;gap:8px;padding:0 0 4px;border-bottom:1px solid rgba(26,25,22,.15);margin-bottom:2px">
            <div style="${hS}${cW[0]}">項目</div>
            <div style="${hS}${cW[1]}">負責人</div>
            <div style="${hS}${cW[2]};text-align:right">金額</div>
            <div style="width:24px;flex-shrink:0"></div>
          </div>
          ${cfIncome.map(r=>{const v=cfIncomeMonthAmt(r,ym);return `<div style="${rowS}">
            <div style="${cW[0]}"><input value="${r.name}" placeholder="項目名稱" oninput="cfIncomeEditName('${r.id}',this.value)" style="${iS}"></div>
            <div style="${cW[1]}"><select onchange="cfIncomeEditOwner('${r.id}',this.value)" style="${iS}">${mOpts(r.owner)}</select></div>
            <div style="${cW[2]}"><input type="number" value="${v}" placeholder="0" oninput="cfIncomeEditAmt('${r.id}','${ym}',this.value)" style="${iS}text-align:right;font-family:var(--mono)"></div>
            <div style="width:24px;flex-shrink:0;text-align:center"><button onclick="cfIncomeDelRow('${r.id}')" style="background:none;border:none;color:#c0392b;font-size:14px;cursor:pointer;padding:0">×</button></div>
          </div>`;}).join('')}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid rgba(26,25,22,.1)">
            <button onclick="cfIncomeAddRow()" style="background:transparent;color:#1a1916;border:1px dashed rgba(26,25,22,.25);border-radius:4px;padding:6px 14px;font-size:12px;cursor:pointer;font-family:inherit">+ 新增項目</button>
            <div style="font-size:14px;font-weight:600;color:#1a1916;font-family:var(--mono)" id="cf-income-modal-total">合計 ${cfFmt(tot)}</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:1rem;justify-content:flex-end">
            <button onclick="cfCloseIncomeModal()" style="background:#1a1916;color:#fff;border:none;border-radius:4px;padding:8px 20px;font-size:13px;cursor:pointer;font-family:inherit">完成</button>
          </div>
        </div>`;
      }
      wrap.innerHTML=render();
      document.body.appendChild(wrap);
      window._cfIncomeModalYM=ym;
      window._cfIncomeModalRender=function(){const el=document.getElementById('cf-income-modal-overlay');if(el)el.innerHTML=render();};
    };
    window.cfCloseIncomeModal=function(){
      cfRenderIncome();cfCalc();
      const el=document.getElementById('cf-income-modal-overlay');if(el)el.remove();
    };
    window.cfIncomeEditName=function(id,v){const r=cfIncome.find(x=>x.id===id);if(r)r.name=v;cfSave();};
    window.cfIncomeEditOwner=function(id,v){const r=cfIncome.find(x=>x.id===id);if(r)r.owner=v;cfSave();};
    window.cfIncomeEditAmt=function(id,ym,v){
      const r=cfIncome.find(x=>x.id===id);if(!r)return;
      if(!r.monthly)r.monthly={};
      r.monthly[ym]=v;
      cfSave();
      // 即時更新合計
      const tot=cfIncomeMonthTotal(ym);
      const totEl=document.getElementById('cf-income-modal-total');
      if(totEl)totEl.textContent='合計 '+cfFmt(tot);
    };
    window.cfIncomeAddRow=function(){
      cfIncome.push({id:nid('i'),name:'',owner:cfMembers[0]||'Rebecca',freq:'monthly',amt:'',monthly:{}});
      cfSave();window._cfIncomeModalRender();
    };
    window.cfIncomeDelRow=function(id){
      cfIncome=cfIncome.filter(x=>x.id!==id);cfSave();window._cfIncomeModalRender();
    };

    function cfRenderExpense(){
      const el=document.getElementById('cf-expense-body');if(!el)return;
      const tot=cfExpense.reduce((s,r)=>s+toMo(cfGetAmt(r),r.freq),0);
      // 按類型排序：房貸→信貸→其他貸款→一般
      const order={loan_mortgage:0,loan_credit:1,loan_other:2,general:3};
      const sorted=[...cfExpense].sort((a,b)=>(order[a.etype||'general']??3)-(order[b.etype||'general']??3));
      let html=sorted.map(r=>expenseRow(r)).join('');
      // 如果該年度所有支出都沒有設定金額，顯示複製按鈕
      const hasYearData=cfExpense.some(r=>r.years&&r.years[cfYear]!==undefined);
      if(!hasYearData&&cfYear!==new Date().getFullYear()){
        const prevYr=cfYear-1;
        const prevHasData=cfExpense.some(r=>(r.years&&r.years[prevYr]!==undefined)||(r.amt&&!r.years));
        if(prevHasData){
          html+=`<tr><td colspan="8" style="padding:10px 5px;text-align:center">
            <button onclick="cfCopyExpenseFromYear(${prevYr})" style="background:#2c2b27;border:1px solid rgba(255,255,255,.15);color:#c8b89a;padding:8px 18px;border-radius:6px;font-size:13px;cursor:pointer;font-family:inherit">📋 複製 ${prevYr} 年支出資料</button>
          </td></tr>`;
        }
      }
      html+=subRow(tot,'月支出小計',5,'<td colspan="2"></td>');
      el.innerHTML=html;
      const st=document.getElementById('cf-st-expense');if(st)st.textContent=cfFmt(tot)+'/月';
    }
    window.cfCopyExpenseFromYear=function(fromYr){
      cfExpense.forEach(r=>{
        if(!r.years)r.years={};
        const src=r.years[fromYr]!==undefined?r.years[fromYr]:r.amt;
        if(src&&r.years[cfYear]===undefined)r.years[cfYear]=src;
      });
      cfSave();cfRenderExpense();cfCalc();
    };
    function cfRenderCards(){
      const el=document.getElementById('cf-card-body');if(!el)return;
      const yrStr=String(cfYear);
      const yrCards=cfCards.filter(r=>(r.month||'').startsWith(yrStr));
      const tot=yrCards.reduce((s,r)=>s+(parseFloat(r.amt)||0),0);
      // group by month
      const byMonth={};
      yrCards.forEach(r=>{const m=r.month||'';if(!byMonth[m])byMonth[m]=[];byMonth[m].push(r);});
      const months=Object.keys(byMonth).sort().reverse();
      let html=months.map(m=>{
        const items=byMonth[m];
        const mTot=items.reduce((s,r)=>s+(parseFloat(r.amt)||0),0);
        const label=m.length===7?(m.replace('-','年')+'月'):(m||'未分類');
        return `<tr onclick="cfOpenMonth('${m}')" style="cursor:pointer" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background=''">
          <td colspan="3" style="padding:8px 5px;font-size:13px;color:#c8b89a;font-weight:500">${label}</td>
          <td style="font-size:12px;color:#9a9890;padding:8px 4px">${items.length} 筆</td>
          <td colspan="2" style="text-align:right;font-size:13px;font-family:var(--mono);color:#f0ede6;padding:8px 4px">${cfFmt(mTot)}</td>
          <td></td><td></td></tr>`;
      }).join('');
      if(!months.length) html=`<tr><td colspan="8" style="padding:12px 5px;font-size:12px;color:#9a9890;text-align:center">${yrStr} 年尚無帳單</td></tr>`;
      html+=subRow(tot,'帳單合計',5,'<td colspan="2"></td>');
      el.innerHTML=html;
      const st=document.getElementById('cf-st-card');if(st)st.textContent=cfFmt(tot)+'/年';
    }
    function cfRenderInvest(){
      const el=document.getElementById('cf-invest-body');if(!el)return;
      const txs=window._cfTransactions||[];
      const usdRate=parseFloat(document.getElementById('usdRate')?.value)||31.5;
      const yrStr=String(cfYear);
      // 按月份彙總交易（篩選年度）
      const byMonth={};
      txs.forEach(t=>{
        if(!t.date||!t.date.startsWith(yrStr))return;
        const m=t.date.slice(0,7);
        if(!byMonth[m])byMonth[m]={buyCnt:0,sellCnt:0,buyAmt:0,sellAmt:0};
        const amt=(parseFloat(t.shares)||0)*(parseFloat(t.price)||0);
        const twd=t.region==='美股'?amt*usdRate:amt;
        if(t.type==='買入'){byMonth[m].buyCnt++;byMonth[m].buyAmt+=twd;}
        else if(t.type==='賣出'){byMonth[m].sellCnt++;byMonth[m].sellAmt+=twd;}
      });
      const months=Object.keys(byMonth).sort().reverse();
      let totalBuy=0,totalSell=0;
      let html=months.map(m=>{
        const d=byMonth[m];totalBuy+=d.buyAmt;totalSell+=d.sellAmt;
        const net=d.buyAmt-d.sellAmt;
        const label=m.replace('-','年')+'月';
        return `<tr>
          <td colspan="2" style="padding:7px 5px;font-size:13px;color:#ccc9bf">${label}</td>
          <td style="font-size:12px;color:#9a9890;padding:7px 4px">${d.buyCnt} 筆</td>
          <td style="font-size:12px;color:#9a9890;padding:7px 4px">${d.sellCnt} 筆</td>
          <td style="text-align:right;font-size:12px;font-family:var(--mono);color:#e8675a;padding:7px 2px">${d.buyAmt?cfFmt(d.buyAmt):''}</td>
          <td style="text-align:right;font-size:12px;font-family:var(--mono);color:#4aad6e;padding:7px 2px">${d.sellAmt?cfFmt(d.sellAmt):''}</td>
          <td style="text-align:right;font-size:12px;font-family:var(--mono);color:${net>0?'#e8675a':'#4aad6e'};padding:7px 2px">${cfFmt(net)}</td>
          <td></td></tr>`;
      }).join('');
      if(!months.length) html=`<tr><td colspan="8" style="padding:12px 5px;font-size:12px;color:#9a9890;text-align:center">尚無交易記錄</td></tr>`;
      const totalNet=totalBuy-totalSell;
      html+=`<tr class="cf-sub"><td colspan="4" class="cf-sub-lbl">合計</td><td class="cf-sub-val" style="color:#e8675a">${cfFmt(totalBuy)}</td><td class="cf-sub-val" style="color:#4aad6e">${cfFmt(totalSell)}</td><td class="cf-sub-val" style="color:${totalNet>0?'#e8675a':'#4aad6e'}">${cfFmt(totalNet)}</td><td></td></tr>`;
      el.innerHTML=html;
      const st=document.getElementById('cf-st-invest');if(st)st.textContent='淨流出 '+cfFmt(totalNet);
      // 更新 cfInvest/cfRedeem 給 cfCalc 用（月均化：該年度月平均）
      const moCount=months.length||1;
      const curD={buyAmt:totalBuy/moCount,sellAmt:totalSell/moCount};
      cfInvest=[{id:'iv-auto',name:'交易買入',owner:'共同',freq:'monthly',amt:String(Math.round(curD.buyAmt)),src:'tx'}];
      cfRedeem=[{id:'rd-auto',name:'交易賣出',owner:'共同',freq:'monthly',amt:String(Math.round(curD.sellAmt)),src:'tx'}];
    }
    window.cfSyncTxInvest=function(btn){
      if(btn){btn.disabled=true;btn.textContent='✓ 已更新';btn.style.opacity='.6';}
      cfRenderInvest();cfCalc();
      setTimeout(()=>{if(btn){btn.disabled=false;btn.textContent='↻ 更新交易連動';btn.style.opacity='1';}},1200);
    };
    function cfRenderAll(){
      // 先暴露資料給資產總覽，確保不被後續渲染錯誤阻斷
      window.cfMembersRef=cfMembers;window.cfExpenseRef=cfExpense;window.cfCardsRef=cfCards;
      cfInitYearSelect();
      try{cfRenderIncome();cfRenderExpense();cfRenderCards();cfRenderInvest();cfCalc();}
      catch(e){console.error('cfRenderAll error:',e);}
    }
    function cfInitYearSelect(){
      const sel=document.getElementById('cf-year-select');if(!sel)return;
      const yrs=new Set();
      const now=new Date().getFullYear();
      yrs.add(now);yrs.add(now+1); // 永遠包含明年
      cfCards.forEach(r=>{if(r.month)yrs.add(parseInt(r.month.slice(0,4)));});
      (window._cfTransactions||[]).forEach(t=>{if(t.date)yrs.add(parseInt(t.date.slice(0,4)));});
      // 從收入 monthly 中收集年份
      cfIncome.forEach(r=>{if(r.monthly)Object.keys(r.monthly).forEach(ym=>yrs.add(parseInt(ym.slice(0,4))));});
      // 從支出 years 中收集年份
      cfExpense.forEach(r=>{if(r.years)Object.keys(r.years).forEach(y=>yrs.add(parseInt(y)));});
      const sorted=[...yrs].sort((a,b)=>b-a);
      sel.innerHTML=sorted.map(y=>`<option value="${y}"${y===cfYear?' selected':''}>${y} 年</option>`).join('');
    }
    window.cfSwitchYear=function(y){
      cfYear=parseInt(y)||new Date().getFullYear();
      cfRenderIncome();cfRenderExpense();cfRenderCards();cfRenderInvest();cfCalc();
    };

    function cfGetArr(type){return{income:cfIncome,expense:cfExpense,invest:cfInvest,redeem:cfRedeem}[type]||[];}
    window.cfSf=function(type,id,field,v){const r=cfGetArr(type).find(x=>x.id===id);if(r)r[field]=v;cfSave();};
    window.cfSfq=function(type,id,v){
      const r=cfGetArr(type).find(x=>x.id===id);if(r)r.freq=v;
      const mo=document.getElementById('cf-mo-'+id);if(mo&&r)mo.textContent=v==='once'?'—':cfFmt(toMo(cfGetAmt(r),v));
      cfUpdateSubtotal(type);cfCalc();cfSave();
    };
    window.cfSa=function(type,id,v){
      const r=cfGetArr(type).find(x=>x.id===id);if(r)cfSetAmt(r,v);
      const mo=document.getElementById('cf-mo-'+id);if(mo&&r)mo.textContent=r.freq==='once'?'—':cfFmt(toMo(v,r.freq));
      cfUpdateSubtotal(type);cfCalc();cfSave();
    };
    window.cfEtype=function(id,v){
      const r=cfExpense.find(x=>x.id===id);if(!r)return;
      r.etype=v;if(!isLoan(v))r.loanData=null;
      cfRenderExpense();cfCalc();cfSave();
    };
    window.cfScf=function(id,field,v){const r=cfCards.find(x=>x.id===id);if(r)r[field]=v;cfSave();};
    window.cfSca=function(id,v){
      const r=cfCards.find(x=>x.id===id);if(r)r.amt=v;
      cfUpdateSubtotal('card');cfCalc();cfSave();
    };
    function cfUpdateSubtotal(type){
      if(type==='card'){
        const yrStr=String(cfYear);
        const yrCards=cfCards.filter(r=>(r.month||'').startsWith(yrStr));
        const tot=yrCards.reduce((s,r)=>s+(parseFloat(r.amt)||0),0);
        const sub=document.querySelector('#cf-card-body tr.cf-sub td.cf-sub-val');if(sub)sub.textContent=cfFmt(tot);
        const st=document.getElementById('cf-st-card');if(st)st.textContent=cfFmt(tot)+'/年';return;
      }
      const arr=cfGetArr(type);const tot=arr.reduce((s,r)=>s+toMo(cfGetAmt(r),r.freq),0);
      const sub=document.querySelector(`#cf-${type}-body tr.cf-sub td.cf-sub-val`);if(sub)sub.textContent=cfFmt(tot);
      const st=document.getElementById(`cf-st-${type}`);if(st)st.textContent=cfFmt(tot)+'/月';
    }
    window.cfAddRow=function(type){
      const row={id:nid(type[0]),name:'',owner:cfMembers[0]||'Rebecca',freq:'monthly',amt:''};
      if(type==='expense'){row.etype='general';row.loanData=null;}
      if(type==='invest')row.src='薪資';
      if(type==='redeem')row.src='manual';
      cfGetArr(type).push(row);
      const renders={income:cfRenderIncome,expense:cfRenderExpense};
      if(renders[type])renders[type]();cfSave();
    };
    window.cfDelRow=function(type,id){
      if(!confirm('確定要刪除這筆項目嗎？'))return;
      const m={income:()=>cfIncome=cfIncome.filter(x=>x.id!==id),expense:()=>cfExpense=cfExpense.filter(x=>x.id!==id)};
      if(m[type])m[type]();
      const renders={income:cfRenderIncome,expense:cfRenderExpense};
      if(renders[type])renders[type]();cfCalc();cfSave();
    };
    window.cfDelCard=function(id){cfCards=cfCards.filter(x=>x.id!==id);cfRenderCards();cfCalc();cfSave();};
    // 新增帳單：開啟統一彈窗
    window.cfAddCard=function(){
      const now=new Date();
      const defMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      cfOpenCardModal(null,defMonth);
    };
    // 點月份行：開啟該月所有帳單
    window.cfOpenMonth=function(month){cfOpenCardModal(month,month);};
    // 統一信用卡彈窗（filterMonth=null顯示全部，否則篩選該月）
    function cfOpenCardModal(filterMonth,defMonth){
      const wrap=document.createElement('div');
      wrap.id='cf-card-modal-overlay';
      wrap.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:9999;padding:12px';
      wrap.onclick=function(e){if(e.target===wrap)cfCloseCardModal();};
      window._cfCardFilterMonth=filterMonth;
      window._cfCardDefMonth=defMonth;
      function getItems(){
        if(filterMonth)return cfCards.filter(r=>(r.month||'')===filterMonth);
        return cfCards;
      }
      function renderModal(){
        const items=getItems();
        const tot=items.reduce((s,r)=>s+(parseFloat(r.amt)||0),0);
        const title=filterMonth?(filterMonth.replace('-','年')+'月 信用卡帳單'):'信用卡帳單';
        const iS='border:1px solid rgba(26,25,22,.15);background:#f5f4f0;color:#1a1916;padding:5px 6px;border-radius:4px;outline:none;box-sizing:border-box;font-family:inherit;font-size:12px;width:100%;';
        const hS='font-size:11px;color:#9a9890;font-weight:600;padding:0 0 6px;';
        const cW=['flex:3 0 0','flex:3 0 0','flex:2 0 0','flex:2 0 0'];
        const rowS='display:flex;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid rgba(26,25,22,.06)';
        return `<div style="background:#fff;border-radius:8px;padding:1.25rem;width:500px;max-width:100%;max-height:85vh;overflow-y:auto;font-family:inherit;box-sizing:border-box">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <div style="font-size:16px;font-weight:600;color:#1a1916">${title}</div>
            <button onclick="cfCloseCardModal()" style="background:none;border:none;color:#9a9890;font-size:18px;cursor:pointer;line-height:1;padding:4px 8px">×</button>
          </div>
          <div style="display:flex;gap:8px;padding:0 0 4px;border-bottom:1px solid rgba(26,25,22,.15);margin-bottom:2px">
            <div style="${hS}${cW[0]}">銀行</div>
            <div style="${hS}${cW[1]}">帳單月份</div>
            <div style="${hS}${cW[2]}">金額</div>
            <div style="${hS}${cW[3]}">負責人</div>
            <div style="width:24px;flex-shrink:0"></div>
          </div>
          ${items.map(r=>`<div style="${rowS}">
            <div style="${cW[0]}"><select onchange="cfCardBankChange('${r.id}',this)" style="${iS}">${bankOpts(r.bank)}</select></div>
            <div style="${cW[1]}"><input type="month" value="${r.month||''}" oninput="cfCardEdit('${r.id}','month',this.value)" style="${iS}"></div>
            <div style="${cW[2]}"><input type="number" value="${r.amt}" placeholder="0" oninput="cfCardEdit('${r.id}','amt',this.value)" style="${iS}text-align:right;font-family:var(--mono)"></div>
            <div style="${cW[3]}"><select onchange="cfCardEdit('${r.id}','owner',this.value)" style="${iS}">${mOpts(r.owner)}</select></div>
            <div style="width:24px;flex-shrink:0;text-align:center"><button onclick="cfCardDel('${r.id}')" style="background:none;border:none;color:#c0392b;font-size:14px;cursor:pointer;padding:0">×</button></div>
          </div>`).join('')}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid rgba(26,25,22,.1)">
            <button onclick="cfCardAddRow()" style="background:transparent;color:#1a1916;border:1px dashed rgba(26,25,22,.25);border-radius:4px;padding:6px 14px;font-size:12px;cursor:pointer;font-family:inherit">+ 新增一筆</button>
            <div style="font-size:14px;font-weight:600;color:#1a1916;font-family:var(--mono)" id="cf-card-modal-total">合計 ${cfFmt(tot)}</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:1rem;justify-content:flex-end">
            <button onclick="cfCloseCardModal()" style="background:#1a1916;color:#fff;border:none;border-radius:4px;padding:8px 20px;font-size:13px;cursor:pointer;font-family:inherit">完成</button>
          </div>
        </div>`;
      }
      wrap.innerHTML=renderModal();
      document.body.appendChild(wrap);
      window._cfCardModalRender=function(){
        const el=document.getElementById('cf-card-modal-overlay');
        if(el)el.innerHTML=renderModal();
      };
    }
    window.cfCloseCardModal=function(){
      cfRenderCards();cfCalc();
      const el=document.getElementById('cf-card-modal-overlay');
      if(el)el.remove();
    };
    window.cfCardBankChange=function(id,sel){
      if(sel.value==='__other'){
        const custom=prompt('請輸入銀行名稱：');
        if(custom&&custom.trim()){
          const name=custom.trim();
          if(!cfBanks.includes(name))cfBanks.push(name);
          cfCardEdit(id,'bank',name);
          window._cfCardModalRender();
        }else{sel.selectedIndex=0;}
        return;
      }
      cfCardEdit(id,'bank',sel.value);
    };
    window.cfCardEdit=function(id,field,v){
      const r=cfCards.find(x=>x.id===id);if(r)r[field]=v;cfSave();
      // 即時更新合計
      const items=window._cfCardFilterMonth?cfCards.filter(r=>(r.month||'')===window._cfCardFilterMonth):cfCards;
      const tot=items.reduce((s,r)=>s+(parseFloat(r.amt)||0),0);
      const totEl=document.getElementById('cf-card-modal-total');
      if(totEl)totEl.textContent='合計 '+cfFmt(tot);
    };
    window.cfCardAddRow=function(){
      const m=window._cfCardDefMonth||'';
      cfCards.push({id:nid('cr'),bank:'',owner:cfMembers[0]||'Rebecca',month:m,amt:''});
      cfSave();window._cfCardModalRender();
    };
    window.cfCardDel=function(id){
      cfCards=cfCards.filter(x=>x.id!==id);cfSave();window._cfCardModalRender();
    };


    function cfCalc(){
      // 收入：按月加總全年再月均
      const yrStr=String(cfYear);
      let yrInTotal=0;
      for(let m=1;m<=12;m++){yrInTotal+=cfIncomeMonthTotal(yrStr+'-'+String(m).padStart(2,'0'));}
      const moIn=yrInTotal/12;
      const moExp=cfExpense.reduce((s,r)=>s+toMo(cfGetAmt(r),r.freq),0);
      const yrCards=cfCards.filter(r=>(r.month||'').startsWith(yrStr));
      const moCard=yrCards.length?yrCards.reduce((s,r)=>s+(parseFloat(r.amt)||0),0)/yrCards.length:0;
      const moInv=cfInvest.reduce((s,r)=>s+toMo(r.amt,r.freq),0);
      const moRed=cfRedeem.reduce((s,r)=>s+toMo(r.amt,r.freq),0);
      const totalOut=moExp+moCard;const investNet=moInv-moRed;const fcf=moIn-(totalOut+investNet);
      const pct=moIn>0?Math.round((fcf/moIn)*100):0;
      const set=(id,v,c)=>{const el=document.getElementById(id);if(el){el.textContent=v;if(c)el.style.color=c;}};
      set('cf-s-in',cfFmt(moIn),'#4aad6e');set('cf-s-out',cfFmt(totalOut),'#e8675a');
      set('cf-s-invest-net',cfFmt(investNet),investNet>0?'#e8675a':'#4aad6e');
      set('cf-s-fcf',cfFmt(fcf),fcf>0?'#4aad6e':fcf<0?'#e8675a':'#f0ede6');
      // 年現金流
      set('cf-s-year-in',cfFmt(yrInTotal),'#4aad6e');
      set('cf-s-year-fcf',cfFmt(fcf*12),fcf>0?'#4aad6e':fcf<0?'#e8675a':'#f0ede6');
      // 年度統計卡片 - 投資淨流出用實際交易計算
      const yrExpense = moExp * 12;
      const yrCard = cfCards.reduce((s,r)=>{const m=r.month||'';return s+(m.startsWith(yrStr)?(parseFloat(r.amt)||0):0);},0);
      // 改用實際交易計算投資淨流出，與投資收支表一致
      const txs_calc=window._cfTransactions||[];
      const usdRate_calc=parseFloat(document.getElementById('usdRate')?.value)||31.5;
      let yrBuy_calc=0,yrSell_calc=0;
      txs_calc.forEach(t=>{
        if(!t.date||!t.date.startsWith(yrStr))return;
        const amt=(parseFloat(t.shares)||0)*(parseFloat(t.price)||0);
        const twd=t.region==='美股'?amt*usdRate_calc:amt;
        if(t.type==='買入')yrBuy_calc+=twd;else if(t.type==='賣出')yrSell_calc+=twd;
      });
      const yrInvestNet_calc = yrBuy_calc - yrSell_calc;
      set('cf-s-year-exp',cfFmt(yrExpense),'#d9534f');
      set('cf-s-year-card',cfFmt(yrCard));
      set('cf-s-year-invest-net',cfFmt(yrInvestNet_calc),yrInvestNet_calc>0?'#d9534f':'#4aad6e');
      // 橫條圖
      set('cf-b-in-v',cfFmt(moIn));set('cf-b-exp-v',cfFmt(moExp));set('cf-b-card-v',cfFmt(moCard));set('cf-b-inv-v',cfFmt(moInv));set('cf-b-fcf-p',pct+'%');
      const max=Math.max(moIn,totalOut,moCard,moInv,1);
      const sw=(id,p)=>{const el=document.getElementById(id);if(el)el.style.width=Math.max(0,Math.round(p))+'%';};
      sw('cf-b-in',Math.round((moIn/max)*100));sw('cf-b-exp',Math.round((moExp/max)*100));sw('cf-b-card',Math.round((moCard/max)*100));sw('cf-b-inv',Math.round((moInv/max)*100));sw('cf-b-fcf',Math.max(0,pct));
      // 年度結餘表（投資淨流出用交易實際年合計）
      const annEl=document.getElementById('cf-annual-body');
      if(annEl){
        const txs=window._cfTransactions||[];
        const yrStr=String(cfYear);
        const usdRate=parseFloat(document.getElementById('usdRate')?.value)||31.5;
        let yrBuy=0,yrSell=0;
        txs.forEach(t=>{
          if(!t.date||!t.date.startsWith(yrStr))return;
          const amt=(parseFloat(t.shares)||0)*(parseFloat(t.price)||0);
          const twd=t.region==='美股'?amt*usdRate:amt;
          if(t.type==='買入')yrBuy+=twd;else if(t.type==='賣出')yrSell+=twd;
        });
        const yrInvestNet=yrBuy-yrSell;
        const yrIncome=yrInTotal, yrExpense=moExp*12;
        // 信用卡：加總該年月份的實際帳單
        const yrCard=cfCards.reduce((s,r)=>{
          const m=r.month||'';
          return s+(m.startsWith(yrStr)?(parseFloat(r.amt)||0):0);
        },0);
        const yrBalance=yrIncome-yrExpense-yrCard-yrInvestNet;
        const row=(label,val,color)=>`<tr style="border-bottom:1px solid rgba(255,255,255,.06)"><td style="padding:7px 5px;font-size:13px;color:#ccc9bf">${label}</td><td style="text-align:right;padding:7px 5px;font-size:13px;font-family:var(--mono);color:${color||'#f0ede6'}">${cfFmt(val)}</td></tr>`;
        const titleEl=document.getElementById('cf-annual-title');
        if(titleEl)titleEl.textContent=yrStr+' 年度結餘';
        annEl.innerHTML=
          row('年收入',yrIncome,'#4aad6e')+
          row('年固定支出',yrExpense,'#e8675a')+
          row('年信用卡',yrCard,'#e8675a')+
          row('年投資淨流出',yrInvestNet,yrInvestNet>0?'#e8675a':'#4aad6e')+
          `<tr style="border-top:2px solid rgba(255,255,255,.15)"><td style="padding:8px 5px;font-size:15px;font-weight:700;color:#f0ede6">年結餘</td><td style="text-align:right;padding:8px 5px;font-size:16px;font-weight:700;font-family:var(--mono);color:${yrBalance>=0?'#4aad6e':'#e8675a'}">${cfFmt(yrBalance)}</td></tr>`;
      }
    }

    window.cfEditExpense=function(expenseId){
      const r=cfExpense.find(x=>x.id===expenseId);if(!r)return;
      const wrap=document.createElement('div');
      wrap.id='cf-edit-expense-modal';
      wrap.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:9999;padding:12px';
      wrap.onclick=function(e){if(e.target===wrap)wrap.remove();};
      wrap.innerHTML=`<div style="background:#2c2b27;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:1.5rem;width:360px;max-width:100%;max-height:85vh;overflow-y:auto;font-family:inherit;box-sizing:border-box;color:#f0ede6">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <div><div style="font-size:15px;font-weight:600;color:#f0ede6">編輯項目</div></div>
          <button onclick="document.getElementById('cf-edit-expense-modal')?.remove()" style="background:none;border:none;color:#9a9890;font-size:18px;cursor:pointer;line-height:1;padding:4px 8px">×</button>
        </div>
        <div style="margin-bottom:12px">
          <div style="font-size:12px;color:#9a9890;margin-bottom:4px;letter-spacing:.04em">項目名稱</div>
          <input id="exp-name" type="text" value="${r.name}" style="width:100%;border:1px solid rgba(255,255,255,.15);background:#3d3c38;color:#f0ede6;font-size:12px;padding:6px 8px;border-radius:4px;outline:none;box-sizing:border-box">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div>
            <div style="font-size:12px;color:#9a9890;margin-bottom:4px;letter-spacing:.04em">類型</div>
            <select id="exp-type" style="width:100%;border:1px solid rgba(255,255,255,.15);background:#3d3c38;color:#f0ede6;font-size:12px;padding:6px 8px;border-radius:4px;outline:none;box-sizing:border-box">
              <option value="general" ${r.etype==='general'?'selected':''}>一般</option>
              <option value="loan_mortgage" ${r.etype==='loan_mortgage'?'selected':''}>房貸</option>
              <option value="loan_personal" ${r.etype==='loan_personal'?'selected':''}>信貸</option>
            </select>
          </div>
          <div>
            <div style="font-size:12px;color:#9a9890;margin-bottom:4px;letter-spacing:.04em">頻率</div>
            <select id="exp-freq" style="width:100%;border:1px solid rgba(255,255,255,.15);background:#3d3c38;color:#f0ede6;font-size:12px;padding:6px 8px;border-radius:4px;outline:none;box-sizing:border-box">
              <option value="monthly" ${r.freq==='monthly'?'selected':''}>月</option>
              <option value="quarterly" ${r.freq==='quarterly'?'selected':''}>季</option>
              <option value="annually" ${r.freq==='annually'?'selected':''}>年</option>
              <option value="once" ${r.freq==='once'?'selected':''}>單次</option>
            </select>
          </div>
        </div>
        <div style="margin-bottom:16px">
          <div style="font-size:12px;color:#9a9890;margin-bottom:4px;letter-spacing:.04em">負責人</div>
          <select id="exp-owner" style="width:100%;border:1px solid rgba(255,255,255,.15);background:#3d3c38;color:#f0ede6;font-size:12px;padding:6px 8px;border-radius:4px;outline:none;box-sizing:border-box">
            ${cfMembers.map(m=>`<option value="${m}" ${m===r.owner?'selected':''}>${m}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button onclick="document.getElementById('cf-edit-expense-modal')?.remove()" style="background:transparent;color:#9a9890;border:1px solid rgba(255,255,255,.15);border-radius:4px;padding:6px 14px;font-size:12px;cursor:pointer;font-family:inherit">取消</button>
          <button onclick="cfSaveExpenseEdit('${expenseId}')" style="background:#4aad6e;color:#1a1916;border:none;border-radius:4px;padding:6px 14px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:600">保存</button>
        </div>
      </div>`;
      document.body.appendChild(wrap);
    };
    window.cfSaveExpenseEdit=function(expenseId){
      const r=cfExpense.find(x=>x.id===expenseId);if(!r)return;
      r.name=document.getElementById('exp-name')?.value||r.name;
      r.etype=document.getElementById('exp-type')?.value||r.etype;
      r.freq=document.getElementById('exp-freq')?.value||r.freq;
      r.owner=document.getElementById('exp-owner')?.value||r.owner;
      cfRenderExpense();cfCalc();cfSave();
      document.getElementById('cf-edit-expense-modal')?.remove();
    };
    window.cfCloseLoanModal=function(){
      const el=document.getElementById('cf-loan-modal-overlay');
      if(el)el.remove();
    };
    window.cfOpenUnifiedExpenseModal=function(rowId){
      const row=cfExpense.find(r=>r.id===rowId);if(!row)return;
      const et=row.etype||'general';const isLoanType=isLoan(et);
      const ld=row?.loanData||{};
      const wrap=document.createElement('div');
      wrap.id='cf-unified-expense-modal';
      wrap.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:9999;padding:12px';
      wrap.onclick=function(e){if(e.target===wrap)wrap.remove();};

      // 構建屬性編輯部分（所有類型都有）
      let html='<div style="background:#fff;border:1px solid rgba(26,25,22,.18);border-radius:8px;padding:1.25rem;width:420px;max-width:100%;max-height:85vh;overflow-y:auto;font-family:inherit;box-sizing:border-box">';
      html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem"><div><div style="font-size:15px;font-weight:600;color:#1a1916">'+row.name+'</div></div><button onclick="document.getElementById(\'cf-unified-expense-modal\').remove()" style="background:none;border:none;color:#9a9890;font-size:18px;cursor:pointer;line-height:1">×</button></div>';

      // 屬性編輯部分
      html+='<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(26,25,22,.12)">';
      html+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">';
      html+='<div><div style="font-size:10px;color:#9a9890;margin-bottom:2px;letter-spacing:.04em">類型</div><select id="cem-type" style="width:100%;border:1px solid rgba(26,25,22,.18);background:#f5f4f0;color:#1a1916;font-size:12px;padding:6px;border-radius:4px;outline:none;box-sizing:border-box"><option value="general" '+( et==='general'?'selected':'')+'>一般</option><option value="loan_mortgage" '+(et==='loan_mortgage'?'selected':'')+'>房貸</option><option value="loan_personal" '+(et==='loan_personal'?'selected':'')+'>信貸</option></select></div>';
      html+='<div><div style="font-size:10px;color:#9a9890;margin-bottom:2px;letter-spacing:.04em">負責人</div><select id="cem-owner" style="width:100%;border:1px solid rgba(26,25,22,.18);background:#f5f4f0;color:#1a1916;font-size:12px;padding:6px;border-radius:4px;outline:none;box-sizing:border-box">';
      cfMembers.forEach(m=>{html+='<option value="'+m+'" '+(m===row.owner?'selected':'')+'>'+m+'</option>';});
      html+='</select></div>';
      html+='<div><div style="font-size:10px;color:#9a9890;margin-bottom:2px;letter-spacing:.04em">頻率</div><select id="cem-freq" style="width:100%;border:1px solid rgba(26,25,22,.18);background:#f5f4f0;color:#1a1916;font-size:12px;padding:6px;border-radius:4px;outline:none;box-sizing:border-box"><option value="monthly" '+(row.freq==='monthly'?'selected':'')+'>月</option><option value="quarterly" '+(row.freq==='quarterly'?'selected':'')+'>季</option><option value="annually" '+(row.freq==='annually'?'selected':'')+'>年</option><option value="once" '+(row.freq==='once'?'selected':'')+'>單次</option></select></div>';
      html+='</div></div>';

      // 貸款部分（僅房貸/信貸顯示）
      if(isLoanType){
        html+='<div style="display:block"><div style="margin-bottom:9px"><div style="font-size:10px;color:#9a9890;margin-bottom:2px;letter-spacing:.04em">貸款名稱</div><input id="cem-lc-name" type="text" value="'+(row?.name||'')+'" placeholder="例：禾川琚房貸" style="width:100%;border:1px solid rgba(26,25,22,.18);background:#f5f4f0;color:#1a1916;font-size:12px;padding:6px;border-radius:4px;outline:none;box-sizing:border-box"></div>';
        [['cem-lc-p','貸款金額（TWD）','number','例：8000000'],['cem-lc-r','年利率（%）','number','例：2.06'],['cem-lc-s','貸款起始日','date',''],['cem-lc-e','貸款截止日','date',''],['cem-lc-f','還款日（第一次）','date','']].forEach(([id,lb,tp,ph])=>{
          html+='<div style="margin-bottom:9px"><div style="font-size:10px;color:#9a9890;margin-bottom:2px;letter-spacing:.04em">'+lb+'</div><input id="'+id+'" type="'+tp+'" value="'+(ld[id.replace('cem-','')]||'')+'" placeholder="'+ph+'" style="width:100%;border:1px solid rgba(26,25,22,.18);background:#f5f4f0;color:#1a1916;font-size:12px;padding:6px;border-radius:4px;outline:none;font-family:var(--mono);box-sizing:border-box"></div>';
        });
        html+='</div>';
      }

      // 按鈕
      html+='<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:1rem"><button onclick="document.getElementById(\'cf-unified-expense-modal\').remove()" style="background:transparent;color:#5a5852;border:1px solid rgba(26,25,22,.18);border-radius:4px;padding:8px 16px;font-size:13px;cursor:pointer">取消</button><button onclick="cfSaveUnifiedExpense(\''+rowId+'\')" style="background:#1a1916;color:#fff;border:none;border-radius:4px;padding:8px 16px;font-size:13px;cursor:pointer">保存</button></div>';
      html+='</div>';

      wrap.innerHTML=html;
      document.body.appendChild(wrap);
    };
    window.cfSaveUnifiedExpense=function(rowId){
      const row=cfExpense.find(r=>r.id===rowId);if(!row)return;
      row.etype=document.getElementById('cem-type')?.value||row.etype;
      row.owner=document.getElementById('cem-owner')?.value||row.owner;
      row.freq=document.getElementById('cem-freq')?.value||row.freq;
      // 如果是貸款類型，保存貸款資料
      if(isLoan(row.etype)){
        row.name=document.getElementById('cem-lc-name')?.value||row.name;
        if(!row.loanData)row.loanData={};
        const ld=row.loanData;
        ld['lc-p']=document.getElementById('cem-lc-p')?.value||'';
        ld['lc-r']=document.getElementById('cem-lc-r')?.value||'';
        ld['lc-s']=document.getElementById('cem-lc-s')?.value||'';
        ld['lc-e']=document.getElementById('cem-lc-e')?.value||'';
        ld['lc-f']=document.getElementById('cem-lc-f')?.value||'';
      }
      cfRenderExpense();cfCalc();cfSave();
      document.getElementById('cf-unified-expense-modal')?.remove();
    };
    window.cfOpenLoan=function(rowId){
      const row=cfExpense.find(r=>r.id===rowId);const ld=row?.loanData||{};
      const typeName=(ETYPES[row?.etype]||'貸款');
      const wrap=document.createElement('div');
      wrap.id='cf-loan-modal-overlay';
      wrap.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:9999;padding:12px';
      wrap.onclick=function(e){if(e.target===wrap)cfCloseLoanModal();};
      wrap.innerHTML=`<div style="background:#fff;border:1px solid rgba(26,25,22,.18);border-radius:8px;padding:1.25rem;width:420px;max-width:100%;max-height:85vh;overflow-y:auto;font-family:inherit;box-sizing:border-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <div><div style="font-size:15px;font-weight:600;color:#1a1916">${row?.name||typeName} 貸款明細</div><div style="font-size:10px;color:#9a9890;margin-top:1px">${typeName}</div></div>
          <button onclick="cfCloseLoanModal()" style="background:none;border:none;color:#9a9890;font-size:18px;cursor:pointer;line-height:1;padding:4px 8px">×</button>
        </div>
        <div style="margin-bottom:9px"><div style="font-size:10px;color:#9a9890;margin-bottom:2px;letter-spacing:.04em">貸款名稱</div><input id="lc-name" type="text" value="${row?.name||''}" placeholder="例：禾川琚房貸" style="width:100%;border:1px solid rgba(26,25,22,.18);background:#f5f4f0;color:#1a1916;font-size:13px;padding:8px;border-radius:4px;outline:none;box-sizing:border-box"></div>
        ${[['lc-p','貸款金額（TWD）','number','例：8,000,000'],['lc-r','年利率（%）','number','例：2.06'],['lc-s','貸款起始日','date',''],['lc-e','貸款截止日','date',''],['lc-f','還款日（第一次）','date','']].map(([id,lb,tp,ph])=>`<div style="margin-bottom:9px"><div style="font-size:10px;color:#9a9890;margin-bottom:2px;letter-spacing:.04em">${lb}</div><input id="${id}" type="${tp}" value="${ld[id]||''}" placeholder="${ph}" style="width:100%;border:1px solid rgba(26,25,22,.18);background:#f5f4f0;color:#1a1916;font-size:13px;padding:8px;border-radius:4px;outline:none;font-family:var(--mono);box-sizing:border-box" oninput="cfLoanCalc()"></div>`).join('')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:9px">
          <div><div style="font-size:10px;color:#9a9890;margin-bottom:2px;letter-spacing:.04em">寬限期（月）</div><input id="lc-grace" type="number" value="${ld['lc-grace']||''}" placeholder="例：24" style="width:100%;border:1px solid rgba(26,25,22,.18);background:#f5f4f0;color:#1a1916;font-size:13px;padding:8px;border-radius:4px;outline:none;font-family:var(--mono);box-sizing:border-box" oninput="cfLoanCalc()"></div>
          <div><div style="font-size:10px;color:#9a9890;margin-bottom:2px;letter-spacing:.04em">還款方式</div><select id="lc-method" style="width:100%;border:1px solid rgba(26,25,22,.18);background:#f5f4f0;color:#1a1916;font-size:13px;padding:8px;border-radius:4px;outline:none;font-family:inherit;box-sizing:border-box" onchange="cfLoanCalc()"><option value="ep"${(ld['lc-method']||'ep')==='ep'?' selected':''}>本利均攤</option><option value="pp"${ld['lc-method']==='pp'?' selected':''}>本金均攤</option></select></div>
        </div>
        <div id="lc-result" style="background:#f5f4f0;border-radius:6px;padding:12px;font-size:11px;color:#5a5852;min-height:48px"></div>
        <div style="margin-top:12px;border-top:1px solid rgba(26,25,22,.12);padding-top:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:11px;font-weight:600;color:#5a5852;letter-spacing:.04em">利率調整 / 額外還款紀錄</div>
            <div style="display:flex;gap:4px">
              <button onclick="cfAddLoanEvent('rate_change')" style="background:#f5f4f0;border:1px solid rgba(26,25,22,.18);border-radius:4px;padding:4px 8px;font-size:10px;cursor:pointer;color:#5a5852;font-family:inherit">+ 利率調整</button>
              <button onclick="cfAddLoanEvent('prepay')" style="background:#f5f4f0;border:1px solid rgba(26,25,22,.18);border-radius:4px;padding:4px 8px;font-size:10px;cursor:pointer;color:#5a5852;font-family:inherit">+ 額外還款</button>
            </div>
          </div>
          <div id="lc-events"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:1rem;justify-content:flex-end">
          <button onclick="cfCloseLoanModal()" style="background:transparent;color:#5a5852;border:1px solid rgba(26,25,22,.18);border-radius:4px;padding:8px 16px;font-size:13px;cursor:pointer;font-family:inherit">關閉</button>
          <button id="lc-apply" onclick="cfApplyLoan('${rowId}')" disabled style="background:#1a1916;color:#fff;border:none;border-radius:4px;padding:8px 16px;font-size:13px;cursor:pointer;opacity:.35;font-family:inherit">套用月付金</button>
        </div>
      </div>`;
      document.body.appendChild(wrap);
      window._cfLoanEvents=(ld.events||[]).map(e=>({...e}));
      cfRenderLoanEvents();
      if(row?.loanData)cfLoanCalc();
    };
    // 用日曆月計算兩個日期之間經過的月數（以還款日為基準）
    window.loanMonthDiff=loanMonthDiff;
    window.loanCalcBalance=loanCalcBalance;
    function loanMonthDiff(fromDate,toDate){
      const f=new Date(fromDate),t=new Date(toDate);
      let months=(t.getFullYear()-f.getFullYear())*12+(t.getMonth()-f.getMonth());
      if(t.getDate()<f.getDate())months--; // 還沒到當月還款日，不算這期
      return Math.max(0,months);
    }
    // 計算貸款剩餘本金（支援利率調整和額外還款事件）
    // events: [{date,type:'rate_change',value:newRate},{date,type:'prepay',value:amount}]
    function loanCalcBalance(principal,rate,startDate,endDate,firstPayDate,graceMo,events){
      const tm=loanMonthDiff(startDate,endDate);
      const elapsed=firstPayDate?loanMonthDiff(firstPayDate,new Date()):0;
      // 建立每期事件 map（key=第幾期）
      const evMap={};
      if(events&&events.length&&firstPayDate){
        events.forEach(ev=>{
          if(!ev.date)return;
          const mo=loanMonthDiff(firstPayDate,ev.date);
          if(!evMap[mo])evMap[mo]=[];
          evMap[mo].push(ev);
        });
      }
      let bal=principal,curRate=rate;
      let mr=curRate/100/12;
      // 計算初始月付金
      const rm0=Math.max(0,tm-graceMo);
      let mPay=0;
      if(rm0>0&&mr>0)mPay=principal*mr*Math.pow(1+mr,rm0)/(Math.pow(1+mr,rm0)-1);
      else if(rm0>0)mPay=principal/rm0;
      const gPay=principal*mr;
      // 逐期模擬
      for(let i=0;i<elapsed;i++){
        // 套用本期事件
        if(evMap[i]){
          evMap[i].forEach(ev=>{
            if(ev.type==='rate_change'){
              curRate=parseFloat(ev.value)||curRate;
              mr=curRate/100/12;
              // 重算月付金（以當前餘額和剩餘期數）
              const remPeriods=Math.max(1,Math.max(0,tm-graceMo)-(i<graceMo?0:i-graceMo));
              if(mr>0)mPay=bal*mr*Math.pow(1+mr,remPeriods)/(Math.pow(1+mr,remPeriods)-1);
              else mPay=bal/remPeriods;
            }else if(ev.type==='prepay'){
              bal=Math.max(0,bal-(parseFloat(ev.value)||0));
              // 額外還款後重算月付金
              const remPeriods=Math.max(1,Math.max(0,tm-graceMo)-(i<graceMo?0:i-graceMo));
              if(mr>0)mPay=bal*mr*Math.pow(1+mr,remPeriods)/(Math.pow(1+mr,remPeriods)-1);
              else mPay=bal/remPeriods;
            }
          });
        }
        if(i<graceMo){bal*=(1+mr);}
        else{bal=bal*(1+mr)-mPay;}
      }
      bal=Math.max(0,bal);
      const inGrace=elapsed<graceMo;
      const curPay=inGrace?(bal*mr):mPay;
      const remaining=Math.max(0,tm-elapsed);
      return {bal,mPay,gPay:bal*mr,curPay,inGrace,tm,elapsed,remaining,curRate};
    }
    window.cfAddLoanEvent=function(type){
      window._cfLoanEvents=window._cfLoanEvents||[];
      window._cfLoanEvents.push({type,date:'',value:''});
      cfRenderLoanEvents();
    };
    window.cfDelLoanEvent=function(idx){
      window._cfLoanEvents.splice(idx,1);
      cfRenderLoanEvents();cfLoanCalc();
    };
    window.cfSetLoanEvent=function(idx,field,val){
      window._cfLoanEvents[idx][field]=val;
      cfLoanCalc();
    };
    function cfRenderLoanEvents(){
      const el=document.getElementById('lc-events');if(!el)return;
      const evts=window._cfLoanEvents||[];
      if(!evts.length){el.innerHTML='<div style="font-size:11px;color:#9a9890;padding:4px 0">尚無調整紀錄</div>';return;}
      el.innerHTML=evts.map((ev,i)=>{
        const label=ev.type==='rate_change'?'利率調整為 (%)':'額外還本 (TWD)';
        return `<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
          <input type="date" value="${ev.date||''}" onchange="cfSetLoanEvent(${i},'date',this.value)" style="border:1px solid rgba(26,25,22,.18);background:#f5f4f0;color:#1a1916;font-size:11px;padding:5px;border-radius:4px;outline:none;font-family:var(--mono);width:130px;box-sizing:border-box">
          <input type="number" value="${ev.value||''}" placeholder="${label}" oninput="cfSetLoanEvent(${i},'value',this.value)" style="flex:1;border:1px solid rgba(26,25,22,.18);background:#f5f4f0;color:#1a1916;font-size:11px;padding:5px;border-radius:4px;outline:none;font-family:var(--mono);box-sizing:border-box">
          <span style="font-size:9px;color:#9a9890;white-space:nowrap">${ev.type==='rate_change'?'利率%':'還本'}</span>
          <button onclick="cfDelLoanEvent(${i})" style="background:none;border:none;color:#9a9890;cursor:pointer;font-size:14px;padding:2px 4px;line-height:1">×</button>
        </div>`;
      }).join('');
    }
    window.cfLoanCalc=function(){
      const g=id=>document.getElementById(id);
      const p=parseFloat(g('lc-p')?.value)||0,r=parseFloat(g('lc-r')?.value)||0;
      const ss=g('lc-s')?.value,es=g('lc-e')?.value,fs=g('lc-f')?.value;
      const gm=parseFloat(g('lc-grace')?.value)||0;
      const res=g('lc-result'),btn=g('lc-apply');
      if(!p||!r||!ss||!es){if(res)res.innerHTML='<span style="color:#9a9890">請填入貸款金額、年利率、起始日、截止日</span>';return;}
      const evts=(window._cfLoanEvents||[]).filter(e=>e.date&&e.value);
      const lc=loanCalcBalance(p,r,ss,es,fs,gm,evts);
      // 下次還款日
      let nextPayStr='—';
      if(fs){
        const fd=new Date(fs);const payDay=fd.getDate();
        const now=new Date();let ny=now.getFullYear(),nm=now.getMonth();
        if(now.getDate()>=payDay)nm++;
        if(nm>11){nm=0;ny++;}
        const nd=new Date(ny,nm,Math.min(payDay,new Date(ny,nm+1,0).getDate()));
        nextPayStr=`${nd.getFullYear()}/${String(nd.getMonth()+1).padStart(2,'0')}/${String(nd.getDate()).padStart(2,'0')}`;
      }
      const rateInfo=lc.curRate&&lc.curRate!==r?`<div style="font-size:10px;color:#c8860a;margin-top:1px">目前利率 ${lc.curRate}%（原 ${r}%）</div>`:'';
      if(res)res.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><div style="color:#9a9890;font-size:10px;margin-bottom:2px;letter-spacing:.04em">目前月付金</div><div style="font-size:15px;font-weight:500;font-family:var(--mono);color:#1a1916">${cfFmt(lc.curPay)}</div><div style="font-size:10px;color:#9a9890;margin-top:1px">${lc.inGrace?'寬限期（利息）':'本利均攤'}</div>${rateInfo}</div><div><div style="color:#9a9890;font-size:10px;margin-bottom:2px;letter-spacing:.04em">剩餘本金</div><div style="font-size:15px;font-weight:500;font-family:var(--mono);color:#1a1916">${cfFmt(lc.bal)}</div></div><div><div style="color:#9a9890;font-size:10px;margin-bottom:2px">借款總期數</div><div style="font-family:var(--mono);color:#5a5852">${lc.tm} 個月</div></div><div><div style="color:#9a9890;font-size:10px;margin-bottom:2px">剩餘期數</div><div style="font-family:var(--mono);color:#5a5852">${lc.remaining} 個月</div></div><div><div style="color:#9a9890;font-size:10px;margin-bottom:2px">下次還款日</div><div style="font-family:var(--mono);color:#5a5852">${nextPayStr}</div></div><div><div style="color:#9a9890;font-size:10px;margin-bottom:2px">已還期數</div><div style="font-family:var(--mono);color:#5a5852">${lc.elapsed} 個月</div></div></div>`;
      if(btn){btn.disabled=false;btn.style.opacity='1';btn.dataset.pay=Math.round(lc.curPay);}
      window._cfPendingLoan={'lc-p':g('lc-p')?.value,'lc-r':g('lc-r')?.value,'lc-s':g('lc-s')?.value,'lc-e':g('lc-e')?.value,'lc-f':g('lc-f')?.value,'lc-grace':g('lc-grace')?.value,'lc-method':g('lc-method')?.value,events:(window._cfLoanEvents||[]).filter(e=>e.date&&e.value)};
    };
    window.cfApplyLoan=function(rowId){
      const btn=document.getElementById('lc-apply'),pay=parseFloat(btn?.dataset.pay)||0;if(!pay)return;
      const row=cfExpense.find(r=>r.id===rowId);
      const nameInput=document.getElementById('lc-name');
      if(row){
        cfSetAmt(row,String(pay));row.freq='monthly';row.loanData=window._cfPendingLoan;
        if(nameInput&&nameInput.value.trim())row.name=nameInput.value.trim();
      }
      const inp=document.getElementById('cf-amt-'+rowId);if(inp)inp.value=pay;
      cfRenderExpense();cfCalc();cfSave();cfCloseLoanModal();
    };

    function cfGuessEtype(r){
      if(r.isLoan)return 'loan_mortgage';
      const n=(r.name||'').toLowerCase();
      if(n.includes('房貸')||n.includes('mortgage'))return 'loan_mortgage';
      if(n.includes('信貸')||n.includes('credit'))return 'loan_credit';
      if(n.includes('車貸')||n.includes('貸款'))return 'loan_other';
      return 'general';
    }
    let cfSaveTimer=null;
    function cfSave(){
      // 同時存 localStorage（備份）和 Firebase
      try{localStorage.setItem(CF_STORE,JSON.stringify({members:cfMembers,income:cfIncome,expense:cfExpense,cards:cfCards,banks:cfBanks}));}catch(e){}
      // 防抖：500ms 內多次修改只寫一次 Firebase
      clearTimeout(cfSaveTimer);
      cfSaveTimer=setTimeout(()=>{
        try{
          const {db}=window.firebaseApp||{};
          if(!db)return;
          const setDoc=window._fbSetDoc,docRef=window._fbDoc;
          if(!setDoc||!docRef)return;
          setDoc(docRef(db,'cashflow','data'),{members:cfMembers,income:cfIncome,expense:cfExpense,cards:cfCards,invest:cfInvest,redeem:cfRedeem,updatedAt:new Date().toISOString()},{merge:true});
        }catch(e){console.warn('cfSave to Firebase failed',e);}
      },500);
    }
    window.cfLoad=async function(){
      try{
        // 優先從 Firebase 讀取
        const {db}=window.firebaseApp||{};
        if(db&&window._fbGetDoc&&window._fbDoc){
          const snap=await window._fbGetDoc(window._fbDoc(db,'cashflow','data'));
          if(snap.exists()){
            const d=snap.data();
            if(d.members?.length)cfMembers=d.members;
            if(d.income?.length)cfIncome=d.income;
            if(d.expense?.length)cfExpense=d.expense.map(r=>({...r,etype:r.etype||cfGuessEtype(r)}));
            if(d.cards?.length)cfCards=d.cards;
            if(d.banks?.length)cfBanks=d.banks;
            const all=[...cfIncome,...cfExpense,...cfCards];
            cfCtr=Math.max(cfCtr,...all.map(r=>parseInt(r.id.replace(/\D/g,''))||0));
            cfRenderAll();
            return;
          }
        }
      }catch(e){console.warn('cfLoad from Firebase failed, fallback to localStorage',e);}
      // fallback: localStorage
      try{
        const raw=localStorage.getItem(CF_STORE);if(!raw){cfRenderAll();return;}
        const d=JSON.parse(raw);
        if(d.members?.length)cfMembers=d.members;
        if(d.income?.length)cfIncome=d.income;
        if(d.expense?.length)cfExpense=d.expense.map(r=>({...r,etype:r.etype||cfGuessEtype(r)}));
        if(d.cards?.length)cfCards=d.cards;
        const all=[...cfIncome,...cfExpense,...cfCards];
        cfCtr=Math.max(cfCtr,...all.map(r=>parseInt(r.id.replace(/\D/g,''))||0));
      }catch(e){}
      cfRenderAll();
    };
    })();
