import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import FormControlLabel from '@mui/material/FormControlLabel'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import CircularProgress from '@mui/material/CircularProgress'
import SendIcon from '@mui/icons-material/Send'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useUnbilledByCompany } from '@/hooks/billing/useReceivables'
import { useIssueInvoices } from '@/hooks/billing/useInvoices'
import {
  STRATEGIES,
  INVOICE_MAX_LINES,
  recommendedStrategy,
} from '@/lib/billing/invoiceLineStrategies'
import { InvoiceIssueResultDialog } from './InvoiceIssueResultDialog'

const STRATEGY_LABEL = {
  [STRATEGIES.NORMAL]: '通常発行',
  [STRATEGIES.MERGE]: '合算（"その他" 1 行に集約）',
  [STRATEGIES.SPLIT]: '分割（複数枚に分ける）',
  [STRATEGIES.SKIP]: 'スキップ',
}

/**
 * 月選択 → 未請求売掛を企業別に集約してプレビュー → 戦略選択 → 発行。
 */
export function InvoiceIssueTab({ year, month }) {
  const unbilledQuery = useUnbilledByCompany(year, month)
  const issueMutation = useIssueInvoices()

  const rows = useMemo(() => unbilledQuery.data ?? [], [unbilledQuery.data])

  // 各企業の { selected, strategy } を保持
  const [decisions, setDecisions] = useState({})

  const decisionFor = (row) => {
    const existing = decisions[row.company_id]
    if (existing) return existing
    return {
      selected: true,
      strategy: recommendedStrategy(row.line_count),
    }
  }

  const update = (companyId, patch) => {
    setDecisions((prev) => ({
      ...prev,
      [companyId]: { ...(prev[companyId] ?? {}), ...patch },
    }))
  }

  const [resultOpen, setResultOpen] = useState(false)
  const [result, setResult] = useState(null)

  const handleIssue = async () => {
    const targets = rows
      .map((r) => {
        const d = decisionFor(r)
        if (!d.selected) return null
        return { companyId: r.company_id, strategy: d.strategy }
      })
      .filter(Boolean)

    if (targets.length === 0) return

    try {
      const out = await issueMutation.mutateAsync({ year, month, targets })
      setResult(out)
      setResultOpen(true)
    } catch (err) {
      setResult({ successes: [], failures: [{ companyId: 0, companyName: '全体エラー', error: err.message }] })
      setResultOpen(true)
    }
  }

  if (unbilledQuery.isLoading) {
    return <CircularProgress />
  }

  if (rows.length === 0) {
    return (
      <Alert severity="info">
        {year} 年 {month} 月の未請求売掛はありません。
      </Alert>
    )
  }

  const selectedCount = rows.filter((r) => decisionFor(r).selected && decisionFor(r).strategy !== STRATEGIES.SKIP).length
  const totalAmount = rows
    .filter((r) => decisionFor(r).selected && decisionFor(r).strategy !== STRATEGIES.SKIP)
    .reduce((s, r) => s + r.total_amount, 0)
  const hasOverflow = rows.some((r) => r.line_count > INVOICE_MAX_LINES)

  return (
    <Box>
      {hasOverflow && (
        <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
          明細が {INVOICE_MAX_LINES} 件を超える企業があります。
          請求書テンプレの行数を超過するため、対応方針を選択してください。
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
        <Typography variant="body2">
          対象企業: <strong>{selectedCount}</strong> / {rows.length} 社
        </Typography>
        <Typography variant="body2">
          合計金額: <strong>¥{totalAmount.toLocaleString('ja-JP')}</strong>
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          color="primary"
          startIcon={<SendIcon />}
          disabled={selectedCount === 0 || issueMutation.isPending}
          onClick={handleIssue}
        >
          {issueMutation.isPending ? '発行中…' : `${selectedCount} 社を発行`}
        </Button>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>取引先</TableCell>
              <TableCell align="right">件数</TableCell>
              <TableCell align="right">合計</TableCell>
              <TableCell>戦略</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const d = decisionFor(r)
              const isOverflow = r.line_count > INVOICE_MAX_LINES
              return (
                <TableRow
                  key={r.company_id}
                  sx={{ bgcolor: isOverflow ? 'rgba(255, 180, 0, 0.08)' : undefined }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={d.selected}
                      onChange={(e) => update(r.company_id, { selected: e.target.checked })}
                    />
                  </TableCell>
                  <TableCell>
                    {r.invoice_display_name || r.company_name}
                    {isOverflow && (
                      <Typography variant="caption" color="warning.main" display="block">
                        {INVOICE_MAX_LINES} 件超過
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {r.line_count}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    ¥{r.total_amount.toLocaleString('ja-JP')}
                  </TableCell>
                  <TableCell>
                    {isOverflow ? (
                      <RadioGroup
                        row
                        value={d.strategy}
                        onChange={(e) => update(r.company_id, { strategy: e.target.value })}
                      >
                        <FormControlLabel
                          value={STRATEGIES.MERGE}
                          control={<Radio size="small" />}
                          label={STRATEGY_LABEL[STRATEGIES.MERGE]}
                        />
                        <FormControlLabel
                          value={STRATEGIES.SPLIT}
                          control={<Radio size="small" />}
                          label={STRATEGY_LABEL[STRATEGIES.SPLIT]}
                        />
                        <FormControlLabel
                          value={STRATEGIES.SKIP}
                          control={<Radio size="small" />}
                          label={STRATEGY_LABEL[STRATEGIES.SKIP]}
                        />
                      </RadioGroup>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        {STRATEGY_LABEL[STRATEGIES.NORMAL]}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {result && (
        <InvoiceIssueResultDialog
          open={resultOpen}
          result={result}
          onClose={() => setResultOpen(false)}
          year={year}
          month={month}
        />
      )}
    </Box>
  )
}
