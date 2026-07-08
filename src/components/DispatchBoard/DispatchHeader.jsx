import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import AddIcon from '@mui/icons-material/Add'
import SettingsIcon from '@mui/icons-material/Settings'

/**
 * DispatchBoard 上部の固定ヘッダー（コンパクト版）。
 */
export function DispatchHeader({
  businessDayText,
  earliestAvailableTime,
  vehicles,
  pendingCount = 0,
  conflictCount = 0,
  onOpenSettings,
  onOpenOrderForm,
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        flexShrink: 0,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          px: { xs: 1, sm: 2 },
          py: { xs: 0.5, sm: 0.75 },
          minHeight: { xs: 44, sm: 48 },
          width: '100%',
          maxWidth: '100vw',
          gap: 1,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.5, sm: 0.75 },
            minWidth: 0,
            flex: 1,
            flexWrap: 'wrap',
            rowGap: 0.25,
          }}
        >
          <Typography
            variant="caption"
            component="span"
            sx={{
              fontWeight: 600,
              whiteSpace: 'nowrap',
              fontSize: { xs: '0.7rem', sm: '0.75rem' },
              lineHeight: 1.2,
            }}
          >
            {businessDayText}
          </Typography>
          <Typography
            variant="caption"
            component="span"
            sx={{
              color: 'text.secondary',
              fontSize: '0.7rem',
              whiteSpace: 'nowrap',
              display: { xs: 'none', sm: 'inline' },
            }}
          >
            受付:
          </Typography>
          <Typography
            variant="body2"
            component="span"
            sx={{
              color: 'error.main',
              fontWeight: 700,
              fontSize: { xs: '0.9rem', sm: '1rem' },
              whiteSpace: 'nowrap',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {earliestAvailableTime}
          </Typography>
          {pendingCount > 0 && (
            <Chip
              label={isMobile ? `未${pendingCount}` : `未確定 ${pendingCount}件`}
              size="small"
              color="warning"
              sx={{
                height: { xs: 18, sm: 20 },
                fontSize: '0.65rem',
                fontWeight: 600,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
          {conflictCount > 0 && (
            <Chip
              label={isMobile ? `競合${conflictCount}` : `競合 ${conflictCount}件`}
              size="small"
              color="error"
              sx={{
                height: { xs: 18, sm: 20 },
                fontSize: '0.65rem',
                fontWeight: 600,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
          {isMobile ? (
            <>
              <Tooltip title="稼働状況">
                <span>
                  <IconButton
                    size="small"
                    onClick={onOpenSettings}
                    disabled={vehicles.length === 0}
                    aria-label="稼働状況設定"
                    sx={{ p: 0.75 }}
                  >
                    <SettingsIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="新規依頼">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={onOpenOrderForm}
                  aria-label="新規依頼を追加"
                  sx={{
                    p: 0.75,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                  }}
                >
                  <AddIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                size="small"
                startIcon={<SettingsIcon />}
                onClick={onOpenSettings}
                disabled={vehicles.length === 0}
                aria-label="稼働状況設定"
                sx={{ py: 0.5, px: 1.25, fontSize: '0.8rem', minWidth: 0 }}
              >
                稼働状況
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={onOpenOrderForm}
                aria-label="新規依頼を追加"
                sx={{ py: 0.5, px: 1.25, fontSize: '0.8rem', minWidth: 0 }}
              >
                新規依頼
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  )
}
