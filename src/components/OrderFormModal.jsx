import { useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { PlacesAutocompleteField } from '@/components/PlacesAutocompleteField'
import { useOrderForm } from '@/hooks/useOrderForm'
import {
  RESERVATION_HOURS,
  RESERVATION_MINUTES,
  buildReservationDateTimeLocal,
  buildReservationIso,
  defaultReservationDateTime,
  formatReservationHourLabel,
  formatReservationInstantLabel,
  formatReservationMinuteLabel,
  splitReservationDateTime,
} from '@/lib/reservation/reservationTime'
import { FORM_FIELD_SIZE } from '@/lib/ui/formFieldSize'
import { formatWorkDateKey, getBusinessDayBoundaries } from '@/utils/businessDayUtils'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { DateInput } from '@astryxdesign/core/DateInput'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import {
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  StackItem,
  VStack,
} from '@astryxdesign/core/Layout'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'

function namedChange(handleChange, name) {
  return (value) => handleChange({ target: { name, value: value ?? '' } })
}

function ScheduledAtFields({ scheduledAt, error, onChange }) {
  const parts = scheduledAt ? splitReservationDateTime(scheduledAt) : defaultReservationDateTime()
  const minDate = formatWorkDateKey(getBusinessDayBoundaries().businessDay)
  const reservedAtError = error ? { type: 'error', message: error } : undefined
  const reservedAtIso = buildReservationIso(parts.date, parts.hour, parts.minute)

  const commit = (next) => {
    onChange(buildReservationDateTimeLocal(next.date, next.hour, next.minute))
  }

  return (
    <VStack gap={2}>
      <DateInput
        label="予約日（その夜）"
        value={parts.date || undefined}
        onChange={(value) => commit({ ...parts, date: value ?? '' })}
        min={minDate}
        isRequired
        weekStartsOn="mon"
        size={FORM_FIELD_SIZE}
        width="100%"
        status={reservedAtError}
      />
      <HStack gap={3}>
        <Selector
          label="時"
          isRequired
          width="100%"
          size={FORM_FIELD_SIZE}
          value={parts.hour === '' || parts.hour == null ? undefined : String(parts.hour)}
          onChange={(next) => commit({ ...parts, hour: next === '' ? '' : Number(next) })}
          options={RESERVATION_HOURS.map((hour) => ({
            value: String(hour),
            label: formatReservationHourLabel(hour),
          }))}
          status={reservedAtError}
        />
        <Selector
          label="分"
          isRequired
          width="100%"
          size={FORM_FIELD_SIZE}
          value={parts.minute === '' || parts.minute == null ? undefined : String(parts.minute)}
          onChange={(next) => commit({ ...parts, minute: next === '' ? '' : Number(next) })}
          options={RESERVATION_MINUTES.map((minute) => ({
            value: String(minute),
            label: formatReservationMinuteLabel(minute),
          }))}
          status={reservedAtError}
        />
      </HStack>
      <Text type="supporting" color="secondary">
        営業時間は 18:00〜翌06:00。0時〜5時は翌朝です。
      </Text>
      {reservedAtIso ? <Text>{formatReservationInstantLabel(reservedAtIso)}</Text> : null}
    </VStack>
  )
}

export function OrderFormModal({ onClose, onOrderCreated, open }) {
  const {
    formData,
    errors,
    loading,
    updateField,
    setErrors,
    handleChange,
    addWaypoint,
    updateWaypoint,
    removeWaypoint,
    handleSubmit,
    reset,
  } = useOrderForm({ onSuccess: onOrderCreated })

  useEffect(() => {
    if (open) {
      reset()
    }
  }, [open, reset])

  const handleOpenChange = (isOpen) => {
    if (!isOpen) onClose()
  }

  const handlePickupAddressChange = (address) => {
    updateField('pickup_address', address)
    setErrors((prev) => (prev.pickup_address ? { ...prev, pickup_address: null } : prev))
  }

  const handleDropoffAddressChange = (address) => {
    updateField('dropoff_address', address)
    setErrors((prev) => (prev.dropoff_address ? { ...prev, dropoff_address: null } : prev))
  }

  return (
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="form" maxHeight="90dvh">
      <Layout
        padding={4}
        header={<DialogHeader title="新規依頼（電話）" onOpenChange={handleOpenChange} />}
        content={
          <LayoutContent>
            <VStack gap={3}>
              <Text color="secondary">新しい依頼情報を入力してください</Text>

              <RadioList
                label="予約種別"
                value={formData.order_type}
                onChange={namedChange(handleChange, 'order_type')}
                orientation="horizontal"
                isRequired
                htmlName="order_type"
                width="100%"
              >
                <RadioListItem label="今すぐ" value="NOW" />
                <RadioListItem label="日時指定" value="SCHEDULED" />
              </RadioList>

              {formData.order_type === 'SCHEDULED' ? (
                <ScheduledAtFields
                  scheduledAt={formData.scheduled_at}
                  error={errors.scheduled_at}
                  onChange={namedChange(handleChange, 'scheduled_at')}
                />
              ) : null}

              <TextInput
                label="お迎え場所"
                htmlName="pickup_location"
                value={formData.pickup_location}
                onChange={namedChange(handleChange, 'pickup_location')}
                status={
                  errors.pickup_location
                    ? { type: 'error', message: errors.pickup_location }
                    : undefined
                }
                placeholder="例: モンガータ"
                size={FORM_FIELD_SIZE}
                width="100%"
              />

              <PlacesAutocompleteField
                label="出発地"
                name="pickup_address"
                value={formData.pickup_address}
                onChange={handlePickupAddressChange}
                error={errors.pickup_address}
                placeholder="例: 三重県鈴鹿市..."
                required
              />

              <PlacesAutocompleteField
                label="目的地"
                name="dropoff_address"
                value={formData.dropoff_address}
                onChange={handleDropoffAddressChange}
                error={errors.dropoff_address}
                placeholder="例: 三重県鈴鹿市..."
                required
              />

              <VStack gap={1.5}>
                <HStack hAlign="between" vAlign="center">
                  <Text weight="medium">経由地</Text>
                  <Button
                    size="sm"
                    variant="secondary"
                    label="追加"
                    icon={<Plus />}
                    onClick={addWaypoint}
                  />
                </HStack>
                {formData.waypoints.map((waypoint, index) => (
                  <HStack key={index} gap={1} vAlign="start">
                    <StackItem size="fill">
                      <PlacesAutocompleteField
                        label={`経由地 ${index + 1}`}
                        value={waypoint}
                        onChange={(address) => updateWaypoint(index, address)}
                        placeholder="例: 三重県鈴鹿市..."
                      />
                    </StackItem>
                    <IconButton
                      label={`経由地 ${index + 1} を削除`}
                      icon={<Trash2 />}
                      variant="destructive"
                      size="sm"
                      onClick={() => removeWaypoint(index)}
                    />
                  </HStack>
                ))}
                {formData.waypoints.length === 0 ? (
                  <Text color="secondary">経由地はありません</Text>
                ) : null}
              </VStack>

              <TextInput
                label="連絡先電話番号"
                htmlName="contact_phone"
                value={formData.contact_phone}
                onChange={namedChange(handleChange, 'contact_phone')}
                placeholder="例: 090-1234-5678"
                size={FORM_FIELD_SIZE}
                width="100%"
              />

              <VStack gap={2}>
                <Heading level={3}>車情報</Heading>
                <HStack gap={2} wrap="wrap">
                  <StackItem size="fill">
                    <TextInput
                      label="車種"
                      htmlName="car_model"
                      value={formData.car_model}
                      onChange={namedChange(handleChange, 'car_model')}
                      placeholder="例: プリウス"
                      size={FORM_FIELD_SIZE}
                      width="100%"
                    />
                  </StackItem>
                  <StackItem size="fill">
                    <TextInput
                      label="色"
                      htmlName="car_color"
                      value={formData.car_color}
                      onChange={namedChange(handleChange, 'car_color')}
                      placeholder="例: 白"
                      size={FORM_FIELD_SIZE}
                      width="100%"
                    />
                  </StackItem>
                </HStack>
                <TextInput
                  label="ナンバー"
                  htmlName="car_plate"
                  value={formData.car_plate}
                  onChange={namedChange(handleChange, 'car_plate')}
                  placeholder="例: 三重500あ1234"
                  size={FORM_FIELD_SIZE}
                  width="100%"
                />
                <TextArea
                  label="駐車位置メモ"
                  htmlName="parking_note"
                  value={formData.parking_note}
                  onChange={namedChange(handleChange, 'parking_note')}
                  rows={3}
                  placeholder="駐車位置やその他のメモ..."
                  size={FORM_FIELD_SIZE}
                  width="100%"
                />
              </VStack>

              {errors.submit ? (
                <Banner status="error" title={errors.submit} collapsible={false} />
              ) : null}
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button
                label="キャンセル"
                variant="secondary"
                onClick={onClose}
                isDisabled={loading}
              />
              <Button
                variant="primary"
                label={loading ? '保存中...' : '保存'}
                isDisabled={loading}
                isLoading={loading}
                onClick={handleSubmit}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
