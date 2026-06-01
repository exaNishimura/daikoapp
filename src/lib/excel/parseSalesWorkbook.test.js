/**
 * 実データ統合テスト。
 *
 * `excel-imports/sales/202605稼働管理表new.xlsx` を読み込み、
 * .kiro/specs/receivable-billing/requirements.md の Validation Targets と一致することを確認する。
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseSalesWorkbook } from './parseSalesWorkbook'

const SAMPLE_PATH = resolve(
  process.cwd(),
  'excel-imports/sales/202605稼働管理表new.xlsx'
)

const sum = (arr, key) => arr.reduce((s, x) => s + (key ? x[key] : x), 0)

const itIfSampleExists = existsSync(SAMPLE_PATH) ? it : it.skip

describe('parseSalesWorkbook (real data: 202605)', () => {
  itIfSampleExists('extracts period from filename', () => {
    const buf = readFileSync(SAMPLE_PATH)
    const r = parseSalesWorkbook(buf, '202605稼働管理表new.xlsx')
    expect(r.period).toEqual({ year: 2026, month: 5 })
    expect(r.errors).toEqual([])
  })

  itIfSampleExists('matches Validation Targets', () => {
    const buf = readFileSync(SAMPLE_PATH)
    const r = parseSalesWorkbook(buf, '202605稼働管理表new.xlsx')

    // ===== 全体合計 =====
    expect(sum(r.receivables, 'amount')).toBe(104000)
    expect(sum(r.dailySales, 'totalSales')).toBe(826500)

    // ===== 鈴友 =====
    const suzutomo = r.receivables.filter((x) => x.companyName === '鈴友')
    expect(suzutomo).toHaveLength(8)
    expect(sum(suzutomo, 'amount')).toBe(27000)

    // 5/8 算所→旭が丘 ¥3,000
    const may8 = suzutomo.find((x) => x.workDate.getDate() === 8)
    expect(may8).toMatchObject({
      departure: '算所',
      amount: 3000,
    })

    // 5/18 白子→南旭が丘 ¥8,500 備考 "P1000円　一ノ宮経由"
    const may18 = suzutomo.find((x) => x.workDate.getDate() === 18)
    expect(may18).toMatchObject({
      departure: '白子',
      destination: '南旭が丘',
      amount: 8500,
      note: 'P1000円　一ノ宮経由',
    })

    // ===== 5/1 集計 =====
    const may1 = r.dailySales.find((x) => x.workDate.getDate() === 1)
    expect(may1).toBeTruthy()
    expect(may1.vehicle1FuelYen).toBe(3000)
    expect(may1.vehicle1DistanceKm).toBe(175)
    expect(may1.totalSales).toBe(41000)

    const may1Nishimura = r.staffSales.find(
      (x) => x.workDate.getDate() === 1 && x.staffName === '西村'
    )
    expect(may1Nishimura).toBeTruthy()
    expect(may1Nishimura.hours).toBe(9.5)
    expect(may1Nishimura.sales).toBe(41000)
  })

  itIfSampleExists('discovers all 15 companies in seenCompanies', () => {
    const buf = readFileSync(SAMPLE_PATH)
    const r = parseSalesWorkbook(buf, '202605稼働管理表new.xlsx')
    const expected = [
      '徳丸',
      '三重パーツ',
      '法寿園',
      'アステル塗健',
      '蝶々',
      '草深創建',
      '山央工業',
      '美濃建設',
      'チョロモン',
      '鈴友',
      'ラウンジ心',
      '（株）ＵＥＴＡＫＡ',
      'モアライド',
      'Biss',
      'ゾンテック（株）',
    ]
    for (const name of expected) {
      expect(r.seenCompanies.has(name)).toBe(true)
    }
    expect(r.seenCompanies.size).toBe(15)
  })

  itIfSampleExists('captures monthly fixed expenses', () => {
    const buf = readFileSync(SAMPLE_PATH)
    const r = parseSalesWorkbook(buf, '202605稼働管理表new.xlsx')
    // _analysis-sales-full.txt より:
    //   共済掛金 ¥33,480 / 損害保険(1) ¥5,330 / 損害保険(2) ¥4,930
    //   駐車場 ¥5,330 / 駐車場 7210 (重複ラベル) / 携帯 9229 / 税理士 ¥11,000
    const labels = r.fixedExpenses.map((x) => x.label)
    expect(labels).toEqual(
      expect.arrayContaining([
        '共済掛金',
        '損害保険(1)',
        '損害保険(2)',
        '駐車場',
        '駐車場_2',
        '携帯',
        '税理士',
      ])
    )
    const koujou = r.fixedExpenses.find((x) => x.label === '共済掛金')
    expect(koujou.amount).toBe(33480)
  })

  itIfSampleExists('reports filename mismatch as an error', () => {
    const buf = readFileSync(SAMPLE_PATH)
    const r = parseSalesWorkbook(buf, 'unknown-file.xlsx')
    expect(r.period).toBeNull()
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0].field).toBe('fileName')
  })
})
