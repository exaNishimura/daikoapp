/**
 * Receivable Billing 機能のスモーク結合テスト。
 *
 * 「取引先追加 → 売掛入力 → 請求書発行 → 入金済」の経路を、
 * 各層の純関数 / ユーティリティを組み合わせて検証する。
 *
 * DB と UI 描画には触れない (それぞれは個別の単体テストで担保済み)。
 * このテストは「個別ユニットを組み合わせたときに整合性が保たれるか」を確認する。
 */

import { describe, expect, it } from 'vitest'

// 取引先
import {
  normalizeAlias,
  normalizeAliases,
  validateCompanyForm,
} from '@/lib/billing/companyForm'

// 売掛
import {
  EMPTY_RECEIVABLE_FORM,
  toBillingMonthFromWorkDate,
  validateReceivableForm,
} from '@/lib/billing/receivableForm'

// 月次サマリ
import { summarizeReceivables } from '@/lib/billing/receivablesSummary'

// 請求書発行戦略
import {
  applyMergeStrategy,
  applySplitStrategy,
  recommendedStrategy,
  INVOICE_MAX_LINES,
} from '@/lib/billing/invoiceLineStrategies'

// 入金 / 滞留
import { daysOverdue, summarizeUnpaidInvoices } from '@/lib/billing/invoiceAging'

// CSV
import { buildReceivablesCsv } from '@/lib/billing/exportReceivablesCsv'

