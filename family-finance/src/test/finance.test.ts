import { describe, it, expect } from 'vitest'

// 資產計算邏輯測試
function calculateReturn(cost: number, currentValue: number): number {
  if (cost === 0) return 0
  return ((currentValue - cost) / cost) * 100
}

function toMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case 'weekly': return amount * 52 / 12
    case 'monthly': return amount
    case 'quarterly': return amount / 3
    case 'yearly': return amount / 12
    default: return 0
  }
}

describe('報酬率計算', () => {
  it('正報酬', () => {
    expect(calculateReturn(100000, 120000)).toBeCloseTo(20)
  })

  it('負報酬', () => {
    expect(calculateReturn(100000, 80000)).toBeCloseTo(-20)
  })

  it('成本為零不除以零', () => {
    expect(calculateReturn(0, 50000)).toBe(0)
  })
})

describe('月化金額換算', () => {
  it('年繳轉月', () => {
    expect(toMonthly(120000, 'yearly')).toBe(10000)
  })

  it('季繳轉月', () => {
    expect(toMonthly(30000, 'quarterly')).toBe(10000)
  })

  it('週繳轉月', () => {
    expect(toMonthly(1000, 'weekly')).toBeCloseTo(4333.33, 0)
  })

  it('月繳不變', () => {
    expect(toMonthly(50000, 'monthly')).toBe(50000)
  })
})
