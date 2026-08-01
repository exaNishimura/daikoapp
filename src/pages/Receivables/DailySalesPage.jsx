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
  useFixedExpenses,
  useUpsertFixedExpense,
  useDeleteFixedExpense,
} from '@/hooks/billing/useFixedExpenses'
import { useReceivables } from '@/hooks/billing/useReceivables'
import { calcMonthlySalesSummary } from '@/lib/billing/dailySalesCalc'
import { summarizeReceivablesByDate } from '@/lib/billing/shiftReceivables'
import { DailySalesTable } from './DailySalesTable'
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
  const fixedExpensesQuery = useFixedExpenses(year, month)
  const receivablesQuery = useReceivables({ year, month })

  const upsertDaily = useUpsertDailySale()
  const upsertFixed = useUpsertFixedExpense()
  const deleteFixed = useDeleteFixedExpense()

  const dailyRows = useMemo(() => dailyQuery.data ?? [], [dailyQuery.data])
  const fixedExpenses = useMemo(
    () => fixedExpensesQuery.data?.rows ?? [],
    [fixedExpensesQuery.data]
  )
  const fixedExpensesCarriedOver = Boolean(fixedExpensesQuery.data?.carriedOver)
  const receivableRows = useMemo(
    () => receivablesQuery.data ?? [],
    [receivablesQuery.data]
  )

  const receivableByDate = useMemo(
    () => summarizeReceivablesByDate(receivableRows),
    [receivableRows]
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
    () => calcMonthlySalesSummary(dailyRowsWithReceivable, fixedExpenses),
    [dailyRowsWithReceivable, fixedExpenses]
  )

  const handleDailyUpsert = async (payload) => {
    setError(null)
    try {
      await upsertDaily.mutateAsync(payload)
    } catch (err) {
      setError(`売上の保存に失敗: ${err.message}`)
    }
  }

  const handleFixedUpsert = async (payload) => {
    setError(null)
    try {
      await upsertFixed.mutateAsync(payload)
    } catch (err) {
      setError(`固定経費の保存に失敗: ${err.message}`)
      throw err
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
    <Box
      sx={{
        p: 3,
        maxWidth: 1600,
        mx: 'auto',
        width: '100%',
        minWidth: 0,
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate(-1)} aria-label="戻る">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          売上管理
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
          売上データの取得に失敗: {dailyQuery.error.message}
        </Alert>
      )}
      {fixedExpensesQuery.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          月額固定経費の取得に失敗: {fixedExpensesQuery.error.message}
        </Alert>
      )}
      {fixedExpensesCarriedOver && (
        <Alert severity="info" sx={{ mb: 2 }}>
          前月の月額固定経費を当月へ引き継ぎました。金額は必要に応じて修正してください。
        </Alert>
      )}

      <Stack spacing={2}>
        <MonthlySummary summary={summary} />

        <Paper sx={{ minWidth: 0 }}>
          <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ px: 2 }}>
            <Tab label="日次売上" />
            <Tab label="月額固定経費" />
          </Tabs>
          <Box sx={{ p: 2, minWidth: 0 }}>
            {tab === 0 && (
              <DailySalesTable
                year={year}
                month={month}
                rows={dailyRows}
                receivableByDate={receivableByDate}
                onUpsert={handleDailyUpsert}
              />
            )}
            {tab === 1 && billingMonth && (
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
