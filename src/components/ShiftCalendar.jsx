import { useState, useMemo } from 'react'
import './ShiftCalendar.css'

// ============================================
// データ編集エリア（ここを編集すればデータが更新できます）
// ============================================
const SHIFT_DATA = [
  // 形式: { date, dow, car, role, staff, start, end, note, status }
  // status: "休業" | "定休日" | "" (通常)
  // 2人ペアの場合：先に書かれている人を「代行」、後を「随伴」
  
  { date: "2026-01-01", dow: "木", status: "休業" },
  { date: "2026-01-02", dow: "金", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-02", dow: "金", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-02", dow: "金", car: "2", role: "代行", staff: "チョロモン", start: "23:00", end: "06:00" },
  { date: "2026-01-02", dow: "金", car: "2", role: "随伴", staff: "なみ", start: "23:00", end: "06:00" },
  { date: "2026-01-03", dow: "土", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-03", dow: "土", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-04", dow: "日", car: "1", role: "代行", staff: "チョロモン", start: "23:00", end: "06:00" },
  { date: "2026-01-04", dow: "日", car: "1", role: "随伴", staff: "たかし", start: "23:00", end: "06:00" },
  { date: "2026-01-05", dow: "月", status: "定休日" },
  { date: "2026-01-06", dow: "火", car: "1", role: "代行", staff: "西村", start: "23:00", end: "02:00" },
  { date: "2026-01-06", dow: "火", car: "1", role: "随伴", staff: "なみ", start: "23:00", end: "02:00" },
  { date: "2026-01-07", dow: "水", car: "1", role: "代行", staff: "西村", start: "23:00", end: "02:00" },
  { date: "2026-01-07", dow: "水", car: "1", role: "随伴", staff: "なみ", start: "23:00", end: "02:00" },
  { date: "2026-01-08", dow: "木", car: "1", role: "代行", staff: "西村", start: "23:00", end: "02:00" },
  { date: "2026-01-08", dow: "木", car: "1", role: "随伴", staff: "なみ", start: "23:00", end: "02:00" },
  { date: "2026-01-09", dow: "金", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-09", dow: "金", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-10", dow: "土", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-10", dow: "土", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-11", dow: "日", car: "1", role: "代行", staff: "西村", start: "23:00", end: "06:00", note: "無人回避" },
  { date: "2026-01-11", dow: "日", car: "1", role: "随伴", staff: "チョロモン", start: "23:00", end: "06:00", note: "無人回避" },
  { date: "2026-01-12", dow: "月", status: "定休日" },
  { date: "2026-01-13", dow: "火", car: "1", role: "代行", staff: "鈴木", start: "00:30", end: "06:00" },
  { date: "2026-01-13", dow: "火", car: "1", role: "随伴", staff: "たかし", start: "00:30", end: "06:00" },
  { date: "2026-01-14", dow: "水", car: "1", role: "代行", staff: "西村", start: "23:00", end: "02:00" },
  { date: "2026-01-14", dow: "水", car: "1", role: "随伴", staff: "なみ", start: "23:00", end: "02:00" },
  { date: "2026-01-15", dow: "木", status: "休業" },
  { date: "2026-01-16", dow: "金", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-16", dow: "金", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-17", dow: "土", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-17", dow: "土", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-18", dow: "日", car: "1", role: "代行", staff: "西村", start: "23:00", end: "06:00", note: "無人回避" },
  { date: "2026-01-18", dow: "日", car: "1", role: "随伴", staff: "チョロモン", start: "23:00", end: "06:00", note: "無人回避" },
  { date: "2026-01-19", dow: "月", status: "定休日" },
  { date: "2026-01-20", dow: "火", car: "1", role: "代行", staff: "西村", start: "23:00", end: "02:00" },
  { date: "2026-01-20", dow: "火", car: "1", role: "随伴", staff: "なみ", start: "23:00", end: "02:00" },
  { date: "2026-01-21", dow: "水", car: "1", role: "代行", staff: "西村", start: "23:00", end: "02:00" },
  { date: "2026-01-21", dow: "水", car: "1", role: "随伴", staff: "なみ", start: "23:00", end: "02:00" },
  { date: "2026-01-22", dow: "木", car: "1", role: "代行", staff: "西村", start: "23:00", end: "02:00" },
  { date: "2026-01-22", dow: "木", car: "1", role: "随伴", staff: "なみ", start: "23:00", end: "02:00" },
  { date: "2026-01-23", dow: "金", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-23", dow: "金", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-23", dow: "金", car: "2", role: "代行", staff: "鈴木", start: "02:30", end: "06:00" },
  { date: "2026-01-23", dow: "金", car: "2", role: "随伴", staff: "なみ", start: "02:30", end: "06:00" },
  { date: "2026-01-24", dow: "土", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-24", dow: "土", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-24", dow: "土", car: "2", role: "代行", staff: "鈴木", start: "02:30", end: "06:00" },
  { date: "2026-01-24", dow: "土", car: "2", role: "随伴", staff: "なみ", start: "02:30", end: "06:00" },
  { date: "2026-01-25", dow: "日", car: "1", role: "代行", staff: "西村", start: "23:00", end: "06:00", note: "無人回避" },
  { date: "2026-01-25", dow: "日", car: "1", role: "随伴", staff: "チョロモン", start: "23:00", end: "06:00", note: "無人回避" },
  { date: "2026-01-26", dow: "月", status: "定休日" },
  { date: "2026-01-27", dow: "火", car: "1", role: "代行", staff: "鈴木", start: "00:30", end: "06:00" },
  { date: "2026-01-27", dow: "火", car: "1", role: "随伴", staff: "たかし", start: "00:30", end: "06:00" },
  { date: "2026-01-28", dow: "水", car: "1", role: "代行", staff: "西村", start: "23:00", end: "01:00" },
  { date: "2026-01-28", dow: "水", car: "1", role: "随伴", staff: "なみ", start: "23:00", end: "01:00" },
  { date: "2026-01-29", dow: "木", car: "1", role: "代行", staff: "西村", start: "23:00", end: "01:00" },
  { date: "2026-01-29", dow: "木", car: "1", role: "随伴", staff: "なみ", start: "23:00", end: "01:00" },
  { date: "2026-01-30", dow: "金", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-30", dow: "金", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
  { date: "2026-01-31", dow: "土", car: "1", role: "代行", staff: "西村", start: "20:00", end: "06:00" },
  { date: "2026-01-31", dow: "土", car: "1", role: "随伴", staff: "たかし", start: "20:00", end: "06:00" },
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
    'なみ': 'nami'
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
  const [visibleStaff, setVisibleStaff] = useState(['西村', '鈴木', 'チョロモン', 'たかし', 'なみ'])
  const [searchText, setSearchText] = useState('')

  // データを日付でグループ化
  const groupedData = useMemo(() => groupByDate(SHIFT_DATA), [])

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

  return (
    <div className="shift-calendar-page">
      <div className="shift-header">
        <h1>運転代行シフト表 - 2026年1月</h1>
        <div className="shift-controls">
          <div className="filter-group">
            {['西村', '鈴木', 'チョロモン', 'たかし', 'なみ'].map(staff => (
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
        </div>
      </div>

      <div className="shift-container">
        <div className="shift-calendar">
          {filteredDates.map(date => (
            <DayBlock
              key={date}
              dayData={groupedData[date]}
              visibleStaff={visibleStaff}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function DayBlock({ dayData, visibleStaff }) {
  const isFriSat = dayData.dow === '金' || dayData.dow === '土'
  const dateParts = dayData.date.split('-')
  const dateFormatted = `${parseInt(dateParts[1])}月${parseInt(dateParts[2])}日`

  return (
    <div className={`day-block ${isFriSat ? 'fri-sat' : ''}`}>
      <div className="day-header">
        <div className="day-date">
          {dateFormatted}
          <span className="day-dow">({dayData.dow})</span>
        </div>
        {dayData.status && (
          <div className={`status-label ${dayData.status === '休業' ? 'closed' : dayData.status === '定休日' ? 'holiday' : ''}`}>
            {dayData.status}
          </div>
        )}
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

