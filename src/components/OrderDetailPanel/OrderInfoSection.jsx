import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'

const sectionTitleSx = {
  fontWeight: 600,
  mb: 2,
  pb: 1.5,
  borderBottom: 1,
  borderColor: 'divider',
}

const labelSx = { display: 'block', mb: 0.5 }

export function OrderInfoSection({ order, statusLabel, statusColor }) {
  return (
    <Box>
      <Typography variant="subtitle1" sx={sectionTitleSx}>
        基本情報
      </Typography>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={labelSx}>
            ステータス
          </Typography>
          <Chip label={statusLabel} color={statusColor} size="small" />
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={labelSx}>
            予約種別
          </Typography>
          <Typography variant="body2">
            {order.order_type === 'NOW'
              ? '今すぐ'
              : order.scheduled_at
                ? new Date(order.scheduled_at).toLocaleString('ja-JP')
                : '日時指定'}
          </Typography>
        </Box>
      </Stack>
    </Box>
  )
}
