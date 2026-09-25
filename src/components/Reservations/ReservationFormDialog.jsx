import { useRef, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { NightDateTimeFields } from '@/components/NightDateTimeFields'
import { useCompanies } from '@/hooks/billing/useCompanies'
import {
  buildReservationIso,
  defaultReservationDateTime,
  splitReservationDateTime,
} from '@/lib/reservation/reservationTime'
import { FORM_FIELD_SIZE } from '@/lib/ui/formFieldSize'
import { formatWorkDateKey, getBusinessDayBoundaries } from '@/utils/businessDayUtils'
import { missingReservationFields } from '@/services/reservationService'
import { CustomerNameSelect } from './CustomerNameSelect'
import './ReservationFormDialog.css'

function ReservationFormFields({ initial, onClose, onSubmit }) {
  const initialDateTime = initial?.reserved_at
    ? splitReservationDateTime(initial.reserved_at)
    : defaultReservationDateTime()
  const [reservedDate, setReservedDate] = useState(() => initialDateTime.date)
  const [reservedHour, setReservedHour] = useState(() => initialDateTime.hour)
  const [reservedMinute, setReservedMinute] = useState(() => initialDateTime.minute)
  const companiesQuery = useCompanies({ activeOnly: true })
  const [customerName, setCustomerName] = useState(() => initial?.customer_name ?? '')
  const customerQueryRef = useRef(initial?.customer_name ?? '')
  const [phone, setPhone] = useState(() => initial?.phone ?? '')
  const [memo, setMemo] = useState(() => initial?.memo ?? '')
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)
  const [nightAvailability, setNightAvailability] = useState({
    available: true,
    isLoading: false,
    message: '',
  })
  const minDate = formatWorkDateKey(getBusinessDayBoundaries().businessDay)
  const allowSlot = initial?.reserved_at ? initialDateTime : null

  const reservedAtIso = buildReservationIso(reservedDate, reservedHour, reservedMinute)
  const reservedAtError = fieldErrors.reserved_at
    ? { type: 'error', message: '必須です' }
    : undefined

  const handleSave = async () => {
    const payload = {
      reserved_at: reservedAtIso,
      customer_name: customerName.trim() || String(customerQueryRef.current || '').trim(),
      phone,
      memo,
    }
    const missing = missingReservationFields(payload)
    if (missing.length) {
      const next = {}
      for (const key of missing) next[key] = true
      setFieldErrors(next)
      setSubmitError('必須項目を入力してください')
      return
    }
    if (!nightAvailability.available) {
      setFieldErrors((prev) => ({ ...prev, reserved_at: true }))
      setSubmitError(nightAvailability.message || 'その時刻は配車できません')
      return
    }
    setFieldErrors({})
    setSubmitError('')
    setSaving(true)
    try {
      await onSubmit(payload)
      onClose()
    } catch (err) {
      setSubmitError(err?.message || '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout
      className="reservation-form-dialog"
      padding={4}
      header={
        <DialogHeader
          title={initial?.id ? '予約を編集' : '予約を登録'}
          onOpenChange={(isOpen) => {
            if (!isOpen && !saving) onClose()
          }}
        />
      }
      content={
        <LayoutContent>
          <VStack gap={4} className="reservation-form-dialog__fields">
            {submitError ? <Banner status="error" title={submitError} collapsible={false} /> : null}
            <NightDateTimeFields
              date={reservedDate}
              hour={reservedHour}
              minute={reservedMinute}
              minDate={minDate}
              allowSlot={allowSlot}
              error={reservedAtError?.message}
              onChange={({ date, hour, minute }) => {
                setReservedDate(date)
                setReservedHour(hour)
                setReservedMinute(minute)
              }}
              onAvailabilityChange={setNightAvailability}
            />
            <CustomerNameSelect
              companies={companiesQuery.data ?? []}
              value={customerName}
              onChange={(next) => {
                customerQueryRef.current = next
                setCustomerName(next)
              }}
              onChangeQuery={(q) => {
                customerQueryRef.current = q
              }}
              isRequired
              isLoading={companiesQuery.isLoading}
              status={
                fieldErrors.customer_name ? { type: 'error', message: '必須です' } : undefined
              }
            />
            <TextInput
              label="電話番号"
              value={phone}
              onChange={setPhone}
              isRequired
              size={FORM_FIELD_SIZE}
              width="100%"
              status={fieldErrors.phone ? { type: 'error', message: '必須です' } : undefined}
            />
            <TextArea
              label="メモ（備忘）"
              value={memo}
              onChange={setMemo}
              rows={2}
              size={FORM_FIELD_SIZE}
              width="100%"
            />
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <HStack className="reservation-form-dialog__footer" gap={2} hAlign="end" wrap="wrap">
            <Button label="キャンセル" variant="secondary" onClick={onClose} isDisabled={saving} />
            <Button
              label="保存"
              variant="primary"
              onClick={handleSave}
              isDisabled={saving || nightAvailability.isLoading || !nightAvailability.available}
              isLoading={saving}
            />
          </HStack>
        </LayoutFooter>
      }
    />
  )
}

/**
 * @param {{
 *   open: boolean
 *   initial?: { id?: string, reserved_at?: string, customer_name?: string, phone?: string, memo?: string } | null
 *   onClose: () => void
 *   onSubmit: (payload: { reserved_at: string, customer_name: string, phone: string, memo: string }) => Promise<void>
 * }} props
 */
export function ReservationFormDialog({ open, initial = null, onClose, onSubmit }) {
  const formKey = `${initial?.id ?? 'new'}:${initial?.updated_at ?? 'create'}`
  const handleOpenChange = (isOpen) => {
    if (!isOpen) onClose()
  }

  return (
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="form" maxHeight="90dvh">
      {open ? (
        <ReservationFormFields
          key={formKey}
          initial={initial}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      ) : null}
    </Dialog>
  )
}