describe('Receivable Billing スモーク結合', () => {
  it('取引先追加 → 売掛入力 → 月次サマリ → 請求書発行 → 入金済 の全フローが整合する', () => {
    // ===== 1. 取引先追加 =====
    const existingCompanies = [
      { id: 1, name: '田中商事', aliases: ['田中'], is_active: true },
    ]
    const newCompanyForm = {
      name: '  鈴友  ',
      invoice_display_name: '株式会社 鈴友',
      aliases: ['鈴友', '鈴友', '鈴友(株)', '  '],
      display_order: 2,
      is_active: true,
      memo: '',
    }
    const normalizedAliases = normalizeAliases(newCompanyForm.aliases)
    expect(normalizedAliases).toEqual(['鈴友', '鈴友(株)'])
    expect(normalizeAlias('鈴友(株)')).toBe('鈴友(株)')

    const validation = validateCompanyForm(newCompanyForm, existingCompanies)
    expect(validation.isValid).toBe(true)
    expect(validation.errors).toEqual({})

    const newCompany = {
      id: 2,
      name: newCompanyForm.name.trim(),
      invoice_display_name: newCompanyForm.invoice_display_name,
      aliases: normalizedAliases,
      is_active: true,
    }
    const allCompanies = [...existingCompanies, newCompany]

    // ===== 2. 売掛入力（5月分、複数行） =====
    const draftRow = {
      ...EMPTY_RECEIVABLE_FORM,
      company_id: newCompany.id,
      work_date: '2026-05-15',
      departure: '算所',
      destination: '南旭が丘',
      amount: 3000,
      note: null,
    }
    const rowValidation = validateReceivableForm(draftRow, { year: 2026, month: 5 })
    expect(rowValidation.isValid).toBe(true)
    expect(toBillingMonthFromWorkDate('2026-05-15')).toBe('2026-05-01')

    const receivables = [
      { ...draftRow, id: 101, billing_month: '2026-05-01' },
      {
        ...draftRow,
        id: 102,
        work_date: '2026-05-18',
        destination: '白子',
        amount: 8500,
        billing_month: '2026-05-01',
      },
      {
        ...draftRow,
        id: 103,
        company_id: 1,
        work_date: '2026-05-22',
        amount: 5000,
        billing_month: '2026-05-01',
      },
    ].map((r) => ({
      ...r,
      companies: {
        id: r.company_id,
        name: allCompanies.find((c) => c.id === r.company_id).name,
      },
    }))

    // ===== 3. 月次サマリ =====
    const summary = summarizeReceivables(receivables)
    expect(summary.totalAmount).toBe(3000 + 8500 + 5000)
    expect(summary.count).toBe(3)
    expect(summary.byCompany).toHaveLength(2)
    const suzutomo = summary.byCompany.find((c) => c.companyName === '鈴友')
    expect(suzutomo).toBeDefined()
    expect(suzutomo.total).toBe(11500)
    expect(suzutomo.count).toBe(2)

    // ===== 4. CSV 出力 (BOM + ヘッダ + 行) =====
    const csv = buildReceivablesCsv(receivables)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv.split('\r\n')[0]).toMatch(/請求月,日付/)
    expect(csv).toContain('鈴友')

    // ===== 5. 請求書発行戦略 (鈴友 2 行 → normal) =====
    const suzutomoReceivables = receivables.filter(
      (r) => r.company_id === newCompany.id
    )
    expect(suzutomoReceivables.length).toBeLessThanOrEqual(INVOICE_MAX_LINES)
    expect(recommendedStrategy(suzutomoReceivables.length)).toBe('normal')

    // 19 件超を仮定して合算/分割の整合性確認
    const heavy = Array.from({ length: 25 }, (_, i) => ({
      work_date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      departure: '出',
      destination: '着',
      amount: 1000 + i,
      note: null,
    }))
    expect(recommendedStrategy(heavy.length)).toBe('merge')

    const merged = applyMergeStrategy(heavy)
    expect(merged).toHaveLength(1)
    expect(merged[0].lines).toHaveLength(INVOICE_MAX_LINES)
    const heavyTotal = heavy.reduce((s, l) => s + l.amount, 0)
    expect(
      merged[0].lines.reduce((s, l) => s + l.amount, 0)
    ).toBe(heavyTotal)

    const split = applySplitStrategy(heavy)
    expect(split.length).toBeGreaterThan(1)
    expect(split[0].sequence).toEqual({ index: 1, total: split.length })
    expect(split.flatMap((s) => s.lines).reduce((s, l) => s + l.amount, 0)).toBe(
      heavyTotal
    )

    // ===== 6. 入金管理（未入金 / 滞留日数）=====
    const issueDate = '2026-05-31'
    const today = new Date('2026-08-15T00:00:00Z')
    const dOver = daysOverdue(issueDate, today)
    expect(dOver).toBeGreaterThan(60)

    const invoices = [
      {
        id: 201,
        company_id: newCompany.id,
        issue_date: issueDate,
        total_amount: 11500,
        paid_at: null,
        companies: { id: newCompany.id, name: '鈴友' },
      },
      {
        id: 202,
        company_id: 1,
        issue_date: '2026-07-31',
        total_amount: 5000,
        paid_at: null,
        companies: { id: 1, name: '田中商事' },
      },
    ]
    const unpaidSummary = summarizeUnpaidInvoices(invoices, today)
    expect(unpaidSummary.invoice_count).toBe(2)
    expect(unpaidSummary.total_unpaid).toBe(16500)
    expect(unpaidSummary.over_60_count).toBe(1) // 鈴友のみ 60+

    // ===== 7. 入金記録後は未入金から消える =====
    invoices[0].paid_at = '2026-08-10T00:00:00Z'
    const afterPay = summarizeUnpaidInvoices(invoices, today)
    expect(afterPay.invoice_count).toBe(1)
    expect(afterPay.over_60_count).toBe(0)
    expect(afterPay.total_unpaid).toBe(5000)
  })

  it('Excel インポートフローも純関数連結で整合する', async () => {
    const { matchCompany, resolveCompanyMap } = await import('@/lib/billing/matchCompany')
    const { findDuplicates } = await import('@/lib/billing/duplicateReceivables')
    const { buildImportPlan } = await import('@/lib/billing/buildImportPlan')

    const companies = [
      { id: 1, name: '鈴友', aliases: ['鈴友(株)'], is_active: true },
    ]
    const parsed = {
      period: { year: 2026, month: 5 },
      sourceFile: '202605稼働管理表new.xlsx',
      dailySales: [],
      staffSales: [],
      fixedExpenses: [],
      receivables: [
        {
          companyName: '鈴友(株)',
          workDate: new Date(Date.UTC(2026, 4, 8)),
          departure: '算所',
          destination: '旭が丘',
          amount: 3000,
          note: null,
        },
        {
          companyName: '謎の新規',
          workDate: new Date(Date.UTC(2026, 4, 10)),
          departure: null,
          destination: null,
          amount: 1500,
          note: null,
        },
      ],
      seenCompanies: new Set(['鈴友(株)', '謎の新規']),
      errors: [],
    }

    // 1. マッチング: 鈴友(株) は alias で自動マッチ、謎の新規はスキップ決定
    const m1 = matchCompany('鈴友(株)', companies)
    expect(m1.matched).toBe(true)
    expect(m1.kind).toBe('alias')

    const companyMap = resolveCompanyMap({
      companyNames: Array.from(parsed.seenCompanies),
      companies,
      decisions: { '謎の新規': 'skip' },
    })
    expect(companyMap).toEqual({ '鈴友(株)': 1 })

    // 2. 重複なし
    const incoming = parsed.receivables
      .filter((r) => companyMap[r.companyName])
      .map((r) => ({
        billing_month: '2026-05-01',
        company_id: companyMap[r.companyName],
        work_date: '2026-05-08',
        departure: r.departure,
        destination: r.destination,
        amount: r.amount,
      }))
    const flagged = findDuplicates(incoming, [])
    expect(flagged.every((r) => !r.duplicate)).toBe(true)

    // 3. RPC ペイロード組み立て
    const plan = buildImportPlan(parsed, {
      companyMap,
      duplicates: new Set(),
    })
    expect(plan.period).toBe('2026-05-01')
    expect(plan.receivables).toHaveLength(1) // 謎の新規は skip
    expect(plan.skipped_receivables).toBe(1)
    expect(plan.summary.unmapped_companies).toBe(1)
    expect(plan.source_file).toBe('202605稼働管理表new.xlsx')
  })
})
