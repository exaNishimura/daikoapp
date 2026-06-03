import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import CloseIcon from '@mui/icons-material/Close'
import { AmountInput } from '@/components/Receivables/AmountInput'

const DEFAULT_LABELS = ['共済掛金', '損害保険', '駐車場', '携帯', '税理士']

/**
 * 月額固定経費パネル。
 * - label + amount のリストで CRUD
 * - 月初表示時はデフォルトラベルを quick-add する選択肢として提示
 *
 * @param {Object} props
 * @param {string} props.billingMonth   'YYYY-MM-01'
 * @param {Array} props.rows
 * @param {(payload) => Promise} props.onUpsert
 * @param {(id) => Promise} props.onDelete
 */
export function MonthlyFixedExpensesPanel({ billingMonth, rows, onUpsert, onDelete }) {
  const sorted = useMemo(
    () => [...(rows ?? [])].sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),
    [rows]
  )

  const total = useMemo(
    () => sorted.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [sorted]
  )

  const usedLabels = useMemo(() => new Set(sorted.map((r) => r.label)), [sorted])
  const quickAdds = DEFAULT_LABELS.filter((l) => !usedLabels.has(l))

  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ label: '', amount: 0 })

  const handleAdd = async () => {
    if (!draft.label.trim()) return
    await onUpsert({
      billing_month: billingMonth,
      label: draft.label.trim(),
      amount: Number(draft.amount) || 0,
    })
    setDraft({ label: '', amount: 0 })
    setAdding(false)
  }

  const handleQuickAdd = async (label) => {
    await onUpsert({ billing_month: billingMonth, label, amount: 0 })
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6">月額固定経費</Typography>
        <Typography variant="body2" color="text.secondary">
          合計 ¥{total.toLocaleString('ja-JP')}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {sorted.map((row) => (
          <FixedExpenseRow
            key={row.id ?? row.label}
            row={row}
            billingMonth={billingMonth}
            onUpsert={onUpsert}
            onDelete={onDelete}
          />
        ))}

        {sorted.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            固定経費がまだ登録されていません
          </Typography>
        )}
      </Box>

      {quickAdds.length > 0 && !adding && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
            よく使う項目:
          </Typography>
          {quickAdds.map((label) => (
            <Button
              key={label}
              size="small"
              variant="outlined"
              sx={{ mr: 0.5, mb: 0.5 }}
              onClick={() => handleQuickAdd(label)}
              startIcon={<AddIcon />}
            >
              {label}
            </Button>
          ))}
        </Box>
      )}

      <Box sx={{ mt: 2 }}>
        {!adding ? (
          <Button size="small" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
            カスタム項目を追加
          </Button>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              label="項目名"
              size="small"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              sx={{ flex: 1 }}
            />
            <AmountInput
              value={draft.amount}
              onChange={(v) => setDraft({ ...draft, amount: v ?? 0 })}
              label="金額"
            />
            <IconButton size="small" color="primary" onClick={handleAdd} disabled={!draft.label.trim()}>
              <SaveIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setAdding(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>
    </Paper>
  )
}

function FixedExpenseRow({ row, billingMonth, onUpsert, onDelete }) {
  const handleChange = (v) => {
    const next = v ?? 0
    if (next === (row.amount ?? 0)) return
    onUpsert({
      id: row.id,
      billing_month: billingMonth,
      label: row.label,
      amount: next,
    })
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <Box sx={{ flex: 1 }}>{row.label}</Box>
      <AmountInput value={row.amount ?? 0} onChange={handleChange} label="金額" />
      <IconButton size="small" color="error" onClick={() => onDelete(row.id)} aria-label="削除">
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}
