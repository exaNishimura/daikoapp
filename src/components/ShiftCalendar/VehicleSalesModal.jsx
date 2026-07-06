import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { useDailySaleByDate, useUpsertDailySale } from '@/hooks/billing/useDailySales'
import {
  useDailyStaffSalesByDate,
  useUpsertDailyStaffSalesBatch,
} from '@/hooks/billing/useDailyStaffSales'
import {
  useReceivablesByWorkDate,
  useReplaceShiftReceivables,
} from '@/hooks/billing/useReceivables'
import { ReceivableLinesEditor } from '@/components/Receivables/ReceivableLinesEditor'
import { calcDailyDerived } from '@/lib/billing/dailySalesCalc'
import { sumStaffHours } from '@/lib/billing/shiftStaffHours'
import { sumReceivableAmounts, sumReceivableFormAmounts } from '@/lib/billing/shiftReceivables'
import {
  buildVehicleSalesSavePayload,
  readVehicleSalesForm,
} from '@/lib/billing/vehicleSalesForm'

const EMPTY_FORM = {
  distance_km: '',
  fuel_yen: '',
  sales: '',
  staffHours: [],
  expense_note: '',
  expense_amount: '',
  receivables: [{ amount: '', note: '' }],
}

export function VehicleSalesModal({ open, workDate, carNum, dayShifts = [], employees = [], onClose }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const saleQuery = useDailySaleByDate(open ? workDate : null)
  const staffSalesQuery = useDailyStaffSalesByDate(open ? workDate : null)
  const receivablesQuery = useReceivablesByWorkDate(open ? workDate : null)
  const upsertMutation = useUpsertDailySale()
  const upsertStaffMutation = useUpsertDailyStaffSalesBatch()
  const replaceReceivablesMutation = useReplaceShiftReceivables()

  const dataLoading =
    saleQuery.isLoading || staffSalesQuery.isLoading || receivablesQuery.isLoading
  const saving =
    upsertMutation.isPending ||
    upsertStaffMutation.isPending ||
    replaceReceivablesMutation.isPending
  const loading = dataLoading || saving

  useEffect(() => {
    if (!open || !carNum) return
    setError(null)
    setSuccess(null)
  }, [open, workDate, carNum])

  useEffect(() => {
    if (!open || !carNum || dataLoading) return
    setForm(
      readVehicleSalesForm({
        dailyRow: saleQuery.data ?? null,
        carNum,
        dayShifts,
        employees,
        savedStaffRows: staffSalesQuery.data ?? [],
        receivableRows: receivablesQuery.data ?? [],
      })
    )
  }, [
    open,
    workDate,
    carNum,
    dataLoading,
    saleQuery.dataUpdatedAt,
    staffSalesQuery.dataUpdatedAt,
    receivablesQuery.dataUpdatedAt,
    // dayShifts/employees はデータ取得完了時のスナップショットを使用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ])

  const handleClose = () => {
    if (saving) return
    onClose()
  }

  const handleStaffHoursChange = (staffName, value) => {
    setForm((prev) => ({
      ...prev,
      staffHours: prev.staffHours.map((row) =>
        row.staffName === staffName ? { ...row, hours: value } : row
      ),
    }))
  }

  const handleSave = async () => {
    if (!workDate || !carNum) return
    setError(null)
    setSuccess(null)

    try {
      const receivableResult = await replaceReceivablesMutation.mutateAsync({
        workDate,
        lines: form.receivables,
      })

      const { dailyPayload, staffRows } = buildVehicleSalesSavePayload({
        workDate,
        existingRow: saleQuery.data ?? null,
        carNum,
        form,
        dayShifts,
        employees,
        existingStaffRows: staffSalesQuery.data ?? [],
        receivableTotal: receivableResult.receivable_total,
      })

      const saved = await upsertMutation.mutateAsync(dailyPayload)
      if (staffRows.length > 0) {
        await upsertStaffMutation.mutateAsync({ workDate, rows: staffRows })
      }

      const derived = calcDailyDerived(saved)
      const hasAssignedReceivables =
        sumReceivableAmounts(receivablesQuery.data ?? []) >
        sumReceivableFormAmounts(form.receivables)
      let message = `保存しました（総売上: ¥${derived.total_sales.toLocaleString('ja-JP')} / 人件費: ¥${saved.labor_cost?.toLocaleString('ja-JP') ?? 0} / 現金: ¥${saved.cash?.toLocaleString('ja-JP') ?? 0} / 売掛: ¥${receivableResult.receivable_total.toLocaleString('ja-JP')}）`
      if (hasAssignedReceivables) {
        message += ' ※請求先割当済みの売掛を含む合計です。'
      }
      setSuccess(message)
    } catch (err) {
      setError(`保存に失敗しました: ${err.message}`)
    }
  }

  const dateLabel = workDate
    ? (() => {
        const [y, m, d] = workDate.split('-').map(Number)
        return `${y}年${m}月${d}日`
      })()
    : ''

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {dateLabel} {carNum}号車 売上入力
      </DialogTitle>
      <DialogContent>
        {dataLoading ? (
          <Stack alignItems="center" py={3}>
            <CircularProgress size={28} />
          </Stack>
        ) : (
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}

            <Typography variant="subtitle2" color="text.secondary">
              号車売上
            </Typography>
            <TextField
              label="走行距離 (km)"
              type="number"
              value={form.distance_km}
              onChange={(e) => setForm((prev) => ({ ...prev, distance_km: e.target.value }))}
              inputProps={{ step: 0.1, min: 0 }}
              fullWidth
              disabled={loading}
              size="small"
            />
            <TextField
              label="燃料代 (円)"
              type="number"
              value={form.fuel_yen}
              onChange={(e) => setForm((prev) => ({ ...prev, fuel_yen: e.target.value }))}
              inputProps={{ step: 1, min: 0 }}
              fullWidth
              disabled={loading}
              size="small"
            />
            <TextField
              label="売上 (円)"
              type="number"
              value={form.sales}
              onChange={(e) => setForm((prev) => ({ ...prev, sales: e.target.value }))}
              inputProps={{ step: 1, min: 0 }}
              fullWidth
              required
              disabled={loading}
              size="small"
            />

            <Divider />

            <Stack direction="row" alignItems="baseline" justifyContent="space-between">
              <Typography variant="subtitle2" color="text.secondary">
                {carNum}号車 スタッフ稼働時間
              </Typography>
              <Typography variant="caption" color="text.secondary">
                合計 {sumStaffHours(form.staffHours)}h
              </Typography>
            </Stack>
            {form.staffHours.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                この号車のシフトがありません
              </Typography>
            ) : (
              <Table size="small" sx={{ '& td, & th': { py: 0.5, px: 1 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>スタッフ</TableCell>
                    <TableCell align="right" width={120}>
                      稼働 (h)
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {form.staffHours.map((row) => (
                    <TableRow key={row.staffName}>
                      <TableCell>{row.staffName}</TableCell>
                      <TableCell align="right">
                        <TextField
                          value={row.hours}
                          onChange={(e) => handleStaffHoursChange(row.staffName, e.target.value)}
                          type="number"
                          inputProps={{
                            step: 0.25,
                            min: 0,
                            style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
                          }}
                          size="small"
                          disabled={loading}
                          sx={{ maxWidth: 100 }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <Typography variant="caption" color="text.secondary">
              {carNum}号車のシフトから自動計算（編集可）
            </Typography>

            <Divider />

            <Typography variant="subtitle2" color="text.secondary">
              その他経費
            </Typography>
            <TextField
              label="経費内容"
              value={form.expense_note}
              onChange={(e) => setForm((prev) => ({ ...prev, expense_note: e.target.value }))}
              fullWidth
              disabled={loading}
              size="small"
            />
            <TextField
              label="経費額 (円)"
              type="number"
              value={form.expense_amount}
              onChange={(e) => setForm((prev) => ({ ...prev, expense_amount: e.target.value }))}
              inputProps={{ step: 1, min: 0 }}
              fullWidth
              disabled={loading}
              size="small"
            />

            <Divider />

            <Typography variant="subtitle2" color="text.secondary">
              未収（売掛・請求書払い）
            </Typography>
            <ReceivableLinesEditor
              lines={form.receivables}
              onChange={(receivables) => setForm((prev) => ({ ...prev, receivables }))}
              disabled={loading}
            />
            <Typography variant="caption" color="text.secondary" display="block">
              複数行入力可。請求先は売掛一覧で後から割り当てられます。
              {receivablesQuery.data?.length > 0 && (
                <>
                  {' '}
                  当日合計: ¥
                  {sumReceivableAmounts(receivablesQuery.data).toLocaleString('ja-JP')}
                </>
              )}
            </Typography>

            <Typography variant="caption" color="text.secondary">
              ログイン不要で保存できます
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          閉じる
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}
