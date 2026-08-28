import { useMemo, useState } from 'react'
import { DateInput } from '@astryxdesign/core/DateInput'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack } from '@astryxdesign/core/Layout'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
} from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Lock, Pencil, Save, Trash2, X } from 'lucide-react'
import { CompanySelect } from '@/components/Receivables/CompanySelect'
import { VehicleNumSelect } from '@/components/Receivables/VehicleNumSelect'
import { AmountInput } from '@/components/Receivables/AmountInput'
import { StatusBadge } from '@/components/Receivables/StatusBadge'
import { receivableStatus } from '@/components/Receivables/statusUtils'
import {
  formatVehicleNumLabel,
  parseVehicleNumForSave,
  toBillingMonthFromWorkDate,
  validateReceivableForm,
  vehicleNumToFormValue,
} from '@/lib/billing/receivableForm'

function rowToForm(row) {
  return {
    company_id: row.company_id ?? null,
    work_date: row.work_date ?? '',
    vehicle_num: vehicleNumToFormValue(row.vehicle_num),
    departure: row.departure ?? '',
    destination: row.destination ?? '',
    amount: row.amount ?? null,
    note: row.note ?? '',
  }
}

function buildUpdatePayload(form) {
  const billingMonth = toBillingMonthFromWorkDate(form.work_date)
  return {
    company_id: form.company_id,
    work_date: form.work_date,
    billing_month: billingMonth,
    vehicle_num: parseVehicleNumForSave(form.vehicle_num),
    departure: form.departure?.trim() || null,
    destination: form.destination?.trim() || null,
    amount: Number(form.amount) || 0,
    note: form.note?.trim() || null,
  }
}

function monthBound(options, day) {
  return `${options.year}-${String(options.month).padStart(2, '0')}-${day}`
}

