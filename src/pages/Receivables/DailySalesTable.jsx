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
import { useTheme, alpha } from '@mui/material/styles'
import { calcDailyDerived, toWorkDateKey } from '@/lib/billing/dailySalesCalc'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

/** 左固定列の幅（日・曜） */
const STICKY_DAY_WIDTH = 44
const STICKY_DOW_WIDTH = 40
const STICKY_DOW_LEFT = STICKY_DAY_WIDTH

/** 距離・金額列は固定幅（テーブル伸長で広がらない）。経費内容は可変のまま。 */
const DIST_COL = 52
const AMOUNT_COL = 80
const EXPENSE_NOTE_MIN = 120

/** 列グループ（ヘッダ2段 + 縦線で区分） */
const COLUMN_GROUPS = [
  {
    id: 'v1',
    label: '1号車',
    tint: 'primary',
    fields: [
      { key: 'vehicle1_distance_km', label: '距離', unit: 'km', type: 'number', step: 0.1, width: DIST_COL },
      { key: 'vehicle1_fuel_yen', label: '燃料', unit: '¥', type: 'number', step: 1, width: AMOUNT_COL },
      { key: 'vehicle1_sales', label: '売上', unit: '¥', type: 'number', step: 1, width: AMOUNT_COL },
      { key: 'vehicle1_expense_note', label: '経費内容', type: 'text', minWidth: EXPENSE_NOTE_MIN },
      { key: 'vehicle1_expense_amount', label: '経費額', unit: '¥', type: 'number', step: 1, width: AMOUNT_COL },
    ],
  },
  {
    id: 'v2',
    label: '2号車',
    tint: 'info',
    fields: [
      { key: 'vehicle2_distance_km', label: '距離', unit: 'km', type: 'number', step: 0.1, width: DIST_COL },
      { key: 'vehicle2_fuel_yen', label: '燃料', unit: '¥', type: 'number', step: 1, width: AMOUNT_COL },
      { key: 'vehicle2_sales', label: '売上', unit: '¥', type: 'number', step: 1, width: AMOUNT_COL },
      { key: 'vehicle2_expense_note', label: '経費内容', type: 'text', minWidth: EXPENSE_NOTE_MIN },
      { key: 'vehicle2_expense_amount', label: '経費額', unit: '¥', type: 'number', step: 1, width: AMOUNT_COL },
    ],
  },
  {
    id: 'shared',
    label: '共通',
    tint: null,
    fields: [
      { key: 'labor_cost', label: '人件費', unit: '¥', type: 'number', step: 1, width: AMOUNT_COL },
      { key: 'cash', label: '現金', unit: '¥', type: 'number', step: 1, width: AMOUNT_COL },
    ],
  },
]

function fieldColSx(field) {
  if (field.width != null) {
    return {
      width: field.width,
      minWidth: field.width,
      maxWidth: field.width,
      boxSizing: 'border-box',
      overflow: 'hidden',
    }
  }
  return {
    minWidth: field.minWidth,
  }
}

const DERIVED_COLUMNS = [
  { key: 'total_sales', label: '総売上', minWidth: 88 },
  { key: 'receivable', label: '未収（売掛）', minWidth: 120 },
  { key: 'fuel_total', label: '燃料計', minWidth: 80 },
  { key: 'profit', label: '推定利益', minWidth: 88 },
]

function cellBorderSx(theme, { groupEdge = false, strong = false } = {}) {
  return {
    borderRight: `${strong || groupEdge ? 2 : 1}px solid ${
      strong || groupEdge ? theme.palette.divider : alpha(theme.palette.divider, 0.7)
    }`,
    borderBottom: `1px solid ${theme.palette.divider}`,
  }
}

function groupTint(theme, tint) {
  if (tint === 'primary') return alpha(theme.palette.primary.main, 0.06)
  if (tint === 'info') return alpha(theme.palette.info.main, 0.06)
  if (tint === 'success') return alpha(theme.palette.success.main, 0.05)
  return 'transparent'
}

function rowBackground(theme, dow) {
  if (dow === 0) return alpha(theme.palette.error.main, 0.05)
  if (dow === 6) return alpha(theme.palette.primary.main, 0.05)
  return theme.palette.background.paper
}

