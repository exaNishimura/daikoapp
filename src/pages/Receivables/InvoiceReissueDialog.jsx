import { useEffect, useMemo, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import FormControlLabel from '@mui/material/FormControlLabel'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Paper from '@mui/material/Paper'
import Tooltip from '@mui/material/Tooltip'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ReplayIcon from '@mui/icons-material/Replay'
import { AmountInput } from '@/components/Receivables/AmountInput'
import { VehicleNumSelect } from '@/components/Receivables/VehicleNumSelect'
import { useInvoice, useReissueInvoice } from '@/hooks/billing/useInvoices'
import { getCompanyProfile } from '@/services/billing/companyProfileService'
import { getReceivables } from '@/services/billing/receivablesService'
import { generateInvoicePdf } from '@/lib/pdf/generateInvoicePdf'
import { resolveIssueDate } from '@/lib/excel/formatters'
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
  const [extraUnbilledCount, setExtraUnbilledCount] = useState(0)
  const [initializedFor, setInitializedFor] = useState(null)
  const [initBusy, setInitBusy] = useState(false)

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [previewBusy, setPreviewBusy] = useState(false)

  const [resultOpen, setResultOpen] = useState(false)
  const [result, setResult] = useState(null)

  const companyId = invoice?.company_id
  const companyName =
    invoice?.companies?.invoice_display_name ||
    invoice?.companies?.name ||
    `企業 #${companyId}`

  // 明細ロード完了時にドラフト初期化
  // 発行済み明細 + 同月同社の未請求 (発行後に追加された行) をマージ
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

        const byId = new Map()
        for (const row of linked) byId.set(row.id, row)
        let extra = 0
        for (const row of unbilled ?? []) {
          if (!byId.has(row.id)) {
            byId.set(row.id, row)
            extra += 1
          }
        }

        const merged = [...byId.values()].sort((a, b) =>
          String(a.work_date).localeCompare(String(b.work_date))
        )
        if (cancelled) return
        setLines(merged.map(rowToDraft))
        setDeletedIds([])
        setStrategy(recommendedStrategy(merged.length))
        setExtraUnbilledCount(extra)
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
  }, [open, invoice?.id, invoice?.company_id, detailQuery.data, year, month, initializedFor])

  // 閉じたら初期化フラグをリセット
  useEffect(() => {
    if (!open) {
      setInitializedFor(null)
      setExtraUnbilledCount(0)
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

  const allValid =
    lines.length > 0 && lineValidations.every((v) => v.isValid)
  const totalAmount = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  const isOverflow = lines.length > INVOICE_MAX_LINES

  const updateLine = (key, patch) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    )
  }

  const handleDeleteLine = (line) => {
    setLines((prev) => prev.filter((l) => l.key !== line.key))
    if (line.id != null) {
      setDeletedIds((prev) =>
        prev.includes(line.id) ? prev : [...prev, line.id]
      )
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
    setError(null)
    setPreviewBusy(true)
    try {
      const { data: profile, error: profileErr } = await getCompanyProfile()
      if (profileErr) throw profileErr

      const sorted = buildIssueLines()
        .slice()
        .sort((a, b) => String(a.work_date).localeCompare(String(b.work_date)))
      const chunks = expandByStrategy(sorted, strategy)
      const issueDate = resolveIssueDate(year, month)
      const previews = []

      for (const chunk of chunks) {
        const chunkTotal = chunk.lines.reduce(
          (s, x) => s + (Number(x.amount) || 0),
          0
        )
        const pdfBuf = await generateInvoicePdf(
          {
            issueDate,
            companyDisplayName:
              companyName +
              (chunk.sequence
                ? ` (${chunk.sequence.index}/${chunk.sequence.total})`
                : ''),
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
    if (
      !window.confirm(
        `「${companyName}」の請求書を取消し、編集内容で再発行します。よろしいですか?`
      )
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

  const loading =
    open && !!invoice?.id && (detailQuery.isLoading || initBusy)

  return (
    <>
      <Dialog
        open={open}
        onClose={handleDialogClose}
        maxWidth="lg"
        fullWidth
        aria-labelledby="invoice-reissue-title"
      >
        <DialogTitle id="invoice-reissue-title">
          請求書を修正して再発行
        </DialogTitle>
        <DialogContent dividers>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {detailQuery.error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              明細の取得に失敗: {detailQuery.error.message}
            </Alert>
          )}

          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          )}

          {!loading && !detailQuery.error && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                明細を直して「再発行」すると、現行の請求書を取消して新しい PDF
                を発行します。入金済みは修正できません。
              </Alert>
              {extraUnbilledCount > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  発行後に追加された未請求売掛が {extraUnbilledCount}{' '}
                  件あるため、明細に含めています。不要なら削除してから再発行してください。
                </Alert>
              )}

              <Box
                sx={{
                  display: 'flex',
                  gap: 3,
                  flexWrap: 'wrap',
                  mb: 2,
                  alignItems: 'baseline',
                }}
              >
                <Typography variant="body2">
                  取引先: <strong>{companyName}</strong>
                </Typography>
                <Typography variant="body2">
                  対象月:{' '}
                  <strong>
                    {year} 年 {month} 月
                  </strong>
                </Typography>
                <Typography variant="body2">
                  件数: <strong>{lines.length}</strong>
                </Typography>
                <Typography variant="body2">
                  合計:{' '}
                  <strong>¥{totalAmount.toLocaleString('ja-JP')}</strong>
                </Typography>
              </Box>

              {isOverflow && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  明細が {INVOICE_MAX_LINES} 件を超えています。再発行時の戦略を選択してください。
                  <RadioGroup
                    row
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                    sx={{ mt: 1 }}
                  >
                    <FormControlLabel
                      value={STRATEGIES.MERGE}
                      control={<Radio size="small" />}
                      label={STRATEGY_LABEL[STRATEGIES.MERGE]}
                    />
                    <FormControlLabel
                      value={STRATEGIES.SPLIT}
                      control={<Radio size="small" />}
                      label={STRATEGY_LABEL[STRATEGIES.SPLIT]}
                    />
                  </RadioGroup>
                </Alert>
              )}

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>日付</TableCell>
                      <TableCell sx={{ minWidth: 100 }}>号車</TableCell>
                      <TableCell>出発</TableCell>
                      <TableCell>到着</TableCell>
                      <TableCell align="right" sx={{ minWidth: 130 }}>
                        金額
                      </TableCell>
                      <TableCell>備考</TableCell>
                      <TableCell align="center" width={48} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lines.map((line, idx) => {
                      const { errors } = lineValidations[idx]
                      return (
                        <TableRow key={line.key} hover>
                          <TableCell>
                            <TextField
                              type="date"
                              size="small"
                              value={line.work_date}
                              onChange={(e) =>
                                updateLine(line.key, {
                                  work_date: e.target.value,
                                })
                              }
                              error={!!errors.work_date}
                              helperText={errors.work_date}
                              inputProps={{
                                min: `${year}-${String(month).padStart(2, '0')}-01`,
                                max: `${year}-${String(month).padStart(2, '0')}-31`,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <VehicleNumSelect
                              value={line.vehicle_num}
                              onChange={(vehicle_num) =>
                                updateLine(line.key, { vehicle_num })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={line.departure}
                              onChange={(e) =>
                                updateLine(line.key, {
                                  departure: e.target.value,
                                })
                              }
                              placeholder="出発地"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={line.destination}
                              onChange={(e) =>
                                updateLine(line.key, {
                                  destination: e.target.value,
                                })
                              }
                              placeholder="到着地"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <AmountInput
                              value={line.amount}
                              onChange={(amount) =>
                                updateLine(line.key, { amount })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              value={line.note}
                              onChange={(e) =>
                                updateLine(line.key, { note: e.target.value })
                              }
                              placeholder="備考"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="行を削除">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteLine(line)}
                                aria-label="行を削除"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {lines.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <Alert severity="warning">
                            明細がありません。行を追加するか、ダイアログを閉じてください。
                          </Alert>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 1.5 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddLine}
                >
                  行を追加
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={handleDialogClose} disabled={reissue.isPending}>
            キャンセル
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            startIcon={
              previewBusy ? <CircularProgress size={16} /> : <VisibilityIcon />
            }
            onClick={handlePreview}
            disabled={
              loading || previewBusy || reissue.isPending || !allValid
            }
          >
            プレビュー
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={
              reissue.isPending ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <ReplayIcon />
              )
            }
            onClick={handleReissue}
            disabled={loading || reissue.isPending || !allValid}
          >
            {reissue.isPending ? '再発行中…' : '再発行'}
          </Button>
        </DialogActions>
      </Dialog>

      <InvoicePreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        companyName={previewData?.companyName}
        previews={previewData?.previews}
      />

      {result && (
        <InvoiceIssueResultDialog
          open={resultOpen}
          result={result}
          onClose={handleResultClose}
          year={year}
          month={month}
        />
      )}
    </>
  )
}
