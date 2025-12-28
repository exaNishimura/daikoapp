import { useState, useEffect } from 'react'
import { updateOrder, cancelOrder } from '@/services/orderService'
import { confirmSlot, deleteSlot, createSlot } from '@/services/slotService'
import { estimateDuration, calculateBuffer } from '@/services/routeService'
import { getOrderById } from '@/services/orderService'
import { getVehicles } from '@/services/vehicleService'
import { supabase } from '@/lib/supabase'
import { findEarliestAvailableSlotAcrossVehicles } from '@/utils/slotUtils'
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

export function OrderDetailPanel({ order, onUpdate, onDelete, onClose, vehicles = [], slots = [] }) {
  // この依頼に関連する車両を取得
  const relatedVehicle = slots.length > 0
    ? vehicles.find(v => v.id === slots[0].vehicle_id)
    : null

  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    pickup_address: order.pickup_address,
    dropoff_address: order.dropoff_address,
    waypoints: order.waypoints || [],
    contact_phone: order.contact_phone || '',
    car_model: order.car_model || '',
    car_plate: order.car_plate || '',
    car_color: order.car_color || '',
    parking_note: order.parking_note || '',
    base_duration_min: order.base_duration_min || 30,
    buffer_min: order.buffer_min || 10,
  })
  const [waitingLocationDuration, setWaitingLocationDuration] = useState(null)
  const [calculatingWaitingDuration, setCalculatingWaitingDuration] = useState(false)
  const [loading, setLoading] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  // 待機場所住所への所要時間を計算（車両の待機場所住所を使用）
  useEffect(() => {
    const calculateWaitingLocationDuration = async () => {
      if (!order.dropoff_address || !relatedVehicle?.waiting_location_address) {
        setWaitingLocationDuration(null)
        return
      }

      setCalculatingWaitingDuration(true)
      try {
        const { duration, error } = await estimateDuration(
          order.dropoff_address,
          relatedVehicle.waiting_location_address,
          null
        )

        if (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error calculating waiting location duration:', error)
          }
          setWaitingLocationDuration(null)
        } else {
          // 片道時間を表示（往復ではない）
          setWaitingLocationDuration(duration ? Math.round(duration / 2) : null)
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error calculating waiting location duration:', error)
        }
        setWaitingLocationDuration(null)
      } finally {
        setCalculatingWaitingDuration(false)
      }
    }

    calculateWaitingLocationDuration()
  }, [order.dropoff_address, relatedVehicle?.waiting_location_address])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const baseDurationMin = parseInt(formData.base_duration_min, 10)
      const bufferMin = parseInt(formData.buffer_min, 10)
      
      const waypoints = formData.waypoints
        .map((wp) => wp.trim())
        .filter((wp) => wp.length > 0)

        const updates = {
          pickup_address: formData.pickup_address,
          dropoff_address: formData.dropoff_address,
          waypoints: waypoints.length > 0 ? waypoints : null,
          contact_phone: formData.contact_phone || null,
          car_model: formData.car_model || null,
          car_plate: formData.car_plate || null,
          car_color: formData.car_color || null,
          parking_note: formData.parking_note || null,
          base_duration_min: baseDurationMin,
          buffer_min: bufferMin,
          buffer_manual: true,
        }
      
      // スロットが存在する場合は、関連するスロットのend_atを再計算
      const { data: existingSlots } = await supabase
        .from('dispatch_slots')
        .select('*')
        .eq('order_id', order.id)
      
      if (existingSlots && existingSlots.length > 0) {
        const totalDuration = baseDurationMin + bufferMin
        
        for (const slot of existingSlots) {
          // TENTATIVEのスロットのみ更新（CONFIRMEDのスロットは確定済みなので更新しない）
          if (slot.status === 'TENTATIVE') {
            const startAt = new Date(slot.start_at)
            const endAt = new Date(startAt)
            endAt.setMinutes(endAt.getMinutes() + totalDuration)
            
            await supabase
              .from('dispatch_slots')
              .update({ end_at: endAt.toISOString() })
              .eq('id', slot.id)
          }
        }
      }

      const { data: updatedOrder, error } = await updateOrder(order.id, updates)

      if (error) throw error

      onUpdate(updatedOrder)
      setEditing(false)
    } catch (error) {
      console.error('Error updating order:', error)
      alert('更新に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleRecalculateRoute = async () => {
    setRecalculating(true)
    try {
      // 出発地と目的地のバリデーション
      if (!formData.pickup_address || !formData.pickup_address.trim()) {
        alert('出発地を入力してください')
        setRecalculating(false)
        return
      }

      if (!formData.dropoff_address || !formData.dropoff_address.trim()) {
        alert('目的地を入力してください')
        setRecalculating(false)
        return
      }

      const waypoints = formData.waypoints
        .map((wp) => wp.trim())
        .filter((wp) => wp.length > 0)

      // 待機場所住所を取得（関連する車両の待機場所住所を使用、なければ最初の車両の待機場所住所）
      let waitingLocationAddress = null
      if (relatedVehicle?.waiting_location_address) {
        waitingLocationAddress = relatedVehicle.waiting_location_address
      } else {
        try {
          const { data: allVehicles } = await getVehicles()
          if (allVehicles && allVehicles.length > 0) {
            waitingLocationAddress = allVehicles[0].waiting_location_address || null
          }
        } catch (vehicleError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error fetching vehicles for waiting location:', vehicleError)
          }
        }
      }

      const { duration, error } = await estimateDuration(
        formData.pickup_address.trim(),
        formData.dropoff_address.trim(),
        waypoints.length > 0 ? waypoints : null,
        waitingLocationAddress
      )

      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Route calculation error:', error)
        }
        
        // エラーメッセージを詳細化
        let errorMessage = 'ルート計算に失敗しました'
        if (error === 'API key not configured') {
          errorMessage = 'Google Maps APIキーが設定されていません。.env.localファイルを確認してください。'
        } else if (error === 'Address is missing') {
          errorMessage = '出発地または目的地が入力されていません'
        } else if (error.includes('REQUEST_DENIED')) {
          if (error.includes('referer restrictions') || error.includes('referer restriction')) {
            errorMessage = 'APIキーにHTTPリファラー制限が設定されています。\n\n解決方法:\n1. Google Cloud Console (https://console.cloud.google.com/apis/credentials) にアクセス\n2. APIキーを選択\n3. 「アプリケーションの制限」を「なし」に変更（開発環境の場合）\n4. 「保存」をクリック\n\n※本番環境では、バックエンドAPI経由で呼び出すことを推奨します。'
          } else if (error.includes('This API project is not authorized')) {
            errorMessage = 'Directions APIが有効になっていません。\n\n解決方法:\n1. Google Cloud Console (https://console.cloud.google.com/apis/library) にアクセス\n2. 「Directions API」を検索\n3. 「有効にする」をクリック'
          } else {
            errorMessage = `APIキーの権限がありません。\n\nエラー詳細: ${error}\n\n確認事項:\n1. Directions APIが有効になっているか\n2. APIキーの制限設定が適切か（開発環境では「なし」を推奨）\n3. APIキーが正しく設定されているか\n\nGoogle Cloud Console: https://console.cloud.google.com/apis/credentials`
          }
        } else if (error.includes('OVER_QUERY_LIMIT')) {
          errorMessage = 'APIの使用量制限に達しました。課金設定を確認してください。'
        } else if (error.includes('ZERO_RESULTS')) {
          errorMessage = 'ルートが見つかりませんでした。住所を確認してください。'
        } else if (error.includes('INVALID_REQUEST')) {
          errorMessage = '無効なリクエストです。住所を確認してください。'
        } else {
          // その他のエラーも表示
          errorMessage = `ルート計算に失敗しました: ${error}`
        }
        
        alert(errorMessage)
        setRecalculating(false)
        return
      }

      if (!duration) {
        alert('ルート計算の結果が取得できませんでした')
        setRecalculating(false)
        return
      }

      const buffer = calculateBuffer(duration)
      const updates = {
        base_duration_min: duration,
        buffer_min: buffer,
        buffer_manual: false,
      }

      const { data: updatedOrder, error: updateError } = await updateOrder(
        order.id,
        updates
      )

      if (updateError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to update order:', updateError)
        }
        throw updateError
      }

      setFormData((prev) => ({
        ...prev,
        buffer_min: buffer,
      }))
      onUpdate(updatedOrder)
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error recalculating route:', error)
      }
      alert(`ルート再計算に失敗しました: ${error.message || error}`)
    } finally {
      setRecalculating(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirm('この依頼を確定しますか？')) {
      return
    }

    setLoading(true)
    try {
      // 依頼に関連するスロットを取得
      const { data: existingSlots, error: slotsError } = await supabase
        .from('dispatch_slots')
        .select('*')
        .eq('order_id', order.id)
        .eq('status', 'TENTATIVE')

      if (slotsError) {
        throw slotsError
      }

      let slotsToConfirm = existingSlots || []

      // スロットが存在しない場合（未割当の場合）、空き時間を見つけてスロットを作成
      if (slotsToConfirm.length === 0) {
        if (!vehicles || vehicles.length === 0) {
          alert('車両が登録されていません')
          setLoading(false)
          return
        }

        // 最新の依頼データを取得
        const { data: latestOrder, error: orderError } = await getOrderById(order.id)
        if (orderError) {
          throw orderError
        }

        // 所要時間を計算
        const baseDuration = latestOrder?.base_duration_min || 30
        const buffer = latestOrder?.buffer_min || calculateBuffer(baseDuration)
        const totalDuration = baseDuration + buffer

        // 開始時刻を決定（営業時間内なら現在時刻、営業時間外なら18:00）
        const now = new Date()
        const hours = now.getHours()
        let orderStartTime

        if (hours >= 18 || hours < 6) {
          // 営業時間内の場合、現在時刻以降の空き時間を探す
          orderStartTime = new Date(now)
        } else {
          // 営業時間外の場合、次の18:00
          orderStartTime = new Date(now)
          orderStartTime.setHours(18, 0, 0, 0)
          orderStartTime.setMinutes(0, 0, 0)
          if (hours >= 18) {
            orderStartTime.setDate(orderStartTime.getDate() + 1)
          }
        }

        // 最短の空き時間を見つける
        const availableSlot = findEarliestAvailableSlotAcrossVehicles(
          vehicles,
          slots,
          orderStartTime,
          totalDuration
        )

        if (!availableSlot) {
          alert('配置可能な時間が見つかりませんでした')
          setLoading(false)
          return
        }

        // スロットを作成
        const endAt = new Date(availableSlot.startAt)
        endAt.setMinutes(endAt.getMinutes() + totalDuration)

        const { data: newSlot, error: createError } = await createSlot({
          order_id: order.id,
          vehicle_id: availableSlot.vehicleId,
          start_at: availableSlot.startAt.toISOString(),
          end_at: endAt.toISOString(),
          status: 'TENTATIVE',
        })

        if (createError) {
          throw createError
        }

        if (newSlot) {
          slotsToConfirm = [newSlot]
        } else {
          alert('スロットの作成に失敗しました')
          setLoading(false)
          return
        }
      }

      // すべてのスロットを確定
      for (const slot of slotsToConfirm) {
        const { error: confirmError } = await confirmSlot(slot.id)
        if (confirmError) {
          throw confirmError
        }
      }

      // 依頼のステータスを更新
      const { data: updatedOrder, error: updateError } = await updateOrder(order.id, {
        status: 'CONFIRMED',
      })

      if (updateError) {
        throw updateError
      }

      // 親コンポーネントに更新を通知
      onUpdate(updatedOrder)
      
      alert('確定しました')
    } catch (error) {
      console.error('Error confirming slot:', error)
      alert(`確定に失敗しました: ${error.message || error}`)
    } finally {
      setLoading(false)
    }
  }

  // ひとつ前のステータスに戻す
  const handleRevertStatus = async () => {
    // ステータスの遷移を定義
    const statusRevertMap = {
      'COMPLETED': 'IN_TRANSIT',
      'IN_TRANSIT': 'PICKING_UP',
      'PICKING_UP': 'ARRIVED',
      'ARRIVED': 'CONFIRMED',
      'CONFIRMED': 'TENTATIVE',
    }

    const previousStatus = statusRevertMap[order.status]
    if (!previousStatus) {
      alert('戻すことができないステータスです')
      return
    }

    const statusLabels = {
      'IN_TRANSIT': '送客中',
      'PICKING_UP': '客車引取',
      'ARRIVED': '現地到着',
      'CONFIRMED': '確定',
      'TENTATIVE': '仮配置',
    }

    if (!confirm(`${statusLabels[previousStatus]}に戻しますか？`)) {
      return
    }

    setLoading(true)
    try {
      const { data: updatedOrder, error } = await updateOrder(order.id, {
        status: previousStatus,
      })

      if (error) throw error

      // スロットのステータスも更新（CONFIRMEDからTENTATIVEに戻す場合など）
      if (order.status === 'CONFIRMED' && previousStatus === 'TENTATIVE') {
        const { data: slots } = await supabase
          .from('dispatch_slots')
          .select('*')
          .eq('order_id', order.id)
          .eq('status', 'CONFIRMED')

        if (slots && slots.length > 0) {
          for (const slot of slots) {
            await supabase
              .from('dispatch_slots')
              .update({ status: 'TENTATIVE' })
              .eq('id', slot.id)
          }
        }
      } else if (previousStatus === 'CONFIRMED') {
        // 他のステータスからCONFIRMEDに戻す場合、スロットもCONFIRMEDに
        const { data: slots } = await supabase
          .from('dispatch_slots')
          .select('*')
          .eq('order_id', order.id)

        if (slots && slots.length > 0) {
          for (const slot of slots) {
            await supabase
              .from('dispatch_slots')
              .update({ status: 'CONFIRMED' })
              .eq('id', slot.id)
          }
        }
      }

      onUpdate(updatedOrder)
      alert('ステータスを戻しました')
    } catch (error) {
      console.error('Error reverting status:', error)
      alert(`ステータスの戻しに失敗しました: ${error.message || error}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('この依頼をキャンセルしますか？データベースからも削除されます。')) {
      return
    }

    setLoading(true)
    try {
      // データベースから依頼を削除（dispatch_slotsはON DELETE CASCADEで自動削除される）
      const { error: cancelError } = await cancelOrder(order.id)

      if (cancelError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error cancelling order:', cancelError)
        }
        throw cancelError
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('Order deleted successfully:', order.id)
      }

      // 親コンポーネントに削除を通知
      if (onDelete) {
        onDelete(order.id)
      }
      
      // パネルを閉じる
      onClose()
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error cancelling order:', error)
      }
      alert(`キャンセルに失敗しました: ${error.message || error}`)
    } finally {
      setLoading(false)
    }
  }

  const statusColor = {
    UNASSIGNED: 'default',
    TENTATIVE: 'warning',
    CONFIRMED: 'success',
    ARRIVED: 'info',
    PICKING_UP: 'info',
    IN_TRANSIT: 'info',
    COMPLETED: 'success',
    CANCELLED: 'error',
  }[order.status] || 'default'

  const statusLabel = {
    UNASSIGNED: '未割当',
    TENTATIVE: '仮配置',
    CONFIRMED: '確定',
    ARRIVED: '現地到着',
    PICKING_UP: '客車引取',
    IN_TRANSIT: '送客中',
    COMPLETED: '送客完了',
    CANCELLED: 'キャンセル',
  }[order.status] || '不明'

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
                  />
                </>
              ) : (
                <>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      出発地
                    </Typography>
                    <Typography variant="body2">{order.pickup_address}</Typography>
                  </Box>
                  {order.waypoints && order.waypoints.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        経由地
                      </Typography>
                      <Stack spacing={0.5}>
                        {order.waypoints.map((waypoint, index) => (
                          <Typography key={index} variant="body2" sx={{ pl: 1, borderLeft: 2, borderColor: 'divider' }}>
                            {index + 1}. {waypoint}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      目的地
                    </Typography>
                    <Typography variant="body2">{order.dropoff_address}</Typography>
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
                        {order.base_duration_min}分（基本）+ {order.buffer_min || 10}
                        分（バッファ）= {order.base_duration_min + (order.buffer_min || 10)}分
                      </>
                    ) : (
                      <>未計算（仮30分 + {order.buffer_min || 10}分 = {30 + (order.buffer_min || 10)}分）</>
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
                      const origin = encodeURIComponent(order.pickup_address)
                      const destination = encodeURIComponent(order.dropoff_address)
                      let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
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
              
              {/* 確定後のステータスボタン */}
              {order.status === 'CONFIRMED' && (
                <Button
                  variant="contained"
                  color="info"
                  onClick={async () => {
                    setLoading(true)
                    try {
                      const { data: updatedOrder, error } = await updateOrder(order.id, { status: 'ARRIVED' })
                      if (error) throw error
                      onUpdate(updatedOrder)
                    } catch (error) {
                      console.error('Error updating status:', error)
                      alert('ステータス更新に失敗しました')
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                  fullWidth
                >
                  現地到着
                </Button>
              )}
              {order.status === 'ARRIVED' && (
                <Button
                  variant="contained"
                  color="info"
                  onClick={async () => {
                    setLoading(true)
                    try {
                      const { data: updatedOrder, error } = await updateOrder(order.id, { status: 'PICKING_UP' })
                      if (error) throw error
                      onUpdate(updatedOrder)
                    } catch (error) {
                      console.error('Error updating status:', error)
                      alert('ステータス更新に失敗しました')
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                  fullWidth
                >
                  客車引取
                </Button>
              )}
              {order.status === 'PICKING_UP' && (
                <Button
                  variant="contained"
                  color="info"
                  onClick={async () => {
                    setLoading(true)
                    try {
                      const { data: updatedOrder, error } = await updateOrder(order.id, { status: 'IN_TRANSIT' })
                      if (error) throw error
                      onUpdate(updatedOrder)
                    } catch (error) {
                      console.error('Error updating status:', error)
                      alert('ステータス更新に失敗しました')
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                  fullWidth
                >
                  送客中
                </Button>
              )}
              {order.status === 'IN_TRANSIT' && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={async () => {
                    setLoading(true)
                    try {
                      const { data: updatedOrder, error } = await updateOrder(order.id, { status: 'COMPLETED' })
                      if (error) throw error
                      onUpdate(updatedOrder)
                    } catch (error) {
                      console.error('Error updating status:', error)
                      alert('ステータス更新に失敗しました')
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                  fullWidth
                >
                  送客完了
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
