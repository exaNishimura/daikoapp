import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreIcon from '@mui/icons-material/Restore'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  useCompanies,
  useCreateCompany,
  useUpdateCompany,
  useDeactivateCompany,
  useReorderCompanies,
} from '@/hooks/billing/useCompanies'
import { CompanyEditDialog } from './CompanyEditDialog'

function SortableRow({ company, onEdit, onToggleActive, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: company.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : company.is_active ? 1 : 0.55,
    backgroundColor: isDragging ? 'rgba(100, 108, 255, 0.08)' : undefined,
  }

  return (
    <TableRow ref={setNodeRef} style={style} hover>
      <TableCell width={36}>
        <Box
          {...attributes}
          {...listeners}
          sx={{
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            color: 'text.secondary',
            '&:active': { cursor: 'grabbing' },
          }}
          aria-label="並び替え"
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {company.name}
        </Typography>
        {company.invoice_display_name && company.invoice_display_name !== company.name && (
          <Typography variant="caption" color="text.secondary">
            請求書表記: {company.invoice_display_name}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {(company.aliases ?? []).map((a) => (
            <Chip key={a} label={a} size="small" variant="outlined" />
          ))}
        </Box>
      </TableCell>
      <TableCell align="right">{company.display_order ?? 0}</TableCell>
      <TableCell>
        {company.is_active ? (
          <Chip label="有効" color="success" size="small" />
        ) : (
          <Chip label="無効" size="small" />
        )}
      </TableCell>
      <TableCell sx={{ maxWidth: 240, color: 'text.secondary' }}>{company.memo || '—'}</TableCell>
      <TableCell align="center" width={120}>
        <IconButton
          size="small"
          onClick={() => onEdit(company)}
          disabled={disabled}
          color="primary"
          aria-label="編集"
        >
          <EditIcon fontSize="small" />
        </IconButton>
        {company.is_active ? (
          <IconButton
            size="small"
            onClick={() => onToggleActive(company, false)}
            disabled={disabled}
            color="error"
            aria-label="無効化"
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        ) : (
          <IconButton
            size="small"
            onClick={() => onToggleActive(company, true)}
            disabled={disabled}
            color="success"
            aria-label="有効化"
          >
            <RestoreIcon fontSize="small" />
          </IconButton>
        )}
      </TableCell>
    </TableRow>
  )
}

export function CompaniesPage() {
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const companiesQuery = useCompanies()
  const createMutation = useCreateCompany()
  const updateMutation = useUpdateCompany()
  const deactivateMutation = useDeactivateCompany()
  const reorderMutation = useReorderCompanies()

  const companies = useMemo(
    () =>
      [...(companiesQuery.data ?? [])].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
      ),
    [companiesQuery.data]
  )

  const isFetching = companiesQuery.isLoading
  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deactivateMutation.isPending ||
    reorderMutation.isPending
  const loading = isFetching || isMutating

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = companies.findIndex((c) => c.id === active.id)
    const newIndex = companies.findIndex((c) => c.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(companies, oldIndex, newIndex)
    const orderedRows = reordered.map((c, i) => ({ id: c.id, display_order: (i + 1) * 10 }))

    try {
      setError(null)
      await reorderMutation.mutateAsync(orderedRows)
      setSuccess('並び順を更新しました')
    } catch (err) {
      setError(`並び替えの保存に失敗: ${err.message}`)
    }
  }

  const handleOpenNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const handleEdit = (company) => {
    setEditing(company)
    setDialogOpen(true)
  }

  const handleSave = async (payload) => {
    setError(null)
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, payload })
      setSuccess('取引先を更新しました')
    } else {
      await createMutation.mutateAsync(payload)
      setSuccess('取引先を作成しました')
    }
  }

  const handleToggleActive = async (company, nextActive) => {
    setError(null)
    try {
      if (nextActive) {
        await updateMutation.mutateAsync({
          id: company.id,
          payload: { is_active: true },
        })
        setSuccess(`「${company.name}」を有効化しました`)
      } else {
        if (!confirm(`「${company.name}」を無効化しますか？\n売掛履歴は保持されます。`)) return
        await deactivateMutation.mutateAsync(company.id)
        setSuccess(`「${company.name}」を無効化しました`)
      }
    } catch (err) {
      setError(`状態変更に失敗: ${err.message}`)
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate(-1)} aria-label="戻る">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            取引先マスタ
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenNew}
          disabled={loading}
        >
          新規追加
        </Button>
      </Box>

      {companiesQuery.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          取引先データの取得に失敗: {companiesQuery.error.message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {isFetching && !companies.length && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography>読み込み中...</Typography>
        </Box>
      )}

      {!isFetching && companies.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="text.secondary">取引先が登録されていません</Typography>
        </Box>
      )}

      {companies.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>名前</TableCell>
                <TableCell>別名</TableCell>
                <TableCell align="right">並び順</TableCell>
                <TableCell>状態</TableCell>
                <TableCell>メモ</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={companies.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <TableBody>
                  {companies.map((c) => (
                    <SortableRow
                      key={c.id}
                      company={c}
                      onEdit={handleEdit}
                      onToggleActive={handleToggleActive}
                      disabled={loading}
                    />
                  ))}
                </TableBody>
              </SortableContext>
            </DndContext>
          </Table>
        </TableContainer>
      )}

      <CompanyEditDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        company={editing}
        existingCompanies={companies}
        onSave={handleSave}
        loading={isMutating}
      />
    </Box>
  )
}
