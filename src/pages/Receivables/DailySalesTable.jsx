import { useMemo, useRef, useState } from 'react'
import { Card } from '@astryxdesign/core/Card'
import { VStack } from '@astryxdesign/core/Layout'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { calcDailyDerived, toWorkDateKey } from '@/lib/billing/dailySalesCalc'
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback'

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

/** 左固定列の幅（日・曜） */
const STICKY_DAY_WIDTH = 44
const STICKY_DOW_WIDTH = 40
const STICKY_DOW_LEFT = STICKY_DAY_WIDTH

/** 距離・金額列は固定幅（テーブル伸長で広がらない）。経費内容は可変のまま。 */
const DIST_COL = 60
const AMOUNT_COL = 80
const EXPENSE_NOTE_MIN = 120

const CELL_INPUT_STYLE = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  paddingBlock: 'var(--spacing-1)',
  paddingInline: 'var(--spacing-2)',
  font: 'inherit',
  background: 'color-mix(in srgb, var(--color-background-surface) 55%, transparent)',
  color: 'var(--color-text-primary)',
  fontVariantNumeric: 'tabular-nums',
}

/** 列グループ（ヘッダ2段 + 縦線で区分） */
const COLUMN_GROUPS = [
  {
    id: 'v1',
    label: '1号車',
    tint: 'primary',
    fields: [
      {
        key: 'vehicle1_distance_km',
        label: '距離',
        unit: 'km',
        type: 'number',
        step: 0.1,
        width: DIST_COL,
      },
      {
        key: 'vehicle1_fuel_yen',
        label: '燃料',
        unit: '¥',
        type: 'number',
        step: 1,
        width: AMOUNT_COL,
      },
      {
        key: 'vehicle1_sales',
        label: '売上',
        unit: '¥',
        type: 'number',
        step: 1,
        width: AMOUNT_COL,
      },
      { key: 'vehicle1_expense_note', label: '経費内容', type: 'text', minWidth: EXPENSE_NOTE_MIN },
      {
        key: 'vehicle1_expense_amount',
        label: '経費額',
        unit: '¥',
        type: 'number',
        step: 1,
        width: AMOUNT_COL,
      },
    ],
  },
  {
    id: 'v2',
    label: '2号車',
    tint: 'info',
    fields: [
      {
        key: 'vehicle2_distance_km',
        label: '距離',
        unit: 'km',
        type: 'number',
        step: 0.1,
        width: DIST_COL,
      },
      {
        key: 'vehicle2_fuel_yen',
        label: '燃料',
        unit: '¥',
        type: 'number',
        step: 1,
        width: AMOUNT_COL,
      },
      {
        key: 'vehicle2_sales',
        label: '売上',
        unit: '¥',
        type: 'number',
        step: 1,
        width: AMOUNT_COL,
      },
      { key: 'vehicle2_expense_note', label: '経費内容', type: 'text', minWidth: EXPENSE_NOTE_MIN },
      {
        key: 'vehicle2_expense_amount',
        label: '経費額',
        unit: '¥',
        type: 'number',
        step: 1,
        width: AMOUNT_COL,
      },
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

function fieldColStyle(field) {
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

function cellBorderStyle({ groupEdge = false } = {}) {
  return {
    borderRight: `${groupEdge ? 2 : 1}px solid ${
      groupEdge ? 'var(--color-border-emphasized)' : 'var(--color-border)'
    }`,
    borderBottom: '1px solid var(--color-border)',
  }
}

function groupTint(tint) {
  if (tint === 'primary') {
    return 'color-mix(in srgb, var(--color-background-blue) 55%, var(--color-background-surface))'
  }
  if (tint === 'info') {
    return 'color-mix(in srgb, var(--color-background-cyan) 55%, var(--color-background-surface))'
  }
  if (tint === 'success') {
    return 'color-mix(in srgb, var(--color-background-green) 55%, var(--color-background-surface))'
  }
  return 'transparent'
}

function rowBackground(dow) {
  if (dow === 0) {
    return 'color-mix(in srgb, var(--color-text-red) 5%, var(--color-background-surface))'
  }
  if (dow === 6) {
    return 'color-mix(in srgb, var(--color-accent) 5%, var(--color-background-surface))'
  }
  return 'var(--color-background-surface)'
}

function stickyColStyle({ left, width, bg, header = false, edge = false }) {
  return {
    position: 'sticky',
    left,
    zIndex: header ? 4 : 2,
    minWidth: width,
    width,
    maxWidth: width,
    backgroundColor: bg,
    ...cellBorderStyle({ groupEdge: edge }),
    ...(edge ? { boxShadow: '4px 0 8px -4px var(--color-overlay)' } : {}),
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
    <input
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      type={type}
      step={step}
      aria-label={type === 'number' ? '数値' : 'テキスト'}
      style={{
        ...CELL_INPUT_STYLE,
        textAlign: type === 'number' ? 'right' : 'left',
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

  const headerBg = 'var(--color-background-muted)'
  const derivedHeaderBg = groupTint('success')

  return (
    <VStack gap={1}>
      <Card padding={0}>
        <VStack gap={0} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
        <Table density="compact" hasHover dividers="grid">
          <TableHeader>
            <TableRow isHeaderRow>
              <TableHeaderCell
                rowSpan={2}
                style={{
                  ...stickyColStyle({
                    left: 0,
                    width: STICKY_DAY_WIDTH,
                    bg: headerBg,
                    header: true,
                  }),
                  verticalAlign: 'middle',
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              >
                日
              </TableHeaderCell>
              <TableHeaderCell
                rowSpan={2}
                style={{
                  ...stickyColStyle({
                    left: STICKY_DOW_LEFT,
                    width: STICKY_DOW_WIDTH,
                    bg: headerBg,
                    header: true,
                    edge: true,
                  }),
                  verticalAlign: 'middle',
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              >
                曜
              </TableHeaderCell>
              {COLUMN_GROUPS.map((g) => (
                <TableHeaderCell
                  key={g.id}
                  colSpan={g.fields.length}
                  style={{
                    ...cellBorderStyle({ groupEdge: true }),
                    backgroundColor: groupTint(g.tint) === 'transparent' ? headerBg : groupTint(g.tint),
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textAlign: 'center',
                    borderTop: `2px solid ${
                      g.tint === 'primary'
                        ? 'var(--color-border-blue)'
                        : g.tint === 'info'
                          ? 'var(--color-border-cyan)'
                          : 'var(--color-border)'
                    }`,
                  }}
                >
                  {g.label}
                </TableHeaderCell>
              ))}
              <TableHeaderCell
                colSpan={DERIVED_COLUMNS.length}
                style={{
                  ...cellBorderStyle({ groupEdge: true }),
                  backgroundColor: derivedHeaderBg,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textAlign: 'center',
                  borderTop: '2px solid var(--color-border-green)',
                }}
              >
                集計
              </TableHeaderCell>
            </TableRow>

            <TableRow isHeaderRow>
              {COLUMN_GROUPS.map((g) =>
                g.fields.map((f, idx) => (
                  <TableHeaderCell
                    key={f.key}
                    title={f.unit ? `${f.label} (${f.unit})` : f.label}
                    style={{
                      ...cellBorderStyle({ groupEdge: idx === g.fields.length - 1 }),
                      ...fieldColStyle(f),
                      backgroundColor:
                        groupTint(g.tint) === 'transparent' ? headerBg : groupTint(g.tint),
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      textAlign: f.type === 'number' ? 'right' : 'left',
                    }}
                  >
                    {f.width != null ? f.label : `${f.label}${f.unit ? ` (${f.unit})` : ''}`}
                  </TableHeaderCell>
                ))
              )}
              {DERIVED_COLUMNS.map((c, idx) => (
                <TableHeaderCell
                  key={c.key}
                  style={{
                    ...cellBorderStyle({ groupEdge: idx === DERIVED_COLUMNS.length - 1 }),
                    minWidth: c.minWidth,
                    backgroundColor: derivedHeaderBg,
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    textAlign: 'right',
                  }}
                >
                  {c.label}
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
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

              return (
                <TableRow key={workDate} style={{ backgroundColor: bg }}>
                  <TableCell
                    style={{
                      ...stickyColStyle({
                        left: 0,
                        width: STICKY_DAY_WIDTH,
                        bg,
                      }),
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                      textAlign: 'center',
                    }}
                  >
                    {day}
                  </TableCell>
                  <TableCell
                    style={{
                      ...stickyColStyle({
                        left: STICKY_DOW_LEFT,
                        width: STICKY_DOW_WIDTH,
                        bg,
                        edge: true,
                      }),
                      color: isWeekend
                        ? dow === 0
                          ? 'var(--color-text-red)'
                          : 'var(--color-text-accent)'
                        : 'var(--color-text-secondary)',
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
                        style={{
                          ...cellBorderStyle({ groupEdge: idx === g.fields.length - 1 }),
                          ...fieldColStyle(f),
                          backgroundColor: groupTint(g.tint),
                          textAlign: f.type === 'number' ? 'right' : 'left',
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
                    style={{
                      ...cellBorderStyle(),
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--color-text-secondary)',
                      minWidth: 88,
                      backgroundColor: derivedHeaderBg,
                      textAlign: 'right',
                    }}
                  >
                    ¥{derived.total_sales.toLocaleString('ja-JP')}
                  </TableCell>
                  <TableCell
                    style={{
                      ...cellBorderStyle(),
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--color-text-secondary)',
                      minWidth: 120,
                      backgroundColor: derivedHeaderBg,
                      textAlign: 'right',
                    }}
                  >
                    {receivableCount > 0
                      ? `${receivableCount}件 ¥${receivableTotal.toLocaleString('ja-JP')}`
                      : '—'}
                  </TableCell>
                  <TableCell
                    style={{
                      ...cellBorderStyle(),
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--color-text-secondary)',
                      minWidth: 80,
                      backgroundColor: derivedHeaderBg,
                      textAlign: 'right',
                    }}
                  >
                    ¥{derived.fuel_total.toLocaleString('ja-JP')}
                  </TableCell>
                  <TableCell
                    style={{
                      ...cellBorderStyle({ groupEdge: true }),
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                      color:
                        derived.profit < 0
                          ? 'var(--color-text-red)'
                          : 'var(--color-text-green)',
                      minWidth: 88,
                      backgroundColor: derivedHeaderBg,
                      textAlign: 'right',
                    }}
                  >
                    ¥{derived.profit.toLocaleString('ja-JP')}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        </VStack>
      </Card>
      <Text size="sm" color="secondary">
        入力は 500ms 静止すると自動保存されます。列は「1号車 / 2号車 / 共通 /
        集計」で区分しています。
      </Text>
    </VStack>
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
