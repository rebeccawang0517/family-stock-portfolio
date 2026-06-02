import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/stock-trades/months
 * 回傳所有有交易資料的「年/月」（依 trade_date），由新到舊。
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('stock_trades')
    .select('trade_year, trade_month')
    .order('trade_year', { ascending: false })
    .order('trade_month', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const seen = new Set<string>()
  const months: { year: number; month: number }[] = []
  for (const row of data ?? []) {
    const key = `${row.trade_year}-${row.trade_month}`
    if (!seen.has(key)) {
      seen.add(key)
      months.push({ year: row.trade_year, month: row.trade_month })
    }
  }

  return NextResponse.json({ months })
}
