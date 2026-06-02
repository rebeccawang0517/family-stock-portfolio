import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface IncomingTrade {
  trade_date: string
  ticker: string
  name?: string | null
  side: 'B' | 'S'
  trade_currency: string
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
  market?: string | null
}

interface UploadPayload {
  user_email: string                 // createdBy
  holder: string                     // 持有人顯示名稱（Rebecca / Eric）
  platform?: string                  // 持有平台，預設「台新證券」
  source_file?: string | null
  gmail_message_id?: string | null
  trades: IncomingTrade[]
}

const MARKET_TO_REGION: Record<string, string> = {
  '美國市場': '美股',
  '台灣市場': '台股',
  '香港市場': '港股',
}

function regionFromMarket(market: string | null | undefined): string {
  if (!market) return '美股'
  return MARKET_TO_REGION[market] ?? market
}

function feesTotal(t: IncomingTrade): number {
  return (
    Number(t.commission_fee ?? 0) +
    Number(t.trade_fee ?? 0) +
    Number(t.settle_fee ?? 0) +
    Number(t.frc_ptp_fee ?? 0)
  )
}

function taxTotal(t: IncomingTrade): number {
  return Number(t.stamp_tax ?? 0) + Number(t.exchange_levy ?? 0)
}

/**
 * 對應到既有 root site 的 Firestore `transactions` schema：
 *   { date, type, symbol, companyName, shares, price, fee, tax, amount,
 *     holder, platform, region, createdBy, createdAt, ... }
 */
function mapToFirestoreDoc(payload: UploadPayload, t: IncomingTrade) {
  const fee = feesTotal(t)
  const tax = taxTotal(t)
  const gross = Number(t.gross_amount)
  // 對齊既有 stocks.js 慣例：買入 amount 含手續費；賣出 amount 扣手續費+稅
  const amount = t.side === 'B' ? gross + fee : gross - fee - tax
  return {
    date: new Date(t.trade_date + 'T12:00:00').toISOString(),
    type: t.side === 'B' ? '買入' : '賣出',
    symbol: t.ticker,
    companyName: t.name ?? t.ticker,
    shares: Number(t.shares),
    price: Number(t.unit_price),
    fee,
    tax,
    amount,
    holder: payload.holder,
    platform: payload.platform ?? '台新證券',
    region: regionFromMarket(t.market),
    createdBy: payload.user_email,
    createdAt: new Date().toISOString(),
    isEmailImport: true,
    sourceEmail: payload.gmail_message_id ?? null,
    sourcePdf: payload.source_file ?? null,
  }
}

/**
 * 確定性 doc id：同一封信、同一筆交易就算重跑也只會寫一次。
 */
function deterministicId(payload: UploadPayload, t: IncomingTrade): string {
  const parts = [
    'taishin',
    payload.gmail_message_id ?? payload.source_file ?? 'unknown',
    t.ticker,
    t.side,
    t.trade_date,
    String(t.shares),
    String(t.unit_price),
  ]
  return parts.join('__').replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 256)
}

function unauthorized(msg = 'Unauthorized') {
  return NextResponse.json({ error: msg }, { status: 401 })
}
function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

type HoldingKey = { symbol: string; holder: string; platform: string; region: string }

function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * 重算單一持股：依時序重播 transactions、更新 stocks doc、補填賣出的 realizedProfit。
 * 對齊 [stocks.js → rebuildHoldingFromTransactions] 與 [ingestion/rebuild_stocks.py] 行為。
 */
