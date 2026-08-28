import { Plus, Route, Trash2 } from 'lucide-react'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { IconButton } from '@astryxdesign/core/IconButton'
import { HStack, StackItem, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { PlacesAutocompleteField } from '@/components/PlacesAutocompleteField'
import { getAddressFromCity } from '@/utils/addressUtils'

function namedChange(handleChange, name) {
  return (value) => handleChange({ target: { name, value: value ?? '' } })
}

function MapEmbed({ order }) {
  if (!order.pickup_address || !order.dropoff_address) return null

  const buildEmbedUrl = () => {
    const origin = encodeURIComponent(order.pickup_address)
    const destination = encodeURIComponent(order.dropoff_address)
    let url = `https://www.google.com/maps/embed/v1/directions?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&origin=${origin}&destination=${destination}&language=ja`
    if (order.waypoints && order.waypoints.length > 0) {
      const waypointsParam = order.waypoints
        .filter((wp) => wp && wp.trim().length > 0)
        .map((wp) => encodeURIComponent(wp.trim()))
        .join('|')
      if (waypointsParam) url += `&waypoints=${waypointsParam}`
    }
    return url
  }

  const openExternalNav = () => {
    const destination = encodeURIComponent(order.dropoff_address)
    let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`
    if (order.waypoints && order.waypoints.length > 0) {
      const waypointsParam = order.waypoints
        .filter((wp) => wp && wp.trim().length > 0)
        .map((wp) => encodeURIComponent(wp.trim()))
        .join('|')
      if (waypointsParam) url += `&waypoints=${waypointsParam}`
    }
    window.open(url, '_blank')
  }

  return (
    <VStack gap={1}>
      <Text size="xsm" color="secondary">
        ルート表示
      </Text>
      <VStack
        height={300}
        style={{ overflow: 'hidden', borderRadius: 'var(--radius-md)' }}
      >
        <iframe
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={buildEmbedUrl()}
          title="ルート地図"
        />
      </VStack>
      <Button
        variant="primary"
        width="100%"
        onClick={openExternalNav}
        label="Googleマップでナビゲーション開始"
      />
    </VStack>
  )
}

function RouteEditFields({ formData, handleChange, setFormData }) {
  const updateField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }
  const updateWaypoint = (index, value) => {
    const next = [...formData.waypoints]
    next[index] = value
    setFormData((prev) => ({ ...prev, waypoints: next }))
  }
  const addWaypoint = () => {
    setFormData((prev) => ({ ...prev, waypoints: [...prev.waypoints, ''] }))
  }
  const removeWaypoint = (index) => {
    setFormData((prev) => ({
      ...prev,
      waypoints: prev.waypoints.filter((_, i) => i !== index),
    }))
  }

  return (
    <>
      <TextInput
        label="お迎え場所"
        htmlName="pickup_location"
        value={formData.pickup_location}
        onChange={namedChange(handleChange, 'pickup_location')}
        placeholder="例: モンガータ"
        width="100%"
      />
      <PlacesAutocompleteField
        label="出発地"
        name="pickup_address"
        value={formData.pickup_address}
        onChange={(address) => updateField('pickup_address', address)}
        placeholder="例: 三重県鈴鹿市..."
        required
      />
      <VStack gap={1.5}>
        <HStack hAlign="between" vAlign="center">
          <Text size="xsm" color="secondary">
            経由地
          </Text>
          <Button
            size="sm"
            variant="secondary"
            label="追加"
            icon={<Plus />}
            onClick={addWaypoint}
          />
        </HStack>
        {formData.waypoints.map((waypoint, index) => (
          <HStack key={index} gap={1} vAlign="start">
            <StackItem size="fill">
              <PlacesAutocompleteField
                label={`経由地 ${index + 1}`}
                value={waypoint}
                onChange={(address) => updateWaypoint(index, address)}
                placeholder="例: 三重県鈴鹿市..."
              />
            </StackItem>
            <IconButton
              label={`経由地 ${index + 1} を削除`}
              icon={<Trash2 />}
              variant="destructive"
              size="sm"
              onClick={() => removeWaypoint(index)}
            />
          </HStack>
        ))}
        {formData.waypoints.length === 0 ? (
          <Text color="secondary" size="xsm">
            経由地はありません
          </Text>
        ) : null}
      </VStack>
      <PlacesAutocompleteField
        label="目的地"
        name="dropoff_address"
        value={formData.dropoff_address}
        onChange={(address) => updateField('dropoff_address', address)}
        placeholder="例: 三重県鈴鹿市..."
        required
      />
    </>
  )
}

function RouteViewFields({
  order,
  relatedVehicle,
  waitingLocationDuration,
  calculatingWaitingDuration,
}) {
  return (
    <>
      {order.pickup_location ? (
        <VStack gap={0.5}>
          <Text size="xsm" color="secondary">
            お迎え場所
          </Text>
          <Text>{order.pickup_location}</Text>
        </VStack>
      ) : null}
      <VStack gap={0.5}>
        <Text size="xsm" color="secondary">
          出発地
        </Text>
        <Text>{getAddressFromCity(order.pickup_address)}</Text>
      </VStack>
      {order.waypoints && order.waypoints.length > 0 ? (
        <VStack gap={0.5}>
          <Text size="xsm" color="secondary">
            経由地
          </Text>
          <VStack gap={0.5}>
            {order.waypoints.map((waypoint, index) => (
              <Text key={index}>
                {index + 1}. {getAddressFromCity(waypoint)}
              </Text>
            ))}
          </VStack>
        </VStack>
      ) : null}
      <VStack gap={0.5}>
        <Text size="xsm" color="secondary">
          目的地
        </Text>
        <Text>{getAddressFromCity(order.dropoff_address)}</Text>
      </VStack>
      {relatedVehicle?.waiting_location_address ? (
        <VStack gap={0.5}>
          <Text size="xsm" color="secondary">
            待機場所住所（{relatedVehicle.name}）
          </Text>
          <Text>{relatedVehicle.waiting_location_address}</Text>
          {calculatingWaitingDuration ? (
            <Text color="secondary">所要時間を計算中...</Text>
          ) : waitingLocationDuration !== null ? (
            <Text color="accent" weight="medium">
              目的地から待機場所まで: 約{waitingLocationDuration}分
            </Text>
          ) : (
            <Text color="secondary">所要時間を計算できませんでした</Text>
          )}
        </VStack>
      ) : null}
    </>
  )
}

function DurationFields({ editing, order, formData, handleChange }) {
  return (
    <VStack gap={0.5}>
      <Text size="xsm" color="secondary">
        所要時間
      </Text>
      {editing ? (
        <VStack gap={1.5}>
          <TextInput
            label="基本時間（分）"
            htmlName="base_duration_min"
            value={String(formData.base_duration_min ?? '')}
            onChange={namedChange(handleChange, 'base_duration_min')}
            size="sm"
            width="100%"
          />
          <TextInput
            label="バッファ（分）"
            htmlName="buffer_min"
            value={String(formData.buffer_min ?? '')}
            onChange={namedChange(handleChange, 'buffer_min')}
            size="sm"
            width="100%"
          />
          <Text color="secondary">
            合計: {parseInt(formData.base_duration_min, 10) + parseInt(formData.buffer_min, 10)}分
          </Text>
        </VStack>
      ) : (
        <Text>
          {order.base_duration_min ? (
            <>
              {order.base_duration_min}分（基本）+ {order.buffer_min || 0}
              分（バッファ）= {order.base_duration_min + (order.buffer_min || 0)}分
            </>
          ) : (
            <>
              未計算（仮30分 + {order.buffer_min || 0}分 = {30 + (order.buffer_min || 0)}分）
            </>
          )}
        </Text>
      )}
    </VStack>
  )
}

export function OrderRouteSection({
  editing,
  order,
  formData,
  handleChange,
  setFormData,
  relatedVehicle,
  waitingLocationDuration,
  calculatingWaitingDuration,
  recalculating,
  onRecalculateRoute,
}) {
  return (
    <VStack gap={2}>
      <Heading level={3}>ルート情報</Heading>
      <VStack gap={2}>
        {editing ? (
          <RouteEditFields
            formData={formData}
            handleChange={handleChange}
            setFormData={setFormData}
          />
        ) : (
          <RouteViewFields
            order={order}
            relatedVehicle={relatedVehicle}
            waitingLocationDuration={waitingLocationDuration}
            calculatingWaitingDuration={calculatingWaitingDuration}
          />
        )}

        <DurationFields
          editing={editing}
          order={order}
          formData={formData}
          handleChange={handleChange}
        />

        {!order.base_duration_min ? (
          <Button
            variant="secondary"
            size="sm"
            icon={<Route />}
            onClick={onRecalculateRoute}
            isDisabled={recalculating}
            isLoading={recalculating}
            label={recalculating ? '計算中...' : 'ルート再計算'}
          />
        ) : null}

        <MapEmbed order={order} />
      </VStack>
    </VStack>
  )
}
