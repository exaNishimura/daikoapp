import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Field } from '@astryxdesign/core/Field'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Switch } from '@astryxdesign/core/Switch'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { Token } from '@astryxdesign/core/Token'
import { ChevronLeft, ChevronRight, LogOut, Save } from 'lucide-react'
import { PageFrame } from '@/components/PageFrame'
import { ShiftPinGate } from '@/components/ShiftRequest/ShiftPinGate'
import {
  getShiftAvailabilityRequest,
  saveShiftAvailabilityRequest,
} from '@/services/employeeShiftService'
import { getShifts } from '@/services/shiftService'
import { clearEmployeeShiftSession } from '@/lib/employeeShift/employeeShiftSession'
import {
  formatShiftRequestDate,
  indexDayStatusByDate,
  isRegularClosedDay,
  sanitizeShiftRequestPayload,
} from '@/lib/shiftDayStatus'

const DEFAULT_START = '20:00'
const DEFAULT_END = '06:00'

const NATIVE_INPUT_STYLE = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  paddingBlock: 'var(--spacing-2)',
  paddingInline: 'var(--spacing-3)',
  font: 'inherit',
  background: 'var(--color-bg)',
  color: 'var(--color-text)',
}

function isValidTime(value) {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value)
}

function TimeField({ label, value, onChange }) {
  const inputId = useId()
  return (
    <Field label={label} inputID={inputId}>
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

function daysInMonth(month) {
  const start = dayjs(`${month}-01`)
  const count = start.daysInMonth()
  const days = []
  for (let i = 1; i <= count; i++) {
    days.push(start.date(i).format('YYYY-MM-DD'))
  }
  return days
}

function emptyPayload(defaultStart = DEFAULT_START, defaultEnd = DEFAULT_END) {
  return {
    days: {},
    notes: '',
    default_start: defaultStart,
    default_end: defaultEnd,
  }
}

function resolveBaseHours(payload, fallbackStart = DEFAULT_START, fallbackEnd = DEFAULT_END) {
  return {
    start: isValidTime(payload?.default_start) ? payload.default_start : fallbackStart,
    end: isValidTime(payload?.default_end) ? payload.default_end : fallbackEnd,
  }
}

function ShiftRequestForm({ employee, onLogout }) {
  const [month, setMonth] = useState(() => dayjs().add(1, 'month').format('YYYY-MM'))
  const [payload, setPayload] = useState(() => emptyPayload())
  const [dayStatusByDate, setDayStatusByDate] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const dates = useMemo(() => daysInMonth(month), [month])
  const defaultStart = isValidTime(payload.default_start) ? payload.default_start : DEFAULT_START
  const defaultEnd = isValidTime(payload.default_end) ? payload.default_end : DEFAULT_END

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    const startDate = `${month}-01`
    const endDate = dayjs(`${month}-01`).endOf('month').format('YYYY-MM-DD')

    const [requestResult, shiftsResult] = await Promise.all([
      getShiftAvailabilityRequest(month),
      getShifts(startDate, endDate),
    ])

    const statusMap = indexDayStatusByDate(shiftsResult.data)
    setDayStatusByDate(statusMap)

    if (shiftsResult.error) {
      setError(shiftsResult.error.message || 'シフト表の取得に失敗しました')
    }

    setPayload((prev) => {
      const sessionHours = resolveBaseHours(prev)
      if (requestResult.error) {
        return sanitizeShiftRequestPayload(
          emptyPayload(sessionHours.start, sessionHours.end),
          statusMap
        )
      }
      const loaded = requestResult.data?.payload ?? emptyPayload()
      const hours = resolveBaseHours(loaded, sessionHours.start, sessionHours.end)
      return sanitizeShiftRequestPayload(
        {
          ...emptyPayload(hours.start, hours.end),
          ...loaded,
          default_start: hours.start,
          default_end: hours.end,
          days: loaded.days ?? {},
          notes: loaded.notes ?? '',
        },
        statusMap
      )
    })
    if (requestResult.error) {
      setError((prev) => prev || requestResult.error.message)
    }
    setLoading(false)
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  const setBaseHours = (patch) => {
    setPayload((prev) => ({
      ...prev,
      ...(patch.start != null ? { default_start: patch.start } : {}),
      ...(patch.end != null ? { default_end: patch.end } : {}),
    }))
  }

  const setDay = (date, patch) => {
    if (isRegularClosedDay(dayStatusByDate[date])) return
    setPayload((prev) => {
      const baseStart = isValidTime(prev.default_start) ? prev.default_start : DEFAULT_START
      const baseEnd = isValidTime(prev.default_end) ? prev.default_end : DEFAULT_END
      const days = { ...(prev.days || {}) }
      const current = days[date] || { available: false, start: baseStart, end: baseEnd }
      const next = { ...current, ...patch }
      // 出勤可 ON 時は基本時間をデフォルト適用（個別に変えたい場合はあとから調整）
      if (patch.available === true) {
        next.start = baseStart
        next.end = baseEnd
      }
      days[date] = next
      return { ...prev, days }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    const withDefaults = {
      ...payload,
      default_start: defaultStart,
      default_end: defaultEnd,
    }
    const sanitized = sanitizeShiftRequestPayload(withDefaults, dayStatusByDate)
    const { error: apiErr } = await saveShiftAvailabilityRequest(month, sanitized)
    if (apiErr) {
      setError(apiErr.message)
    } else {
      setPayload(sanitized)
      setSuccess('希望を保存しました')
    }
    setSaving(false)
  }

  const shiftMonth = (delta) => {
    setMonth((m) => dayjs(`${m}-01`).add(delta, 'month').format('YYYY-MM'))
  }

  return (
    <VStack gap={4}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
        <Heading level={1}>シフト希望提出</Heading>
        <Button
          label="ログアウト"
          variant="secondary"
          size="sm"
          onClick={onLogout}
          icon={<LogOut size={16} />}
        />
      </HStack>

      <Text>{employee.name} さん</Text>

      <Card padding={4}>
        <VStack gap={2}>
          <HStack hAlign="center" vAlign="center" gap={1}>
            <IconButton
              label="前の月"
              tooltip="前の月"
              variant="ghost"
              icon={<ChevronLeft />}
              onClick={() => shiftMonth(-1)}
            />
            <Heading level={3}>{dayjs(`${month}-01`).format('YYYY年M月')}</Heading>
            <IconButton
              label="次の月"
              tooltip="次の月"
              variant="ghost"
              icon={<ChevronRight />}
              onClick={() => shiftMonth(1)}
            />
          </HStack>
          <Text color="secondary">
            出勤可能な日だけ「出勤可」をオンにし、時間帯を入力してください。オフの日は希望なし（出勤不可）として扱われます。「出勤可」にしたときの初期時間は下の基本時間になります。
          </Text>
          <HStack gap={2} wrap="wrap" vAlign="end">
            <TimeField
              label="基本開始"
              value={defaultStart}
              onChange={(start) => setBaseHours({ start })}
            />
            <TimeField
              label="基本終了"
              value={defaultEnd}
              onChange={(end) => setBaseHours({ end })}
            />
          </HStack>
        </VStack>
      </Card>

      {error ? (
        <Banner
          status="error"
          title={error}
          isDismissable
          onDismiss={() => setError(null)}
          collapsible={false}
        />
      ) : null}
      {success ? (
        <Banner
          status="success"
          title={success}
          isDismissable
          onDismiss={() => setSuccess(null)}
          collapsible={false}
        />
      ) : null}

      {loading ? (
        <Text>読み込み中...</Text>
      ) : (
        <VStack gap={3}>
          {dates.map((date) => {
            const dayStatus = dayStatusByDate[date]
            const isClosed = isRegularClosedDay(dayStatus)
            const day = payload.days?.[date] || {
              available: false,
              start: defaultStart,
              end: defaultEnd,
            }
            return (
              <Card key={date} padding={3}>
                <VStack gap={2}>
                  <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                    <Text weight="semibold">{formatShiftRequestDate(date)}</Text>
                    {isClosed ? <Token size="sm" color="gray" label="定休日" /> : null}
                  </HStack>

                  {isClosed ? (
                    <Text color="secondary">定休日のため希望の提出はできません</Text>
                  ) : (
                    <HStack gap={2} wrap="wrap" vAlign="end">
                      <Switch
                        label="出勤可"
                        value={Boolean(day.available)}
                        onChange={(checked) => setDay(date, { available: checked })}
                        size="sm"
                      />
                      {day.available ? (
                        <>
                          <TimeField
                            label="開始"
                            value={day.start || defaultStart}
                            onChange={(start) => setDay(date, { start })}
                          />
                          <TimeField
                            label="終了"
                            value={day.end || defaultEnd}
                            onChange={(end) => setDay(date, { end })}
                          />
                        </>
                      ) : null}
                    </HStack>
                  )}
                </VStack>
              </Card>
            )
          })}

          <Card padding={4}>
            <VStack gap={3}>
              <TextArea
                label="備考（任意）"
                value={payload.notes || ''}
                onChange={(notes) => setPayload((prev) => ({ ...prev, notes }))}
                rows={2}
                width="100%"
              />

              <HStack hAlign="end">
                <Button
                  label={saving ? '保存中...' : '希望を保存'}
                  variant="primary"
                  onClick={handleSave}
                  isDisabled={saving}
                  isLoading={saving}
                  icon={<Save size={16} />}
                />
              </HStack>
            </VStack>
          </Card>
        </VStack>
      )}
    </VStack>
  )
}

export function ShiftRequestPage() {
  const handleLogout = () => {
    clearEmployeeShiftSession()
    window.location.reload()
  }

  return (
    <PageFrame>
      <ShiftPinGate>
        {({ employee }) => <ShiftRequestForm employee={employee} onLogout={handleLogout} />}
      </ShiftPinGate>
    </PageFrame>
  )
}
