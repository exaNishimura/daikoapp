import { useEffect, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { DateInput } from '@astryxdesign/core/DateInput'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack, Layout, LayoutContent, LayoutFooter, VStack } from '@astryxdesign/core/Layout'
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { PlacesAutocompleteField } from '@/components/PlacesAutocompleteField'
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
import { snapshotDiscount } from '@/lib/lineIntake/discount'
import './LiffOrderForm.css'

const LIFF_ID = import.meta.env.VITE_LINE_LIFF_ID || ''

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

function resultBannerStatus(type) {
  if (type === 'tentative') return 'success'
  return 'warning'
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

  const handleConfirmOpenChange = (isOpen) => {
    if (!isOpen && !submitting) setConfirmOpen(false)
  }

  const discountSnap =
    hint?.discount ?? snapshotDiscount(occupancy.settings?.discount_config)
  const discountLine = discountSnap.applied
    ? `LINE割引あり（${discountSnap.label}）`
    : 'LINE割引なし'

  return (
    <VStack gap={4} className="liff-order-form">
      <VStack gap={1}>
        <Heading level={1} className="liff-order-form__brand">
          代行運転 受付
        </Heading>
        <Text color="secondary">24時間受付 / {discountLine}</Text>
      </VStack>

      <Banner
        status="info"
        title="1回の予約は1台までです。2台以上ご利用の場合は、それぞれの車の持ち主がLINEから予約してください。"
        collapsible={false}
      />

      {error ? <Banner status="error" title={error} collapsible={false} /> : null}
      {result ? (
        <Banner
          status={resultBannerStatus(result.type)}
          title={`${result.message}${result.discount?.applied ? ` / ${result.discount.label}` : ''}`}
          collapsible={false}
        />
      ) : null}

      <Text color="secondary">userId: {userId || '取得中…'}</Text>

      {nowAvailable ? (
        <RadioList
          label="受付方法"
          isLabelHidden
          value={orderType}
          onChange={setOrderType}
          orientation="horizontal"
        >
          <RadioListItem value="NOW" label="今すぐ" />
          <RadioListItem value="SCHEDULED" label="日時指定" />
        </RadioList>
      ) : null}

      <TextInput
        label="連絡先電話番号"
        value={phone}
        onChange={setPhone}
        isRequired
        width="100%"
      />

      <VStack gap={3} className="liff-order-form__unit">
        {orderType === 'SCHEDULED' ? (
          <VStack gap={2}>
            <DateInput
              label="希望日（その夜）"
              value={unit.pickup_date || undefined}
              onChange={(value) => updateUnit({ pickup_date: value || '' })}
              min={getMinLiffPickupDate()}
              isRequired
              weekStartsOn="mon"
              width="100%"
            />
            <HStack gap={3}>
              <Selector
                label="時"
                isRequired
                width="100%"
                value={
                  unit.pickup_hour === '' || unit.pickup_hour == null
                    ? undefined
                    : String(unit.pickup_hour)
                }
                onChange={(next) => updateUnitHour(next === '' ? '' : Number(next))}
                options={LIFF_PICKUP_HOURS.map((hour) => ({
                  value: String(hour),
                  label: formatLiffHourOptionLabel(hour, nightSlots),
                  disabled: !hourHasAvailable(nightSlots, hour),
                }))}
              />
              <Selector
                label="分"
                isRequired
                width="100%"
                value={
                  unit.pickup_minute === '' || unit.pickup_minute == null
                    ? undefined
                    : String(unit.pickup_minute)
                }
                onChange={(next) =>
                  updateUnit({
                    pickup_minute: next === '' ? '' : Number(next),
                  })
                }
                options={LIFF_PICKUP_MINUTES.map((minute) => {
                  const slot = nightSlots.find(
                    (s) => s.hour === unit.pickup_hour && s.minute === minute
                  ) || { minute, past: false, booked: false, available: true }
                  return {
                    value: String(minute),
                    label: formatLiffMinuteOptionLabel(slot),
                    disabled: !slot.available,
                  }
                })}
              />
            </HStack>
            <Text className="liff-order-form__pickup-note">
              ※ 0時〜5時は翌朝です。日付は「お酒を飲む夜」を選んでください
            </Text>
            {unitPickupAt(unit) ? (
              <Text className="liff-order-form__pickup-preview">
                {formatLiffPickupPreview(unitPickupAt(unit))}
              </Text>
            ) : null}
          </VStack>
        ) : null}
        <PlacesAutocompleteField
          label="お迎え先"
          value={unit.pickup_address}
          onChange={(text) => updateUnit({ pickup_address: text })}
          required
        />
        <PlacesAutocompleteField
          label="お帰り先"
          value={unit.dropoff_address}
          onChange={(text) => updateUnit({ dropoff_address: text })}
          required
        />
        <TextInput
          label="車両情報"
          value={unit.vehicle_info}
          onChange={(value) => updateUnit({ vehicle_info: value })}
          isRequired
          width="100%"
          placeholder="車種・色・ナンバー等"
        />
      </VStack>

      <Button label="最短目安・可否を確認" variant="secondary" onClick={checkHint} />

      {hint ? (
        <Banner
          status={hint.ok ? 'info' : 'warning'}
          title={formatCheckHint(hint)}
          collapsible={false}
        />
      ) : null}

      <Button
        label="申し込む"
        variant="primary"
        width="100%"
        onClick={requestConfirm}
        isDisabled={submitting || !userId}
        isLoading={submitting}
      />

      <Dialog isOpen={confirmOpen} onOpenChange={handleConfirmOpenChange} purpose="info">
        <Layout
          height="auto"
          padding={4}
          header={
            <DialogHeader title="予約内容の確認" onOpenChange={handleConfirmOpenChange} />
          }
          content={
            <LayoutContent>
              <Text>{confirmMessage}</Text>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="end" wrap="wrap">
                <Button
                  label="戻る"
                  variant="secondary"
                  onClick={() => setConfirmOpen(false)}
                  isDisabled={submitting}
                />
                <Button
                  label="申し込む"
                  variant="primary"
                  onClick={submit}
                  isDisabled={submitting}
                  isLoading={submitting}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <VStack gap={1}>
        <Heading level={3}>自分の予約（キャンセル可 / 時間変更は再申込）</Heading>
        <Text color="secondary">
          ※ 時間の直接変更はできません。キャンセル後に再度お申し込みください。
        </Text>
      </VStack>
      <VStack gap={2}>
        {myUnits.map((u) => (
          <HStack
            key={u.id}
            className="liff-order-form__my-unit"
            hAlign="between"
            vAlign="center"
            gap={2}
          >
            <Text>
              {new Date(u.pickup_at).toLocaleString('ja-JP')} [{u.status}]
            </Text>
            <Button
              label="キャンセル"
              size="sm"
              variant="destructive"
              onClick={() => cancelUnit(u.id)}
            />
          </HStack>
        ))}
        {myUnits.length === 0 ? <Text color="secondary">予約はありません</Text> : null}
      </VStack>
    </VStack>
  )
}
