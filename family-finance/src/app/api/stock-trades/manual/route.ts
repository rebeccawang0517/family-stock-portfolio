import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ManualTrade {
  user_email: string
  broker: string
  trade_date: string           // YYYY-MM-DD
  market?: string | null
  ticker: string
  name?: string | null
  side: 'B' | 'S'
  trade_currency: string
  shares: number
  unit_price: number
  gross_amount: number
  commission_fee?: number
  stamp_tax?: number
  net_amount: number
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

export async function POST(req: NextRequest) {
  let t: ManualTrade
  try {
    t = (await req.json()) as ManualTrade
  } catch {
    return badRequest('Invalid JSON')
  }

  if (!t.user_email) return badRequest('user_email 缺漏')
  if (!t.broker) return badRequest('broker 缺漏')
  if (!t.trade_date || !ISO_DATE.test(t.trade_date)) return badRequest('trade_date 格式須 YYYY-MM-DD')
  if (!t.ticker) return badRequest('ticker 缺漏')
  if (t.side !== 'B' && t.side !== 'S') return badRequest("side 須為 'B' 或 'S'")
  if (!t.trade_currency) return badRequest('trade_currency 缺漏')
  for (const k of ['shares', 'unit_price', 'gross_amount', 'net_amount'] as const) {
    if (typeof t[k] !== 'number' || !Number.isFinite(t[k])) return badRequest(`${k} 須為數字`)
  }

  const row = {
    user_email: t.user_email,
    broker: t.broker,
    account_no: null,
    trade_date: t.trade_date,
    settle_date: null,
    payment_date: null,
    market: t.market ?? null,
    ticker: t.ticker,
    name: t.name ?? null,
    side: t.side,
    trade_currency: t.trade_currency,
    settle_currency: null,
    shares: t.shares,
    unit_price: t.unit_price,
    gross_amount: t.gross_amount,
    commission_fee: t.commission_fee ?? 0,
    trade_fee: 0,
    settle_fee: 0,
    stamp_tax: t.stamp_tax ?? 0,
    exchange_levy: 0,
    frc_ptp_fee: 0,
    net_amount: t.net_amount,
    source_file: null,
    gmail_message_id: null,
  }

  const { data, error } = await supabaseAdmin
    .from('stock_trades')
    .upsert([row], {
      onConflict: 'user_email,broker,account_no,trade_date,ticker,side,shares,unit_price',
      ignoreDuplicates: true,
    })
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const inserted = data?.length ?? 0
  return NextResponse.json({
    inserted,
    duplicate: inserted === 0,
    message: inserted === 0 ? '這筆交易已存在（同人/券商/日期/標的/方向/股數/價格）' : '已寫入 1 筆',
  })
}
