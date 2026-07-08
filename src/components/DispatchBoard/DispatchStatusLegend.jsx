import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'

const LEGEND_ITEMS = [
  { label: '仮配置', color: '#ffa500', textColor: '#000' },
  { label: '確定', color: '#4caf50', textColor: '#fff' },
  { label: '送客中', color: '#9c27b0', textColor: '#fff' },
  { label: '競合', color: '#ff4444', textColor: '#fff' },
]

/**
 * タイムライン上のスロット色の凡例（タブレット以上のみ表示）。
 */
export function DispatchStatusLegend() {
  return (
    <Box
      sx={{
        display: { xs: 'none', sm: 'flex' },
        alignItems: 'center',
        gap: 0.5,
        px: 2,
        py: 0.25,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        flexShrink: 0,
        overflowX: 'auto',
      }}
      aria-label="ステータス凡例"
    >
      {LEGEND_ITEMS.map((item) => (
        <Chip
          key={item.label}
          label={item.label}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.65rem',
            fontWeight: 600,
            bgcolor: item.color,
            color: item.textColor,
            '& .MuiChip-label': { px: 0.75, py: 0 },
          }}
        />
      ))}
    </Box>
  )
}
