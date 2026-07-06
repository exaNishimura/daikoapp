import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import { useDailySaleByDate, useUpsertDailySale } from '@/hooks/billing/useDailySales'
import {
  useDailyStaffSalesByDate,
  useUpsertDailyStaffSalesBatch,
} from '@/hooks/billing/useDailyStaffSales'
import {
  useReceivablesByWorkDate,
  useReplaceShiftReceivables,
} from '@/hooks/billing/useReceivables'
import { useCompanies } from '@/hooks/billing/useCompanies'
import { ReceivableLinesEditor } from '@/components/Receivables/ReceivableLinesEditor'
import { useUpdateShiftsBulk } from '@/hooks/useShifts'
import { calcDailyDerived } from '@/lib/billing/dailySalesCalc'
import { sumShiftTimesHours } from '@/lib/billing/shiftStaffHours'
import { sumReceivableAmounts, isShiftEditableReceivable } from '@/lib/billing/shiftReceivables'
import {
  buildVehicleSalesSavePayload,
  readVehicleSalesForm,
} from '@/lib/billing/vehicleSalesForm'

const EMPTY_FORM = {
  distance_km: '',
  fuel_yen: '',
  sales: '',
  shiftTimes: [],
  expense_note: '',
  expense_amount: '',
  receivables: [{ company_id: null, amount: '', note: '' }],
}

function ShiftTimeField({ label, value, onChange, disabled, fullWidth = false }) {
  return (
    <TextField
      label={label}
      type="time"
      value={value}
      onChange={onChange}
      size="small"
      disabled={disabled}
      fullWidth={fullWidth}
      InputLabelProps={{ shrink: true }}
      inputProps={{ style: { fontVariantNumeric: 'tabular-nums' } }}
      sx={fullWidth ? undefined : { maxWidth: 108 }}
    />
  )
}

