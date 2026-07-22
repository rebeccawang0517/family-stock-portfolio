# -*- coding: utf-8 -*-
"""
台指期貨（TAIFEX FITX）日盤／夜盤統計交易 —— 雙策略回測程式
=================================================================

作者定位：本程式以量化交易工程師的角度撰寫，使用 Python + Backtrader 框架。

【回測標的】
台灣加權指數期貨（TX）5 分鐘 K 線。

【交易日（Trading Day, T）切割規則】
- 夜盤（Night Session）：T-1 日曆天 15:00–23:59  +  T 日曆天 00:00–05:00
  （也就是說：晚上 15:00 開始的夜盤，一路交易到隔天凌晨 05:00，
    這整段夜盤都算是「隔天（T）日盤」的前哨戰）
- 日盤（Day Session）：T 日曆天 08:45–13:45

【每日核心指標】（在 T 日 08:45 日盤開盤時，用 T 的夜盤資料算好）
- Night_Low   ：T 夜盤（T-1 15:00 ~ T 05:00）最低價
- Night_High  ：T 夜盤最高價
- Night_Close ：T 夜盤最後一根 K 線（04:55–05:00 這根）的收盤價
- Day_Open    ：T 日盤第一根 K 線（08:45 這根）的開盤價

本程式分成三大部分：
  1) build_taifex_dataset()  —— 用 pandas 把原始 5 分 K 轉成「以交易日分組」
     並掛上 Night_Low / Night_High / Night_Close / Day_Open 四個欄位的資料。
     （為了讓 Backtrader 的策略邏輯單純，這裡只保留「日盤」那一段 K 棒餵給
       Backtrader —— 進出場本來就只發生在日盤，夜盤只是用來算指標的原料。）
  2) TaifexDayData           —— 自訂的 PandasData，把上面四個額外欄位變成
     Backtrader 可以在策略裡直接讀取的 self.data.night_low[0] 這種寫法。
  3) Strategy1_SupportLong / Strategy2_BreakdownShort
     —— 兩個策略邏輯本體，以及一個共用的績效統計輸出函式。

【使用方式】
    1. 準備一份 5 分 K 的 CSV，欄位需求：datetime, open, high, low, close, volume
       datetime 需可被 pandas.to_datetime() 解析（含日期＋時間）。
    2. 把下面 CSV_PATH 換成你的檔案路徑。
    3. 直接執行：python taifex_dual_strategy_backtest.py
       （若找不到 CSV_PATH，程式會自動產生一段「假資料」讓你先跑通流程，
        驗證邏輯無誤後再換上真實歷史資料。）

【重要提醒 —— AI 生成程式碼的已知限制，請務必人工覆核】
- 本程式範例把「1 口」當作預設下單口數；策略一的「先平一半、剩餘移動停利」
  只有在口數 ≥ 2 時才有意義，口數=1 時會自動改為「整口直接切換成移動停利模式」
  （已在程式中以註解標明，請依你實際想要的口數調整 size 參數）。
- 策略二停損預設用「進場價 + 40 點」的固定寫法；題目提到的「當日最近一次反彈
  高點」屬於動態停損，本程式僅在註解中標示替代寫法的思路，未實作，需要你自行
  用 self.data.high 的 rolling max 補上。
- 回測撮合採用 Backtrader 預設「訊號 K 收盤確認 → 下一根開盤成交」的市價單邏輯，
  未內建滑價／委託失敗模擬，正式上線前務必另外評估。
"""

import os
import datetime as dt
from datetime import time as dtime

import numpy as np
import pandas as pd
import backtrader as bt


# =================================================================
# 1) 資料前處理：把 5 分 K 依「交易日」規則分組，算出 Night_Low / Night_High /
#    Night_Close / Day_Open，並只留下日盤那一段 K 棒回傳（進出場只在日盤發生）。
# =================================================================
DAY_START = dtime(8, 45)
DAY_END = dtime(13, 45)
NIGHT_EVENING_START = dtime(15, 0)
NIGHT_EVENING_END = dtime(23, 59)
NIGHT_MORNING_START = dtime(0, 0)
NIGHT_MORNING_END = dtime(5, 0)


