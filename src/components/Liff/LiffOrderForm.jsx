import { useEffect, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { callLineIntakeApi, listMyLineUnits } from '@/services/lineIntakeService'
import './LiffOrderForm.css'

const LIFF_ID = import.meta.env.VITE_LINE_LIFF_ID || ''

function loadPlacesAutocomplete(inputEl, onPlace) {
  if (!window.google?.maps?.places || !inputEl) return null
  const ac = new window.google.maps.places.Autocomplete(inputEl, {
    componentRestrictions: { country: 'jp' },
    fields: ['formatted_address', 'name'],
  })
  ac.addListener('place_changed', () => {
    const place = ac.getPlace()
    const text = place.formatted_address || place.name || ''
    onPlace(text)
  })
  return ac
}

function ensureMapsScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) {
      resolve()
      return
    }
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!key) {
      reject(new Error('VITE_GOOGLE_MAPS_API_KEY missing'))
      return
    }
    const existing = document.querySelector('script[data-line-places]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&language=ja`
    script.async = true
    script.dataset.linePlaces = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Maps script failed'))
    document.head.appendChild(script)
  })
}

async function initLiffUserId() {
  const params = new URLSearchParams(window.location.search)
  const debugUser = params.get('userId')
  if (debugUser) return debugUser

  if (!LIFF_ID) {
    throw new Error('VITE_LINE_LIFF_ID が未設定です（開発時は ?userId=xxx で代替可）')
  }

  if (!window.liff) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
  }
  await window.liff.init({ liffId: LIFF_ID })
  if (!window.liff.isLoggedIn()) {
    window.liff.login()
    return null
  }
  const profile = await window.liff.getProfile()
  return profile.userId
}

const emptyUnit = () => ({
  pickup_address: '',
  dropoff_address: '',
  vehicle_info: '',
  pickup_at: '',
})

