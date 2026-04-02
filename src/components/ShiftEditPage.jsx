import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getShifts, createShift, updateShift, deleteShift, deleteShiftsByDate } from '@/services/shiftService'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import Stack from '@mui/material/Stack'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Collapse from '@mui/material/Collapse'
import SaveIcon from '@mui/icons-material/Save'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import './ShiftEditPage.css'

const CAR_OPTIONS = ['1', '2']
const ROLE_OPTIONS = ['代行', '随伴']
const STAFF_OPTIONS = ['西村', '鈴木', 'チョロモン', 'たかし', 'なみ', 'しゅうや']
const STATUS_OPTIONS = ['休業', '定休日']
const DOW_MAP = ['日', '月', '火', '水', '木', '金', '土']

// タイムライン表示用の定数
const TIMELINE_START = 19 // 19:00から表示
const TIMELINE_END = 6    // 06:00まで表示（翌日）
const TIMELINE_WIDTH = 960 // 時間軸の幅（px）
const PIXELS_PER_HOUR = TIMELINE_WIDTH / 12 // 12時間 = 960px

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

// 月の日付リストを生成
function getDaysInMonth(year, month) {
  const days = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dow = DOW_MAP[date.getDay()]
    const isWeekend = dow === '土' || dow === '日'
    days.push({ date: dateStr, day, dow, isWeekend })
  }
  return days
}

/**
 * クエリ未指定時の表示月（ローカル日付基準・年・月は 1–12）
 * 20日以降は翌月、19日以前は当月
 */
