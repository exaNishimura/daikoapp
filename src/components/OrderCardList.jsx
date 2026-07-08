import { useState } from 'react'
import { OrderCard } from './OrderCard'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

export function OrderCardList({
  orders,
  onOrderSelect,
  selectedOrderId,
  onExpandedChange,
  defaultExpanded = false,
  expandedMaxHeight = 'calc(100vh / 3)',
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const handleToggle = () => {
    const newExpanded = !expanded
    setExpanded(newExpanded)
    if (onExpandedChange) {
      onExpandedChange(newExpanded)
    }
  }

  // 未確定の依頼をフィルタ（未割当 + 仮配置）
  const unassignedOrders = orders.filter(
    (order) => order.status === 'UNASSIGNED' || order.status === 'TENTATIVE'
  )

  // 0件の場合は何も表示しない
  if (unassignedOrders.length === 0) {
    return null
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
        ...(expanded
          ? { height: expandedMaxHeight, maxHeight: expandedMaxHeight }
          : { height: 'auto' }),
      }}
    >
      {/* ヘッダー */}
      <Paper
        elevation={0}
        square
        sx={{
          px: 1,
          py: 0.5,
          minHeight: 36,
          borderBottom: expanded ? 1 : 0,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          cursor: 'pointer',
          flexShrink: 0,
          borderRadius: 0,
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
        onClick={handleToggle}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              component="span"
              sx={{ fontWeight: 600, fontSize: '0.75rem', lineHeight: 1.2 }}
            >
              未確定依頼
            </Typography>
            <Chip
              label={unassignedOrders.length}
              size="small"
              color="primary"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                fontWeight: 600,
                '& .MuiChip-label': { px: 0.75, py: 0 },
              }}
            />
          </Box>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              handleToggle()
            }}
            sx={{ ml: 0.5, p: 0.25 }}
            aria-label={expanded ? '未確定依頼一覧を閉じる' : '未確定依頼一覧を開く'}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ExpandLessIcon sx={{ fontSize: 20 }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 20 }} />
            )}
          </IconButton>
        </Box>
      </Paper>

      {/* 依頼リスト */}
      {expanded && (
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: { xs: 0.75, sm: 1 },
            minHeight: 0,
          }}
        >
          {unassignedOrders.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                未割当の依頼はありません
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {unassignedOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isSelected={selectedOrderId === order.id}
                  onClick={() => onOrderSelect(order)}
                />
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
