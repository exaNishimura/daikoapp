import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import {
  getVehicleOperationStatus,
  setVehicleOperationStatus,
  deleteVehicleOperationStatus,
} from '@/services/vehicleOperationService'
import { getVehicles, updateVehicle } from '@/services/vehicleService'
import { PlacesAutocompleteField } from '@/components/PlacesAutocompleteField'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { DateInput } from '@astryxdesign/core/DateInput'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { Text } from '@astryxdesign/core/Text'
import { TimeInput } from '@astryxdesign/core/TimeInput'
import { Token } from '@astryxdesign/core/Token'

export function VehicleOperationStatusModal({
  open,
  onClose,
  vehicleId,
  vehicleName,
  onStatusUpdated,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [statuses, setStatuses] = useState([])
  const [waitingLocationAddress, setWaitingLocationAddress] = useState('')
  const [formData, setFormData] = useState({
    type: 'DEFAULT',
    date: '',
    time: '',
  })

  useEffect(() => {
    if (open && vehicleId) {
      loadStatuses()
      loadVehicle()
    }
  }, [open, vehicleId])

  const handleOpenChange = (isOpen) => {
    if (!isOpen) onClose()
  }

  const loadStatuses = async () => {
    if (!vehicleId) return

    setLoading(true)
    setError(null)

    try {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]

      const { data, error: fetchError } = await getVehicleOperationStatus(vehicleId, todayStr)

      if (fetchError) {
        setError(`稼働状況の取得に失敗: ${fetchError.message}`)
        setStatuses([])
      } else {
        setStatuses(data || [])
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
      setStatuses([])
    } finally {
      setLoading(false)
    }
  }

  const loadVehicle = async () => {
    if (!vehicleId) return

    try {
      const { data: vehicles, error: fetchError } = await getVehicles()
      if (fetchError) {
        if (import.meta.env.DEV) {
          console.error('Error loading vehicle:', fetchError)
        }
        return
      }

      const foundVehicle = vehicles?.find((v) => v.id === vehicleId)
      if (foundVehicle) {
        setWaitingLocationAddress(foundVehicle.waiting_location_address || '')
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Error loading vehicle:', err)
      }
    }
  }

  const handleTypeChange = (value) => {
    setFormData({
      ...formData,
      type: value,
      time: value === 'STOP' || value === 'START' ? formData.time : '',
    })
  }

  const handleDateChange = (value) => {
    setFormData({
      ...formData,
      date: value || '',
    })
  }

  const handleTimeChange = (value) => {
    setFormData({
      ...formData,
      time: value || '',
    })
  }

  const handleSave = async () => {
    if (!vehicleId) return

    if (!formData.date) {
      setError('日付を入力してください')
      return
    }

    if ((formData.type === 'STOP' || formData.type === 'START') && !formData.time) {
      setError('時刻を入力してください')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: saveError } = await setVehicleOperationStatus(vehicleId, {
        type: formData.type,
        date: formData.date,
        time: formData.time || null,
      })

      if (saveError) {
        setError(`保存に失敗: ${saveError.message}`)
      } else {
        setFormData({
          type: 'DEFAULT',
          date: '',
          time: '',
        })
        await loadStatuses()
        if (onStatusUpdated) {
          onStatusUpdated()
        }
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (statusId) => {
    if (!vehicleId || !statusId) return

    if (!confirm('この稼働状況設定を削除しますか？')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error: deleteError } = await deleteVehicleOperationStatus(vehicleId, statusId)

      if (deleteError) {
        setError(`削除に失敗: ${deleteError.message}`)
      } else {
        await loadStatuses()
        if (onStatusUpdated) {
          onStatusUpdated()
        }
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const getTypeLabel = (type) => {
    switch (type) {
      case 'DEFAULT':
        return '基本は稼働'
      case 'DAY_OFF':
        return '1日稼働しない'
      case 'STOP':
        return '途中で稼働停止'
      case 'START':
        return '途中で稼働開始'
      default:
        return type
    }
  }

  const getTodayDateString = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  return (
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="form">
      <Layout
        height="auto"
        padding={4}
        header={
          <DialogHeader
            title={`稼働状況設定 - ${vehicleName || '車両'}`}
            onOpenChange={handleOpenChange}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={3}>
              {error ? (
                <Banner
                  status="error"
                  title={error}
                  isDismissable
                  onDismiss={() => setError(null)}
                  collapsible={false}
                />
              ) : null}

              <RadioList
                label="稼働状況パターン"
                value={formData.type}
                onChange={handleTypeChange}
                width="100%"
              >
                <RadioListItem label="基本は稼働" value="DEFAULT" />
                <RadioListItem label="1日稼働しない" value="DAY_OFF" />
                <RadioListItem label="途中で稼働停止" value="STOP" />
                <RadioListItem label="途中で稼働開始" value="START" />
              </RadioList>

              <DateInput
                label="日付"
                value={formData.date || undefined}
                onChange={handleDateChange}
                min={getTodayDateString()}
                isRequired
                width="100%"
              />

              {formData.type === 'STOP' || formData.type === 'START' ? (
                <TimeInput
                  label="時刻"
                  value={formData.time || undefined}
                  onChange={handleTimeChange}
                  hourFormat="24h"
                  increment={15}
                  isRequired
                  width="100%"
                />
              ) : null}

              <PlacesAutocompleteField
                label="待機場所住所"
                value={waitingLocationAddress}
                onChange={setWaitingLocationAddress}
                placeholder="例: 三重県鈴鹿市平田新町2-20"
                helperText="目的地から待機場所への所要時間を計算するために使用されます"
              />

              {statuses.length > 0 ? (
                <VStack gap={1.5}>
                  <Heading level={4}>設定済みの稼働状況</Heading>
                  {statuses.map((status) => (
                    <Card key={status.id} padding={2}>
                      <HStack hAlign="between" vAlign="center" gap={1}>
                        <HStack gap={1} vAlign="center" wrap="wrap">
                          <Token size="sm" label={getTypeLabel(status.type)} />
                          <Text>
                            {status.date}
                            {status.time ? ` ${status.time}` : ''}
                          </Text>
                        </HStack>
                        <IconButton
                          size="sm"
                          variant="destructive"
                          label="この稼働状況設定を削除"
                          icon={<Trash2 />}
                          onClick={() => handleDelete(status.id)}
                          isDisabled={loading}
                        />
                      </HStack>
                    </Card>
                  ))}
                </VStack>
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
                label="保存"
                variant="primary"
                isDisabled={loading}
                isLoading={loading}
                onClick={async () => {
                  if (vehicleId) {
                    setLoading(true)
                    try {
                      const { error: updateError } = await updateVehicle(vehicleId, {
                        waiting_location_address: waitingLocationAddress.trim() || null,
                      })
                      if (updateError) {
                        setError(`待機場所住所の保存に失敗: ${updateError.message}`)
                        setLoading(false)
                        return
                      }
                      await handleSave()
                    } catch (err) {
                      setError(`エラーが発生しました: ${err.message}`)
                      setLoading(false)
                    }
                  } else {
                    await handleSave()
                  }
                }}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