function getDefaultShiftEditYearMonth(reference = new Date()) {
  if (reference.getDate() >= 20) {
    const d = new Date(reference.getFullYear(), reference.getMonth() + 1, 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }
  return {
    year: reference.getFullYear(),
    month: reference.getMonth() + 1,
  }
}

export function ShiftEditPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const defaultYM = getDefaultShiftEditYearMonth()
  const year = parseInt(searchParams.get('year') || String(defaultYM.year), 10)
  const month = parseInt(searchParams.get('month') || String(defaultYM.month), 10)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [shifts, setShifts] = useState([])
  const [editingDates, setEditingDates] = useState({}) // 日付ごとの編集状態
  const [newShifts, setNewShifts] = useState({}) // 日付ごとの新規シフトデータ
  const [editingShiftIds, setEditingShiftIds] = useState({}) // 編集中のシフトID
  const [editingShifts, setEditingShifts] = useState({}) // 編集中のシフトデータ
  const [statuses, setStatuses] = useState({}) // 日付ごとのステータス
  const [copyDialogOpen, setCopyDialogOpen] = useState(false) // コピー用ダイアログの開閉状態
  const [copyTargetDate, setCopyTargetDate] = useState(null) // コピー対象の日付
  const [expandedDates, setExpandedDates] = useState(() => {
    // デフォルトで全て展開
    const expanded = {}
    if (year && month) {
      const days = getDaysInMonth(year, month)
      days.forEach(({ date }) => {
        expanded[date] = true
      })
    }
    return expanded
  }) // 折りたたみ状態

  const days = useMemo(() => {
    if (!year || !month) return []
    return getDaysInMonth(year, month)
  }, [year, month])

  // ページが開かれたときにシフトデータを取得
  useEffect(() => {
    if (year && month) {
      loadShifts()
    }
  }, [year, month])

  const loadShifts = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(days.length).padStart(2, '0')}`
      
      const { data, error: fetchError } = await getShifts(startDate, endDate)

      if (fetchError) {
        setError(`シフトデータの取得に失敗: ${fetchError.message}`)
        setShifts([])
      } else {
        setShifts(data || [])
        // ステータスを抽出
        const statusMap = {}
        data?.forEach(shift => {
          if (shift.status) {
            statusMap[shift.date] = shift.status
          }
        })
        
        // 月曜日を自動的に定休日に設定
        const mondayDates = days.filter(({ dow }) => dow === '月').map(({ date }) => date)
        const mondayUpdates = []
        let hasUpdates = false
        
        for (const date of mondayDates) {
          // 既にステータスが設定されている場合はスキップ
          if (statusMap[date]) continue
          
          // シフトが設定されている場合はスキップ
          const hasShift = data?.some(s => s.date === date && !s.status)
          if (hasShift) continue
          
          // 定休日を設定
          const dateObj = new Date(date)
          const dow = DOW_MAP[dateObj.getDay()]
          hasUpdates = true
          mondayUpdates.push(
            createShift({
              date,
              dow,
              status: '定休日',
            }).then(() => {
              statusMap[date] = '定休日'
            }).catch((err) => {
              // エラーは無視（既に存在する可能性がある）
              if (process.env.NODE_ENV === 'development') {
                console.warn(`Failed to set Monday as holiday for ${date}:`, err)
              }
            })
          )
        }
        
        // 月曜日の定休日設定を並列実行
        if (mondayUpdates.length > 0) {
          await Promise.all(mondayUpdates)
        }
        
        setStatuses(statusMap)
        
        // 月曜日の定休日を設定した場合は、シフトデータを再取得
        if (hasUpdates) {
          const { data: updatedData } = await getShifts(startDate, endDate)
          if (updatedData) {
            setShifts(updatedData)
          }
        }
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
      setShifts([])
    } finally {
      setLoading(false)
    }
  }

  const getShiftsForDate = (date) => {
    return shifts.filter(s => s.date === date && !s.status)
  }

  const handleStartEdit = (date) => {
    setEditingDates(prev => ({ ...prev, [date]: true }))
    setNewShifts(prev => ({
      ...prev,
      [date]: {
        car: '',
        role: '',
        staff: '',
        start: '',
        end: '',
        note: '',
      }
    }))
  }

  const handleCancelEdit = (date) => {
    setEditingDates(prev => {
      const next = { ...prev }
      delete next[date]
      return next
    })
    setNewShifts(prev => {
      const next = { ...prev }
      delete next[date]
      return next
    })
  }

  const handleAddShift = async (date) => {
    const shiftData = newShifts[date]
    if (!shiftData || !shiftData.car || !shiftData.role || !shiftData.staff || !shiftData.start || !shiftData.end) {
      setError('車両、役割、スタッフ、開始時刻、終了時刻は必須です')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const dateObj = new Date(date)
      const dow = DOW_MAP[dateObj.getDay()]
      
      const { error: createError } = await createShift({
        date,
        dow,
        car: shiftData.car,
        role: shiftData.role,
        staff: shiftData.staff,
        start: shiftData.start,
        end: shiftData.end,
        note: shiftData.note || null,
      })

      if (createError) {
        setError(`シフトの追加に失敗: ${createError.message}`)
      } else {
        setNewShifts(prev => {
          const next = { ...prev }
          next[date] = {
            car: '',
            role: '',
            staff: '',
            start: '',
            end: '',
            note: '',
          }
          return next
        })
        await loadShifts()
        setSuccess('シフトを追加しました')
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleStartEditShift = (shift) => {
    setEditingShiftIds(prev => ({ ...prev, [shift.id]: true }))
    setEditingShifts(prev => ({
      ...prev,
      [shift.id]: {
        car: shift.car,
        role: shift.role,
        staff: shift.staff,
        start: shift.start,
        end: shift.end,
        note: shift.note || '',
      }
    }))
  }

  const handleCancelEditShift = (shiftId) => {
    setEditingShiftIds(prev => {
      const next = { ...prev }
      delete next[shiftId]
      return next
    })
    setEditingShifts(prev => {
      const next = { ...prev }
      delete next[shiftId]
      return next
    })
  }

  const handleUpdateShift = async (shiftId, date) => {
    const shiftData = editingShifts[shiftId]
    if (!shiftData || !shiftData.car || !shiftData.role || !shiftData.staff || !shiftData.start || !shiftData.end) {
      setError('車両、役割、スタッフ、開始時刻、終了時刻は必須です')
      return
    }

    // 一括保存用に編集状態を保持（個別保存は行わない）
    // 実際の保存は handleSaveAll で一括実行
  }

  // 一括保存処理
  const handleSaveAll = async () => {
    // 編集中のシフトがない場合
    if (Object.keys(editingShifts).length === 0) {
      setError('保存するシフトがありません。シフトを編集してから保存してください。')
      return
    }

    // バリデーション
    const invalidShifts = []
    Object.keys(editingShifts).forEach(shiftId => {
      const shiftData = editingShifts[shiftId]
      if (!shiftData || !shiftData.car || !shiftData.role || !shiftData.staff || !shiftData.start || !shiftData.end) {
        invalidShifts.push(shiftId)
      }
    })

    if (invalidShifts.length > 0) {
      setError('編集中のシフトに必須項目が未入力です。車両、役割、スタッフ、開始時刻、終了時刻は必須です')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const updatePromises = []
      const shiftIdToDateMap = {}

      // シフトIDから日付を取得するためのマップを作成
      shifts.forEach(shift => {
        if (editingShifts[shift.id]) {
          shiftIdToDateMap[shift.id] = shift.date
        }
      })

      // 全ての編集中のシフトを更新
      Object.keys(editingShifts).forEach(shiftId => {
        const shiftData = editingShifts[shiftId]
        const date = shiftIdToDateMap[shiftId]
        if (!date) return

        const dateObj = new Date(date)
        const dow = DOW_MAP[dateObj.getDay()]

        updatePromises.push(
          updateShift(shiftId, {
            car: shiftData.car,
            role: shiftData.role,
            staff: shiftData.staff,
            start: shiftData.start,
            end: shiftData.end,
            note: shiftData.note || null,
            dow,
          })
        )
      })

      const results = await Promise.all(updatePromises)
      const errors = results.filter(r => r.error)

      if (errors.length > 0) {
        setError(`一部のシフトの更新に失敗しました: ${errors[0].error.message}`)
      } else {
        // 編集状態をクリア
        setEditingShiftIds({})
        setEditingShifts({})
        await loadShifts()
        setSuccess(`${results.length}件のシフトを更新しました`)
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // 他の日からシフトをコピー
  const handleCopyFromDate = async (sourceDate) => {
    const sourceShifts = getShiftsForDate(sourceDate)
    if (sourceShifts.length === 0) {
      setError('選択した日付にシフトが設定されていません')
      setCopyDialogOpen(false)
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const dateObj = new Date(copyTargetDate)
      const dow = DOW_MAP[dateObj.getDay()]

      // 全てのシフトをコピーして作成
      const createPromises = sourceShifts.map(shift =>
        createShift({
          date: copyTargetDate,
          dow,
          car: shift.car,
          role: shift.role,
          staff: shift.staff,
          start: shift.start,
          end: shift.end,
          note: shift.note || null,
        })
      )

      const results = await Promise.all(createPromises)
      const errors = results.filter(r => r.error)

      if (errors.length > 0) {
        setError(`一部のシフトのコピーに失敗しました: ${errors[0].error.message}`)
      } else {
        await loadShifts()
        setSuccess(`${sourceDate}から${sourceShifts.length}件のシフトをコピーしました`)
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
      setCopyDialogOpen(false)
    }
  }

  const handleDeleteShift = async (id, date) => {
    if (!confirm('このシフトを削除しますか？')) {
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: deleteError } = await deleteShift(id)

      if (deleteError) {
        setError(`削除に失敗: ${deleteError.message}`)
      } else {
        await loadShifts()
        setSuccess('シフトを削除しました')
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSetStatus = async (date, status) => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // 既存のシフトを削除
      await deleteShiftsByDate(date)

      if (status) {
        const dateObj = new Date(date)
        const dow = DOW_MAP[dateObj.getDay()]
        
        // ステータスを追加
        const { error: createError } = await createShift({
          date,
          dow,
          status,
        })

        if (createError) {
          setError(`ステータスの保存に失敗: ${createError.message}`)
        } else {
          await loadShifts()
          setSuccess('ステータスを更新しました')
        }
      } else {
        await loadShifts()
        setSuccess('ステータスを解除しました')
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const monthLabel = year && month ? `${year}年${month}月` : ''

  // タイムライン表示用のコンポーネント
  const TimeAxis = () => {
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
      <Box className="time-axis" sx={{ position: 'relative', height: '30px', borderBottom: '2px solid #ddd', mb: 1.25, bgcolor: '#ffffff' }}>
        <Box
          className="peak-zone"
          sx={{
            position: 'absolute',
            top: 0,
            height: '100%',
            background: 'rgba(255, 240, 200, 0.3)',
            borderLeft: '1px solid rgba(255, 200, 0, 0.3)',
            borderRight: '1px solid rgba(255, 200, 0, 0.3)',
            left: `${peakStart}px`,
            width: `${peakEnd - peakStart}px`
          }}
        />
        {markers.map((marker, idx) => (
          <Box
            key={idx}
            className={`time-marker ${marker.type}`}
            sx={{
              position: 'absolute',
              height: '100%',
              borderLeft: marker.type === 'major' ? '2px solid #ddd' : '1px dashed #ddd',
              fontSize: '11px',
              pl: 0.5,
              color: '#333',
              fontWeight: marker.type === 'major' ? 'bold' : 'normal',
              opacity: marker.type === 'minor' ? 0.5 : 1,
              left: `${marker.left}px`
            }}
          >
            {marker.label}
          </Box>
        ))}
      </Box>
    )
  }

  const CarBlock = ({ carNum, shifts }) => {
    const driverShifts = shifts.filter(s => s.car === carNum && s.role === '代行')
    const companionShifts = shifts.filter(s => s.car === carNum && s.role === '随伴')

    return (
      <Box className="car-block" sx={{ mb: 2.5, bgcolor: '#ffffff' }}>
        <Box className="car-header" sx={{ fontWeight: 'bold', mb: 1, fontSize: '14px', color: '#333' }}>
          {carNum}号車
        </Box>
        <Lane role="代行" shifts={driverShifts} />
        <Lane role="随伴" shifts={companionShifts} />
      </Box>
    )
  }

  const Lane = ({ role, shifts }) => {
    return (
      <Box className="lane" sx={{ position: 'relative', height: '40px', border: '1px solid #e0e0e0', borderRadius: 1, mb: 0.625, bgcolor: '#fafafa', overflow: 'hidden' }}>
        <Box className="lane-label" sx={{ position: 'absolute', left: '5px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#666', zIndex: 1, bgcolor: 'rgba(255,255,255,0.8)', px: 0.75, py: 0.25, borderRadius: 0.375 }}>
          {role}
        </Box>
        {shifts.map((shift, idx) => (
          <ShiftBar key={shift.id || idx} shift={shift} />
        ))}
      </Box>
    )
  }

  const ShiftBar = ({ shift }) => {
    const startMinutes = timeToMinutes(shift.start)
    const endMinutes = timeToMinutes(shift.end)
    const left = minutesToPixels(startMinutes)
    const width = minutesToPixels(endMinutes - startMinutes)
    const staffClass = staffToClass(shift.staff)

    const title = shift.note
      ? `${shift.staff} (${shift.role}) ${shift.start}-${shift.end} - ${shift.note}`
      : `${shift.staff} (${shift.role}) ${shift.start}-${shift.end}`

    const staffColors = {
      nishimura: '#FFA500',
      suzuki: '#FFD700',
      choromon: '#8A2BE2',
      takashi: '#00BFFF',
      nami: '#FF69B4',
      shuya: '#32CD32'
    }

    return (
      <Box
        className={`bar ${staffClass}`}
        title={title}
        sx={{
          position: 'absolute',
          left: `${left}px`,
          width: `${width}px`,
          height: '32px',
          top: '4px',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          pl: 0.5,
          fontSize: '11px',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'opacity 0.2s',
          border: '1px solid rgba(0,0,0,0.2)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          bgcolor: staffColors[staffClass] || '#ccc',
          '&:hover': {
            opacity: 0.8,
            zIndex: 10
          }
        }}
      >
        <Typography component="span" className="bar-text" sx={{ whiteSpace: 'nowrap', textShadow: '0 0 3px rgba(255,255,255,0.8)', fontSize: '11px' }}>
          {shift.staff}
        </Typography>
        <Typography component="span" className="bar-time" sx={{ fontSize: '10px', ml: 0.5, opacity: 0.9 }}>
          {shift.start}-{shift.end}
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ 
      p: 3, 
      maxWidth: '1400px', 
      mx: 'auto',
      bgcolor: '#f5f5f5',
      minHeight: '100vh'
    }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton 
            onClick={() => navigate('/shift')} 
            sx={{ 
              mr: 1,
              color: '#666',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.04)',
                color: '#333'
              }
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton
              onClick={() => {
                const prevMonth = month === 1 ? 12 : month - 1
                const prevYear = month === 1 ? year - 1 : year
                navigate(`/shift/edit?year=${prevYear}&month=${prevMonth}`)
              }}
              disabled={loading}
              size="large"
              sx={{
                color: '#666',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.04)',
                  color: '#333'
                },
                '&.Mui-disabled': {
                  color: '#bdbdbd'
                }
              }}
            >
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="h4" component="h1" sx={{ minWidth: '200px', textAlign: 'center', color: '#333' }}>
              {monthLabel}
            </Typography>
            <IconButton
              onClick={() => {
                const nextMonth = month === 12 ? 1 : month + 1
                const nextYear = month === 12 ? year + 1 : year
                navigate(`/shift/edit?year=${nextYear}&month=${nextMonth}`)
              }}
              disabled={loading}
              size="large"
              sx={{
                color: '#666',
                '&:hover': {
                  bgcolor: 'rgba(0, 0, 0, 0.04)',
                  color: '#333'
                },
                '&.Mui-disabled': {
                  color: '#bdbdbd'
                }
              }}
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSaveAll}
              disabled={loading}
              sx={{ minWidth: '120px' }}
            >
              一括保存
            </Button>
            {Object.keys(editingShifts).length > 0 && (
              <Chip 
                label={`${Object.keys(editingShifts).length}件編集中`} 
                size="small" 
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
          <Button
            variant="outlined"
            onClick={loadShifts}
            disabled={loading}
          >
            再読み込み
          </Button>
        </Box>
      </Box>

      {/* エラー・成功メッセージ */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {loading && !shifts.length && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography>読み込み中...</Typography>
        </Box>
      )}

      {/* シフト一覧 */}
      {!loading && days.length > 0 && (
        <Stack spacing={2}>
          {days.map(({ date, day, dow, isWeekend }) => {
            const dateShifts = getShiftsForDate(date)
            const status = statuses[date]
            const isEditing = editingDates[date]
            const newShift = newShifts[date] || {
              car: '',
              role: '',
              staff: '',
              start: '',
              end: '',
              note: '',
            }

            const isExpanded = expandedDates[date] !== false // デフォルトで展開
            const hasShifts = dateShifts.length > 0
            const toggleExpand = () => {
              setExpandedDates(prev => ({ ...prev, [date]: !(prev[date] !== false) }))
            }

            return (
              <Card 
                key={date} 
                sx={{ 
                  border: isWeekend ? '2px solid' : '1px solid',
                  borderColor: isWeekend ? '#1976d2' : '#e0e0e0',
                  bgcolor: isWeekend ? 'rgba(200, 220, 255, 0.2)' : '#ffffff',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: 2,
                  }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isExpanded ? 2 : 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <IconButton
                        size="small"
                        onClick={toggleExpand}
                        sx={{ 
                          mr: 0.5,
                          color: '#666',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)',
                            color: '#333'
                          }
                        }}
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', color: '#333' }}>
                        {day}日 ({dow})
                      </Typography>
                      {hasShifts && !status && (
                        <Chip 
                          label={`${dateShifts.length}件`} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                      <FormControl size="small" sx={{ minWidth: 140 }}>
                        <InputLabel id={`status-label-${date}`} shrink sx={{ color: '#666' }}>ステータス</InputLabel>
                        <Select
                          labelId={`status-label-${date}`}
                          value={status || ''}
                          onChange={(e) => handleSetStatus(date, e.target.value || null)}
                          disabled={loading}
                          displayEmpty
                          label="ステータス"
                          sx={{ 
                            minWidth: 140,
                            color: '#333',
                            '& .MuiSelect-icon': {
                              color: '#666'
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#bdbdbd'
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#666'
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#1976d2'
                            }
                          }}
                          MenuProps={{
                            PaperProps: {
                              sx: {
                                bgcolor: '#ffffff',
                                '& .MuiMenuItem-root': {
                                  color: '#333',
                                  '&:hover': {
                                    bgcolor: 'rgba(0, 0, 0, 0.04)'
                                  }
                                }
                              }
                            }
                          }}
                        >
                          <MenuItem value="">なし</MenuItem>
                          {STATUS_OPTIONS.map(s => (
                            <MenuItem key={s} value={s}>{s}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {!status && (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={isEditing ? <ExpandLessIcon /> : <AddIcon />}
                          onClick={() => isEditing ? handleCancelEdit(date) : handleStartEdit(date)}
                          disabled={loading}
                        >
                          {isEditing ? 'キャンセル' : 'シフト追加'}
                        </Button>
                      )}
                    </Box>
                  </Box>

                  <Collapse in={isExpanded}>
                    <Box>
                  {status ? (
                    <Chip 
                      label={status} 
                      size="medium" 
                      color={status === '休業' ? 'error' : 'warning'}
                      sx={{ fontWeight: 'bold', color: '#fff' }}
                    />
                  ) : (
                    <>
                      {/* タイムライン表示 */}
                      {dateShifts.length > 0 && (
                        <Box sx={{ mb: 3, mt: 1 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: '#333' }}>
                            シフト表
                          </Typography>
                          <Box className="timeline-container" sx={{ position: 'relative', mt: 1.25, width: `${TIMELINE_WIDTH}px`, overflowX: 'auto', bgcolor: '#ffffff', p: 1, borderRadius: 1 }}>
                            <TimeAxis />
                            {[...new Set(dateShifts.map(s => s.car))].sort().map(carNum => (
                              <CarBlock
                                key={carNum}
                                carNum={carNum}
                                shifts={dateShifts}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}

                      {/* 新規シフト追加フォーム */}
                      <Collapse in={isEditing}>
                        <Box sx={{ mb: 2, p: 2, bgcolor: '#fafafa', borderRadius: 1 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 'bold', color: '#333' }}>
                            新規シフト追加
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={3}>
                              <FormControl fullWidth size="small">
                                <InputLabel sx={{ color: '#666' }}>車両</InputLabel>
                                <Select
                                  value={newShift.car}
                                  onChange={(e) => setNewShifts(prev => ({
                                    ...prev,
                                    [date]: { ...newShift, car: e.target.value }
                                  }))}
                                  label="車両"
                                  sx={{ 
                                    color: '#333',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#bdbdbd'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#666'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#1976d2'
                                    }
                                  }}
                                  MenuProps={{
                                    PaperProps: {
                                      sx: {
                                        bgcolor: '#ffffff',
                                        '& .MuiMenuItem-root': {
                                          color: '#333',
                                          '&:hover': {
                                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                                          }
                                        }
                                      }
                                    }
                                  }}
                                >
                                  {CAR_OPTIONS.map(car => (
                                    <MenuItem key={car} value={car}>{car}号車</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <FormControl fullWidth size="small">
                                <InputLabel sx={{ color: '#666' }}>役割</InputLabel>
                                <Select
                                  value={newShift.role}
                                  onChange={(e) => setNewShifts(prev => ({
                                    ...prev,
                                    [date]: { ...newShift, role: e.target.value }
                                  }))}
                                  label="役割"
                                  sx={{ 
                                    color: '#333',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#bdbdbd'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#666'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#1976d2'
                                    }
                                  }}
                                  MenuProps={{
                                    PaperProps: {
                                      sx: {
                                        bgcolor: '#ffffff',
                                        '& .MuiMenuItem-root': {
                                          color: '#333',
                                          '&:hover': {
                                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                                          }
                                        }
                                      }
                                    }
                                  }}
                                >
                                  {ROLE_OPTIONS.map(role => (
                                    <MenuItem key={role} value={role}>{role}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <FormControl fullWidth size="small">
                                <InputLabel sx={{ color: '#666' }}>スタッフ</InputLabel>
                                <Select
                                  value={newShift.staff}
                                  onChange={(e) => setNewShifts(prev => ({
                                    ...prev,
                                    [date]: { ...newShift, staff: e.target.value }
                                  }))}
                                  label="スタッフ"
                                  sx={{ 
                                    color: '#333',
                                    '& .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#bdbdbd'
                                    },
                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#666'
                                    },
                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                      borderColor: '#1976d2'
                                    }
                                  }}
                                  MenuProps={{
                                    PaperProps: {
                                      sx: {
                                        bgcolor: '#ffffff',
                                        '& .MuiMenuItem-root': {
                                          color: '#333',
                                          '&:hover': {
                                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                                          }
                                        }
                                      }
                                    }
                                  }}
                                >
                                  {STAFF_OPTIONS.map(staff => (
                                    <MenuItem key={staff} value={staff}>{staff}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={6} sm={3} md={1.5}>
                              <TextField
                                label="開始"
                                type="time"
                                value={newShift.start}
                                onChange={(e) => setNewShifts(prev => ({
                                  ...prev,
                                  [date]: { ...newShift, start: e.target.value }
                                }))}
                                size="small"
                                fullWidth
                                InputLabelProps={{ shrink: true, sx: { color: '#666' } }}
                                sx={{
                                  '& .MuiInputBase-input': {
                                    color: '#333'
                                  },
                                  '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#bdbdbd'
                                  },
                                  '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#666'
                                  },
                                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#1976d2'
                                  }
                                }}
                              />
                            </Grid>
                            <Grid item xs={6} sm={3} md={1.5}>
                              <TextField
                                label="終了"
                                type="time"
                                value={newShift.end}
                                onChange={(e) => setNewShifts(prev => ({
                                  ...prev,
                                  [date]: { ...newShift, end: e.target.value }
                                }))}
                                size="small"
                                fullWidth
                                InputLabelProps={{ shrink: true, sx: { color: '#666' } }}
                                sx={{
                                  '& .MuiInputBase-input': {
                                    color: '#333'
                                  },
                                  '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#bdbdbd'
                                  },
                                  '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#666'
                                  },
                                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#1976d2'
                                  }
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} md={12}>
                              <TextField
                                label="備考"
                                value={newShift.note}
                                onChange={(e) => setNewShifts(prev => ({
                                  ...prev,
                                  [date]: { ...newShift, note: e.target.value }
                                }))}
                                size="small"
                                fullWidth
                                multiline
                                rows={1}
                                placeholder="例: 無人回避"
                                InputLabelProps={{ sx: { color: '#666' } }}
                                sx={{
                                  '& .MuiInputBase-input': {
                                    color: '#333'
                                  },
                                  '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#bdbdbd'
                                  },
                                  '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#666'
                                  },
                                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: '#1976d2'
                                  }
                                }}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <Stack direction="row" spacing={1}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<ContentCopyIcon />}
                                  onClick={() => {
                                    setCopyTargetDate(date)
                                    setCopyDialogOpen(true)
                                  }}
                                  disabled={loading}
                                >
                                  他の日からコピー
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<SaveIcon />}
                                  onClick={() => handleAddShift(date)}
                                  disabled={loading}
                                >
                                  追加
                                </Button>
                              </Stack>
                            </Grid>
                          </Grid>
                        </Box>
                      </Collapse>

                      {/* 既存シフト一覧 */}
                      {dateShifts.length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold', color: '#333' }}>
                            設定済みシフト ({dateShifts.length}件)
                          </Typography>
                          <Stack spacing={1}>
                            {dateShifts.map((shift) => {
                              const isEditing = editingShiftIds[shift.id]
                              const editingShift = editingShifts[shift.id] || shift

                              return (
                                <Box key={shift.id}>
                                  {!isEditing ? (
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        p: 1.5,
                                        border: '1px solid',
                                        borderColor: '#e0e0e0',
                                        borderRadius: 1,
                                        bgcolor: '#fafafa',
                                      }}
                                    >
                                      <Box sx={{ flex: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 'medium', color: '#333' }}>
                                          <Chip 
                                            label={shift.car} 
                                            size="small" 
                                            sx={{ 
                                              mr: 1,
                                              bgcolor: '#e3f2fd',
                                              color: '#1976d2',
                                              border: '1px solid #90caf9'
                                            }} 
                                          />
                                          {shift.role} / {shift.staff} / {shift.start} - {shift.end}
                                          {shift.note && (
                                            <Chip 
                                              label={shift.note} 
                                              size="small" 
                                              variant="outlined"
                                              sx={{ 
                                                ml: 1, 
                                                borderColor: '#bdbdbd',
                                                color: '#666'
                                              }} 
                                            />
                                          )}
                                        </Typography>
                                      </Box>
                                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                                        <IconButton
                                          size="small"
                                          onClick={() => handleStartEditShift(shift)}
                                          disabled={loading}
                                          color="primary"
                                        >
                                          <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                          size="small"
                                          onClick={() => handleDeleteShift(shift.id, date)}
                                          disabled={loading}
                                          color="error"
                                        >
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      </Box>
                                    </Box>
                                  ) : (
                                    <Box
                                      sx={{
                                        p: 2,
                                        border: '1px solid',
                                        borderColor: '#1976d2',
                                        borderRadius: 1,
                                        bgcolor: '#fafafa',
                                      }}
                                    >
                                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 'bold', color: '#333' }}>
                                        シフト編集
                                      </Typography>
                                      <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6} md={3}>
                                          <FormControl fullWidth size="small">
                                            <InputLabel sx={{ color: '#666' }}>車両</InputLabel>
                                            <Select
                                              value={editingShift.car}
                                              onChange={(e) => setEditingShifts(prev => ({
                                                ...prev,
                                                [shift.id]: { ...editingShift, car: e.target.value }
                                              }))}
                                              label="車両"
                                              sx={{ 
                                                color: '#333',
                                                '& .MuiOutlinedInput-notchedOutline': {
                                                  borderColor: '#bdbdbd'
                                                },
                                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                                  borderColor: '#666'
                                                },
                                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                  borderColor: '#1976d2'
                                                }
                                              }}
                                              MenuProps={{
                                                PaperProps: {
                                                  sx: {
                                                    bgcolor: '#ffffff',
                                                    '& .MuiMenuItem-root': {
                                                      color: '#333',
                                                      '&:hover': {
                                                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                                                      }
                                                    }
                                                  }
                                                }
                                              }}
                                            >
                                              {CAR_OPTIONS.map(car => (
                                                <MenuItem key={car} value={car}>{car}号車</MenuItem>
                                              ))}
                                            </Select>
                                          </FormControl>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                          <FormControl fullWidth size="small">
                                            <InputLabel sx={{ color: '#666' }}>役割</InputLabel>
                                            <Select
                                              value={editingShift.role}
                                              onChange={(e) => setEditingShifts(prev => ({
                                                ...prev,
                                                [shift.id]: { ...editingShift, role: e.target.value }
                                              }))}
                                              label="役割"
                                              sx={{ 
                                                color: '#333',
                                                '& .MuiOutlinedInput-notchedOutline': {
                                                  borderColor: '#bdbdbd'
                                                },
                                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                                  borderColor: '#666'
                                                },
                                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                  borderColor: '#1976d2'
                                                }
                                              }}
                                              MenuProps={{
                                                PaperProps: {
                                                  sx: {
                                                    bgcolor: '#ffffff',
                                                    '& .MuiMenuItem-root': {
                                                      color: '#333',
                                                      '&:hover': {
                                                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                                                      }
                                                    }
                                                  }
                                                }
                                              }}
                                            >
                                              {ROLE_OPTIONS.map(role => (
                                                <MenuItem key={role} value={role}>{role}</MenuItem>
                                              ))}
                                            </Select>
                                          </FormControl>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                          <FormControl fullWidth size="small">
                                            <InputLabel sx={{ color: '#666' }}>スタッフ</InputLabel>
                                            <Select
                                              value={editingShift.staff}
                                              onChange={(e) => setEditingShifts(prev => ({
                                                ...prev,
                                                [shift.id]: { ...editingShift, staff: e.target.value }
                                              }))}
                                              label="スタッフ"
                                              sx={{ 
                                                color: '#333',
                                                '& .MuiOutlinedInput-notchedOutline': {
                                                  borderColor: '#bdbdbd'
                                                },
                                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                                  borderColor: '#666'
                                                },
                                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                  borderColor: '#1976d2'
                                                }
                                              }}
                                              MenuProps={{
                                                PaperProps: {
                                                  sx: {
                                                    bgcolor: '#ffffff',
                                                    '& .MuiMenuItem-root': {
                                                      color: '#333',
                                                      '&:hover': {
                                                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                                                      }
                                                    }
                                                  }
                                                }
                                              }}
                                            >
                                              {STAFF_OPTIONS.map(staff => (
                                                <MenuItem key={staff} value={staff}>{staff}</MenuItem>
                                              ))}
                                            </Select>
                                          </FormControl>
                                        </Grid>
                                        <Grid item xs={6} sm={3} md={1.5}>
                                          <TextField
                                            label="開始"
                                            type="time"
                                            value={editingShift.start}
                                            onChange={(e) => setEditingShifts(prev => ({
                                              ...prev,
                                              [shift.id]: { ...editingShift, start: e.target.value }
                                            }))}
                                            size="small"
                                            fullWidth
                                            InputLabelProps={{ shrink: true, sx: { color: '#666' } }}
                                            sx={{
                                              '& .MuiInputBase-input': {
                                                color: '#333'
                                              },
                                              '& .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#bdbdbd'
                                              },
                                              '&:hover .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#666'
                                              },
                                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#1976d2'
                                              }
                                            }}
                                          />
                                        </Grid>
                                        <Grid item xs={6} sm={3} md={1.5}>
                                          <TextField
                                            label="終了"
                                            type="time"
                                            value={editingShift.end}
                                            onChange={(e) => setEditingShifts(prev => ({
                                              ...prev,
                                              [shift.id]: { ...editingShift, end: e.target.value }
                                            }))}
                                            size="small"
                                            fullWidth
                                            InputLabelProps={{ shrink: true, sx: { color: '#666' } }}
                                            sx={{
                                              '& .MuiInputBase-input': {
                                                color: '#333'
                                              },
                                              '& .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#bdbdbd'
                                              },
                                              '&:hover .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#666'
                                              },
                                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#1976d2'
                                              }
                                            }}
                                          />
                                        </Grid>
                                        <Grid item xs={12} md={12}>
                                          <TextField
                                            label="備考"
                                            value={editingShift.note || ''}
                                            onChange={(e) => setEditingShifts(prev => ({
                                              ...prev,
                                              [shift.id]: { ...editingShift, note: e.target.value }
                                            }))}
                                            size="small"
                                            fullWidth
                                            multiline
                                            rows={1}
                                            placeholder="例: 無人回避"
                                            InputLabelProps={{ sx: { color: '#666' } }}
                                            sx={{
                                              '& .MuiInputBase-input': {
                                                color: '#333'
                                              },
                                              '& .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#bdbdbd'
                                              },
                                              '&:hover .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#666'
                                              },
                                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#1976d2'
                                              }
                                            }}
                                          />
                                        </Grid>
                                        <Grid item xs={12}>
                                          <Stack direction="row" spacing={1}>
                                            <Button
                                              size="small"
                                              onClick={() => handleCancelEditShift(shift.id)}
                                              disabled={loading}
                                            >
                                              キャンセル
                                            </Button>
                                            <Typography variant="caption" sx={{ alignSelf: 'center', ml: 'auto', color: '#666' }}>
                                              編集内容は「一括保存」ボタンで保存されます
                                            </Typography>
                                          </Stack>
                                        </Grid>
                                      </Grid>
                                    </Box>
                                  )}
                                </Box>
                              )
                            })}
                          </Stack>
                        </Box>
                      )}

                      {dateShifts.length === 0 && !isEditing && (
                        <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#666' }}>
                          シフトが設定されていません
                        </Typography>
                      )}
                    </>
                  )}
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            )
          })}
        </Stack>
      )}

      {/* コピー用ダイアログ */}
      <Dialog 
        open={copyDialogOpen} 
        onClose={() => setCopyDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#ffffff'
          }
        }}
      >
        <DialogTitle sx={{ color: '#333' }}>他の日からシフトをコピー</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: '#333' }}>
            コピー元の日付を選択してください
          </Typography>
          <FormControl fullWidth>
            <InputLabel sx={{ color: '#666' }}>日付を選択</InputLabel>
            <Select
              value=""
              onChange={(e) => handleCopyFromDate(e.target.value)}
              label="日付を選択"
              sx={{ 
                color: '#333',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#bdbdbd'
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#666'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#1976d2'
                }
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    maxHeight: 400,
                    bgcolor: '#ffffff',
                    '& .MuiMenuItem-root': {
                      color: '#333',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                      }
                    }
                  }
                },
              }}
            >
              {days
                .filter(({ date }) => date !== copyTargetDate)
                .map(({ date, day, dow }) => {
                  const dateShifts = getShiftsForDate(date)
                  return (
                    <MenuItem key={date} value={date}>
                      <Box sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: dateShifts.length > 0 ? 0.5 : 0 }}>
                          <Typography variant="body1" sx={{ fontWeight: 'medium', color: '#333' }}>
                            {day}日 ({dow})
                          </Typography>
                          {dateShifts.length > 0 && (
                            <Chip 
                              label={`${dateShifts.length}件`} 
                              size="small" 
                              color="primary"
                              variant="outlined"
                            />
                          )}
                        </Box>
                        {dateShifts.length > 0 ? (
                          <Box sx={{ mt: 0.5 }}>
                            {dateShifts.map((shift, index) => (
                              <Typography 
                                key={shift.id || index} 
                                variant="caption" 
                                sx={{ display: 'block', fontSize: '0.75rem', color: '#666' }}
                              >
                                {shift.staff} / {shift.start} - {shift.end}
                              </Typography>
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#666' }}>
                            シフト未設定
                          </Typography>
                        )}
                      </Box>
                    </MenuItem>
                  )
                })}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyDialogOpen(false)}>キャンセル</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

