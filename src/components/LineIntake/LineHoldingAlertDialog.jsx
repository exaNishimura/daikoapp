import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { Link } from '@astryxdesign/core/Link'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'

function holdRemainingLabel(holdUntil) {
  if (!holdUntil) return ''
  const ms = new Date(holdUntil).getTime() - Date.now()
  if (ms <= 0) return '期限切れ'
  return `残${Math.ceil(ms / 60000)}分`
}

/**
 * @param {{
 *   open: boolean
 *   units: Array<{
 *     id: string
 *     pickup_at?: string
 *     pickup_address?: string
 *     dropoff_address?: string
 *     hold_until?: string
 *     uses_extra_capacity?: boolean
 *     line_bookings?: { contact_phone?: string }
 *   }>
 *   onClose: () => void
 * }} props
 */
export function LineHoldingAlertDialog({ open, units, onClose }) {
  const count = units?.length ?? 0
  const handleOpenChange = (isOpen) => {
    if (!isOpen) onClose()
  }

  return (
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="info">
      <Layout
        height="auto"
        padding={4}
        header={<DialogHeader title={`LINE仮受付 ${count}件`} onOpenChange={handleOpenChange} />}
        content={
          <LayoutContent>
            <VStack gap={4}>
              {(units ?? []).map((unit) => {
                const remain = holdRemainingLabel(unit.hold_until)
                const phone = unit.line_bookings?.contact_phone
                return (
                  <VStack key={unit.id} gap={1}>
                    <HStack gap={1} wrap="wrap">
                      {remain ? <Token size="sm" label={remain} /> : null}
                      {unit.uses_extra_capacity ? (
                        <Token size="sm" color="red" label="要手配" />
                      ) : null}
                    </HStack>
                    <Text weight="semibold">
                      {unit.pickup_at
                        ? new Date(unit.pickup_at).toLocaleString('ja-JP', {
                            timeZone: 'Asia/Tokyo',
                          })
                        : '—'}
                    </Text>
                    <Text>
                      {unit.pickup_address || '—'} → {unit.dropoff_address || '—'}
                    </Text>
                    {phone ? <Link href={`tel:${phone}`}>{phone}</Link> : null}
                  </VStack>
                )
              })}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label="閉じる" variant="secondary" onClick={onClose} />
              <Button label="LINE仮受付へ" href="/line-queue" variant="primary" onClick={onClose} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