def build_taifex_dataset(raw: pd.DataFrame) -> pd.DataFrame:
    """輸入：以 DatetimeIndex 排序好的 5 分 K（欄位 open/high/low/close/volume）。
    輸出：只含「日盤」那段 K 棒，並附上 night_low/night_high/night_close/day_open 四欄。
    """
    df = raw.sort_index().copy()
    idx = df.index
    t = idx.time
    d = idx.date

    day_mask = (t >= DAY_START) & (t <= DAY_END)
    evening_mask = (t >= NIGHT_EVENING_START) & (t <= NIGHT_EVENING_END)
    morning_mask = (t >= NIGHT_MORNING_START) & (t <= NIGHT_MORNING_END)
    night_mask = evening_mask | morning_mask

    # ── 交易日（trading_day）歸屬規則 ──
    #   08:45-13:45（日盤）           → 當天日曆天
    #   00:00-05:00（夜盤延伸的凌晨） → 當天日曆天（算「今天」日盤前的夜盤尾段）
    #   15:00-23:59（夜盤開始）       → 隔天日曆天（算「明天」日盤前的夜盤開頭）
    trading_day = pd.Series(d, index=idx, dtype="object")
    if evening_mask.any():
        shifted = pd.to_datetime(pd.Series(d, index=idx)[evening_mask]) + pd.Timedelta(days=1)
        trading_day.loc[evening_mask] = shifted.dt.date.values

    df["is_day"] = day_mask
    df["is_night"] = night_mask
    df["trading_day"] = trading_day.values

    # 理論上日盤／夜盤以外的時段（05:00-08:45 收盤空檔）不該有資料，保險起見濾掉
    df = df[df["is_day"] | df["is_night"]].copy()

    night_df = df[df["is_night"]].sort_index()
    day_df = df[df["is_day"]].sort_index()

    night_stats = night_df.groupby("trading_day").agg(
        night_low=("low", "min"),
        night_high=("high", "max"),
    )
    # 夜盤最後一根 K（時間序上的最後一筆，即 04:55-05:00 那根）的收盤價
    night_close = night_df.groupby("trading_day").apply(lambda g: g["close"].iloc[-1])
    night_stats["night_close"] = night_close

    # 日盤第一根 K（08:45 那根）的開盤價
    day_open = day_df.groupby("trading_day").apply(lambda g: g["open"].iloc[0])
    night_stats["day_open"] = day_open

    # 只回傳日盤那段 K 棒，掛上當天的四個核心指標（同一天的日盤 K 棒都是同一組數值）
    out = day_df.merge(night_stats, left_on="trading_day", right_index=True, how="left")
    out = out.sort_index()

    # 少數第一個交易日可能沒有前一夜的夜盤資料（歷史資料起始點），丟棄無法判斷的列
    out = out.dropna(subset=["night_low", "night_high", "night_close", "day_open"])
    return out


# =================================================================
# 2) 自訂 PandasData：把 night_low / night_high / night_close / day_open
#    四個欄位變成 Backtrader 策略裡可以直接讀取的 line。
# =================================================================
class TaifexDayData(bt.feeds.PandasData):
    lines = ("night_low", "night_high", "night_close", "day_open")
    params = (
        ("night_low", -1),   # -1 = 依欄位名稱自動對應 DataFrame 的同名欄位
        ("night_high", -1),
        ("night_close", -1),
        ("day_open", -1),
    )


