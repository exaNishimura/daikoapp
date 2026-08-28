import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { DateInput } from '@astryxdesign/core/DateInput'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Link } from '@astryxdesign/core/Link'
import { List, ListItem } from '@astryxdesign/core/List'
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
import { TextInput } from '@astryxdesign/core/TextInput'
import { PageFrame } from '@/components/PageFrame'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  useCreateReservation,
  useDeleteReservation,
  useReservations,
  useUpdateReservation,
} from '@/hooks/useReservations'
import { formatDateInJst } from '@/lib/reservation/reservationWindowUtils'
import { ReservationFormDialog } from './ReservationFormDialog'
import './ReservationLedgerPage.css'

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

function formatReservedAt(iso, compact = false) {
  const d = dayjs(iso)
  if (compact) {
    return `${d.month() + 1}月${d.date()}日 ${d.format('HH:mm')}`
  }
  return `${d.year()}年${d.month() + 1}月${d.date()}日 ${d.format('HH:mm')}`
}

function formatFilterDateLabel(dateParam) {
  const d = dayjs(dateParam)
  return `${d.month() + 1}月${d.date()}日（${WEEKDAYS_JA[d.day()]}）`
}

function formatResultLabel(count, dateParam, query) {
  const q = String(query ?? '').trim()
  if (dateParam && q) return `${formatFilterDateLabel(dateParam)} / 「${q}」: ${count}件`
  if (dateParam) return `${formatFilterDateLabel(dateParam)}: ${count}件`
  if (q) return `「${q}」の検索結果: ${count}件`
  return `全${count}件`
}

function memoPreview(memo) {
  const t = String(memo ?? '').trim()
  if (!t) return ''
  return t.length > 80 ? `${t.slice(0, 80)}…` : t
}

function DetailField({ label, children }) {
  return (
    <VStack gap={0.5}>
      <Text type="supporting" color="secondary">
        {label}
      </Text>
      {children}
    </VStack>
  )
}

