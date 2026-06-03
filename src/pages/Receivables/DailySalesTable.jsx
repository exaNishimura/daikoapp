import { useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import TableContainer from '@mui/material/TableContainer'
import Typography from '@mui/material/Typography'
import InputBase from '@mui/material/InputBase'
import { calcDailyDerived } from '@/lib/billing/dailySalesCalc'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function toDateString(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const EDITABLE_FIELDS = [
  { key: 'vehicle1_distance_km', label: '距離(1)', unit: 'km', type: 'number', step: 0.1 },
  { key: 'vehicle2_distance_km', label: '距離(2)', unit: 'km', type: 'number', step: 0.1 },
  { key: 'vehicle1_fuel_yen', label: '燃料(1)', unit: '¥', type: 'number', step: 1 },
  { key: 'vehicle2_fuel_yen', label: '燃料(2)', unit: '¥', type: 'number', step: 1 },
  { key: 'vehicle1_sales', label: '売上(1)', unit: '¥', type: 'number', step: 1 },
  { key: 'vehicle2_sales', label: '売上(2)', unit: '¥', type: 'number', step: 1 },
  { key: 'vehicle3_sales', label: '売上(3)', unit: '¥', type: 'number', step: 1 },
  { key: 'expense_note', label: '経費内容', type: 'text' },
  { key: 'expense_amount', label: '経費額', unit: '¥', type: 'number', step: 1 },
  { key: 'cash', label: '現金', unit: '¥', type: 'number', step: 1 },
]

function CellInput({ value, onChange, type, step }) {
  return (
    <InputBase
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      type={type}
      inputProps={{
        step,
        style: {
          textAlign: type === 'number' ? 'right' : 'left',
          fontVariantNumeric: 'tabular-nums',
          padding: '2px 4px',
        },
      }}
      sx={{ width: '100%', fontSize: 13 }}
    />
  )
}

/**
 * 1ヶ月分 (1〜末日) の日次売上をインライン編集するテーブル。
 * - 編集中の値は内部 `draft` state に保持
 * - 500ms 静止したら `onUpsert(payload)` に送る (debounce)
 * - total_sales / fuel_total / profit は派生表示 (DB は GENERATED 列)
 */
export function DailySalesTable({ year, month, rows, onUpsert }) {
  const totalDays = daysInMonth(year, month)
  const rowsByDate = useMemo(() => {
    const map = new Map()
    for (const r of rows ?? []) map.set(r.work_date, r)
    return map
  }, [rows])

  const [drafts, setDrafts] = useState({})

  const debouncedUpsert = useDebouncedCallback((payload) => {
    onUpsert(payload)
  }, 500)

  const pendingPayloads = useRef(new Map())

  const flush = (workDate) => {
    const payload = pendingPayloads.current.get(workDate)
    if (payload) debouncedUpsert(payload)
  }

  const handleChange = (workDate, field, raw) => {
    setDrafts((prev) => ({
      ...prev,
      [workDate]: { ...(prev[workDate] ?? {}), [field.key]: raw },
    }))

    const existing = rowsByDate.get(workDate) ?? {}
    const currentDraft = drafts[workDate] ?? {}
    const merged = { ...existing, ...currentDraft, [field.key]: raw }

    const payload = {
      work_date: workDate,
      vehicle1_distance_km: parseNum(merged.vehicle1_distance_km),
      vehicle2_distance_km: parseNum(merged.vehicle2_distance_km),
      vehicle1_fuel_yen: parseInt0(merged.vehicle1_fuel_yen),
      vehicle2_fuel_yen: parseInt0(merged.vehicle2_fuel_yen),
      vehicle1_sales: parseInt0(merged.vehicle1_sales) ?? 0,
      vehicle2_sales: parseInt0(merged.vehicle2_sales) ?? 0,
      vehicle3_sales: parseInt0(merged.vehicle3_sales) ?? 0,
      expense_note: merged.expense_note ?? null,
      expense_amount: parseInt0(merged.expense_amount) ?? 0,
      cash: parseInt0(merged.cash) ?? 0,
    }
    pendingPayloads.current.set(workDate, payload)
    flush(workDate)
  }

  const getCellValue = (workDate, fieldKey) => {
    const draft = drafts[workDate]
    if (draft && fieldKey in draft) return draft[fieldKey]
    const row = rowsByDate.get(workDate)
    return row?.[fieldKey] ?? ''
  }

  return (
    <TableContainer component={Paper}>
      <Table size="small" sx={{ '& td, & th': { px: 0.75, py: 0.5 } }}>
        <TableHead>
          <TableRow>
            <TableCell>日</TableCell>
            <TableCell>曜</TableCell>
            {EDITABLE_FIELDS.map((f) => (
              <TableCell key={f.key} align={f.type === 'number' ? 'right' : 'left'}>
                {f.label}
                {f.unit && ` (${f.unit})`}
              </TableCell>
            ))}
            <TableCell align="right">総売上</TableCell>
            <TableCell align="right">燃料計</TableCell>
            <TableCell align="right">推定収益</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
            const workDate = toDateString(year, month, day)
            const dow = new Date(year, month - 1, day).getDay()
            const isWeekend = dow === 0 || dow === 6
            const row = rowsByDate.get(workDate) ?? {}
            const merged = { ...row, ...(drafts[workDate] ?? {}) }
            const derived = calcDailyDerived({
              vehicle1_sales: parseInt0(merged.vehicle1_sales),
              vehicle2_sales: parseInt0(merged.vehicle2_sales),
              vehicle3_sales: parseInt0(merged.vehicle3_sales),
              vehicle1_fuel_yen: parseInt0(merged.vehicle1_fuel_yen),
              vehicle2_fuel_yen: parseInt0(merged.vehicle2_fuel_yen),
              expense_amount: parseInt0(merged.expense_amount),
            })
            return (
              <TableRow
                key={workDate}
                hover
                sx={{
                  bgcolor: dow === 0 ? 'rgba(255, 80, 80, 0.06)' : dow === 6 ? 'rgba(80, 140, 255, 0.06)' : undefined,
                }}
              >
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{day}</TableCell>
                <TableCell sx={{ color: isWeekend ? (dow === 0 ? 'error.main' : 'primary.main') : 'text.secondary' }}>
                  {DOW_LABELS[dow]}
                </TableCell>
                {EDITABLE_FIELDS.map((f) => (
                  <TableCell key={f.key} align={f.type === 'number' ? 'right' : 'left'} sx={{ minWidth: f.type === 'text' ? 120 : 70 }}>
                    <CellInput
                      value={getCellValue(workDate, f.key)}
                      onChange={(raw) => handleChange(workDate, f, raw)}
                      type={f.type}
                      step={f.step}
                    />
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
                  ¥{derived.total_sales.toLocaleString('ja-JP')}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
                  ¥{derived.fuel_total.toLocaleString('ja-JP')}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 500,
                    color: derived.profit < 0 ? 'error.main' : 'success.main',
                  }}
                >
                  ¥{derived.profit.toLocaleString('ja-JP')}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <Box sx={{ p: 1, color: 'text.secondary', fontSize: 12 }}>
        <Typography variant="caption">
          入力は 500ms 静止すると自動保存されます (debounce)
        </Typography>
      </Box>
    </TableContainer>
  )
}

function parseNum(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function parseInt0(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}