# =================================================================
# 共用：績效統計輸出（策略一、策略二各自獨立呼叫一次）
# =================================================================
def print_kpi_report(strategy_name: str, strat, start_cash: float):
    """從 Backtrader 的 TradeAnalyzer / DrawDown 分析器整理出題目要求的 KPI，並印出。"""
    ta = strat.analyzers.trades.get_analysis()
    dd = strat.analyzers.drawdown.get_analysis()

    total_trades = ta.get("total", {}).get("closed", 0)
    won = ta.get("won", {}).get("total", 0)
    lost = ta.get("lost", {}).get("total", 0)
    win_rate = (won / total_trades * 100) if total_trades else 0.0

    gross_win = ta.get("won", {}).get("pnl", {}).get("total", 0.0) or 0.0
    gross_loss = ta.get("lost", {}).get("pnl", {}).get("total", 0.0) or 0.0
    net_profit = gross_win + gross_loss  # gross_loss 本身是負值
    profit_factor = (gross_win / abs(gross_loss)) if gross_loss != 0 else float("inf")

    max_single_loss = ta.get("lost", {}).get("pnl", {}).get("max", 0.0) or 0.0
    max_dd_pct = dd.get("max", {}).get("drawdown", 0.0) or 0.0
    max_dd_money = dd.get("max", {}).get("moneydown", 0.0) or 0.0

    print("=" * 60)
    print(f"策略績效報告：{strategy_name}")
    print("=" * 60)
    print(f"總交易次數     ：{total_trades}")
    print(f"勝率           ：{win_rate:.2f}%（{won} 勝 / {lost} 敗）")
    print(f"總盈虧（點數） ：{net_profit:,.1f}")
    print(f"獲利因子       ：{profit_factor:.2f}（目標 > 1.5）")
    print(f"最大權益回檔   ：{max_dd_pct:.2f}%（相當於 {max_dd_money:,.1f} 點）")
    print(f"最大單筆虧損   ：{max_single_loss:,.1f}")
    print(f"期末權益       ：{start_cash + net_profit:,.1f}（起始 {start_cash:,.1f}）")
    print("=" * 60 + "\n")


