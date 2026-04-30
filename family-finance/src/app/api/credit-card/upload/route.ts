import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
// 不快取
export const dynamic = 'force-dynamic'

interface IncomingTxn {
  bank: string
  txn_date: string
  merchant: string
  amount: number
  category: string
}

interface UploadPayload {
  user_email: string
  statement_year: number
  statement_month: number
  transactions: IncomingTxn[]
}

function unauthorized(msg = 'Unauthorized') {
  return NextResponse.json({ error: msg }, { status: 401 })
}

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

export async function POST(req: NextRequest) {
  // 驗證共享密鑰（Bearer token）
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.CREDITCARD_UPLOAD_SECRET
  if (!expected) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  if (auth !== `Bearer ${expected}`) return unauthorized()

  // 解析 payload
  let payload: UploadPayload
  try {
    payload = (await req.json()) as UploadPayload
  } catch {
    return badRequest('Invalid JSON')
  }

  const { user_email, statement_year, statement_month, transactions } = payload
  if (!user_email || !statement_year || !statement_month || !Array.isArray(transactions)) {
    return badRequest('Missing required fields')
  }
  if (statement_month < 1 || statement_month > 12) return badRequest('Invalid month')

  // 組成 DB rows
  const rows = transactions.map((t) => ({
    user_email,
    bank: t.bank,
    txn_date: t.txn_date,
    merchant: t.merchant,
    amount: t.amount,
    category: t.category,
    statement_year,
    statement_month,
  }))

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0, message: 'No transactions to upload' })
  }

  // upsert：以 UNIQUE (user_email, bank, statement_year, statement_month, txn_date, merchant, amount) 為衝突鍵
  // 重複會被忽略，不重複才 insert
  const { data, error } = await supabaseAdmin
    .from('credit_card_transactions')
    .upsert(rows, {
      onConflict: 'user_email,bank,statement_year,statement_month,txn_date,merchant,amount',
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
    period: `${statement_year}-${String(statement_month).padStart(2, '0')}`,
  })
}
