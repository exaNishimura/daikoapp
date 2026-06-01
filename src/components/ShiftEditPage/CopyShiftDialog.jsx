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

const dialogPaperSx = { bgcolor: '#ffffff' }
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
 * 単日コピー用ダイアログ。
 * 選択した日付のシフトを copyTargetDate に上書きコピーする。
 */
export function CopyShiftDialog({
  open,
  onClose,
  days,
  copyTargetDate,
  getShiftsForDate,
  onCopyFromDate,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle sx={{ color: '#333' }}>他の日からシフトをコピー</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: '#333' }}>
          コピー元の日付を選択してください。この日のシフトでコピー先を上書きします（コピー先の当日データはすべて削除されます）。
        </Typography>
        <FormControl fullWidth>
          <InputLabel sx={{ color: '#666' }}>日付を選択</InputLabel>
          <Select
            value=""
            onChange={(e) => onCopyFromDate(e.target.value)}
            label="日付を選択"
            sx={selectSx}
            MenuProps={menuPaperSx}
          >
            {days
              .filter(({ date }) => date !== copyTargetDate)
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
        <Button onClick={onClose}>キャンセル</Button>
      </DialogActions>
    </Dialog>
  )
}