# =================================================================
# 3-A) 策略一：開高防守多單（逆勢低接 / 支撐策略）
# =================================================================
class Strategy1_SupportLong(bt.Strategy):
    """
    統計基礎：日盤跳空開高時，跌破夜盤低點機率僅 17.67%；
              未破底時日盤低點平均高於夜盤低點 229 點 → 夜盤低點是強力支撐。

    進場（需同時符合）：
      1. Day_Open > Night_Close（跳空開高）
      2. 08:50–12:30 之間，收盤拉回落入 [Night_Low, Night_Low+buffer] 且收紅K
      → 下一根開盤做多（Backtrader 市價單預設就是「這根訊號確認、下一根開盤成交」）

    出場：
      - 停損：Night_Low - sl_offset（跌破夜盤低點就是假設失敗，統計顯示破底後
        平均再跌 224 點，必須立刻停損)
      - 停利：觸及 Night_High 或獲利達 tp_fixed_pts → 先平一半，剩餘移動停利
      - 時間出場：13:40 這根 K 收盤前仍未出場 → 無條件平倉，不留倉過夜
    """

    params = dict(
        buffer_pts=30,      # 支撐緩衝區：Night_Low + X 點（可測 20~50 做敏感度分析）
        sl_offset=10,       # 停損：Night_Low - X 點
        tp_fixed_pts=150,   # 固定停利點數（達到先平一半）
        trail_pts=60,       # 平一半後，剩餘部位的移動停利回吐點數
        entry_start=dtime(8, 50),
        entry_end=dtime(12, 30),
        time_exit=dtime(13, 40),
        size=2,             # 預設 2 口才能做「先平一半」；改成 1 口時自動跳過半平倉步驟
    )

    def __init__(self):
        self.entry_order = None
        self.entry_price = None
        self.stop_price = None
        self.half_closed = False
        self.trail_active = False
        self.trail_peak = None

    def log(self, txt):
        d = self.data.datetime.datetime(0)
        print(f"[策略一][{d}] {txt}")

    def notify_order(self, order):
        if order.status != order.Completed:
            return
        # 用 order.ref（訂單編號）比對，不要用 is 比對物件身分——backtrader 部分版本
        # 傳進 notify_order 的 order 物件跟送出當下拿到的參照不是同一個實例
        if self.entry_order is not None and order.ref == self.entry_order.ref:
            # 進場單成交：記下實際成交價，並依「當天」的 Night_Low 設好停損
            self.entry_price = order.executed.price
            self.stop_price = self.data.night_low[0] - self.p.sl_offset
            self.half_closed = False
            self.trail_active = False
            self.trail_peak = None
            self.log(f"進場成交 @ {self.entry_price:.1f}，停損設於 {self.stop_price:.1f}")
            self.entry_order = None

    def next(self):
        t = self.data.datetime.datetime(0).time()
        pos = self.position.size

        # ---------- 空手：尋找進場訊號 ----------
        if pos == 0:
            if self.entry_order is not None:
                return  # 進場單已送出、等待下一根開盤成交中

            day_open = self.data.day_open[0]
            night_close = self.data.night_close[0]
            night_low = self.data.night_low[0]

            # 濾網 1：今天必須是「跳空開高」格局，才啟用這個逆勢低接策略
            if not (day_open > night_close):
                return
            # 濾網 2：只在 08:50-12:30 這段時間找訊號（避免尾盤才進場、來不及來回）
            if not (self.p.entry_start <= t <= self.p.entry_end):
                return

            support_zone_hi = night_low + self.p.buffer_pts
            in_support_zone = night_low <= self.data.close[0] <= support_zone_hi
            is_red_candle = self.data.close[0] > self.data.open[0]

            if in_support_zone and is_red_candle:
                self.entry_order = self.buy(size=self.p.size)
                self.log(
                    f"觸價訊號成立（收盤 {self.data.close[0]:.1f} 落在支撐區間 "
                    f"[{night_low:.1f}, {support_zone_hi:.1f}] 且收紅K），下一根開盤進場"
                )
            return

        # ---------- 持有多單：出場管理 ----------
        night_high = self.data.night_high[0]

        # 1) 停損：最優先
        if self.data.low[0] <= self.stop_price:
            self.close()
            self.log(f"觸及停損 {self.stop_price:.1f}，出場")
            return

        # 2) 時間出場：13:40 無條件平倉，不留倉過夜
        if t >= self.p.time_exit:
            self.close()
            self.log("13:40 時間出場（不留倉過夜）")
            return

        cur_profit_pts = self.data.close[0] - self.entry_price

        # 3) 停利第一階段：觸及 Night_High 或固定獲利點數 → 先平一半，剩餘轉移動停利
        if not self.half_closed:
            hit_target = (self.data.high[0] >= night_high) or (cur_profit_pts >= self.p.tp_fixed_pts)
            if hit_target:
                half = self.position.size // 2
                if half >= 1:
                    # 口數足夠：先平一半，剩餘部位進入移動停利
                    self.sell(size=half)
                    self.log(f"觸價停利，先平一半（{half} 口）@ {self.data.close[0]:.1f}")
                else:
                    # 只有 1 口：無法「平一半」，改成整口直接切換成移動停利模式
                    self.log("僅 1 口無法半平倉，整口切換為移動停利模式")
                self.half_closed = True
                self.trail_active = True
                self.trail_peak = self.data.close[0]
            return

        # 4) 剩餘部位：移動停利（回吐 trail_pts 點出場，讓利潤繼續奔跑）
        if self.trail_active:
            if self.data.close[0] > self.trail_peak:
                self.trail_peak = self.data.close[0]
            if self.trail_peak - self.data.close[0] >= self.p.trail_pts:
                self.close()
                self.log(f"移動停利觸發（自高點 {self.trail_peak:.1f} 回落 {self.p.trail_pts} 點），出場")


