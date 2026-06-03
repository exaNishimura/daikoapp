import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { MonthPicker } from '@/components/Receivables/MonthPicker'
import { fromMonthString, toMonthString, monthRange } from '@/components/Receivables/monthUtils'
import {
  useDailySales,
  useUpsertDailySale,
} from '@/hooks/billing/useDailySales'
import {
  useStaffSales,
  useUpsertStaffSalesBulk,
} from '@/hooks/billing/useStaffSales'
import { useStaffRates } from '@/hooks/billing/useStaffRates'
import {
  useFixedExpenses,
  useUpsertFixedExpense,
  useDeleteFixedExpense,
} from '@/hooks/billing/useFixedExpenses'
import { useReceivables } from '@/hooks/billing/useReceivables'
import { calcMonthlySalesSummary } from '@/lib/billing/dailySalesCalc'
import { DailySalesTable } from './DailySalesTable'
import { StaffSalesTable } from './StaffSalesTable'
import { MonthlyFixedExpensesPanel } from './MonthlyFixedExpensesPanel'
import { MonthlySummary } from './MonthlySummary'

function currentYearMonth() {
  return toMonthString(new Date()) ?? '2026-01'
}

export function DailySalesPage() {
  const navigate = useNavigate()
  const [monthValue, setMonthValue] = useState(currentYearMonth)
  const [tab, setTab] = useState(0)
  const [error, setError] = useState(null)

  const { year, month } = fromMonthString(monthValue) ?? { year: 2026, month: 1 }
  const billingMonth = monthRange(monthValue)?.firstDay ?? null

  const dailyQuery = useDailySales(year, month)
  const staffSalesQuery = useStaffSales(year, month)
  const staffRatesQuery = useStaffRates()
  const fixedExpensesQuery = useFixedExpenses(year, month)
  const receivablesQuery = useReceivables({ year, month })

  const upsertDaily = useUpsertDailySale()
  const upsertStaffBulk = useUpsertStaffSalesBulk()
  const upsertFixed = useUpsertFixedExpense()
  const deleteFixed = useDeleteFixedExpense()

  const dailyRows = useMemo(() => dailyQuery.data ?? [], [dailyQuery.data])
  const staffSales = useMemo(
    () => staffSalesQuery.data ?? [],
    [staffSalesQuery.data]
  )
  const staffRates = useMemo(
    () => (staffRatesQuery.data ?? []).filter((r) => r.is_active !== false),
    [staffRatesQuery.data]
  )
  const fixedExpenses = useMemo(
    () => fixedExpensesQuery.data ?? [],
    [fixedExpensesQuery.data]
  )
  const receivableRows = useMemo(
    () => receivablesQuery.data ?? [],
    [receivablesQuery.data]
  )

  // daily_sales.receivable_total が未入力でも、accounts_receivable から集計して
  // サマリの売掛合計を整合性高く出す
  const dailyRowsWithReceivable = useMemo(() => {
    if (dailyRows.length === 0) return dailyRows
    const byDate = new Map()
    for (const r of receivableRows) {
      byDate.set(r.work_date, (byDate.get(r.work_date) ?? 0) + (Number(r.amount) || 0))
    }
    return dailyRows.map((d) => ({
      ...d,
      receivable_total: d.receivable_total ?? byDate.get(d.work_date) ?? 0,
    }))
  }, [dailyRows, receivableRows])

  const summary = useMemo(
    () =>
      calcMonthlySalesSummary(
        dailyRowsWithReceivable,
        staffSales,
        staffRates,
        fixedExpenses
      ),
    [dailyRowsWithReceivable, staffSales, staffRates, fixedExpenses]
  )

  const handleDailyUpsert = async (payload) => {
    setError(null)
    try {
      await upsertDaily.mutateAsync(payload)
    } catch (err) {
      setError(`日次売上の保存に失敗: ${err.message}`)
    }
  }

  const handleStaffBulkUpsert = async (rows) => {
    setError(null)
    try {
      await upsertStaffBulk.mutateAsync(rows)
    } catch (err) {
      setError(`スタッフ売上の保存に失敗: ${err.message}`)
    }
  }

  const handleFixedUpsert = async (payload) => {
    setError(null)
    try {
      await upsertFixed.mutateAsync(payload)
    } catch (err) {
      setError(`固定経費の保存に失敗: ${err.message}`)
    }
  }

  const handleFixedDelete = async (id) => {
    setError(null)
    try {
      await deleteFixed.mutateAsync(id)
    } catch (err) {
      setError(`固定経費の削除に失敗: ${err.message}`)
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1600, mx: 'auto' }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate(-1)} aria-label="戻る">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          日次売上
        </Typography>
        <Box sx={{ flex: 1 }} />
        <MonthPicker value={monthValue} onChange={setMonthValue} label="対象月" />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {dailyQuery.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          日次売上の取得に失敗: {dailyQuery.error.message}
        </Alert>
      )}

      <Stack spacing={2}>
        <MonthlySummary summary={summary} />

        <Paper>
          <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ px: 2 }}>
            <Tab label="日次売上" />
            <Tab label="スタッフ別売上" />
            <Tab label="月額固定経費" />
          </Tabs>
          <Box sx={{ p: 2 }}>
            {tab === 0 && (
              <DailySalesTable
                year={year}
                month={month}
                rows={dailyRows}
                onUpsert={handleDailyUpsert}
              />
            )}
            {tab === 1 && (
              <StaffSalesTable
                year={year}
                month={month}
                staffRates={staffRates}
                rows={staffSales}
                onBulkUpsert={handleStaffBulkUpsert}
              />
            )}
            {tab === 2 && billingMonth && (
              <MonthlyFixedExpensesPanel
                billingMonth={billingMonth}
                rows={fixedExpenses}
                onUpsert={handleFixedUpsert}
                onDelete={handleFixedDelete}
              />
            )}
          </Box>
        </Paper>
      </Stack>
    </Box>
  )
}
