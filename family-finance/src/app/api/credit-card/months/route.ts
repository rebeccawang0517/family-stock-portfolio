import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/credit-card/months
 * 回傳所有有資料的「帳單期間」（年/月），由新到舊。
 * 用於前端月份選擇器。
 */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('credit_card_transactions')
    .select('statement_year, statement_month')
    .order('statement_year', { ascending: false })
    .order('statement_month', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 去重
  const seen = new Set<string>()
  const months: { year: number; month: number }[] = []
  for (const row of data ?? []) {
    const key = `${row.statement_year}-${row.statement_month}`
    if (!seen.has(key)) {
      seen.add(key)
      months.push({ year: row.statement_year, month: row.statement_month })
    }
  }

  return NextResponse.json({ months })
}
