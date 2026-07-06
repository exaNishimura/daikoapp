import { useMemo, useState } from 'react'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import EditIcon from '@mui/icons-material/Edit'
import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Cancel'
import DeleteIcon from '@mui/icons-material/Delete'
import LockIcon from '@mui/icons-material/Lock'
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
    <TableRow hover>
      <TableCell />
      <TableCell>
        <TextField
          type="date"
          size="small"
          value={form.work_date}
          onChange={(e) => setForm({ ...form, work_date: e.target.value })}
          error={!!errors.work_date}
          helperText={errors.work_date}
          inputProps={{
            min: `${options.year}-${String(options.month).padStart(2, '0')}-01`,
            max: `${options.year}-${String(options.month).padStart(2, '0')}-31`,
          }}
        />
      </TableCell>
      <TableCell sx={{ minWidth: 200 }}>
        <CompanySelect
          companies={companies}
          value={form.company_id}
          onChange={(id) => setForm({ ...form, company_id: id })}
          includeInactive
        />
      </TableCell>
      <TableCell sx={{ minWidth: 100 }}>
        <VehicleNumSelect
          value={form.vehicle_num}
          onChange={(vehicle_num) => setForm({ ...form, vehicle_num })}
        />
      </TableCell>
      <TableCell>
        <TextField
          size="small"
          value={form.departure}
          onChange={(e) => setForm({ ...form, departure: e.target.value })}
          placeholder="出発地"
        />
      </TableCell>
      <TableCell>
        <TextField
          size="small"
          value={form.destination}
          onChange={(e) => setForm({ ...form, destination: e.target.value })}
          placeholder="到着地"
        />
      </TableCell>
      <TableCell align="right" sx={{ minWidth: 140 }}>
        <AmountInput
          value={form.amount}
          onChange={(v) => setForm({ ...form, amount: v })}
        />
      </TableCell>
      <TableCell>
        <TextField
          size="small"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="備考"
        />
      </TableCell>
      <TableCell />
      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
        <Tooltip title="保存">
          <span>
            <IconButton
              size="small"
              color="primary"
              onClick={handleSave}
              disabled={!isValid || isSaving}
            >
              <SaveIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="キャンセル">
          <IconButton size="small" onClick={onCancel} disabled={isSaving}>
            <CancelIcon fontSize="small" />
          </IconButton>
        </Tooltip>
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
    <TableRow hover sx={{ opacity: row.companies?.is_active === false ? 0.6 : 1 }}>
      <TableCell width={28}>
        {locked && (
          <Tooltip title="請求書発行済み (取消すると編集可)">
            <LockIcon fontSize="small" color="action" />
          </Tooltip>
        )}
      </TableCell>
      <TableCell>{row.work_date}</TableCell>
      <TableCell>{companyName}</TableCell>
      <TableCell>{formatVehicleNumLabel(row.vehicle_num)}</TableCell>
      <TableCell>{row.departure || '—'}</TableCell>
      <TableCell>{row.destination || '—'}</TableCell>
      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        ¥{Number(row.amount ?? 0).toLocaleString('ja-JP')}
      </TableCell>
      <TableCell sx={{ maxWidth: 220 }}>{row.note || '—'}</TableCell>
      <TableCell>
        <StatusBadge status={status} />
      </TableCell>
      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
        <Tooltip title={locked ? '請求書発行済み (編集不可)' : '編集'}>
          <span>
            <IconButton
              size="small"
              color="primary"
              onClick={() => onEdit(row)}
              disabled={disabled || locked}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={locked ? '請求書発行済み (削除不可)' : '削除'}>
          <span>
            <IconButton
              size="small"
              color="error"
              onClick={() => onDelete(row)}
              disabled={disabled || locked}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
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
export function ReceivablesTable({
  rows,
  companies,
  options,
  onUpdate,
  onDelete,
  isSaving,
}) {
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
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell>日付</TableCell>
            <TableCell>取引先</TableCell>
            <TableCell>号車</TableCell>
            <TableCell>出発</TableCell>
            <TableCell>到着</TableCell>
            <TableCell align="right">金額</TableCell>
            <TableCell>備考</TableCell>
            <TableCell>状態</TableCell>
            <TableCell align="center">操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                該当する売掛がありません
              </TableCell>
            </TableRow>
          )}
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
    </TableContainer>
  )
}
