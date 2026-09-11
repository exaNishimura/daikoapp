import { describe, expect, it } from 'vitest'
import {
  TAX_TABLE_KOU,
  TAX_TABLE_OTSU,
  calcNetPay,
  calcTaxableBase,
  calcWithholdingTax,
  formatYen,
  summarizeWithholding,
} from './withholdingTax.js'

describe('calcTaxableBase', () => {
  it('総支給 − 社保（負にならない）', () => {
    expect(calcTaxableBase(200000, 30000)).toBe(170000)
    expect(calcTaxableBase(10000, 30000)).toBe(0)
  })
})

describe('calcWithholdingTax — 乙欄（令和8年分 月額表）', () => {
  it('105,000未満は ×3.063% 切り捨て', () => {
    expect(
      calcWithholdingTax({
        grossPay: 87000,
        taxTableType: TAX_TABLE_OTSU,
      })
    ).toBe(2664)

    expect(
      calcWithholdingTax({
        grossPay: 100000,
        taxTableType: TAX_TABLE_OTSU,
      })
    ).toBe(3063)
  })

  it('税額表と一致する（計算基準額→A−B→×1.021）', () => {
    expect(
      calcWithholdingTax({
        grossPay: 105000,
        taxTableType: TAX_TABLE_OTSU,
      })
    ).toBe(3800)

    expect(
      calcWithholdingTax({
        grossPay: 155000,
        taxTableType: TAX_TABLE_OTSU,
      })
    ).toBe(9200)

    expect(
      calcWithholdingTax({
        grossPay: 200000,
        taxTableType: TAX_TABLE_OTSU,
      })
    ).toBe(19700)

    expect(
      calcWithholdingTax({
        grossPay: 300000,
        taxTableType: TAX_TABLE_OTSU,
      })
    ).toBe(53600)
  })

  it('740,000円は表の上限 259,200円', () => {
    expect(
      calcWithholdingTax({
        grossPay: 740000,
        taxTableType: TAX_TABLE_OTSU,
      })
    ).toBe(259200)
  })

  it('740,001円以上は 259,200 + 超過×40.84%', () => {
    expect(
      calcWithholdingTax({
        grossPay: 800000,
        taxTableType: TAX_TABLE_OTSU,
      })
    ).toBe(Math.floor(259200 + 60000 * 0.4084))
  })

  it('1,710,000円ちょうどは 655,400円', () => {
    expect(
      calcWithholdingTax({
        grossPay: 1710000,
        taxTableType: TAX_TABLE_OTSU,
      })
    ).toBe(655400)
  })
})

describe('calcWithholdingTax — 甲欄（令和8年分 電算機計算の特例）', () => {
  it('課税所得が0以下なら 0', () => {
    expect(
      calcWithholdingTax({
        grossPay: 87000,
        taxTableType: TAX_TABLE_KOU,
      })
    ).toBe(0)

    expect(
      calcWithholdingTax({
        grossPay: 100000,
        taxTableType: TAX_TABLE_KOU,
      })
    ).toBe(0)
  })

  it('国税庁計算例: 175,000円・扶養2人 → 210円', () => {
    expect(
      calcWithholdingTax({
        grossPay: 175000,
        taxTableType: TAX_TABLE_KOU,
        dependentsCount: 2,
      })
    ).toBe(210)
  })

  it('国税庁計算例: 446,000円・扶養8人 → 940円', () => {
    expect(
      calcWithholdingTax({
        grossPay: 446000,
        taxTableType: TAX_TABLE_KOU,
        dependentsCount: 8,
      })
    ).toBe(940)
  })

  it('国税庁計算例: 775,200円・扶養3人 → 59,470円', () => {
    expect(
      calcWithholdingTax({
        grossPay: 775200,
        taxTableType: TAX_TABLE_KOU,
        dependentsCount: 3,
      })
    ).toBe(59470)
  })

  it('200,000円・扶養0人は税額表と同じ 4,340円', () => {
    expect(
      calcWithholdingTax({
        grossPay: 200000,
        taxTableType: TAX_TABLE_KOU,
        dependentsCount: 0,
      })
    ).toBe(4340)
  })

  it('扶養で税額が下がる', () => {
    const zero = calcWithholdingTax({
      grossPay: 200000,
      taxTableType: TAX_TABLE_KOU,
      dependentsCount: 0,
    })
    const one = calcWithholdingTax({
      grossPay: 200000,
      taxTableType: TAX_TABLE_KOU,
      dependentsCount: 1,
    })
    expect(one).toBeLessThan(zero)
    expect(one).toBe(2720)
  })
})

describe('calcNetPay / summarizeWithholding', () => {
  it('差引 = 基準額 − 源泉 − その他控除', () => {
    const tax = calcWithholdingTax({
      grossPay: 200000,
      socialInsurance: 0,
      taxTableType: TAX_TABLE_OTSU,
    })
    expect(tax).toBe(19700)
    expect(
      calcNetPay({
        grossPay: 200000,
        socialInsurance: 0,
        withholdingTax: tax,
        otherDeduction: 1000,
        taxTableType: TAX_TABLE_OTSU,
      })
    ).toBe(200000 - tax - 1000)
  })

  it('summarizeWithholding が一貫した値を返す', () => {
    const s = summarizeWithholding({
      grossPay: 150000,
      socialInsurance: 10000,
      taxTableType: '乙欄',
    })
    expect(s.taxableBase).toBe(140000)
    expect(s.withholdingTax).toBe(6700)
    expect(s.netPay).toBe(s.taxableBase - s.withholdingTax)
  })
})

describe('formatYen', () => {
  it('￥とカンマ区切り', () => {
    expect(formatYen(200000)).toBe('￥200,000')
  })
})
