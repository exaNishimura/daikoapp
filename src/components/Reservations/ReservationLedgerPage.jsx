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
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PhoneIcon from '@mui/icons-material/Phone'
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

function formatReservedAt(iso, compact = false) {
  return dayjs(iso).format(compact ? 'M/D HH:mm' : 'YYYY/MM/DD HH:mm')
}

function memoPreview(memo) {
  const t = String(memo ?? '').trim()
  if (!t) return ''
  return t.length > 80 ? `${t.slice(0, 80)}…` : t
}

function ReservationCard({ row, onOpen, onEdit, onDelete }) {
  const memo = memoPreview(row.memo)
  return (
    <article className="reservation-card">
      <button type="button" className="reservation-card__main" onClick={() => onOpen(row)}>
        <div className="reservation-card__time">{formatReservedAt(row.reserved_at, true)}</div>
        <div className="reservation-card__name">{row.customer_name}</div>
        <div className="reservation-card__phone">
          <PhoneIcon sx={{ fontSize: 16, opacity: 0.75 }} aria-hidden />
          <span>{row.phone}</span>
        </div>
        {memo ? <div className="reservation-card__memo">{memo}</div> : null}
      </button>
      <div className="reservation-card__actions">
        <IconButton
          size="large"
          aria-label="編集"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(row)
          }}
        >
          <EditIcon />
        </IconButton>
        <IconButton
          size="large"
          aria-label="削除"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(row)
          }}
        >
          <DeleteOutlineIcon />
        </IconButton>
      </div>
    </article>
  )
}

export function ReservationLedgerPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
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
    <Box className={`reservation-ledger${isMobile ? ' reservation-ledger--mobile' : ''}`}>
      <Stack
        direction={isMobile ? 'column' : 'row'}
        spacing={1.5}
        alignItems={isMobile ? 'stretch' : 'center'}
        justifyContent="space-between"
        className="reservation-ledger__header"
      >
        <Typography variant={isMobile ? 'h6' : 'h5'} component="h1">
          予約台帳
        </Typography>
        {!isMobile && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            新規登録
          </Button>
        )}
      </Stack>

      <Stack
        direction={isMobile ? 'column' : 'row'}
        spacing={1.5}
        className="reservation-ledger__filters"
        alignItems={isMobile ? 'stretch' : 'center'}
      >
        <DatePicker
          label="日付"
          value={dateFilter}
          onChange={handleDateChange}
          slotProps={{
            textField: {
              size: 'small',
              fullWidth: isMobile,
              sx: isMobile ? undefined : { minWidth: 180 },
            },
            field: { clearable: true },
          }}
        />
        <TextField
          size="small"
          label="氏名・電話で検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          fullWidth={isMobile}
          sx={isMobile ? undefined : { minWidth: 220 }}
        />
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {!dateFilter && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleDateChange(dayjs(formatDateInJst()))}
              sx={isMobile ? { flex: 1 } : undefined}
            >
              今日
            </Button>
          )}
          {dateFilter && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleDateChange(null)}
              sx={isMobile ? { flex: 1 } : undefined}
            >
              日付クリア
            </Button>
          )}
        </Stack>
      </Stack>

      {listQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {listQuery.error?.message || '一覧の取得に失敗しました'}
        </Alert>
      )}

      {listQuery.isLoading && (
        <Typography className="reservation-ledger__status">読み込み中...</Typography>
      )}

      {!listQuery.isLoading && rows.length === 0 && (
        <Typography className="reservation-ledger__empty">
          条件に一致する予約はありません
        </Typography>
      )}

      {!listQuery.isLoading && rows.length > 0 && isMobile && (
        <div className="reservation-ledger__cards">
          {rows.map((row) => (
            <ReservationCard
              key={row.id}
              row={row}
              onOpen={setDetail}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {!listQuery.isLoading && rows.length > 0 && !isMobile && (
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
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  hover
                  onClick={() => setDetail(row)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{formatReservedAt(row.reserved_at)}</TableCell>
                  <TableCell>{row.customer_name}</TableCell>
                  <TableCell>{row.phone}</TableCell>
                  <TableCell>{memoPreview(row.memo) || '—'}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" aria-label="編集" onClick={() => openEdit(row)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label="削除" onClick={() => setDeleteTarget(row)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {isMobile && (
        <div className="reservation-ledger__fab">
          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<AddIcon />}
            onClick={openCreate}
          >
            新規登録
          </Button>
        </div>
      )}

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

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="xs"
      >
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
        <DialogActions
          sx={{
            flexDirection: isMobile ? 'column-reverse' : 'row',
            gap: isMobile ? 1 : 0,
            px: isMobile ? 2 : undefined,
            pb: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : undefined,
          }}
        >
          <Button onClick={() => setDeleteTarget(null)} fullWidth={isMobile}>
            キャンセル
          </Button>
          <Button
            color="error"
            variant="contained"
            fullWidth={isMobile}
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

      <Dialog
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>予約詳細</DialogTitle>
        <DialogContent>
          {detail && (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Typography variant="body1">
                <span className="reservation-detail__label">日時</span>
                {formatReservedAt(detail.reserved_at)}
              </Typography>
              <Typography variant="body1">
                <span className="reservation-detail__label">顧客名</span>
                {detail.customer_name}
              </Typography>
              <Typography variant="body1">
                <span className="reservation-detail__label">電話</span>
                <a className="reservation-detail__tel" href={`tel:${detail.phone}`}>
                  {detail.phone}
                </a>
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                <span className="reservation-detail__label">メモ</span>
                {detail.memo?.trim() ? detail.memo : '（なし）'}
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            flexDirection: isMobile ? 'column-reverse' : 'row',
            gap: isMobile ? 1 : 0,
            px: isMobile ? 2 : undefined,
            pb: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : undefined,
          }}
        >
          <Button onClick={() => setDetail(null)} fullWidth={isMobile}>
            閉じる
          </Button>
          <Button
            variant="contained"
            fullWidth={isMobile}
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
