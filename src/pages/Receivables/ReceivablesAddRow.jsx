import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import SaveIcon from '@mui/icons-material/Save'
import CloseIcon from '@mui/icons-material/Close'
import { CompanySelect } from '@/components/Receivables/CompanySelect'
import { AmountInput } from '@/components/Receivables/AmountInput'
import {
  EMPTY_RECEIVABLE_FORM,
  toBillingMonthFromWorkDate,
  validateReceivableForm,
} from '@/lib/billing/receivableForm'

function defaultWorkDate(year, month) {
  const today = new Date()
  const isCurrent = today.getFullYear() === year && today.getMonth() + 1 === month
  const day = isCurrent ? today.getDate() : 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * 売掛の新規追加行 (インライン)。
 * - 「行追加」ボタンを押すとフォームが展開
 * - 保存後はリセットして連続入力できるようにする
 */
export function ReceivablesAddRow({ companies, year, month, onCreate, isSaving }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(() => ({
    ...EMPTY_RECEIVABLE_FORM,
    work_date: defaultWorkDate(year, month),
  }))

  const { errors, isValid } = useMemo(
    () => validateReceivableForm(form, { year, month }),
    [form, year, month]
  )

  const reset = () => {
    setForm((prev) => ({
      ...EMPTY_RECEIVABLE_FORM,
      work_date: defaultWorkDate(year, month),
      company_id: prev.company_id, // 連続入力で同じ取引先を保持
    }))
  }

  const handleOpen = () => {
    setOpen(true)
    setForm({
      ...EMPTY_RECEIVABLE_FORM,
      work_date: defaultWorkDate(year, month),
    })
  }

  const handleClose = () => {
    setOpen(false)
  }

  const handleSave = async () => {
    if (!isValid) return
    const payload = {
      company_id: form.company_id,
      work_date: form.work_date,
      billing_month: toBillingMonthFromWorkDate(form.work_date),
      departure: form.departure?.trim() || null,
      destination: form.destination?.trim() || null,
      amount: Number(form.amount) || 0,
      note: form.note?.trim() || null,
      source_file: null,
    }
    try {
      await onCreate(payload)
      reset()
    } catch {
      /* error は呼び出し側で表示 */
    }
  }

  if (!open) {
    return (
      <Button startIcon={<AddIcon />} onClick={handleOpen} variant="outlined" sx={{ mb: 2 }}>
        売掛を追加
      </Button>
    )
  }

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 1,
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          新規追加 — {year}年{month}月
        </Typography>
        <IconButton size="small" onClick={handleClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: 'repeat(12, 1fr)',
          alignItems: 'start',
        }}
      >
        <TextField
          type="date"
          label="日付"
          size="small"
          value={form.work_date}
          onChange={(e) => setForm({ ...form, work_date: e.target.value })}
          error={!!errors.work_date}
          helperText={errors.work_date}
          inputProps={{
            min: `${year}-${String(month).padStart(2, '0')}-01`,
            max: `${year}-${String(month).padStart(2, '0')}-31`,
          }}
          sx={{ gridColumn: 'span 3' }}
        />
        <Box sx={{ gridColumn: 'span 5' }}>
          <CompanySelect
            companies={companies}
            value={form.company_id}
            onChange={(id) => setForm({ ...form, company_id: id })}
          />
          {errors.company_id && (
            <Typography variant="caption" color="error">
              {errors.company_id}
            </Typography>
          )}
        </Box>
        <AmountInput
          value={form.amount}
          onChange={(v) => setForm({ ...form, amount: v })}
          label="金額"
          sx={{ gridColumn: 'span 4' }}
        />
        <TextField
          label="出発"
          size="small"
          value={form.departure}
          onChange={(e) => setForm({ ...form, departure: e.target.value })}
          sx={{ gridColumn: 'span 3' }}
        />
        <TextField
          label="到着"
          size="small"
          value={form.destination}
          onChange={(e) => setForm({ ...form, destination: e.target.value })}
          sx={{ gridColumn: 'span 3' }}
        />
        <TextField
          label="備考"
          size="small"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          sx={{ gridColumn: 'span 6' }}
        />
        <Box sx={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={handleClose} disabled={isSaving}>
            閉じる
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!isValid || isSaving}
          >
            {isSaving ? '保存中...' : '保存して続けて入力'}
          </Button>
        </Box>
      </Box>
    </Paper>
  )
}
