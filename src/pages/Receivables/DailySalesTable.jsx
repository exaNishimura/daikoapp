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
import { useTheme } from '@mui/material/styles'
import { calcDailyDerived, toWorkDateKey } from '@/lib/billing/dailySalesCalc'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

/** 左固定列の幅（日・曜） */
const STICKY_DAY_WIDTH = 44
const STICKY_DOW_WIDTH = 40
const STICKY_DOW_LEFT = STICKY_DAY_WIDTH

function rowBackground(dow) {
  if (dow === 0) return 'rgba(255, 80, 80, 0.06)'
  if (dow === 6) return 'rgba(80, 140, 255, 0.06)'
  return 'background.paper'
}

function parseCssColor(color) {
  if (typeof color !== 'string') return [42, 42, 42]
  if (color.startsWith('#')) {
    const h = color.slice(1)
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ]
  }
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])]
  return [42, 42, 42]
}

/** 固定列用: paper に色を混ぜた不透明背景（横スクロール時の透け防止） */
function stickyRowBackground(theme, dow) {
  const paperRgb = parseCssColor(theme.palette.background.paper)
  if (dow === 0) {
    const fg = parseCssColor(theme.palette.error.main)
    const [r, g, b] = fg.map((c, i) => Math.round(c * 0.06 + paperRgb[i] * 0.94))
    return `rgb(${r}, ${g}, ${b})`
  }
  if (dow === 6) {
    const fg = parseCssColor(theme.palette.primary.main)
    const [r, g, b] = fg.map((c, i) => Math.round(c * 0.06 + paperRgb[i] * 0.94))
    return `rgb(${r}, ${g}, ${b})`
  }
  return theme.palette.background.paper
}

