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
  getInvoiceFileUrl,
} from '@/services/billing/invoiceStorageService'
import { generateInvoicePdf } from '@/lib/pdf/generateInvoicePdf'
import { monthEnd } from '@/lib/excel/formatters'
import { queryKeys } from '@/lib/queryClient'
import {
  STRATEGIES,
  applyMergeStrategy,
  applySplitStrategy,
} from '@/lib/billing/invoiceLineStrategies'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw error
  return data
}

/**
 * 戦略に応じて行配列を「請求書束」に変換する。
 * 'normal' は無加工 (生成側で 18 行超なら Error)。
 * 'merge'  は 17 件 + その他 1 行に集約。
 * 'split'  は 18 行ずつ分割。
 *
 * @returns {Array<{ lines: Array, sequence?: { index, total } }>}
 */
function expandByStrategy(lines, strategy) {
  if (strategy === STRATEGIES.MERGE) return applyMergeStrategy(lines)
  if (strategy === STRATEGIES.SPLIT) return applySplitStrategy(lines)
  // normal: 1 枚として返す。18 行超なら generateInvoice 側で Error。
  return [{ lines: [...lines] }]
}

/**
 * 1 社分の請求書を発行する (内部関数)。
 * 戦略 ('normal'|'merge'|'split') により 1 〜 N 枚の請求書を生成する。
 *
 * @returns {Promise<Array<{ companyId, invoiceId, filePath, sequence?: { index, total } }>>}
 */
