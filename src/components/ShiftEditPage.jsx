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

const CAR_OPTIONS = ['1', '2']
const ROLE_OPTIONS = ['代行', '随伴']
const STAFF_OPTIONS = ['西村', '鈴木', 'チョロモン', 'たかし', 'なみ', 'しゅうや']
const STATUS_OPTIONS = ['休業', '定休日']
const DOW_MAP = ['日', '月', '火', '水', '木', '金', '土']

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

export function ShiftEditPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const year = parseInt(searchParams.get('year') || '2026')
  const month = parseInt(searchParams.get('month') || '1')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [shifts, setShifts] = useState([])
  const [editingDates, setEditingDates] = useState({}) // 日付ごとの編集状態
  const [newShifts, setNewShifts] = useState({}) // 日付ごとの新規シフトデータ
  const [editingShiftIds, setEditingShiftIds] = useState({}) // 編集中のシフトID
  const [editingShifts, setEditingShifts] = useState({}) // 編集中のシフトデータ
  const [statuses, setStatuses] = useState({}) // 日付ごとのステータス
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

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const dateObj = new Date(date)
      const dow = DOW_MAP[dateObj.getDay()]
      
      const { error: updateError } = await updateShift(shiftId, {
        car: shiftData.car,
        role: shiftData.role,
        staff: shiftData.staff,
        start: shiftData.start,
        end: shiftData.end,
        note: shiftData.note || null,
        dow,
      })

      if (updateError) {
        setError(`シフトの更新に失敗: ${updateError.message}`)
      } else {
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
        await loadShifts()
        setSuccess('シフトを更新しました')
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
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

  return (
    <Box sx={{ p: 3, maxWidth: '1400px', mx: 'auto' }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/shift')} sx={{ mr: 1 }}>
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
            >
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="h4" component="h1" sx={{ minWidth: '200px', textAlign: 'center' }}>
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
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
        </Box>
        <Button
          variant="outlined"
          onClick={loadShifts}
          disabled={loading}
        >
          再読み込み
        </Button>
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
                  borderColor: isWeekend ? 'primary.main' : 'divider',
                  bgcolor: isWeekend ? 'action.hover' : 'background.paper',
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
                        sx={{ mr: 0.5 }}
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
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
                        <InputLabel id={`status-label-${date}`} shrink>ステータス</InputLabel>
                        <Select
                          labelId={`status-label-${date}`}
                          value={status || ''}
                          onChange={(e) => handleSetStatus(date, e.target.value || null)}
                          disabled={loading}
                          displayEmpty
                          label="ステータス"
                          sx={{ minWidth: 140 }}
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
                      sx={{ fontWeight: 'bold' }}
                    />
                  ) : (
                    <>
                      {/* 新規シフト追加フォーム */}
                      <Collapse in={isEditing}>
                        <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 'bold' }}>
                            新規シフト追加
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={3}>
                              <FormControl fullWidth size="small">
                                <InputLabel>車両</InputLabel>
                                <Select
                                  value={newShift.car}
                                  onChange={(e) => setNewShifts(prev => ({
                                    ...prev,
                                    [date]: { ...newShift, car: e.target.value }
                                  }))}
                                  label="車両"
                                >
                                  {CAR_OPTIONS.map(car => (
                                    <MenuItem key={car} value={car}>{car}号車</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <FormControl fullWidth size="small">
                                <InputLabel>役割</InputLabel>
                                <Select
                                  value={newShift.role}
                                  onChange={(e) => setNewShifts(prev => ({
                                    ...prev,
                                    [date]: { ...newShift, role: e.target.value }
                                  }))}
                                  label="役割"
                                >
                                  {ROLE_OPTIONS.map(role => (
                                    <MenuItem key={role} value={role}>{role}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                              <FormControl fullWidth size="small">
                                <InputLabel>スタッフ</InputLabel>
                                <Select
                                  value={newShift.staff}
                                  onChange={(e) => setNewShifts(prev => ({
                                    ...prev,
                                    [date]: { ...newShift, staff: e.target.value }
                                  }))}
                                  label="スタッフ"
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
                                InputLabelProps={{ shrink: true }}
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
                                InputLabelProps={{ shrink: true }}
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
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={<SaveIcon />}
                                onClick={() => handleAddShift(date)}
                                disabled={loading}
                              >
                                追加
                              </Button>
                            </Grid>
                          </Grid>
                        </Box>
                      </Collapse>

                      {/* 既存シフト一覧 */}
                      {dateShifts.length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
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
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        bgcolor: 'background.default',
                                      }}
                                    >
                                      <Box sx={{ flex: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                          <Chip label={shift.car} size="small" sx={{ mr: 1 }} />
                                          {shift.role} / {shift.staff} / {shift.start} - {shift.end}
                                          {shift.note && (
                                            <Chip label={shift.note} size="small" sx={{ ml: 1 }} variant="outlined" />
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
                                        borderColor: 'primary.main',
                                        borderRadius: 1,
                                        bgcolor: 'background.default',
                                      }}
                                    >
                                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 'bold' }}>
                                        シフト編集
                                      </Typography>
                                      <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6} md={3}>
                                          <FormControl fullWidth size="small">
                                            <InputLabel>車両</InputLabel>
                                            <Select
                                              value={editingShift.car}
                                              onChange={(e) => setEditingShifts(prev => ({
                                                ...prev,
                                                [shift.id]: { ...editingShift, car: e.target.value }
                                              }))}
                                              label="車両"
                                            >
                                              {CAR_OPTIONS.map(car => (
                                                <MenuItem key={car} value={car}>{car}号車</MenuItem>
                                              ))}
                                            </Select>
                                          </FormControl>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                          <FormControl fullWidth size="small">
                                            <InputLabel>役割</InputLabel>
                                            <Select
                                              value={editingShift.role}
                                              onChange={(e) => setEditingShifts(prev => ({
                                                ...prev,
                                                [shift.id]: { ...editingShift, role: e.target.value }
                                              }))}
                                              label="役割"
                                            >
                                              {ROLE_OPTIONS.map(role => (
                                                <MenuItem key={role} value={role}>{role}</MenuItem>
                                              ))}
                                            </Select>
                                          </FormControl>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                          <FormControl fullWidth size="small">
                                            <InputLabel>スタッフ</InputLabel>
                                            <Select
                                              value={editingShift.staff}
                                              onChange={(e) => setEditingShifts(prev => ({
                                                ...prev,
                                                [shift.id]: { ...editingShift, staff: e.target.value }
                                              }))}
                                              label="スタッフ"
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
                                            InputLabelProps={{ shrink: true }}
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
                                            InputLabelProps={{ shrink: true }}
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
                                          />
                                        </Grid>
                                        <Grid item xs={12}>
                                          <Stack direction="row" spacing={1}>
                                            <Button
                                              size="small"
                                              variant="contained"
                                              startIcon={<SaveIcon />}
                                              onClick={() => handleUpdateShift(shift.id, date)}
                                              disabled={loading}
                                            >
                                              保存
                                            </Button>
                                            <Button
                                              size="small"
                                              onClick={() => handleCancelEditShift(shift.id)}
                                              disabled={loading}
                                            >
                                              キャンセル
                                            </Button>
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
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
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
    </Box>
  )
}

