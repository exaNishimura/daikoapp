import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useShiftsByMonth } from '@/hooks/useShifts'
import { useEmployees } from '@/hooks/useEmployees'
import { useDailySales } from '@/hooks/billing/useDailySales'
import { getDailyTotalSales, indexDailySalesByDate, toWorkDateKey } from '@/lib/billing/dailySalesCalc'
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
import { getContrastTextColor } from '@/lib/colorContrast'
import EditIcon from '@mui/icons-material/Edit'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SearchIcon from '@mui/icons-material/Search'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import './ShiftCalendar.css'

// ============================================
// 設定（時間軸の範囲）
// ============================================
const TIMELINE_START = 19 // 19:00から表示
const TIMELINE_END = 6 // 06:00まで表示（翌日）
const TIMELINE_WIDTH = 960 // 時間軸の幅（px）
const PIXELS_PER_HOUR = TIMELINE_WIDTH / 12 // 12時間 = 960px

// ============================================
// ユーティリティ関数
// ============================================

// 時間文字列（HH:MM）を分に変換（19:00基準）
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number)
  // 19:00 = 0分、20:00 = 60分、...、23:00 = 240分、00:00 = 300分、...、06:00 = 660分
  if (hours >= TIMELINE_START) {
    return (hours - TIMELINE_START) * 60 + minutes
  } else {
    // 翌日の時間（00:00〜06:00）
    return (24 - TIMELINE_START + hours) * 60 + minutes
  }
}

