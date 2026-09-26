import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useShiftsByMonth } from '@/hooks/useShifts'
import { useEmployees } from '@/hooks/useEmployees'
import { useDailySales } from '@/hooks/billing/useDailySales'
import { useClosuresByDate, useResendDailyClose } from '@/hooks/billing/useDailyClosures'
import {
  getDailyTotalSales,
  indexDailySalesByDate,
  toWorkDateKey,
} from '@/lib/billing/dailySalesCalc'
import { getVehicleFieldKeys } from '@/lib/billing/vehicleSalesFields'
import { VehicleSalesModal } from '@/components/ShiftCalendar/VehicleSalesModal'
import { VehicleSalesSummaryModal } from '@/components/ShiftCalendar/VehicleSalesSummaryModal'
import {
  buildStaffColorByName,
  getEmployeeSelectOptions,
  getStaffColor,
  getStaffColorForShift,
  getStaffDisplayName,
  resolveShiftEmployee,
} from '@/lib/staffFromEmployees'
import { computeDayTargetAmount, roundTargetDisplayAmount } from '@/lib/billing/shiftTargetAmount'
import { getContrastTextColor } from '@/lib/colorContrast'
import { getActiveWorkDate, formatWorkDateKey } from '@/utils/businessDayUtils'
import { useReservations, useReservationsByMonth } from '@/hooks/useReservations'
import { formatDateInJst } from '@/lib/reservation/reservationWindowUtils'
import { ReservationDayBadge } from '@/components/Reservations/ReservationDayBadge'
import { ReservationTonightDialog } from '@/components/Reservations/ReservationTonightDialog'
import {
  filterReservationsInReceptionNight,
  getTonightListFilters,
  markTonightDialogDismissed,
  wasTonightDialogDismissed,
} from '@/lib/reservation/tonightReservations'
import { Button } from '@astryxdesign/core/Button'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack } from '@astryxdesign/core/Layout'
import { Selector } from '@astryxdesign/core/Selector'
import { Pencil, Search } from 'lucide-react'
import { PageFrame } from '@/components/PageFrame'
import { MonthNavBar } from '@/components/MonthNav'
import { useOperatingHours } from '@/contexts/OperatingHoursProvider'
import { minutesToPixels, timeToMinutes, TIMELINE_WIDTH } from '@/lib/shiftEditUtils'
import { NightTimeAxis } from '@/components/NightTimeAxis'
import './ShiftCalendar.css'

// 日付をグループ化
function groupByDate(data) {
  const grouped = {}
  data.forEach((item) => {
    if (!grouped[item.date]) {
      grouped[item.date] = {
        date: item.date,
        dow: item.dow,
        status: item.status || '',
        shifts: [],
      }
    }
    if (item.car) {
      grouped[item.date].shifts.push(item)
    }
  })
  return grouped
}

