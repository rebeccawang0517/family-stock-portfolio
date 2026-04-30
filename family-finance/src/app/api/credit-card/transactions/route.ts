import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/credit-card/transactions
 *
 * Query params（皆可選）：
 *   year       西元年（例 2026）
 *   month      1~12
 *   user_email 指定持卡人；不傳 = 全部
 *   bank       指定銀行
 *   category   指定分類
 *
 * 不傳 year/month 時：回傳「最新一個月」的資料。
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  let year = sp.get('year') ? Number(sp.get('year')) : null
  let month = sp.get('month') ? Number(sp.get('month')) : null
  const userEmail = sp.get('user_email')
  const bank = sp.get('bank')
  const category = sp.get('category')

  // 沒指定月份 → 抓最新一個月
  if (!year || !month) {
    const { data: latest, error: e1 } = await supabaseAdmin
      .from('credit_card_transactions')
      .select('statement_year, statement_month')
      .order('statement_year', { ascending: false })
      .order('statement_month', { ascending: false })
      .limit(1)

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
    if (!latest || latest.length === 0) {
      return NextResponse.json({ year: null, month: null, transactions: [] })
    }
    year = latest[0].statement_year
    month = latest[0].statement_month
  }

  let q = supabaseAdmin
    .from('credit_card_transactions')
    .select('*')
    .eq('statement_year', year)
    .eq('statement_month', month)

  if (userEmail) q = q.eq('user_email', userEmail)
  if (bank) q = q.eq('bank', bank)
  if (category) q = q.eq('category', category)

  const { data, error } = await q.order('txn_date', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ year, month, transactions: data })
}