# =================================================================
# 3-B) 策略二：破底順勢空單（動能突破 / 順勢策略）
# =================================================================
class Strategy2_BreakdownShort(bt.Strategy):
    """
    統計基礎：日盤跌破夜盤低點總機率僅 35.76%，但「開低/開平」情境下機率拉高到
              56.42%；一旦真的跌破，平均續跌深度高達 224 點 → 適合順勢追空。

    進場（需同時符合）：
      1. Day_Open <= Night_Close（開低或開平）
      2. 08:45–12:30 之間，收盤實體跌破 Night_Low - breakout_offset（過濾假突破）
      → 下一根開盤做空

    出場：
      - 停損：進場價 + sl_pts（預設固定點數版本；「當日最近一次反彈高點」的動態
        停損寫法請見檔頭註解，未在此實作）
      - 停利：跌破 Night_Low - tp_target_offset（歷史續跌 224 點的一半）後，
        啟動移動停利（回吐 trail_pts 點出場），目標是盡量吃到續跌的肥尾
      - 時間出場：13:40 無條件平倉所有空單
    """

    params = dict(
        breakout_offset=5,     # 跌破 Night_Low - X 點才追空（過濾假突破，可測試搭配量能濾網）
        sl_pts=40,             # 停損：進場價 + X 點
        tp_target_offset=110,  # 停利目標：Night_Low - X 點（觸及後啟動移動停利）
        trail_pts=30,          # 移動停利回吐點數
        entry_start=dtime(8, 45),
        entry_end=dtime(12, 30),
        time_exit=dtime(13, 40),
        size=1,
    )

    def __init__(self):
        self.entry_order = None
        self.entry_price = None
        self.stop_price = None
        self.target_price = None
        self.trail_active = False
        self.trail_trough = None

    def log(self, txt):
        d = self.data.datetime.datetime(0)
        print(f"[策略二][{d}] {txt}")

    def notify_order(self, order):
        if order.status != order.Completed:
            return
        # 用 order.ref 比對，避免物件身分比對在部分 backtrader 版本下失效
        if self.entry_order is not None and order.ref == self.entry_order.ref:
            self.entry_price = order.executed.price
            self.stop_price = self.entry_price + self.p.sl_pts
            self.target_price = self.data.night_low[0] - self.p.tp_target_offset
            self.trail_active = False
            self.trail_trough = None
            self.log(
                f"進場成交 @ {self.entry_price:.1f}，停損 {self.stop_price:.1f}，"
                f"停利目標 {self.target_price:.1f}"
            )
            self.entry_order = None

    def next(self):
        t = self.data.datetime.datetime(0).time()
        pos = self.position.size

        # ---------- 空手：尋找進場訊號 ----------
        if pos == 0:
            if self.entry_order is not None:
                return

            day_open = self.data.day_open[0]
            night_close = self.data.night_close[0]
            night_low = self.data.night_low[0]

            # 濾網 1：今天必須是「開低或開平」格局，破底機率統計上較高
            if not (day_open <= night_close):
                return
            # 濾網 2：只在 08:45-12:30 之間找訊號
            if not (self.p.entry_start <= t <= self.p.entry_end):
                return

            breakdown_level = night_low - self.p.breakout_offset
            # 用「收盤價」跌破（實體跌破），而不是影線碰到，藉此過濾破底翻的假突破
            if self.data.close[0] < breakdown_level:
                self.entry_order = self.sell(size=self.p.size)
                self.log(
                    f"實體跌破 Night_Low-{self.p.breakout_offset}（{breakdown_level:.1f}），"
                    f"下一根開盤追空"
                )
            return

        # ---------- 持有空單：出場管理 ----------
        # 1) 停損：最優先（固定點數版；動態版可改成 rolling max of self.data.high）
        if self.data.high[0] >= self.stop_price:
            self.close()
            self.log(f"觸及停損 {self.stop_price:.1f}，出場")
            return

        # 2) 時間出場：13:40 無條件平倉
        if t >= self.p.time_exit:
            self.close()
            self.log("13:40 時間出場（不留倉過夜）")
            return

        # 3) 觸及停利目標 → 啟動移動停利，抓大放小、盡量吃到續跌的肥尾
        if not self.trail_active:
            if self.data.low[0] <= self.target_price:
                self.trail_active = True
                self.trail_trough = self.data.close[0]
                self.log(f"觸及停利目標 {self.target_price:.1f}，啟動移動停利")
            return

        # 4) 移動停利追蹤（價格續創新低就跟著往下移，反彈 trail_pts 點就出場）
        if self.data.close[0] < self.trail_trough:
            self.trail_trough = self.data.close[0]
        if self.data.close[0] - self.trail_trough >= self.p.trail_pts:
            self.close()
            self.log(f"移動停利觸發（自低點 {self.trail_trough:.1f} 反彈 {self.p.trail_pts} 點），出場")


