import { useState, useEffect, useRef } from 'react'
import { createOrder, updateOrder } from '@/services/orderService'
import { estimateDuration, calculateBuffer } from '@/services/routeService'
import { getVehicles } from '@/services/vehicleService'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import Stack from '@mui/material/Stack'

// 現在時刻をdatetime-local形式に変換（15分刻みにスナップ）
const getCurrentDateTimeLocal = () => {
  const now = new Date()
  // 15分刻みにスナップ
  const minutes = Math.round(now.getMinutes() / 15) * 15
  const snappedDate = new Date(now)
  snappedDate.setMinutes(minutes, 0, 0)
  
  const year = snappedDate.getFullYear()
  const month = String(snappedDate.getMonth() + 1).padStart(2, '0')
  const day = String(snappedDate.getDate()).padStart(2, '0')
  const hours = String(snappedDate.getHours()).padStart(2, '0')
  const snappedMinutes = String(snappedDate.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${snappedMinutes}`
}

// 営業時間内かチェック（18:00〜翌06:00）
const isValidBusinessTime = (dateTimeString) => {
  if (!dateTimeString) return false
  
  const date = new Date(dateTimeString)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  
  // 18:00以降（当日）または翌06:00以前（翌日）が営業時間内
  // 06:00より大きく18:00より小さい場合は営業時間外
  if (hours >= 18 || hours < 6) {
    return true
  }
  
  return false
}

// 営業時間内の最小値を取得（当日の18:00）
const getMinBusinessDateTime = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T18:00`
}

export function OrderFormModal({ onClose, onOrderCreated, open }) {
  const [formData, setFormData] = useState({
    order_type: 'NOW',
    scheduled_at: '',
    pickup_location: '',
    pickup_address: '',
    dropoff_address: '',
    waypoints: [],
    contact_phone: '',
    car_model: '',
    car_plate: '',
    car_color: '',
    parking_note: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  // Places Autocomplete用のref
  const pickupAddressAutocompleteRef = useRef(null)
  const dropoffAddressAutocompleteRef = useRef(null)
  const waypointAutocompleteRefs = useRef({})

  // Google Places APIが読み込まれたらAutocompleteを初期化
  useEffect(() => {
    if (!open) return

    const initAutocomplete = () => {
      if (typeof window === 'undefined' || !window.google || !window.google.maps || !window.google.maps.places) {
        // Google Places APIがまだ読み込まれていない場合は再試行
        setTimeout(initAutocomplete, 100)
        return
      }

      const { Autocomplete } = window.google.maps.places

      // 三重県のboundsを設定（県外の候補を除外）
      const mieBounds = new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(33.7, 135.8),  // 三重県の南西の角（南牟婁郡）
        new window.google.maps.LatLng(35.2, 136.9)     // 三重県の北東の角（桑名市周辺）
      )

      // 出発地
      if (pickupAddressAutocompleteRef.current) {
        // Material-UIのTextFieldのinputRefは、実際のinput要素を参照する
        // ただし、TextFieldの内部構造により、直接input要素を取得する必要がある場合がある
        let inputElement = pickupAddressAutocompleteRef.current
        
        // inputRefがinput要素を直接参照していない場合、親要素からinput要素を探す
        if (!(inputElement instanceof HTMLInputElement)) {
          // TextFieldの内部構造を考慮して、input要素を探す
          const textFieldContainer = inputElement.closest ? inputElement.closest('.MuiInputBase-root') : null
          if (textFieldContainer) {
            inputElement = textFieldContainer.querySelector('input')
          }
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 出発地のref確認:', {
            originalRef: pickupAddressAutocompleteRef.current,
            inputElement,
            isInputElement: inputElement instanceof HTMLInputElement,
            tagName: inputElement?.tagName,
          })
        }
        
        if (inputElement && inputElement instanceof HTMLInputElement) {
          try {
            // 既存のAutocompleteがあれば削除
            if (inputElement._autocomplete) {
              window.google.maps.event.clearInstanceListeners(inputElement._autocomplete)
              delete inputElement._autocomplete
            }
            const autocomplete = new Autocomplete(inputElement, {
              componentRestrictions: { country: 'jp' },
              fields: ['formatted_address'],
              language: 'ja',
              bounds: mieBounds,
              strictBounds: true, // bounds外の候補を完全に除外（県外を非表示）
            })
            inputElement._autocomplete = autocomplete
            
            // Autocompleteのドロップダウンが表示されるように、z-indexを調整
            // Google Places Autocompleteのドロップダウンは通常、body要素の直下に追加される
            // しかし、Material-UIのDialog内では表示されない場合があるため、スタイルを調整
            if (!document.getElementById('pac-container-style')) {
              const style = document.createElement('style')
              style.id = 'pac-container-style'
              style.textContent = `
                .pac-container {
                  z-index: 1400 !important;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                }
                .pac-item {
                  cursor: pointer;
                  padding: 8px;
                }
                .pac-item:hover {
                  background-color: #f5f5f5;
                }
                .pac-item-selected {
                  background-color: #e3f2fd;
                }
              `
              document.head.appendChild(style)
            }
            
            // デバッグ用のイベントリスナー
            if (process.env.NODE_ENV === 'development') {
              // 入力イベントを監視
              inputElement.addEventListener('input', (e) => {
                console.log('⌨️ 入力イベント:', e.target.value)
                // Autocompleteの候補を手動で取得して確認
                if (window.google && window.google.maps && window.google.maps.places) {
                  const service = new window.google.maps.places.AutocompleteService()
                  service.getPlacePredictions(
                    {
                      input: e.target.value,
                      componentRestrictions: { country: 'jp' },
                      bounds: mieBounds,
                      strictBounds: true,
                    },
                    (predictions, status) => {
                      if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                        console.log('🔍 候補が見つかりました:', predictions)
                      } else {
                        console.log('⚠️ 候補が見つかりません:', status)
                      }
                    }
                  )
                }
              })
              // フォーカスイベントを監視
              inputElement.addEventListener('focus', () => {
                console.log('👁️ フォーカスイベント')
              })
            }
            
            autocomplete.addListener('place_changed', () => {
              const place = autocomplete.getPlace()
              if (process.env.NODE_ENV === 'development') {
                console.log('📍 place_changed イベント発火:', place)
              }
              if (place.formatted_address) {
                setFormData((prev) => ({ ...prev, pickup_address: place.formatted_address }))
                // エラーをクリア
                setErrors((prev) => ({ ...prev, pickup_address: null }))
              }
            })
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ 出発地のAutocompleteを初期化しました', {
                inputElement,
                autocomplete,
              })
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('❌ 出発地のAutocomplete初期化エラー:', error, inputElement)
            }
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ 出発地のinput要素が見つかりません:', {
              ref: pickupAddressAutocompleteRef.current,
              inputElement,
            })
          }
        }
      }

      // 目的地
      if (dropoffAddressAutocompleteRef.current) {
        const inputElement = dropoffAddressAutocompleteRef.current
        if (inputElement && inputElement instanceof HTMLInputElement) {
          try {
            // 既存のAutocompleteがあれば削除
            if (inputElement._autocomplete) {
              window.google.maps.event.clearInstanceListeners(inputElement._autocomplete)
              delete inputElement._autocomplete
            }
            const autocomplete = new Autocomplete(inputElement, {
              componentRestrictions: { country: 'jp' },
              fields: ['formatted_address'],
              language: 'ja',
              bounds: mieBounds,
              strictBounds: true, // bounds外の候補を完全に除外（県外を非表示）
            })
            inputElement._autocomplete = autocomplete
            autocomplete.addListener('place_changed', () => {
              const place = autocomplete.getPlace()
              if (place.formatted_address) {
                setFormData((prev) => ({ ...prev, dropoff_address: place.formatted_address }))
                // エラーをクリア
                setErrors((prev) => ({ ...prev, dropoff_address: null }))
              }
            })
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ 目的地のAutocompleteを初期化しました', inputElement)
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('❌ 目的地のAutocomplete初期化エラー:', error, inputElement)
            }
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ 目的地のrefがHTMLInputElementではありません:', dropoffAddressAutocompleteRef.current)
          }
        }
      }
    }

    // モーダルが開かれたら少し待ってから初期化（DOMが準備されるまで）
    const timer = setTimeout(initAutocomplete, 500)
    return () => clearTimeout(timer)
  }, [open])

  // 経由地のAutocompleteを初期化
  useEffect(() => {
    if (!open) return

    const initWaypointAutocomplete = () => {
      if (typeof window === 'undefined' || !window.google || !window.google.maps || !window.google.maps.places) {
        setTimeout(initWaypointAutocomplete, 100)
        return
      }

      const { Autocomplete } = window.google.maps.places

      // 三重県のboundsを設定（県外の候補を除外）
      const mieBounds = new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(33.7, 135.8),  // 三重県の南西の角（南牟婁郡）
        new window.google.maps.LatLng(35.2, 136.9)     // 三重県の北東の角（桑名市周辺）
      )

      // 既存の経由地フィールドにAutocompleteを適用
      Object.keys(waypointAutocompleteRefs.current).forEach((indexStr) => {
        const inputRef = waypointAutocompleteRefs.current[indexStr]
        if (inputRef && inputRef instanceof HTMLInputElement) {
          try {
            // 既存のAutocompleteがあれば削除
            if (inputRef._autocomplete) {
              window.google.maps.event.clearInstanceListeners(inputRef._autocomplete)
              delete inputRef._autocomplete
            }
            const waypointIndex = parseInt(indexStr, 10)
            const autocomplete = new Autocomplete(inputRef, {
              componentRestrictions: { country: 'jp' },
              fields: ['formatted_address'],
              language: 'ja',
              bounds: mieBounds,
              strictBounds: true, // bounds外の候補を完全に除外（県外を非表示）
            })
            inputRef._autocomplete = autocomplete
            autocomplete.addListener('place_changed', () => {
              const place = autocomplete.getPlace()
              if (process.env.NODE_ENV === 'development') {
                console.log(`📍 経由地 ${waypointIndex + 1}のplace_changed イベント発火:`, place)
              }
              if (place.formatted_address) {
                setFormData((prev) => {
                  const newWaypoints = [...prev.waypoints]
                  if (waypointIndex >= 0 && waypointIndex < newWaypoints.length) {
                    newWaypoints[waypointIndex] = place.formatted_address
                    if (process.env.NODE_ENV === 'development') {
                      console.log(`✅ 経由地 ${waypointIndex + 1}を更新:`, place.formatted_address)
                    }
                  }
                  return { ...prev, waypoints: newWaypoints }
                })
              }
            })
            if (process.env.NODE_ENV === 'development') {
              console.log(`✅ 経由地 ${waypointIndex + 1}のAutocompleteを初期化しました`, { waypointIndex, inputRef })
            }
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error(`❌ 経由地 ${indexStr}のAutocomplete初期化エラー:`, error)
            }
          }
        }
      })
    }

    const timer = setTimeout(initWaypointAutocomplete, 500)
    return () => clearTimeout(timer)
  }, [open, formData.waypoints.length])

  // モーダルが開かれたときにフォームをリセット
  useEffect(() => {
    if (open) {
      setFormData({
        order_type: 'NOW',
        scheduled_at: '',
        pickup_location: '',
        pickup_address: '',
        dropoff_address: '',
        waypoints: [],
        contact_phone: '',
        car_model: '',
        car_plate: '',
        car_color: '',
        parking_note: '',
      })
      setErrors({})
      // 経由地のAutocomplete refをクリア
      waypointAutocompleteRefs.current = {}
    }
  }, [open])

  // 日時を15分刻みにスナップ
  const snapDateTimeTo15Minutes = (dateTimeString) => {
    if (!dateTimeString) return dateTimeString
    
    const date = new Date(dateTimeString)
    const minutes = date.getMinutes()
    const snappedMinutes = Math.round(minutes / 15) * 15
    
    const snappedDate = new Date(date)
    snappedDate.setMinutes(snappedMinutes, 0, 0)
    
    const year = snappedDate.getFullYear()
    const month = String(snappedDate.getMonth() + 1).padStart(2, '0')
    const day = String(snappedDate.getDate()).padStart(2, '0')
    const hours = String(snappedDate.getHours()).padStart(2, '0')
    const snappedMinutesStr = String(snappedDate.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day}T${hours}:${snappedMinutesStr}`
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => {
      const newData = { ...prev, [name]: value }
      // 予約種別が「日時指定」に変更された場合、現在時刻をデフォルト値として設定
      if (name === 'order_type' && value === 'SCHEDULED' && !prev.scheduled_at) {
        newData.scheduled_at = getCurrentDateTimeLocal()
      }
      // 日時指定の場合は15分刻みにスナップ
      if (name === 'scheduled_at' && value) {
        const snapped = snapDateTimeTo15Minutes(value)
        newData.scheduled_at = snapped
        // 営業時間チェック
        if (!isValidBusinessTime(snapped)) {
          setErrors((prev) => ({
            ...prev,
            scheduled_at: '営業時間（18:00〜翌06:00）内で選択してください',
          }))
        } else {
          // 営業時間内の場合はエラーをクリア
          setErrors((prev) => ({ ...prev, scheduled_at: null }))
        }
      }
      return newData
    })
    // エラーをクリア（scheduled_at以外）
    if (errors[name] && name !== 'scheduled_at') {
      setErrors((prev) => ({ ...prev, [name]: null }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.pickup_address.trim()) {
      newErrors.pickup_address = '出発地を入力してください'
    }
    if (!formData.dropoff_address.trim()) {
      newErrors.dropoff_address = '目的地を入力してください'
    }
    if (formData.order_type === 'SCHEDULED' && !formData.scheduled_at) {
      newErrors.scheduled_at = '予約日時を入力してください'
    }
    
    // 営業時間チェック（18:00〜翌06:00）
    if (formData.order_type === 'SCHEDULED' && formData.scheduled_at) {
      if (!isValidBusinessTime(formData.scheduled_at)) {
        newErrors.scheduled_at = '営業時間（18:00〜翌06:00）内で選択してください'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault()
    }

    if (!validate()) {
      return
    }

    setLoading(true)

    try {
      // 依頼データの準備
      const waypoints = formData.waypoints
        .map((wp) => wp.trim())
        .filter((wp) => wp.length > 0)

      const orderData = {
        order_type: formData.order_type,
        pickup_location: formData.pickup_location.trim() || null,
        pickup_address: formData.pickup_address.trim(),
        dropoff_address: formData.dropoff_address.trim(),
        waypoints: waypoints.length > 0 ? waypoints : null,
        contact_phone: formData.contact_phone.trim() || null,
        car_model: formData.car_model.trim() || null,
        car_plate: formData.car_plate.trim() || null,
        car_color: formData.car_color.trim() || null,
        parking_note: formData.parking_note.trim() || null,
        status: 'UNASSIGNED',
      }

      if (formData.order_type === 'SCHEDULED' && formData.scheduled_at) {
        orderData.scheduled_at = new Date(formData.scheduled_at).toISOString()
      }

      // 依頼作成
      const { data: order, error: createError } = await createOrder(orderData)

      if (createError) {
        throw createError
      }

      // ルート計算（バックグラウンド）
      // ルート計算が完了するまで待機してから依頼を作成
      
      // 待機場所住所を取得（最初の車両の待機場所住所を使用）
      let waitingLocationAddress = null
      try {
        const { data: vehicles } = await getVehicles()
        if (vehicles && vehicles.length > 0) {
          // 最初の車両の待機場所住所を使用
          waitingLocationAddress = vehicles[0].waiting_location_address || null
        }
      } catch (vehicleError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error fetching vehicles for waiting location:', vehicleError)
        }
        // エラーでも続行（待機場所なしで計算）
      }

      const { duration, error } = await estimateDuration(
        order.pickup_address,
        order.dropoff_address,
        waypoints.length > 0 ? waypoints : null,
        waitingLocationAddress
      )
      
      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Route calculation error:', error)
        }
        // エラーでも依頼は作成済みなので、デフォルト値で更新
        // デフォルト値は30分（往復15分×2）に設定
        const defaultDuration = 30
        const defaultBuffer = calculateBuffer(defaultDuration)
        await updateOrder(order.id, {
          base_duration_min: defaultDuration,
          buffer_min: defaultBuffer,
          buffer_manual: false,
        })
      } else if (duration) {
        const buffer = calculateBuffer(duration)
        // 依頼を更新（base_durationとbufferを設定）
        const { error: updateError } = await updateOrder(order.id, {
          base_duration_min: duration,
          buffer_min: buffer,
          buffer_manual: false,
        })

        if (updateError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to update order with route data:', updateError)
          }
        }
      } else {
        // durationがnullの場合もデフォルト値で更新
        const defaultDuration = 30
        const defaultBuffer = calculateBuffer(defaultDuration)
        await updateOrder(order.id, {
          base_duration_min: defaultDuration,
          buffer_min: defaultBuffer,
          buffer_manual: false,
        })
      }

      onOrderCreated(order)
    } catch (error) {
      console.error('Error creating order:', error)
      setErrors({ submit: '依頼の作成に失敗しました。もう一度お試しください。' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      disableEnforceFocus={true}
      disableAutoFocus={false}
      PaperProps={{
        style: {
          overflow: 'visible',
          position: 'relative',
        },
      }}
      sx={{
        '& .MuiDialog-container': {
          overflow: 'visible',
        },
      }}
    >
      <DialogTitle>新規依頼（電話）</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          新しい依頼情報を入力してください
        </Typography>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              予約種別 <span style={{ color: '#ff4444' }}>*</span>
            </Typography>
            <RadioGroup
              row
              name="order_type"
              value={formData.order_type}
              onChange={handleChange}
            >
              <FormControlLabel value="NOW" control={<Radio />} label="今すぐ" />
              <FormControlLabel value="SCHEDULED" control={<Radio />} label="日時指定" />
            </RadioGroup>
          </Box>

          {formData.order_type === 'SCHEDULED' && (
            <TextField
              label="予約日時（15分刻み）"
              type="datetime-local"
              name="scheduled_at"
              value={formData.scheduled_at}
              onChange={handleChange}
              onBlur={(e) => {
                // フォーカスが外れたときにも15分刻みにスナップ
                if (e.target.value) {
                  const snapped = snapDateTimeTo15Minutes(e.target.value)
                  if (snapped !== e.target.value) {
                    setFormData((prev) => ({ ...prev, scheduled_at: snapped }))
                  }
                  // 営業時間チェック
                  if (!isValidBusinessTime(snapped)) {
                    setErrors((prev) => ({
                      ...prev,
                      scheduled_at: '営業時間（18:00〜翌06:00）内で選択してください',
                    }))
                  }
                }
              }}
              error={!!errors.scheduled_at}
              helperText={errors.scheduled_at || '15分刻みで選択してください（営業時間: 18:00〜翌06:00）'}
              fullWidth
              InputLabelProps={{
                shrink: true,
              }}
              inputProps={{
                step: 900, // 15分刻み（900秒 = 15分）
                min: getMinBusinessDateTime(), // 当日の18:00以降
              }}
              required
            />
          )}

          <TextField
            label="お迎え場所"
            name="pickup_location"
            value={formData.pickup_location}
            onChange={handleChange}
            error={!!errors.pickup_location}
            helperText={errors.pickup_location}
            placeholder="例: モンガータ"
            fullWidth
          />

          <TextField
            label="出発地"
            name="pickup_address"
            value={formData.pickup_address}
            onChange={handleChange}
            inputRef={pickupAddressAutocompleteRef}
            error={!!errors.pickup_address}
            helperText={errors.pickup_address}
            placeholder="例: 三重県鈴鹿市..."
            fullWidth
            required
          />

          <TextField
            label="目的地"
            name="dropoff_address"
            value={formData.dropoff_address}
            onChange={handleChange}
            inputRef={dropoffAddressAutocompleteRef}
            error={!!errors.dropoff_address}
            helperText={errors.dropoff_address}
            placeholder="例: 三重県鈴鹿市..."
            fullWidth
            required
          />

          {/* 経由地 */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
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
            <Stack spacing={1.5}>
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
                    inputRef={(ref) => {
                      if (ref) {
                        waypointAutocompleteRefs.current[index] = ref
                      } else {
                        delete waypointAutocompleteRefs.current[index]
                      }
                    }}
                    placeholder="例: 三重県鈴鹿市..."
                    fullWidth
                    size="small"
                  />
                  <IconButton
                    onClick={() => {
                      const newWaypoints = formData.waypoints.filter((_, i) => i !== index)
                      setFormData((prev) => ({ ...prev, waypoints: newWaypoints }))
                      // Autocomplete refをクリア
                      if (waypointAutocompleteRefs.current[index]) {
                        const ref = waypointAutocompleteRefs.current[index]
                        if (ref._autocomplete) {
                          window.google.maps.event.clearInstanceListeners(ref._autocomplete)
                          delete ref._autocomplete
                        }
                        delete waypointAutocompleteRefs.current[index]
                      }
                    }}
                    sx={{ mt: 0.5 }}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
              {formData.waypoints.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  経由地はありません
                </Typography>
              )}
            </Stack>
          </Box>

          <TextField
            label="連絡先電話番号"
            type="tel"
            name="contact_phone"
            value={formData.contact_phone}
            onChange={handleChange}
            placeholder="例: 090-1234-5678"
            fullWidth
          />

          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              車情報
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <TextField
                  label="車種"
                  type="text"
                  name="car_model"
                  value={formData.car_model}
                  onChange={handleChange}
                  placeholder="例: プリウス"
                />
                <TextField
                  label="色"
                  type="text"
                  name="car_color"
                  value={formData.car_color}
                  onChange={handleChange}
                  placeholder="例: 白"
                />
              </Box>
              <TextField
                label="ナンバー"
                type="text"
                name="car_plate"
                value={formData.car_plate}
                onChange={handleChange}
                placeholder="例: 三重500あ1234"
                fullWidth
              />
            </Box>
            <TextField
              label="駐車位置メモ"
              name="parking_note"
              value={formData.parking_note}
              onChange={handleChange}
              multiline
              rows={3}
              placeholder="駐車位置やその他のメモ..."
              fullWidth
            />
          </Box>

          {errors.submit && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errors.submit}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          キャンセル
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '保存中...' : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

