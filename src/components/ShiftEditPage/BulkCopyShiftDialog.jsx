import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

const selectSx = {
  color: '#333',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#bdbdbd' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#666' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1976d2' },
}
const menuPaperSx = {
  PaperProps: {
    sx: {
      maxHeight: 400,
      bgcolor: '#ffffff',
      '& .MuiMenuItem-root': {
        color: '#333',
        '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' },
      },
    },
  },
}

/**
 * 一括コピー用ダイアログ。
 * 選択された複数の日付に、コピー元日のシフトを上書きする。
 */
export function BulkCopyShiftDialog({
  open,
  onClose,
  days,
  bulkCopySourceDate,
  setBulkCopySourceDate,
  selectedCopyDestCount,
  getShiftsForDate,
  onExecute,
  loading,
}) {
  const noShiftAvailable = days.every(({ date }) => getShiftsForDate(date).length === 0)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#ffffff' } }}
    >
      <DialogTitle sx={{ color: '#333' }}>一括コピー</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: '#333' }}>
          チェックした{selectedCopyDestCount}
          日に、コピー元のシフトで上書きします（各コピー先の当日のシフト・ステータスはいったんすべて削除されてから複製されます。コピー元の日は対象外です）。
        </Typography>
        {noShiftAvailable ? (
          <Typography variant="body2" sx={{ color: '#c62828' }}>
            この月にコピー元にできるシフトがありません。
          </Typography>
        ) : (
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel sx={{ color: '#666' }}>コピー元の日付</InputLabel>
            <Select
              value={bulkCopySourceDate}
              onChange={(e) => setBulkCopySourceDate(e.target.value)}
              label="コピー元の日付"
              displayEmpty
              renderValue={(selected) => {
                if (!selected) return ''
                const d = days.find((x) => x.date === selected)
                return d ? `${d.day}日 (${d.dow})` : selected
              }}
              sx={selectSx}
              MenuProps={menuPaperSx}
            >
              <MenuItem value="" sx={{ display: 'none' }} aria-hidden />
              {days
                .filter(({ date }) => getShiftsForDate(date).length > 0)
                .map(({ date, day, dow }) => {
                  const dateShifts = getShiftsForDate(date)
                  return (
                    <MenuItem key={date} value={date}>
                      <Box sx={{ width: '100%' }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: dateShifts.length > 0 ? 0.5 : 0,
                          }}
                        >
                          <Typography variant="body1" sx={{ fontWeight: 'medium', color: '#333' }}>
                            {day}日 ({dow})
                          </Typography>
                          <Chip
                            label={`${dateShifts.length}件`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
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
                      </Box>
                    </MenuItem>
                  )
                })}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={onExecute}
          disabled={loading || !bulkCopySourceDate || noShiftAvailable}
          startIcon={<ContentCopyIcon />}
        >
          複製する
        </Button>
      </DialogActions>
    </Dialog>
  )
}
