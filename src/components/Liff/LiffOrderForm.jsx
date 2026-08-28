import { useEffect, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import {
  callLineIntakeApi,
  fetchLiffNightOccupancy,
  listMyLineUnits,
} from '@/services/lineIntakeService'
import {
  buildLiffNightSlots,
  firstAvailableSlot,
  formatLiffHourOptionLabel,
  formatLiffMinuteOptionLabel,
  hourHasAvailable,
  occupiedFromSources,
} from '@/utils/liffNightSlots'
import {
  LIFF_PICKUP_HOURS,
  LIFF_PICKUP_MINUTES,
  combineOvernightPickup,
  formatLiffPickupConfirmMessage,
  formatLiffPickupPreview,
  getMinLiffPickupDate,
  isLiffNowAvailable,
  nextLiffPickupAt,
} from '@/utils/liffPickupTime'
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
  pickup_date: getMinLiffPickupDate(),
  pickup_hour: '',
  pickup_minute: '',
})

function unitPickupAt(unit) {
  return combineOvernightPickup(unit.pickup_date, unit.pickup_hour, unit.pickup_minute)
}

function formatHintDateTime(value) {
  return new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

function formatCheckHint(hint) {
  if (hint.ok) {
    const when = hint.earliestHint ? formatHintDateTime(hint.earliestHint) : '—'
    return `目安: ${when} / 所要+バッファ ${hint.totalDurationMin}分${hint.usesExtraCapacity ? ' / 要手配見込み' : ''}`
  }
  if (hint.reason === 'REQUIRE_SCHEDULED') {
    const when = formatHintDateTime(hint.earliestHint || nextLiffPickupAt())
    return `「今すぐ」は営業時間外です。最短目安: ${when}。日時を指定してください`
  }
  return `不可: ${hint.reason}`
}

export function LiffOrderForm() {
  const [userId, setUserId] = useState(null)
  const nowAvailable = isLiffNowAvailable()
  const [orderType, setOrderType] = useState(() => (isLiffNowAvailable() ? 'NOW' : 'SCHEDULED'))
  const [phone, setPhone] = useState('')
  const [unit, setUnit] = useState(emptyUnit)
  const [hint, setHint] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [myUnits, setMyUnits] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState('')
  const [occupancy, setOccupancy] = useState({
    occupiedIntervals: [],
    phoneLocks: [],
    settings: {},
  })
  const pickupRef = useRef(null)
  const dropoffRef = useRef(null)
  const nightDate = unit.pickup_date || ''

  const nightSlots = buildLiffNightSlots({
    nightDate,
    occupiedIntervals: occupancy.occupiedIntervals,
    phoneLocks: occupancy.phoneLocks,
    settings: occupancy.settings,
  })

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
    if (!nowAvailable) setOrderType('SCHEDULED')
  }, [nowAvailable])

  useEffect(() => {
    if (!nightDate) return undefined
    let cancelled = false
    ;(async () => {
      const { data, error: occErr } = await fetchLiffNightOccupancy(nightDate)
      if (cancelled) return
      if (occErr) {
        console.error(occErr)
        setOccupancy({ occupiedIntervals: [], phoneLocks: [], settings: {} })
        return
      }
      setOccupancy({
        occupiedIntervals: occupiedFromSources(data),
        phoneLocks: data.phoneLocks || [],
        settings: data.settings || {},
      })
    })()
    return () => {
      cancelled = true
    }
  }, [nightDate])

  useEffect(() => {
    if (!nightDate) return
    setUnit((prev) => {
      const slots = buildLiffNightSlots({
        nightDate: prev.pickup_date || nightDate,
        occupiedIntervals: occupancy.occupiedIntervals,
        phoneLocks: occupancy.phoneLocks,
        settings: occupancy.settings,
      })
      const current = slots.find(
        (s) => s.hour === prev.pickup_hour && s.minute === prev.pickup_minute
      )
      if (current?.available) return prev
      const first = firstAvailableSlot(slots)
      if (!first) return prev
      return {
        ...prev,
        pickup_hour: first.hour,
        pickup_minute: first.minute,
      }
    })
  }, [nightDate, occupancy])

  useEffect(() => {
    if (!userId) return
    listMyLineUnits(userId).then(({ data }) => setMyUnits(data || []))
  }, [userId, result])

  useEffect(() => {
    ensureMapsScript()
      .then(() => {
        if (pickupRef.current) {
          loadPlacesAutocomplete(pickupRef.current, (text) => {
            setUnit((prev) => ({ ...prev, pickup_address: text }))
          })
        }
        if (dropoffRef.current) {
          loadPlacesAutocomplete(dropoffRef.current, (text) => {
            setUnit((prev) => ({ ...prev, dropoff_address: text }))
          })
        }
      })
      .catch(() => {
        /* Places なしでも手入力可 */
      })
  }, [])

  const updateUnit = (patch) => {
    setUnit((prev) => ({ ...prev, ...patch }))
  }

  const updateUnitHour = (hour) => {
    const minutes = nightSlots.filter((s) => s.hour === hour && s.available)
    const minute = minutes.some((s) => s.minute === unit.pickup_minute)
      ? unit.pickup_minute
      : (minutes[0]?.minute ?? '')
    updateUnit({ pickup_hour: hour, pickup_minute: minute })
  }

  const checkHint = async () => {
    setError('')
    const pickupAt = orderType === 'SCHEDULED' ? unitPickupAt(unit) : null
    if (orderType === 'SCHEDULED' && !pickupAt) {
      setError('希望日・時・分を指定してください')
      return
    }
    const { data, error: apiErr } = await callLineIntakeApi({
      action: 'check',
      order_type: orderType,
      pickup_at: pickupAt ? pickupAt.toISOString() : undefined,
      pickup_address: unit.pickup_address,
      dropoff_address: unit.dropoff_address,
      unit_count: 1,
    })
    if (apiErr) {
      setError(apiErr.message)
      return
    }
    setHint(data)
  }

  const validateBeforeSubmit = () => {
    if (!userId) throw new Error('LINE userId を取得できません')
    if (!phone) throw new Error('連絡先電話番号は必須です')
    if (!unit.pickup_address || !unit.dropoff_address || !unit.vehicle_info) {
      throw new Error('住所・車両情報は必須です')
    }
    if (orderType === 'SCHEDULED') {
      const pickupAt = unitPickupAt(unit)
      if (!pickupAt) throw new Error('希望日・時・分を指定してください')
      if (pickupAt.getTime() <= Date.now()) throw new Error('過去の日時は指定できません')
    }
  }

  const requestConfirm = () => {
    setError('')
    setResult(null)
    try {
      validateBeforeSubmit()
      const pickupAt = orderType === 'SCHEDULED' ? unitPickupAt(unit) : null
      const message = formatLiffPickupConfirmMessage(pickupAt, { orderType })
      if (!message) throw new Error('希望日時を確認できません')
      setConfirmMessage(message)
      setConfirmOpen(true)
    } catch (e) {
      setError(e.message)
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setError('')
    setResult(null)
    try {
      validateBeforeSubmit()

      const {
        data,
        error: apiErr,
        raw,
      } = await callLineIntakeApi({
        action: 'submit',
        line_user_id: userId,
        contact_phone: phone,
        order_type: orderType,
        units: [
          {
            pickup_address: unit.pickup_address,
            dropoff_address: unit.dropoff_address,
            vehicle_info: unit.vehicle_info,
            pickup_at:
              orderType === 'SCHEDULED'
                ? unitPickupAt(unit).toISOString()
                : new Date().toISOString(),
          },
        ],
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
          message: '仮受付が完了しました。運営の承認をお待ちください。',
          discount: data.discount,
        })
      }
      setConfirmOpen(false)
    } catch (e) {
      setError(e.message)
      setConfirmOpen(false)
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

      <Alert severity="info" sx={{ mb: 2 }}>
        1回の予約は1台までです。2台以上ご利用の場合は、それぞれの車の持ち主がLINEから予約してください。
      </Alert>

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

      {nowAvailable ? (
        <RadioGroup
          row
          value={orderType}
          onChange={(e) => setOrderType(e.target.value)}
          sx={{ mb: 2 }}
        >
          <FormControlLabel value="NOW" control={<Radio />} label="今すぐ" />
          <FormControlLabel value="SCHEDULED" control={<Radio />} label="日時指定" />
        </RadioGroup>
      ) : null}

      <TextField
        label="連絡先電話番号"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        fullWidth
        required
        sx={{ mb: 2 }}
      />

      <Stack spacing={1.5} className="liff-order-form__unit" mb={2}>
        {orderType === 'SCHEDULED' ? (
          <Stack spacing={1}>
            <TextField
              label="希望日（その夜）"
              type="date"
              value={unit.pickup_date}
              onChange={(e) => updateUnit({ pickup_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: getMinLiffPickupDate() }}
              fullWidth
              required
            />
            <Stack direction="row" spacing={1.5} useFlexGap>
              <FormControl sx={{ flex: 1 }} required>
                <InputLabel id="liff-hour">時</InputLabel>
                <Select
                  labelId="liff-hour"
                  label="時"
                  value={
                    unit.pickup_hour === '' || unit.pickup_hour == null ? '' : unit.pickup_hour
                  }
                  onChange={(e) =>
                    updateUnitHour(e.target.value === '' ? '' : Number(e.target.value))
                  }
                >
                  {LIFF_PICKUP_HOURS.map((hour) => (
                    <MenuItem
                      key={hour}
                      value={hour}
                      disabled={!hourHasAvailable(nightSlots, hour)}
                    >
                      {formatLiffHourOptionLabel(hour, nightSlots)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl sx={{ flex: 1 }} required>
                <InputLabel id="liff-minute">分</InputLabel>
                <Select
                  labelId="liff-minute"
                  label="分"
                  value={
                    unit.pickup_minute === '' || unit.pickup_minute == null
                      ? ''
                      : unit.pickup_minute
                  }
                  onChange={(e) =>
                    updateUnit({
                      pickup_minute: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                >
                  {LIFF_PICKUP_MINUTES.map((minute) => {
                    const slot = nightSlots.find(
                      (s) => s.hour === unit.pickup_hour && s.minute === minute
                    ) || { minute, past: false, booked: false, available: true }
                    return (
                      <MenuItem key={minute} value={minute} disabled={!slot.available}>
                        {formatLiffMinuteOptionLabel(slot)}
                      </MenuItem>
                    )
                  })}
                </Select>
              </FormControl>
            </Stack>
            <Typography className="liff-order-form__pickup-note" component="p">
              ※ 0時〜5時は翌朝です。日付は「お酒を飲む夜」を選んでください
            </Typography>
            {unitPickupAt(unit) ? (
              <Typography className="liff-order-form__pickup-preview" component="p">
                {formatLiffPickupPreview(unitPickupAt(unit))}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
        <TextField
          label="お迎え先"
          value={unit.pickup_address}
          onChange={(e) => updateUnit({ pickup_address: e.target.value })}
          inputRef={pickupRef}
          fullWidth
          required
        />
        <TextField
          label="お帰り先"
          value={unit.dropoff_address}
          onChange={(e) => updateUnit({ dropoff_address: e.target.value })}
          inputRef={dropoffRef}
          fullWidth
          required
        />
        <TextField
          label="車両情報"
          value={unit.vehicle_info}
          onChange={(e) => updateUnit({ vehicle_info: e.target.value })}
          fullWidth
          required
          placeholder="車種・色・ナンバー等"
        />
      </Stack>

      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <Button onClick={checkHint}>最短目安・可否を確認</Button>
      </Stack>

      {hint && (
        <Alert severity={hint.ok ? 'info' : 'warning'} sx={{ mb: 2 }}>
          {formatCheckHint(hint)}
        </Alert>
      )}

      <Button
        variant="contained"
        fullWidth
        onClick={requestConfirm}
        disabled={submitting || !userId}
      >
        申し込む
      </Button>

      <Dialog
        open={confirmOpen}
        onClose={submitting ? undefined : () => setConfirmOpen(false)}
        aria-labelledby="liff-confirm-title"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="liff-confirm-title">予約内容の確認</DialogTitle>
        <DialogContent>
          <Typography sx={{ pt: 0.5 }}>{confirmMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={submitting}>
            戻る
          </Button>
          <Button variant="contained" onClick={submit} disabled={submitting}>
            申し込む
          </Button>
        </DialogActions>
      </Dialog>

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