export function LiffOrderForm() {
  const [userId, setUserId] = useState(null)
  const [orderType, setOrderType] = useState('SCHEDULED')
  const [phone, setPhone] = useState('')
  const [units, setUnits] = useState([emptyUnit()])
  const [hint, setHint] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [myUnits, setMyUnits] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const pickupRefs = useRef([])
  const dropoffRefs = useRef([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const id = await initLiffUserId()
        if (!cancelled && id) setUserId(id)
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    listMyLineUnits(userId).then(({ data }) => setMyUnits(data || []))
  }, [userId, result])

  useEffect(() => {
    ensureMapsScript()
      .then(() => {
        units.forEach((_, i) => {
          if (pickupRefs.current[i]) {
            loadPlacesAutocomplete(pickupRefs.current[i], (text) => {
              setUnits((prev) => {
                const next = [...prev]
                next[i] = { ...next[i], pickup_address: text }
                return next
              })
            })
          }
          if (dropoffRefs.current[i]) {
            loadPlacesAutocomplete(dropoffRefs.current[i], (text) => {
              setUnits((prev) => {
                const next = [...prev]
                next[i] = { ...next[i], dropoff_address: text }
                return next
              })
            })
          }
        })
      })
      .catch(() => {
        /* Places なしでも手入力可 */
      })
    // 台数変更時のみ Autocomplete を付け直す（入力中の units 全体依存は避ける）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units.length])

  const updateUnit = (index, patch) => {
    setUnits((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch }
      return next
    })
  }

  const checkHint = async () => {
    setError('')
    const u = units[0]
    const { data, error: apiErr } = await callLineIntakeApi({
      action: 'check',
      order_type: orderType,
      pickup_at: orderType === 'SCHEDULED' ? new Date(u.pickup_at).toISOString() : undefined,
      pickup_address: u.pickup_address,
      dropoff_address: u.dropoff_address,
      unit_count: units.length,
    })
    if (apiErr) {
      setError(apiErr.message)
      return
    }
    setHint(data)
  }

  const submit = async () => {
    setSubmitting(true)
    setError('')
    setResult(null)
    try {
      if (!userId) throw new Error('LINE userId を取得できません')
      if (!phone) throw new Error('連絡先電話番号は必須です')
      for (const u of units) {
        if (!u.pickup_address || !u.dropoff_address || !u.vehicle_info) {
          throw new Error('住所・車両情報は必須です')
        }
        if (orderType === 'SCHEDULED' && !u.pickup_at) {
          throw new Error('希望日時を指定してください')
        }
      }

      const { data, error: apiErr, raw } = await callLineIntakeApi({
        action: 'submit',
        line_user_id: userId,
        contact_phone: phone,
        order_type: orderType,
        units: units.map((u) => ({
          pickup_address: u.pickup_address,
          dropoff_address: u.dropoff_address,
          vehicle_info: u.vehicle_info,
          pickup_at:
            orderType === 'SCHEDULED' ? new Date(u.pickup_at).toISOString() : new Date().toISOString(),
        })),
      })
      if (apiErr) throw new Error(raw?.reason || raw?.error || apiErr.message)

      if (!data.ok) {
        if (data.reason === 'REQUIRE_SCHEDULED') {
          setResult({
            type: 'require_scheduled',
            message: '営業時間外の「今すぐ」は受け付けできません。日時を指定してください。',
          })
        } else {
          setResult({ type: 'rejected', message: `予約不可: ${data.reason || '空きなし'}` })
        }
      } else {
        setResult({
          type: 'tentative',
          message: '仮受付が完了しました。承認をお待ちください。',
          discount: data.discount,
        })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const cancelUnit = async (unitId) => {
    if (!userId) return
    const { error: apiErr } = await callLineIntakeApi({
      action: 'cancel',
      unit_id: unitId,
      line_user_id: userId,
    })
    if (apiErr) {
      setError(apiErr.message)
      return
    }
    const { data } = await listMyLineUnits(userId)
    setMyUnits(data || [])
  }

  return (
    <Box className="liff-order-form">
      <Typography variant="h5" className="liff-order-form__brand" gutterBottom>
        代行運転 受付
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        24時間受付 / LINE割引あり
        {hint?.discount?.applied ? `（${hint.discount.label}）` : '（500円引き）'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {result && (
        <Alert severity={result.type === 'tentative' ? 'success' : 'warning'} sx={{ mb: 2 }}>
          {result.message}
          {result.discount?.applied ? ` / ${result.discount.label}` : ''}
        </Alert>
      )}

      <Typography variant="caption" display="block" mb={1}>
        userId: {userId || '取得中…'}
      </Typography>

      <RadioGroup
        row
        value={orderType}
        onChange={(e) => setOrderType(e.target.value)}
        sx={{ mb: 2 }}
      >
        <FormControlLabel value="NOW" control={<Radio />} label="今すぐ" />
        <FormControlLabel value="SCHEDULED" control={<Radio />} label="日時指定" />
      </RadioGroup>

      <TextField
        label="連絡先電話番号"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        fullWidth
        required
        sx={{ mb: 2 }}
      />

      {units.map((unit, index) => (
        <Stack key={index} spacing={1.5} className="liff-order-form__unit" mb={2}>
          <Typography fontWeight={600}>{index + 1}台目</Typography>
          {orderType === 'SCHEDULED' && (
            <TextField
              label="希望お迎え日時"
              type="datetime-local"
              value={unit.pickup_at}
              onChange={(e) => updateUnit(index, { pickup_at: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
          )}
          <TextField
            label="お迎え先"
            value={unit.pickup_address}
            onChange={(e) => updateUnit(index, { pickup_address: e.target.value })}
            inputRef={(el) => {
              pickupRefs.current[index] = el
            }}
            fullWidth
            required
          />
          <TextField
            label="お帰り先"
            value={unit.dropoff_address}
            onChange={(e) => updateUnit(index, { dropoff_address: e.target.value })}
            inputRef={(el) => {
              dropoffRefs.current[index] = el
            }}
            fullWidth
            required
          />
          <TextField
            label="車両情報"
            value={unit.vehicle_info}
            onChange={(e) => updateUnit(index, { vehicle_info: e.target.value })}
            fullWidth
            required
            placeholder="車種・色・ナンバー等"
          />
        </Stack>
      ))}

      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <Button onClick={() => setUnits((u) => [...u, emptyUnit()])}>台を追加</Button>
        {units.length > 1 && (
          <Button onClick={() => setUnits((u) => u.slice(0, -1))}>末尾の台を削除</Button>
        )}
        <Button onClick={checkHint}>最短目安・可否を確認</Button>
      </Stack>

      {hint && (
        <Alert severity={hint.ok ? 'info' : 'warning'} sx={{ mb: 2 }}>
          {hint.ok
            ? `目安: ${hint.earliestHint ? new Date(hint.earliestHint).toLocaleString('ja-JP') : '—'} / 所要+バッファ ${hint.totalDurationMin}分${hint.usesExtraCapacity ? ' / 要手配見込み' : ''}`
            : `不可: ${hint.reason === 'REQUIRE_SCHEDULED' ? '日時指定してください' : hint.reason}`}
        </Alert>
      )}

      <Button variant="contained" fullWidth onClick={submit} disabled={submitting || !userId}>
        申し込む
      </Button>

      <Typography variant="subtitle1" mt={3} mb={1}>
        自分の予約（キャンセル可 / 時間変更は再申込）
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
        ※ 時間の直接変更はできません。キャンセル後に再度お申し込みください。
      </Typography>
      <Stack spacing={1}>
        {myUnits.map((u) => (
          <Box key={u.id} className="liff-order-form__my-unit">
            <Typography variant="body2">
              {new Date(u.pickup_at).toLocaleString('ja-JP')} [{u.status}]
            </Typography>
            <Button size="small" color="error" onClick={() => cancelUnit(u.id)}>
              キャンセル
            </Button>
          </Box>
        ))}
        {myUnits.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            予約はありません
          </Typography>
        )}
      </Stack>
    </Box>
  )
}
