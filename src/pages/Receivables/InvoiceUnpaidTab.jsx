import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import DownloadIcon from '@mui/icons-material/Download'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import {
  useUnpaidInvoices,
  useDownloadInvoice,
  useMarkInvoicePaid,
} from '@/hooks/billing/useInvoices'
import { daysOverdue, summarizeUnpaidInvoices } from '@/lib/billing/invoiceAging'

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

export function InvoiceUnpaidTab() {
  const query = useUnpaidInvoices()
  const dlInvoice = useDownloadInvoice()
  const markPaid = useMarkInvoicePaid()
  const [error, setError] = useState(null)

  const rows = useMemo(() => query.data ?? [], [query.data])
  const today = useMemo(() => new Date(), [])

  const summary = useMemo(() => summarizeUnpaidInvoices(rows, today), [rows, today])

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => new Date(a.billing_month) - new Date(b.billing_month)),
    [rows]
  )

  const handleMarkPaid = async (row) => {
    setError(null)
    try {
      await markPaid.mutateAsync({ id: row.id, paidAt: new Date() })
    } catch (err) {
      setError(`入金記録の更新に失敗: ${err.message}`)
    }
  }

  const handleDownload = async (row) => {
    setError(null)
    if (!row.file_path) {
      setError('この請求書には Storage ファイルが紐づいていません')
      return
    }
    try {
      await dlInvoice.mutateAsync({
        filePath: row.file_path,
        displayName: row.companies?.invoice_display_name || row.companies?.name || null,
      })
    } catch (err) {
      setError(`ダウンロードに失敗: ${err.message}`)
    }
  }

  if (query.isLoading) return <CircularProgress />

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {query.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          未入金請求書の取得に失敗: {query.error.message}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          未入金サマリ
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 2,
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">
              総未収金額
            </Typography>
            <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              ¥{summary.total_unpaid.toLocaleString('ja-JP')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              件数
            </Typography>
            <Typography variant="h6">{summary.invoice_count}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              平均滞留日数
            </Typography>
            <Typography variant="h6">{summary.average_days_overdue} 日</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              60 日超アラート
            </Typography>
            <Typography
              variant="h6"
              color={summary.over_60_count > 0 ? 'error.main' : 'text.primary'}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              {summary.over_60_count > 0 && <ErrorOutlineIcon fontSize="small" />}
              {summary.over_60_count} 件
            </Typography>
          </Box>
        </Box>

        {summary.by_company.length > 0 && (
          <>
            <Divider sx={{ my: 1 }}>企業別未収金</Divider>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 1.5,
              }}
            >
              {summary.by_company.map((c) => (
                <Box
                  key={c.company_id}
                  sx={{
                    p: 1.5,
                    bgcolor: c.max_days_overdue > 60 ? 'error.50' : 'action.selected',
                    borderRadius: 1,
                    border: c.max_days_overdue > 60 ? '1px solid' : 'none',
                    borderColor: 'error.main',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {c.invoice_display_name || c.company_name}
                  </Typography>
                  <Typography sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    ¥{c.total_unpaid.toLocaleString('ja-JP')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {c.invoice_count} 件 · 最長 {c.max_days_overdue} 日
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Paper>

      {sortedRows.length === 0 ? (
        <Alert severity="success">未入金の請求書はありません。</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>請求月</TableCell>
                <TableCell>取引先</TableCell>
                <TableCell>発行日</TableCell>
                <TableCell align="right">金額</TableCell>
                <TableCell align="right">滞留日数</TableCell>
                <TableCell align="center">入金済</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRows.map((r) => {
                const days = daysOverdue(r.issue_date, today) ?? 0
                const overdue = days > 60
                return (
                  <TableRow key={r.id} hover sx={{ bgcolor: overdue ? 'error.50' : undefined }}>
                    <TableCell>{fmtMonth(r.billing_month)}</TableCell>
                    <TableCell>{r.companies?.invoice_display_name || r.companies?.name}</TableCell>
                    <TableCell>{fmtDate(r.issue_date)}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      ¥{Number(r.total_amount).toLocaleString('ja-JP')}
                    </TableCell>
                    <TableCell align="right">
                      {overdue ? (
                        <Chip
                          label={`${days} 日`}
                          size="small"
                          color="error"
                          icon={<ErrorOutlineIcon />}
                        />
                      ) : (
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{days} 日</span>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Checkbox
                        checked={false}
                        onChange={() => handleMarkPaid(r)}
                        disabled={markPaid.isPending}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleDownload(r)}
                        disabled={!r.file_path || dlInvoice.isPending}
                        aria-label="ダウンロード"
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