async function rebuildHolding(key: HoldingKey): Promise<{
  shares: number; cost: number; realizedFilled: number; action: 'upsert' | 'delete' | 'noop'
}> {
  const EPS = 1e-4
  const txSnap = await adminDb.collection('transactions')
    .where('symbol', '==', key.symbol)
    .where('holder', '==', key.holder)
    .where('platform', '==', key.platform)
    .where('region', '==', key.region)
    .get()
  type TxDoc = Record<string, unknown> & { id: string }
  const txs: TxDoc[] = txSnap.docs.map(d => {
    const data = d.data() as Record<string, unknown>
    return { ...data, id: d.id }
  })
  txs.sort((a, b) => new Date(String(a.date ?? 0)).getTime() - new Date(String(b.date ?? 0)).getTime())

  let shares = 0
  let cost = 0
  let realizedFilled = 0
  let last: Record<string, unknown> = txs[txs.length - 1] ?? {}

  for (const t of txs) {
    const s = toNum(t.shares)
    const amt = toNum(t.amount)
    if (t.type === '買入') {
      shares += s
      cost += amt
    } else if (t.type === '賣出') {
      const avg = shares > 0 ? cost / shares : 0
      const realized = amt - s * avg
      if (t.realizedProfit === undefined || t.realizedProfit === null) {
        await adminDb.collection('transactions').doc(t.id).update({
          realizedProfit: realized,
          realizedProfitSource: 'firestore-upload',
        })
        realizedFilled++
      }
      cost -= s * avg
      shares -= s
    }
    last = t
  }

  const stocksCol = adminDb.collection('stocks')
  const existing = await stocksCol
    .where('symbol', '==', key.symbol)
    .where('holder', '==', key.holder)
    .where('platform', '==', key.platform)
    .where('region', '==', key.region)
    .limit(1)
    .get()
  const existingDoc = existing.docs[0]

  if (shares > EPS) {
    const nowIso = new Date().toISOString()
    if (existingDoc) {
      await existingDoc.ref.update({
        shares,
        investmentCost: Math.max(0, cost),
        companyName: (last.companyName as string) || key.symbol,
        lastModified: nowIso,
        modifiedBy: 'firestore-upload',
        rebuiltFromTransactions: true,
      })
    } else {
      await stocksCol.add({
        region: key.region,
        symbol: key.symbol,
        companyName: (last.companyName as string) || key.symbol,
        shares,
        investmentCost: Math.max(0, cost),
        currentPrice: toNum(last.price),
        changePercent: 0,
        holder: key.holder,
        platform: key.platform,
        createdAt: nowIso,
        createdBy: (last.createdBy as string) || 'firestore-upload',
        lastModified: nowIso,
        modifiedBy: 'firestore-upload',
        rebuiltFromTransactions: true,
      })
    }
    return { shares, cost: Math.max(0, cost), realizedFilled, action: 'upsert' }
  }

  if (existingDoc) {
    await existingDoc.ref.delete()
    return { shares: 0, cost: 0, realizedFilled, action: 'delete' }
  }
  return { shares: 0, cost: 0, realizedFilled, action: 'noop' }
}

export async function POST(req: NextRequest) {
  // Bearer token 驗證（沿用同一個 secret）
  const auth = req.headers.get('authorization') ?? ''
  const expected = process.env.STOCK_TRADES_UPLOAD_SECRET
  if (!expected) return NextResponse.json({ error: 'Server misconfigured: STOCK_TRADES_UPLOAD_SECRET 未設定' }, { status: 500 })
  if (auth !== `Bearer ${expected}`) return unauthorized()

  let payload: UploadPayload
  try {
    payload = (await req.json()) as UploadPayload
  } catch {
    return badRequest('Invalid JSON')
  }

  if (!payload.user_email) return badRequest('user_email 缺漏')
  if (!payload.holder) return badRequest('holder 缺漏（Rebecca / Eric）')
  if (!Array.isArray(payload.trades)) return badRequest('trades 須為陣列')
  if (payload.trades.length === 0) {
    return NextResponse.json({ inserted: 0, message: 'No trades to upload' })
  }

  const col = adminDb.collection('transactions')
  let inserted = 0
  let skipped = 0
  const errors: Array<{ ticker: string; err: string }> = []
  const affected = new Map<string, HoldingKey>()

  for (const t of payload.trades) {
    const id = deterministicId(payload, t)
    const ref = col.doc(id)
    try {
      const snap = await ref.get()
      if (snap.exists) {
        skipped++
        continue
      }
      await ref.set(mapToFirestoreDoc(payload, t))
      inserted++
      const key: HoldingKey = {
        symbol: t.ticker,
        holder: payload.holder,
        platform: payload.platform ?? '台新證券',
        region: regionFromMarket(t.market),
      }
      affected.set(`${key.symbol}|${key.holder}|${key.platform}|${key.region}`, key)
    } catch (e) {
      errors.push({ ticker: t.ticker, err: (e as Error).message })
    }
  }

  // 重算受影響的持股 + 補實現損益。只有真的有插入新交易時才跑。
  const rebuilds: Array<{ key: HoldingKey; action: string; shares: number; realizedFilled: number }> = []
  for (const key of affected.values()) {
    try {
      const r = await rebuildHolding(key)
      rebuilds.push({ key, action: r.action, shares: r.shares, realizedFilled: r.realizedFilled })
    } catch (e) {
      errors.push({ ticker: key.symbol, err: `rebuild failed: ${(e as Error).message}` })
    }
  }

  return NextResponse.json({
    received: payload.trades.length,
    inserted,
    skipped_duplicates: skipped,
    errors,
    holder: payload.holder,
    platform: payload.platform ?? '台新證券',
    rebuilds,
  })
}
