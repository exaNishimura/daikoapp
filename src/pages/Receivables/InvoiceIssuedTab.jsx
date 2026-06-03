import { useState } from 'react'
import Box from '@mui/material/Box'
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
import {
  useInvoices,
  useDownloadInvoice,
  useMarkInvoicePaid,
  useRevokeInvoice,
} from '@/hooks/billing/useInvoices'

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

export function InvoiceIssuedTab({ year, month }) {
  const invoicesQuery = useInvoices({ year, month })
  const dlInvoice = useDownloadInvoice()
  const markPaid = useMarkInvoicePaid()
  const revoke = useRevokeInvoice()
  const [error, setError] = useState(null)

  const rows = invoicesQuery.data ?? []

  const handleTogglePaid = async (row) => {
    setError(null)
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
    if (!window.confirm(`「${row.companies?.name}」の ${fmtMonth(row.billing_month)} 請求書を取消します。よろしいですか?`)) {
      return
    }
    setError(null)
    try {
      await revoke.mutateAsync(row.id)
    } catch (err) {
      setError(`取消に失敗: ${err.message}`)
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
        displayName:
          row.companies?.invoice_display_name || row.companies?.name || null,
      })
    } catch (err) {
      setError(`ダウンロードに失敗: ${err.message}`)
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
                    <IconButton
                      size="small"
                      onClick={() => handleDownload(r)}
                      disabled={!r.file_path || dlInvoice.isPending}
                      aria-label="ダウンロード"
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRevoke(r)}
                      disabled={!!r.paid_at || revoke.isPending}
                      aria-label="取消"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
