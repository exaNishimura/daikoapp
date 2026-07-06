import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

function Stat({ label, value, accent }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="h6"
        sx={{
          fontVariantNumeric: 'tabular-nums',
          color: accent ? (Number(value) < 0 ? 'error.main' : 'success.main') : undefined,
          fontWeight: accent ? 700 : 600,
        }}
      >
        ¥{Number(value ?? 0).toLocaleString('ja-JP')}
      </Typography>
    </Box>
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
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        月次サマリ
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 2,
        }}
      >
        <Stat label="総売上" value={summary.total_sales} />
        <Stat label="売掛合計" value={summary.receivable_total} />
        <Stat label="現金合計" value={summary.cash_total} />
        <Stat label="経費合計" value={summary.expense_total} />
        <Stat label="燃料代合計" value={summary.fuel_total} />
        <Stat label="人件費合計" value={summary.labor_cost_total} />
        <Stat label="経費" value={summary.fixed_expense_total} />
        <Stat label="推定利益" value={summary.estimated_profit} accent />
      </Box>
    </Paper>
  )
}
