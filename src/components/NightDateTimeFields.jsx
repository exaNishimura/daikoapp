import { useEffect, useRef } from 'react'
import { DateInput } from '@astryxdesign/core/DateInput'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { useDispatchableNight } from '@/hooks/useDispatchableNight'
import {
  firstDispatchableSlot,
  formatDispatchableHourLabel,
  formatDispatchableMinuteLabel,
  formatDispatchableWindowLabel,
  hourHasDispatchable,
  isSlotDispatchable,
} from '@/lib/reservation/dispatchableNight'
import {
  RESERVATION_HOURS,
  RESERVATION_MINUTES,
  formatReservationInstantLabel,
  buildReservationIso,
} from '@/lib/reservation/reservationTime'
import { FORM_FIELD_SIZE } from '@/lib/ui/formFieldSize'

const NONE_AVAILABLE = 'この夜は稼働している号車がありません'
const NONE_FREE = '指定できる空き枠がありません'
const OUT_OF_WINDOW = 'その時刻は配車できません。稼働時間内を選んでください'
const BOOKED = 'その時刻は空きがありません。別の時刻を選んでください'

function unavailableMessage(slots, hour, minute) {
  const anyOperational = slots.some((slot) => slot.operational && !slot.past)
  if (!slots.some((slot) => slot.available)) {
    return anyOperational ? NONE_FREE : NONE_AVAILABLE
  }
  const slot = slots.find((row) => row.hour === hour && row.minute === minute)
  if (slot?.booked) return BOOKED
  return OUT_OF_WINDOW
}

function supportingText({ isLoading, isFutureNight, windowLabel }) {
  if (isLoading) return '稼働状況を確認しています…'
  if (isFutureNight) {
    return windowLabel
      ? `${windowLabel}。翌日以降は予約台帳に保存します。`
      : '翌日以降は予約台帳に保存します。'
  }
  return windowLabel || '営業時間は 18:00〜翌06:00。0時〜5時は翌朝です。'
}

/**
 * 営業夜の日付 + 時分。その日の稼働状況で選択可否を制御する。
 * 当営業夜は配車画面の空きも見る。
 */
export function NightDateTimeFields({
  date,
  hour,
  minute,
  onChange,
  error,
  minDate,
  allowSlot = null,
  onAvailabilityChange,
}) {
  const { slots, isLoading, isCurrentNight, isFutureNight } = useDispatchableNight(date, {
    allowSlot,
  })
  const onChangeRef = useRef(onChange)
  const onAvailabilityChangeRef = useRef(onAvailabilityChange)
  onChangeRef.current = onChange
  onAvailabilityChangeRef.current = onAvailabilityChange

  const reservedAtError = error ? { type: 'error', message: error } : undefined
  const reservedAtIso = buildReservationIso(date, hour, minute)
  const currentOk = isSlotDispatchable(slots, hour, minute)
  const hasAny = slots.some((slot) => slot.available)
  const windowLabel = formatDispatchableWindowLabel(slots, { isCurrentNight })
  const helper = supportingText({ isLoading, isFutureNight, windowLabel })

  useEffect(() => {
    if (isLoading) {
      onAvailabilityChangeRef.current?.({ available: true, isLoading: true, message: '' })
      return
    }
    if (!date) {
      onAvailabilityChangeRef.current?.({ available: false, isLoading: false, message: '' })
      return
    }
    if (!hasAny) {
      onAvailabilityChangeRef.current?.({
        available: false,
        isLoading: false,
        message: unavailableMessage(slots, hour, minute),
      })
      return
    }
    onAvailabilityChangeRef.current?.({
      available: currentOk,
      isLoading: false,
      message: currentOk ? '' : unavailableMessage(slots, hour, minute),
    })
  }, [date, hour, minute, currentOk, hasAny, isLoading, slots])

  useEffect(() => {
    if (isLoading || !date || !hasAny) return
    if (currentOk) return
    const first = firstDispatchableSlot(slots)
    if (!first) return
    if (Number(first.hour) === Number(hour) && Number(first.minute) === Number(minute)) return
    onChangeRef.current?.({ date, hour: first.hour, minute: first.minute })
  }, [date, hour, minute, currentOk, hasAny, isLoading, slots])

  const status =
    !isLoading && date && !hasAny
      ? { type: 'error', message: unavailableMessage(slots, hour, minute) }
      : reservedAtError

  return (
    <VStack gap={2}>
      <DateInput
        label="予約日（その夜）"
        value={date || undefined}
        onChange={(value) => onChange({ date: value ?? '', hour, minute })}
        min={minDate}
        isRequired
        weekStartsOn="mon"
        size={FORM_FIELD_SIZE}
        width="100%"
        status={status}
      />
      <HStack gap={3}>
        <Selector
          label="時"
          isRequired
          width="100%"
          size={FORM_FIELD_SIZE}
          isLoading={isLoading}
          value={hour === '' || hour == null ? undefined : String(hour)}
          onChange={(next) => onChange({ date, hour: next === '' ? '' : Number(next), minute })}
          options={RESERVATION_HOURS.map((optionHour) => ({
            value: String(optionHour),
            label: formatDispatchableHourLabel(optionHour, slots),
            disabled: !hourHasDispatchable(slots, optionHour),
          }))}
          status={reservedAtError}
        />
        <Selector
          label="分"
          isRequired
          width="100%"
          size={FORM_FIELD_SIZE}
          isLoading={isLoading}
          value={minute === '' || minute == null ? undefined : String(minute)}
          onChange={(next) => onChange({ date, hour, minute: next === '' ? '' : Number(next) })}
          options={RESERVATION_MINUTES.map((optionMinute) => {
            const slot = slots.find((s) => s.hour === hour && s.minute === optionMinute) || {
              minute: optionMinute,
              available: true,
              past: false,
              booked: false,
            }
            return {
              value: String(optionMinute),
              label: formatDispatchableMinuteLabel(slot),
              disabled: !slot.available,
            }
          })}
          status={reservedAtError}
        />
      </HStack>
      <Text type="supporting" color="secondary">
        {helper}
      </Text>
      {reservedAtIso ? <Text>{formatReservationInstantLabel(reservedAtIso)}</Text> : null}
    </VStack>
  )
}
