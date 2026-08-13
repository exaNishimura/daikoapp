import { useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useAdminLineUnitAction, useLineIntakeSettings } from '@/hooks/useLineIntake'
import './LineSettingsPage.css'

export function LineSettingsPage() {
  const { data, isLoading, error } = useLineIntakeSettings()
  const save = useAdminLineUnitAction()
  const [pin, setPin] = useState('')
  const [draft, setDraft] = useState(null)
  const [message, setMessage] = useState('')
  const [err, setErr] = useState('')

  const form = draft ?? {
    weekday_fleet_count: data?.weekday_fleet_count ?? 1,
    weekend_fleet_count: data?.weekend_fleet_count ?? 2,
    max_fleet_count: data?.max_fleet_count ?? 3,
    extra_capacity_max: data?.extra_capacity_max ?? 2,
    discount_amount: data?.discount_config?.amount ?? 500,
  }

  const setField = (key, value) => {
    setDraft({ ...form, [key]: value })
  }

  const onSave = async () => {
    setMessage('')
    setErr('')
    try {
      await save.mutateAsync({
        action: 'update_settings',
        weekday_fleet_count: Number(form.weekday_fleet_count),
        weekend_fleet_count: Number(form.weekend_fleet_count),
        max_fleet_count: Number(form.max_fleet_count),
        extra_capacity_max: Number(form.extra_capacity_max),
        discount_config: {
          type: 'FIXED_YEN',
          amount: Number(form.discount_amount),
          currency: 'JPY',
        },
        ...(pin ? { pin } : {}),
      })
      setMessage('保存しました')
      setPin('')
      setDraft(null)
    } catch (e) {
      setErr(e.message || '保存に失敗しました')
    }
  }

  return (
    <Box className="line-settings-page" sx={{ p: 2, maxWidth: 480 }}>
      <Typography variant="h5" mb={2}>
        LINE 受注設定
      </Typography>
      {isLoading && <Typography>読み込み中…</Typography>}
      {error && <Alert severity="error">{error.message}</Alert>}
      <Stack spacing={2}>
        <TextField
          label="平日稼働台数"
          type="number"
          value={form.weekday_fleet_count}
          onChange={(e) => setField('weekday_fleet_count', e.target.value)}
        />
        <TextField
          label="金土稼働台数"
          type="number"
          value={form.weekend_fleet_count}
          onChange={(e) => setField('weekend_fleet_count', e.target.value)}
        />
        <TextField
          label="最大台数（将来）"
          type="number"
          value={form.max_fleet_count}
          onChange={(e) => setField('max_fleet_count', e.target.value)}
        />
        <TextField
          label="仮想余裕枠上限 (+1〜+2)"
          type="number"
          value={form.extra_capacity_max}
          onChange={(e) => setField('extra_capacity_max', e.target.value)}
        />
        <TextField
          label="LINE割引額（円）"
          type="number"
          value={form.discount_amount}
          onChange={(e) => setField('discount_amount', e.target.value)}
        />
        <TextField
          label="配車画面 PIN 変更（6桁・空なら変更なし）"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputProps={{ maxLength: 6, inputMode: 'numeric' }}
        />
        <Typography variant="caption" color="text.secondary">
          配車画面を開くときに1回入力します。予約ごとの承認には使いません。ハッシュ化して保存します。
        </Typography>
        {message && <Alert severity="success">{message}</Alert>}
        {err && <Alert severity="error">{err}</Alert>}
        <Button variant="contained" onClick={onSave} disabled={save.isPending}>
          保存
        </Button>
      </Stack>
    </Box>
  )
}
