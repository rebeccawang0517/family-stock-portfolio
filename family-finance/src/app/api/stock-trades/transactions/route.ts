import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/stock-trades/transactions
 *
 * Query params（皆可選）：
 *   year       西元年（例 2026）
 *   month      1~12
 *   user_email 指定持有人；不傳 = 全部
 *   broker     券商代號（例 taishin）
 *   ticker     股票代號
 *   market     市場別
 *
 * 不傳 year/month 時：回傳「最新一個月」的資料。
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  let year = sp.get('year') ? Number(sp.get('year')) : null
  let month = sp.get('month') ? Number(sp.get('month')) : null
  const userEmail = sp.get('user_email')
  const broker = sp.get('broker')
  const ticker = sp.get('ticker')
  const market = sp.get('market')

  if (!year || !month) {
    const { data: latest, error: e1 } = await supabaseAdmin
      .from('stock_trades')
      .select('trade_year, trade_month')
      .order('trade_year', { ascending: false })
      .order('trade_month', { ascending: false })
      .limit(1)

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    if (!latest || latest.length === 0) {
      return NextResponse.json({ year: null, month: null, transactions: [] })
    }
    year = latest[0].trade_year
    month = latest[0].trade_month
  }

  let q = supabaseAdmin
    .from('stock_trades')
    .select('*')
    .eq('trade_year', year)
    .eq('trade_month', month)

  if (userEmail) q = q.eq('user_email', userEmail)
  if (broker) q = q.eq('broker', broker)
  if (ticker) q = q.eq('ticker', ticker)
  if (market) q = q.eq('market', market)

  const { data, error } = await q.order('trade_date', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ year, month, transactions: data })
}
