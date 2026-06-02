'use client'

import { useEffect, useMemo, useState } from 'react'

interface Trade {
  id: string
  user_email: string
  broker: string
  account_no: string | null
  trade_date: string
  settle_date: string | null
  payment_date: string | null
  market: string | null
  ticker: string
  name: string | null
  side: 'B' | 'S'
  trade_currency: string
  settle_currency: string | null
  shares: number
  unit_price: number
  gross_amount: number
  commission_fee: number
  trade_fee: number
  settle_fee: number
  stamp_tax: number
  exchange_levy: number
  frc_ptp_fee: number
  net_amount: number
  source_file: string | null
}

interface MonthOption {
  year: number
  month: number
}

const fmtMoney = (n: number) =>
  Number(n).toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtShares = (n: number) =>
  Number(n).toLocaleString('zh-TW', { maximumFractionDigits: 4 })

export default function StockTradesPage() {
  const [months, setMonths] = useState<MonthOption[]>([])
  const [year, setYear] = useState<number | null>(null)
  const [month, setMonth] = useState<number | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filterUser, setFilterUser] = useState<string>('')
  const [filterMarket, setFilterMarket] = useState<string>('')
  const [filterTicker, setFilterTicker] = useState<string>('')
  const [filterSide, setFilterSide] = useState<string>('')

  // 載入月份
  useEffect(() => {
    fetch('/api/stock-trades/months')
      .then((r) => r.json())
      .then((d) => {
        setMonths(d.months ?? [])
        if (d.months?.[0]) {
          setYear(d.months[0].year)
          setMonth(d.months[0].month)
        } else {
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [])

  // 月份改變時載入交易
  useEffect(() => {
    if (year == null || month == null) return
    setLoading(true)
    fetch(`/api/stock-trades/transactions?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => setTrades(d.transactions ?? []))
      .finally(() => setLoading(false))
  }, [year, month])

  // 拆買/賣
  const buys = useMemo(() => trades.filter((t) => t.side === 'B'), [trades])
  const sells = useMemo(() => trades.filter((t) => t.side === 'S'), [trades])

  // 總和（依交易幣別分組）
  const buyTotalByCcy = useMemo(() => sumByCurrency(buys, 'gross_amount'), [buys])
  const sellTotalByCcy = useMemo(() => sumByCurrency(sells, 'gross_amount'), [sells])
  const netByCcy = useMemo(() => sumByCurrency(trades, 'net_amount'), [trades])
  const totalFees = useMemo(
    () =>
      sumByCurrency(
        trades.map((t) => ({
          trade_currency: t.trade_currency,
          gross_amount:
            Number(t.commission_fee) +
            Number(t.trade_fee) +
            Number(t.settle_fee) +
            Number(t.stamp_tax) +
            Number(t.exchange_levy) +
            Number(t.frc_ptp_fee),
        })),
        'gross_amount',
      ),
    [trades],
  )

  // 各標的部位變化（買加、賣減）
  const byTicker = useMemo(() => {
    const m = new Map<string, { ticker: string; name: string | null; shares: number; net: number }>()
    for (const t of trades) {
      const key = t.ticker
      const cur = m.get(key) ?? { ticker: t.ticker, name: t.name, shares: 0, net: 0 }
      cur.shares += (t.side === 'B' ? 1 : -1) * Number(t.shares)
      cur.net += Number(t.net_amount)
      m.set(key, cur)
    }
    return [...m.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
  }, [trades])

  // 篩選
  const filtered = useMemo(() => {
    return trades.filter((t) => {
      if (filterUser && t.user_email !== filterUser) return false
      if (filterMarket && t.market !== filterMarket) return false
      if (filterTicker && t.ticker !== filterTicker) return false
      if (filterSide && t.side !== filterSide) return false
      return true
    })
  }, [trades, filterUser, filterMarket, filterTicker, filterSide])

  const users = useMemo(() => [...new Set(trades.map((t) => t.user_email))].sort(), [trades])
  const markets = useMemo(
    () => [...new Set(trades.map((t) => t.market).filter((m): m is string => Boolean(m)))].sort(),
    [trades],
  )
  const tickers = useMemo(() => [...new Set(trades.map((t) => t.ticker))].sort(), [trades])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">股票交易明細</h1>

          {months.length > 0 && (
            <select
              value={year && month ? `${year}-${month}` : ''}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number)
                setYear(y)
                setMonth(m)
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            >
              {months.map(({ year: y, month: m }) => (
                <option key={`${y}-${m}`} value={`${y}-${m}`}>
                  {y} 年 {String(m).padStart(2, '0')} 月
                </option>
              ))}
            </select>
          )}
        </div>

        {loading && <p className="text-sm text-zinc-400">讀取中…</p>}

        {!loading && trades.length === 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
            <p>還沒有資料。在你電腦執行：</p>
            <code className="mt-2 inline-block rounded bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
              python ingestion/parse_taishin_pdf.py &lt;pdf&gt; --trades-only --out trades.json
              <br />
              python ingestion/upload_trades.py trades.json --user-email you@x --secret $SECRET
            </code>
          </div>
        )}

        {!loading && trades.length > 0 && (
          <>
            {/* 總覽卡 */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card label="買入總額" value={renderByCcy(buyTotalByCcy, fmtMoney)} hint={`共 ${buys.length} 筆`} accent="text-rose-300" />
              <Card label="賣出總額" value={renderByCcy(sellTotalByCcy, fmtMoney)} hint={`共 ${sells.length} 筆`} accent="text-emerald-300" />
              <Card label="淨流量" value={renderByCcy(netByCcy, fmtMoney)} hint="應收(+) / 應付(−)" accent="text-zinc-100" />
              <Card label="費用合計" value={renderByCcy(totalFees, fmtMoney)} hint="手續費+交易費+稅+...（單位同幣別）" accent="text-amber-300" />
            </div>

            {/* 各標的 */}
            <Section title="各標的部位變化">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
                    <tr className="border-b border-zinc-800">
                      <th className="py-2 pr-3">代號</th>
                      <th className="py-2 pr-3">名稱</th>
                      <th className="py-2 pr-3 text-right">本月淨股數</th>
                      <th className="py-2 pr-3 text-right">本月淨金額</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {byTicker.map((row) => (
                      <tr key={row.ticker} className="hover:bg-zinc-900">
                        <td className="py-2 pr-3 font-mono">{row.ticker}</td>
                        <td className="py-2 pr-3 text-zinc-400">{row.name ?? '—'}</td>
                        <td className={`py-2 pr-3 text-right font-mono ${row.shares > 0 ? 'text-rose-300' : row.shares < 0 ? 'text-emerald-300' : ''}`}>
                          {row.shares > 0 ? '+' : ''}{fmtShares(row.shares)}
                        </td>
                        <td className={`py-2 pr-3 text-right font-mono ${row.net > 0 ? 'text-emerald-300' : row.net < 0 ? 'text-rose-300' : ''}`}>
                          {row.net > 0 ? '+' : ''}{fmtMoney(row.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* 明細表 */}
            <Section title={`交易明細 (${filtered.length} / ${trades.length})`}>
              <div className="mb-4 flex flex-wrap gap-3">
                {users.length > 1 && (
                  <select
                    value={filterUser}
                    onChange={(e) => setFilterUser(e.target.value)}
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
                  >
                    <option value="">全部持有人</option>
                    {users.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                )}

                {markets.length > 1 && (
                  <select
                    value={filterMarket}
                    onChange={(e) => setFilterMarket(e.target.value)}
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
                  >
                    <option value="">全部市場</option>
                    {markets.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                )}

                <select
                  value={filterTicker}
                  onChange={(e) => setFilterTicker(e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
                >
                  <option value="">全部標的</option>
                  {tickers.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <select
                  value={filterSide}
                  onChange={(e) => setFilterSide(e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
                >
                  <option value="">買 + 賣</option>
                  <option value="B">只看買</option>
                  <option value="S">只看賣</option>
                </select>

                {(filterUser || filterMarket || filterTicker || filterSide) && (
                  <button
                    onClick={() => {
                      setFilterUser('')
                      setFilterMarket('')
                      setFilterTicker('')
                      setFilterSide('')
                    }}
                    className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm hover:bg-zinc-800"
                  >
                    清除
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
                    <tr className="border-b border-zinc-800">
                      <th className="py-2 pr-3">交易日</th>
                      <th className="py-2 pr-3">市場</th>
                      <th className="py-2 pr-3">代號</th>
                      <th className="py-2 pr-3">名稱</th>
                      <th className="py-2 pr-3 text-center">買/賣</th>
                      <th className="py-2 pr-3 text-right">股數</th>
                      <th className="py-2 pr-3 text-right">成交價</th>
                      <th className="py-2 pr-3 text-right">成交額</th>
                      <th className="py-2 pr-3 text-right">手續費</th>
                      <th className="py-2 pr-3 text-right">應收/付</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filtered.map((t) => (
                      <tr key={t.id} className="hover:bg-zinc-900">
                        <td className="py-2 pr-3 text-zinc-400 font-mono text-xs">{t.trade_date}</td>
                        <td className="py-2 pr-3 text-zinc-400 text-xs">{t.market ?? '—'}</td>
                        <td className="py-2 pr-3 font-mono">{t.ticker}</td>
                        <td className="py-2 pr-3 text-zinc-400">{t.name ?? '—'}</td>
                        <td className="py-2 pr-3 text-center">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                            t.side === 'B' ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'
                          }`}>
                            {t.side}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">{fmtShares(t.shares)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{fmtMoney(t.unit_price)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{fmtMoney(t.gross_amount)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-500 text-xs">
                          {fmtMoney(
                            Number(t.commission_fee) + Number(t.trade_fee) + Number(t.settle_fee) +
                            Number(t.stamp_tax) + Number(t.exchange_levy) + Number(t.frc_ptp_fee)
                          )}
                        </td>
                        <td className={`py-2 pr-3 text-right font-mono ${
                          Number(t.net_amount) < 0 ? 'text-rose-300' : 'text-emerald-300'
                        }`}>
                          {Number(t.net_amount) > 0 ? '+' : ''}{fmtMoney(t.net_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

function sumByCurrency(items: { trade_currency: string; gross_amount: number }[], _key: 'gross_amount' | 'net_amount') {
  const m = new Map<string, number>()
  for (const t of items) {
    const k = t.trade_currency || '?'
    m.set(k, (m.get(k) ?? 0) + Number((t as unknown as Record<string, number>)[_key === 'gross_amount' ? 'gross_amount' : 'net_amount']))
  }
  return [...m.entries()]
}

function renderByCcy(rows: [string, number][], fmt: (n: number) => string): string {
  if (rows.length === 0) return '—'
  return rows.map(([ccy, amt]) => `${ccy} ${fmt(amt)}`).join(' / ')
}

function Card({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent?: string
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold font-mono ${accent ?? ''}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-400">{title}</h2>
      {children}
    </div>
  )
}
