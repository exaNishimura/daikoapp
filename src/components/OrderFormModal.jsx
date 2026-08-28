import { useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { getMinBusinessDateTime } from '@/utils/businessDayUtils'
import { PlacesAutocompleteField } from '@/components/PlacesAutocompleteField'
import { useOrderForm } from '@/hooks/useOrderForm'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { DateTimeInput } from '@astryxdesign/core/DateTimeInput'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, Layout, LayoutContent, LayoutFooter, StackItem, VStack } from '@astryxdesign/core/Layout'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'

function namedChange(handleChange, name) {
  return (value) => handleChange({ target: { name, value: value ?? '' } })
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
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="form">
      <VStack as="form" onSubmit={handleSubmit} gap={0}>
        <Layout
          height="auto"
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
                  <DateTimeInput
                    label="予約日時（15分刻み）"
                    value={formData.scheduled_at || undefined}
                    onChange={namedChange(handleChange, 'scheduled_at')}
                    description="15分刻みで選択してください（営業時間: 18:00〜翌06:00）"
                    status={
                      errors.scheduled_at
                        ? { type: 'error', message: errors.scheduled_at }
                        : undefined
                    }
                    min={getMinBusinessDateTime()}
                    hourFormat="24h"
                    timeIncrement={15}
                    timeOptionInterval={15}
                    isRequired
                    width="100%"
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
                    width="100%"
                  />
                  <TextArea
                    label="駐車位置メモ"
                    htmlName="parking_note"
                    value={formData.parking_note}
                    onChange={namedChange(handleChange, 'parking_note')}
                    rows={3}
                    placeholder="駐車位置やその他のメモ..."
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
                  type="button"
                  label="キャンセル"
                  variant="secondary"
                  onClick={onClose}
                  isDisabled={loading}
                />
                <Button
                  type="submit"
                  variant="primary"
                  label={loading ? '保存中...' : '保存'}
                  isDisabled={loading}
                  isLoading={loading}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </VStack>
    </Dialog>
  )
}
