/**
 * 鈴友 5 月分の請求書を実データの売掛シートから生成し、
 * 既存の手動版 (`excel-imports/templates/202605鈴友.xlsx`) とセル単位で一致することを検証する。
 *
 * 書式 (フォント/罫線/色) は比較対象外。値のみ。
 */

import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import ExcelJS from 'exceljs'
import { generateInvoice } from './generateInvoice'
import { parseSalesWorkbook } from './parseSalesWorkbook'
import { monthEnd } from './formatters'

const TEMPLATE_PATH = resolve(process.cwd(), 'src/assets/invoice-template.xlsx')
const SAMPLE_PATH = resolve(
  process.cwd(),
  'excel-imports/sales/202605稼働管理表new.xlsx'
)
const REFERENCE_INVOICE = resolve(
  process.cwd(),
  'excel-imports/templates/202605鈴友.xlsx'
)

const itIfReady =
  existsSync(TEMPLATE_PATH) && existsSync(SAMPLE_PATH) ? it : it.skip

describe('generateInvoice', () => {
  it('rejects more than 18 lines', async () => {
    const tpl = readFileSync(TEMPLATE_PATH)
    const lines = Array.from({ length: 19 }, () => ({
      workDate: new Date(2026, 4, 1),
      departure: 'a',
      destination: 'b',
      amount: 1000,
      note: null,
    }))
    await expect(
      generateInvoice(
        {
          issueDate: new Date(2026, 4, 31),
          companyDisplayName: 'X',
          totalAmount: 19000,
          lines,
        },
        { templateBuffer: tpl }
      )
    ).rejects.toThrow(/exceeds 18/)
  })

  it('rejects total mismatch', async () => {
    const tpl = readFileSync(TEMPLATE_PATH)
    await expect(
      generateInvoice(
        {
          issueDate: new Date(2026, 4, 31),
          companyDisplayName: 'X',
          totalAmount: 99999,
          lines: [
            {
              workDate: new Date(2026, 4, 1),
              departure: 'a',
              destination: 'b',
              amount: 1000,
              note: null,
            },
          ],
        },
        { templateBuffer: tpl }
      )
    ).rejects.toThrow(/totalAmount mismatch/)
  })

  itIfReady('produces an invoice for Suzutomo May 2026 matching the manual file', async () => {
    // ===== 1. 売掛シートから鈴友 5 月分を抽出 =====
    const buf = readFileSync(SAMPLE_PATH)
    const r = parseSalesWorkbook(buf, '202605稼働管理表new.xlsx')
    const suzutomo = r.receivables
      .filter((x) => x.companyName === '鈴友')
      .sort((a, b) => a.workDate - b.workDate)
    expect(suzutomo).toHaveLength(8)
    const total = suzutomo.reduce((s, x) => s + x.amount, 0)
    expect(total).toBe(27000)

    // ===== 2. 請求書を生成 =====
    const tpl = readFileSync(TEMPLATE_PATH)
    const out = await generateInvoice(
      {
        issueDate: monthEnd(2026, 5),
        companyDisplayName: '株式会社 鈴友',
        totalAmount: total,
        lines: suzutomo.map((x) => ({
          workDate: x.workDate,
          departure: x.departure,
          destination: x.destination,
          amount: x.amount,
          note: x.note,
        })),
      },
      { templateBuffer: tpl }
    )

    // ===== 3. 生成 .xlsx を読み戻して検証 =====
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(out)
    const ws = wb.getWorksheet('請求書')
    expect(ws).toBeTruthy()

    // 請求日 (2, 7) → (3, 8) : Date 値、書式はテンプレ側 numFmt に委譲
    const issue = ws.getCell(3, 8)
    expect(issue.value).toBeInstanceOf(Date)
    expect(issue.value.getFullYear()).toBe(2026)
    expect(issue.value.getMonth()).toBe(4)
    expect(issue.value.getDate()).toBe(31)
    expect(issue.numFmt).toContain('yyyy')

    // 取引先名 (4, 1) → (5, 2)
    expect(ws.getCell(5, 2).value).toBe('株式会社 鈴友')

    // 合計 (9, 4) → (10, 5) : 数値 + 通貨書式
    const totalCell = ws.getCell(10, 5)
    expect(totalCell.value).toBe(27000)
    expect(totalCell.numFmt).toContain('¥')

    // 明細 1 (5/8 算所→旭が丘 ¥3,000)
    expect(ws.getCell(13, 2).value).toBe(1) // テンプレ既存の No.
    const day1 = ws.getCell(13, 3)
    expect(day1.value).toBeInstanceOf(Date)
    expect(day1.value.getDate()).toBe(8)
    expect(day1.numFmt).toContain('yyyy')
    expect(ws.getCell(13, 4).value).toBe('運転代行')
    expect(ws.getCell(13, 5).value).toBe('算所')
    expect(ws.getCell(13, 6).value).toBe('南旭が丘')
    expect(ws.getCell(13, 7).value).toBe(3000)
    expect(ws.getCell(13, 7).numFmt).toContain('¥')

    // 明細 6 (5/18 白子→南旭が丘 ¥8,500 P1000円 一ノ宮経由)
    expect(ws.getCell(18, 2).value).toBe(6)
    expect(ws.getCell(18, 3).value.getDate()).toBe(18)
    expect(ws.getCell(18, 7).value).toBe(8500)
    expect(ws.getCell(18, 8).value).toBe('P1000円　一ノ宮経由')

    // 明細 8 (5/31)
    expect(ws.getCell(20, 2).value).toBe(8)
    expect(ws.getCell(20, 3).value.getDate()).toBe(31)
    expect(ws.getCell(20, 7).value).toBe(4500)
  })

  // 参考用: 手動版 .xlsx の明細セル値と等しいかをスポット比較する。
  // 鈴友手動版の (12, 4) "算所" → (12, 5) "旭が丘" は参照サンプルの宛先表記と一致するか確認。
  itIfReady('matches reference manual invoice cell values for Suzutomo', async () => {
    expect(existsSync(REFERENCE_INVOICE)).toBe(true)
    const refBuf = readFileSync(REFERENCE_INVOICE)
    const refWb = new ExcelJS.Workbook()
    await refWb.xlsx.load(refBuf)
    const refWs = refWb.getWorksheet('請求書')

    // 手動版 1 行目 "算所→旭が丘 ¥3,000"
    expect(refWs.getCell(13, 5).value).toBe('算所')
    expect(refWs.getCell(13, 6).value).toBe('旭が丘')
    expect(refWs.getCell(13, 7).value).toBe(3000)
    expect(refWs.getCell(13, 7).numFmt).toContain('¥')
    // 合計セルは数式 (H44 = 明細料金合計) で保存されている
    const refTotal = refWs.getCell(10, 5)
    expect(refTotal.value).toMatchObject({ formula: 'H44', result: 27000 })
    expect(refWs.getCell(5, 2).value).toBe('株式会社 鈴友')
  })
})
