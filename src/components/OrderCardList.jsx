import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { OrderCard } from './OrderCard'
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'

export function OrderCardList({
  orders,
  onOrderSelect,
  selectedOrderId,
  onExpandedChange,
  defaultExpanded = false,
  expandedMaxHeight = 'calc(100vh / 3)',
  fillHeight = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const handleToggle = () => {
    const newExpanded = !expanded
    setExpanded(newExpanded)
    if (onExpandedChange) {
      onExpandedChange(newExpanded)
    }
  }

  const unassignedOrders = orders.filter(
    (order) => order.status === 'UNASSIGNED' || order.status === 'TENTATIVE'
  )

  if (unassignedOrders.length === 0) {
    return null
  }

  const listHeight = expanded ? (fillHeight ? '100%' : expandedMaxHeight) : 'auto'

  return (
    <VStack
      className="order-card-list"
      height={listHeight}
      minHeight={fillHeight ? 0 : undefined}
      style={{
        overflow: 'hidden',
        flex: fillHeight ? 1 : undefined,
        flexShrink: fillHeight ? undefined : 0,
        maxHeight: expanded && !fillHeight ? expandedMaxHeight : undefined,
      }}
    >
      <HStack
        className="order-list-title"
        padding={1}
        paddingBlock={0.5}
        gap={1}
        vAlign="center"
        hAlign="between"
        onClick={handleToggle}
        style={{ cursor: 'pointer', flexShrink: 0 }}
      >
        <HStack gap={1} vAlign="center">
          <Text size="xsm" weight="semibold">
            未確定依頼
          </Text>
          <Token size="sm" color="blue" label={String(unassignedOrders.length)} />
        </HStack>
        <IconButton
          size="sm"
          variant="ghost"
          label={expanded ? '未確定依頼一覧を閉じる' : '未確定依頼一覧を開く'}
          icon={expanded ? <ChevronUp /> : <ChevronDown />}
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation()
            handleToggle()
          }}
        />
      </HStack>

      {expanded ? (
        <StackItem size="fill" isScrollable>
          <VStack className="order-cards" gap={0.5} padding={1}>
            {unassignedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isSelected={selectedOrderId === order.id}
                onClick={() => onOrderSelect(order)}
              />
            ))}
          </VStack>
        </StackItem>
      ) : null}
    </VStack>
  )
}
