import { Check, Pencil, Trash2, X } from 'lucide-react'
import { Button } from '@astryxdesign/core/Button'
import { VStack } from '@astryxdesign/core/Layout'
import { STATUS_LABELS } from '@/utils/orderStatusUtils'

const REVERTABLE_STATUSES = ['COMPLETED', 'IN_TRANSIT', 'PICKING_UP', 'ARRIVED', 'CONFIRMED']

export function OrderActionFooter({
  order,
  editing,
  loading,
  advanceStatus,
  hasConflict = false,
  onSave,
  onCancelEdit,
  onStartEdit,
  onConfirm,
  onRevertStatus,
  onAdvanceStatus,
  onCancel,
}) {
  return (
    <VStack gap={1.5}>
      {editing ? (
        <>
          <Button
            variant="secondary"
            icon={<X />}
            onClick={onCancelEdit}
            isDisabled={loading}
            width="100%"
            label="キャンセル"
          />
          <Button
            variant="primary"
            icon={<Check />}
            onClick={onSave}
            isDisabled={loading}
            isLoading={loading}
            width="100%"
            label={loading ? '保存中…' : '保存'}
          />
        </>
      ) : (
        <>
          <Button
            variant="secondary"
            icon={<Pencil />}
            onClick={onStartEdit}
            width="100%"
            label="編集"
          />
          {order.status === 'UNASSIGNED' || order.status === 'TENTATIVE' ? (
            <Button
              variant="primary"
              onClick={onConfirm}
              isDisabled={loading || hasConflict}
              width="100%"
              tooltip={hasConflict ? '時間の重複を解消してから確定してください' : undefined}
              label="確定"
            />
          ) : null}
          {REVERTABLE_STATUSES.includes(order.status) ? (
            <Button
              variant="secondary"
              onClick={onRevertStatus}
              isDisabled={loading}
              width="100%"
              label="ステータスを戻す"
            />
          ) : null}
          {advanceStatus ? (
            <Button
              variant="primary"
              onClick={onAdvanceStatus}
              isDisabled={loading}
              width="100%"
              label={STATUS_LABELS[advanceStatus]}
            />
          ) : null}
          <Button
            variant="destructive"
            icon={<Trash2 />}
            onClick={onCancel}
            isDisabled={loading}
            width="100%"
            label="削除"
          />
        </>
      )}
    </VStack>
  )
}
