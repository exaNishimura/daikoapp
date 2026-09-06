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
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Spinner } from '@astryxdesign/core/Spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { ArrowLeft, GripVertical, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { PageFrame } from '@/components/PageFrame'
import {
  useCompanies,
  useCreateCompany,
  useUpdateCompany,
  useDeactivateCompany,
  useDeleteCompany,
  useReorderCompanies,
} from '@/hooks/billing/useCompanies'
import { CompanyEditDialog } from './CompanyEditDialog'

function SortableRow({ company, onEdit, onToggleActive, onDelete, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: company.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : company.is_active ? 1 : 0.55,
    backgroundColor: isDragging ? 'var(--color-background-blue)' : undefined,
  }

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <HStack
          {...attributes}
          {...listeners}
          vAlign="center"
          style={{ cursor: 'grab' }}
          aria-label="並び替え"
        >
          <GripVertical size={16} color="var(--color-text-secondary)" />
        </HStack>
      </TableCell>
      <TableCell>
        <VStack gap={0}>
          <Text weight="medium">{company.name}</Text>
          {company.invoice_display_name && company.invoice_display_name !== company.name ? (
            <Text size="sm" color="secondary">
              請求書表記: {company.invoice_display_name}
            </Text>
          ) : null}
        </VStack>
      </TableCell>
      <TableCell>
        <HStack gap={1} wrap="wrap">
          {(company.aliases ?? []).map((a) => (
            <Token key={a} size="sm" label={a} />
          ))}
        </HStack>
      </TableCell>
      <TableCell style={{ textAlign: 'right' }}>{company.display_order ?? 0}</TableCell>
      <TableCell>
        {company.is_active ? (
          <Token size="sm" color="green" label="有効" />
        ) : (
          <Token size="sm" color="gray" label="無効" />
        )}
      </TableCell>
      <TableCell>
        <Text color="secondary">{company.memo || '—'}</Text>
      </TableCell>
      <TableCell>
        <HStack gap={0} hAlign="center">
          <IconButton
            size="sm"
            variant="ghost"
            label="編集"
            tooltip="編集"
            icon={<Pencil />}
            onClick={() => onEdit(company)}
            isDisabled={disabled}
          />
          {company.is_active ? (
            <IconButton
              size="sm"
              variant="destructive"
              label="無効化"
              tooltip="無効化"
              icon={<Trash2 />}
              onClick={() => onToggleActive(company, false)}
              isDisabled={disabled}
            />
          ) : (
            <IconButton
              size="sm"
              variant="ghost"
              label="有効化"
              tooltip="有効化"
              icon={<RotateCcw />}
              onClick={() => onToggleActive(company, true)}
              isDisabled={disabled}
            />
          )}
          {!company.is_active ? (
            <IconButton
              size="sm"
              variant="destructive"
              label="削除"
              tooltip="完全に削除"
              icon={<Trash2 />}
              onClick={() => onDelete(company)}
              isDisabled={disabled}
            />
          ) : null}
        </HStack>
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
  const deleteMutation = useDeleteCompany()
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
    deleteMutation.isPending ||
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

  const handleDelete = async (company) => {
    if (company.is_active) {
      setError('有効な取引先は削除できません。先に無効化してください')
      return
    }
    if (
      !confirm(
        `「${company.name}」を完全に削除しますか？\nこの操作は取り消せません。売掛・請求書が残っている場合は削除できません。`
      )
    ) {
      return
    }
    setError(null)
    try {
      await deleteMutation.mutateAsync(company.id)
      setSuccess(`「${company.name}」を削除しました`)
    } catch (err) {
      setError(`削除に失敗: ${err.message}`)
    }
  }

  return (
    <PageFrame>
      <VStack gap={4}>
        <HStack gap={2} wrap="wrap" vAlign="center" hAlign="between">
          <HStack gap={2} vAlign="center">
            <IconButton
              label="戻る"
              icon={<ArrowLeft />}
              variant="ghost"
              onClick={() => navigate(-1)}
            />
            <Heading level={1}>取引先マスタ</Heading>
          </HStack>
          <Button
            variant="primary"
            icon={<Plus />}
            label="新規追加"
            onClick={handleOpenNew}
            isDisabled={loading}
          />
        </HStack>

        {companiesQuery.error ? (
          <Banner
            status="error"
            title={`取引先データの取得に失敗: ${companiesQuery.error.message}`}
            collapsible={false}
          />
        ) : null}
        {error ? (
          <Banner
            status="error"
            title={error}
            isDismissable
            onDismiss={() => setError(null)}
            collapsible={false}
          />
        ) : null}
        {success ? (
          <Banner
            status="success"
            title={success}
            isDismissable
            onDismiss={() => setSuccess(null)}
            collapsible={false}
          />
        ) : null}

        {isFetching && !companies.length ? (
          <Center padding={4}>
            <Spinner />
          </Center>
        ) : null}

        {!isFetching && companies.length === 0 ? (
          <Center padding={4}>
            <Text color="secondary">取引先が登録されていません</Text>
          </Center>
        ) : null}

        {companies.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={companies.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <Table density="compact" hasHover>
                <TableHeader>
                  <TableRow isHeaderRow>
                    <TableHeaderCell />
                    <TableHeaderCell>名前</TableHeaderCell>
                    <TableHeaderCell>別名</TableHeaderCell>
                    <TableHeaderCell>並び順</TableHeaderCell>
                    <TableHeaderCell>状態</TableHeaderCell>
                    <TableHeaderCell>メモ</TableHeaderCell>
                    <TableHeaderCell>操作</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c) => (
                    <SortableRow
                      key={c.id}
                      company={c}
                      onEdit={handleEdit}
                      onToggleActive={handleToggleActive}
                      onDelete={handleDelete}
                      disabled={loading}
                    />
                  ))}
                </TableBody>
              </Table>
            </SortableContext>
          </DndContext>
        ) : null}

        <CompanyEditDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          company={editing}
          existingCompanies={companies}
          onSave={handleSave}
          loading={isMutating}
        />
      </VStack>
    </PageFrame>
  )
}
