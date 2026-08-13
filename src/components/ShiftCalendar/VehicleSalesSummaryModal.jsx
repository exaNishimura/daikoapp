import { useMemo } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import { useDailySaleByDate } from '@/hooks/billing/useDailySales'
import { useReceivablesByWorkDate } from '@/hooks/billing/useReceivables'
import { useCompanies } from '@/hooks/billing/useCompanies'
import { getVehicleFieldKeys } from '@/lib/billing/vehicleSalesFields'
import { filterReceivablesByVehicle, sumReceivableAmounts } from '@/lib/billing/shiftReceivables'
import { getStaffHoursLabelsByCar } from '@/lib/billing/shiftStaffHours'
import { computeCashForVehicle } from '@/lib/billing/dailySalesCalc'
import {
  buildCompanyLookup,
  enrichReceivablesWithCompanies,
  getReceivableDisplayName,
} from '@/lib/billing/receivableForm'

function formatWorkDateLabel(workDate, dow) {
  if (!workDate) return ''
  const [y, m, d] = workDate.split('-').map(Number)
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  const dowLabel = dow ? `（${dow}）` : ''
  return `${y}年${mm}月${dd}日${dowLabel}`
}

function formatYen(value) {
  if (value == null || value === '') return '—'
  return `¥${Number(value).toLocaleString('ja-JP')}`
}

function formatDistance(value) {
  if (value == null || value === '') return '—'
  return `${Number(value).toLocaleString('ja-JP')} km`
}

function SummaryRow({ label, value, valueSx }) {
  return (
    <TableRow>
      <TableCell
        component="th"
        scope="row"
        sx={{ width: 120, color: 'text.secondary', border: 0, py: 1 }}
      >
        {label}
      </TableCell>
      <TableCell sx={{ border: 0, py: 1, fontVariantNumeric: 'tabular-nums', ...valueSx }}>
        {value}
      </TableCell>
    </TableRow>
  )
}

export function VehicleSalesSummaryModal({
  open,
  workDate,
  dow,
  carNum,
  dayShifts = [],
  employees = [],
  onClose,
}) {
  const saleQuery = useDailySaleByDate(open ? workDate : null)
  const receivablesQuery = useReceivablesByWorkDate(open ? workDate : null)
  const companiesQuery = useCompanies()

  const companyLookup = useMemo(
    () => buildCompanyLookup(companiesQuery.data ?? []),
    [companiesQuery.data]
  )

  const loading = saleQuery.isLoading || receivablesQuery.isLoading || companiesQuery.isLoading
  const salesRow = saleQuery.data ?? null
  const receivables = filterReceivablesByVehicle(
    enrichReceivablesWithCompanies(receivablesQuery.data ?? [], companiesQuery.data ?? []),
    carNum
  )
  const staffLabels = getStaffHoursLabelsByCar(dayShifts, employees, carNum)

  const vehicleKeys = carNum ? getVehicleFieldKeys(carNum) : null
  const distance = vehicleKeys ? salesRow?.[vehicleKeys.distance_km] : null
  const fuel = vehicleKeys ? salesRow?.[vehicleKeys.fuel_yen] : null
  const sales = vehicleKeys ? salesRow?.[vehicleKeys.sales] : null

  const expenseAmount = vehicleKeys ? Number(salesRow?.[vehicleKeys.expense_amount]) || 0 : 0
  const expenseNote = vehicleKeys ? salesRow?.[vehicleKeys.expense_note]?.trim() || '' : ''
  const hasExpense = expenseAmount > 0 || expenseNote !== ''

  const vehicleCash = useMemo(() => {
    if (!salesRow || !carNum) return null
    return computeCashForVehicle(salesRow, carNum, sumReceivableAmounts(receivables))
  }, [salesRow, carNum, receivables])

  const dateLabel = formatWorkDateLabel(workDate, dow)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>集計結果</DialogTitle>
      <DialogContent>
        {loading ? (
          <Stack alignItems="center" py={3}>
            <CircularProgress size={28} />
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Table size="small" sx={{ '& td, & th': { px: 0 } }}>
              <TableBody>
                <SummaryRow label="日付" value={dateLabel} />
                <SummaryRow label="号車" value={carNum ? `${carNum}号車` : '—'} />
                <SummaryRow label="走行距離" value={formatDistance(distance)} />
                <SummaryRow label="燃料代" value={formatYen(fuel)} />
                <SummaryRow label="売上" value={formatYen(sales)} />
              </TableBody>
            </Table>

            <Divider />

            <Typography variant="subtitle2" color="text.secondary">
              稼働スタッフ
            </Typography>
            {staffLabels.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                なし
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {staffLabels.map((label) => (
                  <Typography key={label} variant="body2">
                    {label}
                  </Typography>
                ))}
              </Stack>
            )}

            <Divider />

            <Typography variant="subtitle2" color="text.secondary">
              未収（売掛）
            </Typography>
            {receivables.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                なし
              </Typography>
            ) : (
              <Table size="small">
                <TableBody>
                  {receivables.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell sx={{ pl: 0, py: 0.75 }}>
                        {getReceivableDisplayName(row, companyLookup)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ pr: 0, py: 0.75, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatYen(row.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {hasExpense && (
              <>
                <Divider />
                <Typography variant="subtitle2" color="text.secondary">
                  経費
                </Typography>
                <Table size="small" sx={{ '& td, & th': { px: 0 } }}>
                  <TableBody>
                    {expenseNote && <SummaryRow label="内容" value={expenseNote} />}
                    {expenseAmount > 0 && (
                      <SummaryRow label="金額" value={formatYen(expenseAmount)} />
                    )}
                  </TableBody>
                </Table>
              </>
            )}

            <Divider />

            <Table size="small" sx={{ '& td, & th': { px: 0 } }}>
              <TableBody>
                <SummaryRow
                  label="現金"
                  value={formatYen(vehicleCash)}
                  valueSx={{ fontWeight: 600 }}
                />
              </TableBody>
            </Table>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  )
}
