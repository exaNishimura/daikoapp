import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import AddIcon from '@mui/icons-material/Add'
import SettingsIcon from '@mui/icons-material/Settings'

/**
 * DispatchBoard 上部の固定ヘッダー。
 * 営業日表示 / 受付可能時間 / 設定 / 依頼追加ボタン。
 */
export function DispatchHeader({
  businessDayText,
  earliestAvailableTime,
  vehicles,
  onOpenSettings,
  onOpenOrderForm,
}) {
  return (
    <AppBar
      position="static"
      elevation={1}
      sx={{
        bgcolor: 'background.paper',
        flexShrink: 0,
      }}
    >
      <Toolbar
        sx={{
          justifyContent: 'space-between',
          px: { xs: 2, sm: 3 },
          py: 1.5,
          width: '100%',
          maxWidth: '100vw',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <Typography
            variant="body2"
            component="div"
            sx={{
              fontWeight: 600,
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              fontSize: '0.875rem',
            }}
          >
            {businessDayText}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mt: 0.25 }}>
            <Typography
              variant="caption"
              component="span"
              sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 500 }}
            >
              受付可能時間:
            </Typography>
            <Typography
              variant="h6"
              component="span"
              sx={{
                color: 'error.main',
                fontWeight: 700,
                fontSize: '1.25rem',
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
              }}
            >
              {earliestAvailableTime}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, ml: 2, whiteSpace: 'nowrap', flexShrink: 0 }}>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={onOpenSettings}
            disabled={vehicles.length === 0}
          >
            設定
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onOpenOrderForm}>
            依頼
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
