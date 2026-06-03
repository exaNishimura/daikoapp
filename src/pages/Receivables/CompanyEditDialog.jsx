import { useMemo, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Autocomplete from '@mui/material/Autocomplete'
import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Cancel'
import { normalizeAliases, validateCompanyForm } from '@/lib/billing/companyForm'

const EMPTY_FORM = {
  name: '',
  invoice_display_name: '',
  aliases: [],
  display_order: 0,
  is_active: true,
  memo: '',
}

function initialFormFor(company, existingCompanies) {
  if (company) {
    return {
      name: company.name ?? '',
      invoice_display_name: company.invoice_display_name ?? '',
      aliases: Array.isArray(company.aliases) ? [...company.aliases] : [],
      display_order: company.display_order ?? 0,
      is_active: company.is_active !== false,
      memo: company.memo ?? '',
    }
  }
  const nextOrder =
    existingCompanies.reduce((max, c) => Math.max(max, c.display_order ?? 0), 0) + 10
  return { ...EMPTY_FORM, display_order: nextOrder }
}

function DialogBody({ company, existingCompanies, onSave, onClose, loading }) {
  const isEdit = company != null
  const [form, setForm] = useState(() => initialFormFor(company, existingCompanies))
  const [submitError, setSubmitError] = useState(null)

  const { errors } = useMemo(
    () => validateCompanyForm(form, existingCompanies, isEdit ? company.id : null),
    [form, existingCompanies, isEdit, company]
  )

  const handleSave = async () => {
    if (Object.keys(errors).length > 0) return
    const payload = {
      name: String(form.name).trim(),
      invoice_display_name:
        form.invoice_display_name?.trim() === ''
          ? null
          : String(form.invoice_display_name).trim(),
      aliases: normalizeAliases(form.aliases),
      display_order: Number(form.display_order) || 0,
      is_active: !!form.is_active,
      memo: form.memo?.trim() === '' ? null : String(form.memo).trim(),
    }
    try {
      setSubmitError(null)
      await onSave?.(payload)
      onClose?.()
    } catch (err) {
      setSubmitError(err?.message || '保存に失敗しました')
    }
  }

  return (
    <>
      <DialogTitle>{isEdit ? '取引先を編集' : '取引先を新規追加'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="取引先名 (マスタ)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={!!errors.name}
            helperText={errors.name || '社内で識別する正式名称'}
            required
            fullWidth
            disabled={loading}
            autoFocus
          />
          <TextField
            label="請求書表記名 (任意)"
            value={form.invoice_display_name ?? ''}
            onChange={(e) =>
              setForm({ ...form, invoice_display_name: e.target.value })
            }
            helperText="空欄ならマスタ名をそのまま使用"
            fullWidth
            disabled={loading}
          />
          <Autocomplete
            multiple
            freeSolo
            options={[]}
            value={form.aliases}
            onChange={(_e, next) => setForm({ ...form, aliases: normalizeAliases(next) })}
            renderInput={(params) => (
              <TextField
                {...params}
                label="別名 / 表記ゆれ (Enter で追加)"
                helperText="「鈴友」「(株)鈴友」など。半角化と空白 trim は保存時に自動適用"
                disabled={loading}
              />
            )}
          />
          <TextField
            label="並び順"
            type="number"
            value={form.display_order}
            onChange={(e) => setForm({ ...form, display_order: e.target.value })}
            error={!!errors.display_order}
            helperText={errors.display_order || '数値が小さいほど上に表示'}
            inputProps={{ step: 1 }}
            fullWidth
            disabled={loading}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                disabled={loading}
              />
            }
            label="有効"
          />
          <TextField
            label="メモ"
            value={form.memo ?? ''}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
            fullWidth
            multiline
            minRows={2}
            disabled={loading}
          />
          {submitError && (
            <Box sx={{ color: 'error.main', fontSize: 13 }}>{submitError}</Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={<CancelIcon />} disabled={loading}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={loading || Object.keys(errors).length > 0}
        >
          保存
        </Button>
      </DialogActions>
    </>
  )
}

/**
 * 取引先の新規追加 / 編集ダイアログ。
 *
 * 中身は `open=true` のときだけマウントするので、フォーム state は
 * useState の初期値で初期化できる（useEffect での同期不要）。
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Object|null} props.company          編集対象 (null = 新規)
 * @param {Array} props.existingCompanies      重複名チェック用
 * @param {(payload: Object) => Promise<void>} props.onSave
 * @param {boolean} [props.loading]
 */
export function CompanyEditDialog({
  open,
  onClose,
  company,
  existingCompanies = [],
  onSave,
  loading = false,
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      {open && (
        <DialogBody
          company={company}
          existingCompanies={existingCompanies}
          onSave={onSave}
          onClose={onClose}
          loading={loading}
        />
      )}
    </Dialog>
  )
}
