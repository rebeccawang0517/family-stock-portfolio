-- 股票海外交易明細
-- 來源：台新證券受託買賣外國有價證券確認書 PDF
-- 用法：在 Supabase SQL Editor 執行

create table if not exists public.stock_trades (
  id              uuid primary key default gen_random_uuid(),

  -- 歸屬
  user_email      text not null,
  broker          text not null default 'taishin',  -- 之後接其他券商可擴
  account_no      text,                              -- 例：9B17-1111879

  -- 日期
  trade_date      date not null,                    -- 交易日期
  settle_date     date,                              -- 交割日期
  payment_date    date,                              -- 扣款日 / 出金日

  -- 標的
  market          text,                              -- 美國市場 / ...
  ticker          text not null,                    -- NBIS / SNDK
  name            text,                              -- Nebius Group NV / Sandisk
  side            text not null check (side in ('B','S')),

  -- 幣別
  trade_currency  text not null,                    -- 交易幣別 USD
  settle_currency text,                              -- 結匯幣別

  -- 金額（用 numeric 避免浮點誤差）
  shares          numeric not null,                  -- 成交股數
  unit_price      numeric not null,                  -- 成交價格
  gross_amount    numeric not null,                  -- 成交金額
  commission_fee  numeric not null default 0,        -- 手續費
  trade_fee       numeric not null default 0,        -- 交易費
  settle_fee      numeric not null default 0,        -- 結算費
  stamp_tax       numeric not null default 0,        -- 印花稅
  exchange_levy   numeric not null default 0,        -- 交易徵費
  frc_ptp_fee     numeric not null default 0,        -- FRC/PTP 費
  net_amount      numeric not null,                  -- 應收(付)金額；買=負，賣=正

  -- 派生欄位（給列表頁/月份篩選用）
  trade_year      int generated always as (extract(year  from trade_date)) stored,
  trade_month     int generated always as (extract(month from trade_date)) stored,

  -- 來源追溯
  source_file     text,                              -- PDF 檔名
  gmail_message_id text,                              -- Gmail message id；之後做幂等

  created_at      timestamptz not null default now(),

  -- 防重：同人、同券商、同帳號、同日、同股、同方向、同股數、同價 → 視為同一筆
  constraint stock_trades_unique unique (
    user_email, broker, account_no, trade_date, ticker, side, shares, unit_price
  )
);

create index if not exists stock_trades_user_period_idx
  on public.stock_trades (user_email, trade_year desc, trade_month desc);

create index if not exists stock_trades_ticker_idx
  on public.stock_trades (ticker);
