import { useId } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { Field } from '@astryxdesign/core/Field'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, Layout, LayoutContent, LayoutHeader, VStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { TextArea } from '@astryxdesign/core/TextArea'
import { Token } from '@astryxdesign/core/Token'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import { useShiftEditPage } from '@/hooks/useShiftEditPage'
import {
  CAR_OPTIONS,
  ROLE_OPTIONS,
  STATUS_OPTIONS,
  TIMELINE_WIDTH,
  getDefaultShiftEditYearMonth,
} from '@/lib/shiftEditUtils'
import { getStaffDisplayName } from '@/lib/staffFromEmployees'
import { TimeAxis, CarBlock } from './ShiftEditPage/Timeline'
import { CopyShiftDialog } from './ShiftEditPage/CopyShiftDialog'
import { BulkCopyShiftDialog } from './ShiftEditPage/BulkCopyShiftDialog'
import { DayAvailabilityTokens, RequestPicker } from './ShiftEditPage/RequestPicker'
import { ShiftEditSummary } from './ShiftEditPage/ShiftEditSummary'
import './ShiftEditPage.css'

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

const CAR_SELECT_OPTIONS = CAR_OPTIONS.map((car) => ({ value: car, label: `${car}号車` }))
const ROLE_SELECT_OPTIONS = ROLE_OPTIONS.map((role) => ({ value: role, label: role }))
const STATUS_SELECT_OPTIONS = [
  { value: '', label: 'なし' },
  ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
]

function shiftDayElementId(date) {
  return `shift-day-${date}`
}

function scrollToShiftDay(date) {
  const el = document.getElementById(shiftDayElementId(date))
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  el.focus({ preventScroll: true })
}