# =================================================================
# 執行單一策略的回測，並印出 KPI 報告
# =================================================================
def run_backtest(df: pd.DataFrame, strategy_cls, strategy_name: str,
                  start_cash: float = 1_000_000.0, point_value: float = 200.0,
                  commission_per_trade: float = 0.0):
    """
    point_value：每點台幣（大台 200 元/點，小台 50 元/點，微台 10 元/點）。
    這裡用 Backtrader 的 stocklike=False 期貨模式，讓損益直接以「點數 × point_value」計算。
    """
    cerebro = bt.Cerebro()
    data = TaifexDayData(dataname=df)
    cerebro.adddata(data)
    cerebro.addstrategy(strategy_cls)

    cerebro.broker.setcash(start_cash)
    # 期貨式合約：每點價值 point_value 元，commission 這裡示範用固定每口成本
    cerebro.broker.setcommission(commission=commission_per_trade, margin=point_value, mult=point_value)

    cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name="trades")
    cerebro.addanalyzer(bt.analyzers.DrawDown, _name="drawdown")

    results = cerebro.run()
    strat = results[0]
    print_kpi_report(strategy_name, strat, start_cash)
    return strat


# =================================================================
# 假資料產生器（僅供沒有真實歷史資料時，先跑通流程用；不代表真實市場）
# =================================================================
def generate_sample_data(n_days: int = 30, seed: int = 42) -> pd.DataFrame:
    """產生示範用的假 5 分 K 資料（日盤 + 夜盤），純粹讓程式在沒有真實資料時也能跑通。"""
    rng = np.random.default_rng(seed)
    rows = []
    price = 21000.0
    start_date = pd.Timestamp("2026-01-05")

    for day_i in range(n_days):
        cur_date = start_date + pd.Timedelta(days=day_i)
        if cur_date.weekday() >= 5:  # 跳過週末
            continue

        # 前一晚夜盤：15:00 ~ 23:59（用前一個日曆天）
        prev_date = cur_date - pd.Timedelta(days=1)
        evening_times = pd.date_range(
            prev_date.replace(hour=15, minute=0), prev_date.replace(hour=23, minute=55), freq="5min"
        )
        # 當天凌晨夜盤延伸：00:00 ~ 05:00
        morning_times = pd.date_range(
            cur_date.replace(hour=0, minute=0), cur_date.replace(hour=5, minute=0), freq="5min"
        )
        # 當天日盤：08:45 ~ 13:45
        day_times = pd.date_range(
            cur_date.replace(hour=8, minute=45), cur_date.replace(hour=13, minute=45), freq="5min"
        )

        for ts in list(evening_times) + list(morning_times) + list(day_times):
            drift = rng.normal(0, 8)
            o = price
            c = price + drift
            h = max(o, c) + abs(rng.normal(0, 4))
            l = min(o, c) - abs(rng.normal(0, 4))
            v = int(abs(rng.normal(300, 100)))
            rows.append((ts, o, h, l, c, v))
            price = c

    out = pd.DataFrame(rows, columns=["datetime", "open", "high", "low", "close", "volume"])
    out = out.set_index("datetime").sort_index()
    return out


# =================================================================
# 主程式
# =================================================================
if __name__ == "__main__":
    CSV_PATH = "taifex_5min.csv"  # ← 換成你自己的 5 分 K CSV 路徑

    if os.path.exists(CSV_PATH):
        raw = pd.read_csv(CSV_PATH, parse_dates=["datetime"]).set_index("datetime").sort_index()
        print(f"已讀入真實資料：{CSV_PATH}（共 {len(raw)} 筆 5 分 K）")
    else:
        print(f"找不到 {CSV_PATH}，改用假資料先跑通流程（僅供驗證程式邏輯，非真實市場）")
        raw = generate_sample_data()

    dataset = build_taifex_dataset(raw)
    print(f"日盤 K 棒（已掛上 Night_Low/High/Close、Day_Open）：{len(dataset)} 筆\n")

    # 分別跑策略一、策略二，各自獨立輸出績效，方便比較哪個情境期望值較高
    run_backtest(dataset, Strategy1_SupportLong, "策略一：開高防守多單（逆勢低接）")
    run_backtest(dataset, Strategy2_BreakdownShort, "策略二：破底順勢空單（動能突破）")