/** 横スクロール時に左端を固定するセル用スタイル */
function stickyColSx({ left, width, bg, header = false, edge = false }) {
  return {
    position: 'sticky',
    left,
    zIndex: header ? 4 : 2,
    minWidth: width,
    width,
    maxWidth: width,
    bgcolor: bg,
    ...(edge
      ? {
          borderRight: 1,
          borderColor: 'divider',
          boxShadow: '4px 0 8px -4px rgba(0,0,0,0.12)',
        }
      : {}),
  }
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function toDateString(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const EDITABLE_FIELDS = [
  { key: 'vehicle1_distance_km', label: '距離(1号車)', unit: 'km', type: 'number', step: 0.1 },
  { key: 'vehicle2_distance_km', label: '距離(2号車)', unit: 'km', type: 'number', step: 0.1 },
  { key: 'vehicle1_fuel_yen', label: '燃料(1号車)', unit: '¥', type: 'number', step: 1 },
  { key: 'vehicle2_fuel_yen', label: '燃料(2号車)', unit: '¥', type: 'number', step: 1 },
  { key: 'vehicle1_sales', label: '売上(1号車)', unit: '¥', type: 'number', step: 1 },
  { key: 'vehicle2_sales', label: '売上(2号車)', unit: '¥', type: 'number', step: 1 },
  { key: 'vehicle1_expense_note', label: '経費内容(1号車)', type: 'text' },
  { key: 'vehicle1_expense_amount', label: '経費額(1号車)', unit: '¥', type: 'number', step: 1 },
  { key: 'vehicle2_expense_note', label: '経費内容(2号車)', type: 'text' },
  { key: 'vehicle2_expense_amount', label: '経費額(2号車)', unit: '¥', type: 'number', step: 1 },
  { key: 'labor_cost', label: '人件費', unit: '¥', type: 'number', step: 1 },
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
export function DailySalesTable({ year, month, rows, receivableByDate = new Map(), onUpsert }) {
  const theme = useTheme()
  const totalDays = daysInMonth(year, month)
  const rowsByDate = useMemo(() => {
    const map = new Map()
    for (const r of rows ?? []) {
      const key = toWorkDateKey(r.work_date)
      if (key) map.set(key, r)
    }
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
      vehicle1_expense_note: merged.vehicle1_expense_note ?? null,
      vehicle2_expense_note: merged.vehicle2_expense_note ?? null,
      vehicle1_expense_amount: parseInt0(merged.vehicle1_expense_amount) ?? 0,
      vehicle2_expense_amount: parseInt0(merged.vehicle2_expense_amount) ?? 0,
      labor_cost: parseInt0(merged.labor_cost) ?? 0,
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
    <TableContainer
      component={Paper}
      sx={{
        width: '100%',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <Table
        size="small"
        sx={{
          width: 'max-content',
          minWidth: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          '& td, & th': {
            px: 0.75,
            py: 0.5,
            whiteSpace: 'nowrap',
          },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell
              sx={stickyColSx({
                left: 0,
                width: STICKY_DAY_WIDTH,
                bg: 'background.paper',
                header: true,
              })}
            >
              日
            </TableCell>
            <TableCell
              sx={stickyColSx({
                left: STICKY_DOW_LEFT,
                width: STICKY_DOW_WIDTH,
                bg: 'background.paper',
                header: true,
                edge: true,
              })}
            >
              曜
            </TableCell>
            {EDITABLE_FIELDS.map((f) => (
              <TableCell
                key={f.key}
                align={f.type === 'number' ? 'right' : 'left'}
                sx={{ minWidth: f.type === 'text' ? 140 : 88 }}
              >
                {f.label}
                {f.unit && ` (${f.unit})`}
              </TableCell>
            ))}
            <TableCell align="right" sx={{ minWidth: 88 }}>
              総売上
            </TableCell>
            <TableCell align="right" sx={{ minWidth: 120 }}>
              未収（売掛）
            </TableCell>
            <TableCell align="right" sx={{ minWidth: 88 }}>
              燃料計
            </TableCell>
            <TableCell align="right" sx={{ minWidth: 88 }}>
              推定利益
            </TableCell>
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
              vehicle1_fuel_yen: parseInt0(merged.vehicle1_fuel_yen),
              vehicle2_fuel_yen: parseInt0(merged.vehicle2_fuel_yen),
              vehicle1_expense_amount: parseInt0(merged.vehicle1_expense_amount),
              vehicle2_expense_amount: parseInt0(merged.vehicle2_expense_amount),
              labor_cost: parseInt0(merged.labor_cost),
            })
            const receivableSummary = receivableByDate.get(workDate)
            const receivableTotal = receivableSummary?.total ?? 0
            const receivableCount = receivableSummary?.count ?? 0
            const bg = rowBackground(dow)
            const stickyBg = stickyRowBackground(theme, dow)
            return (
              <TableRow
                key={workDate}
                hover
                sx={{ bgcolor: bg }}
              >
                <TableCell
                  sx={{
                    ...stickyColSx({ left: 0, width: STICKY_DAY_WIDTH, bg: stickyBg }),
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {day}
                </TableCell>
                <TableCell
                  sx={{
                    ...stickyColSx({
                      left: STICKY_DOW_LEFT,
                      width: STICKY_DOW_WIDTH,
                      bg: stickyBg,
                      edge: true,
                    }),
                    color: isWeekend ? (dow === 0 ? 'error.main' : 'primary.main') : 'text.secondary',
                  }}
                >
                  {DOW_LABELS[dow]}
                </TableCell>
                {EDITABLE_FIELDS.map((f) => (
                  <TableCell
                    key={f.key}
                    align={f.type === 'number' ? 'right' : 'left'}
                    sx={{ minWidth: f.type === 'text' ? 140 : 88 }}
                  >
                    <CellInput
                      value={getCellValue(workDate, f.key)}
                      onChange={(raw) => handleChange(workDate, f, raw)}
                      type={f.type}
                      step={f.step}
                    />
                  </TableCell>
                ))}
                <TableCell
                  align="right"
                  sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary', minWidth: 88 }}
                >
                  ¥{derived.total_sales.toLocaleString('ja-JP')}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                    color: 'text.secondary',
                    minWidth: 120,
                  }}
                >
                  {receivableCount > 0
                    ? `${receivableCount}件 ¥${receivableTotal.toLocaleString('ja-JP')}`
                    : '—'}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary', minWidth: 88 }}
                >
                  ¥{derived.fuel_total.toLocaleString('ja-JP')}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 500,
                    color: derived.profit < 0 ? 'error.main' : 'success.main',
                    minWidth: 88,
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