function parseCssColor(color) {
  if (typeof color !== 'string') return [255, 255, 255]
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
  return [255, 255, 255]
}

/** 固定列用: paper に色を混ぜた不透明背景（横スクロール時の透け防止） */
function stickyRowBackground(theme, dow) {
  const paperRgb = parseCssColor(theme.palette.background.paper)
  if (dow === 0) {
    const fg = parseCssColor(theme.palette.error.main)
    const [r, g, b] = fg.map((c, i) => Math.round(c * 0.05 + paperRgb[i] * 0.95))
    return `rgb(${r}, ${g}, ${b})`
  }
  if (dow === 6) {
    const fg = parseCssColor(theme.palette.primary.main)
    const [r, g, b] = fg.map((c, i) => Math.round(c * 0.05 + paperRgb[i] * 0.95))
    return `rgb(${r}, ${g}, ${b})`
  }
  return theme.palette.background.paper
}

function stickyColSx({ left, width, bg, header = false, edge = false, theme }) {
  return {
    position: 'sticky',
    left,
    zIndex: header ? 4 : 2,
    minWidth: width,
    width,
    maxWidth: width,
    bgcolor: bg,
    ...cellBorderSx(theme, { groupEdge: edge, strong: edge }),
    ...(edge
      ? { boxShadow: '4px 0 8px -4px rgba(0,0,0,0.12)' }
      : {}),
  }
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function toDateString(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

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
      sx={{
        width: '100%',
        fontSize: 13,
        bgcolor: 'rgba(255,255,255,0.55)',
        borderRadius: 0.5,
        border: '1px solid',
        borderColor: 'divider',
        '&:hover': { borderColor: 'primary.light' },
        '&.Mui-focused, &:focus-within': {
          borderColor: 'primary.main',
          bgcolor: '#fff',
        },
      }}
    />
  )
}

