    (function(){
    const DB_STORE='db_v1';
    const ASSET_TYPES=['不動產','車輛','其他'];
    const CASH_TYPES=['活存','定存','外幣帳戶','其他'];
    const DEBT_TYPES=['房貸','信貸','車貸','其他'];
    const GOAL=50000000;
    let dbAssets=[
      {id:'a1',name:'禾川琚（自住）',cat:'不動產',owner:'Rebecca',val:''},
      {id:'a2',name:'上城（出租）',cat:'不動產',owner:'Eric',val:''},
    ];
    let dbCash=[];
    let dbDebts=[
      {id:'d1',name:'禾川琚房貸',cat:'房貸',owner:'Rebecca',val:'',auto:false},
      {id:'d2',name:'上城房貸',cat:'房貸',owner:'Eric',val:'',auto:false},
      {id:'d3',name:'信貸',cat:'信貸',owner:'Rebecca',val:'',auto:false},
    ];
    let dbReminders=[];
    let dbCtr=50;
    function nid(p){return p+(++dbCtr);}
    function fmt(n){return (n<0?'-':'')+'$'+Math.abs(Math.round(n)).toLocaleString();}
    function aOpts(sel,list){return list.map(c=>`<option value="${c}"${c===sel?' selected':''}>${c}</option>`).join('');}
    function mOpts(sel){
      const ms=window.cfMembersRef||['Rebecca','Eric','Ian','弟弟'];
      return [...ms,'共同'].map(m=>`<option value="${m}"${m===sel?' selected':''}>${m}</option>`).join('');
    }

    // --- 現金存款渲染 ---
    function dbRenderCash(){
      const el=document.getElementById('db-cash-body');if(!el)return;
      const tot=dbCash.reduce((s,r)=>s+(parseFloat(r.val)||0),0);
      el.innerHTML=dbCash.map(r=>`<tr>
        <td><input class="cf-te" value="${r.name}" placeholder="帳戶名稱" oninput="dbSf('cash','${r.id}','name',this.value)"></td>
        <td><select class="cf-sel" onchange="dbSf('cash','${r.id}','cat',this.value)">${aOpts(r.cat,CASH_TYPES)}</select></td>
        <td><select class="cf-sel" onchange="dbSf('cash','${r.id}','owner',this.value)">${mOpts(r.owner)}</select></td>
        <td><input class="cf-te r" type="number" value="${r.val}" placeholder="0" oninput="dbSa('cash','${r.id}',this.value)"></td>
        <td></td>
        <td><button class="cf-del" onclick="dbDel('cash','${r.id}')">×</button></td>
      </tr>`).join('')+
      `<tr class="cf-sub"><td colspan="3" class="cf-sub-lbl">現金合計</td><td class="cf-sub-val">${fmt(tot)}</td><td colspan="2"></td></tr>`;
      const st=document.getElementById('db-st-cash');if(st)st.textContent=fmt(tot);
      dbCalc();
    }

    function dbRenderAssets(){
      const el=document.getElementById('db-asset-body');if(!el)return;
      const tot=dbAssets.reduce((s,r)=>s+(parseFloat(r.val)||0),0);
      el.innerHTML=dbAssets.map(r=>`<tr>
        <td><input class="cf-te" value="${r.name}" placeholder="資產名稱" oninput="dbSf('asset','${r.id}','name',this.value)"></td>
        <td><select class="cf-sel" onchange="dbSf('asset','${r.id}','cat',this.value)">${aOpts(r.cat,ASSET_TYPES)}</select></td>
        <td><select class="cf-sel" onchange="dbSf('asset','${r.id}','owner',this.value)">${mOpts(r.owner)}</select></td>
        <td><input class="cf-te r" type="number" value="${r.val}" placeholder="0" oninput="dbSa('asset','${r.id}',this.value)"></td>
        <td></td>
        <td><button class="cf-del" onclick="dbDel('asset','${r.id}')">×</button></td>
      </tr>`).join('')+
      `<tr class="cf-sub"><td colspan="3" class="cf-sub-lbl">固定資產合計</td><td class="cf-sub-val">${fmt(tot)}</td><td colspan="2"></td></tr>`;
      const st=document.getElementById('db-st-asset');if(st)st.textContent=fmt(tot);
      dbCalc();
    }

    function dbRenderDebts(){
      // 負債完全從收支管理貸款項目自動生成
      const loans=(window.cfExpenseRef||[]).filter(r=>r.etype&&r.etype.startsWith('loan_'));
      const catMap={loan_mortgage:'房貸',loan_credit:'信貸',loan_other:'其他'};
      dbDebts=loans.map(loan=>{
        const ld=loan.loanData||{};
        const principal=parseFloat(ld['lc-p'])||0;
        let bal=0;
        if(principal){
          const r=parseFloat(ld['lc-r'])||0;
          const ss=ld['lc-s'],es=ld['lc-e'],fs=ld['lc-f'];
          const gm=parseFloat(ld['lc-grace'])||0;
          bal=principal;
          if(ss&&es&&window.loanCalcBalance){const evts=ld.events||[];const lc=window.loanCalcBalance(principal,r,ss,es,fs,gm,evts);bal=lc.bal;}
        }else{bal=parseFloat(loan.amt)||0;}
        return {id:loan.id,name:loan.name||catMap[loan.etype]||'貸款',cat:catMap[loan.etype]||'其他',owner:loan.owner||'',val:String(Math.round(bal)),loanExpId:loan.id};
      });
      const el=document.getElementById('db-debt-body');if(!el)return;
      const tot=dbDebts.reduce((s,r)=>s+(parseFloat(r.val)||0),0);
      el.innerHTML=(dbDebts.length?dbDebts.map(r=>`<tr>
        <td><span onclick="cfOpenLoan('${r.loanExpId}')" style="cursor:pointer;color:#c8b89a;text-decoration:underline;font-size:13px;display:inline-block;padding:6px 0" title="點擊查看貸款明細">${r.name}</span></td>
        <td style="font-size:13px;color:#ccc9bf;padding:7px 4px">${r.cat}</td>
        <td style="font-size:13px;color:#ccc9bf;padding:7px 4px">${r.owner}</td>
        <td style="text-align:right;font-size:13px;font-family:var(--mono);color:#f0ede6;padding:7px 4px">${r.val?fmt(parseFloat(r.val)):''}</td>
      </tr>`).join(''):`<tr><td colspan="4" style="padding:12px;font-size:12px;color:#9a9890;text-align:center">收支管理尚無貸款項目</td></tr>`)+
      `<tr class="cf-sub"><td colspan="3" class="cf-sub-lbl">負債合計</td><td class="cf-sub-val" style="color:#ef4444">${fmt(tot)}</td></tr>`;
      const st=document.getElementById('db-st-debt');if(st)st.textContent=fmt(tot);
      dbCalc();
    }

    // --- 提醒系統 ---
    function getNextThirdWed(from){
      const d=new Date(from);d.setDate(1);
      let count=0;
      for(let i=1;i<=31;i++){d.setDate(i);if(d.getMonth()!==from.getMonth())break;if(d.getDay()===3){count++;if(count===3)return new Date(d);}}
      // fallback next month
      const next=new Date(from.getFullYear(),from.getMonth()+1,1);
      return getNextThirdWed(next);
    }
    function getFuturesSettlement(){
      const now=new Date();
      let target=getNextThirdWed(now);
      if(target<now){const next=new Date(now.getFullYear(),now.getMonth()+1,1);target=getNextThirdWed(next);}
      return target;
    }
    function daysUntil(date){return Math.ceil((date-new Date())/(1000*60*60*24));}
    function formatDate(d){return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;}

    function renderReminderCard(it){
      const urgent=it.days<=7;
      const borderColor=urgent?'rgba(232,103,90,.5)':'rgba(255,255,255,.08)';
      const bgColor=urgent?'rgba(232,103,90,.06)':'rgba(255,255,255,.02)';
      const icon=it.type==='futures'?'&#9888;&#65039;':it.type==='loan'?'&#127974;':it.type==='card'?'&#128179;':'&#128276;';
      const repeatLabel=it.repeat==='monthly'?'每月':it.repeat==='yearly'?'每年':'';
      const ownerTag=it.owner?`<span style="font-size:10px;background:rgba(255,255,255,.08);border-radius:3px;padding:1px 5px;color:#ccc9bf;margin-left:4px">${it.owner}</span>`:'';
      const delBtn=it.type==='custom'?`<button onclick="dbDelReminder('${it.id}')" style="background:none;border:none;color:#9a9890;cursor:pointer;font-size:14px;padding:0 4px" title="刪除">×</button>`:'';
      return `<div style="background:${bgColor};border:1px solid ${borderColor};border-radius:8px;padding:10px 12px;display:flex;align-items:center;gap:10px">
        <div style="font-size:20px;flex-shrink:0">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:500;color:#f0ede6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.name}${ownerTag}</div>
          <div style="font-size:11px;color:#9a9890;margin-top:2px">${formatDate(it.date)}${repeatLabel?' · '+repeatLabel:''}${it.amt?' · '+fmt(parseFloat(it.amt)||0):''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:16px;font-weight:600;font-family:var(--mono);color:${urgent?'#e8675a':'#c8b89a'}">${it.days<=0?'今天':it.days+'天'}</div>
          ${delBtn}
        </div>
      </div>`;
    }

    function dbRenderReminders(){
      const payEl=document.getElementById('db-payments-list');
      const dateEl=document.getElementById('db-dates-list');
      const payments=[];
      const dates=[];
      const now=new Date();

      // 期貨結算日 → 重要日期
      const fut=getFuturesSettlement();
      dates.push({name:'台指期貨結算日',date:fut,days:daysUntil(fut),type:'futures',repeat:'monthly'});

      // 貸款繳款 → 繳款提醒（含負責人）
      const cfExp=window.cfExpenseRef||[];
      cfExp.forEach(r=>{
        const et=r.etype||'general';
        if(et.startsWith('loan_')){
          const ld=r.loanData||{};
          const payDay=ld['lc-f']?new Date(ld['lc-f']).getDate():null;
          if(payDay){
            let next=new Date(now.getFullYear(),now.getMonth(),payDay);
            if(next<now)next=new Date(now.getFullYear(),now.getMonth()+1,payDay);
            payments.push({name:(r.name||'貸款'),date:next,days:daysUntil(next),type:'loan',amt:r.amt,owner:r.owner||'',repeat:'monthly'});
          }
        }
      });

      // 信用卡繳款 → 繳款提醒（含負責人）
      const cfCards=window.cfCardsRef||[];
      cfCards.forEach(r=>{
        if(r.bank||r.name){
          let next=new Date(now.getFullYear(),now.getMonth()+1,10);
          payments.push({name:(r.bank||r.name||'信用卡'),date:next,days:daysUntil(next),type:'card',amt:r.amt,owner:r.owner||'',repeat:'monthly'});
        }
      });

      // 自訂提醒 → 重要日期
      dbReminders.forEach(r=>{
        let d=new Date(r.date);
        if(r.repeat==='monthly'){
          d=new Date(now.getFullYear(),now.getMonth(),d.getDate());
          if(d<now)d=new Date(now.getFullYear(),now.getMonth()+1,d.getDate());
        }else if(r.repeat==='yearly'){
          d=new Date(now.getFullYear(),d.getMonth(),d.getDate());
          if(d<now)d=new Date(now.getFullYear()+1,d.getMonth(),d.getDate());
        }
        dates.push({name:r.name,date:d,days:daysUntil(d),type:'custom',id:r.id,repeat:r.repeat||'once'});
      });

      payments.sort((a,b)=>a.days-b.days);
      dates.sort((a,b)=>a.days-b.days);

      if(payEl){
        if(!payments.length){payEl.innerHTML='<div style="font-size:12px;color:#9a9890;padding:12px">目前沒有繳款提醒</div>';}
        else{
          payEl.innerHTML=`<table class="cf-tbl db-tbl" style="width:100%">
            <thead><tr><th>項目</th><th>類型</th><th>負責人</th><th>下次繳款日</th><th class="r">金額</th><th class="r">倒數</th></tr></thead>
            <tbody>${payments.map(it=>{
              const urgent=it.days<=7;
              const typeLabel=it.type==='loan'?'貸款':'信用卡';
              return `<tr style="${urgent?'background:rgba(232,103,90,.06)':''}">
                <td style="padding:8px 5px;font-size:13px;color:#f0ede6;font-weight:500">${it.name}</td>
                <td style="padding:8px 5px;font-size:12px;color:#9a9890">${typeLabel}</td>
                <td style="padding:8px 5px;font-size:13px;color:#ccc9bf">${it.owner||'—'}</td>
                <td style="padding:8px 5px;font-size:12px;font-family:var(--mono);color:#ccc9bf">${formatDate(it.date)}</td>
                <td style="text-align:right;padding:8px 5px;font-size:13px;font-family:var(--mono);color:#f0ede6">${it.amt?fmt(parseFloat(it.amt)||0):'—'}</td>
                <td style="text-align:right;padding:8px 5px;font-size:13px;font-weight:600;font-family:var(--mono);color:${urgent?'#ef4444':'#c8b89a'}">${it.days<=0?'今天':it.days+'天'}</td>
              </tr>`;}).join('')}</tbody></table>`;
        }
      }
      if(dateEl)dateEl.innerHTML=dates.length?dates.map(renderReminderCard).join(''):'<div style="font-size:12px;color:#9a9890;padding:12px">目前沒有重要日期</div>';
    }

    window.dbAddReminder=function(){
      const name=document.getElementById('db-rem-name')?.value?.trim();
      const date=document.getElementById('db-rem-date')?.value;
      const repeat=document.getElementById('db-rem-repeat')?.value||'once';
      if(!name||!date){alert('請填入提醒名稱和日期');return;}
      dbReminders.push({id:nid('r'),name,date,repeat});
      document.getElementById('db-rem-name').value='';
      document.getElementById('db-rem-date').value='';
      dbRenderReminders();dbSave();
    };
    window.dbDelReminder=function(id){
      dbReminders=dbReminders.filter(r=>r.id!==id);
      dbRenderReminders();dbSave();
    };

    window.dbRender=async function(){
      const loadEl=document.getElementById('db-loading');
      if(loadEl)loadEl.style.display='block';
      try{
        await dbLoad();
        dbRenderCash();dbRenderAssets();dbRenderDebts();dbRenderReminders();dbCalc();
      }catch(e){console.error('dbRender error:',e);}
      finally{if(loadEl)loadEl.style.display='none';}
    };

    window.dbSf=function(type,id,field,v){
      const arr=type==='asset'?dbAssets:type==='cash'?dbCash:dbDebts;
      const r=arr.find(x=>x.id===id);if(r)r[field]=v;dbSave();
    };
    window.dbSa=function(type,id,v){
      const arr=type==='asset'?dbAssets:type==='cash'?dbCash:dbDebts;
      const r=arr.find(x=>x.id===id);if(r)r.val=v;
      // 不重建 DOM，只更新小計
      const tot=arr.reduce((s,x)=>s+(parseFloat(x.val)||0),0);
      const stId=type==='asset'?'db-st-asset':type==='cash'?'db-st-cash':'db-st-debt';
      const st=document.getElementById(stId);if(st)st.textContent=fmt(tot);
      // 更新小計行
      const tbody=document.getElementById(type==='asset'?'db-asset-body':type==='cash'?'db-cash-body':'db-debt-body');
      if(tbody){const sub=tbody.querySelector('.cf-sub-val');if(sub)sub.textContent=fmt(tot);}
      dbCalc();dbSave();
    };
    window.dbDel=function(type,id){
      const label=type==='asset'?'資產':type==='cash'?'帳戶':'負債';
      if(!confirm('確定要刪除這筆'+label+'嗎？'))return;
      if(type==='asset')dbAssets=dbAssets.filter(x=>x.id!==id);
      else if(type==='cash')dbCash=dbCash.filter(x=>x.id!==id);
      else dbDebts=dbDebts.filter(x=>x.id!==id);
      if(type==='asset')dbRenderAssets();else if(type==='cash')dbRenderCash();else dbRenderDebts();
      dbSave();
    };
    window.dbAddAsset=function(){
      dbAssets.push({id:nid('a'),name:'',cat:'不動產',owner:'Rebecca',val:''});
      dbRenderAssets();dbSave();
    };
    window.dbAddCash=function(){
      dbCash.push({id:nid('c'),name:'',cat:'活存',owner:'Rebecca',val:''});
      dbRenderCash();dbSave();
    };

    let dbDonutChart=null;
    function dbCalc(){
      const fixedTot=dbAssets.reduce((s,r)=>s+(parseFloat(r.val)||0),0);
      const cashTot=dbCash.reduce((s,r)=>s+(parseFloat(r.val)||0),0);
      const debtTot=dbDebts.reduce((s,r)=>s+(parseFloat(r.val)||0),0);
      const stockVal=parseFloat(document.getElementById('totalValue')?.textContent?.replace(/[^0-9.-]/g,'')||'0')||0;
      const totalAsset=stockVal+fixedTot+cashTot;
      const netAsset=totalAsset-debtTot;
      const set=(id,v,color)=>{const el=document.getElementById(id);if(el){el.textContent=v;if(color)el.style.color=color;}};
      set('db-net',fmt(netAsset),netAsset>=0?'#4aad6e':'#e8675a');
      set('db-stock',fmt(stockVal));
      set('db-fixed',fmt(fixedTot));
      set('db-cash',fmt(cashTot));
      set('db-debt',fmt(debtTot),'#e8675a');
      set('db-hero-total-asset',fmt(totalAsset));
      set('db-hero-total-debt',fmt(debtTot));

      // 5000萬目標
      const goalPct=Math.min(100,Math.max(0,(netAsset/GOAL)*100));
      const goalRemain=Math.max(0,GOAL-netAsset);
      set('db-goal-pct',goalPct.toFixed(1)+'%');
      set('db-goal-current',fmt(netAsset));
      set('db-goal-remain',fmt(goalRemain));
      const goalBar=document.getElementById('db-goal-bar');
      if(goalBar)goalBar.style.width=goalPct+'%';

      // 現金流
      const cfIn=parseFloat(document.getElementById('cf-s-in')?.textContent?.replace(/[^0-9.-]/g,'')||'0')||0;
      const cfOut=parseFloat(document.getElementById('cf-s-out')?.textContent?.replace(/[^0-9.-]/g,'')||'0')||0;
      const cfFcf=cfIn-cfOut;
      set('db-mo-in',fmt(cfIn),'#4aad6e');
      set('db-mo-out',fmt(cfOut),'#e8675a');
      set('db-mo-fcf',fmt(cfFcf),cfFcf>=0?'#4aad6e':'#e8675a');

      // badges
      const ratioEl=document.getElementById('db-badge-ratio');
      const savingEl=document.getElementById('db-badge-saving');
      if(ratioEl){
        const ratio=totalAsset>0?((debtTot/totalAsset)*100):0;
        ratioEl.textContent='負債比 '+ratio.toFixed(1)+'%';
        ratioEl.style.color=ratio>60?'#e8675a':ratio>40?'#f5a623':'#4aad6e';
      }
      if(savingEl){
        const saving=cfIn>0?((cfFcf/cfIn)*100):0;
        savingEl.textContent='儲蓄率 '+saving.toFixed(1)+'%';
        savingEl.style.color=saving<10?'#e8675a':saving<30?'#f5a623':'#4aad6e';
      }

      // bar chart (4 bars now)
      const maxBar=Math.max(stockVal,fixedTot,cashTot,debtTot,1);
      const sw=(id,p)=>{const el=document.getElementById(id);if(el)el.style.width=Math.max(0,Math.round(p))+'%';};
      sw('db-bar-stock',Math.round((stockVal/maxBar)*100));
      sw('db-bar-fixed',Math.round((fixedTot/maxBar)*100));
      sw('db-bar-cash',Math.round((cashTot/maxBar)*100));
      sw('db-bar-debt',Math.round((debtTot/maxBar)*100));
      const setV=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
      setV('db-bar-stock-v',fmt(stockVal));
      setV('db-bar-fixed-v',fmt(fixedTot));
      setV('db-bar-cash-v',fmt(cashTot));
      setV('db-bar-debt-v',fmt(debtTot));

      // percentages
      const totalAll=stockVal+fixedTot+cashTot+debtTot||1;
      setV('db-pct-stock',Math.round((stockVal/totalAll)*100)+'%');
      setV('db-pct-fixed',Math.round((fixedTot/totalAll)*100)+'%');
      setV('db-pct-cash',Math.round((cashTot/totalAll)*100)+'%');
      setV('db-pct-debt',Math.round((debtTot/totalAll)*100)+'%');

      // donut chart
      dbRenderDonut(stockVal,fixedTot,cashTot,debtTot);
    }

    function dbRenderDonut(stock,fixed,cash,debt){
      const canvas=document.getElementById('db-donut-chart');
      if(!canvas||typeof Chart==='undefined')return;
      if(dbDonutChart){dbDonutChart.destroy();dbDonutChart=null;}
      const hasData=stock>0||fixed>0||cash>0||debt>0;
      dbDonutChart=new Chart(canvas,{
        type:'doughnut',
        data:{
          labels:['股票','固定資產','現金','負債'],
          datasets:[{
            data:hasData?[stock,fixed,cash,debt]:[1],
            backgroundColor:hasData?['#2563eb','#f59e0b','#10b981','#ef4444']:['rgba(255,255,255,.06)'],
            borderWidth:0,
            hoverOffset:6
          }]
        },
        options:{
          cutout:'68%',
          responsive:false,
          plugins:{
            legend:{display:false},
            tooltip:{
              enabled:hasData,
              callbacks:{
                label:function(ctx){return ctx.label+': '+fmt(ctx.raw);}
              },
              backgroundColor:'#3d3c38',
              titleColor:'#f0ede6',
              bodyColor:'#ccc9bf',
              borderColor:'rgba(255,255,255,.12)',
              borderWidth:1,
              padding:10,
              bodyFont:{size:13}
            }
          }
        }
      });
    }

    let dbSaveTimer=null;
    function dbSave(){
      try{localStorage.setItem(DB_STORE,JSON.stringify({assets:dbAssets,cash:dbCash,debts:dbDebts,reminders:dbReminders}));}catch(e){}
      clearTimeout(dbSaveTimer);
      dbSaveTimer=setTimeout(()=>{
        try{
          const {db}=window.firebaseApp||{};
          if(!db||!window._fbSetDoc||!window._fbDoc)return;
          window._fbSetDoc(window._fbDoc(db,'dashboard','data'),{assets:dbAssets,cash:dbCash,debts:dbDebts,reminders:dbReminders,updatedAt:new Date().toISOString()},{merge:true});
        }catch(e){console.warn('dbSave to Firebase failed',e);}
      },500);
    }
    async function dbLoad(){
      try{
        const {db}=window.firebaseApp||{};
        if(db&&window._fbGetDoc&&window._fbDoc){
          const snap=await window._fbGetDoc(window._fbDoc(db,'dashboard','data'));
          if(snap.exists()){
            const d=snap.data();
            if(d.assets?.length)dbAssets=d.assets;
            if(d.cash?.length)dbCash=d.cash;
            if(d.debts?.length)dbDebts=d.debts;
            if(d.reminders?.length)dbReminders=d.reminders;
            dbCtr=Math.max(dbCtr,...[...dbAssets,...dbCash,...dbDebts,...dbReminders].map(r=>parseInt(r.id?.replace(/\D/g,'')||'0')||0));
            return;
          }
        }
      }catch(e){console.warn('dbLoad from Firebase failed, fallback to localStorage',e);}
      try{
        const raw=localStorage.getItem(DB_STORE);if(!raw)return;
        const d=JSON.parse(raw);
        if(d.assets?.length)dbAssets=d.assets;
        if(d.cash?.length)dbCash=d.cash;
        if(d.debts?.length)dbDebts=d.debts;
        if(d.reminders?.length)dbReminders=d.reminders;
        dbCtr=Math.max(dbCtr,...[...dbAssets,...dbCash,...dbDebts,...dbReminders].map(r=>parseInt(r.id?.replace(/\D/g,'')||'0')||0));
      }catch(e){}
    }
    // dbLoad 由 dbRender 呼叫，不需在此獨立呼叫
    })();
