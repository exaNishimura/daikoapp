import { Card } from '@astryxdesign/core/Card'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/Layout'

function Stat({ label, value, accent }) {
  const n = Number(value ?? 0)
  return (
    <VStack gap={0}>
      <Text size="sm" color="secondary">
        {label}
      </Text>
      <Text
        weight="semibold"
        style={{
          fontVariantNumeric: 'tabular-nums',
          color: accent
            ? n < 0
              ? 'var(--color-text-red)'
              : 'var(--color-text-green)'
            : undefined,
        }}
      >
        ¥{n.toLocaleString('ja-JP')}
      </Text>
    </VStack>
  )
}

/**
 * 月次サマリ表示。calcMonthlySalesSummary の結果を可視化する。
 *
 * @param {Object} props
 * @param {ReturnType<typeof import('@/lib/billing/dailySalesCalc').calcMonthlySalesSummary>} props.summary
 */
export function MonthlySummary({ summary }) {
  return (
    <Card padding={3}>
      <VStack gap={3}>
        <Heading level={3}>月次サマリ</Heading>
        <Grid columns={{ minWidth: 140 }} gap={2}>
          <Stat label="総売上" value={summary.total_sales} />
          <Stat label="売掛合計" value={summary.receivable_total} />
          <Stat label="現金合計" value={summary.cash_total} />
          <Stat label="経費合計" value={summary.expense_total} />
          <Stat label="燃料代合計" value={summary.fuel_total} />
          <Stat label="人件費合計" value={summary.labor_cost_total} />
          <Stat label="経費" value={summary.fixed_expense_total} />
          <Stat label="推定利益" value={summary.estimated_profit} accent />
        </Grid>
      </VStack>
    </Card>
  )
}
