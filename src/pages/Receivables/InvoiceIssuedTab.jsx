import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import DownloadIcon from '@mui/icons-material/Download'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import FolderZipIcon from '@mui/icons-material/FolderZip'
import ReplayIcon from '@mui/icons-material/Replay'
import Tooltip from '@mui/material/Tooltip'
import {
  useInvoices,
  useDownloadInvoice,
  useMarkInvoicePaid,
  useRevokeInvoice,
} from '@/hooks/billing/useInvoices'
import { downloadInvoicesZip } from '@/lib/billing/downloadInvoicesZip'
import { InvoiceReissueDialog } from './InvoiceReissueDialog'

function fmtMonth(billingMonth) {
  if (!billingMonth) return ''
  const m = String(billingMonth).match(/^(\d{4})-(\d{2})/)
  return m ? `${m[1]}年${m[2]}月` : billingMonth
}

function fmtDate(s) {
  if (!s) return '—'
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}/${m[2]}/${m[3]}` : s
}

/** 発行時と同じ命名: `YYYYMM_会社名様_請求書_#id`（同月複数枚を区別） */
function invoiceDisplayName(row, year, month) {
  const ymPrefix = `${year}${String(month).padStart(2, '0')}`
  const baseName =
    row.companies?.invoice_display_name || row.companies?.name || `company-${row.company_id}`
  return `${ymPrefix}_${baseName}様_請求書_#${row.id}`
}

export function InvoiceIssuedTab({ year, month }) {
  const invoicesQuery = useInvoices({ year, month })
  const dlInvoice = useDownloadInvoice()
  const markPaid = useMarkInvoicePaid()
  const revoke = useRevokeInvoice()
  const [error, setError] = useState(null)
  const [zipWarning, setZipWarning] = useState(null)
  const [zipBusy, setZipBusy] = useState(false)
  const [reissueTarget, setReissueTarget] = useState(null)

  const rows = invoicesQuery.data ?? []
  const downloadableCount = rows.filter((r) => r.file_path).length

  const clearAlerts = () => {
    setError(null)
    setZipWarning(null)
  }

  const handleTogglePaid = async (row) => {
    clearAlerts()
    try {
      await markPaid.mutateAsync({
        id: row.id,
        paidAt: row.paid_at ? null : new Date(),
      })
    } catch (err) {
      setError(`入金状態の更新に失敗: ${err.message}`)
    }
  }

  const handleRevoke = async (row) => {
    if (
      !window.confirm(
        `「${row.companies?.name}」の ${fmtMonth(row.billing_month)} 請求書（#${row.id}）を取消します。よろしいですか?`
      )
    ) {
      return
    }
    clearAlerts()
    try {
      await revoke.mutateAsync(row.id)
    } catch (err) {
      setError(`取消に失敗: ${err.message}`)
    }
  }

  const handleDownload = async (row) => {
    clearAlerts()
    if (!row.file_path) {
      setError('この請求書には Storage ファイルが紐づいていません')
      return
    }
    try {
      await dlInvoice.mutateAsync({
        filePath: row.file_path,
        displayName: invoiceDisplayName(row, year, month),
      })
    } catch (err) {
      setError(`ダウンロードに失敗: ${err.message}`)
    }
  }

  const handleZipDownload = async () => {
    clearAlerts()
    setZipBusy(true)
    try {
      const { included, skipped } = await downloadInvoicesZip(
        rows.map((r) => ({
          filePath: r.file_path,
          displayName: invoiceDisplayName(r, year, month),
        })),
        `invoices-${year}${String(month).padStart(2, '0')}`
      )
      if (skipped > 0) {
        setZipWarning(
          `${included} 件を zip に含めました（${skipped} 件はファイルなし／取得失敗のためスキップ）`
        )
      }
    } catch (err) {
      setError(`一括ダウンロードに失敗: ${err.message}`)
    } finally {
      setZipBusy(false)
    }
  }

  if (invoicesQuery.isLoading) return <CircularProgress />

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {zipWarning && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setZipWarning(null)}>
          {zipWarning}
        </Alert>
      )}
      {invoicesQuery.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          請求書の取得に失敗: {invoicesQuery.error.message}
        </Alert>
      )}

      {rows.length === 0 ? (
        <Alert severity="info">
          {year} 年 {month} 月の発行済請求書はありません。
        </Alert>
      ) : (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.5,
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {rows.length} 件
              {downloadableCount < rows.length ? `（うち DL 可 ${downloadableCount} 件）` : null}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={zipBusy ? <CircularProgress size={16} /> : <FolderZipIcon />}
              onClick={handleZipDownload}
              disabled={zipBusy || downloadableCount === 0}
            >
              {zipBusy ? 'zip 生成中…' : '全件 zip で DL'}
            </Button>
          </Box>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>請求月</TableCell>
                  <TableCell>取引先</TableCell>
                  <TableCell>発行日</TableCell>
                  <TableCell align="right">件数</TableCell>
                  <TableCell align="right">金額</TableCell>
                  <TableCell align="center">入金</TableCell>
                  <TableCell align="center">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>{fmtMonth(r.billing_month)}</TableCell>
                    <TableCell>{r.companies?.invoice_display_name || r.companies?.name}</TableCell>
                    <TableCell>{fmtDate(r.issue_date)}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {r.line_count}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      ¥{Number(r.total_amount).toLocaleString('ja-JP')}
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={!!r.paid_at}
                        onChange={() => handleTogglePaid(r)}
                        disabled={markPaid.isPending}
                      />
                      {r.paid_at && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {fmtDate(r.paid_at.slice(0, 10))}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="ダウンロード">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleDownload(r)}
                            disabled={!r.file_path || dlInvoice.isPending || zipBusy}
                            aria-label="ダウンロード"
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip
                        title={
                          r.paid_at ? '入金済みのため修正不可（先に入金解除）' : '修正して再発行'
                        }
                      >
                        <span>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => setReissueTarget(r)}
                            disabled={!!r.paid_at || revoke.isPending || zipBusy}
                            aria-label="修正して再発行"
                          >
                            <ReplayIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title={r.paid_at ? '入金済みのため取消不可' : '取消'}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRevoke(r)}
                            disabled={!!r.paid_at || revoke.isPending || zipBusy}
                            aria-label="取消"
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <InvoiceReissueDialog
        open={!!reissueTarget}
        invoice={reissueTarget}
        year={year}
        month={month}
        onClose={() => setReissueTarget(null)}
      />
    </Box>
  )
}
