import { useMemo } from 'react'
import dayjs from 'dayjs'
import { Button } from '@astryxdesign/core/Button'
import { Popover } from '@astryxdesign/core/Popover'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/Layout'
import './ReservationDayBadge.css'

/**
 * @param {{ date: string, reservations: Array<{ id: string, reserved_at: string, customer_name: string }> }} props
 */
export function ReservationDayBadge({ date, reservations }) {
  const count = reservations?.length ?? 0

  const sorted = useMemo(
    () =>
      [...(reservations ?? [])].toSorted(
        (a, b) => new Date(a.reserved_at).getTime() - new Date(b.reserved_at).getTime()
      ),
    [reservations]
  )

  if (count === 0) return null

  return (
    <Popover
      placement="below"
      alignment="start"
      width={280}
      label={`${date} の予約`}
      content={
        <VStack gap={2} padding={2}>
          <Text weight="semibold">
            {date} の予約
          </Text>
          {sorted.map((r) => (
            <Text key={r.id}>
              {dayjs(r.reserved_at).format('HH:mm')} {r.customer_name}
            </Text>
          ))}
          <Button href={`/reservations?date=${date}`} size="sm" label="台帳で見る" />
        </VStack>
      }
    >
      <button
        type="button"
        className="reservation-day-badge"
        aria-label={`予約 ${count} 件`}
        onClick={(e) => e.stopPropagation()}
      >
        予約 {count}
      </button>
    </Popover>
  )
}
