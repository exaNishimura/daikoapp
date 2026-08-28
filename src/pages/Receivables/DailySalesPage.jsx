import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banner } from '@astryxdesign/core/Banner'
import { Card } from '@astryxdesign/core/Card'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { TabList, Tab } from '@astryxdesign/core/TabList'
import { ArrowLeft } from 'lucide-react'
import { PageFrame } from '@/components/PageFrame'
import { MonthPicker } from '@/components/Receivables/MonthPicker'
import { fromMonthString, toMonthString, monthRange } from '@/components/Receivables/monthUtils'
import { useDailySales, useUpsertDailySale } from '@/hooks/billing/useDailySales'
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

const TABS = { daily: 'daily', fixed: 'fixed' }

export function DailySalesPage() {
  const navigate = useNavigate()
  const [monthValue, setMonthValue] = useState(currentYearMonth)
  const [tab, setTab] = useState(TABS.daily)
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
  const receivableRows = useMemo(() => receivablesQuery.data ?? [], [receivablesQuery.data])

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
    <PageFrame>
      <VStack gap={4}>
        <HStack gap={2} wrap="wrap" vAlign="center" hAlign="between">
          <HStack gap={2} vAlign="center">
            <IconButton
              label="戻る"
              icon={<ArrowLeft />}
              variant="ghost"
              onClick={() => navigate(-1)}
            />
            <Heading level={1}>売上管理</Heading>
          </HStack>
          <MonthPicker value={monthValue} onChange={setMonthValue} label="対象月" />
        </HStack>

        {error ? (
          <Banner
            status="error"
            title={error}
            isDismissable
            onDismiss={() => setError(null)}
            collapsible={false}
          />
        ) : null}
        {dailyQuery.error ? (
          <Banner
            status="error"
            title={`売上データの取得に失敗: ${dailyQuery.error.message}`}
            collapsible={false}
          />
        ) : null}
        {fixedExpensesQuery.error ? (
          <Banner
            status="error"
            title={`月額固定経費の取得に失敗: ${fixedExpensesQuery.error.message}`}
            collapsible={false}
          />
        ) : null}
        {fixedExpensesCarriedOver ? (
          <Banner
            status="info"
            title="前月の月額固定経費を当月へ引き継ぎました。金額は必要に応じて修正してください。"
            collapsible={false}
          />
        ) : null}

        <MonthlySummary summary={summary} />

        <Card padding={2}>
          <VStack gap={3}>
            <TabList value={tab} onChange={setTab} role="tablist" hasDivider>
              <Tab value={TABS.daily} label="日次売上" panelId="sales-panel-daily" />
              <Tab value={TABS.fixed} label="月額固定経費" panelId="sales-panel-fixed" />
            </TabList>
            {tab === TABS.daily ? (
              <VStack id="sales-panel-daily" role="tabpanel" gap={0}>
                <DailySalesTable
                  year={year}
                  month={month}
                  rows={dailyRows}
                  receivableByDate={receivableByDate}
                  onUpsert={handleDailyUpsert}
                />
              </VStack>
            ) : null}
            {tab === TABS.fixed && billingMonth ? (
              <VStack id="sales-panel-fixed" role="tabpanel" gap={0}>
                <MonthlyFixedExpensesPanel
                  billingMonth={billingMonth}
                  rows={fixedExpenses}
                  onUpsert={handleFixedUpsert}
                  onDelete={handleFixedDelete}
                />
              </VStack>
            ) : null}
          </VStack>
        </Card>
      </VStack>
    </PageFrame>
  )
}
