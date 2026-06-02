import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface IncomingTrade {
  trade_date: string           // YYYY-MM-DD
  settle_date?: string | null
  payment_date?: string | null
  market?: string | null
  ticker: string
  name?: string | null
  side: 'B' | 'S'
  trade_currency: string
  settle_currency?: string | null
  shares: number
  unit_price: number
  gross_amount: number
  commission_fee?: number
  trade_fee?: number
  settle_fee?: number
  stamp_tax?: number
  exchange_levy?: number
  frc_ptp_fee?: number
  net_amount: number
}

interface UploadPayload {
  user_email: string
  broker?: string                // 預設 taishin
  account_no?: string | null
  source_file?: string | null
  gmail_message_id?: string | null
  trades: IncomingTrade[]
}

function unauthorized(msg = 'Unauthorized') {
  return NextResponse.json({ error: msg }, { status: 401 })
}

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function validateTrade(t: IncomingTrade, i: number): string | null {
  if (!t.trade_date || !ISO_DATE.test(t.trade_date)) return `trades[${i}].trade_date 格式須 YYYY-MM-DD`
  if (!t.ticker) return `trades[${i}].ticker 缺漏`
  if (t.side !== 'B' && t.side !== 'S') return `trades[${i}].side 須為 'B' 或 'S'`
  if (!t.trade_currency) return `trades[${i}].trade_currency 缺漏`
  if (typeof t.shares !== 'number' || !Number.isFinite(t.shares)) return `trades[${i}].shares 須為數字`
  if (typeof t.unit_price !== 'number' || !Number.isFinite(t.unit_price)) return `trades[${i}].unit_price 須為數字`
  if (typeof t.gross_amount !== 'number' || !Number.isFinite(t.gross_amount)) return `trades[${i}].gross_amount 須為數字`
  if (typeof t.net_amount !== 'number' || !Number.isFinite(t.net_amount)) return `trades[${i}].net_amount 須為數字`
  for (const k of ['settle_date', 'payment_date'] as const) {
    const v = t[k]
    if (v != null && v !== '' && !ISO_DATE.test(v)) return `trades[${i}].${k} 格式須 YYYY-MM-DD`
  }
  return null
}

export async function POST(req: NextRequest) {
  // Bearer token 驗證
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.STOCK_TRADES_UPLOAD_SECRET
  if (!expected) return NextResponse.json({ error: 'Server misconfigured: STOCK_TRADES_UPLOAD_SECRET 未設定' }, { status: 500 })
  if (auth !== `Bearer ${expected}`) return unauthorized()

  // 解析 payload
  let payload: UploadPayload
  try {
    payload = (await req.json()) as UploadPayload
  } catch {
    return badRequest('Invalid JSON')
  }

  const { user_email, broker = 'taishin', account_no = null, source_file = null, gmail_message_id = null, trades } = payload
  if (!user_email) return badRequest('user_email 缺漏')
  if (!Array.isArray(trades)) return badRequest('trades 須為陣列')
  if (trades.length === 0) return NextResponse.json({ inserted: 0, message: 'No trades to upload' })

  // 逐筆驗證
  for (let i = 0; i < trades.length; i++) {
    const err = validateTrade(trades[i], i)
    if (err) return badRequest(err)
  }

  // 組成 DB rows
  const rows = trades.map((t) => ({
    user_email,
    broker,
    account_no,
    trade_date: t.trade_date,
    settle_date: t.settle_date ?? null,
    payment_date: t.payment_date ?? null,
    market: t.market ?? null,
    ticker: t.ticker,
    name: t.name ?? null,
    side: t.side,
    trade_currency: t.trade_currency,
    settle_currency: t.settle_currency ?? null,
    shares: t.shares,
    unit_price: t.unit_price,
    gross_amount: t.gross_amount,
    commission_fee: t.commission_fee ?? 0,
    trade_fee: t.trade_fee ?? 0,
    settle_fee: t.settle_fee ?? 0,
    stamp_tax: t.stamp_tax ?? 0,
    exchange_levy: t.exchange_levy ?? 0,
    frc_ptp_fee: t.frc_ptp_fee ?? 0,
    net_amount: t.net_amount,
    source_file,
    gmail_message_id,
  }))

  // upsert：以 (user_email, broker, account_no, trade_date, ticker, side, shares, unit_price) 為衝突鍵
  // 重複會被忽略，不重複才 insert
  const { data, error } = await supabaseAdmin
    .from('stock_trades')
    .upsert(rows, {
      onConflict: 'user_email,broker,account_no,trade_date,ticker,side,shares,unit_price',
      ignoreDuplicates: true,
    })
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    received: rows.length,
    inserted: data?.length ?? 0,
    skipped_duplicates: rows.length - (data?.length ?? 0),
    user_email,
    broker,
  })
}
