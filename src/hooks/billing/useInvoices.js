import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getInvoices,
  getInvoice,
  issueInvoice,
  updateInvoiceFilePath,
  revokeInvoice,
  markInvoicePaid,
} from '@/services/billing/invoicesService'
import {
  getReceivables,
  getUnbilledByCompany,
} from '@/services/billing/receivablesService'
import { getCompanyProfile } from '@/services/billing/companyProfileService'
import {
  buildInvoicePath,
  uploadInvoiceFile,
} from '@/services/billing/invoiceStorageService'
import { generateInvoice } from '@/lib/excel/generateInvoice'
import { monthEnd } from '@/lib/excel/formatters'
import { queryKeys } from '@/lib/queryClient'
import invoiceTemplateUrl from '@/assets/invoice-template.xlsx?url'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

/**
 * テンプレ .xlsx を fetch して ArrayBuffer で返す (発行ロジックで毎回使う)。
 * Vite の `?url` インポートでバンドル時に最終 URL に解決される。
 */
async function loadTemplateBuffer() {
  const res = await fetch(invoiceTemplateUrl)
  if (!res.ok) {
    throw new Error(
      `Failed to load invoice template: ${res.status} ${res.statusText}`
    )
  }
  return res.arrayBuffer()
}

/**
 * 1 社分の請求書を発行する (内部関数)。
 *  1. 売掛を取得 (work_date 昇順)
 *  2. generateInvoice で .xlsx 生成
 *  3. Storage アップロード
 *  4. issue_invoice RPC で invoices insert + accounts_receivable.invoice_id 一括更新
 *  5. 念のため file_path を再 update (RPC 経由でセット済だが Storage ファイル名と整合保証)
 *
 * @returns {Promise<{ companyId, invoiceId, filePath }>}
 */
async function issueOneCompany({
  company,
  year,
  month,
  issueDate,
  templateBuffer,
  profile,
}) {
  const receivables = await unwrap(
    getReceivables({ year, month, companyId: company.company_id, invoiced: false })
  )
  if (!receivables.length) {
    throw new Error(`未請求の売掛がありません (company_id=${company.company_id})`)
  }

  const totalAmount = receivables.reduce((s, x) => s + x.amount, 0)

  const xlsxBuf = await generateInvoice(
    {
      issueDate,
      companyDisplayName:
        company.invoice_display_name || company.company_name || '',
      totalAmount,
      lines: receivables
        .slice()
        .sort((a, b) => new Date(a.work_date) - new Date(b.work_date))
        .map((x) => ({
          workDate: new Date(x.work_date),
          departure: x.departure,
          destination: x.destination,
          amount: x.amount,
          note: x.note,
        })),
    },
    { templateBuffer }
  )

  const filePath = buildInvoicePath({
    year,
    month,
    companyId: company.company_id,
    displayName: company.invoice_display_name || company.company_name,
  })

  await unwrap(uploadInvoiceFile(filePath, xlsxBuf))

  const invoice = await unwrap(
    issueInvoice({
      companyId: company.company_id,
      year,
      month,
      issueDate,
      totalAmount,
      lineCount: receivables.length,
      profileSnapshot: profile ?? {},
      filePath,
    })
  )

  return { companyId: company.company_id, invoiceId: invoice.id, filePath }
}

// ===========================================================================
// Queries
// ===========================================================================

export function useInvoices(filter = {}) {
  return useQuery({
    queryKey: queryKeys.invoices.list(filter),
    queryFn: () => unwrap(getInvoices(filter)),
  })
}

export function useUnpaidInvoices() {
  return useQuery({
    queryKey: queryKeys.invoices.unpaid(),
    queryFn: () => unwrap(getInvoices({ unpaidOnly: true })),
  })
}

export function useInvoice(id) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(id),
    queryFn: () => unwrap(getInvoice(id)),
    enabled: id != null,
  })
}

// ===========================================================================
// Mutations
// ===========================================================================

/**
 * 月次請求書発行。
 *
 * 入力: { year, month, companyIds?: number[], issueDate?: Date }
 *   - companyIds 省略時は当月未請求のある企業全社
 *   - issueDate 省略時は対象月の月末日
 *
 * 出力: { successes: [...], failures: [...] }
 *   1 社失敗しても他社は発行する (部分成功許容)。
 */
export function useIssueInvoices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ year, month, companyIds, issueDate }) => {
      if (!year || !month) {
        throw new Error('year / month is required')
      }

      const [unbilled, profile, templateBuffer] = await Promise.all([
        unwrap(getUnbilledByCompany(year, month)),
        unwrap(getCompanyProfile()),
        loadTemplateBuffer(),
      ])

      const targets = Array.isArray(companyIds) && companyIds.length
        ? unbilled.filter((u) => companyIds.includes(u.company_id))
        : unbilled

      const finalIssueDate = issueDate ?? monthEnd(year, month)

      const successes = []
      const failures = []

      // 並列発行 (DB 負荷を考慮しつつ最大 5 並列)
      const CONCURRENCY = 5
      for (let i = 0; i < targets.length; i += CONCURRENCY) {
        const batch = targets.slice(i, i + CONCURRENCY)
        const results = await Promise.allSettled(
          batch.map((company) =>
            issueOneCompany({
              company,
              year,
              month,
              issueDate: finalIssueDate,
              templateBuffer,
              profile,
            })
          )
        )
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled') {
            successes.push(r.value)
          } else {
            failures.push({
              companyId: batch[idx].company_id,
              companyName: batch[idx].company_name,
              error: r.reason?.message ?? String(r.reason),
            })
          }
        })
      }

      return { successes, failures }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all })
      qc.invalidateQueries({ queryKey: queryKeys.receivables.all })
    },
  })
}

export function useUpdateInvoiceFilePath() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, filePath }) =>
      unwrap(updateInvoiceFilePath(id, filePath)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all })
    },
  })
}

export function useRevokeInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (invoiceId) => unwrap(revokeInvoice(invoiceId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all })
      qc.invalidateQueries({ queryKey: queryKeys.receivables.all })
    },
  })
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, paidAt }) => unwrap(markInvoicePaid(id, paidAt)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all })
    },
  })
}
