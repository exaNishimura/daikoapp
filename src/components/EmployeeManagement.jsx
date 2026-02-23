import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getEmployees, createEmployee, updateEmployee, deleteEmployee } from '@/services/employeeService'
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
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Cancel'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Chip from '@mui/material/Chip'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'

const LICENSE_TYPES = ['一種', '二種']
const DEFAULT_COLORS = [
  { name: 'オレンジ', value: '#FFA500' },
  { name: '黄', value: '#FFD700' },
  { name: '紫', value: '#8A2BE2' },
  { name: '水色', value: '#00BFFF' },
  { name: 'ピンク', value: '#FF69B4' },
  { name: '緑', value: '#32CD32' },
  { name: '赤', value: '#FF0000' },
  { name: '青', value: '#0000FF' },
  { name: '茶', value: '#A52A2A' },
  { name: 'グレー', value: '#808080' },
]

export function EmployeeManagement() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [employees, setEmployees] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    license_type: '一種',
    color: '#FFA500',
    hourly_wage: 0,
    is_active: true,
    sort_order: 0,
  })

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { data, error: fetchError } = await getEmployees()

      if (fetchError) {
        setError(`従業員データの取得に失敗: ${fetchError.message}`)
        setEmployees([])
      } else {
        setEmployees(data || [])
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (employee = null) => {
    if (employee) {
      setEditingId(employee.id)
      setFormData({
        name: employee.name,
        license_type: employee.license_type,
        color: employee.color,
        hourly_wage: employee.hourly_wage || 0,
        is_active: employee.is_active !== false,
        sort_order: employee.sort_order || 0,
      })
    } else {
      setEditingId(null)
      setFormData({
        name: '',
        license_type: '一種',
        color: '#FFA500',
        hourly_wage: 0,
        is_active: true,
        sort_order: employees.length,
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingId(null)
    setFormData({
      name: '',
      license_type: '一種',
      color: '#FFA500',
      hourly_wage: 0,
      is_active: true,
      sort_order: 0,
    })
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('名前は必須です')
      return
    }

    if (!formData.color) {
      setError('色は必須です')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const employeeData = {
        name: formData.name.trim(),
        license_type: formData.license_type,
        color: formData.color,
        hourly_wage: parseFloat(formData.hourly_wage) || 0,
        is_active: formData.is_active,
        sort_order: formData.sort_order || 0,
      }

      if (editingId) {
        const { error: updateError } = await updateEmployee(editingId, employeeData)
        if (updateError) {
          setError(`更新に失敗: ${updateError.message}`)
        } else {
          setSuccess('従業員を更新しました')
          handleCloseDialog()
          await loadEmployees()
        }
      } else {
        const { error: createError } = await createEmployee(employeeData)
        if (createError) {
          setError(`作成に失敗: ${createError.message}`)
        } else {
          setSuccess('従業員を作成しました')
          handleCloseDialog()
          await loadEmployees()
        }
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`「${name}」を削除しますか？`)) {
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const { error: deleteError } = await deleteEmployee(id)

      if (deleteError) {
        setError(`削除に失敗: ${deleteError.message}`)
      } else {
        setSuccess('従業員を削除しました')
        await loadEmployees()
      }
    } catch (err) {
      setError(`エラーが発生しました: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: '1200px', mx: 'auto' }}>
      {/* ヘッダー */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/shift')} sx={{ mr: 1 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            従業員管理
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={loading}
        >
          新規追加
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

      {/* 従業員一覧 */}
      {loading && !employees.length && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography>読み込み中...</Typography>
        </Box>
      )}

      {!loading && employees.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>名前</TableCell>
                <TableCell>免許種別</TableCell>
                <TableCell>色</TableCell>
                <TableCell align="right">時給</TableCell>
                <TableCell>状態</TableCell>
                <TableCell align="right">並び順</TableCell>
                <TableCell align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {employee.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={employee.license_type}
                      size="small"
                      color={employee.license_type === '一種' ? 'primary' : 'secondary'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: 1,
                          backgroundColor: employee.color,
                          border: '1px solid rgba(0, 0, 0, 0.2)',
                        }}
                      />
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {employee.color}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      ¥{Number(employee.hourly_wage || 0).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={employee.is_active ? '有効' : '無効'}
                      size="small"
                      color={employee.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{employee.sort_order || 0}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(employee)}
                      disabled={loading}
                      color="primary"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(employee.id, employee.name)}
                      disabled={loading}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && employees.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            従業員が登録されていません
          </Typography>
        </Box>
      )}

      {/* 編集ダイアログ */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingId ? '従業員編集' : '新規従業員追加'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="名前"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              disabled={loading}
            />
            <FormControl fullWidth required>
              <InputLabel>免許種別</InputLabel>
              <Select
                value={formData.license_type}
                onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                label="免許種別"
                disabled={loading}
              >
                {LICENSE_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth required>
              <InputLabel>色</InputLabel>
              <Select
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                label="色"
                disabled={loading}
              >
                {DEFAULT_COLORS.map((color) => (
                  <MenuItem key={color.value} value={color.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: 0.5,
                          backgroundColor: color.value,
                          border: '1px solid rgba(0, 0, 0, 0.2)',
                        }}
                      />
                      {color.name} ({color.value})
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="時給"
              type="number"
              value={formData.hourly_wage}
              onChange={(e) => setFormData({ ...formData, hourly_wage: e.target.value })}
              fullWidth
              inputProps={{ min: 0, step: 100 }}
              disabled={loading}
              helperText="円単位で入力してください"
            />
            <TextField
              label="並び順"
              type="number"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              fullWidth
              inputProps={{ min: 0 }}
              disabled={loading}
              helperText="数値が小さいほど上に表示されます"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  disabled={loading}
                />
              }
              label="有効"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading} startIcon={<CancelIcon />}>
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={loading}
            startIcon={<SaveIcon />}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
