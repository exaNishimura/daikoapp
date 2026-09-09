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

describe('calcWithholdingTax — 基準額 88,000 未満', () => {
  it('甲欄は 0', () => {
    expect(
      calcWithholdingTax({
        grossPay: 87000,
        socialInsurance: 0,
        taxTableType: TAX_TABLE_KOU,
      })
    ).toBe(0)
  })

  it('乙欄は × 3.063% 切り捨て', () => {
    // 87000 * 0.03063 = 2664.81 → 2664
    expect(
      calcWithholdingTax({
        grossPay: 87000,
        taxTableType: TAX_TABLE_OTSU,
      })
    ).toBe(2664)
  })
})

describe('calcWithholdingTax — 甲欄 88,000以上', () => {
  it('88,000〜130,000: (base-88000)*5.105% + 2240', () => {
    // base=100000 → (12000)*0.05105 + 2240 = 612.6 + 2240 → 2852 (floor of product first)
    // Math.floor(12000 * 0.05105) + 2240 = Math.floor(612.6) + 2240 = 612 + 2240 = 2852
    expect(
      calcWithholdingTax({
        grossPay: 100000,
        taxTableType: TAX_TABLE_KOU,
        dependentsCount: 0,
      })
    ).toBe(2852)
  })

  it('130,000〜250,000: (base-130000)*10.21% + 4390', () => {
    // base=200000 → floor(70000*0.1021)+4390 = floor(7147)+4390 = 7147+4390 = 11537
    expect(
      calcWithholdingTax({
        grossPay: 200000,
        taxTableType: TAX_TABLE_KOU,
        dependentsCount: 0,
      })
    ).toBe(11537)
  })

  it('扶養1人あたり -1610、下限0', () => {
    const baseTax = calcWithholdingTax({
      grossPay: 100000,
      taxTableType: TAX_TABLE_KOU,
      dependentsCount: 0,
    })
    expect(
      calcWithholdingTax({
        grossPay: 100000,
        taxTableType: TAX_TABLE_KOU,
        dependentsCount: 1,
      })
    ).toBe(baseTax - 1610)

    // 税額が小さい帯で扶養を多くすると 0
    expect(
      calcWithholdingTax({
        grossPay: 90000,
        taxTableType: TAX_TABLE_KOU,
        dependentsCount: 5,
      })
    ).toBe(0)
  })
})

describe('calcWithholdingTax — 乙欄 88,000以上', () => {
  it('× 18.378% 切り捨て（月収20万で約36,756）', () => {
    // 200000 * 0.18378 = 36756
    expect(
      calcWithholdingTax({
        grossPay: 200000,
        taxTableType: TAX_TABLE_OTSU,
      })
    ).toBe(36756)
  })
})

describe('calcNetPay / summarizeWithholding', () => {
  it('差引 = 基準額 − 源泉 − その他控除', () => {
    const tax = calcWithholdingTax({
      grossPay: 200000,
      socialInsurance: 0,
      taxTableType: TAX_TABLE_OTSU,
    })
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
    expect(s.withholdingTax).toBe(Math.floor(140000 * 0.18378))
    expect(s.netPay).toBe(s.taxableBase - s.withholdingTax)
  })
})

describe('formatYen', () => {
  it('￥とカンマ区切り', () => {
    expect(formatYen(200000)).toBe('￥200,000')
  })
})