export function ReservationLedgerPage() {
  const isMobile = useMediaQuery('(max-width: 899px)')
  const [searchParams, setSearchParams] = useSearchParams()
  const dateParam = searchParams.get('date') || ''

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
    if (dateParam) {
      f.dateFrom = dateParam
      f.dateTo = dateParam
    }
    if (qDebounced.trim()) f.q = qDebounced.trim()
    return f
  }, [dateParam, qDebounced])

  const listQuery = useReservations(filters)
  const createMut = useCreateReservation()
  const updateMut = useUpdateReservation()
  const deleteMut = useDeleteReservation()

  const rows = listQuery.data ?? []
  const hasFilters = Boolean(dateParam || qDebounced.trim())
  const resultLabel = formatResultLabel(rows.length, dateParam, qDebounced)

  const handleDateChange = (next) => {
    if (next) {
      setSearchParams({ date: next })
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

  const handleDeleteOpenChange = (isOpen) => {
    if (!isOpen) setDeleteTarget(null)
  }

  const handleDetailOpenChange = (isOpen) => {
    if (!isOpen) setDetail(null)
  }

  const clearFilters = () => {
    setQ('')
    setSearchParams({})
  }

  return (
    <PageFrame>
      <VStack gap={4} className={isMobile ? 'reservation-ledger--mobile' : undefined}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <VStack gap={0.5}>
            <Heading level={1}>予約台帳</Heading>
            {!listQuery.isLoading && !listQuery.isError ? (
              <Text color="secondary">{resultLabel}</Text>
            ) : null}
          </VStack>
          {!isMobile ? (
            <Button
              variant="primary"
              label="新規登録"
              icon={<Plus size={16} />}
              onClick={openCreate}
            />
          ) : null}
        </HStack>

        <HStack gap={2} wrap="wrap" vAlign="end">
          <DateInput
            label="日付"
            value={dateParam || undefined}
            onChange={handleDateChange}
            hasClear
            weekStartsOn="mon"
            size="sm"
            width={isMobile ? '100%' : 200}
          />
          <TextInput
            label="氏名・電話で検索"
            value={q}
            onChange={setQ}
            size="sm"
            width={isMobile ? '100%' : 240}
          />
          {!dateParam ? (
            <Button
              size="sm"
              variant="secondary"
              label="今日"
              onClick={() => handleDateChange(formatDateInJst())}
            />
          ) : null}
          {hasFilters ? (
            <Button size="sm" variant="ghost" label="条件をクリア" onClick={clearFilters} />
          ) : null}
        </HStack>

        {listQuery.isError ? (
          <Banner
            status="error"
            title={listQuery.error?.message || '一覧の取得に失敗しました'}
            collapsible={false}
          />
        ) : null}

        {listQuery.isLoading ? <Spinner label="読み込み中..." /> : null}

        {!listQuery.isLoading && rows.length === 0 ? (
          <EmptyState
            title="条件に一致する予約はありません"
            description={
              hasFilters
                ? 'フィルタ条件を変更するか、新規登録してください。'
                : '新規登録から予約を追加できます。'
            }
            icon={<CalendarDays size={32} aria-hidden />}
            actions={
              <HStack gap={2} wrap="wrap" hAlign="center">
                {hasFilters ? (
                  <Button variant="secondary" label="条件をクリア" onClick={clearFilters} />
                ) : null}
                <Button
                  variant="primary"
                  label="新規登録"
                  icon={<Plus size={16} />}
                  onClick={openCreate}
                />
              </HStack>
            }
          />
        ) : null}

        {!listQuery.isLoading && rows.length > 0 && isMobile ? (
          <List hasDividers density="compact">
            {rows.map((row) => {
              const memo = memoPreview(row.memo)
              return (
                <ListItem
                  key={row.id}
                  label={row.customer_name}
                  description={
                    <VStack gap={0.5}>
                      <Text type="supporting">{formatReservedAt(row.reserved_at, true)}</Text>
                      <Text type="supporting">{row.phone}</Text>
                      {memo ? <Text type="supporting">{memo}</Text> : null}
                    </VStack>
                  }
                  onClick={() => setDetail(row)}
                />
              )
            })}
          </List>
        ) : null}

        {!listQuery.isLoading && rows.length > 0 && !isMobile ? (
          <Table hasHover density="compact">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>予約日時</TableHeaderCell>
                <TableHeaderCell>顧客名</TableHeaderCell>
                <TableHeaderCell>電話</TableHeaderCell>
                <TableHeaderCell>メモ</TableHeaderCell>
                <TableHeaderCell>操作</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => setDetail(row)}
                  style={{ cursor: 'pointer' }}
                >
                  <TableCell>{formatReservedAt(row.reserved_at)}</TableCell>
                  <TableCell>{row.customer_name}</TableCell>
                  <TableCell>
                    <Link href={`tel:${row.phone}`} onClick={(e) => e.stopPropagation()}>
                      {row.phone}
                    </Link>
                  </TableCell>
                  <TableCell>{memoPreview(row.memo) || '—'}</TableCell>
                  <TableCell>
                    <HStack gap={0}>
                      <IconButton
                        size="sm"
                        variant="ghost"
                        label="編集"
                        tooltip="編集"
                        icon={<Pencil size={14} />}
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(row)
                        }}
                      />
                      <IconButton
                        size="sm"
                        variant="ghost"
                        label="削除"
                        tooltip="削除"
                        icon={<Trash2 size={14} />}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(row)
                        }}
                      />
                    </HStack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}

        {isMobile ? (
          <div className="reservation-ledger__fab">
            <Button
              variant="primary"
              size="lg"
              width="100%"
              label="新規登録"
              icon={<Plus size={16} />}
              onClick={openCreate}
            />
          </div>
        ) : null}

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
          isOpen={Boolean(deleteTarget)}
          onOpenChange={handleDeleteOpenChange}
          purpose="info"
        >
          <Layout
            height="auto"
            padding={4}
            header={<DialogHeader title="予約を削除" onOpenChange={handleDeleteOpenChange} />}
            content={
              <LayoutContent>
                <VStack gap={3}>
                  <Text>
                    {deleteTarget
                      ? `${formatReservedAt(deleteTarget.reserved_at)} ${deleteTarget.customer_name} を削除しますか？`
                      : ''}
                  </Text>
                  {deleteMut.isError ? (
                    <Banner
                      status="error"
                      title={deleteMut.error?.message || '削除に失敗しました'}
                      collapsible={false}
                    />
                  ) : null}
                </VStack>
              </LayoutContent>
            }
            footer={
              <LayoutFooter>
                <HStack gap={2} hAlign="end" wrap="wrap">
                  <Button
                    label="キャンセル"
                    variant="secondary"
                    onClick={() => setDeleteTarget(null)}
                  />
                  <Button
                    label="削除"
                    variant="destructive"
                    isDisabled={deleteMut.isPending}
                    isLoading={deleteMut.isPending}
                    onClick={async () => {
                      await deleteMut.mutateAsync(deleteTarget.id)
                      setDeleteTarget(null)
                    }}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>

        <Dialog isOpen={Boolean(detail)} onOpenChange={handleDetailOpenChange} purpose="info">
          <Layout
            height="auto"
            padding={4}
            header={<DialogHeader title="予約詳細" onOpenChange={handleDetailOpenChange} />}
            content={
              <LayoutContent>
                {detail ? (
                  <VStack gap={3}>
                    <DetailField label="日時">
                      <Text>{formatReservedAt(detail.reserved_at)}</Text>
                    </DetailField>
                    <DetailField label="顧客名">
                      <Text>{detail.customer_name}</Text>
                    </DetailField>
                    <DetailField label="電話">
                      <Link href={`tel:${detail.phone}`}>{detail.phone}</Link>
                    </DetailField>
                    <DetailField label="メモ">
                      <Text>{detail.memo?.trim() ? detail.memo : '（なし）'}</Text>
                    </DetailField>
                  </VStack>
                ) : null}
              </LayoutContent>
            }
            footer={
              <LayoutFooter>
                <HStack gap={2} hAlign="end" wrap="wrap">
                  <Button label="閉じる" variant="secondary" onClick={() => setDetail(null)} />
                  <Button
                    label="編集"
                    variant="primary"
                    onClick={() => {
                      openEdit(detail)
                      setDetail(null)
                    }}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      </VStack>
    </PageFrame>
  )
}
