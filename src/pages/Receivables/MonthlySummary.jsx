import { Card } from '@astryxdesign/core/Card'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { VStack } from '@astryxdesign/core/Layout'
import { SummaryStat } from '@/components/SummaryStat'

function yen(value) {
  return `¥${Number(value ?? 0).toLocaleString('ja-JP')}`
}

/**
 * 月次サマリ表示。calcMonthlySalesSummary の結果を可視化する。
 *
 * @param {Object} props
 * @param {ReturnType<typeof import('@/lib/billing/dailySalesCalc').calcMonthlySalesSummary>} props.summary
 */
export function MonthlySummary({ summary }) {
  const profit = Number(summary.estimated_profit ?? 0)
  return (
    <Card padding={3}>
      <VStack gap={3}>
        <Heading level={3}>月次サマリ</Heading>
        <Grid columns={{ minWidth: 140 }} gap={2}>
          <SummaryStat label="総売上" value={yen(summary.total_sales)} />
          <SummaryStat label="売掛合計" value={yen(summary.receivable_total)} />
          <SummaryStat label="現金合計" value={yen(summary.cash_total)} />
          <SummaryStat label="経費合計" value={yen(summary.expense_total)} />
          <SummaryStat label="燃料代合計" value={yen(summary.fuel_total)} />
          <SummaryStat label="人件費合計" value={yen(summary.labor_cost_total)} />
          <SummaryStat label="経費" value={yen(summary.fixed_expense_total)} />
          <SummaryStat
            label="推定利益"
            value={yen(profit)}
            tone={profit < 0 ? 'danger' : 'success'}
          />
        </Grid>
      </VStack>
    </Card>
  )
}
