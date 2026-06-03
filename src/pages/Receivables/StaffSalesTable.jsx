import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableContainer from '@mui/material/TableContainer'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function toDateString(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function EditDayDialog({ open, workDate, staffRates, existingRows, onSave, onClose }) {
  const initial = useMemo(() => {
    const byName = new Map()
    for (const r of existingRows ?? []) byName.set(r.staff_name, r)
    return staffRates.map((rate) => {
      const r = byName.get(rate.staff_name)
      return {
        staff_name: rate.staff_name,
        sales: r?.sales ?? 0,
        hours: r?.hours ?? 0,
      }
    })
  }, [staffRates, existingRows])

  const [draft, setDraft] = useState(initial)

  const update = (idx, field, raw) => {
    setDraft((prev) => {
      const next = [...prev]
      const n = Number(raw)
      next[idx] = { ...next[idx], [field]: Number.isFinite(n) ? n : 0 }
      return next
    })
  }

  const handleSave = () => {
    const rows = draft.map((d) => ({
      work_date: workDate,
      staff_name: d.staff_name,
      sales: d.sales,
      hours: d.hours,
    }))
    onSave(rows)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{workDate} のスタッフ別売上・稼働時間</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 1, mt: 1 }}>
          <Typography variant="caption" color="text.secondary">スタッフ</Typography>
          <Typography variant="caption" color="text.secondary" align="right">売上 (¥)</Typography>
          <Typography variant="caption" color="text.secondary" align="right">稼働 (h)</Typography>
          {draft.map((d, idx) => (
            <Box key={d.staff_name} sx={{ display: 'contents' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>{d.staff_name}</Box>
              <TextField
                type="number"
                size="small"
                value={d.sales}
                onChange={(e) => update(idx, 'sales', e.target.value)}
                inputProps={{ step: 1, style: { textAlign: 'right' } }}
              />
              <TextField
                type="number"
                size="small"
                value={d.hours}
                onChange={(e) => update(idx, 'hours', e.target.value)}
                inputProps={{ step: 0.25, style: { textAlign: 'right' } }}
              />
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={handleSave}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * スタッフ別売上テーブル (縦=スタッフ, 横=1〜末日)。
 * - セルクリックで「その日のスタッフ全員分」ダイアログを開く
 * - 表示は 売上 / 稼働時間 を 2 行で表示
 */
export function StaffSalesTable({ year, month, staffRates, rows, onBulkUpsert }) {
  const totalDays = daysInMonth(year, month)
  const [openDate, setOpenDate] = useState(null)

  const grid = useMemo(() => {
    // key: work_date → Map<staff_name, row>
    const map = new Map()
    for (const r of rows ?? []) {
      if (!map.has(r.work_date)) map.set(r.work_date, new Map())
      map.get(r.work_date).set(r.staff_name, r)
    }
    return map
  }, [rows])

  const existingForDate = useMemo(() => {
    if (!openDate) return []
    const sub = grid.get(openDate)
    return sub ? Array.from(sub.values()) : []
  }, [grid, openDate])

  const totalsByStaff = useMemo(() => {
    const result = new Map()
    for (const r of rows ?? []) {
      const cur = result.get(r.staff_name) ?? { sales: 0, hours: 0 }
      cur.sales += Number(r.sales) || 0
      cur.hours += Number(r.hours) || 0
      result.set(r.staff_name, cur)
    }
    return result
  }, [rows])

  const handleSave = async (newRows) => {
    await onBulkUpsert(newRows)
    setOpenDate(null)
  }

  if (!staffRates || staffRates.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">スタッフ単価が未設定です</Typography>
      </Paper>
    )
  }

  return (
    <>
      <TableContainer component={Paper}>
        <Table size="small" sx={{ '& td, & th': { px: 0.75, py: 0.5 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 110, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 2 }}>
                スタッフ
              </TableCell>
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
                <TableCell key={day} align="center" sx={{ minWidth: 56 }}>
                  {day}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ minWidth: 110, fontWeight: 600 }}>
                月合計
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {staffRates.map((rate) => {
              const total = totalsByStaff.get(rate.staff_name) ?? { sales: 0, hours: 0 }
              return (
                <TableRow key={rate.staff_name} hover>
                  <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1, fontWeight: 500 }}>
                    {rate.staff_name}
                    <Typography variant="caption" color="text.secondary" display="block">
                      {rate.rate_type === 'commission'
                        ? `歩合 ${(Number(rate.commission_rate) * 100).toFixed(0)}%`
                        : `時給 ¥${Number(rate.hourly_rate).toLocaleString('ja-JP')}`}
                    </Typography>
                  </TableCell>
                  {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                    const workDate = toDateString(year, month, day)
                    const cell = grid.get(workDate)?.get(rate.staff_name)
                    const hasValue = cell && (Number(cell.sales) > 0 || Number(cell.hours) > 0)
                    return (
                      <TableCell
                        key={day}
                        align="center"
                        onClick={() => setOpenDate(workDate)}
                        sx={{
                          cursor: 'pointer',
                          fontVariantNumeric: 'tabular-nums',
                          fontSize: 11,
                          lineHeight: 1.2,
                          '&:hover': { bgcolor: 'action.hover' },
                          color: hasValue ? 'text.primary' : 'text.disabled',
                        }}
                      >
                        {hasValue ? (
                          <>
                            <Box>{Number(cell.sales).toLocaleString('ja-JP')}</Box>
                            <Box sx={{ color: 'text.secondary' }}>{Number(cell.hours).toFixed(2)}h</Box>
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    <Box>¥{total.sales.toLocaleString('ja-JP')}</Box>
                    <Box sx={{ color: 'text.secondary', fontWeight: 400 }}>
                      {total.hours.toFixed(2)}h
                    </Box>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <Box sx={{ p: 1, color: 'text.secondary', fontSize: 12 }}>
          <Typography variant="caption">セルをクリックでその日のスタッフ全員分を編集</Typography>
        </Box>
      </TableContainer>

      {openDate && (
        <EditDayDialog
          open={!!openDate}
          workDate={openDate}
          staffRates={staffRates}
          existingRows={existingForDate}
          onSave={handleSave}
          onClose={() => setOpenDate(null)}
        />
      )}
    </>
  )
}