export function ShiftCalendar() {
  useOperatingHours()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { showToast } = useToast()
  const resendCloseMutation = useResendDailyClose()
  const [visibleEmployeeIds, setVisibleEmployeeIds] = useState([])
  const [searchText, setSearchText] = useState('')
  // 締め時刻（08:00）までは前日を営業当日として初期年月を設定
  const initialWorkDate = getActiveWorkDate()
  const [selectedYear, setSelectedYear] = useState(initialWorkDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(initialWorkDate.getMonth() + 1)
  const calendarContainerRef = useRef(null)
  const hasScrolledRef = useRef(false)
  const [searchExpanded, setSearchExpanded] = useState(false) // デフォルトは閉じた状態
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [vehicleSalesTarget, setVehicleSalesTarget] = useState(null)
  const [vehicleSummaryTarget, setVehicleSummaryTarget] = useState(null)
  const [tonightOpen, setTonightOpen] = useState(false)
  const tonightPromptedRef = useRef(false)
  const tonightWorkDate = useMemo(() => formatWorkDateKey(getActiveWorkDate()), [])
  const tonightFilters = useMemo(() => getTonightListFilters(tonightWorkDate), [tonightWorkDate])

  const handleResendCloseReport = async (workDate) => {
    if (!workDate) return
    if (!window.confirm(`${workDate} の日次締め報告を LINE に再送しますか？`)) return
    try {
      await resendCloseMutation.mutateAsync(workDate)
      showToast('日次締め報告を再送しました', 'success')
    } catch (err) {
      showToast(err?.message || '再送に失敗しました', 'error')
    }
  }

  const shiftsQuery = useShiftsByMonth(selectedYear, selectedMonth)
  const employeesQuery = useEmployees()
  const dailySalesQuery = useDailySales(selectedYear, selectedMonth)
  const closuresQuery = useClosuresByDate(selectedYear, selectedMonth)
  const reservationsQuery = useReservationsByMonth(selectedYear, selectedMonth)
  const tonightQuery = useReservations(tonightFilters)

  const shifts = shiftsQuery.data ?? []
  const employees = employeesQuery.data ?? []
  const loading = shiftsQuery.isLoading || employeesQuery.isLoading
  const closuresByDate = closuresQuery.closuresByDate

  const reservationsByDate = useMemo(() => {
    const map = {}
    for (const row of reservationsQuery.data ?? []) {
      const key = formatDateInJst(new Date(row.reserved_at))
      if (!map[key]) map[key] = []
      map[key].push(row)
    }
    return map
  }, [reservationsQuery.data])

  const tonightReservations = useMemo(
    () => filterReservationsInReceptionNight(tonightQuery.data, tonightWorkDate),
    [tonightQuery.data, tonightWorkDate]
  )

  useEffect(() => {
    if (tonightPromptedRef.current) return
    if (tonightQuery.isLoading || tonightQuery.isError) return
    if (tonightReservations.length === 0) return
    if (wasTonightDialogDismissed(tonightWorkDate)) return
    tonightPromptedRef.current = true
    setTonightOpen(true)
  }, [tonightQuery.isLoading, tonightQuery.isError, tonightReservations, tonightWorkDate])

  // 月が変わったらスクロールフラグをリセット
  useEffect(() => {
    hasScrolledRef.current = false
  }, [selectedYear, selectedMonth])

  const colorByName = useMemo(() => buildStaffColorByName(employees), [employees])

  const filterEmployees = useMemo(
    () => getEmployeeSelectOptions(employees, shifts),
    [employees, shifts]
  )

  const salesByDate = useMemo(
    () => indexDailySalesByDate(dailySalesQuery.data),
    [dailySalesQuery.data]
  )

  // 営業当日（締め08:00未満は前日）まで自動スクロール
  useEffect(() => {
    if (loading || hasScrolledRef.current) return

    const workDate = getActiveWorkDate()
    const workYear = workDate.getFullYear()
    const workMonth = workDate.getMonth() + 1

    // 選択された年月が営業当日の年月の場合のみスクロール
    if (selectedYear === workYear && selectedMonth === workMonth) {
      const workDateStr = formatWorkDateKey(workDate)

      // 少し遅延を入れてDOMの更新を待つ
      setTimeout(() => {
        const todayElement = document.querySelector(`[data-date="${workDateStr}"]`)
        if (todayElement && calendarContainerRef.current) {
          todayElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest',
          })
          hasScrolledRef.current = true
        }
      }, 100)
    }
  }, [loading, selectedYear, selectedMonth])

  useEffect(() => {
    const container = calendarContainerRef.current
    if (!container) return

    const onScroll = () => {
      setHeaderCollapsed(container.scrollTop > 32)
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [loading])

  // データを日付でグループ化
  const groupedData = useMemo(() => groupByDate(shifts), [shifts])

  // フィルタリングされた日付リスト
  const filteredDates = useMemo(() => {
    const dates = Object.keys(groupedData).sort()
    if (!searchText) return dates

    return dates.filter((date) => {
      const dayData = groupedData[date]
      const dateParts = date.split('-')
      const dateFormatted = `${parseInt(dateParts[1])}月${parseInt(dateParts[2])}日`
      const matchDate = date.includes(searchText) || dateFormatted.includes(searchText)
      const matchDow = dayData.dow.includes(searchText)
      const matchStaff = dayData.shifts.some((s) =>
        getStaffDisplayName(s, employees).includes(searchText)
      )
      const matchStatus = dayData.status && dayData.status.includes(searchText)

      return matchDate || matchDow || matchStaff || matchStatus
    })
  }, [groupedData, searchText])

  const handleEmployeeFilterChange = (employeeId, checked) => {
    setVisibleEmployeeIds((prev) => {
      const allIds = filterEmployees.map((e) => e.id)
      if (checked) {
        if (prev.length === 0) return []
        const next = [...new Set([...prev, employeeId])]
        if (allIds.length > 0 && next.length >= allIds.length) return []
        return next
      }
      if (prev.length === 0) {
        return allIds.filter((id) => id !== employeeId)
      }
      return prev.filter((id) => id !== employeeId)
    })
  }

  return (
    <PageFrame>
      <div className="shift-calendar-page">
        <div className={`shift-header ${headerCollapsed ? 'shift-header--collapsed' : ''}`}>
          <div className="shift-header-compact">
            <div className="shift-header-title-row">
              <h1>運転代行シフト表</h1>
              {isAuthenticated ? (
                <Button
                  variant="primary"
                  size="sm"
                  label="シフト編集"
                  icon={<Pencil size={16} />}
                  onClick={() =>
                    navigate(`/shift/edit?year=${selectedYear}&month=${selectedMonth}`)
                  }
                />
              ) : null}
            </div>
            <MonthNavBar
              className="shift-header-month-nav"
              year={selectedYear}
              month={selectedMonth}
              isDisabled={loading}
              accessibilityLevel={2}
              onChange={({ year, month: nextMonth }) => {
                setSelectedYear(year)
                setSelectedMonth(nextMonth)
              }}
              end={
                <IconButton
                  label="検索・フィルター"
                  tooltip="検索・フィルター"
                  variant={searchExpanded ? 'secondary' : 'ghost'}
                  size="sm"
                  icon={<Search size={18} />}
                  onClick={() => setSearchExpanded(!searchExpanded)}
                />
              }
            />
          </div>

          <div className="shift-header-expandable">
            {searchExpanded ? (
              <div className="shift-controls">
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Selector
                    label="年"
                    size="sm"
                    options={[2024, 2025, 2026, 2027, 2028].map((year) => ({
                      value: String(year),
                      label: `${year}年`,
                    }))}
                    value={String(selectedYear)}
                    onChange={(value) => setSelectedYear(Number(value))}
                  />
                  <Selector
                    label="月"
                    size="sm"
                    options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => ({
                      value: String(month),
                      label: `${month}月`,
                    }))}
                    value={String(selectedMonth)}
                    onChange={(value) => setSelectedMonth(Number(value))}
                  />
                </HStack>
                <div className="filter-group">
                  {filterEmployees.map((emp) => (
                    <label key={emp.id}>
                      <input
                        type="checkbox"
                        checked={
                          visibleEmployeeIds.length === 0 || visibleEmployeeIds.includes(emp.id)
                        }
                        onChange={(e) => handleEmployeeFilterChange(emp.id, e.target.checked)}
                      />
                      {emp.name}
                    </label>
                  ))}
                </div>
                <input
                  type="text"
                  className="search-box"
                  placeholder="検索（日付・スタッフ名など）"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
            ) : null}
            <div className="legend">
              {getEmployeeSelectOptions(employees, shifts).map((emp) => (
                <div key={emp.id} className="legend-item">
                  <div
                    className="legend-color"
                    style={{
                      background: getStaffColor(colorByName, emp.name, employees),
                    }}
                  />
                  <span>{emp.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="shift-container" ref={calendarContainerRef}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>読み込み中...</div>
          ) : (
            <div className="shift-calendar">
              {filteredDates.map((date) => (
                <DayBlock
                  key={date}
                  dayData={groupedData[date]}
                  visibleEmployeeIds={visibleEmployeeIds}
                  employees={employees}
                  colorByName={colorByName}
                  salesByDate={salesByDate}
                  isDayClosed={Boolean(closuresByDate[date])}
                  isAdmin={isAuthenticated}
                  dayReservations={reservationsByDate[date] ?? []}
                  resendPending={resendCloseMutation.isPending}
                  onResendCloseReport={handleResendCloseReport}
                  onOpenVehicleSales={(carNum) => setVehicleSalesTarget({ date, carNum })}
                  onOpenVehicleSummary={(carNum) =>
                    setVehicleSummaryTarget({ date, dow: groupedData[date]?.dow, carNum })
                  }
                />
              ))}
            </div>
          )}
        </div>

        <ReservationTonightDialog
          open={tonightOpen}
          workDate={tonightWorkDate}
          reservations={tonightReservations}
          onClose={() => {
            markTonightDialogDismissed(tonightWorkDate)
            setTonightOpen(false)
          }}
        />

        <VehicleSalesModal
          open={Boolean(vehicleSalesTarget)}
          workDate={vehicleSalesTarget?.date ?? null}
          carNum={vehicleSalesTarget?.carNum ?? null}
          dayShifts={
            vehicleSalesTarget?.date ? (groupedData[vehicleSalesTarget.date]?.shifts ?? []) : []
          }
          employees={employees}
          isDayClosed={
            vehicleSalesTarget?.date
              ? Boolean(closuresByDate[vehicleSalesTarget.date]) ||
                Boolean(salesByDate[toWorkDateKey(vehicleSalesTarget.date)]?.closed_at)
              : false
          }
          isAdmin={isAuthenticated}
          onClose={() => setVehicleSalesTarget(null)}
        />

        <VehicleSalesSummaryModal
          open={Boolean(vehicleSummaryTarget)}
          workDate={vehicleSummaryTarget?.date ?? null}
          dow={vehicleSummaryTarget?.dow ?? ''}
          carNum={vehicleSummaryTarget?.carNum ?? null}
          dayShifts={
            vehicleSummaryTarget?.date ? (groupedData[vehicleSummaryTarget.date]?.shifts ?? []) : []
          }
          employees={employees}
          onClose={() => setVehicleSummaryTarget(null)}
        />
      </div>
    </PageFrame>
  )
}

function DayBlock({
  dayData,
  visibleEmployeeIds,
  employees,
  colorByName,
  salesByDate,
  isDayClosed = false,
  isAdmin = false,
  dayReservations = [],
  resendPending = false,
  onResendCloseReport,
  onOpenVehicleSales,
  onOpenVehicleSummary,
}) {
  const isFriSat = dayData.dow === '金' || dayData.dow === '土'
  const dateParts = dayData.date.split('-')
  const dateFormatted = `${parseInt(dateParts[1])}月${parseInt(dateParts[2])}日`

  const salesRow = salesByDate[toWorkDateKey(dayData.date)] ?? null
  const isClosed = isDayClosed || Boolean(salesRow?.closed_at)
  const displayTarget = roundTargetDisplayAmount(
    computeDayTargetAmount({
      shifts: dayData.shifts,
      employees,
      status: dayData.status,
    })
  )
  const totalSales = getDailyTotalSales(salesRow)
  const targetPct =
    displayTarget != null && displayTarget > 0
      ? Math.round((totalSales / displayTarget) * 100)
      : null

  return (
    <div className={`day-block ${isFriSat ? 'fri-sat' : ''}`} data-date={dayData.date}>
      <div className="day-header">
        <div className="day-header-main">
          <div className="day-header-date-row">
            <div className="day-date">
              {dateFormatted}
              <span className="day-dow">({dayData.dow})</span>
            </div>
            {isClosed && <div className="status-label closed-day">締め済</div>}
            {isClosed && isAdmin ? (
              <Button
                size="sm"
                variant="secondary"
                className="day-resend-close-btn"
                label={resendPending ? '再送中…' : '締め報告を再送'}
                isDisabled={resendPending}
                onClick={() => onResendCloseReport?.(dayData.date)}
              />
            ) : null}
            {dayData.status && (
              <div
                className={`status-label ${dayData.status === '休業' ? 'closed' : dayData.status === '定休日' ? 'holiday' : ''}`}
              >
                {dayData.status}
              </div>
            )}
            <ReservationDayBadge date={dayData.date} reservations={dayReservations} />
          </div>
          {displayTarget !== null && (
            <div className="day-header-stats">
              <div className="target-amount">目標: ¥{displayTarget.toLocaleString()}</div>
              <div className="daily-sales-total">総売上: ¥{totalSales.toLocaleString()}</div>
              <div
                className={`target-pct${targetPct != null && targetPct >= 100 ? ' achieved' : ''}`}
              >
                {targetPct}%
              </div>
            </div>
          )}
        </div>
      </div>

      {!dayData.status && (
        <div className="day-timeline-scroll">
          <div className="timeline-container" style={{ width: TIMELINE_WIDTH + 'px' }}>
            <NightTimeAxis />
            {[...new Set(dayData.shifts.map((s) => s.car))].sort().map((carNum) => (
              <CarBlock
                key={carNum}
                carNum={carNum}
                shifts={dayData.shifts}
                visibleEmployeeIds={visibleEmployeeIds}
                colorByName={colorByName}
                employees={employees}
                salesRow={salesRow}
                isClosed={isClosed}
                isAdmin={isAdmin}
                onOpenVehicleSales={onOpenVehicleSales}
                onOpenVehicleSummary={onOpenVehicleSummary}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CarBlock({
  carNum,
  shifts,
  visibleEmployeeIds,
  colorByName,
  employees,
  salesRow,
  isClosed = false,
  isAdmin = false,
  onOpenVehicleSales,
  onOpenVehicleSummary,
}) {
  const driverShifts = shifts.filter((s) => s.car === carNum && s.role === '代行')
  const companionShifts = shifts.filter((s) => s.car === carNum && s.role === '随伴')
  const salesKeys = getVehicleFieldKeys(carNum)
  const salesAmount = salesKeys ? salesRow?.[salesKeys.sales] : null
  const hasSales = salesAmount != null && Number(salesAmount) > 0
  const salesLocked = isClosed && !isAdmin

  return (
    <div className="car-block">
      <div className="car-header">
        <span>{carNum}号車</span>
        <Button
          size="sm"
          variant="secondary"
          className="car-sales-btn"
          label={`${salesLocked ? '締め済' : '売上入力'}${hasSales ? ` ¥${Number(salesAmount).toLocaleString('ja-JP')}` : ''}`}
          onClick={() => onOpenVehicleSales?.(carNum)}
        />
        <Button
          size="sm"
          variant="destructive"
          className="car-summary-btn"
          label="集計結果"
          isDisabled={!hasSales}
          onClick={() => onOpenVehicleSummary?.(carNum)}
        />
      </div>
      <Lane
        role="代行"
        shifts={driverShifts}
        visibleEmployeeIds={visibleEmployeeIds}
        colorByName={colorByName}
        employees={employees}
      />
      <Lane
        role="随伴"
        shifts={companionShifts}
        visibleEmployeeIds={visibleEmployeeIds}
        colorByName={colorByName}
        employees={employees}
      />
    </div>
  )
}

function Lane({ role, shifts, visibleEmployeeIds, colorByName, employees }) {
  return (
    <div className="lane">
      <div className="lane-label">{role}</div>
      {shifts.map((shift, idx) => {
        const shiftEmployee = resolveShiftEmployee(shift, employees)
        const employeeId = shiftEmployee?.id
        return (
          <Bar
            key={idx}
            shift={shift}
            visible={
              visibleEmployeeIds.length === 0 ||
              (employeeId && visibleEmployeeIds.includes(employeeId))
            }
            colorByName={colorByName}
            employees={employees}
          />
        )
      })}
    </div>
  )
}

function Bar({ shift, visible, colorByName, employees }) {
  const startMinutes = timeToMinutes(shift.start)
  const endMinutes = timeToMinutes(shift.end)
  const left = minutesToPixels(startMinutes)
  const width = minutesToPixels(endMinutes - startMinutes)
  const bg = getStaffColorForShift(shift, employees, colorByName)
  const textColor = getContrastTextColor(bg)
  const staffName = getStaffDisplayName(shift, employees)

  const title = shift.note
    ? `${staffName} (${shift.role}) ${shift.start}-${shift.end} - ${shift.note}`
    : `${staffName} (${shift.role}) ${shift.start}-${shift.end}`

  return (
    <div
      className={`bar ${!visible ? 'hidden' : ''}`}
      style={{
        left: left + 'px',
        width: width + 'px',
        backgroundColor: bg,
        color: textColor,
        textShadow: textColor === '#fff' ? '0 1px 2px rgba(0, 0, 0, 0.35)' : 'none',
      }}
      title={title}
    >
      <span className="bar-text">{staffName}</span>
      <span className="bar-time">
        {shift.start}-{shift.end}
      </span>
    </div>
  )
}
