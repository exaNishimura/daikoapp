import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import RouteIcon from '@mui/icons-material/Route'
import { getAddressFromCity } from '@/utils/addressUtils'

const sectionTitleSx = {
  fontWeight: 600,
  mb: 2,
  pb: 1.5,
  borderBottom: 1,
  borderColor: 'divider',
}
const labelSx = { display: 'block', mb: 0.5 }

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
    // origin を省略することで現在地が使われる
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
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        ルート表示
      </Typography>
      <Box
        sx={{
          width: '100%',
          height: '300px',
          borderRadius: 1,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          mb: 1.5,
        }}
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
      </Box>
      <Button variant="contained" color="primary" fullWidth onClick={openExternalNav} sx={{ mt: 1 }}>
        Googleマップでナビゲーション開始
      </Button>
    </Box>
  )
}

function RouteEditFields({ formData, handleChange, setFormData }) {
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
      <TextField
        label="出発地"
        name="pickup_address"
        value={formData.pickup_address}
        onChange={handleChange}
        multiline
        rows={2}
        fullWidth
        inputProps={{ 'data-1p-ignore': true }}
      />
      <Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            経由地
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addWaypoint}>
            追加
          </Button>
        </Box>
        <Stack spacing={1}>
          {formData.waypoints.map((waypoint, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <TextField
                label={`経由地 ${index + 1}`}
                value={waypoint}
                onChange={(e) => updateWaypoint(index, e.target.value)}
                multiline
                rows={2}
                placeholder="例: 三重県鈴鹿市..."
                fullWidth
                size="small"
              />
              <IconButton
                onClick={() => removeWaypoint(index)}
                sx={{ mt: 0.5 }}
                color="error"
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}
          {formData.waypoints.length === 0 && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontStyle: 'italic', fontSize: '0.75rem' }}
            >
              経由地はありません
            </Typography>
          )}
        </Stack>
      </Box>
      <TextField
        label="目的地"
        name="dropoff_address"
        value={formData.dropoff_address}
        onChange={handleChange}
        multiline
        rows={2}
        fullWidth
        inputProps={{ 'data-1p-ignore': true }}
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
      <Box>
        <Typography variant="caption" color="text.secondary" sx={labelSx}>
          出発地
        </Typography>
        <Typography variant="body2">{getAddressFromCity(order.pickup_address)}</Typography>
      </Box>
      {order.waypoints && order.waypoints.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={labelSx}>
            経由地
          </Typography>
          <Stack spacing={0.5}>
            {order.waypoints.map((waypoint, index) => (
              <Typography
                key={index}
                variant="body2"
                sx={{ pl: 1, borderLeft: 2, borderColor: 'divider' }}
              >
                {index + 1}. {getAddressFromCity(waypoint)}
              </Typography>
            ))}
          </Stack>
        </Box>
      )}
      <Box>
        <Typography variant="caption" color="text.secondary" sx={labelSx}>
          目的地
        </Typography>
        <Typography variant="body2">{getAddressFromCity(order.dropoff_address)}</Typography>
      </Box>
      {relatedVehicle?.waiting_location_address && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={labelSx}>
            待機場所住所（{relatedVehicle.name}）
          </Typography>
          <Typography variant="body2">{relatedVehicle.waiting_location_address}</Typography>
          {calculatingWaitingDuration ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              所要時間を計算中...
            </Typography>
          ) : waitingLocationDuration !== null ? (
            <Typography
              variant="body2"
              color="primary"
              sx={{ mt: 0.5, fontWeight: 500 }}
            >
              目的地から待機場所まで: 約{waitingLocationDuration}分
            </Typography>
          ) : (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, fontStyle: 'italic' }}
            >
              所要時間を計算できませんでした
            </Typography>
          )}
        </Box>
      )}
    </>
  )
}

function DurationFields({ editing, order, formData, handleChange }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={labelSx}>
        所要時間
      </Typography>
      {editing ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ minWidth: '80px' }}>
              基本時間:
            </Typography>
            <TextField
              type="number"
              name="base_duration_min"
              value={formData.base_duration_min}
              onChange={handleChange}
              size="small"
              inputProps={{ min: 1, step: 1 }}
              sx={{ width: '100px' }}
            />
            <Typography variant="body2">分</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ minWidth: '80px' }}>
              バッファ:
            </Typography>
            <TextField
              type="number"
              name="buffer_min"
              value={formData.buffer_min}
              onChange={handleChange}
              size="small"
              inputProps={{ min: 0, step: 1 }}
              sx={{ width: '100px' }}
            />
            <Typography variant="body2">分</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            合計: {parseInt(formData.base_duration_min, 10) + parseInt(formData.buffer_min, 10)}
            分
          </Typography>
        </Box>
      ) : (
        <Typography variant="body2">
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
        </Typography>
      )}
    </Box>
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
    <Box>
      <Typography variant="subtitle1" sx={sectionTitleSx}>
        ルート情報
      </Typography>
      <Stack spacing={2.5}>
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

        {!order.base_duration_min && (
          <Button
            variant="outlined"
            startIcon={<RouteIcon />}
            onClick={onRecalculateRoute}
            disabled={recalculating}
            size="small"
          >
            {recalculating ? '計算中...' : 'ルート再計算'}
          </Button>
        )}

        <MapEmbed order={order} />
      </Stack>
    </Box>
  )
}