// 分をピクセル位置に変換
function minutesToPixels(minutes) {
  return (minutes / 60) * PIXELS_PER_HOUR
}

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
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [visibleEmployeeIds, setVisibleEmployeeIds] = useState([])
  const [searchText, setSearchText] = useState('')
  // 現在の年月を初期値として設定
  const today = new Date()
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)
  const calendarContainerRef = useRef(null)
  const hasScrolledRef = useRef(false)
  const [searchExpanded, setSearchExpanded] = useState(false) // デフォルトは閉じた状態
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [vehicleSalesTarget, setVehicleSalesTarget] = useState(null)
  const [vehicleSummaryTarget, setVehicleSummaryTarget] = useState(null)

  const shiftsQuery = useShiftsByMonth(selectedYear, selectedMonth)
  const employeesQuery = useEmployees()
  const dailySalesQuery = useDailySales(selectedYear, selectedMonth)

  const shifts = shiftsQuery.data ?? []
  const employees = employeesQuery.data ?? []
  const loading = shiftsQuery.isLoading || employeesQuery.isLoading

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

  // 本日の日付まで自動スクロール
  useEffect(() => {
    if (loading || hasScrolledRef.current) return

    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    const currentDate = today.getDate()

    // 選択された年月が現在の年月の場合のみスクロール
    if (selectedYear === currentYear && selectedMonth === currentMonth) {
      const todayDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDate).padStart(2, '0')}`

      // 少し遅延を入れてDOMの更新を待つ
      setTimeout(() => {
        const todayElement = document.querySelector(`[data-date="${todayDateStr}"]`)
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

  const handlePrevMonth = () => {
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
    setSelectedYear(prevYear)
    setSelectedMonth(prevMonth)
  }

  const handleNextMonth = () => {
    const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
    const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
    setSelectedYear(nextYear)
    setSelectedMonth(nextMonth)
  }

  return (
    <div className="shift-calendar-page">
      <div className={`shift-header ${headerCollapsed ? 'shift-header--collapsed' : ''}`}>
        <div className="shift-header-compact">
          <div className="shift-header-title-row">
            <h1>運転代行シフト表</h1>
            {isAuthenticated && (
              <Button
                variant="contained"
                onClick={() => navigate(`/shift/edit?year=${selectedYear}&month=${selectedMonth}`)}
                startIcon={<EditIcon />}
                size="small"
                sx={{
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  fontSize: { xs: '12px', sm: '14px' },
                }}
              >
                シフト編集
              </Button>
            )}
          </div>
          <Box
            className="shift-header-month-nav"
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <Box />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                justifyContent: 'center',
              }}
            >
              <IconButton
                onClick={handlePrevMonth}
                disabled={loading}
                size="medium"
                aria-label="前月"
                sx={{
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.08)',
                  },
                  '&:disabled': {
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                  },
                  color: '#1976d2',
                }}
              >
                <ChevronLeftIcon />
              </IconButton>
              <Typography
                variant="h6"
                component="div"
                sx={{
                  minWidth: { xs: '100px', sm: '120px' },
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: { xs: '16px', sm: '20px' },
                }}
              >
                {selectedYear}年{selectedMonth}月
              </Typography>
              <IconButton
                onClick={handleNextMonth}
                disabled={loading}
                size="medium"
                aria-label="次月"
                sx={{
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.08)',
                  },
                  '&:disabled': {
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                  },
                  color: '#1976d2',
                }}
              >
                <ChevronRightIcon />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <IconButton
                aria-label="検索・フィルター"
                aria-expanded={searchExpanded}
                onClick={() => setSearchExpanded(!searchExpanded)}
                size="small"
                sx={{
                  backgroundColor: searchExpanded
                    ? 'rgba(25, 118, 210, 0.12)'
                    : 'rgba(0, 0, 0, 0.04)',
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  color: '#1976d2',
                  '&:hover': {
                    backgroundColor: searchExpanded
                      ? 'rgba(25, 118, 210, 0.2)'
                      : 'rgba(0, 0, 0, 0.08)',
                  },
                  '& .MuiSvgIcon-root': {
                    fontSize: 18,
                  },
                }}
              >
                <SearchIcon />
              </IconButton>
            </Box>
          </Box>
        </div>

        <div className="shift-header-expandable">
          <Collapse
            in={searchExpanded}
            sx={{
              overflow: 'visible',
              '& .MuiCollapse-wrapper': { overflow: 'visible' },
              '& .MuiCollapse-wrapperInner': { overflow: 'visible' },
            }}
          >
            <div className="shift-controls">
              <Box
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  justifyContent: { xs: 'center', sm: 'flex-start' },
                  width: '100%',
                  overflow: 'visible',
                }}
              >
                <FormControl
                  size="small"
                  sx={{
                    minWidth: { xs: '110px', sm: '120px' },
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'white',
                      '& fieldset': {
                        borderColor: 'rgba(0, 0, 0, 0.23)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(0, 0, 0, 0.87)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#1976d2',
                        borderWidth: '2px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(0, 0, 0, 0.6)',
                      '&.Mui-focused': {
                        color: '#1976d2',
                      },
                    },
                    '& .MuiSelect-select': {
                      color: 'rgba(0, 0, 0, 0.87)',
                      fontWeight: 500,
                    },
                  }}
                >
                  <InputLabel id="shift-year-label">年</InputLabel>
                  <Select
                    labelId="shift-year-label"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    label="年"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((year) => (
                      <MenuItem key={year} value={year}>
                        {year}年
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl
                  size="small"
                  sx={{
                    minWidth: { xs: '90px', sm: '100px' },
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: 'white',
                      '& fieldset': {
                        borderColor: 'rgba(0, 0, 0, 0.23)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(0, 0, 0, 0.87)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#1976d2',
                        borderWidth: '2px',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(0, 0, 0, 0.6)',
                      '&.Mui-focused': {
                        color: '#1976d2',
                      },
                    },
                    '& .MuiSelect-select': {
                      color: 'rgba(0, 0, 0, 0.87)',
                      fontWeight: 500,
                    },
                  }}
                >
                  <InputLabel id="shift-month-label">月</InputLabel>
                  <Select
                    labelId="shift-month-label"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    label="月"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                      <MenuItem key={month} value={month}>
                        {month}月
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
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
          </Collapse>
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
                onOpenVehicleSales={(carNum) =>
                  setVehicleSalesTarget({ date, carNum })
                }
                onOpenVehicleSummary={(carNum) =>
                  setVehicleSummaryTarget({ date, dow: groupedData[date]?.dow, carNum })
                }
              />
            ))}
          </div>
        )}
      </div>

      <VehicleSalesModal
        open={Boolean(vehicleSalesTarget)}
        workDate={vehicleSalesTarget?.date ?? null}
        carNum={vehicleSalesTarget?.carNum ?? null}
        dayShifts={
          vehicleSalesTarget?.date ? (groupedData[vehicleSalesTarget.date]?.shifts ?? []) : []
        }
        employees={employees}
        onClose={() => setVehicleSalesTarget(null)}
      />

      <VehicleSalesSummaryModal
        open={Boolean(vehicleSummaryTarget)}
        workDate={vehicleSummaryTarget?.date ?? null}
        dow={vehicleSummaryTarget?.dow ?? ''}
        carNum={vehicleSummaryTarget?.carNum ?? null}
        dayShifts={
          vehicleSummaryTarget?.date
            ? (groupedData[vehicleSummaryTarget.date]?.shifts ?? [])
            : []
        }
        employees={employees}
        onClose={() => setVehicleSummaryTarget(null)}
      />
    </div>
  )
}

function DayBlock({
  dayData,
  visibleEmployeeIds,
  employees,
  colorByName,
  salesByDate,
  onOpenVehicleSales,
  onOpenVehicleSummary,
}) {
  const isFriSat = dayData.dow === '金' || dayData.dow === '土'
  const dateParts = dayData.date.split('-')
  const dateFormatted = `${parseInt(dateParts[1])}月${parseInt(dateParts[2])}日`

  // 目標金額を計算
  const calculateTargetAmount = () => {
    if (dayData.status || !dayData.shifts || dayData.shifts.length === 0) {
      return null
    }

    // 従業員マップを作成（名前で検索）
    const employeeMap = {}
    employees.forEach((emp) => {
      if (emp?.id) employeeMap[emp.id] = emp
    })

    let totalWage = 0

    // 各シフトの給料を計算
    dayData.shifts.forEach((shift) => {
      if (!shift.start || !shift.end) return

      const employee =
        (shift.employee_id && employeeMap[shift.employee_id]) ||
        resolveShiftEmployee(shift, employees)
      if (!employee || !employee.hourly_wage) return

      // 勤務時間を計算（時間単位）
      const startTime = shift.start.split(':')
      const endTime = shift.end.split(':')
      const startMinutes = parseInt(startTime[0]) * 60 + parseInt(startTime[1])
      let endMinutes = parseInt(endTime[0]) * 60 + parseInt(endTime[1])

      // 翌日をまたぐ場合（終了時刻が開始時刻より小さい場合）
      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60 // 24時間分を加算
      }

      const workHours = (endMinutes - startMinutes) / 60
      const wage = employee.hourly_wage * workHours
      totalWage += wage
    })

    // 3000円を加算
    return totalWage + 3000
  }

  const targetAmount = calculateTargetAmount()
  const salesRow = salesByDate[toWorkDateKey(dayData.date)] ?? null
  const displayTarget =
    targetAmount !== null ? Math.ceil(Math.round(targetAmount) / 1000) * 1000 : null
  const totalSales = getDailyTotalSales(salesRow)
  const targetPct =
    displayTarget != null && displayTarget > 0
      ? Math.round((totalSales / displayTarget) * 100)
      : null

  return (
    <div className={`day-block ${isFriSat ? 'fri-sat' : ''}`} data-date={dayData.date}>
      <div className="day-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="day-date">
              {dateFormatted}
              <span className="day-dow">({dayData.dow})</span>
            </div>
            {dayData.status && (
              <div
                className={`status-label ${dayData.status === '休業' ? 'closed' : dayData.status === '定休日' ? 'holiday' : ''}`}
              >
                {dayData.status}
              </div>
            )}
          </div>
          {displayTarget !== null && (
            <>
              <div className="target-amount">目標: ¥{displayTarget.toLocaleString()}</div>
              <div className="daily-sales-total">総売上: ¥{totalSales.toLocaleString()}</div>
              <div
                className={`target-pct${targetPct != null && targetPct >= 100 ? ' achieved' : ''}`}
              >
                {targetPct}%
              </div>
            </>
          )}
        </div>
      </div>

      {!dayData.status && (
        <div className="timeline-container" style={{ width: TIMELINE_WIDTH + 'px' }}>
          <TimeAxis />
          {[...new Set(dayData.shifts.map((s) => s.car))].sort().map((carNum) => (
            <CarBlock
              key={carNum}
              carNum={carNum}
              shifts={dayData.shifts}
              visibleEmployeeIds={visibleEmployeeIds}
              colorByName={colorByName}
              employees={employees}
              salesRow={salesRow}
              onOpenVehicleSales={onOpenVehicleSales}
              onOpenVehicleSummary={onOpenVehicleSummary}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TimeAxis() {
  const markers = []

  // ピーク帯（23:00〜02:00）の背景
  const peakStart = minutesToPixels(timeToMinutes('23:00'))
  const peakEnd = minutesToPixels(timeToMinutes('02:00'))

  // 1時間刻みのマーカー
  for (let hour = TIMELINE_START; hour <= 23; hour++) {
    markers.push({
      type: 'major',
      left: minutesToPixels((hour - TIMELINE_START) * 60),
      label: String(hour).padStart(2, '0') + ':00',
    })
  }
  for (let hour = 0; hour <= TIMELINE_END; hour++) {
    markers.push({
      type: 'major',
      left: minutesToPixels((24 - TIMELINE_START + hour) * 60),
      label: String(hour).padStart(2, '0') + ':00',
    })
  }

  // 30分補助線
  for (let hour = TIMELINE_START; hour <= 23; hour++) {
    markers.push({
      type: 'minor',
      left: minutesToPixels((hour - TIMELINE_START) * 60 + 30),
      label: '',
    })
  }
  for (let hour = 0; hour <= TIMELINE_END; hour++) {
    markers.push({
      type: 'minor',
      left: minutesToPixels((24 - TIMELINE_START + hour) * 60 + 30),
      label: '',
    })
  }

  return (
    <div className="time-axis">
      <div
        className="peak-zone"
        style={{
          left: peakStart + 'px',
          width: peakEnd - peakStart + 'px',
        }}
      />
      {markers.map((marker, idx) => (
        <div
          key={idx}
          className={`time-marker ${marker.type}`}
          style={{ left: marker.left + 'px' }}
        >
          {marker.label}
        </div>
      ))}
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
  onOpenVehicleSales,
  onOpenVehicleSummary,
}) {
  const driverShifts = shifts.filter((s) => s.car === carNum && s.role === '代行')
  const companionShifts = shifts.filter((s) => s.car === carNum && s.role === '随伴')
  const salesKeys = getVehicleFieldKeys(carNum)
  const salesAmount = salesKeys ? salesRow?.[salesKeys.sales] : null
  const hasSales = salesAmount != null && Number(salesAmount) > 0

  return (
    <div className="car-block">
      <div className="car-header">
        <span>{carNum}号車</span>
        <Button
          size="small"
          variant="outlined"
          className="car-sales-btn"
          onClick={() => onOpenVehicleSales?.(carNum)}
        >
          売上入力{hasSales ? ` ¥${Number(salesAmount).toLocaleString('ja-JP')}` : ''}
        </Button>
        <Button
          size="small"
          variant="contained"
          color="error"
          className="car-summary-btn"
          disabled={!hasSales}
          onClick={() => onOpenVehicleSummary?.(carNum)}
        >
          集計結果
        </Button>
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