function EditableRow({ row, companies, options, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState(() => rowToForm(row))
  const { errors, isValid } = useMemo(
    () =>
      validateReceivableForm(form, {
        ...options,
        allowUnsetCompany: form.company_id == null,
      }),
    [form, options]
  )

  const handleSave = () => {
    if (!isValid) return
    onSave(buildUpdatePayload(form))
  }

  return (
    <TableRow>
      <TableCell />
      <TableCell>
        <DateInput
          label="日付"
          isLabelHidden
          value={form.work_date || undefined}
          onChange={(work_date) => setForm({ ...form, work_date: work_date ?? '' })}
          min={monthBound(options, '01')}
          max={monthBound(options, '31')}
          size="sm"
          status={errors.work_date ? { type: 'error', message: errors.work_date } : undefined}
        />
      </TableCell>
      <TableCell>
        <CompanySelect
          companies={companies}
          value={form.company_id}
          onChange={(id) => setForm({ ...form, company_id: id })}
          includeInactive
        />
      </TableCell>
      <TableCell>
        <VehicleNumSelect
          value={form.vehicle_num}
          onChange={(vehicle_num) => setForm({ ...form, vehicle_num })}
        />
      </TableCell>
      <TableCell>
        <TextInput
          label="出発地"
          isLabelHidden
          size="sm"
          value={form.departure}
          onChange={(departure) => setForm({ ...form, departure })}
          placeholder="出発地"
          width="100%"
        />
      </TableCell>
      <TableCell>
        <TextInput
          label="到着地"
          isLabelHidden
          size="sm"
          value={form.destination}
          onChange={(destination) => setForm({ ...form, destination })}
          placeholder="到着地"
          width="100%"
        />
      </TableCell>
      <TableCell>
        <AmountInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
      </TableCell>
      <TableCell>
        <TextInput
          label="備考"
          isLabelHidden
          size="sm"
          value={form.note}
          onChange={(note) => setForm({ ...form, note })}
          placeholder="備考"
          width="100%"
        />
      </TableCell>
      <TableCell />
      <TableCell>
        <HStack gap={0} hAlign="center">
          <IconButton
            size="sm"
            variant="ghost"
            label="保存"
            tooltip="保存"
            icon={<Save />}
            onClick={handleSave}
            isDisabled={!isValid || isSaving}
          />
          <IconButton
            size="sm"
            variant="ghost"
            label="キャンセル"
            tooltip="キャンセル"
            icon={<X />}
            onClick={onCancel}
            isDisabled={isSaving}
          />
        </HStack>
      </TableCell>
    </TableRow>
  )
}

function DisplayRow({ row, onEdit, onDelete, disabled }) {
  const status = receivableStatus(row)
  const locked = row.invoice_id != null
  const companyName =
    row.companies?.invoice_display_name ||
    row.companies?.name ||
    (row.company_id == null ? '（請求先未選択）' : '(取引先未設定)')

  return (
    <TableRow style={{ opacity: row.companies?.is_active === false ? 0.6 : 1 }}>
      <TableCell>
        {locked ? (
          <IconButton
            size="sm"
            variant="ghost"
            label="請求書発行済み (取消すると編集可)"
            tooltip="請求書発行済み (取消すると編集可)"
            icon={<Lock />}
            isDisabled
          />
        ) : null}
      </TableCell>
      <TableCell>{row.work_date}</TableCell>
      <TableCell>{companyName}</TableCell>
      <TableCell>{formatVehicleNumLabel(row.vehicle_num)}</TableCell>
      <TableCell>{row.departure || '—'}</TableCell>
      <TableCell>{row.destination || '—'}</TableCell>
      <TableCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        ¥{Number(row.amount ?? 0).toLocaleString('ja-JP')}
      </TableCell>
      <TableCell>{row.note || '—'}</TableCell>
      <TableCell>
        <StatusBadge status={status} />
      </TableCell>
      <TableCell>
        <HStack gap={0} hAlign="center">
          <IconButton
            size="sm"
            variant="ghost"
            label="編集"
            tooltip={locked ? '請求書発行済み (編集不可)' : '編集'}
            icon={<Pencil />}
            onClick={() => onEdit(row)}
            isDisabled={disabled || locked}
          />
          <IconButton
            size="sm"
            variant="destructive"
            label="削除"
            tooltip={locked ? '請求書発行済み (削除不可)' : '削除'}
            icon={<Trash2 />}
            onClick={() => onDelete(row)}
            isDisabled={disabled || locked}
          />
        </HStack>
      </TableCell>
    </TableRow>
  )
}

/**
 * 売掛一覧テーブル。表示行と編集行を切り替える。
 *
 * @param {Object} props
 * @param {Array} props.rows         accounts_receivable rows (companies/invoices join 済み)
 * @param {Array} props.companies    取引先マスタ (CompanySelect 用)
 * @param {{year: number, month: number}} props.options
 * @param {(payload: Object, row: Object) => Promise<void>} props.onUpdate
 * @param {(row: Object) => void} props.onDelete
 * @param {boolean} [props.isSaving]
 */
export function ReceivablesTable({ rows, companies, options, onUpdate, onDelete, isSaving }) {
  const [editingId, setEditingId] = useState(null)

  const handleStartEdit = (row) => {
    if (row.invoice_id != null) return
    setEditingId(row.id)
  }

  const handleCancel = () => setEditingId(null)

  const handleSaveEdit = async (payload) => {
    const target = rows.find((r) => r.id === editingId)
    if (!target) return
    try {
      await onUpdate(payload, target)
      setEditingId(null)
    } catch {
      /* error は呼び出し側で表示 */
    }
  }

  return (
    <Table density="compact" hasHover>
      <TableHeader>
        <TableRow isHeaderRow>
          <TableHeaderCell />
          <TableHeaderCell>日付</TableHeaderCell>
          <TableHeaderCell>取引先</TableHeaderCell>
          <TableHeaderCell>号車</TableHeaderCell>
          <TableHeaderCell>出発</TableHeaderCell>
          <TableHeaderCell>到着</TableHeaderCell>
          <TableHeaderCell>金額</TableHeaderCell>
          <TableHeaderCell>備考</TableHeaderCell>
          <TableHeaderCell>状態</TableHeaderCell>
          <TableHeaderCell>操作</TableHeaderCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={10}>
              <Text color="secondary">該当する売掛がありません</Text>
            </TableCell>
          </TableRow>
        ) : null}
        {rows.map((row) =>
          row.id === editingId ? (
            <EditableRow
              key={row.id}
              row={row}
              companies={companies}
              options={options}
              onSave={handleSaveEdit}
              onCancel={handleCancel}
              isSaving={isSaving}
            />
          ) : (
            <DisplayRow
              key={row.id}
              row={row}
              onEdit={handleStartEdit}
              onDelete={onDelete}
              disabled={isSaving || editingId != null}
            />
          )
        )}
      </TableBody>
    </Table>
  )
}
