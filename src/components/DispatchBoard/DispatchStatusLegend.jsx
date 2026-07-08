import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'

const LEGEND_ITEMS = [
  {
    label: '配置不可',
    color: '#eef1f5',
    textColor: '#6b7280',
    border: '1px dashed #c4cad2',
  },
  { label: '仮配置', color: '#fef0d5', textColor: '#8a5a00', border: '1px solid #f2c777' },
  { label: '確定', color: '#16a34a', textColor: '#fff' },
  { label: '送客中', color: '#7c3aed', textColor: '#fff' },
  { label: '競合', color: '#dc2626', textColor: '#fff' },
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
            border: item.border ?? 'none',
            '& .MuiChip-label': { px: 0.75, py: 0 },
          }}
        />
      ))}
    </Box>
  )
}
