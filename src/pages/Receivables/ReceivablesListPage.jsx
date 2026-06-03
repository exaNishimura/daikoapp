import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DownloadIcon from '@mui/icons-material/Download'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { MonthPicker } from '@/components/Receivables/MonthPicker'
import { fromMonthString, toMonthString } from '@/components/Receivables/monthUtils'
import { CompanySelect } from '@/components/Receivables/CompanySelect'
import { useCompanies } from '@/hooks/billing/useCompanies'
import {
  useCreateReceivable,
  useDeleteReceivable,
  useReceivables,
  useUpdateReceivable,
} from '@/hooks/billing/useReceivables'
import { buildReceivablesCsv } from '@/lib/billing/exportReceivablesCsv'
import { summarizeReceivables } from '@/lib/billing/receivablesSummary'
import { ReceivablesTable } from './ReceivablesTable'
import { ReceivablesAddRow } from './ReceivablesAddRow'

function currentYearMonth() {
  const d = new Date()
  return toMonthString(d) ?? '2026-01'
}

function downloadTextFile(filename, content, mimeType = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function ReceivablesListPage() {
  const navigate = useNavigate()

  const [monthValue, setMonthValue] = useState(currentYearMonth)
  const [companyId, setCompanyId] = useState(null)
  const [invoicedFilter, setInvoicedFilter] = useState('all') // all | billed | unbilled
  const [paidFilter, setPaidFilter] = useState('all') // all | paid | unpaid
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const parsedMonth = fromMonthString(monthValue) ?? { year: 2026, month: 1 }
  const { year, month } = parsedMonth

  const invoicedFlag =
    invoicedFilter === 'billed' ? true : invoicedFilter === 'unbilled' ? false : undefined

  const companiesQuery = useCompanies()
  const receivablesQuery = useReceivables({
    year,
    month,
    companyId: companyId ?? undefined,
    invoiced: invoicedFlag,
  })
  const createMutation = useCreateReceivable()
  const updateMutation = useUpdateReceivable()
  const deleteMutation = useDeleteReceivable()

  const allCompanies = companiesQuery.data ?? []

  const rows = useMemo(() => {
    const rawRows = receivablesQuery.data ?? []
    let filtered = rawRows
    if (paidFilter === 'paid') {
      filtered = filtered.filter((r) => r.invoices?.paid_at)
    } else if (paidFilter === 'unpaid') {
      filtered = filtered.filter((r) => !r.invoices?.paid_at)
    }
    return [...filtered].sort((a, b) => {
      const cmp = String(b.work_date).localeCompare(String(a.work_date))
      if (cmp !== 0) return cmp
      return (b.id ?? 0) - (a.id ?? 0)
    })
  }, [receivablesQuery.data, paidFilter])

  const summary = useMemo(() => summarizeReceivables(rows), [rows])

  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  const handleCreate = async (payload) => {
    setError(null)
    try {
      await createMutation.mutateAsync(payload)
      setSuccess('売掛を追加しました')
    } catch (err) {
      setError(`追加に失敗: ${err.message}`)
      throw err
    }
  }

  const handleUpdate = async (payload, row) => {
    setError(null)
    try {
      await updateMutation.mutateAsync({ id: row.id, payload })
      setSuccess('売掛を更新しました')
    } catch (err) {
      setError(`更新に失敗: ${err.message}`)
      throw err
    }
  }

  const handleDelete = async (row) => {
    if (row.invoice_id != null) {
      setError('請求書発行済みの売掛は削除できません。先に請求書を取り消してください')
      return
    }
    if (
      !confirm(
        `${row.work_date} / ${row.companies?.name ?? ''} / ¥${Number(
          row.amount ?? 0
        ).toLocaleString('ja-JP')} を削除しますか？`
      )
    ) {
      return
    }
    setError(null)
    try {
      await deleteMutation.mutateAsync(row.id)
      setSuccess('売掛を削除しました')
    } catch (err) {
      setError(`削除に失敗: ${err.message}`)
    }
  }

  const handleExportCsv = () => {
    const csv = buildReceivablesCsv(rows)
    const ym = `${year}${String(month).padStart(2, '0')}`
    downloadTextFile(`receivables-${ym}.csv`, csv)
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(-1)} aria-label="戻る">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            売掛一覧
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="text"
            size="small"
            startIcon={<UploadFileIcon />}
            onClick={() => navigate('/admin/receivables/import')}
          >
            Excel インポート
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportCsv}
            disabled={receivablesQuery.isLoading || rows.length === 0}
          >
            CSV エクスポート
          </Button>
        </Stack>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
          <MonthPicker value={monthValue} onChange={setMonthValue} label="対象月" />
          <Box sx={{ minWidth: 220 }}>
            <CompanySelect
              companies={allCompanies}
              value={companyId}
              onChange={setCompanyId}
              includeInactive
              label="取引先 (全て)"
            />
          </Box>
          <TextField
            select
            size="small"
            label="請求状態"
            value={invoicedFilter}
            onChange={(e) => setInvoicedFilter(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="all">全て</MenuItem>
            <MenuItem value="unbilled">未請求のみ</MenuItem>
            <MenuItem value="billed">請求済のみ</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="入金状態"
            value={paidFilter}
            onChange={(e) => setPaidFilter(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="all">全て</MenuItem>
            <MenuItem value="paid">入金済のみ</MenuItem>
            <MenuItem value="unpaid">未入金のみ</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={3} divider={<Divider orientation="vertical" flexItem />}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              件数
            </Typography>
            <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {summary.count}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              合計金額
            </Typography>
            <Typography variant="h6" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              ¥{summary.totalAmount.toLocaleString('ja-JP')}
            </Typography>
          </Box>
          {summary.byCompany.length > 0 && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                企業別合計 (上位)
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                {summary.byCompany.slice(0, 6).map((c) => (
                  <Box
                    key={c.companyId}
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: 'action.selected',
                      fontSize: 13,
                    }}
                  >
                    {c.companyName} ×{c.count} / ¥{c.total.toLocaleString('ja-JP')}
                  </Box>
                ))}
                {summary.byCompany.length > 6 && (
                  <Typography variant="caption" color="text.secondary">
                    ...他 {summary.byCompany.length - 6} 社
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {receivablesQuery.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          売掛データの取得に失敗: {receivablesQuery.error.message}
        </Alert>
      )}

      <ReceivablesAddRow
        companies={allCompanies}
        year={year}
        month={month}
        onCreate={handleCreate}
        isSaving={createMutation.isPending}
      />

      <ReceivablesTable
        rows={rows}
        companies={allCompanies}
        options={{ year, month }}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        isSaving={isMutating}
      />
    </Box>
  )
}
