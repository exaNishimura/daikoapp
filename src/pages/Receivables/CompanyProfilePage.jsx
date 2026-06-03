import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import SaveIcon from '@mui/icons-material/Save'
import RestoreIcon from '@mui/icons-material/Restore'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  useCompanyProfile,
  useUpdateCompanyProfile,
} from '@/hooks/billing/useCompanyProfile'
import {
  BANK_ACCOUNT_TYPES,
  COMPANY_PROFILE_FIELDS,
  EMPTY_COMPANY_PROFILE,
  normalizePostalCode,
  validateCompanyProfileForm,
} from '@/lib/billing/companyProfileForm'

function pickProfileFields(data) {
  if (!data) return { ...EMPTY_COMPANY_PROFILE }
  const out = { ...EMPTY_COMPANY_PROFILE }
  for (const field of COMPANY_PROFILE_FIELDS) {
    if (data[field] != null) out[field] = data[field]
  }
  return out
}

function ProfileForm({ initial, onSave, isSaving }) {
  const [form, setForm] = useState(initial)
  const [serverSnapshot, setServerSnapshot] = useState(initial)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const { errors, isValid } = useMemo(() => validateCompanyProfileForm(form), [form])

  const isDirty = useMemo(
    () =>
      COMPANY_PROFILE_FIELDS.some(
        (f) => (form[f] ?? '') !== (serverSnapshot[f] ?? '')
      ),
    [form, serverSnapshot]
  )

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleBlurPostal = () =>
    setForm((prev) => ({ ...prev, postal_code: normalizePostalCode(prev.postal_code) }))

  const handleReset = () => {
    setForm(serverSnapshot)
    setError(null)
    setSuccess(null)
  }

  const handleSave = async () => {
    if (!isValid) return
    setError(null)
    setSuccess(null)
    const payload = COMPANY_PROFILE_FIELDS.reduce((acc, f) => {
      const v = form[f]
      acc[f] = typeof v === 'string' ? v.trim() : v
      return acc
    }, {})
    payload.postal_code = normalizePostalCode(payload.postal_code)

    try {
      const saved = await onSave(payload)
      const next = pickProfileFields(saved ?? payload)
      setForm(next)
      setServerSnapshot(next)
      setSuccess('自社情報を保存しました')
    } catch (err) {
      setError(`保存に失敗: ${err.message}`)
    }
  }

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
          <TextField
            label="屋号 / 社名"
            value={form.name}
            onChange={handleChange('name')}
            error={!!errors.name}
            helperText={errors.name || '請求書ヘッダに刷り込まれる社名'}
            required
            fullWidth
            disabled={isSaving}
            sx={{ gridColumn: '1 / -1' }}
          />
          <TextField
            label="郵便番号"
            value={form.postal_code}
            onChange={handleChange('postal_code')}
            onBlur={handleBlurPostal}
            error={!!errors.postal_code}
            helperText={errors.postal_code || '123-4567 形式（ハイフン無しでも自動補完）'}
            required
            disabled={isSaving}
          />
          <TextField
            label="インボイス番号"
            value={form.invoice_number}
            onChange={handleChange('invoice_number')}
            error={!!errors.invoice_number}
            helperText={errors.invoice_number || '例: T1234567890123'}
            required
            disabled={isSaving}
          />
          <TextField
            label="住所"
            value={form.address}
            onChange={handleChange('address')}
            error={!!errors.address}
            helperText={errors.address}
            required
            fullWidth
            disabled={isSaving}
            sx={{ gridColumn: '1 / -1' }}
          />
        </Box>

        <Divider sx={{ my: 3 }}>振込先</Divider>

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
          <TextField
            label="銀行名"
            value={form.bank}
            onChange={handleChange('bank')}
            error={!!errors.bank}
            helperText={errors.bank}
            required
            disabled={isSaving}
          />
          <TextField
            label="支店名"
            value={form.bank_branch}
            onChange={handleChange('bank_branch')}
            error={!!errors.bank_branch}
            helperText={errors.bank_branch}
            required
            disabled={isSaving}
          />
          <TextField
            label="口座種別"
            select
            value={form.bank_account_type}
            onChange={handleChange('bank_account_type')}
            error={!!errors.bank_account_type}
            helperText={errors.bank_account_type}
            required
            disabled={isSaving}
          >
            {BANK_ACCOUNT_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="口座番号"
            value={form.bank_account_number}
            onChange={handleChange('bank_account_number')}
            error={!!errors.bank_account_number}
            helperText={errors.bank_account_number || '数字のみ。先頭 0 も保持'}
            required
            disabled={isSaving}
            inputProps={{ inputMode: 'numeric' }}
          />
          <TextField
            label="口座名義"
            value={form.bank_account_holder}
            onChange={handleChange('bank_account_holder')}
            error={!!errors.bank_account_holder}
            helperText={errors.bank_account_holder || 'カタカナ推奨'}
            required
            fullWidth
            disabled={isSaving}
            sx={{ gridColumn: '1 / -1' }}
          />
        </Box>

        <Box sx={{ mt: 3, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button
            onClick={handleReset}
            startIcon={<RestoreIcon />}
            disabled={isSaving || !isDirty}
          >
            元に戻す
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={isSaving || !isValid || !isDirty}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </Box>
      </Paper>
    </>
  )
}

export function CompanyProfilePage() {
  const navigate = useNavigate()
  const profileQuery = useCompanyProfile()
  const updateMutation = useUpdateCompanyProfile()

  const initial = useMemo(
    () => pickProfileFields(profileQuery.data),
    [profileQuery.data]
  )

  const isLoading = profileQuery.isLoading
  const ready = !isLoading

  return (
    <Box sx={{ p: 3, maxWidth: 720, mx: 'auto' }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate(-1)} aria-label="戻る">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4" component="h1">
          自社情報
        </Typography>
      </Box>

      {profileQuery.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          自社情報の取得に失敗: {profileQuery.error.message}
        </Alert>
      )}

      {!ready && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography>読み込み中...</Typography>
        </Box>
      )}

      {ready && (
        <ProfileForm
          key={profileQuery.data?.updated_at ?? 'empty'}
          initial={initial}
          isSaving={updateMutation.isPending}
          onSave={(payload) => updateMutation.mutateAsync(payload)}
        />
      )}
    </Box>
  )
}
