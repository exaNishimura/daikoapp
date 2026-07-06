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
import { useDailySaleByDate, useUpsertDailySale } from '@/hooks/billing/useDailySales'
import { calcDailyDerived } from '@/lib/billing/dailySalesCalc'
import {
  buildDailySalesUpsertPayload,
  readVehicleFormFromRow,
} from '@/lib/billing/vehicleSalesFields'

const EMPTY_FORM = { distance_km: '', fuel_yen: '', sales: '' }

export function VehicleSalesModal({ open, workDate, carNum, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const saleQuery = useDailySaleByDate(open ? workDate : null)
  const upsertMutation = useUpsertDailySale()

  const loading = saleQuery.isLoading || upsertMutation.isPending

  useEffect(() => {
    if (!open || !carNum) return
    setError(null)
    setSuccess(null)
  }, [open, workDate, carNum])

  useEffect(() => {
    if (!open || !carNum || saleQuery.isLoading) return
    setForm(readVehicleFormFromRow(saleQuery.data ?? null, carNum))
  }, [open, workDate, carNum, saleQuery.isLoading, saleQuery.dataUpdatedAt])

  const handleClose = () => {
    if (upsertMutation.isPending) return
    onClose()
  }

  const handleSave = async () => {
    if (!workDate || !carNum) return
    setError(null)
    setSuccess(null)

    try {
      const payload = buildDailySalesUpsertPayload(workDate, saleQuery.data ?? null, carNum, form)
      const saved = await upsertMutation.mutateAsync(payload)
      const derived = calcDailyDerived(saved)
      setSuccess(`保存しました（当日総売上: ¥${derived.total_sales.toLocaleString('ja-JP')}）`)
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
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {dateLabel} {carNum}号車 売上入力
      </DialogTitle>
      <DialogContent>
        {saleQuery.isLoading ? (
          <Stack alignItems="center" py={3}>
            <CircularProgress size={28} />
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}
            <TextField
              label="走行距離 (km)"
              type="number"
              value={form.distance_km}
              onChange={(e) => setForm((prev) => ({ ...prev, distance_km: e.target.value }))}
              inputProps={{ step: 0.1, min: 0 }}
              fullWidth
              disabled={loading}
            />
            <TextField
              label="燃料代 (円)"
              type="number"
              value={form.fuel_yen}
              onChange={(e) => setForm((prev) => ({ ...prev, fuel_yen: e.target.value }))}
              inputProps={{ step: 1, min: 0 }}
              fullWidth
              disabled={loading}
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
            />
            <Typography variant="caption" color="text.secondary">
              ログイン不要で保存できます
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={upsertMutation.isPending}>
          閉じる
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}
