"""
期貨監控 LINE 通知後端
部署平台：Render / Railway
功能：
  - 保證金紅/黃燈警示
  - 每日損益結算通知
  - AI 分析結果推送
  - 台指期結算日提醒
  - 美國期貨結算日提醒
  - 重要財經數據公布提醒
"""

import streamlit as st
import requests
import json
import os
import time
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from anthropic import Anthropic

# ─────────────────────────────────────────────
# 頁面設定
# ─────────────────────────────────────────────
st.set_page_config(
    page_title="期貨 LINE 通知系統",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
body, .stApp { background: #0f172a !important; color: #f1f5f9; }
section[data-testid="stSidebar"] { background: #1e293b !important; }
.block-container { padding-top: 1.5rem; }
.metric-card {
    background: #1e293b; border: 1px solid #334155;
    border-radius: 12px; padding: 16px; margin: 4px 0;
}
.alert-red    { border-left: 4px solid #ef4444; background: rgba(239,68,68,0.12); padding:12px 16px; border-radius:8px; margin:6px 0; }
.alert-yellow { border-left: 4px solid #f59e0b; background: rgba(245,158,11,0.12); padding:12px 16px; border-radius:8px; margin:6px 0; }
.alert-green  { border-left: 4px solid #10b981; background: rgba(16,185,129,0.12); padding:12px 16px; border-radius:8px; margin:6px 0; }
.log-box {
    background:#0f172a; border:1px solid #334155; border-radius:8px;
    padding:12px; font-family:monospace; font-size:12px;
    max-height:280px; overflow-y:auto; color:#94a3b8;
}
div[data-testid="stMetricValue"] { color: #f1f5f9 !important; }
</style>
""", unsafe_allow_html=True)

TW   = ZoneInfo("Asia/Taipei")
PTF  = 50  # 微台指每點 NT$50

# ─────────────────────────────────────────────
# Session State 初始化
# ─────────────────────────────────────────────
DEFAULTS = dict(
    line_token      = os.environ.get("LINE_NOTIFY_TOKEN", ""),
    anthropic_key   = os.environ.get("ANTHROPIC_API_KEY", ""),
    equity          = 353421,
    margin_per_lot  = 46000,
    risk_pct        = 3.0,
    max_lots        = 3,
    warn_pct        = 70.0,
    danger_pct      = 90.0,
    max_loss_pct    = 5.0,
    realized_pnl    = 0,
    positions       = [],
    deposits        = [],
    daily_records   = [],
    events          = [],
    log             = [],
    last_twse       = 0.0,
    last_tsmc       = 0.0,
    last_twse_prev  = 0.0,
    last_tsmc_prev  = 0.0,
    notified_danger = False,
    notified_warn   = False,
    notified_settle_days = set(),
    auto_monitor    = False,
)
for k, v in DEFAULTS.items():
    if k not in st.session_state:
        st.session_state[k] = v

# ─────────────────────────────────────────────
# 日誌
# ─────────────────────────────────────────────
def log(msg: str):
    ts = datetime.now(TW).strftime("%H:%M:%S")
    st.session_state.log.insert(0, f"[{ts}] {msg}")
    st.session_state.log = st.session_state.log[:120]

# ─────────────────────────────────────────────
# LINE Notify
# ─────────────────────────────────────────────
def send_line(message: str, token: str = "") -> bool:
    tk = token or st.session_state.line_token
    if not tk or tk.strip() == "":
        log("⚠️ 尚未設定 LINE Token，無法發送")
        return False
    try:
        r = requests.post(
            "https://notify-api.line.me/api/notify",
            headers={"Authorization": f"Bearer {tk}"},
            data={"message": message},
            timeout=10,
        )
        ok = r.status_code == 200
        log(f"{'✅ LINE 已送出' if ok else f'❌ LINE 失敗 {r.status_code}'}: {message[:50].strip()}…")
        return ok
    except Exception as e:
        log(f"❌ LINE 錯誤: {e}")
        return False

# ─────────────────────────────────────────────
# 報價抓取（4 層備援）
# ─────────────────────────────────────────────
QUOTE_PROXIES = [
    "https://corsproxy.io/?url=",
    "https://api.allorigins.win/raw?url=",
    "https://api.codetabs.com/v1/proxy?quest=",
]

def _yahoo(symbol_tw: str):
    sym = symbol_tw + ".TW"
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}?interval=1d&range=2d"
    errors = []
    for proxy in QUOTE_PROXIES:
        try:
            r = requests.get(proxy + requests.utils.quote(url, safe=""), timeout=8)
            d = r.json()
            meta = d["chart"]["result"][0]["meta"]
            cur  = meta.get("regularMarketPrice") or meta.get("chartPreviousClose")
            prev = meta.get("chartPreviousClose") or meta.get("previousClose")
            if cur and float(cur) > 0:
                return abs(float(cur)), abs(float(prev)) if prev else abs(float(cur))
        except Exception as e:
            errors.append(str(e))
    return None, None

def fetch_prices():
    twse, twse_prev = _yahoo("t00")
    tsmc, tsmc_prev = _yahoo("2330")
    if twse:
        st.session_state.last_twse      = twse
        st.session_state.last_twse_prev = twse_prev or twse
        log(f"加權指數 {twse:,.0f}（昨收 {twse_prev:,.0f}）")
    else:
        log("⚠️ 加權指數報價失敗")
    if tsmc:
        st.session_state.last_tsmc      = tsmc
        st.session_state.last_tsmc_prev = tsmc_prev or tsmc
        log(f"台積電 NT${tsmc:,.0f}（昨收 NT${tsmc_prev:,.0f}）")
    else:
        log("⚠️ 台積電報價失敗")
    return twse, tsmc

# ─────────────────────────────────────────────
# 結算日計算
# ─────────────────────────────────────────────
def third_wed(y, m):
    """當月第三個週三"""
    c = 0
    for d in range(1, 32):
        try:
            dt = date(y, m, d)
        except ValueError:
            break
        if dt.weekday() == 2:   # 週三
            c += 1
            if c == 3:
                return dt
    return None

def third_fri(y, m):
    """當月第三個週五（美國期貨/選擇權結算）"""
    c = 0
    for d in range(1, 32):
        try:
            dt = date(y, m, d)
        except ValueError:
            break
        if dt.weekday() == 4:   # 週五
            c += 1
            if c == 3:
                return dt
    return None

def next_settlements():
    """回傳接下來 3 個月的台指期 & 美期結算日"""
    today = date.today()
    results = []
    for i in range(4):
        m = (today.month - 1 + i) % 12 + 1
        y = today.year + (today.month - 1 + i) // 12
        tw = third_wed(y, m)
        us = third_fri(y, m)
        if tw and tw >= today:
            results.append({"type": "台指期結算", "date": tw, "color": "🔴"})
        if us and us >= today:
            results.append({"type": "美期結算",   "date": us, "color": "🟠"})
    results.sort(key=lambda x: x["date"])
    return results[:6]

def days_until(dt: date) -> int:
    return (dt - date.today()).days

# ─────────────────────────────────────────────
# 帳戶計算
# ─────────────────────────────────────────────
def calc_metrics():
    eq      = st.session_state.equity
    pos     = st.session_state.positions
    real    = st.session_state.realized_pnl
    mpl     = st.session_state.margin_per_lot

    total_margin = sum(p["qty"] * mpl for p in pos)
    total_unreal = sum(
        (p["cur"] - p["entry"]) * PTF * p["qty"] if p["dir"] == "多"
        else (p["entry"] - p["cur"]) * PTF * p["qty"]
        for p in pos
    )
    net   = eq + total_unreal
    ratio = total_margin / net * 100 if net > 0 else 0.0
    day   = real + total_unreal
    return {
        "equity":        eq,
        "net_equity":    net,
        "total_margin":  total_margin,
        "total_unreal":  total_unreal,
        "ratio":         ratio,
        "day_total":     day,
        "risk_amt":      eq * st.session_state.risk_pct / 100,
        "max_loss":      eq * st.session_state.max_loss_pct / 100,
        "lots":          sum(p["qty"] for p in pos),
    }

# ─────────────────────────────────────────────
# 保證金警示通知
# ─────────────────────────────────────────────
def check_margin_notify(m: dict):
    ratio   = m["ratio"]
    danger  = st.session_state.danger_pct
    warn    = st.session_state.warn_pct
    now_str = datetime.now(TW).strftime("%Y/%m/%d %H:%M")

    if ratio >= danger and not st.session_state.notified_danger:
        send_line(
            f"\n🔴【期貨帳戶緊急警示】\n"
            f"保證金使用率：{ratio:.1f}%（紅燈 ≥{danger:.0f}%）\n"
            f"帳戶淨值：NT${m['net_equity']:,.0f}\n"
            f"未實現損益：NT${m['total_unreal']:+,.0f}\n"
            f"持倉：{m['lots']} 口\n"
            f"⚠️ 請立即減倉或補繳保證金！\n"
            f"時間：{now_str}"
        )
        st.session_state.notified_danger = True
        st.session_state.notified_warn   = True

    elif ratio >= warn and not st.session_state.notified_warn:
        send_line(
            f"\n🟡【期貨帳戶黃燈警示】\n"
            f"保證金使用率：{ratio:.1f}%（黃燈 ≥{warn:.0f}%）\n"
            f"帳戶淨值：NT${m['net_equity']:,.0f}\n"
            f"注意部位風險\n"
            f"時間：{now_str}"
        )
        st.session_state.notified_warn = True

    elif ratio < warn:
        st.session_state.notified_danger = False
        st.session_state.notified_warn   = False

    if m["day_total"] < -m["max_loss"]:
        send_line(
            f"\n🔴【今日虧損超限】\n"
            f"今日損益：NT${m['day_total']:,.0f}\n"
            f"上限：NT${-m['max_loss']:,.0f}\n"
            f"建議立即停止交易\n"
            f"時間：{now_str}"
        )

# ─────────────────────────────────────────────
# 結算日提醒通知
# ─────────────────────────────────────────────
def check_settle_notify():
    settles = next_settlements()
    today   = date.today()
    notified = st.session_state.notified_settle_days

    for s in settles:
        diff = days_until(s["date"])
        key  = f"{s['type']}_{s['date']}"

        # 通知時機：前7天、前3天、前1天、當天
        if diff in (7, 3, 1, 0) and key + f"_d{diff}" not in notified:
            label = "今日" if diff == 0 else f"{diff}天後"
            msg = (
                f"\n{s['color']}【{s['type']}提醒】\n"
                f"日期：{s['date'].strftime('%Y/%m/%d')}（{label}）\n"
            )
            if diff == 0:
                msg += "結算日當天，請注意急拉急殺，建議縮減部位\n"
            elif diff == 1:
                msg += "結算前夕，停損設緊，避免留倉過夜\n"
            elif diff <= 3:
                msg += "結算週，Gamma 風險上升，注意波動加劇\n"
            else:
                msg += "結算前一週，關注法人換倉動向\n"
            msg += f"時間：{datetime.now(TW).strftime('%H:%M')}"
            send_line(msg)
            notified.add(key + f"_d{diff}")
            st.session_state.notified_settle_days = notified

# ─────────────────────────────────────────────
# 每日結算通知
# ─────────────────────────────────────────────
def send_daily_summary(m: dict | None = None):
    if m is None:
        m = calc_metrics()
    twse = st.session_state.last_twse
    tsmc = st.session_state.last_tsmc
    settles = next_settlements()
    settle_lines = ""
    for s in settles[:3]:
        diff = days_until(s["date"])
        settle_lines += f"\n{s['color']} {s['type']}：{s['date'].strftime('%m/%d')}（{diff}天後）"

    emoji = "📈" if m["day_total"] >= 0 else "📉"
    msg = (
        f"\n{emoji}【每日期貨結算報告】\n"
        f"日期：{date.today().strftime('%Y/%m/%d')}\n"
        f"━━━━━━━━━━━━━\n"
        f"帳戶淨值：NT${m['net_equity']:,.0f}\n"
        f"今日損益：NT${m['day_total']:+,.0f}\n"
        f"未實現損益：NT${m['total_unreal']:+,.0f}\n"
        f"保證金使用率：{m['ratio']:.1f}%\n"
        f"持倉口數：{m['lots']} 口\n"
        f"━━━━━━━━━━━━━"
    )
    if twse:
        prev = st.session_state.last_twse_prev
        pct  = (twse - prev) / prev * 100 if prev else 0
        msg += f"\n加權指數：{twse:,.0f}（{pct:+.2f}%）"
    if tsmc:
        prev = st.session_state.last_tsmc_prev
        pct  = (tsmc - prev) / prev * 100 if prev else 0
        msg += f"\n台積電：NT${tsmc:,.0f}（{pct:+.2f}%）"
    if settle_lines:
        msg += f"\n━━━━━━━━━━━━━\n📅 近期結算日{settle_lines}"
    send_line(msg)

# ─────────────────────────────────────────────
# AI 分析並發 LINE
# ─────────────────────────────────────────────
def run_ai_analysis_and_notify():
    key = st.session_state.anthropic_key
    if not key:
        log("⚠️ 尚未設定 Anthropic API Key")
        st.warning("請在設定頁填入 Anthropic API Key")
        return

    twse = st.session_state.last_twse
    tsmc = st.session_state.last_tsmc
    if not twse:
        log("⚠️ 沒有報價，無法進行 AI 分析")
        st.warning("請先更新報價")
        return

    m       = calc_metrics()
    settles = next_settlements()
    settle_ctx = "、".join([f"{s['type']} {days_until(s['date'])}天後" for s in settles[:2]])

    twse_prev = st.session_state.last_twse_prev
    twse_pct  = (twse - twse_prev) / twse_prev * 100 if twse_prev else 0
    tsmc_prev = st.session_state.last_tsmc_prev
    tsmc_pct  = (tsmc - tsmc_prev) / tsmc_prev * 100 if tsmc_prev and tsmc else 0

    prompt = f"""你是專業微台指分析師。給出簡潔操作建議（適合 LINE 訊息格式，100字內）。

數據：
- 加權指數：{twse:,.0f}點（今日 {twse_pct:+.2f}%）
- 台積電：NT${tsmc:,.0f}（今日 {tsmc_pct:+.2f}%）
- 帳戶淨值：NT${m['net_equity']:,.0f}
- 保證金使用率：{m['ratio']:.1f}%
- 結算：{settle_ctx}
- 最大可用口數：{st.session_state.max_lots}

請直接給出：
1. 多空傾向（強多/偏多/中性/偏空/強空）
2. 關鍵支撐/壓力
3. 操作建議 1 句
4. 風險提示 1 句

用純文字，不要 JSON，適合 LINE 推送格式。"""

    try:
        client = Anthropic(api_key=key)
        resp = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}]
        )
        analysis = resp.content[0].text

        msg = (
            f"\n🤖【AI 期貨分析】\n"
            f"時間：{datetime.now(TW).strftime('%m/%d %H:%M')}\n"
            f"━━━━━━━━━━━━━\n"
            f"{analysis}\n"
            f"━━━━━━━━━━━━━\n"
            f"加權 {twse:,.0f}（{twse_pct:+.2f}%） | "
            f"台積電 {tsmc:,.0f}（{tsmc_pct:+.2f}%）"
        )
        send_line(msg)
        log("✅ AI 分析已發送 LINE")
        return analysis
    except Exception as e:
        log(f"❌ AI 分析失敗: {e}")
        st.error(f"AI 分析失敗：{e}")
        return None

# ══════════════════════════════════════════════
# ─── 側邊欄設定 ────────────────────────────
# ══════════════════════════════════════════════
with st.sidebar:
    st.header("⚙️ 設定")

    with st.expander("🔑 API 金鑰", expanded=True):
        st.session_state.line_token = st.text_input(
            "LINE Notify Token", value=st.session_state.line_token,
            type="password", placeholder="貼上 Token"
        )
        st.session_state.anthropic_key = st.text_input(
            "Anthropic API Key", value=st.session_state.anthropic_key,
            type="password", placeholder="sk-ant-…"
        )
        if st.button("🧪 測試 LINE"):
            send_line(f"\n✅ 連線測試成功！{datetime.now(TW).strftime('%H:%M:%S')}")

    with st.expander("💰 帳戶設定", expanded=True):
        st.session_state.equity         = st.number_input("帳戶權益數 (NT$)",    value=st.session_state.equity,         step=1000, min_value=0)
        st.session_state.margin_per_lot = st.number_input("保證金/口 (NT$)",      value=st.session_state.margin_per_lot, step=1000, min_value=0)
        st.session_state.risk_pct       = st.slider("風險 % / 筆",  1.0, 10.0,   st.session_state.risk_pct,   0.5)
        st.session_state.max_lots       = st.number_input("最大口數", value=st.session_state.max_lots, step=1, min_value=1)

    with st.expander("🚦 警示閾值"):
        st.session_state.warn_pct      = st.slider("黃燈 %",      50.0, 95.0, st.session_state.warn_pct,     1.0)
        st.session_state.danger_pct    = st.slider("紅燈 %",      60.0, 99.0, st.session_state.danger_pct,   1.0)
        st.session_state.max_loss_pct  = st.slider("最大虧損 %",  1.0,  20.0, st.session_state.max_loss_pct, 0.5)

    st.divider()
    auto = st.toggle("🤖 啟動自動監控", value=st.session_state.auto_monitor)
    st.session_state.auto_monitor = auto
    if auto:
        st.success("監控中 — 每次頁面刷新執行檢查")

# ══════════════════════════════════════════════
# ─── 主頁 Tabs ─────────────────────────────
# ══════════════════════════════════════════════
st.title("📈 期貨監控 LINE 通知系統")

tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
    "📊 總覽", "💸 出入金", "📋 部位", "📅 損益記錄", "📆 結算日曆", "📜 日誌"
])

# ══════════════════════════════════════════════
# Tab 1：總覽
# ══════════════════════════════════════════════
with tab1:
    # 快速操作列
    bc1, bc2, bc3, bc4 = st.columns(4)
    with bc1:
        if st.button("🔄 更新報價", use_container_width=True):
            with st.spinner("抓取中…"):
                fetch_prices()
            st.rerun()
    with bc2:
        if st.button("🤖 AI 分析 + 發 LINE", use_container_width=True):
            with st.spinner("分析中…"):
                result = run_ai_analysis_and_notify()
            if result:
                st.success("AI 分析完成，已發送 LINE")
    with bc3:
        if st.button("📊 每日結算發 LINE", use_container_width=True):
            send_daily_summary()
            st.success("已發送")
    with bc4:
        if st.button("🚨 立即發保證金警示", use_container_width=True):
            m = calc_metrics()
            check_margin_notify(m)
            st.success("已觸發")

    # 報價卡
    p_col1, p_col2 = st.columns(2)
    twse = st.session_state.last_twse
    tsmc = st.session_state.last_tsmc
    twse_pct = (twse - st.session_state.last_twse_prev) / st.session_state.last_twse_prev * 100 if st.session_state.last_twse_prev else 0
    tsmc_pct = (tsmc - st.session_state.last_tsmc_prev) / st.session_state.last_tsmc_prev * 100 if st.session_state.last_tsmc_prev else 0
    with p_col1:
        st.metric("加權指數", f"{twse:,.0f}" if twse else "—", f"{twse_pct:+.2f}%" if twse else None)
    with p_col2:
        st.metric("台積電 2330", f"NT${tsmc:,.0f}" if tsmc else "—", f"{tsmc_pct:+.2f}%" if tsmc else None)

    # 手動輸入
    with st.expander("✏️ 手動輸入點位（報價失敗時使用）"):
        mc1, mc2 = st.columns(2)
        mp = mc1.number_input("加權指數點位", value=twse or 22500.0, step=1.0, format="%.0f")
        mp_pct = mc2.number_input("今日漲跌 %", value=0.0, step=0.01)
        if st.button("套用手動點位"):
            st.session_state.last_twse = mp
            prev = mp / (1 + mp_pct / 100) if mp_pct != 0 else mp
            st.session_state.last_twse_prev = prev
            log(f"手動套用：加權 {mp:,.0f}（{mp_pct:+.2f}%）")
            st.rerun()

    st.divider()

    # 帳戶指標
    m = calc_metrics()
    ratio = m["ratio"]

    mc1, mc2, mc3, mc4 = st.columns(4)
    mc1.metric("帳戶淨值",   f"NT${m['net_equity']:,.0f}")
    mc2.metric("未實現損益", f"NT${m['total_unreal']:+,.0f}")
    mc3.metric("今日損益",   f"NT${m['day_total']:+,.0f}")
    mc4.metric("持倉口數",   f"{m['lots']} 口")

    # 保證金進度條
    color_emoji = "🔴" if ratio >= st.session_state.danger_pct else "🟡" if ratio >= st.session_state.warn_pct else "🟢"
    st.progress(min(ratio / 100, 1.0),
                text=f"{color_emoji} 保證金使用率 {ratio:.1f}%　（NT${m['total_margin']:,.0f} / NT${m['net_equity']:,.0f}）")

    if ratio >= st.session_state.danger_pct:
        st.markdown('<div class="alert-red">🔴 保證金使用率超過紅燈！立即減倉或補繳</div>', unsafe_allow_html=True)
    elif ratio >= st.session_state.warn_pct:
        st.markdown('<div class="alert-yellow">🟡 保證金使用率達黃燈警示</div>', unsafe_allow_html=True)
    elif m["lots"] > 0:
        st.markdown('<div class="alert-green">🟢 帳戶安全</div>', unsafe_allow_html=True)

    if m["day_total"] < -m["max_loss"]:
        st.markdown(f'<div class="alert-red">🔴 今日虧損 NT${abs(m["day_total"]):,.0f} 超過上限，建議停止交易</div>', unsafe_allow_html=True)

    # 下次結算
    settles = next_settlements()
    if settles:
        st.subheader("📅 近期結算")
        sc = st.columns(min(len(settles), 3))
        for i, s in enumerate(settles[:3]):
            diff = days_until(s["date"])
            sc[i].metric(s["type"], s["date"].strftime("%m/%d"), f"{diff} 天後" if diff > 0 else "今日！")

    # 自動監控執行
    if st.session_state.auto_monitor:
        check_margin_notify(m)
        check_settle_notify()

# ══════════════════════════════════════════════
# Tab 2：出入金
# ══════════════════════════════════════════════
with tab2:
    st.subheader("💸 出入金管理")
    st.caption("出入金後自動更新帳戶權益數，並可選擇發送 LINE 通知")

    d_col, w_col = st.columns(2)

    with d_col:
        st.markdown("### 💵 入金")
        d_date   = st.date_input("入金日期",    value=date.today(),   key="d_date")
        d_amount = st.number_input("金額 (NT$)",  min_value=0, step=10000, key="d_amt")
        d_note   = st.text_input("備註",          placeholder="例：補繳保證金", key="d_note")
        d_notify = st.checkbox("發送 LINE 通知", value=True, key="d_notify")
        if st.button("✅ 確認入金", use_container_width=True):
            if d_amount <= 0:
                st.warning("請輸入入金金額")
            else:
                st.session_state.equity += d_amount
                st.session_state.deposits.insert(0, {
                    "type": "入金", "date": str(d_date),
                    "amount": d_amount, "note": d_note,
                    "equity_after": st.session_state.equity,
                })
                log(f"💵 入金 NT${d_amount:,.0f} → 權益 NT${st.session_state.equity:,.0f}")
                st.success(f"✅ 入金 NT${d_amount:,.0f}，帳戶權益更新為 NT${st.session_state.equity:,.0f}")
                if d_notify:
                    send_line(
                        f"\n💵【入金通知】\n"
                        f"日期：{d_date}\n"
                        f"入金：NT${d_amount:+,.0f}\n"
                        f"備註：{d_note or '無'}\n"
                        f"更新後權益：NT${st.session_state.equity:,.0f}\n"
                        f"時間：{datetime.now(TW).strftime('%H:%M')}"
                    )
                st.rerun()

    with w_col:
        st.markdown("### 💸 出金")
        w_date   = st.date_input("出金日期",    value=date.today(),   key="w_date")
        w_amount = st.number_input("金額 (NT$)",  min_value=0, step=10000, key="w_amt")
        w_note   = st.text_input("備註",          placeholder="例：獲利出金",  key="w_note")
        w_notify = st.checkbox("發送 LINE 通知", value=True, key="w_notify")
        if st.button("✅ 確認出金", use_container_width=True):
            if w_amount <= 0:
                st.warning("請輸入出金金額")
            elif w_amount > st.session_state.equity:
                st.error(f"出金金額超過帳戶權益 NT${st.session_state.equity:,.0f}")
            else:
                st.session_state.equity -= w_amount
                st.session_state.deposits.insert(0, {
                    "type": "出金", "date": str(w_date),
                    "amount": -w_amount, "note": w_note,
                    "equity_after": st.session_state.equity,
                })
                log(f"💸 出金 NT${w_amount:,.0f} → 權益 NT${st.session_state.equity:,.0f}")
                st.success(f"✅ 出金 NT${w_amount:,.0f}，帳戶權益更新為 NT${st.session_state.equity:,.0f}")
                if w_notify:
                    send_line(
                        f"\n💸【出金通知】\n"
                        f"日期：{w_date}\n"
                        f"出金：NT${-w_amount:+,.0f}\n"
                        f"備註：{w_note or '無'}\n"
                        f"更新後權益：NT${st.session_state.equity:,.0f}\n"
                        f"時間：{datetime.now(TW).strftime('%H:%M')}"
                    )
                st.rerun()

    # 記錄 & 統計
    st.divider()
    if st.session_state.deposits:
        ti = sum(d["amount"] for d in st.session_state.deposits if d["amount"] > 0)
        to = sum(abs(d["amount"]) for d in st.session_state.deposits if d["amount"] < 0)
        sc1, sc2, sc3 = st.columns(3)
        sc1.metric("累計入金", f"NT${ti:,.0f}")
        sc2.metric("累計出金", f"NT${to:,.0f}")
        sc3.metric("淨入金",   f"NT${ti-to:+,.0f}")

        for dep in st.session_state.deposits:
            sign  = "+" if dep["amount"] > 0 else ""
            color = "🟢" if dep["amount"] > 0 else "🔴"
            st.markdown(
                f"{color} **{dep['date']}** {dep['type']} "
                f"`{sign}NT${abs(dep['amount']):,.0f}` "
                f"→ 餘額 `NT${dep['equity_after']:,.0f}` "
                f"{dep['note'] or ''}"
            )
        if st.button("🗑️ 清除出入金記錄"):
            st.session_state.deposits = []
            st.rerun()
    else:
        st.info("尚無出入金記錄")

# ══════════════════════════════════════════════
# Tab 3：部位管理
# ══════════════════════════════════════════════
with tab3:
    st.subheader("📋 部位管理（微台指 MTX，每點 NT$50）")

    with st.expander("➕ 新增部位", expanded=len(st.session_state.positions) == 0):
        nc1, nc2, nc3, nc4 = st.columns(4)
        n_dir   = nc1.selectbox("方向", ["多", "空"])
        n_qty   = nc2.number_input("口數", 1, 99, 1)
        default = int(st.session_state.last_twse) if st.session_state.last_twse else 22500
        n_entry = nc3.number_input("成本點位", 1, 99999, default)
        n_cur   = nc4.number_input("現在點位", 1, 99999, default)
        if st.button("新增部位"):
            pnl = (n_cur - n_entry) * PTF * n_qty if n_dir == "多" else (n_entry - n_cur) * PTF * n_qty
            st.session_state.positions.append({
                "dir": n_dir, "qty": n_qty, "entry": n_entry, "cur": n_cur
            })
            log(f"新增：{n_dir} {n_qty}口 成本{n_entry} PnL NT${pnl:+,.0f}")
            st.rerun()

    changed = False
    for i, p in enumerate(st.session_state.positions):
        pnl = (p["cur"] - p["entry"]) * PTF * p["qty"] if p["dir"] == "多" \
              else (p["entry"] - p["cur"]) * PTF * p["qty"]
        pc1, pc2, pc3, pc4, pc5, pc6 = st.columns([1, 1, 2, 2, 2, 1])
        pc1.markdown(f"**{'🟢多' if p['dir']=='多' else '🔴空'}**")
        pc2.markdown(f"**{p['qty']} 口**")
        ne = pc3.number_input("成本", value=p["entry"], key=f"e{i}", label_visibility="collapsed")
        nc = pc4.number_input("現價", value=p["cur"],   key=f"c{i}", label_visibility="collapsed")
        pc5.markdown(f"**`NT${pnl:+,.0f}`**")
        if pc6.button("✕", key=f"d{i}"):
            st.session_state.positions.pop(i)
            st.rerun()
        if ne != p["entry"] or nc != p["cur"]:
            st.session_state.positions[i]["entry"] = ne
            st.session_state.positions[i]["cur"]   = nc
            changed = True
    if changed:
        st.rerun()

    if st.session_state.positions:
        total_pnl = sum(
            (p["cur"] - p["entry"]) * PTF * p["qty"] if p["dir"] == "多"
            else (p["entry"] - p["cur"]) * PTF * p["qty"]
            for p in st.session_state.positions
        )
        st.metric("未實現損益合計", f"NT${total_pnl:+,.0f}")
    else:
        st.info("尚無部位")

    st.divider()
    real = st.number_input("今日已實現損益 (NT$)", value=st.session_state.realized_pnl, step=100)
    if real != st.session_state.realized_pnl:
        st.session_state.realized_pnl = real

# ══════════════════════════════════════════════
# Tab 4：每日損益記錄
# ══════════════════════════════════════════════
with tab4:
    st.subheader("📅 每日損益記錄")

    with st.expander("➕ 新增記錄", expanded=True):
        rc1, rc2, rc3 = st.columns(3)
        r_date = rc1.date_input("日期", value=date.today(), key="r_d")
        r_pnl  = rc2.number_input("損益 (NT$)", step=100, key="r_p")
        r_note = rc3.text_input("備註", key="r_n")
        r_line = st.checkbox("發送 LINE 通知", value=True)
        if st.button("記錄並儲存"):
            st.session_state.daily_records.insert(0, {
                "date": str(r_date), "pnl": r_pnl, "note": r_note
            })
            log(f"記錄 {r_date} 損益 NT${r_pnl:+,.0f}")
            if r_line:
                emoji = "✅" if r_pnl >= 0 else "❌"
                send_line(
                    f"\n{emoji}【每日損益記錄】\n"
                    f"日期：{r_date}\n"
                    f"損益：NT${r_pnl:+,.0f}\n"
                    f"備註：{r_note or '無'}\n"
                    f"時間：{datetime.now(TW).strftime('%H:%M')}"
                )
            st.rerun()

    if st.session_state.daily_records:
        records = st.session_state.daily_records
        total   = sum(r["pnl"] for r in records)
        wins    = sum(1 for r in records if r["pnl"] > 0)
        wr      = round(wins / len(records) * 100)
        sc1, sc2, sc3 = st.columns(3)
        sc1.metric("累計損益",  f"NT${total:+,.0f}")
        sc2.metric("勝率",      f"{wr}%")
        sc3.metric("記錄筆數",  f"{len(records)} 筆")
        for r in records[:30]:
            c = "🟢" if r["pnl"] >= 0 else "🔴"
            st.markdown(f"{c} **{r['date']}** `NT${r['pnl']:+,.0f}` {r['note'] or ''}")
        if st.button("🗑️ 清除記錄"):
            st.session_state.daily_records = []
            st.rerun()
    else:
        st.info("尚無記錄")

# ══════════════════════════════════════════════
# Tab 5：結算日曆
# ══════════════════════════════════════════════
with tab5:
    st.subheader("📆 結算日曆 & 重要事件")

    # 系統結算日
    st.markdown("### 🗓️ 系統自動計算結算日")
    settles = next_settlements()
    cols = st.columns(min(len(settles), 3))
    for i, s in enumerate(settles[:6]):
        with cols[i % 3]:
            diff = days_until(s["date"])
            color = "🔴" if diff <= 1 else "🟡" if diff <= 7 else "🔵"
            urgency = "今日" if diff == 0 else f"{diff} 天後"
            st.markdown(f"""
            <div class="metric-card">
                <div style="font-size:11px;color:#94a3b8">{s['type']}</div>
                <div style="font-size:20px;font-weight:bold;color:#f1f5f9">{s['date'].strftime('%Y/%m/%d')}</div>
                <div style="color:#94a3b8">{color} {urgency}</div>
            </div>
            """, unsafe_allow_html=True)

    if st.button("📤 發送結算日提醒到 LINE"):
        check_settle_notify()
        # 強制發送（忽略已發送記錄）
        for s in settles[:3]:
            diff = days_until(s["date"])
            send_line(
                f"\n{s['color']}【結算日提醒】\n"
                f"{s['type']}：{s['date'].strftime('%Y/%m/%d')}（{diff}天後）\n"
                f"時間：{datetime.now(TW).strftime('%H:%M')}"
            )
        st.success("已發送")

    # 自訂重要事件
    st.divider()
    st.markdown("### 📌 重要財經事件管理")

    with st.expander("➕ 新增事件"):
        ec1, ec2, ec3 = st.columns(3)
        ev_date  = ec1.date_input("日期", key="ev_d")
        ev_types = ["Fed 會議", "CPI/PPI", "非農就業", "台灣央行", "台股假日", "美股假日", "其他"]
        ev_type  = ec2.selectbox("類型", ev_types, key="ev_t")
        ev_desc  = ec3.text_input("說明", key="ev_s")
        ev_notify_days = st.multiselect("提前幾天通知", [7, 3, 1, 0], default=[1, 0])
        if st.button("新增事件"):
            st.session_state.events.append({
                "date": str(ev_date), "type": ev_type,
                "desc": ev_desc, "notify_days": ev_notify_days
            })
            log(f"新增事件：{ev_date} {ev_type} {ev_desc}")
            st.rerun()

    # 事件列表
    if st.session_state.events:
        today = str(date.today())
        sorted_events = sorted(st.session_state.events, key=lambda e: e["date"])
        for i, ev in enumerate(sorted_events):
            diff = days_until(date.fromisoformat(ev["date"]))
            past = diff < 0
            color = "⚫" if past else ("🔴" if diff == 0 else "🟡" if diff <= 3 else "🔵")
            style = "opacity:0.4;" if past else ""

            ec1, ec2 = st.columns([5, 1])
            with ec1:
                st.markdown(
                    f'<span style="{style}">{color} **{ev["date"]}** '
                    f'`{ev["type"]}` {ev["desc"]} '
                    f'{"（" + str(diff) + "天後）" if not past and diff > 0 else "（今日）" if diff == 0 else "（已過）"}'
                    f'</span>',
                    unsafe_allow_html=True
                )
            with ec2:
                if st.button("✕", key=f"ev_del_{i}"):
                    st.session_state.events.pop(i)
                    st.rerun()

        # 自動檢查事件並發通知
        if st.session_state.auto_monitor:
            for ev in sorted_events:
                diff = days_until(date.fromisoformat(ev["date"]))
                key  = f"event_{ev['date']}_{ev['type']}"
                notify_days = ev.get("notify_days", [1, 0])
                if diff in notify_days and key + f"_d{diff}" not in st.session_state.notified_settle_days:
                    label = "今日" if diff == 0 else f"{diff}天後"
                    send_line(
                        f"\n📌【重要事件提醒】\n"
                        f"事件：{ev['type']} — {ev['desc']}\n"
                        f"日期：{ev['date']}（{label}）\n"
                        f"時間：{datetime.now(TW).strftime('%H:%M')}"
                    )
                    notified = st.session_state.notified_settle_days
                    notified.add(key + f"_d{diff}")
                    st.session_state.notified_settle_days = notified
    else:
        st.info("尚無自訂事件")

# ══════════════════════════════════════════════
# Tab 6：通知日誌
# ══════════════════════════════════════════════
with tab6:
    st.subheader("📜 通知日誌")

    # 手動觸發
    lc1, lc2, lc3 = st.columns(3)
    with lc1:
        if st.button("📊 發帳戶總覽"):
            send_daily_summary()
    with lc2:
        if st.button("📆 發結算日提醒"):
            for s in next_settlements()[:2]:
                diff = days_until(s["date"])
                send_line(
                    f"\n{s['color']}【{s['type']}】{s['date'].strftime('%m/%d')}（{diff}天後）"
                )
    with lc3:
        custom = st.text_area("自訂訊息", height=80, placeholder="輸入任意訊息")
        if st.button("📨 發送"):
            if custom:
                send_line("\n" + custom)

    st.divider()

    if st.session_state.log:
        html_log = "<br>".join(st.session_state.log)
        st.markdown(f'<div class="log-box">{html_log}</div>', unsafe_allow_html=True)
        if st.button("🗑️ 清除日誌"):
            st.session_state.log = []
            st.rerun()
    else:
        st.info("尚無日誌")

    # 使用說明
    with st.expander("ℹ️ 部署說明 & LINE Token 申請"):
        st.markdown("""
        ### 🚀 部署到 Render（免費）
        1. 在 GitHub 建立新 repo，上傳 `app.py` + `requirements.txt`
        2. 前往 https://render.com → New Web Service
        3. 連接 GitHub repo
        4. Build Command：`pip install -r requirements.txt`
        5. Start Command：`streamlit run app.py --server.port $PORT --server.address 0.0.0.0`
        6. 在 Environment Variables 填入：
           - `LINE_NOTIFY_TOKEN` = 你的 LINE Token
           - `ANTHROPIC_API_KEY` = 你的 API Key

        ### 🚀 部署到 Railway（更簡單）
        1. 上傳 `app.py` + `requirements.txt` + `railway.toml`
        2. 前往 https://railway.app → New Project → GitHub
        3. Environment Variables 同上

        ### 📱 LINE Notify Token
        1. https://notify-bot.line.me/zh_TW/
        2. 個人頁面 → 發行存取權杖
        3. 選擇通知群組（建議建立「期貨監控」群組）
        4. 複製 Token 填入設定

        ### ⚠️ 注意
        - Render 免費版每 15 分鐘休眠，建議設定 UptimeRobot 保持喚醒
        - Session State 在重啟後會清除，重要設定建議寫入環境變數
        - LINE Notify 免費版每日上限 1,000 則
        """)
