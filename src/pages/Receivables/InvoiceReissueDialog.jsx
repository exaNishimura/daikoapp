import { useEffect, useMemo, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { DateInput } from '@astryxdesign/core/DateInput'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { Spinner } from '@astryxdesign/core/Spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Eye, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { AmountInput } from '@/components/Receivables/AmountInput'
import { VehicleNumSelect } from '@/components/Receivables/VehicleNumSelect'
import { useInvoice, useReissueInvoice } from '@/hooks/billing/useInvoices'
import { getCompanyProfile } from '@/services/billing/companyProfileService'
import { getReceivables } from '@/services/billing/receivablesService'
import { generateInvoicePdf } from '@/lib/pdf/generateInvoicePdf'
import { formatIsoDate, resolveIssueDate } from '@/lib/excel/formatters'
import {
  parseVehicleNumForSave,
  validateReceivableForm,
  vehicleNumToFormValue,
} from '@/lib/billing/receivableForm'
import {
  STRATEGIES,
  INVOICE_MAX_LINES,
  recommendedStrategy,
  applyMergeStrategy,
  applySplitStrategy,
} from '@/lib/billing/invoiceLineStrategies'
import { InvoicePreviewDialog } from './InvoicePreviewDialog'
import { InvoiceIssueResultDialog } from './InvoiceIssueResultDialog'

const STRATEGY_LABEL = {
  [STRATEGIES.NORMAL]: '通常発行',
  [STRATEGIES.MERGE]: '合算（"その他" 1 行に集約）',
  [STRATEGIES.SPLIT]: '分割（複数枚に分ける）',
}

let draftKeySeq = 0
function nextDraftKey() {
  draftKeySeq += 1
  return `draft-${draftKeySeq}`
}

function rowToDraft(row) {
  return {
    key: nextDraftKey(),
    id: row.id,
    work_date: row.work_date ?? '',
    vehicle_num: vehicleNumToFormValue(row.vehicle_num),
    departure: row.departure ?? '',
    destination: row.destination ?? '',
    amount: row.amount ?? null,
    note: row.note ?? '',
  }
}

function emptyDraft(year, month) {
  const day = '01'
  return {
    key: nextDraftKey(),
    id: null,
    work_date: `${year}-${String(month).padStart(2, '0')}-${day}`,
    vehicle_num: '',
    departure: '',
    destination: '',
    amount: null,
    note: '',
  }
}

function expandByStrategy(lines, strategy) {
  if (strategy === STRATEGIES.MERGE) return applyMergeStrategy(lines)
  if (strategy === STRATEGIES.SPLIT) return applySplitStrategy(lines)
  return [{ lines: [...lines] }]
}

function monthBound(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${day}`
}

/** invoices.issue_date / YYYY-MM-DD → DateInput 用 ISO 日付 */
function toIssueDateValue(raw, year, month) {
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10)
  }
  return formatIsoDate(resolveIssueDate(year, month))
}

/** YYYY-MM-DD → ローカル Date（PDF 用。UTC ずれ防止） */
function parseLocalIsoDate(iso) {
  if (!iso || typeof iso !== 'string') return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/**
 * 発行済請求書の「修正して再発行」ダイアログ。
 * 明細を編集 → 取消 → PDF 再生成を 1 操作で行う。
 */
export function InvoiceReissueDialog({ open, onClose, invoice, year, month }) {
  const detailQuery = useInvoice(open ? invoice?.id : null)
  const reissue = useReissueInvoice()

  const [lines, setLines] = useState([])
  const [deletedIds, setDeletedIds] = useState([])
  const [strategy, setStrategy] = useState(STRATEGIES.NORMAL)
  const [error, setError] = useState(null)
  const [otherUnbilledCount, setOtherUnbilledCount] = useState(0)
  const [initializedFor, setInitializedFor] = useState(null)
  const [initBusy, setInitBusy] = useState(false)

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [previewBusy, setPreviewBusy] = useState(false)

  const [resultOpen, setResultOpen] = useState(false)
  const [result, setResult] = useState(null)
  const [issueDate, setIssueDate] = useState('')

  const companyId = invoice?.company_id
  const companyName =
    invoice?.companies?.invoice_display_name || invoice?.companies?.name || `企業 #${companyId}`

  // 明細ロード完了時にドラフト初期化
  // この請求書に紐付く明細のみ（同月の他未請求＝都度分は巻き込まない）
  useEffect(() => {
    if (!open || !invoice?.id || !year || !month) return
    if (initializedFor === invoice.id) return
    if (!detailQuery.data) return

    let cancelled = false
    setInitBusy(true)
    ;(async () => {
      try {
        const linked = detailQuery.data.accounts_receivable ?? []
        const { data: unbilled, error: unbilledErr } = await getReceivables({
          year,
          month,
          companyId: invoice.company_id,
          invoiced: false,
        })
        if (unbilledErr) throw unbilledErr

        const sorted = [...linked].sort((a, b) =>
          String(a.work_date).localeCompare(String(b.work_date))
        )
        if (cancelled) return
        setLines(sorted.map(rowToDraft))
        setDeletedIds([])
        setStrategy(recommendedStrategy(sorted.length))
        setOtherUnbilledCount((unbilled ?? []).length)
        setIssueDate(
          toIssueDateValue(detailQuery.data.issue_date ?? invoice.issue_date, year, month)
        )
        setError(null)
        setInitializedFor(invoice.id)
      } catch (err) {
        if (!cancelled) {
          setError(`明細の初期化に失敗: ${err.message}`)
        }
      } finally {
        if (!cancelled) setInitBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    open,
    invoice?.id,
    invoice?.company_id,
    invoice?.issue_date,
    detailQuery.data,
    year,
    month,
    initializedFor,
  ])

  // 閉じたら初期化フラグをリセット
  useEffect(() => {
    if (!open) {
      setInitializedFor(null)
      setOtherUnbilledCount(0)
      setIssueDate('')
    }
  }, [open])

  const options = useMemo(() => ({ year, month }), [year, month])

  const lineValidations = useMemo(
    () =>
      lines.map((line) =>
        validateReceivableForm(
          {
            company_id: companyId,
            work_date: line.work_date,
            amount: line.amount,
          },
          options
        )
      ),
    [lines, companyId, options]
  )

  const allValid = lines.length > 0 && lineValidations.every((v) => v.isValid)
  const issueDateValid = Boolean(parseLocalIsoDate(issueDate))
  const canSubmit = allValid && issueDateValid
  const totalAmount = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const isOverflow = lines.length > INVOICE_MAX_LINES

  const updateLine = (key, patch) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const handleDeleteLine = (line) => {
    setLines((prev) => prev.filter((l) => l.key !== line.key))
    if (line.id != null) {
      setDeletedIds((prev) => (prev.includes(line.id) ? prev : [...prev, line.id]))
    }
  }

  const handleAddLine = () => {
    setLines((prev) => [...prev, emptyDraft(year, month)])
  }

  const buildIssueLines = () =>
    lines.map((l) => ({
      id: l.id,
      work_date: l.work_date,
      vehicle_num: parseVehicleNumForSave(l.vehicle_num),
      departure: l.departure,
      destination: l.destination,
      amount: Number(l.amount) || 0,
      note: l.note,
    }))

  const handlePreview = async () => {
    if (!allValid) {
      setError('明細に未入力・不正な項目があります')
      return
    }
    const issueDateObj = parseLocalIsoDate(issueDate)
    if (!issueDateObj) {
      setError('発行日を入力してください')
      return
    }
    setError(null)
    setPreviewBusy(true)
    try {
      const { data: profile, error: profileErr } = await getCompanyProfile()
      if (profileErr) throw profileErr

      const sorted = buildIssueLines()
        .slice()
        .sort((a, b) => String(a.work_date).localeCompare(String(b.work_date)))
      const chunks = expandByStrategy(sorted, strategy)
      const previews = []

      for (const chunk of chunks) {
        const chunkTotal = chunk.lines.reduce((s, x) => s + (Number(x.amount) || 0), 0)
        const pdfBuf = await generateInvoicePdf(
          {
            issueDate: issueDateObj,
            companyDisplayName:
              companyName +
              (chunk.sequence ? ` (${chunk.sequence.index}/${chunk.sequence.total})` : ''),
            totalAmount: chunkTotal,
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
          totalAmount: chunkTotal,
        })
      }
      setPreviewData({ companyName, previews })
      setPreviewOpen(true)
    } catch (err) {
      setError(`プレビュー生成に失敗: ${err.message}`)
    } finally {
      setPreviewBusy(false)
    }
  }

  const handleReissue = async () => {
    if (!allValid) {
      setError('明細に未入力・不正な項目があります')
      return
    }
    if (!parseLocalIsoDate(issueDate)) {
      setError('発行日を入力してください')
      return
    }
    if (
      !window.confirm(`「${companyName}」の請求書を取消し、編集内容で再発行します。よろしいですか?`)
    ) {
      return
    }
    setError(null)
    try {
      const out = await reissue.mutateAsync({
        invoice,
        year,
        month,
        lines: buildIssueLines(),
        deletedIds,
        strategy: isOverflow ? strategy : STRATEGIES.NORMAL,
        issueDate,
      })
      setResult(out)
      setResultOpen(true)
    } catch (err) {
      setError(`再発行に失敗: ${err.message}`)
    }
  }

  const handleResultClose = () => {
    setResultOpen(false)
    setResult(null)
    onClose({ reissued: true })
  }

  const handleDialogClose = () => {
    if (reissue.isPending) return
    onClose({ reissued: false })
  }

  const handleOpenChange = (isOpen) => {
    if (!isOpen) handleDialogClose()
  }

  const loading = open && !!invoice?.id && (detailQuery.isLoading || initBusy)

  return (
    <>
      <Dialog
        isOpen={open}
        onOpenChange={handleOpenChange}
        purpose="form"
        width={960}
        maxHeight="90dvh"
      >
        <Layout
          height="fill"
          padding={4}
          header={<DialogHeader title="請求書を修正して再発行" onOpenChange={handleOpenChange} />}
          content={
            <LayoutContent>
              <VStack gap={3}>
                {loading ? (
                  <Center padding={4}>
                    <Spinner />
                  </Center>
                ) : null}

                {detailQuery.error ? (
                  <Banner
                    status="error"
                    title={`明細の取得に失敗: ${detailQuery.error.message}`}
                    collapsible={false}
                  />
                ) : null}

                {error ? (
                  <Banner
                    status="error"
                    title={error}
                    isDismissable
                    onDismiss={() => setError(null)}
                    collapsible={false}
                  />
                ) : null}

                {!loading && !detailQuery.error ? (
                  <VStack gap={3}>
                    <Banner
                      status="info"
                      title="明細を直して「再発行」すると、現行の請求書を取消して新しい PDF を発行します。入金済みは修正できません。"
                      collapsible={false}
                    />
                    {otherUnbilledCount > 0 ? (
                      <Banner
                        status="info"
                        title={`同月・同取引先に未請求売掛が ${otherUnbilledCount} 件あります。それらはこの再発行には含めず、「新規発行」から都度請求できます。`}
                        collapsible={false}
                      />
                    ) : null}

                    <HStack gap={3} wrap="wrap" vAlign="end">
                      <Text>
                        取引先: <Text weight="semibold">{companyName}</Text>
                      </Text>
                      <Text>
                        対象月:{' '}
                        <Text weight="semibold">
                          {year} 年 {month} 月
                        </Text>
                      </Text>
                      <Text>
                        件数: <Text weight="semibold">{lines.length}</Text>
                      </Text>
                      <Text>
                        合計: <Text weight="semibold">¥{totalAmount.toLocaleString('ja-JP')}</Text>
                      </Text>
                      <DateInput
                        label="発行日"
                        value={issueDate || undefined}
                        onChange={(next) => setIssueDate(next ?? '')}
                        format="system_date"
                        size="sm"
                        weekStartsOn="mon"
                        isRequired
                        status={
                          issueDate && !issueDateValid
                            ? { type: 'error', message: '日付が不正です' }
                            : undefined
                        }
                      />
                    </HStack>

                    {isOverflow ? (
                      <Banner
                        status="warning"
                        title={`明細が ${INVOICE_MAX_LINES} 件を超えています。再発行時の戦略を選択してください。`}
                        collapsible={false}
                      >
                        <RadioList
                          label="再発行戦略"
                          isLabelHidden
                          value={strategy}
                          onChange={setStrategy}
                          orientation="horizontal"
                          size="sm"
                        >
                          <RadioListItem
                            value={STRATEGIES.MERGE}
                            label={STRATEGY_LABEL[STRATEGIES.MERGE]}
                          />
                          <RadioListItem
                            value={STRATEGIES.SPLIT}
                            label={STRATEGY_LABEL[STRATEGIES.SPLIT]}
                          />
                        </RadioList>
                      </Banner>
                    ) : null}

                    <div
                      style={{
                        width: '100%',
                        overflowX: 'auto',
                        WebkitOverflowScrolling: 'touch',
                      }}
                    >
                      <Table density="compact" hasHover>
                        <TableHeader>
                          <TableRow isHeaderRow>
                            <TableHeaderCell style={{ minWidth: 148 }}>日付</TableHeaderCell>
                            <TableHeaderCell style={{ minWidth: 100 }}>号車</TableHeaderCell>
                            <TableHeaderCell style={{ minWidth: 120 }}>出発</TableHeaderCell>
                            <TableHeaderCell style={{ minWidth: 120 }}>到着</TableHeaderCell>
                            <TableHeaderCell style={{ minWidth: 112 }}>金額</TableHeaderCell>
                            <TableHeaderCell style={{ minWidth: 140 }}>備考</TableHeaderCell>
                            <TableHeaderCell style={{ width: 48, minWidth: 48 }} />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((line, idx) => {
                            const { errors } = lineValidations[idx]
                            return (
                              <TableRow key={line.key}>
                                <TableCell style={{ minWidth: 148 }}>
                                  <DateInput
                                    label="日付"
                                    isLabelHidden
                                    value={line.work_date || undefined}
                                    onChange={(work_date) =>
                                      updateLine(line.key, { work_date: work_date ?? '' })
                                    }
                                    min={monthBound(year, month, '01')}
                                    max={monthBound(year, month, '31')}
                                    size="sm"
                                    width="100%"
                                    status={
                                      errors.work_date
                                        ? { type: 'error', message: errors.work_date }
                                        : undefined
                                    }
                                  />
                                </TableCell>
                                <TableCell style={{ minWidth: 100 }}>
                                  <VehicleNumSelect
                                    value={line.vehicle_num}
                                    onChange={(vehicle_num) =>
                                      updateLine(line.key, { vehicle_num })
                                    }
                                    isLabelHidden
                                  />
                                </TableCell>
                                <TableCell style={{ minWidth: 120 }}>
                                  <TextInput
                                    label="出発地"
                                    isLabelHidden
                                    size="sm"
                                    value={line.departure}
                                    onChange={(departure) => updateLine(line.key, { departure })}
                                    placeholder="出発地"
                                    width="100%"
                                  />
                                </TableCell>
                                <TableCell style={{ minWidth: 120 }}>
                                  <TextInput
                                    label="到着地"
                                    isLabelHidden
                                    size="sm"
                                    value={line.destination}
                                    onChange={(destination) =>
                                      updateLine(line.key, { destination })
                                    }
                                    placeholder="到着地"
                                    width="100%"
                                  />
                                </TableCell>
                                <TableCell style={{ minWidth: 112 }}>
                                  <AmountInput
                                    value={line.amount}
                                    onChange={(amount) => updateLine(line.key, { amount })}
                                    isLabelHidden
                                  />
                                </TableCell>
                                <TableCell style={{ minWidth: 140 }}>
                                  <TextInput
                                    label="備考"
                                    isLabelHidden
                                    size="sm"
                                    value={line.note}
                                    onChange={(note) => updateLine(line.key, { note })}
                                    placeholder="備考"
                                    width="100%"
                                  />
                                </TableCell>
                                <TableCell style={{ width: 48, minWidth: 48 }}>
                                  <Center>
                                    <IconButton
                                      size="sm"
                                      variant="destructive"
                                      label="行を削除"
                                      tooltip="行を削除"
                                      icon={<Trash2 />}
                                      onClick={() => handleDeleteLine(line)}
                                    />
                                  </Center>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                          {lines.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7}>
                                <Banner
                                  status="warning"
                                  title="明細がありません。行を追加するか、ダイアログを閉じてください。"
                                  collapsible={false}
                                />
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>

                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Plus />}
                      label="行を追加"
                      onClick={handleAddLine}
                    />
                  </VStack>
                ) : null}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="between" wrap="wrap">
                <Button
                  label="キャンセル"
                  variant="secondary"
                  onClick={handleDialogClose}
                  isDisabled={reissue.isPending}
                />
                <HStack gap={2} wrap="wrap">
                  <Button
                    variant="secondary"
                    icon={<Eye />}
                    label="プレビュー"
                    onClick={handlePreview}
                    isDisabled={loading || previewBusy || reissue.isPending || !canSubmit}
                    isLoading={previewBusy}
                  />
                  <Button
                    variant="primary"
                    icon={<RefreshCw />}
                    label={reissue.isPending ? '再発行中…' : '再発行'}
                    onClick={handleReissue}
                    isDisabled={loading || reissue.isPending || !canSubmit}
                    isLoading={reissue.isPending}
                  />
                </HStack>
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <InvoicePreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        companyName={previewData?.companyName}
        previews={previewData?.previews}
      />

      {result ? (
        <InvoiceIssueResultDialog
          open={resultOpen}
          result={result}
          onClose={handleResultClose}
          year={year}
          month={month}
        />
      ) : null}
    </>
  )
}
