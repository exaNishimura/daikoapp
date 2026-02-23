import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getShifts } from '@/services/shiftService'
import { getEmployees } from '@/services/employeeService'
import EditIcon from '@mui/icons-material/Edit'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
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
// データ編集エリア（ここを編集すればデータが更新できます）
// ============================================
const SHIFT_DATA = [
  // 形式: { date, dow, car, role, staff, start, end, note, status }
  // status: "休業" | "定休日" | "" (通常)
  // 2人ペアの場合：先に書かれている人を「代行」、後を「随伴」
  
  { date: "2026-01-01", dow: "木", status: "休業" },
  { date: "2026-01-02", dow: "金", car: "1", role: "代行", staff: "西村", start: "22:00", end: "06:00" },
  { date: "2026-01-02", dow: "金", car: "1", role: "随伴", staff: "たかし", start: "22:00", end: "06:00" },
  { date: "2026-01-02", dow: "金", car: "2", role: "代行", staff: "チョロモン", start: "23:00", end: "06:00" },
  { date: "2026-01-02", dow: "金", car: "2", role: "随伴", staff: "なみ", start: "23:00", end: "06:00" },
  { date: "2026-01-03", dow: "土", car: "1", role: "代行", staff: "鈴木", start: "20:00", end: "06:00" },
  { date: "2026-01-03", dow: "土", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-03", dow: "土", car: "2", role: "代行", staff: "西村", start: "23:00", end: "06:00" },
  { date: "2026-01-03", dow: "土", car: "2", role: "随伴", staff: "チョロモン", start: "23:00", end: "06:00" },
  { date: "2026-01-04", dow: "日", car: "1", role: "代行", staff: "西村", start: "20:00", end: "23:00" },
  { date: "2026-01-04", dow: "日", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-04", dow: "日", car: "1", role: "代行", staff: "チョロモン", start: "23:00", end: "06:00" },
  { date: "2026-01-05", dow: "月", status: "定休日" },

  { date: "2026-01-06", dow: "火", car: "1", role: "随伴", staff: "たかし", start: "02:00", end: "06:00" },
  { date: "2026-01-06", dow: "火", car: "1", role: "代行", staff: "西村", start: "21:00", end: "06:00" },
  { date: "2026-01-06", dow: "火", car: "1", role: "随伴", staff: "なみ", start: "21:00", end: "02:00" },
 
  { date: "2026-01-07", dow: "水", car: "1", role: "代行", staff: "西村", start: "21:00", end: "06:00" },
  { date: "2026-01-07", dow: "水", car: "1", role: "随伴", staff: "なみ", start: "21:00", end: "02:00" },
  { date: "2026-01-07", dow: "水", car: "1", role: "随伴", staff: "たかし", start: "02:00", end: "06:00" },

  { date: "2026-01-08", dow: "木", car: "1", role: "代行", staff: "西村", start: "21:00", end: "02:00" },
  { date: "2026-01-08", dow: "木", car: "1", role: "随伴", staff: "なみ", start: "21:00", end: "02:00" },
  { date: "2026-01-08", dow: "木", car: "1", role: "代行", staff: "チョロモン", start: "02:00", end: "06:00" },
  　{ date: "2026-01-08", dow: "木", car: "1", role: "随伴", staff: "西村", start: "02:00", end: "06:00" },

  { date: "2026-01-09", dow: "金", car: "1", role: "代行", staff: "鈴木", start: "20:00", end: "06:00" },
  { date: "2026-01-09", dow: "金", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-09", dow: "金", car: "2", role: "代行", staff: "西村", start: "23:00", end: "06:00" },
  { date: "2026-01-09", dow: "金", car: "2", role: "随伴", staff: "チョロモン", start: "23:00", end: "06:00" },
  { date: "2026-01-10", dow: "土", car: "1", role: "代行", staff: "鈴木", start: "20:00", end: "06:00" },
  { date: "2026-01-10", dow: "土", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-10", dow: "土", car: "2", role: "代行", staff: "西村", start: "23:00", end: "06:00" },
  { date: "2026-01-10", dow: "土", car: "2", role: "随伴", staff: "チョロモン", start: "23:00", end: "06:00" },

  { date: "2026-01-11", dow: "日", car: "2", role: "代行", staff: "チョロモン", start: "23:00", end: "06:00", note: "無人回避" },
  { date: "2026-01-11", dow: "日", car: "2", role: "随伴", staff: "たかし", start: "23:00", end: "06:00", note: "無人回避" },
  { date: "2026-01-11", dow: "日", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-11", dow: "日", car: "1", role: "随伴", staff: "なみ", start: "20:00", end: "06:00" },

  { date: "2026-01-12", dow: "月", status: "定休日" },
  { date: "2026-01-13", dow: "火", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-13", dow: "火", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-13", dow: "火", car: "2", role: "代行", staff: "鈴木", start: "00:30", end: "06:00" },
  { date: "2026-01-13", dow: "火", car: "2", role: "随伴", staff: "チョロモン", start: "00:30", end: "06:00" },

  { date: "2026-01-14", dow: "水", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-14", dow: "水", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-14", dow: "水", car: "2", role: "代行", staff: "鈴木", start: "00:30", end: "06:00" },
  { date: "2026-01-14", dow: "水", car: "2", role: "随伴", staff: "チョロモン", start: "00:30", end: "06:00" },

  { date: "2026-01-15", dow: "木", car: "1", role: "代行", staff: "西村", start: "20:00", end: "00:30" },
  { date: "2026-01-15", dow: "木", car: "1", role: "代行", staff: "鈴木", start: "00:30", end: "06:00" },
  { date: "2026-01-15", dow: "木", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },

  { date: "2026-01-16", dow: "金", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-16", dow: "金", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-16", dow: "金", car: "2", role: "代行", staff: "鈴木", start: "00:30", end: "06:00" },
  { date: "2026-01-16", dow: "金", car: "2", role: "随伴", staff: "チョロモン", start: "00:30", end: "06:00" },
  { date: "2026-01-17", dow: "土", car: "1", role: "代行", staff: "鈴木", start: "20:00", end: "06:00" },
  { date: "2026-01-17", dow: "土", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-17", dow: "土", car: "2", role: "代行", staff: "西村", start: "23:00", end: "06:00" },
  { date: "2026-01-17", dow: "土", car: "2", role: "随伴", staff: "チョロモン", start: "23:00", end: "06:00" },

  { date: "2026-01-18", dow: "日", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00", note: "無人回避" },
  { date: "2026-01-18", dow: "日", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00", note: "無人回避" },

  { date: "2026-01-19", dow: "月", status: "定休日" },
  { date: "2026-01-20", dow: "火", car: "1", role: "随伴", staff: "なみ", start: "21:00", end: "02:00" },
  { date: "2026-01-20", dow: "火", car: "1", role: "代行", staff: "西村", start: "21:00", end: "06:00" },
  { date: "2026-01-20", dow: "火", car: "1", role: "随伴", staff: "たかし", start: "02:00", end: "06:00" },

  { date: "2026-01-21", dow: "水", car: "2", role: "代行", staff: "チョロモン", start: "23:00", end: "06:00" },
  { date: "2026-01-21", dow: "水", car: "1", role: "随伴", staff: "なみ", start: "21:00", end: "02:00" },
  { date: "2026-01-21", dow: "水", car: "1", role: "代行", staff: "西村", start: "21:00", end: "02:00" },
  { date: "2026-01-21", dow: "水", car: "2", role: "随伴", staff: "たかし", start: "23:00", end: "06:00" },
  { date: "2026-01-22", dow: "木", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-22", dow: "木", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-22", dow: "木", car: "2", role: "代行", staff: "チョロモン", start: "23:00", end: "02:00" },
  { date: "2026-01-22", dow: "木", car: "2", role: "随伴", staff: "なみ", start: "23:00", end: "02:00" },
  { date: "2026-01-23", dow: "金", car: "1", role: "代行", staff: "鈴木", start: "20:00", end: "06:00" },
  { date: "2026-01-23", dow: "金", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-23", dow: "金", car: "2", role: "代行", staff: "西村", start: "23:00", end: "06:00" },
  { date: "2026-01-23", dow: "金", car: "2", role: "随伴", staff: "チョロモン", start: "23:00", end: "02:30" },
  { date: "2026-01-23", dow: "金", car: "2", role: "随伴", staff: "なみ", start: "02:30", end: "06:00" },

  { date: "2026-01-24", dow: "土", car: "1", role: "代行", staff: "鈴木", start: "20:00", end: "06:00" },
  { date: "2026-01-24", dow: "土", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-24", dow: "土", car: "2", role: "代行", staff: "西村", start: "23:00", end: "06:00" },
  { date: "2026-01-24", dow: "土", car: "2", role: "随伴", staff: "チョロモン", start: "23:00", end: "02:30" },
  { date: "2026-01-24", dow: "土", car: "2", role: "随伴", staff: "なみ", start: "02:30", end: "06:00" },

  { date: "2026-01-25", dow: "日", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00", note: "無人回避" },
  { date: "2026-01-25", dow: "日", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00", note: "無人回避" },
  { date: "2026-01-26", dow: "月", status: "定休日" },
  
  { date: "2026-01-27", dow: "火", car: "1", role: "代行", staff: "西村", start: "20:00", end: "00:30" },
  { date: "2026-01-27", dow: "火", car: "1", role: "代行", staff: "鈴木", start: "00:30", end: "06:00" },
  { date: "2026-01-27", dow: "火", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-28", dow: "水", car: "1", role: "代行", staff: "西村", start: "21:00", end: "23:00" },

  { date: "2026-01-28", dow: "水", car: "2", role: "代行", staff: "西村", start: "23:00", end: "06:00" },
  { date: "2026-01-28", dow: "水", car: "2", role: "随伴", staff: "たかし", start: "23:00", end: "06:00" },
  { date: "2026-01-28", dow: "水", car: "1", role: "随伴", staff: "チョロモン", start: "01:00", end: "06:00" },
  { date: "2026-01-28", dow: "水", car: "1", role: "代行", staff: "鈴木", start: "23:00", end: "06:00" },
  { date: "2026-01-28", dow: "水", car: "1", role: "随伴", staff: "なみ", start: "21:00", end: "01:00" },

  { date: "2026-01-29", dow: "木", car: "1", role: "代行", staff: "西村", start: "21:00", end: "23:00" },
  { date: "2026-01-29", dow: "木", car: "1", role: "代行", staff: "鈴木", start: "23:00", end: "06:00" },
  { date: "2026-01-29", dow: "木", car: "1", role: "随伴", staff: "なみ", start: "21:00", end: "01:00" },
  { date: "2026-01-29", dow: "木", car: "1", role: "随伴", staff: "西村", start: "01:00", end: "06:00" },

  { date: "2026-01-30", dow: "金", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-30", dow: "金", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-30", dow: "金", car: "2", role: "代行", staff: "鈴木", start: "00:30", end: "06:00" },
  { date: "2026-01-30", dow: "金", car: "2", role: "随伴", staff: "チョロモン", start: "00:30", end: "06:00" },

  { date: "2026-01-31", dow: "土", car: "1", role: "代行", staff: "鈴木", start: "20:00", end: "06:00" },
  { date: "2026-01-31", dow: "土", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-31", dow: "土", car: "2", role: "代行", staff: "西村", start: "23:00", end: "06:00" },
  { date: "2026-01-31", dow: "土", car: "2", role: "随伴", staff: "チョロモン", start: "23:00", end: "06:00" },
]

// ============================================
// 設定（時間軸の範囲）
// ============================================
const TIMELINE_START = 19 // 19:00から表示
const TIMELINE_END = 6    // 06:00まで表示（翌日）
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

// スタッフ名をCSSクラス名に変換
function staffToClass(staff) {
  const map = {
    '西村': 'nishimura',
    '鈴木': 'suzuki',
    'チョロモン': 'choromon',
    'たかし': 'takashi',
    'なみ': 'nami',
    'しゅうや': 'shuya'
  }
  return map[staff] || ''
}

// 日付をグループ化
function groupByDate(data) {
  const grouped = {}
  data.forEach(item => {
    if (!grouped[item.date]) {
      grouped[item.date] = {
        date: item.date,
        dow: item.dow,
        status: item.status || '',
        shifts: []
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
  const [visibleStaff, setVisibleStaff] = useState(['西村', '鈴木', 'チョロモン', 'たかし', 'なみ', 'しゅうや'])
  const [searchText, setSearchText] = useState('')
  const [shifts, setShifts] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  // 現在の年月を初期値として設定
  const today = new Date()
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1)
  const calendarContainerRef = useRef(null)
  const hasScrolledRef = useRef(false)
  const [searchExpanded, setSearchExpanded] = useState(false) // デフォルトは閉じた状態


  const loadShifts = async () => {
    setLoading(true)
    try {
      // 選択された年月のデータを取得
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
      
      const [shiftsResult, employeesResult] = await Promise.all([
        getShifts(startDate, endDate),
        getEmployees()
      ])

      if (shiftsResult.error) {
        console.error('Error loading shifts:', shiftsResult.error)
        setShifts([])
      } else {
        setShifts(shiftsResult.data || [])
      }

      if (employeesResult.error) {
        console.error('Error loading employees:', employeesResult.error)
        setEmployees([])
      } else {
        setEmployees(employeesResult.data || [])
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setShifts([])
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedYear && selectedMonth) {
      hasScrolledRef.current = false
      loadShifts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth])

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
            inline: 'nearest'
          })
          hasScrolledRef.current = true
        }
      }, 100)
    }
  }, [loading, selectedYear, selectedMonth])


  // データを日付でグループ化
  const groupedData = useMemo(() => groupByDate(shifts), [shifts])

  // フィルタリングされた日付リスト
  const filteredDates = useMemo(() => {
    const dates = Object.keys(groupedData).sort()
    if (!searchText) return dates

    return dates.filter(date => {
      const dayData = groupedData[date]
      const dateParts = date.split('-')
      const dateFormatted = `${parseInt(dateParts[1])}月${parseInt(dateParts[2])}日`
      const matchDate = date.includes(searchText) || dateFormatted.includes(searchText)
      const matchDow = dayData.dow.includes(searchText)
      const matchStaff = dayData.shifts.some(s => s.staff.includes(searchText))
      const matchStatus = dayData.status && dayData.status.includes(searchText)
      
      return matchDate || matchDow || matchStaff || matchStatus
    })
  }, [groupedData, searchText])

  const handleStaffFilterChange = (staff, checked) => {
    if (checked) {
      setVisibleStaff(prev => [...prev, staff])
    } else {
      setVisibleStaff(prev => prev.filter(s => s !== staff))
    }
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
      <div className="shift-header">
        <Box sx={{ mb: 2 }}>
          <h1 style={{ marginBottom: '16px', fontSize: '20px' }}>運転代行シフト表</h1>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2, 
            alignItems: { xs: 'stretch', sm: 'center' },
            flexWrap: 'wrap'
          }}>
            {/* 月移動コントロール */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              justifyContent: { xs: 'center', sm: 'flex-start' },
              width: { xs: '100%', sm: 'auto' }
            }}>
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
                  fontSize: { xs: '16px', sm: '20px' }
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
            {/* 年月セレクトと編集ボタン */}
            <Box sx={{ 
              display: 'flex', 
              gap: 1.5, 
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: { xs: 'center', sm: 'flex-start' },
              width: { xs: '100%', sm: 'auto' }
            }}>
              <FormControl 
                size="small" 
                sx={{ 
                  minWidth: { xs: '80px', sm: '100px' },
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
                <InputLabel>年</InputLabel>
                <Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  label="年"
                >
                  {[2024, 2025, 2026, 2027, 2028].map(year => (
                    <MenuItem key={year} value={year}>{year}年</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl 
                size="small" 
                sx={{ 
                  minWidth: { xs: '80px', sm: '100px' },
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
                <InputLabel>月</InputLabel>
                <Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  label="月"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                    <MenuItem key={month} value={month}>{month}月</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                onClick={() => navigate(`/shift/edit?year=${selectedYear}&month=${selectedMonth}`)}
                startIcon={<EditIcon />}
                size="small"
                sx={{ 
                  whiteSpace: 'nowrap',
                  fontSize: { xs: '12px', sm: '14px' }
                }}
              >
                シフト編集
              </Button>
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<SearchIcon />}
            endIcon={searchExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setSearchExpanded(!searchExpanded)}
            sx={{
              mb: 1,
              textTransform: 'none',
            }}
          >
            検索・フィルター
          </Button>
        </Box>
        <Collapse in={searchExpanded}>
          <div className="shift-controls">
            <div className="filter-group">
              {['西村', '鈴木', 'チョロモン', 'たかし', 'なみ', 'しゅうや'].map(staff => (
                <label key={staff}>
                  <input
                    type="checkbox"
                    checked={visibleStaff.includes(staff)}
                    onChange={(e) => handleStaffFilterChange(staff, e.target.checked)}
                  />
                  {staff}
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
          <div className="legend-item">
            <div className="legend-color nishimura"></div>
            <span>西村</span>
          </div>
          <div className="legend-item">
            <div className="legend-color suzuki"></div>
            <span>鈴木</span>
          </div>
          <div className="legend-item">
            <div className="legend-color choromon"></div>
            <span>チョロモン</span>
          </div>
          <div className="legend-item">
            <div className="legend-color takashi"></div>
            <span>たかし</span>
          </div>
          <div className="legend-item">
            <div className="legend-color nami"></div>
            <span>なみ</span>
          </div>
          <div className="legend-item">
            <div className="legend-color shuya"></div>
            <span>しゅうや</span>
          </div>
        </div>
      </div>

      <div className="shift-container" ref={calendarContainerRef}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>読み込み中...</div>
        ) : (
          <div className="shift-calendar">
            {filteredDates.map(date => (
              <DayBlock
                key={date}
                dayData={groupedData[date]}
                visibleStaff={visibleStaff}
                employees={employees}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

function DayBlock({ dayData, visibleStaff, employees }) {
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
    employees.forEach(emp => {
      employeeMap[emp.name] = emp
    })

    let totalWage = 0

    // 各シフトの給料を計算
    dayData.shifts.forEach(shift => {
      if (!shift.start || !shift.end || !shift.staff) return

      const employee = employeeMap[shift.staff]
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

  return (
    <div className={`day-block ${isFriSat ? 'fri-sat' : ''}`} data-date={dayData.date}>
      <div className="day-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <div className="day-date">
            {dateFormatted}
            <span className="day-dow">({dayData.dow})</span>
          </div>
          {targetAmount !== null && (
            <div className="target-amount">
              目標: ¥{(Math.ceil(Math.round(targetAmount) / 1000) * 1000).toLocaleString()}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {dayData.status && (
            <div className={`status-label ${dayData.status === '休業' ? 'closed' : dayData.status === '定休日' ? 'holiday' : ''}`}>
              {dayData.status}
            </div>
          )}
        </div>
      </div>

      {!dayData.status && (
        <div className="timeline-container" style={{ width: TIMELINE_WIDTH + 'px' }}>
          <TimeAxis />
          {[...new Set(dayData.shifts.map(s => s.car))].sort().map(carNum => (
            <CarBlock
              key={carNum}
              carNum={carNum}
              shifts={dayData.shifts}
              visibleStaff={visibleStaff}
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
      label: String(hour).padStart(2, '0') + ':00'
    })
  }
  for (let hour = 0; hour <= TIMELINE_END; hour++) {
    markers.push({
      type: 'major',
      left: minutesToPixels((24 - TIMELINE_START + hour) * 60),
      label: String(hour).padStart(2, '0') + ':00'
    })
  }

  // 30分補助線
  for (let hour = TIMELINE_START; hour <= 23; hour++) {
    markers.push({
      type: 'minor',
      left: minutesToPixels((hour - TIMELINE_START) * 60 + 30),
      label: ''
    })
  }
  for (let hour = 0; hour <= TIMELINE_END; hour++) {
    markers.push({
      type: 'minor',
      left: minutesToPixels((24 - TIMELINE_START + hour) * 60 + 30),
      label: ''
    })
  }

  return (
    <div className="time-axis">
      <div
        className="peak-zone"
        style={{
          left: peakStart + 'px',
          width: (peakEnd - peakStart) + 'px'
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

function CarBlock({ carNum, shifts, visibleStaff }) {
  const driverShifts = shifts.filter(s => s.car === carNum && s.role === '代行')
  const companionShifts = shifts.filter(s => s.car === carNum && s.role === '随伴')

  return (
    <div className="car-block">
      <div className="car-header">{carNum}号車</div>
      <Lane role="代行" shifts={driverShifts} visibleStaff={visibleStaff} />
      <Lane role="随伴" shifts={companionShifts} visibleStaff={visibleStaff} />
    </div>
  )
}

function Lane({ role, shifts, visibleStaff }) {
  return (
    <div className="lane">
      <div className="lane-label">{role}</div>
      {shifts.map((shift, idx) => (
        <Bar
          key={idx}
          shift={shift}
          visible={visibleStaff.length === 0 || visibleStaff.includes(shift.staff)}
        />
      ))}
    </div>
  )
}

function Bar({ shift, visible }) {
  const startMinutes = timeToMinutes(shift.start)
  const endMinutes = timeToMinutes(shift.end)
  const left = minutesToPixels(startMinutes)
  const width = minutesToPixels(endMinutes - startMinutes)
  const staffClass = staffToClass(shift.staff)

  const title = shift.note
    ? `${shift.staff} (${shift.role}) ${shift.start}-${shift.end} - ${shift.note}`
    : `${shift.staff} (${shift.role}) ${shift.start}-${shift.end}`

  return (
    <div
      className={`bar ${staffClass} ${!visible ? 'hidden' : ''}`}
      style={{
        left: left + 'px',
        width: width + 'px'
      }}
      title={title}
    >
      <span className="bar-text">{shift.staff}</span>
      <span className="bar-time">{shift.start}-{shift.end}</span>
    </div>
  )
}

