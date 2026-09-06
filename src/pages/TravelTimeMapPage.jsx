import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import {
  HStack,
  Layout,
  LayoutContent,
  LayoutHeader,
  LayoutPanel,
  VStack,
} from '@astryxdesign/core/Layout'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { PlacesAutocompleteField } from '@/components/PlacesAutocompleteField'
import { TravelTimeGoogleMap } from '@/components/TravelTimeMap/TravelTimeGoogleMap'
import { TravelTimeTownList } from '@/components/TravelTimeMap/TravelTimeTownList'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useTravelTimeMap } from '@/hooks/useTravelTimeMap'
import { AREA_CITIES } from '@/lib/areaTowns'

export function TravelTimeMapPage() {
  const isNarrow = useMediaQuery('(max-width: 1024px)')
  const {
    city,
    setCity,
    query,
    setQuery,
    originAddress,
    setOriginAddress,
    origin,
    originLabel,
    visibleTowns,
    selectedId,
    selectTown,
    listMode,
    setListMode,
    favoriteIds,
    toggleFavorite,
    cityFavoriteCount,
    isComputing,
    progress,
    error,
    computeDurations,
  } = useTravelTimeMap()

  const computedCount = visibleTowns.filter((t) => t.minutes != null).length
  const buttonLabel = originAddress.trim() ? '指定地点から計算' : '現在地から計算'
  const isFavoritesEmpty = listMode === 'favorites' && !query.trim() && cityFavoriteCount === 0

  const filters = (
    <VStack gap={3}>
      <SegmentedControl value={city} onChange={setCity} label="対象市" size="sm" layout="fill">
        {AREA_CITIES.map((name) => (
          <SegmentedControlItem key={name} value={name} label={name.replace('市', '')} />
        ))}
      </SegmentedControl>
      <SegmentedControl
        value={listMode}
        onChange={setListMode}
        label="表示"
        size="sm"
        layout="fill"
      >
        <SegmentedControlItem value="favorites" label={`よく使う ${cityFavoriteCount}`} />
        <SegmentedControlItem value="all" label="すべて" />
      </SegmentedControl>
      <TextInput label="町名検索" value={query} onChange={setQuery} placeholder="町名・カナ" />
      <PlacesAutocompleteField
        label="出発地点（空なら現在地）"
        value={originAddress}
        onChange={setOriginAddress}
        placeholder="待機場所の住所"
        helperText="空欄のまま計算すると、ブラウザの現在地を使います。"
      />
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Button
          label={buttonLabel}
          variant="primary"
          onClick={computeDurations}
          isDisabled={isComputing || visibleTowns.length === 0}
        />
        {isComputing ? <Spinner size="sm" label="計算中" /> : null}
      </HStack>
      <Text color="secondary">
        {isComputing
          ? `${progress.done} / ${progress.total} 件を計算中`
          : `表示 ${visibleTowns.length}件（所要計算済み ${computedCount}件）`}
      </Text>
      {originLabel ? <Text color="secondary">出発: {originLabel}</Text> : null}
    </VStack>
  )

  const list = (
    <TravelTimeTownList
      towns={visibleTowns}
      selectedId={selectedId}
      onSelect={selectTown}
      favoriteIds={favoriteIds}
      onToggleFavorite={toggleFavorite}
      emptyTitle={isFavoritesEmpty ? 'よく使う地名がありません' : '該当する町名がありません'}
      emptyDescription={
        isFavoritesEmpty
          ? '「すべて」から☆を付けると、その町だけ表示・計算します。☆は全端末で共有されます。'
          : '市または検索条件を変えてください。'
      }
      emptyActions={
        isFavoritesEmpty ? (
          <Button label="すべての町名を表示" size="sm" onClick={() => setListMode('all')} />
        ) : null
      }
    />
  )

  const map = (
    <TravelTimeGoogleMap
      origin={origin}
      originLabel={originLabel}
      towns={visibleTowns}
      selectedId={selectedId}
      onSelect={selectTown}
    />
  )

  return (
    <Layout
      height="fill"
      padding={4}
      header={
        <LayoutHeader hasDivider>
          <VStack gap={1}>
            <Heading level={1}>所要時間マップ</Heading>
            <Text color="secondary">
              鈴鹿・亀山・四日市・津の町名について、出発地点からの車での想定所要を表示します。☆は全端末で共有されます。
            </Text>
          </VStack>
        </LayoutHeader>
      }
      start={
        isNarrow ? undefined : (
          <LayoutPanel width={380} hasDivider isScrollable label="町名一覧">
            <VStack gap={3}>
              {filters}
              {error ? <Banner status="error" title={error} collapsible={false} /> : null}
              {list}
            </VStack>
          </LayoutPanel>
        )
      }
      content={
        <LayoutContent>
          {isNarrow ? (
            <VStack gap={3} height="100%">
              {filters}
              {error ? <Banner status="error" title={error} collapsible={false} /> : null}
              <VStack height={320}>{map}</VStack>
              {list}
            </VStack>
          ) : (
            map
          )}
        </LayoutContent>
      }
    />
  )
}