export function VehicleSalesModal({ open, workDate, carNum, dayShifts = [], employees = [], onClose }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const saleQuery = useDailySaleByDate(open ? workDate : null)
  const staffSalesQuery = useDailyStaffSalesByDate(open ? workDate : null)
  const receivablesQuery = useReceivablesByWorkDate(open ? workDate : null)
  const companiesQuery = useCompanies({ activeOnly: true })
  const upsertMutation = useUpsertDailySale()
  const upsertStaffMutation = useUpsertDailyStaffSalesBatch()
  const replaceReceivablesMutation = useReplaceShiftReceivables()
  const updateShiftsMutation = useUpdateShiftsBulk()

  const dataLoading =
    saleQuery.isLoading ||
    staffSalesQuery.isLoading ||
    receivablesQuery.isLoading ||
    companiesQuery.isLoading
  const saving =
    upsertMutation.isPending ||
    upsertStaffMutation.isPending ||
    replaceReceivablesMutation.isPending ||
    updateShiftsMutation.isPending
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

  const handleShiftTimeChange = (shiftId, field, value) => {
    setForm((prev) => ({
      ...prev,
      shiftTimes: prev.shiftTimes.map((row) =>
        row.shiftId === shiftId ? { ...row, [field]: value } : row
      ),
    }))
  }

  const handleSave = async () => {
    if (!workDate || !carNum) return
    setError(null)
    setSuccess(null)

    const incompleteShift = form.shiftTimes.find((row) => {
      const hasStart = Boolean(row.start)
      const hasEnd = Boolean(row.end)
      return (hasStart && !hasEnd) || (!hasStart && hasEnd)
    })
    if (incompleteShift) {
      setError('勤務時間は開始・終了を両方入力してください')
      return
    }

    try {
      const receivableResult = await replaceReceivablesMutation.mutateAsync({
        workDate,
        carNum,
        lines: form.receivables,
      })

      const { dailyPayload, staffRows, shiftUpdates } = buildVehicleSalesSavePayload({
        workDate,
        existingRow: saleQuery.data ?? null,
        carNum,
        form,
        dayShifts,
        employees,
        existingStaffRows: staffSalesQuery.data ?? [],
        receivableTotal: receivableResult.receivable_total,
      })

      if (shiftUpdates.length > 0) {
        await updateShiftsMutation.mutateAsync(shiftUpdates)
      }

      const saved = await upsertMutation.mutateAsync(dailyPayload)
      if (staffRows.length > 0) {
        await upsertStaffMutation.mutateAsync({ workDate, rows: staffRows })
      }

      const derived = calcDailyDerived(saved)
      const hasOtherReceivables = (receivablesQuery.data ?? []).some(
        (row) => !isShiftEditableReceivable(row, carNum)
      )
      let message = `保存しました（総売上: ¥${derived.total_sales.toLocaleString('ja-JP')} / 人件費: ¥${saved.labor_cost?.toLocaleString('ja-JP') ?? 0} / 現金: ¥${saved.cash?.toLocaleString('ja-JP') ?? 0} / 売掛: ¥${receivableResult.receivable_total.toLocaleString('ja-JP')}）`
      if (hasOtherReceivables) {
        message += ' ※他号車・売掛一覧の売掛を含む合計です。'
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
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen={isMobile}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <DialogTitle sx={{ py: isMobile ? 1.5 : 2, fontSize: isMobile ? '1rem' : undefined }}>
        {dateLabel} {carNum}号車 売上入力
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          px: isMobile ? 2 : 3,
          py: isMobile ? 2 : undefined,
        }}
      >
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

            <Stack
              direction={isMobile ? 'column' : 'row'}
              alignItems={isMobile ? 'stretch' : 'baseline'}
              justifyContent="space-between"
              spacing={isMobile ? 0.5 : 0}
            >
              <Typography variant="subtitle2" color="text.secondary">
                {carNum}号車 実績勤務時間
              </Typography>
              <Typography variant="caption" color="text.secondary">
                合計 {sumShiftTimesHours(form.shiftTimes)}h
              </Typography>
            </Stack>
            {form.shiftTimes.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                この号車のシフトがありません
              </Typography>
            ) : isMobile ? (
              <Stack spacing={1.5}>
                {form.shiftTimes.map((row) => (
                  <Box
                    key={row.shiftId}
                    sx={{
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 1.5,
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {row.staffName}
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                        {row.role}
                      </Typography>
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                      <ShiftTimeField
                        label="開始"
                        value={row.start}
                        onChange={(e) =>
                          handleShiftTimeChange(row.shiftId, 'start', e.target.value)
                        }
                        disabled={loading}
                        fullWidth
                      />
                      <ShiftTimeField
                        label="終了"
                        value={row.end}
                        onChange={(e) =>
                          handleShiftTimeChange(row.shiftId, 'end', e.target.value)
                        }
                        disabled={loading}
                        fullWidth
                      />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Table size="small" sx={{ '& td, & th': { py: 0.5, px: 1 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>スタッフ</TableCell>
                    <TableCell width={56}>役割</TableCell>
                    <TableCell width={110}>開始</TableCell>
                    <TableCell width={110}>終了</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {form.shiftTimes.map((row) => (
                    <TableRow key={row.shiftId}>
                      <TableCell>{row.staffName}</TableCell>
                      <TableCell>{row.role}</TableCell>
                      <TableCell>
                        <ShiftTimeField
                          value={row.start}
                          onChange={(e) =>
                            handleShiftTimeChange(row.shiftId, 'start', e.target.value)
                          }
                          disabled={loading}
                        />
                      </TableCell>
                      <TableCell>
                        <ShiftTimeField
                          value={row.end}
                          onChange={(e) =>
                            handleShiftTimeChange(row.shiftId, 'end', e.target.value)
                          }
                          disabled={loading}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <Typography variant="caption" color="text.secondary">
              保存するとシフト表のタイムラインにも反映されます
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
              companies={companiesQuery.data ?? []}
            />
            <Typography variant="caption" color="text.secondary" display="block">
              複数行入力可。請求先を選択すると売掛一覧に反映されます。
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
      <DialogActions
        sx={{
          flexDirection: isMobile ? 'column-reverse' : 'row',
          alignItems: 'stretch',
          gap: 1,
          px: isMobile ? 2 : undefined,
          py: isMobile ? 2 : undefined,
          pb: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : undefined,
        }}
      >
        <Button onClick={handleClose} disabled={saving} fullWidth={isMobile}>
          閉じる
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={loading} fullWidth={isMobile}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}
