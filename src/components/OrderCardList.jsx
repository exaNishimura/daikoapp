import { useState } from 'react'
import { OrderCard } from './OrderCard'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

export function OrderCardList({ orders, onOrderSelect, selectedOrderId, onExpandedChange }) {
  const [expanded, setExpanded] = useState(false) // デフォルトで折りたたみ

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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ヘッダー */}
      <Paper
        elevation={0}
        sx={{
          p: 1.25, // 10px (MUIのデフォルトは8px単位なので、1.25 = 10px)
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          cursor: 'pointer',
          flexShrink: 0,
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
        onClick={handleToggle}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
              未確定依頼
            </Typography>
            <Chip
              label={unassignedOrders.length}
              size="small"
              color="primary"
              sx={{
                height: '24px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            />
          </Box>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              handleToggle()
            }}
            sx={{ ml: 1 }}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Paper>

      {/* 依頼リスト */}
      {expanded && (
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 2.5,
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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

