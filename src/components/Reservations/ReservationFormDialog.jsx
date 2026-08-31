import { useId, useState } from 'react'
import dayjs from 'dayjs'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { DateInput } from '@astryxdesign/core/DateInput'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Field } from '@astryxdesign/core/Field'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { missingReservationFields } from '@/services/reservationService'
import './ReservationFormDialog.css'

const NATIVE_INPUT_STYLE = {
  boxSizing: 'border-box',
  width: '100%',
  minWidth: 0,
  padding: 'var(--spacing-2) var(--spacing-3)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  font: 'inherit',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontVariantNumeric: 'tabular-nums',
}

function splitDateTime(iso) {
  const d = iso ? dayjs(iso) : dayjs()
  return {
    date: d.isValid() ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
    time: d.isValid() ? d.format('HH:mm') : dayjs().format('HH:mm'),
  }
}

function buildReservedAtIso(date, time) {
  if (!date || !time) return ''
  const d = dayjs(`${date}T${time}`)
  return d.isValid() ? d.toISOString() : ''
}

function TimeField({ label, value, onChange, isRequired, status }) {
  const inputId = useId()
  return (
    <Field label={label} inputID={inputId} width="100%" isRequired={isRequired} status={status}>
      <input
        id={inputId}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={NATIVE_INPUT_STYLE}
      />
    </Field>
  )
}

function ReservationFormFields({ initial, onClose, onSubmit }) {
  const initialDateTime = splitDateTime(initial?.reserved_at)
  const [reservedDate, setReservedDate] = useState(() => initialDateTime.date)
  const [reservedTime, setReservedTime] = useState(() => initialDateTime.time)
  const [customerName, setCustomerName] = useState(() => initial?.customer_name ?? '')
  const [phone, setPhone] = useState(() => initial?.phone ?? '')
  const [memo, setMemo] = useState(() => initial?.memo ?? '')
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)

  const reservedAtError = fieldErrors.reserved_at
    ? { type: 'error', message: '必須です' }
    : undefined

  const handleSave = async () => {
    const payload = {
      reserved_at: buildReservedAtIso(reservedDate, reservedTime),
      customer_name: customerName,
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
      height="auto"
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
            <DateInput
              label="予約日"
              value={reservedDate || undefined}
              onChange={(value) => setReservedDate(value ?? '')}
              isRequired
              weekStartsOn="mon"
              size="sm"
              width="100%"
              status={reservedAtError}
            />
            <TimeField
              label="予約時刻"
              value={reservedTime}
              onChange={setReservedTime}
              isRequired
              status={reservedAtError}
            />
            <TextInput
              label="顧客名"
              value={customerName}
              onChange={setCustomerName}
              isRequired
              width="100%"
              status={
                fieldErrors.customer_name ? { type: 'error', message: '必須です' } : undefined
              }
            />
            <TextInput
              label="電話番号"
              value={phone}
              onChange={setPhone}
              isRequired
              width="100%"
              status={fieldErrors.phone ? { type: 'error', message: '必須です' } : undefined}
            />
            <TextArea label="メモ（備忘）" value={memo} onChange={setMemo} rows={2} width="100%" />
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
              isDisabled={saving}
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
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="form">
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
