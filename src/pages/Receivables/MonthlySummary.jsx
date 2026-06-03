import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'

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
        <Stat label="スタッフ人件費" value={summary.payroll_total} />
        <Stat label="月額固定経費" value={summary.fixed_expense_total} />
        <Stat label="推定粗利" value={summary.estimated_profit} accent />
      </Box>

      {summary.staff_payroll && summary.staff_payroll.length > 0 && (
        <>
          <Divider sx={{ my: 2 }}>スタッフ別人件費</Divider>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 1.5,
            }}
          >
            {summary.staff_payroll.map((s) => (
              <Box
                key={s.staff_name}
                sx={{ p: 1.5, bgcolor: 'action.selected', borderRadius: 1 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {s.staff_name}
                  {' · '}
                  {s.rate_type === 'commission'
                    ? `歩合 ${(Number(s.commission_rate) * 100).toFixed(0)}%`
                    : s.rate_type === 'hourly'
                      ? `時給 ¥${Number(s.hourly_rate).toLocaleString('ja-JP')}`
                      : '単価未設定'}
                </Typography>
                <Typography sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  ¥{Number(s.payroll).toLocaleString('ja-JP')}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  売上 ¥{Number(s.total_sales).toLocaleString('ja-JP')} / 稼働 {Number(s.total_hours).toFixed(2)}h
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Paper>
  )
}
