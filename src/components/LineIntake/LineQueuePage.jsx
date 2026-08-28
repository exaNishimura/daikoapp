import { useMemo, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { List, ListItem } from '@astryxdesign/core/List'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { PageFrame } from '@/components/PageFrame'
import { useAdminLineUnitAction, useApproveLineUnit, useLineQueue } from '@/hooks/useLineIntake'

const UNIT_STATUS_LABELS = {
  HOLDING: '仮受付',
  CONFIRMED: '確定',
  EXPIRED: '期限切れ',
  CANCELLED: 'キャンセル',
}

const UNIT_STATUS_COLORS = {
  HOLDING: 'yellow',
  CONFIRMED: 'green',
  EXPIRED: 'gray',
  CANCELLED: 'gray',
}

function unitStatusLabel(status) {
  return UNIT_STATUS_LABELS[status] || status
}

function holdRemainingLabel(holdUntil) {
  if (!holdUntil) return '—'
  const ms = new Date(holdUntil).getTime() - Date.now()
  if (ms <= 0) return '期限切れ'
  const m = Math.ceil(ms / 60000)
  return `残${m}分`
}

export function LineQueuePage() {
  const { data, isLoading, error, refetch } = useLineQueue()
  const approve = useApproveLineUnit()
  const adminAction = useAdminLineUnitAction()
  const [selected, setSelected] = useState(null)
  const [actionError, setActionError] = useState('')

  const rows = useMemo(() => data || [], [data])

  const openDetail = (unit) => {
    setSelected(unit)
    setActionError('')
  }

  const handleOpenChange = (isOpen) => {
    if (!isOpen) setSelected(null)
  }

  const handleApprove = async () => {
    setActionError('')
    try {
      await approve.mutateAsync({ unitId: selected.id })
      setSelected(null)
    } catch (e) {
      setActionError(e?.raw?.error || e.message || '承認に失敗しました')
    }
  }

  const handleDelete = async () => {
    if (!selected) return
    if (!window.confirm('この仮受付を削除しますか？枠も解放されます。')) return
    setActionError('')
    try {
      await adminAction.mutateAsync({
        action: 'admin_delete',
        unit_id: selected.id,
      })
      setSelected(null)
    } catch (e) {
      setActionError(e?.raw?.error || e.message || '削除に失敗しました')
    }
  }

  return (
    <PageFrame>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <Heading level={1}>LINE 仮受付</Heading>
          <Button label="更新" variant="secondary" onClick={() => refetch()} />
        </HStack>

        {isLoading ? <Spinner label="読み込み中…" /> : null}
        {error ? <Banner status="error" title={error.message} collapsible={false} /> : null}

        {!isLoading && rows.length === 0 ? (
          <Text color="secondary">仮受付・確定の表示対象はありません</Text>
        ) : null}

        {rows.length > 0 ? (
          <List hasDividers density="compact">
            {rows.map((unit) => {
              const booking = unit.line_bookings
              const discount = booking?.discount_snapshot
              return (
                <ListItem
                  key={unit.id}
                  label={new Date(unit.pickup_at).toLocaleString('ja-JP')}
                  description={
                    <VStack gap={0.5}>
                      <HStack gap={1} wrap="wrap">
                        <Token
                          size="sm"
                          label={unitStatusLabel(unit.status)}
                          color={UNIT_STATUS_COLORS[unit.status] || 'gray'}
                        />
                        {unit.uses_extra_capacity ? (
                          <Token size="sm" color="red" label="要手配" />
                        ) : null}
                        {unit.status === 'HOLDING' ? (
                          <Token size="sm" label={holdRemainingLabel(unit.hold_until)} />
                        ) : null}
                        {discount?.applied ? (
                          <Token size="sm" color="green" label={discount.label} />
                        ) : null}
                      </HStack>
                      <Text type="supporting">
                        {unit.pickup_address} → {unit.dropoff_address}
                      </Text>
                      <Text type="supporting">
                        TEL {booking?.contact_phone} / LINE {booking?.line_user_id}
                      </Text>
                    </VStack>
                  }
                  onClick={() => openDetail(unit)}
                />
              )
            })}
          </List>
        ) : null}

        <Dialog isOpen={Boolean(selected)} onOpenChange={handleOpenChange} purpose="info">
          <Layout
            height="auto"
            padding={4}
            header={<DialogHeader title="台詳細" onOpenChange={handleOpenChange} />}
            content={
              <LayoutContent>
                {selected ? (
                  <VStack gap={3}>
                    <Text>
                      {selected.pickup_address} → {selected.dropoff_address}
                    </Text>
                    <Text>車両: {selected.vehicle_info || '—'}</Text>
                    <Text>電話: {selected.line_bookings?.contact_phone}</Text>
                    <Text>LINE: {selected.line_bookings?.line_user_id}</Text>
                    <Text>状態: {unitStatusLabel(selected.status)}</Text>
                    <Text>
                      割引: {selected.line_bookings?.discount_snapshot?.label || 'なし'}
                    </Text>
                    {selected.projection_error ? (
                      <Banner
                        status="warning"
                        title={`投影エラー: ${selected.projection_error}`}
                        collapsible={false}
                      />
                    ) : null}
                    {actionError ? (
                      <Banner status="error" title={actionError} collapsible={false} />
                    ) : null}
                  </VStack>
                ) : null}
              </LayoutContent>
            }
            footer={
              <LayoutFooter>
                <HStack gap={2} hAlign="end" wrap="wrap">
                  <Button
                    label="閉じる"
                    variant="secondary"
                    onClick={() => setSelected(null)}
                  />
                  <Button
                    label="削除"
                    variant="destructive"
                    onClick={handleDelete}
                    isDisabled={adminAction.isPending}
                    isLoading={adminAction.isPending}
                  />
                  {selected?.status === 'HOLDING' ? (
                    <Button
                      label="確定にする"
                      variant="primary"
                      onClick={handleApprove}
                      isDisabled={approve.isPending}
                      isLoading={approve.isPending}
                    />
                  ) : null}
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      </VStack>
    </PageFrame>
  )
}
