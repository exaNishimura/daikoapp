import { useMemo, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { DateInput } from '@astryxdesign/core/DateInput'
import { Grid, GridSpan } from '@astryxdesign/core/Grid'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Plus, Save, X } from 'lucide-react'
import { CompanySelect } from '@/components/Receivables/CompanySelect'
import { VehicleNumSelect } from '@/components/Receivables/VehicleNumSelect'
import { AmountInput } from '@/components/Receivables/AmountInput'
import { dateInputMonthBounds } from '@/components/Receivables/monthUtils'
import {
  EMPTY_RECEIVABLE_FORM,
  parseVehicleNumForSave,
  toBillingMonthFromWorkDate,
  validateReceivableForm,
} from '@/lib/billing/receivableForm'

function defaultWorkDate(year, month) {
  const today = new Date()
  const isCurrent = today.getFullYear() === year && today.getMonth() + 1 === month
  const day = isCurrent ? today.getDate() : 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * 売掛の新規追加行 (インライン)。
 * - 「行追加」ボタンを押すとフォームが展開
 * - 保存後はリセットして連続入力できるようにする
 */
export function ReceivablesAddRow({ companies, year, month, onCreate, isSaving }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(() => ({
    ...EMPTY_RECEIVABLE_FORM,
    work_date: defaultWorkDate(year, month),
  }))

  const dateBounds = dateInputMonthBounds(year, month)
  const { errors, isValid } = useMemo(
    () => validateReceivableForm(form, { year, month }),
    [form, year, month]
  )

  const reset = () => {
    setForm((prev) => ({
      ...EMPTY_RECEIVABLE_FORM,
      work_date: defaultWorkDate(year, month),
      company_id: prev.company_id, // 連続入力で同じ取引先を保持
    }))
  }

  const handleOpen = () => {
    setOpen(true)
    setForm({
      ...EMPTY_RECEIVABLE_FORM,
      work_date: defaultWorkDate(year, month),
    })
  }

  const handleClose = () => {
    setOpen(false)
  }

  const handleSave = async () => {
    if (!isValid) return
    const payload = {
      company_id: form.company_id,
      work_date: form.work_date,
      billing_month: toBillingMonthFromWorkDate(form.work_date),
      vehicle_num: parseVehicleNumForSave(form.vehicle_num),
      departure: form.departure?.trim() || null,
      destination: form.destination?.trim() || null,
      amount: Number(form.amount) || 0,
      note: form.note?.trim() || null,
      source_file: null,
    }
    try {
      await onCreate(payload)
      reset()
    } catch {
      /* error は呼び出し側で表示 */
    }
  }

  if (!open) {
    return <Button icon={<Plus />} label="売掛を追加" variant="secondary" onClick={handleOpen} />
  }

  return (
    <Card padding={3}>
      <VStack gap={2}>
        <HStack hAlign="between" vAlign="center">
          <Text size="sm" color="secondary">
            新規追加 — {year}年{month}月
          </Text>
          <IconButton size="sm" variant="ghost" label="閉じる" icon={<X />} onClick={handleClose} />
        </HStack>
        <Grid columns={{ minWidth: 160, max: 4 }} gap={2}>
          <DateInput
            label="日付"
            value={form.work_date || undefined}
            onChange={(work_date) => setForm({ ...form, work_date: work_date ?? '' })}
            min={dateBounds.min}
            max={dateBounds.max}
            size="sm"
            status={errors.work_date ? { type: 'error', message: errors.work_date } : undefined}
            width="100%"
          />
          <GridSpan columns={2}>
            <VStack gap={0}>
              <CompanySelect
                companies={companies}
                value={form.company_id}
                onChange={(id) => setForm({ ...form, company_id: id })}
              />
              {errors.company_id ? (
                <Text size="sm" style={{ color: 'var(--color-text-red)' }}>
                  {errors.company_id}
                </Text>
              ) : null}
            </VStack>
          </GridSpan>
          <VehicleNumSelect
            value={form.vehicle_num}
            onChange={(vehicle_num) => setForm({ ...form, vehicle_num })}
          />
          <AmountInput
            value={form.amount}
            onChange={(v) => setForm({ ...form, amount: v })}
            label="金額"
          />
          <TextInput
            label="出発"
            size="sm"
            value={form.departure}
            onChange={(departure) => setForm({ ...form, departure })}
            width="100%"
          />
          <TextInput
            label="到着"
            size="sm"
            value={form.destination}
            onChange={(destination) => setForm({ ...form, destination })}
            width="100%"
          />
          <GridSpan columns={2}>
            <TextInput
              label="備考"
              size="sm"
              value={form.note}
              onChange={(note) => setForm({ ...form, note })}
              width="100%"
            />
          </GridSpan>
          <GridSpan columns="full">
            <HStack gap={1} hAlign="end">
              <Button
                label="閉じる"
                variant="secondary"
                onClick={handleClose}
                isDisabled={isSaving}
              />
              <Button
                variant="primary"
                icon={<Save />}
                label={isSaving ? '保存中...' : '保存して続けて入力'}
                onClick={handleSave}
                isDisabled={!isValid || isSaving}
                isLoading={isSaving}
              />
            </HStack>
          </GridSpan>
        </Grid>
      </VStack>
    </Card>
  )
}
