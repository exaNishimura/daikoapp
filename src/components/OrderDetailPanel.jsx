import { getAddressFromCity } from '@/utils/addressUtils'
import { STATUS_LABELS } from '@/utils/orderStatusUtils'
import { useOrderDetail } from '@/hooks/useOrderDetail'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import CloseIcon from '@mui/icons-material/Close'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CancelIcon from '@mui/icons-material/Cancel'
import RouteIcon from '@mui/icons-material/Route'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'

export function OrderDetailPanel({ order, onUpdate, onDelete, onClose, vehicles = [], slots = [] }) {
  const {
    relatedVehicle,
    statusLabel,
    statusColor,
    advanceStatus,
    editing,
    formData,
    loading,
    recalculating,
    waitingLocationDuration,
    calculatingWaitingDuration,
    setEditing,
    setFormData,
    handleChange,
    handleSave,
    handleRecalculateRoute,
    handleConfirm,
    handleRevertStatus,
    handleCancel,
    handleAdvanceStatus,
  } = useOrderDetail({ order, vehicles, slots, onUpdate, onDelete, onClose })

  const advanceColor = advanceStatus === 'COMPLETED' ? 'success' : 'info'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ヘッダー */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          依頼詳細
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Paper>

      {/* コンテンツ */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <Stack spacing={3.5}>
          {/* 基本情報 */}
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              基本情報
            </Typography>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  ステータス
                </Typography>
                <Chip label={statusLabel} color={statusColor} size="small" />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
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

          {/* ルート情報 */}
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              ルート情報
            </Typography>
            <Stack spacing={2.5}>
              {editing ? (
                <>
                  <TextField
                    label="出発地"
                    name="pickup_address"
                    value={formData.pickup_address}
                    onChange={handleChange}
                    multiline
                    rows={2}
                    fullWidth
                    inputProps={{
                      'data-1p-ignore': true,
                    }}
                  />
                  {/* 経由地 */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        経由地
                      </Typography>
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            waypoints: [...prev.waypoints, ''],
                          }))
                        }}
                      >
                        追加
                      </Button>
                    </Box>
                    <Stack spacing={1}>
                      {formData.waypoints.map((waypoint, index) => (
                        <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <TextField
                            label={`経由地 ${index + 1}`}
                            value={waypoint}
                            onChange={(e) => {
                              const newWaypoints = [...formData.waypoints]
                              newWaypoints[index] = e.target.value
                              setFormData((prev) => ({ ...prev, waypoints: newWaypoints }))
                            }}
                            multiline
                            rows={2}
                            placeholder="例: 三重県鈴鹿市..."
                            fullWidth
                            size="small"
                          />
                          <IconButton
                            onClick={() => {
                              const newWaypoints = formData.waypoints.filter((_, i) => i !== index)
                              setFormData((prev) => ({ ...prev, waypoints: newWaypoints }))
                            }}
                            sx={{ mt: 0.5 }}
                            color="error"
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      ))}
                      {formData.waypoints.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.75rem' }}>
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
                    inputProps={{
                      'data-1p-ignore': true,
                    }}
                  />
                </>
              ) : (
                <>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      出発地
                    </Typography>
                    <Typography variant="body2">{getAddressFromCity(order.pickup_address)}</Typography>
                  </Box>
                  {order.waypoints && order.waypoints.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        経由地
                      </Typography>
                      <Stack spacing={0.5}>
                        {order.waypoints.map((waypoint, index) => (
                          <Typography key={index} variant="body2" sx={{ pl: 1, borderLeft: 2, borderColor: 'divider' }}>
                            {index + 1}. {getAddressFromCity(waypoint)}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      目的地
                    </Typography>
                    <Typography variant="body2">{getAddressFromCity(order.dropoff_address)}</Typography>
                  </Box>
                  {relatedVehicle?.waiting_location_address && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        待機場所住所（{relatedVehicle.name}）
                      </Typography>
                      <Typography variant="body2">{relatedVehicle.waiting_location_address}</Typography>
                      {calculatingWaitingDuration ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          所要時間を計算中...
                        </Typography>
                      ) : waitingLocationDuration !== null ? (
                        <Typography variant="body2" color="primary" sx={{ mt: 0.5, fontWeight: 500 }}>
                          目的地から待機場所まで: 約{waitingLocationDuration}分
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                          所要時間を計算できませんでした
                        </Typography>
                      )}
                    </Box>
                  )}
                </>
              )}

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
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
                      合計: {parseInt(formData.base_duration_min, 10) + parseInt(formData.buffer_min, 10)}分
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
                      <>未計算（仮30分 + {order.buffer_min || 0}分 = {30 + (order.buffer_min || 0)}分）</>
                    )}
                  </Typography>
                )}
              </Box>

              {!order.base_duration_min && (
                <Button
                  variant="outlined"
                  startIcon={<RouteIcon />}
                  onClick={handleRecalculateRoute}
                  disabled={recalculating}
                  size="small"
                >
                  {recalculating ? '計算中...' : 'ルート再計算'}
                </Button>
              )}

              {/* Googleマップ表示 */}
              {order.pickup_address && order.dropoff_address && (
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
                      src={(() => {
                        const origin = encodeURIComponent(order.pickup_address)
                        const destination = encodeURIComponent(order.dropoff_address)
                        let url = `https://www.google.com/maps/embed/v1/directions?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&origin=${origin}&destination=${destination}&language=ja`
                        if (order.waypoints && order.waypoints.length > 0) {
                          const waypointsParam = order.waypoints
                            .filter((wp) => wp && wp.trim().length > 0)
                            .map((wp) => encodeURIComponent(wp.trim()))
                            .join('|')
                          if (waypointsParam) {
                            url += `&waypoints=${waypointsParam}`
                          }
                        }
                        return url
                      })()}
                    />
                  </Box>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={() => {
                      const destination = encodeURIComponent(order.dropoff_address)
                      // originを省略することで現在地が使用される
                      let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`
                      if (order.waypoints && order.waypoints.length > 0) {
                        const waypointsParam = order.waypoints
                          .filter((wp) => wp && wp.trim().length > 0)
                          .map((wp) => encodeURIComponent(wp.trim()))
                          .join('|')
                        if (waypointsParam) {
                          url += `&waypoints=${waypointsParam}`
                        }
                      }
                      window.open(url, '_blank')
                    }}
                    sx={{ mt: 1 }}
                  >
                    Googleマップでナビゲーション開始
                  </Button>
                </Box>
              )}
            </Stack>
          </Box>

          {/* 連絡先・車情報 */}
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              連絡先・車情報
            </Typography>
            <Stack spacing={2.5}>
              {editing ? (
                <>
                  <TextField
                    label="電話番号"
                    type="tel"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleChange}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="車種"
                    name="car_model"
                    value={formData.car_model}
                    onChange={handleChange}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="ナンバー"
                    name="car_plate"
                    value={formData.car_plate}
                    onChange={handleChange}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="色"
                    name="car_color"
                    value={formData.car_color}
                    onChange={handleChange}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="駐車位置メモ"
                    name="parking_note"
                    value={formData.parking_note}
                    onChange={handleChange}
                    multiline
                    rows={3}
                    fullWidth
                  />
                </>
              ) : (
                <>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      電話番号
                    </Typography>
                    {order.contact_phone ? (
                      <Typography
                        variant="body2"
                        component="a"
                        href={`tel:${order.contact_phone}`}
                        sx={{
                          color: 'primary.main',
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        {order.contact_phone}
                      </Typography>
                    ) : (
                      <Typography variant="body2">未設定</Typography>
                    )}
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      車種
                    </Typography>
                    <Typography variant="body2">{order.car_model || '未設定'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      ナンバー
                    </Typography>
                    <Typography variant="body2">{order.car_plate || '未設定'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      色
                    </Typography>
                    <Typography variant="body2">{order.car_color || '未設定'}</Typography>
                  </Box>
                  {order.parking_note && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        駐車位置メモ
                      </Typography>
                      <Typography variant="body2">{order.parking_note}</Typography>
                    </Box>
                  )}
                </>
              )}
            </Stack>
          </Box>
        </Stack>
      </Box>

      {/* アクション */}
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Stack spacing={1.5}>
          {editing ? (
            <>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={() => setEditing(false)}
                disabled={loading}
                fullWidth
              >
                キャンセル
              </Button>
              <Button
                variant="contained"
                startIcon={<CheckIcon />}
                onClick={handleSave}
                disabled={loading}
                fullWidth
              >
                {loading ? '保存中...' : '保存'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setEditing(true)}
                fullWidth
              >
                編集
              </Button>
              {(order.status === 'UNASSIGNED' || order.status === 'TENTATIVE') && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleConfirm}
                  disabled={loading}
                  fullWidth
                >
                  確定
                </Button>
              )}
              {/* ひとつ前のステータスに戻すボタン */}
              {(order.status === 'COMPLETED' || 
                order.status === 'IN_TRANSIT' || 
                order.status === 'PICKING_UP' || 
                order.status === 'ARRIVED' || 
                order.status === 'CONFIRMED') && (
                <Button
                  variant="outlined"
                  onClick={handleRevertStatus}
                  disabled={loading}
                  fullWidth
                >
                  ステータスを戻す
                </Button>
              )}
              
              {advanceStatus && (
                <Button
                  variant="contained"
                  color={advanceColor}
                  onClick={handleAdvanceStatus}
                  disabled={loading}
                  fullWidth
                >
                  {STATUS_LABELS[advanceStatus]}
                </Button>
              )}
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleCancel}
                disabled={loading}
                fullWidth
              >
                削除
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  )
}
