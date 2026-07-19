import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Stack from '@mui/material/Stack'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import {
  useCreateReservation,
  useDeleteReservation,
  useReservations,
  useUpdateReservation,
} from '@/hooks/useReservations'
import { formatDateInJst } from '@/lib/reservation/reservationWindowUtils'
import { ReservationFormDialog } from './ReservationFormDialog'
import './ReservationLedgerPage.css'

function formatReservedAt(iso) {
  return dayjs(iso).format('YYYY/MM/DD HH:mm')
}

function memoPreview(memo) {
  const t = String(memo ?? '').trim()
  if (!t) return '—'
  return t.length > 40 ? `${t.slice(0, 40)}…` : t
}

export function ReservationLedgerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || ''
  const dateFilter = dateParam ? dayjs(dateParam) : null

  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250)
    return () => clearTimeout(t)
  }, [q])

  const filters = useMemo(() => {
    const f = {}
    if (dateFilter?.isValid?.()) {
      const key = dateFilter.format('YYYY-MM-DD')
      f.dateFrom = key
      f.dateTo = key
    }
    if (qDebounced.trim()) f.q = qDebounced.trim()
    return f
  }, [dateFilter, qDebounced])

  const listQuery = useReservations(filters)
  const createMut = useCreateReservation()
  const updateMut = useUpdateReservation()
  const deleteMut = useDeleteReservation()

  const rows = listQuery.data ?? []

  const handleDateChange = (next) => {
    if (next?.isValid?.()) {
      setSearchParams({ date: next.format('YYYY-MM-DD') })
    } else {
      setSearchParams({})
    }
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setFormOpen(true)
  }

  return (
    <Box className="reservation-ledger">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        className="reservation-ledger__header"
      >
        <Typography variant="h5" component="h1">
          予約台帳
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          新規登録
        </Button>
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        className="reservation-ledger__filters"
      >
        <DatePicker
          label="日付"
          value={dateFilter}
          onChange={handleDateChange}
          slotProps={{
            textField: { size: 'small', sx: { minWidth: 180 } },
            field: { clearable: true },
          }}
        />
        <TextField
          size="small"
          label="氏名・電話で検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        {!dateFilter && (
          <Button size="small" onClick={() => handleDateChange(dayjs(formatDateInJst()))}>
            今日
          </Button>
        )}
      </Stack>

      {listQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {listQuery.error?.message || '一覧の取得に失敗しました'}
        </Alert>
      )}

      <TableContainer component={Paper} className="reservation-ledger__table">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>予約日時</TableCell>
              <TableCell>顧客名</TableCell>
              <TableCell>電話</TableCell>
              <TableCell>メモ</TableCell>
              <TableCell align="right" width={120}>
                操作
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {listQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={5}>読み込み中...</TableCell>
              </TableRow>
            )}
            {!listQuery.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="reservation-ledger__empty">
                  条件に一致する予約はありません
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id} hover onClick={() => setDetail(row)} sx={{ cursor: 'pointer' }}>
                <TableCell>{formatReservedAt(row.reserved_at)}</TableCell>
                <TableCell>{row.customer_name}</TableCell>
                <TableCell>{row.phone}</TableCell>
                <TableCell>{memoPreview(row.memo)}</TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <IconButton size="small" aria-label="編集" onClick={() => openEdit(row)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="削除"
                    onClick={() => setDeleteTarget(row)}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ReservationFormDialog
        open={formOpen}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={async (payload) => {
          if (editing?.id) {
            await updateMut.mutateAsync({ id: editing.id, patch: payload })
          } else {
            await createMut.mutateAsync(payload)
          }
        }}
      />

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>予約を削除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {deleteTarget
              ? `${formatReservedAt(deleteTarget.reserved_at)} ${deleteTarget.customer_name} を削除しますか？`
              : ''}
          </DialogContentText>
          {deleteMut.isError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {deleteMut.error?.message || '削除に失敗しました'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>キャンセル</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMut.isPending}
            onClick={async () => {
              await deleteMut.mutateAsync(deleteTarget.id)
              setDeleteTarget(null)
            }}
          >
            削除
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="sm">
        <DialogTitle>予約詳細</DialogTitle>
        <DialogContent>
          {detail && (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Typography>日時: {formatReservedAt(detail.reserved_at)}</Typography>
              <Typography>顧客名: {detail.customer_name}</Typography>
              <Typography>電話: {detail.phone}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                メモ: {detail.memo?.trim() ? detail.memo : '（なし）'}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetail(null)}>閉じる</Button>
          <Button
            onClick={() => {
              openEdit(detail)
              setDetail(null)
            }}
          >
            編集
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
