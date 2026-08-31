import { useMemo } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { List, ListItem } from '@astryxdesign/core/List'
import { Icon } from '@astryxdesign/core/Icon'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Text } from '@astryxdesign/core/Text'
import { ToggleButton } from '@astryxdesign/core/ToggleButton'
import { Star } from 'lucide-react'
import {
  formatDurationMinutes,
  formatTownNameWithKana,
  getDurationBand,
  GOJUON_ROWS,
  groupTownsByGojuon,
} from '@/lib/areaTowns'
import './TravelTimeTownList.css'

function StarFilled(props) {
  return <Star {...props} fill="currentColor" />
}

function gojuonSectionId(key) {
  return `travel-time-gojuon-${key}`
}

function scrollToGojuon(key) {
  const el = document.getElementById(gojuonSectionId(key))
  if (!el) return
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({
    behavior: prefersReduced ? 'instant' : 'smooth',
    block: 'start',
  })
}

function TownListItem({ town, isSelected, isFavorite, onSelect, onToggleFavorite }) {
  const band = getDurationBand(town.minutes)
  const distance = town.distanceKm != null ? `${town.distanceKm}km` : ''
  return (
    <ListItem
      className="travel-time-town-item"
      label={formatTownNameWithKana(town.name, town.kana)}
      description={`${town.city}${distance ? ` / ${distance}` : ''}`}
      isSelected={isSelected}
      onClick={() => onSelect(town.id)}
      startContent={
        <HStack gap={1} vAlign="center">
          <ToggleButton
            size="sm"
            isIconOnly
            className="travel-time-favorite-star"
            label={isFavorite ? 'よく使うから外す' : 'よく使うに追加'}
            icon={<Icon icon={Star} color="yellow" />}
            pressedIcon={<Icon icon={StarFilled} color="yellow" />}
            isPressed={isFavorite}
            onPressedChange={(nextPressed, event) => {
              event?.stopPropagation?.()
              onToggleFavorite(town.id, nextPressed)
            }}
          />
          <StatusDot variant={band.variant} label={band.label} />
        </HStack>
      }
      endContent={
        <Text weight="semibold" color={town.minutes == null ? 'secondary' : undefined}>
          {formatDurationMinutes(town.minutes)}
        </Text>
      }
    />
  )
}

export function TravelTimeTownList({
  towns,
  selectedId,
  onSelect,
  favoriteIds,
  onToggleFavorite,
  emptyTitle = '該当する町名がありません',
  emptyDescription = '市または検索条件を変えてください。',
  emptyActions,
}) {
  const groups = useMemo(() => groupTownsByGojuon(towns), [towns])
  const presentKeys = useMemo(() => new Set(groups.map((group) => group.key)), [groups])

  if (towns.length === 0) {
    return (
      <EmptyState
        isCompact
        title={emptyTitle}
        description={emptyDescription}
        actions={emptyActions}
      />
    )
  }

  return (
    <VStack gap={3}>
      <HStack
        as="nav"
        gap={1}
        wrap="wrap"
        vAlign="center"
        className="travel-time-gojuon-index"
        aria-label="50音索引"
      >
        {GOJUON_ROWS.map((row) => {
          const hasTowns = presentKeys.has(row.key)
          if (row.key === 'other' && !hasTowns) return null
          return (
            <Button
              key={row.key}
              size="sm"
              variant="ghost"
              label={row.label}
              aria-label={`${row.label}行へ移動`}
              isDisabled={!hasTowns}
              onClick={() => scrollToGojuon(row.key)}
            />
          )
        })}
      </HStack>
      {groups.map((group) => (
        <VStack key={group.key} as="section" id={gojuonSectionId(group.key)} gap={0}>
          <List hasDividers density="compact" header={`${group.label}行`}>
            {group.towns.map((town) => (
              <TownListItem
                key={town.id}
                town={town}
                isSelected={selectedId === town.id}
                isFavorite={favoriteIds.has(town.id)}
                onSelect={onSelect}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </List>
        </VStack>
      ))}
    </VStack>
  )
}