/**
 * 1ヶ月分 (1〜末日) の日次売上をインライン編集するテーブル。
 * - 列グループ（1号車 / 2号車 / 共通 / 集計）+ 縦線で視覚的に区分
 * - 編集中の値は内部 `draft` state に保持
 * - 500ms 静止したら `onUpsert(payload)` に送る (debounce)
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

  const headerBg = theme.palette.grey[50]
  const derivedHeaderBg = alpha(theme.palette.success.main, 0.06)

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{
        width: '100%',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        borderColor: 'divider',
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
          {/* グループ行 */}
          <TableRow>
            <TableCell
              rowSpan={2}
              sx={{
                ...stickyColSx({
                  left: 0,
                  width: STICKY_DAY_WIDTH,
                  bg: headerBg,
                  header: true,
                  theme,
                }),
                verticalAlign: 'middle',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              日
            </TableCell>
            <TableCell
              rowSpan={2}
              sx={{
                ...stickyColSx({
                  left: STICKY_DOW_LEFT,
                  width: STICKY_DOW_WIDTH,
                  bg: headerBg,
                  header: true,
                  edge: true,
                  theme,
                }),
                verticalAlign: 'middle',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              曜
            </TableCell>
            {COLUMN_GROUPS.map((g) => (
              <TableCell
                key={g.id}
                align="center"
                colSpan={g.fields.length}
                sx={{
                  ...cellBorderSx(theme, { groupEdge: true, strong: true }),
                  bgcolor: groupTint(theme, g.tint) || headerBg,
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: '0.04em',
                  borderTop: `2px solid ${
                    g.tint === 'primary'
                      ? theme.palette.primary.main
                      : g.tint === 'info'
                        ? theme.palette.info.main
                        : theme.palette.divider
                  }`,
                }}
              >
                {g.label}
              </TableCell>
            ))}
            <TableCell
              align="center"
              colSpan={DERIVED_COLUMNS.length}
              sx={{
                ...cellBorderSx(theme, { groupEdge: true, strong: true }),
                bgcolor: derivedHeaderBg,
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.04em',
                borderTop: `2px solid ${theme.palette.success.main}`,
              }}
            >
              集計
            </TableCell>
          </TableRow>

          {/* 項目行 */}
          <TableRow>
            {COLUMN_GROUPS.map((g) =>
              g.fields.map((f, idx) => (
                <TableCell
                  key={f.key}
                  align={f.type === 'number' ? 'right' : 'left'}
                  title={f.unit ? `${f.label} (${f.unit})` : f.label}
                  sx={{
                    ...cellBorderSx(theme, {
                      groupEdge: idx === g.fields.length - 1,
                      strong: idx === g.fields.length - 1,
                    }),
                    ...fieldColSx(f),
                    bgcolor: groupTint(theme, g.tint) || headerBg,
                    fontWeight: 600,
                    fontSize: 12,
                    color: 'text.secondary',
                  }}
                >
                  {f.width != null ? f.label : `${f.label}${f.unit ? ` (${f.unit})` : ''}`}
                </TableCell>
              ))
            )}
            {DERIVED_COLUMNS.map((c, idx) => (
              <TableCell
                key={c.key}
                align="right"
                sx={{
                  ...cellBorderSx(theme, {
                    groupEdge: idx === DERIVED_COLUMNS.length - 1,
                    strong: idx === DERIVED_COLUMNS.length - 1,
                  }),
                  minWidth: c.minWidth,
                  bgcolor: derivedHeaderBg,
                  fontWeight: 600,
                  fontSize: 12,
                  color: 'text.secondary',
                }}
              >
                {c.label}
              </TableCell>
            ))}
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
            const bg = rowBackground(theme, dow)
            const stickyBg = stickyRowBackground(theme, dow)

            return (
              <TableRow key={workDate} hover sx={{ bgcolor: bg }}>
                <TableCell
                  sx={{
                    ...stickyColSx({
                      left: 0,
                      width: STICKY_DAY_WIDTH,
                      bg: stickyBg,
                      theme,
                    }),
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                    textAlign: 'center',
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
                      theme,
                    }),
                    color: isWeekend
                      ? dow === 0
                        ? 'error.main'
                        : 'primary.main'
                      : 'text.secondary',
                    fontWeight: isWeekend ? 700 : 500,
                    textAlign: 'center',
                  }}
                >
                  {DOW_LABELS[dow]}
                </TableCell>

                {COLUMN_GROUPS.map((g) =>
                  g.fields.map((f, idx) => (
                    <TableCell
                      key={f.key}
                      align={f.type === 'number' ? 'right' : 'left'}
                      sx={{
                        ...cellBorderSx(theme, {
                          groupEdge: idx === g.fields.length - 1,
                          strong: idx === g.fields.length - 1,
                        }),
                        ...fieldColSx(f),
                        bgcolor: groupTint(theme, g.tint),
                      }}
                    >
                      <CellInput
                        value={getCellValue(workDate, f.key)}
                        onChange={(raw) => handleChange(workDate, f, raw)}
                        type={f.type}
                        step={f.step}
                      />
                    </TableCell>
                  ))
                )}

                <TableCell
                  align="right"
                  sx={{
                    ...cellBorderSx(theme),
                    fontVariantNumeric: 'tabular-nums',
                    color: 'text.secondary',
                    minWidth: 88,
                    bgcolor: derivedHeaderBg,
                  }}
                >
                  ¥{derived.total_sales.toLocaleString('ja-JP')}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    ...cellBorderSx(theme),
                    fontVariantNumeric: 'tabular-nums',
                    color: 'text.secondary',
                    minWidth: 120,
                    bgcolor: derivedHeaderBg,
                  }}
                >
                  {receivableCount > 0
                    ? `${receivableCount}件 ¥${receivableTotal.toLocaleString('ja-JP')}`
                    : '—'}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    ...cellBorderSx(theme),
                    fontVariantNumeric: 'tabular-nums',
                    color: 'text.secondary',
                    minWidth: 80,
                    bgcolor: derivedHeaderBg,
                  }}
                >
                  ¥{derived.fuel_total.toLocaleString('ja-JP')}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    ...cellBorderSx(theme, { groupEdge: true, strong: true }),
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                    color: derived.profit < 0 ? 'error.main' : 'success.main',
                    minWidth: 88,
                    bgcolor: derivedHeaderBg,
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
          入力は 500ms 静止すると自動保存されます。列は「1号車 / 2号車 / 共通 / 集計」で区分しています。
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
