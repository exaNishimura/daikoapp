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
  createReceivable,
  updateReceivable,
  deleteReceivable,
} from '@/services/billing/receivablesService'
import { getCompanyProfile } from '@/services/billing/companyProfileService'
import {
  buildInvoicePath,
  uploadInvoiceFile,
  getInvoiceFileUrl,
  deleteInvoiceFile,
} from '@/services/billing/invoiceStorageService'
import { toBillingMonthFromWorkDate } from '@/lib/billing/receivableForm'
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
 * 'normal' は無加工 (生成側で INVOICE_MAX_LINES 行超なら Error)。
 * 'merge'  は (INVOICE_MAX_LINES-1) 件 + その他 1 行に集約。
 * 'split'  は INVOICE_MAX_LINES 行ずつ分割。
 *
 * @returns {Array<{ lines: Array, sequence?: { index, total } }>}
 */
function expandByStrategy(lines, strategy) {
  if (strategy === STRATEGIES.MERGE) return applyMergeStrategy(lines)
  if (strategy === STRATEGIES.SPLIT) return applySplitStrategy(lines)
  // normal: 1 枚として返す。INVOICE_MAX_LINES 行超なら generateInvoice 側で Error。
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
 * 1 社分の請求書をプレビュー用に生成する。
 * Storage への upload も DB の issueInvoice RPC も呼ばず、PDF Blob だけ返す。
 * split 戦略で複数枚出る場合は配列で全枚分返す。
 */
export function usePreviewInvoice() {
  return useMutation({
    mutationFn: async ({ year, month, companyId, strategy = STRATEGIES.NORMAL, issueDate }) => {
      if (!year || !month || !companyId) {
        throw new Error('year / month / companyId is required')
      }
      const [unbilled, profile] = await Promise.all([
        unwrap(getUnbilledByCompany(year, month)),
        unwrap(getCompanyProfile()),
      ])
      const company = unbilled.find((u) => u.company_id === companyId)
      if (!company) throw new Error('未請求売掛にこの企業がありません')

      const receivables = await unwrap(
        getReceivables({ year, month, companyId, invoiced: false })
      )
      if (!receivables.length) throw new Error('未請求の売掛がありません')

      const sortedLines = receivables
        .slice()
        .sort((a, b) => new Date(a.work_date) - new Date(b.work_date))
      const chunks = expandByStrategy(sortedLines, strategy)
      const finalIssueDate = issueDate ?? monthEnd(year, month)

      const previews = []
      for (const chunk of chunks) {
        const totalAmount = chunk.lines.reduce((s, x) => s + (Number(x.amount) || 0), 0)
        const pdfBuf = await generateInvoicePdf(
          {
            issueDate: finalIssueDate,
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
        const blob = new Blob([pdfBuf], { type: 'application/pdf' })
        previews.push({
          url: URL.createObjectURL(blob),
          sequence: chunk.sequence ?? null,
          lineCount: chunk.lines.length,
          totalAmount,
        })
      }
      return {
        companyId,
        companyName: company.invoice_display_name || company.company_name,
        previews,
      }
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

/**
 * 発行済請求書の修正→再発行。
 *
 * 流れ:
 *   1. ダイアログ上で編集した売掛を DB に反映 (create/update/delete)
 *   2. 既存 invoice を取消 (revoke)
 *   3. 旧 Storage ファイルを削除 (失敗しても続行)
 *   4. 最新の未請求売掛から PDF を再生成して発行
 *
 * 入金済みは revoke_invoice 側で拒否される。
 *
 * @param {Object} args
 * @param {Object} args.invoice          invoices 行 (companies join 済み)
 * @param {number} args.year
 * @param {number} args.month
 * @param {Array}  args.lines            再発行後に残す売掛ドラフト
 * @param {number[]} args.deletedIds     削除する売掛 id
 * @param {string} [args.strategy]       省略時 normal
 * @param {Date|string} [args.issueDate] 省略時は対象月末日
 */
export function useReissueInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      invoice,
      year,
      month,
      lines,
      deletedIds = [],
      strategy = STRATEGIES.NORMAL,
      issueDate,
    }) => {
      if (!invoice?.id) throw new Error('invoice is required')
      if (!year || !month) throw new Error('year / month is required')
      if (invoice.paid_at) {
        throw new Error('入金済みの請求書は修正できません。先に入金を解除してください')
      }
      if (!Array.isArray(lines) || lines.length === 0) {
        throw new Error('明細が 1 件以上必要です')
      }
      if (strategy === STRATEGIES.SKIP) {
        throw new Error('スキップでは再発行できません')
      }

      const companyId = invoice.company_id
      const billingMonth = `${year}-${String(month).padStart(2, '0')}-01`
      const oldFilePath = invoice.file_path

      // 1. 売掛の差分を反映 (まだ invoice_id が付いたままでも AR の更新/削除は可)
      for (const id of deletedIds) {
        await unwrap(deleteReceivable(id))
      }

      for (const line of lines) {
        const workDate = line.work_date
        const payload = {
          company_id: companyId,
          work_date: workDate,
          billing_month:
            toBillingMonthFromWorkDate(workDate) || billingMonth,
          vehicle_num: line.vehicle_num ?? null,
          departure: line.departure?.trim() || null,
          destination: line.destination?.trim() || null,
          amount: Number(line.amount) || 0,
          note: line.note?.trim() || null,
        }
        if (line.id != null) {
          await unwrap(updateReceivable(line.id, payload))
        } else {
          await unwrap(createReceivable(payload))
        }
      }

      // 2. 取消 → 紐付いていた売掛が未請求に戻る
      await unwrap(revokeInvoice(invoice.id))

      // 3. 旧 PDF 削除 (失敗しても再発行は続行。同パス upsert で上書きされる)
      if (oldFilePath) {
        const { error: delErr } = await deleteInvoiceFile(oldFilePath)
        if (delErr && import.meta.env.DEV) {
          console.warn('旧請求書ファイルの削除に失敗:', delErr)
        }
      }

      // 4. 再発行
      const profile = await unwrap(getCompanyProfile())
      const company = {
        company_id: companyId,
        company_name: invoice.companies?.name,
        invoice_display_name: invoice.companies?.invoice_display_name,
      }
      const issued = await issueOneCompany({
        company,
        year,
        month,
        issueDate: issueDate ?? monthEnd(year, month),
        profile,
        strategy,
      })

      return { successes: issued, failures: [] }
    },
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