function TimeField({ label, value, onChange }) {
  const inputId = useId()
  return (
    <Field label={label} inputID={inputId} width="100%">
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

function ShiftFields({ values, onChange, employeeSelectOptions }) {
  return (
    <VStack gap={2}>
      <Selector
        label="車両"
        options={CAR_SELECT_OPTIONS}
        value={values.car || undefined}
        onChange={(car) => onChange({ ...values, car })}
        width="100%"
        size="sm"
      />
      <Selector
        label="役割"
        options={ROLE_SELECT_OPTIONS}
        value={values.role || undefined}
        onChange={(role) => onChange({ ...values, role })}
        width="100%"
        size="sm"
      />
      <Selector
        label="スタッフ"
        options={employeeSelectOptions.map((emp) => ({ value: emp.id, label: emp.name }))}
        value={values.employee_id ? String(values.employee_id) : undefined}
        onChange={(employee_id) => onChange({ ...values, employee_id })}
        width="100%"
        size="sm"
      />
      <HStack gap={2} wrap="wrap">
        <TimeField
          label="開始"
          value={values.start}
          onChange={(start) => onChange({ ...values, start })}
        />
        <TimeField
          label="終了"
          value={values.end}
          onChange={(end) => onChange({ ...values, end })}
        />
      </HStack>
      <TextArea
        label="備考"
        value={values.note || ''}
        onChange={(note) => onChange({ ...values, note })}
        placeholder="例: 無人回避"
        rows={1}
        width="100%"
        size="sm"
      />
    </VStack>
  )
}

function statusTokenColor(status) {
  if (status === '休業') return 'red'
  if (status) return 'yellow'
  return 'gray'
}

export function ShiftEditPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const defaultYM = getDefaultShiftEditYearMonth()
  const year = parseInt(searchParams.get('year') || String(defaultYM.year), 10)
  const month = parseInt(searchParams.get('month') || String(defaultYM.month), 10)

  const {
    shifts,
    fetchError,
    loading,
    days,
    statuses,
    staffColorByName,
    employeeSelectOptions,
    employees,
    getShiftsForDate,
    refetchShifts,
    requestsError,
    requestsByDate,
    requestRows,
    staffSummary,
    monthLaborCost,
    handleToggleRequest,
    error,
    success,
    setError,
    setSuccess,
    expandedDates,
    setExpandedDates,
    editingDates,
    newShifts,
    setNewShifts,
    handleStartEdit,
    handleCancelEdit,
    handleAddShift,
    editingShiftIds,
    editingShifts,
    setEditingShifts,
    handleStartEditShift,
    handleCancelEditShift,
    handleSaveAll,
    copyDialogOpen,
    setCopyDialogOpen,
    copyTargetDate,
    setCopyTargetDate,
    handleCopyFromDate,
    copyDestDates,
    setCopyDestDates,
    selectedCopyDestCount,
    bulkCopyDialogOpen,
    setBulkCopyDialogOpen,
    bulkCopySourceDate,
    setBulkCopySourceDate,
    handleBulkCopyExecute,
    handleDeleteShift,
    handleSetStatus,
  } = useShiftEditPage({ year, month })

  const monthLabel = year && month ? `${year}年${month}月` : ''
  const editingCount = Object.keys(editingShifts).length
  const hasAnyRequests = requestRows.some((row) => row.has_request)

  const onSaveAll = async () => {
    const result = await handleSaveAll()
    if (!result?.targetDate) return
    flushSync(() => {
      setExpandedDates((prev) => ({ ...prev, [result.targetDate]: true }))
    })
    scrollToShiftDay(result.targetDate)
  }

  return (
    <Layout
      height="fill"
      padding={4}
      header={
        <LayoutHeader hasDivider>
          <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <IconButton
                label="シフト表に戻る"
                tooltip="シフト表に戻る"
                variant="ghost"
                icon={<ChevronLeft />}
                onClick={() => navigate('/shift')}
              />
              <HStack gap={1} vAlign="center">
                <IconButton
                  label="前月"
                  tooltip="前月"
                  variant="ghost"
                  icon={<ChevronLeft />}
                  onClick={() => {
                    const prevMonth = month === 1 ? 12 : month - 1
                    const prevYear = month === 1 ? year - 1 : year
                    navigate(`/shift/edit?year=${prevYear}&month=${prevMonth}`)
                  }}
                  isDisabled={loading}
                />
                <Heading level={1}>{monthLabel}</Heading>
                <IconButton
                  label="次月"
                  tooltip="次月"
                  variant="ghost"
                  icon={<ChevronRight />}
                  onClick={() => {
                    const nextMonth = month === 12 ? 1 : month + 1
                    const nextYear = month === 12 ? year + 1 : year
                    navigate(`/shift/edit?year=${nextYear}&month=${nextMonth}`)
                  }}
                  isDisabled={loading}
                />
              </HStack>
            </HStack>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <HStack gap={1} vAlign="center">
                <Button
                  label="一括保存"
                  variant="primary"
                  onClick={onSaveAll}
                  isDisabled={loading}
                />
                {editingCount > 0 ? (
                  <Token size="sm" color="blue" label={`${editingCount}件編集中`} />
                ) : null}
              </HStack>
              <Button
                label="再読み込み"
                variant="secondary"
                onClick={() => refetchShifts()}
                isDisabled={loading}
              />
              <Button
                label={
                  selectedCopyDestCount > 0
                    ? `一括コピー（${selectedCopyDestCount}日）`
                    : '一括コピー'
                }
                variant="secondary"
                onClick={() => {
                  setBulkCopySourceDate('')
                  setBulkCopyDialogOpen(true)
                }}
                isDisabled={loading || selectedCopyDestCount === 0}
              />
            </HStack>
          </HStack>
        </LayoutHeader>
      }
    >
      <LayoutContent>
        <VStack gap={4}>
          {fetchError ? (
            <Banner
              status="error"
              title={`シフトデータの取得に失敗: ${fetchError.message}`}
              collapsible={false}
            />
          ) : null}
          {requestsError ? (
            <Banner
              status="warning"
              title={`シフト希望の取得に失敗: ${requestsError.message}`}
              collapsible={false}
            />
          ) : null}

          <ShiftEditSummary
            staffSummary={staffSummary}
            monthLaborCost={monthLaborCost}
            requestRows={requestRows}
          />
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

          {loading && !shifts.length ? (
            <Center padding={4}>
              <VStack gap={2} hAlign="center">
                <Spinner />
                <Text>読み込み中...</Text>
              </VStack>
            </Center>
          ) : null}

          {days.length > 0 ? (
            <VStack gap={3}>
              {days.map(({ date, day, dow }) => {
                const dateShifts = getShiftsForDate(date)
                const status = statuses[date]
                const isEditing = editingDates[date]
                const newShift = newShifts[date] || {
                  car: '',
                  role: '',
                  employee_id: '',
                  start: '',
                  end: '',
                  note: '',
                }

                const isExpanded = expandedDates[date] !== false
                const hasShifts = dateShifts.length > 0
                const toggleExpand = () => {
                  setExpandedDates((prev) => ({ ...prev, [date]: !(prev[date] !== false) }))
                }

                return (
                  <div
                    key={date}
                    id={shiftDayElementId(date)}
                    className="shift-edit-day"
                    tabIndex={-1}
                  >
                    <Card padding={3}>
                      <VStack gap={isExpanded ? 3 : 0}>
                        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
                          <HStack gap={1} vAlign="center" wrap="wrap">
                            <CheckboxInput
                              label={`${day}日を一括コピーのコピー先に含める`}
                              isLabelHidden
                              size="sm"
                              value={!!copyDestDates[date]}
                              onChange={() =>
                                setCopyDestDates((prev) => ({
                                  ...prev,
                                  [date]: !prev[date],
                                }))
                              }
                              isDisabled={loading}
                            />
                            <IconButton
                              size="sm"
                              variant="ghost"
                              label={isExpanded ? '折りたたむ' : '展開'}
                              tooltip={isExpanded ? '折りたたむ' : '展開'}
                              icon={
                                isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                              }
                              onClick={toggleExpand}
                            />
                            <Heading level={3}>
                              {day}日 ({dow})
                            </Heading>
                            {hasShifts && !status ? (
                              <Token size="sm" color="blue" label={`${dateShifts.length}件`} />
                            ) : null}
                            {!status && hasAnyRequests ? (
                              <DayAvailabilityTokens
                                dayRequests={requestsByDate[date] ?? []}
                                dateShifts={dateShifts}
                                employees={employees}
                              />
                            ) : null}
                          </HStack>
                          <HStack gap={2} vAlign="center" wrap="wrap">
                            <Selector
                              label="ステータス"
                              options={STATUS_SELECT_OPTIONS}
                              value={status || ''}
                              onChange={(value) => handleSetStatus(date, value || null)}
                              isDisabled={loading}
                              size="sm"
                              width="100%"
                            />
                            {!status ? (
                              <Button
                                size="sm"
                                variant="primary"
                                label={isEditing ? 'キャンセル' : 'シフト追加'}
                                onClick={() =>
                                  isEditing ? handleCancelEdit(date) : handleStartEdit(date)
                                }
                                isDisabled={loading}
                              />
                            ) : null}
                          </HStack>
                        </HStack>

                        {isExpanded ? (
                          <VStack gap={3}>
                            {status ? (
                              <Token size="md" color={statusTokenColor(status)} label={status} />
                            ) : (
                              <>
                                {hasAnyRequests ? (
                                  <RequestPicker
                                    date={date}
                                    status={status}
                                    dayRequests={requestsByDate[date] ?? []}
                                    dateShifts={dateShifts}
                                    employees={employees}
                                    onToggle={handleToggleRequest}
                                    disabled={loading}
                                  />
                                ) : null}

                                {dateShifts.length > 0 ? (
                                  <VStack gap={2}>
                                    <Text weight="semibold">シフト表</Text>
                                    <div
                                      className="timeline-container"
                                      style={{ width: `${TIMELINE_WIDTH}px` }}
                                    >
                                      <TimeAxis />
                                      {[...new Set(dateShifts.map((s) => s.car))]
                                        .sort()
                                        .map((carNum) => (
                                          <CarBlock
                                            key={carNum}
                                            carNum={carNum}
                                            shifts={dateShifts}
                                            staffColorByName={staffColorByName}
                                            employees={employees}
                                          />
                                        ))}
                                    </div>
                                  </VStack>
                                ) : null}

                                {isEditing ? (
                                  <VStack gap={2}>
                                    <Text weight="semibold">新規シフト追加</Text>
                                    <ShiftFields
                                      values={newShift}
                                      onChange={(next) =>
                                        setNewShifts((prev) => ({ ...prev, [date]: next }))
                                      }
                                      employeeSelectOptions={employeeSelectOptions}
                                    />
                                    <HStack gap={1} wrap="wrap">
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        label="他の日からコピー"
                                        onClick={() => {
                                          setCopyTargetDate(date)
                                          setCopyDialogOpen(true)
                                        }}
                                        isDisabled={loading}
                                      />
                                      <Button
                                        size="sm"
                                        variant="primary"
                                        label="追加"
                                        onClick={() => handleAddShift(date)}
                                        isDisabled={loading}
                                      />
                                    </HStack>
                                  </VStack>
                                ) : null}

                                {dateShifts.length > 0 ? (
                                  <VStack gap={2}>
                                    <Text weight="semibold">
                                      設定済みシフト ({dateShifts.length}件)
                                    </Text>
                                    {dateShifts.map((shift) => {
                                      const rowEditing = editingShiftIds[shift.id]
                                      const editingShift = editingShifts[shift.id] || shift

                                      return (
                                        <Card key={shift.id} padding={3}>
                                          {!rowEditing ? (
                                            <HStack
                                              hAlign="between"
                                              vAlign="center"
                                              wrap="wrap"
                                              gap={2}
                                            >
                                              <HStack gap={1} wrap="wrap" vAlign="center">
                                                <Token size="sm" color="blue" label={shift.car} />
                                                <Text>
                                                  {shift.role} /{' '}
                                                  {getStaffDisplayName(shift, employees)} /{' '}
                                                  {shift.start} - {shift.end}
                                                </Text>
                                                {shift.note ? (
                                                  <Token
                                                    size="sm"
                                                    color="gray"
                                                    label={shift.note}
                                                  />
                                                ) : null}
                                              </HStack>
                                              <HStack gap={1}>
                                                <IconButton
                                                  size="sm"
                                                  variant="ghost"
                                                  label="編集"
                                                  tooltip="編集"
                                                  icon={<Pencil size={16} />}
                                                  onClick={() => handleStartEditShift(shift)}
                                                  isDisabled={loading}
                                                />
                                                <IconButton
                                                  size="sm"
                                                  variant="destructive"
                                                  label="削除"
                                                  tooltip="削除"
                                                  icon={<Trash2 size={16} />}
                                                  onClick={() => handleDeleteShift(shift.id, date)}
                                                  isDisabled={loading}
                                                />
                                              </HStack>
                                            </HStack>
                                          ) : (
                                            <VStack gap={2}>
                                              <Text weight="semibold">シフト編集</Text>
                                              <ShiftFields
                                                values={editingShift}
                                                onChange={(next) =>
                                                  setEditingShifts((prev) => ({
                                                    ...prev,
                                                    [shift.id]: next,
                                                  }))
                                                }
                                                employeeSelectOptions={employeeSelectOptions}
                                              />
                                              <HStack gap={2} wrap="wrap" vAlign="center">
                                                <Button
                                                  size="sm"
                                                  variant="secondary"
                                                  label="キャンセル"
                                                  onClick={() => handleCancelEditShift(shift.id)}
                                                  isDisabled={loading}
                                                />
                                                <Text color="secondary">
                                                  編集内容は「一括保存」ボタンで保存されます
                                                </Text>
                                              </HStack>
                                            </VStack>
                                          )}
                                        </Card>
                                      )
                                    })}
                                  </VStack>
                                ) : null}

                                {dateShifts.length === 0 && !isEditing ? (
                                  <Text color="secondary">シフトが設定されていません</Text>
                                ) : null}
                              </>
                            )}
                          </VStack>
                        ) : null}
                      </VStack>
                    </Card>
                  </div>
                )
              })}
            </VStack>
          ) : null}

          <CopyShiftDialog
            open={copyDialogOpen}
            onClose={() => setCopyDialogOpen(false)}
            days={days}
            copyTargetDate={copyTargetDate}
            getShiftsForDate={getShiftsForDate}
            onCopyFromDate={handleCopyFromDate}
          />

          <BulkCopyShiftDialog
            open={bulkCopyDialogOpen}
            onClose={() => {
              setBulkCopyDialogOpen(false)
              setBulkCopySourceDate('')
            }}
            days={days}
            bulkCopySourceDate={bulkCopySourceDate}
            setBulkCopySourceDate={setBulkCopySourceDate}
            selectedCopyDestCount={selectedCopyDestCount}
            getShiftsForDate={getShiftsForDate}
            onExecute={handleBulkCopyExecute}
            loading={loading}
          />
        </VStack>
      </LayoutContent>
    </Layout>
  )
}
