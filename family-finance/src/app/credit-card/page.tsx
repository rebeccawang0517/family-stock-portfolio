'use client'

import { useEffect, useMemo, useState } from 'react'
import PieChart from '@/components/charts/PieChart'

interface Transaction {
  id: number
  user_email: string
  bank: string
  txn_date: string
  merchant: string
  amount: number
  category: string
  statement_year: number
  statement_month: number
}

interface MonthOption {
  year: number
  month: number
}

const fmt = (n: number) => n.toLocaleString('zh-TW', { maximumFractionDigits: 0 })

export default function CreditCardPage() {
  const [months, setMonths] = useState<MonthOption[]>([])
  const [year, setYear] = useState<number | null>(null)
  const [month, setMonth] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filterBank, setFilterBank] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [search, setSearch] = useState<string>('')

  // 載入有資料的月份
  useEffect(() => {
    fetch('/api/credit-card/months')
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
    fetch(`/api/credit-card/transactions?year=${year}&month=${month}`)
      .then((r) => r.json())
      .then((d) => setTransactions(d.transactions ?? []))
      .finally(() => setLoading(false))
  }, [year, month])

  // 拆消費 vs 退款
  const spending = useMemo(() => transactions.filter((t) => t.amount > 0), [transactions])
  const refunds = useMemo(() => transactions.filter((t) => t.amount < 0), [transactions])

  const totalSpending = useMemo(() => spending.reduce((s, t) => s + Number(t.amount), 0), [spending])
  const totalRefunds = useMemo(() => refunds.reduce((s, t) => s + Number(t.amount), 0), [refunds])

  // 各銀行小計（消費）
  const byBank = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of spending) m.set(t.bank, (m.get(t.bank) ?? 0) + Number(t.amount))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [spending])

  // 分類統計（消費）
  const byCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of spending) m.set(t.category, (m.get(t.category) ?? 0) + Number(t.amount))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [spending])

  // 篩選後的明細表
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterBank && t.bank !== filterBank) return false
      if (filterCategory && t.category !== filterCategory) return false
      if (search && !t.merchant.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [transactions, filterBank, filterCategory, search])

  const banks = useMemo(() => [...new Set(transactions.map((t) => t.bank))].sort(), [transactions])
  const categories = useMemo(
    () => [...new Set(transactions.map((t) => t.category))].sort(),
    [transactions],
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* 標題 + 月份選擇 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">信用卡帳單分析</h1>

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

        {!loading && transactions.length === 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
            <p>還沒有資料。在你電腦執行：</p>
            <code className="mt-2 inline-block rounded bg-zinc-950 px-3 py-1 text-xs text-zinc-300">
              python main.py --upload
            </code>
          </div>
        )}

        {!loading && transactions.length > 0 && (
          <>
            {/* 總覽卡 */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card label="總消費" value={fmt(totalSpending)} hint={`共 ${spending.length} 筆`} accent="text-emerald-300" />
              <Card label="扣款 / 退款" value={fmt(totalRefunds)} hint={`共 ${refunds.length} 筆`} accent="text-rose-300" />
              <Card label="淨額" value={fmt(totalSpending + totalRefunds)} hint="消費 − 扣退" accent="text-zinc-100" />
            </div>

            {/* 各銀行 + 圓餅圖 */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Section title="各銀行消費">
                <ul className="divide-y divide-zinc-800">
                  {byBank.map(([bank, amt]) => (
                    <li key={bank} className="flex items-center justify-between py-3">
                      <span className="text-sm text-zinc-300">{bank}</span>
                      <span className="font-mono text-sm">
                        {fmt(amt)}
                        <span className="ml-2 text-xs text-zinc-500">
                          ({((amt / totalSpending) * 100).toFixed(1)}%)
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="消費類別">
                <div className="h-72">
                  <PieChart
                    labels={byCategory.map(([c]) => c)}
                    data={byCategory.map(([, a]) => a)}
                  />
                </div>
              </Section>
            </div>

            {/* 篩選 + 明細表 */}
            <Section title={`交易明細 (${filtered.length} / ${transactions.length})`}>
              <div className="mb-4 flex flex-wrap gap-3">
                <select
                  value={filterBank}
                  onChange={(e) => setFilterBank(e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
                >
                  <option value="">全部銀行</option>
                  {banks.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm"
                >
                  <option value="">全部分類</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜尋商家…"
                  className="flex-1 min-w-[200px] rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm placeholder:text-zinc-500"
                />

                {(filterBank || filterCategory || search) && (
                  <button
                    onClick={() => {
                      setFilterBank('')
                      setFilterCategory('')
                      setSearch('')
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
                      <th className="py-2 pr-3">日期</th>
                      <th className="py-2 pr-3">銀行</th>
                      <th className="py-2 pr-3">商家</th>
                      <th className="py-2 pr-3">分類</th>
                      <th className="py-2 pr-3 text-right">金額</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {filtered.map((t) => (
                      <tr key={t.id} className="hover:bg-zinc-900">
                        <td className="py-2 pr-3 text-zinc-400 font-mono text-xs">{t.txn_date}</td>
                        <td className="py-2 pr-3">{t.bank}</td>
                        <td className="py-2 pr-3">{t.merchant}</td>
                        <td className="py-2 pr-3">
                          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                            {t.category}
                          </span>
                        </td>
                        <td className={`py-2 pr-3 text-right font-mono ${
                          Number(t.amount) < 0 ? 'text-rose-300' : 'text-zinc-100'
                        }`}>
                          {fmt(Number(t.amount))}
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
      <div className={`mt-1 text-2xl font-semibold font-mono ${accent ?? ''}`}>{value}</div>
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
