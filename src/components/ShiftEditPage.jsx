import { useNavigate, useSearchParams } from 'react-router-dom'
import { useShiftEditPage } from '@/hooks/useShiftEditPage'
import {
  CAR_OPTIONS,
  ROLE_OPTIONS,
  STATUS_OPTIONS,
  TIMELINE_WIDTH,
  getDefaultShiftEditYearMonth,
} from '@/lib/shiftEditUtils'
import { TimeAxis, CarBlock } from './ShiftEditPage/Timeline'
import { CopyShiftDialog } from './ShiftEditPage/CopyShiftDialog'
import { BulkCopyShiftDialog } from './ShiftEditPage/BulkCopyShiftDialog'
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
import Checkbox from '@mui/material/Checkbox'
import './ShiftEditPage.css'

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
    staffOptions,
    getShiftsForDate,
    refetchShifts,
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
    handleUpdateShift,
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

  return (
    <Box
      sx={{
        p: 3,
        maxWidth: '1400px',
        mx: 'auto',
        bgcolor: '#f5f5f5',
        minHeight: '100vh',
      }}
    >
      {/* ヘッダー */}
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            onClick={() => navigate('/shift')}
            sx={{
              mr: 1,
              color: '#666',
              '&:hover': {
                bgcolor: 'rgba(0, 0, 0, 0.04)',
                color: '#333',
              },
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
                  color: '#333',
                },
                '&.Mui-disabled': {
                  color: '#bdbdbd',
                },
              }}
            >
              <ChevronLeftIcon />
            </IconButton>
            <Typography
              variant="h4"
              component="h1"
              sx={{ minWidth: '200px', textAlign: 'center', color: '#333' }}
            >
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
                  color: '#333',
                },
                '&.Mui-disabled': {
                  color: '#bdbdbd',
                },
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
          <Button variant="outlined" onClick={() => refetchShifts()} disabled={loading}>
            再読み込み
          </Button>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<ContentCopyIcon />}
            onClick={() => {
              setBulkCopySourceDate('')
              setBulkCopyDialogOpen(true)
            }}
            disabled={loading || selectedCopyDestCount === 0}
          >
            一括コピー{selectedCopyDestCount > 0 ? `（${selectedCopyDestCount}日）` : ''}
          </Button>
        </Box>
      </Box>

      {/* エラー・成功メッセージ */}
      {fetchError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          シフトデータの取得に失敗: {fetchError.message}
        </Alert>
      )}
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
              setExpandedDates((prev) => ({ ...prev, [date]: !(prev[date] !== false) }))
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
                  },
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: isExpanded ? 2 : 0,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <Checkbox
                        size="small"
                        checked={!!copyDestDates[date]}
                        onChange={() =>
                          setCopyDestDates((prev) => ({
                            ...prev,
                            [date]: !prev[date],
                          }))
                        }
                        disabled={loading}
                        title="一括コピーのコピー先に含める"
                        inputProps={{ 'aria-label': `${day}日を一括コピーのコピー先に含める` }}
                        sx={{
                          p: 0.5,
                          mr: 0.25,
                          bgcolor: '#fff',
                          border: '1px solid #9e9e9e',
                          borderRadius: '4px',
                          color: '#424242',
                          '&.Mui-checked': {
                            color: '#1565c0',
                            bgcolor: '#e3f2fd',
                            borderColor: '#1565c0',
                          },
                          '&.Mui-disabled': {
                            borderColor: '#e0e0e0',
                            bgcolor: '#f5f5f5',
                          },
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={toggleExpand}
                        sx={{
                          mr: 0.5,
                          color: '#666',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)',
                            color: '#333',
                          },
                        }}
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                      <Typography
                        variant="h6"
                        component="div"
                        sx={{ fontWeight: 'bold', color: '#333' }}
                      >
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
                        <InputLabel id={`status-label-${date}`} shrink sx={{ color: '#666' }}>
                          ステータス
                        </InputLabel>
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
                              color: '#666',
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#bdbdbd',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#666',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#1976d2',
                            },
                          }}
                          MenuProps={{
                            PaperProps: {
                              sx: {
                                bgcolor: '#ffffff',
                                '& .MuiMenuItem-root': {
                                  color: '#333',
                                  '&:hover': {
                                    bgcolor: 'rgba(0, 0, 0, 0.04)',
                                  },
                                },
                              },
                            },
                          }}
                        >
                          <MenuItem value="">なし</MenuItem>
                          {STATUS_OPTIONS.map((s) => (
                            <MenuItem key={s} value={s}>
                              {s}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {!status && (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={isEditing ? <ExpandLessIcon /> : <AddIcon />}
                          onClick={() =>
                            isEditing ? handleCancelEdit(date) : handleStartEdit(date)
                          }
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
                              <Typography
                                variant="subtitle2"
                                sx={{ mb: 1, fontWeight: 'bold', color: '#333' }}
                              >
                                シフト表
                              </Typography>
                              <Box
                                className="timeline-container"
                                sx={{
                                  position: 'relative',
                                  mt: 1.25,
                                  width: `${TIMELINE_WIDTH}px`,
                                  overflowX: 'auto',
                                  bgcolor: '#ffffff',
                                  p: 1,
                                  borderRadius: 1,
                                }}
                              >
                                <TimeAxis />
                                {[...new Set(dateShifts.map((s) => s.car))].sort().map((carNum) => (
                                  <CarBlock
                                    key={carNum}
                                    carNum={carNum}
                                    shifts={dateShifts}
                                    staffColorByName={staffColorByName}
                                  />
                                ))}
                              </Box>
                            </Box>
                          )}

                          {/* 新規シフト追加フォーム */}
                          <Collapse in={isEditing}>
                            <Box sx={{ mb: 2, p: 2, bgcolor: '#fafafa', borderRadius: 1 }}>
                              <Typography
                                variant="subtitle2"
                                sx={{ mb: 1.5, fontWeight: 'bold', color: '#333' }}
                              >
                                新規シフト追加
                              </Typography>
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={6} md={3}>
                                  <FormControl fullWidth size="small">
                                    <InputLabel sx={{ color: '#666' }}>車両</InputLabel>
                                    <Select
                                      value={newShift.car}
                                      onChange={(e) =>
                                        setNewShifts((prev) => ({
                                          ...prev,
                                          [date]: { ...newShift, car: e.target.value },
                                        }))
                                      }
                                      label="車両"
                                      sx={{
                                        color: '#333',
                                        '& .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#bdbdbd',
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#666',
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#1976d2',
                                        },
                                      }}
                                      MenuProps={{
                                        PaperProps: {
                                          sx: {
                                            bgcolor: '#ffffff',
                                            '& .MuiMenuItem-root': {
                                              color: '#333',
                                              '&:hover': {
                                                bgcolor: 'rgba(0, 0, 0, 0.04)',
                                              },
                                            },
                                          },
                                        },
                                      }}
                                    >
                                      {CAR_OPTIONS.map((car) => (
                                        <MenuItem key={car} value={car}>
                                          {car}号車
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                  <FormControl fullWidth size="small">
                                    <InputLabel sx={{ color: '#666' }}>役割</InputLabel>
                                    <Select
                                      value={newShift.role}
                                      onChange={(e) =>
                                        setNewShifts((prev) => ({
                                          ...prev,
                                          [date]: { ...newShift, role: e.target.value },
                                        }))
                                      }
                                      label="役割"
                                      sx={{
                                        color: '#333',
                                        '& .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#bdbdbd',
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#666',
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#1976d2',
                                        },
                                      }}
                                      MenuProps={{
                                        PaperProps: {
                                          sx: {
                                            bgcolor: '#ffffff',
                                            '& .MuiMenuItem-root': {
                                              color: '#333',
                                              '&:hover': {
                                                bgcolor: 'rgba(0, 0, 0, 0.04)',
                                              },
                                            },
                                          },
                                        },
                                      }}
                                    >
                                      {ROLE_OPTIONS.map((role) => (
                                        <MenuItem key={role} value={role}>
                                          {role}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                  <FormControl fullWidth size="small">
                                    <InputLabel sx={{ color: '#666' }}>スタッフ</InputLabel>
                                    <Select
                                      value={newShift.staff}
                                      onChange={(e) =>
                                        setNewShifts((prev) => ({
                                          ...prev,
                                          [date]: { ...newShift, staff: e.target.value },
                                        }))
                                      }
                                      label="スタッフ"
                                      sx={{
                                        color: '#333',
                                        '& .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#bdbdbd',
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#666',
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                          borderColor: '#1976d2',
                                        },
                                      }}
                                      MenuProps={{
                                        PaperProps: {
                                          sx: {
                                            bgcolor: '#ffffff',
                                            '& .MuiMenuItem-root': {
                                              color: '#333',
                                              '&:hover': {
                                                bgcolor: 'rgba(0, 0, 0, 0.04)',
                                              },
                                            },
                                          },
                                        },
                                      }}
                                    >
                                      {staffOptions.map((staff) => (
                                        <MenuItem key={staff} value={staff}>
                                          {staff}
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </Grid>
                                <Grid item xs={6} sm={3} md={1.5}>
                                  <TextField
                                    label="開始"
                                    type="time"
                                    value={newShift.start}
                                    onChange={(e) =>
                                      setNewShifts((prev) => ({
                                        ...prev,
                                        [date]: { ...newShift, start: e.target.value },
                                      }))
                                    }
                                    size="small"
                                    fullWidth
                                    InputLabelProps={{ shrink: true, sx: { color: '#666' } }}
                                    sx={{
                                      '& .MuiInputBase-input': {
                                        color: '#333',
                                      },
                                      '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#bdbdbd',
                                      },
                                      '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#666',
                                      },
                                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#1976d2',
                                      },
                                    }}
                                  />
                                </Grid>
                                <Grid item xs={6} sm={3} md={1.5}>
                                  <TextField
                                    label="終了"
                                    type="time"
                                    value={newShift.end}
                                    onChange={(e) =>
                                      setNewShifts((prev) => ({
                                        ...prev,
                                        [date]: { ...newShift, end: e.target.value },
                                      }))
                                    }
                                    size="small"
                                    fullWidth
                                    InputLabelProps={{ shrink: true, sx: { color: '#666' } }}
                                    sx={{
                                      '& .MuiInputBase-input': {
                                        color: '#333',
                                      },
                                      '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#bdbdbd',
                                      },
                                      '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#666',
                                      },
                                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#1976d2',
                                      },
                                    }}
                                  />
                                </Grid>
                                <Grid item xs={12} md={12}>
                                  <TextField
                                    label="備考"
                                    value={newShift.note}
                                    onChange={(e) =>
                                      setNewShifts((prev) => ({
                                        ...prev,
                                        [date]: { ...newShift, note: e.target.value },
                                      }))
                                    }
                                    size="small"
                                    fullWidth
                                    multiline
                                    rows={1}
                                    placeholder="例: 無人回避"
                                    InputLabelProps={{ sx: { color: '#666' } }}
                                    sx={{
                                      '& .MuiInputBase-input': {
                                        color: '#333',
                                      },
                                      '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#bdbdbd',
                                      },
                                      '&:hover .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#666',
                                      },
                                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#1976d2',
                                      },
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
                              <Typography
                                variant="subtitle2"
                                sx={{ mb: 1, fontWeight: 'bold', color: '#333' }}
                              >
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
                                            <Typography
                                              variant="body2"
                                              sx={{ fontWeight: 'medium', color: '#333' }}
                                            >
                                              <Chip
                                                label={shift.car}
                                                size="small"
                                                sx={{
                                                  mr: 1,
                                                  bgcolor: '#e3f2fd',
                                                  color: '#1976d2',
                                                  border: '1px solid #90caf9',
                                                }}
                                              />
                                              {shift.role} / {shift.staff} / {shift.start} -{' '}
                                              {shift.end}
                                              {shift.note && (
                                                <Chip
                                                  label={shift.note}
                                                  size="small"
                                                  variant="outlined"
                                                  sx={{
                                                    ml: 1,
                                                    borderColor: '#bdbdbd',
                                                    color: '#666',
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
                                          <Typography
                                            variant="subtitle2"
                                            sx={{ mb: 1.5, fontWeight: 'bold', color: '#333' }}
                                          >
                                            シフト編集
                                          </Typography>
                                          <Grid container spacing={2}>
                                            <Grid item xs={12} sm={6} md={3}>
                                              <FormControl fullWidth size="small">
                                                <InputLabel sx={{ color: '#666' }}>車両</InputLabel>
                                                <Select
                                                  value={editingShift.car}
                                                  onChange={(e) =>
                                                    setEditingShifts((prev) => ({
                                                      ...prev,
                                                      [shift.id]: {
                                                        ...editingShift,
                                                        car: e.target.value,
                                                      },
                                                    }))
                                                  }
                                                  label="車両"
                                                  sx={{
                                                    color: '#333',
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                      borderColor: '#bdbdbd',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                      borderColor: '#666',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline':
                                                      {
                                                        borderColor: '#1976d2',
                                                      },
                                                  }}
                                                  MenuProps={{
                                                    PaperProps: {
                                                      sx: {
                                                        bgcolor: '#ffffff',
                                                        '& .MuiMenuItem-root': {
                                                          color: '#333',
                                                          '&:hover': {
                                                            bgcolor: 'rgba(0, 0, 0, 0.04)',
                                                          },
                                                        },
                                                      },
                                                    },
                                                  }}
                                                >
                                                  {CAR_OPTIONS.map((car) => (
                                                    <MenuItem key={car} value={car}>
                                                      {car}号車
                                                    </MenuItem>
                                                  ))}
                                                </Select>
                                              </FormControl>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                              <FormControl fullWidth size="small">
                                                <InputLabel sx={{ color: '#666' }}>役割</InputLabel>
                                                <Select
                                                  value={editingShift.role}
                                                  onChange={(e) =>
                                                    setEditingShifts((prev) => ({
                                                      ...prev,
                                                      [shift.id]: {
                                                        ...editingShift,
                                                        role: e.target.value,
                                                      },
                                                    }))
                                                  }
                                                  label="役割"
                                                  sx={{
                                                    color: '#333',
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                      borderColor: '#bdbdbd',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                      borderColor: '#666',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline':
                                                      {
                                                        borderColor: '#1976d2',
                                                      },
                                                  }}
                                                  MenuProps={{
                                                    PaperProps: {
                                                      sx: {
                                                        bgcolor: '#ffffff',
                                                        '& .MuiMenuItem-root': {
                                                          color: '#333',
                                                          '&:hover': {
                                                            bgcolor: 'rgba(0, 0, 0, 0.04)',
                                                          },
                                                        },
                                                      },
                                                    },
                                                  }}
                                                >
                                                  {ROLE_OPTIONS.map((role) => (
                                                    <MenuItem key={role} value={role}>
                                                      {role}
                                                    </MenuItem>
                                                  ))}
                                                </Select>
                                              </FormControl>
                                            </Grid>
                                            <Grid item xs={12} sm={6} md={3}>
                                              <FormControl fullWidth size="small">
                                                <InputLabel sx={{ color: '#666' }}>
                                                  スタッフ
                                                </InputLabel>
                                                <Select
                                                  value={editingShift.staff}
                                                  onChange={(e) =>
                                                    setEditingShifts((prev) => ({
                                                      ...prev,
                                                      [shift.id]: {
                                                        ...editingShift,
                                                        staff: e.target.value,
                                                      },
                                                    }))
                                                  }
                                                  label="スタッフ"
                                                  sx={{
                                                    color: '#333',
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                      borderColor: '#bdbdbd',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                      borderColor: '#666',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline':
                                                      {
                                                        borderColor: '#1976d2',
                                                      },
                                                  }}
                                                  MenuProps={{
                                                    PaperProps: {
                                                      sx: {
                                                        bgcolor: '#ffffff',
                                                        '& .MuiMenuItem-root': {
                                                          color: '#333',
                                                          '&:hover': {
                                                            bgcolor: 'rgba(0, 0, 0, 0.04)',
                                                          },
                                                        },
                                                      },
                                                    },
                                                  }}
                                                >
                                                  {staffOptions.map((staff) => (
                                                    <MenuItem key={staff} value={staff}>
                                                      {staff}
                                                    </MenuItem>
                                                  ))}
                                                </Select>
                                              </FormControl>
                                            </Grid>
                                            <Grid item xs={6} sm={3} md={1.5}>
                                              <TextField
                                                label="開始"
                                                type="time"
                                                value={editingShift.start}
                                                onChange={(e) =>
                                                  setEditingShifts((prev) => ({
                                                    ...prev,
                                                    [shift.id]: {
                                                      ...editingShift,
                                                      start: e.target.value,
                                                    },
                                                  }))
                                                }
                                                size="small"
                                                fullWidth
                                                InputLabelProps={{
                                                  shrink: true,
                                                  sx: { color: '#666' },
                                                }}
                                                sx={{
                                                  '& .MuiInputBase-input': {
                                                    color: '#333',
                                                  },
                                                  '& .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#bdbdbd',
                                                  },
                                                  '&:hover .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#666',
                                                  },
                                                  '&.Mui-focused .MuiOutlinedInput-notchedOutline':
                                                    {
                                                      borderColor: '#1976d2',
                                                    },
                                                }}
                                              />
                                            </Grid>
                                            <Grid item xs={6} sm={3} md={1.5}>
                                              <TextField
                                                label="終了"
                                                type="time"
                                                value={editingShift.end}
                                                onChange={(e) =>
                                                  setEditingShifts((prev) => ({
                                                    ...prev,
                                                    [shift.id]: {
                                                      ...editingShift,
                                                      end: e.target.value,
                                                    },
                                                  }))
                                                }
                                                size="small"
                                                fullWidth
                                                InputLabelProps={{
                                                  shrink: true,
                                                  sx: { color: '#666' },
                                                }}
                                                sx={{
                                                  '& .MuiInputBase-input': {
                                                    color: '#333',
                                                  },
                                                  '& .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#bdbdbd',
                                                  },
                                                  '&:hover .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#666',
                                                  },
                                                  '&.Mui-focused .MuiOutlinedInput-notchedOutline':
                                                    {
                                                      borderColor: '#1976d2',
                                                    },
                                                }}
                                              />
                                            </Grid>
                                            <Grid item xs={12} md={12}>
                                              <TextField
                                                label="備考"
                                                value={editingShift.note || ''}
                                                onChange={(e) =>
                                                  setEditingShifts((prev) => ({
                                                    ...prev,
                                                    [shift.id]: {
                                                      ...editingShift,
                                                      note: e.target.value,
                                                    },
                                                  }))
                                                }
                                                size="small"
                                                fullWidth
                                                multiline
                                                rows={1}
                                                placeholder="例: 無人回避"
                                                InputLabelProps={{ sx: { color: '#666' } }}
                                                sx={{
                                                  '& .MuiInputBase-input': {
                                                    color: '#333',
                                                  },
                                                  '& .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#bdbdbd',
                                                  },
                                                  '&:hover .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: '#666',
                                                  },
                                                  '&.Mui-focused .MuiOutlinedInput-notchedOutline':
                                                    {
                                                      borderColor: '#1976d2',
                                                    },
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
                                                <Typography
                                                  variant="caption"
                                                  sx={{
                                                    alignSelf: 'center',
                                                    ml: 'auto',
                                                    color: '#666',
                                                  }}
                                                >
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
    </Box>
  )
}