async function issueOneCompany({
  company,
  year,
  month,
  issueDate,
  profile,
  strategy = STRATEGIES.NORMAL,
}) {
  const receivables = await unwrap(
    getReceivables({ year, month, companyId: company.company_id, invoiced: false })
  )
  if (!receivables.length) {
    throw new Error(`未請求の売掛がありません (company_id=${company.company_id})`)
  }

  const sortedLines = receivables
    .slice()
    .sort((a, b) => new Date(a.work_date) - new Date(b.work_date))

  const chunks = expandByStrategy(sortedLines, strategy)
  const results = []

  for (const chunk of chunks) {
    const totalAmount = chunk.lines.reduce((s, x) => s + (Number(x.amount) || 0), 0)
    const pdfBuf = await generateInvoicePdf(
      {
        issueDate,
        companyDisplayName:
          (company.invoice_display_name || company.company_name || '') +
          (chunk.sequence ? ` (${chunk.sequence.index}/${chunk.sequence.total})` : ''),
        totalAmount,
        lines: chunk.lines.map((x) => ({
          workDate: new Date(x.work_date),
          departure: x.departure,
          destination: x.destination,
          amount: x.amount,
          note: x.note,
        })),
      },
      { profile }
    )

    const filePath = buildInvoicePath({
      year,
      month,
      companyId: company.company_id,
      sequence: chunk.sequence,
    })

    // ファイル名: `${YYYY}${MM}_{会社名}様_請求書` (拡張子は DL 側で付与)
    const ymPrefix = `${year}${String(month).padStart(2, '0')}`
    const baseName =
      company.invoice_display_name || company.company_name || `company-${company.company_id}`
    const displayName =
      `${ymPrefix}_${baseName}様_請求書` +
      (chunk.sequence ? `_${chunk.sequence.index}of${chunk.sequence.total}` : '')

    await unwrap(uploadInvoiceFile(filePath, pdfBuf))

    // split 戦略のときは、各枚で発行 RPC を呼ぶと line_count/total が
    // accounts_receivable と合わないため、現状の DB スキーマでは
    // 1 (company_id, billing_month) につき 1 invoices 行のみ作成できる。
    // → split で複数枚必要なときは 1 枚目だけ RPC で永続化し、
    //   それ以外の枚は Storage アップロードのみ (file_path リスト返却)。
    //   分割発行は「明細上の都合で複数枚に分けたが、会計上は同一」という運用前提。
    let invoiceId = null
    const isFirstChunk = !chunk.sequence || chunk.sequence.index === 1
    if (isFirstChunk) {
      const invoice = await unwrap(
        issueInvoice({
          companyId: company.company_id,
          year,
          month,
          issueDate,
          totalAmount: sortedLines.reduce((s, x) => s + x.amount, 0),
          lineCount: sortedLines.length,
          profileSnapshot: profile ?? {},
          filePath,
        })
      )
      invoiceId = invoice.id
    }

    results.push({
      companyId: company.company_id,
      invoiceId,
      filePath,
      displayName,
      sequence: chunk.sequence,
      lineCount: chunk.lines.length,
      totalAmount,
    })
  }

  return results
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
 * 入力:
 *   - year, month                                必須
 *   - targets: [{ companyId, strategy }]         発行対象。strategy 省略時は normal
 *   - companyIds?: number[]                      簡易呼び出し用。指定時は全社 normal で発行
 *   - issueDate?: Date                           省略時は対象月の月末日
 *
 * 出力: { successes: [{ companyId, invoiceId, filePath, sequence? }], failures: [...] }
 *   1 社失敗しても他社は発行する (部分成功許容)。
 */
export function useIssueInvoices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ year, month, targets, companyIds, issueDate }) => {
      if (!year || !month) {
        throw new Error('year / month is required')
      }

      const [unbilled, profile] = await Promise.all([
        unwrap(getUnbilledByCompany(year, month)),
        unwrap(getCompanyProfile()),
      ])

      // 入力の正規化: targets が無ければ companyIds から normal で生成
      const normalizedTargets = Array.isArray(targets) && targets.length
        ? targets
        : (Array.isArray(companyIds) && companyIds.length
            ? companyIds.map((id) => ({ companyId: id, strategy: STRATEGIES.NORMAL }))
            : unbilled.map((u) => ({ companyId: u.company_id, strategy: STRATEGIES.NORMAL })))

      const unbilledById = new Map(unbilled.map((u) => [u.company_id, u]))
      const activeTargets = normalizedTargets
        .filter((t) => t.strategy !== STRATEGIES.SKIP)
        .map((t) => ({
          company: unbilledById.get(t.companyId),
          strategy: t.strategy ?? STRATEGIES.NORMAL,
        }))
        .filter((t) => t.company)

      const finalIssueDate = issueDate ?? monthEnd(year, month)

      const successes = []
      const failures = []

      // 並列発行 (DB 負荷を考慮しつつ最大 3 並列。複数枚分割があるため少し控えめ)
      const CONCURRENCY = 3
      for (let i = 0; i < activeTargets.length; i += CONCURRENCY) {
        const batch = activeTargets.slice(i, i + CONCURRENCY)
        const results = await Promise.allSettled(
          batch.map(({ company, strategy }) =>
            issueOneCompany({
              company,
              year,
              month,
              issueDate: finalIssueDate,
              profile,
              strategy,
            })
          )
        )
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled') {
            // issueOneCompany は配列を返すため flatten
            for (const v of r.value) successes.push(v)
          } else {
            failures.push({
              companyId: batch[idx].company.company_id,
              companyName: batch[idx].company.company_name,
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

/**
 * Storage 上の請求書 .pdf をダウンロードする。
 * 署名 URL を発行 → ファイルを fetch → Blob で <a download> 経由で保存。
 *
 * - displayName でブラウザ DL ダイアログのファイル名を指定 (拡張子はここで .pdf 付与)
 * - window.open しないのでポップアップブロックされない
 * - 署名 URL は 5 分有効
 */
export function useDownloadInvoice() {
  return useMutation({
    mutationFn: async ({ filePath, displayName }) => {
      if (!filePath) throw new Error('filePath is required')
      const safeName = displayName
        ? `${String(displayName).replace(/[\\/:*?"<>|]/g, '_').trim()}.pdf`
        : filePath.slice(filePath.lastIndexOf('/') + 1)

      const data = await unwrap(getInvoiceFileUrl(filePath, 300))
      const url = data?.signedUrl ?? data?.signedURL
      if (typeof url !== 'string') throw new Error('signed URL not returned')

      const res = await fetch(url)
      if (!res.ok) throw new Error(`failed to fetch invoice file: ${res.status}`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      try {
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = safeName
        document.body.appendChild(a)
        a.click()
        a.remove()
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
      return { filePath, name: safeName }
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
