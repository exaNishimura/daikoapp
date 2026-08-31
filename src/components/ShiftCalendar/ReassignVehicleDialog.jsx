import { useEffect, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import {
  decideReassignMode,
  getReassignableCarNums,
  hasVehicleData,
} from '@/lib/billing/reassignVehicleSales'
import { formatVehicleNumLabel } from '@/lib/billing/receivableForm'

export function ReassignVehicleDialog({
  open,
  fromCar,
  dailyRow = null,
  dayShifts = [],
  receivableRows = [],
  loading = false,
  error = null,
  onClose,
  onConfirm,
}) {
  const options = getReassignableCarNums(fromCar)
  const [toCar, setToCar] = useState(options[0] ?? '')

  useEffect(() => {
    if (!open) return
    const nextOptions = getReassignableCarNums(fromCar)
    setToCar(nextOptions[0] ?? '')
  }, [open, fromCar])

  const handleOpenChange = (isOpen) => {
    if (!isOpen && !loading) onClose()
  }

  const hasToData =
    toCar !== '' &&
    hasVehicleData({
      carNum: toCar,
      dailyRow,
      dayShifts,
      receivableRows,
    })

  let modeLabel = ''
  let mode = null
  try {
    if (toCar !== '') {
      mode = decideReassignMode({ fromCar, toCar, hasToData })
      modeLabel =
        mode === 'swap'
          ? `${formatVehicleNumLabel(fromCar)} と ${formatVehicleNumLabel(toCar)} のデータを入れ替えます`
          : `${formatVehicleNumLabel(fromCar)} のデータを ${formatVehicleNumLabel(toCar)} へ付け替えます`
    }
  } catch {
    modeLabel = ''
  }

  const handleConfirm = () => {
    if (!toCar || loading) return
    onConfirm?.({ toCar, mode })
  }

  return (
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="form">
      <Layout
        height="auto"
        padding={4}
        header={<DialogHeader title="号車変更" onOpenChange={handleOpenChange} />}
        content={
          <LayoutContent>
            <VStack gap={3}>
              <Text color="secondary">現在: {formatVehicleNumLabel(fromCar)}</Text>
              <Selector
                label="変更先号車"
                options={options.map((car) => ({
                  value: String(car),
                  label: formatVehicleNumLabel(car),
                }))}
                value={toCar}
                onChange={setToCar}
                isDisabled={loading || options.length === 0}
                width="100%"
              />
              {modeLabel ? (
                <Banner
                  status={mode === 'swap' ? 'warning' : 'info'}
                  title={modeLabel}
                  collapsible={false}
                />
              ) : null}
              {error ? <Banner status="error" title={error} collapsible={false} /> : null}
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
                label="実行"
                variant="primary"
                onClick={handleConfirm}
                isDisabled={loading || !toCar}
                isLoading={loading}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  )
}
