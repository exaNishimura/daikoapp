import dayjs from 'dayjs'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { Link } from '@astryxdesign/core/Link'
import { Text } from '@astryxdesign/core/Text'

function memoPreview(memo) {
  const text = String(memo ?? '').trim()
  if (!text) return ''
  return text.length > 80 ? `${text.slice(0, 80)}…` : text
}

function formatWorkDateLabel(workDate) {
  if (!workDate) return ''
  const [, m, d] = workDate.split('-')
  return `${Number(m)}/${Number(d)}`
}

/**
 * @param {{
 *   open: boolean
 *   workDate: string
 *   reservations: Array<{ id: string, reserved_at: string, customer_name: string, phone?: string, memo?: string }>
 *   onClose: () => void
 * }} props
 */
export function ReservationTonightDialog({ open, workDate, reservations, onClose }) {
  const count = reservations?.length ?? 0
  const dateLabel = formatWorkDateLabel(workDate)

  const handleOpenChange = (isOpen) => {
    if (!isOpen) onClose()
  }

  return (
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="info">
      <Layout
        height="auto"
        padding={4}
        header={
          <DialogHeader
            title={`本日の予約 ${count}件`}
            onOpenChange={handleOpenChange}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              <Text color="secondary">{dateLabel} 19:00〜翌06:00</Text>
              {(reservations ?? []).map((row) => {
                const memo = memoPreview(row.memo)
                return (
                  <VStack key={row.id} gap={1}>
                    <Text weight="semibold">
                      {dayjs(row.reserved_at).format('M/D HH:mm')} {row.customer_name}
                    </Text>
                    {row.phone ? <Link href={`tel:${row.phone}`}>{row.phone}</Link> : null}
                    {memo ? <Text color="secondary">{memo}</Text> : null}
                  </VStack>
                )
              })}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end" wrap="wrap">
              <Button label="閉じる" variant="secondary" onClick={onClose} />
              <Button
                label="台帳で見る"
                variant="primary"
                href={`/reservations?date=${workDate}`}
                onClick={onClose}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
