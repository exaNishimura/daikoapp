import { useState, useCallback } from 'react'
import {
  getCurrentDateTimeLocal,
  isWithinBusinessHours,
  snapDateTimeTo15Minutes,
} from '@/utils/businessDayUtils'
import { useCreateOrder, useUpdateOrder } from '@/hooks/useOrders'
import { getVehicles } from '@/services/vehicleService'
import { submitOrderWithRouteCalculation } from '@/lib/orderSubmission'

const INITIAL_FORM_DATA = {
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
}

const SCHEDULED_OUT_OF_HOURS = '営業時間（18:00〜翌06:00）内で選択してください'

/**
 * 新規依頼フォームの状態管理 + 送信フローをまとめた hook。
 *
 * - フォームの値、エラー、送信中フラグ
 * - handleChange / handleScheduledBlur / waypoint 操作
 * - reset（モーダルが開かれたタイミングで呼ぶ想定）
 * - submit（依頼作成 + ルート計算反映までを一括実行）
 *
 * @param {Object} options
 * @param {(order: Object) => void} [options.onSuccess]
 * @returns {Object}
 */
export function useOrderForm({ onSuccess } = {}) {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA)
  const [errors, setErrors] = useState({})

  const createOrderMutation = useCreateOrder()
  const updateOrderMutation = useUpdateOrder()
  const loading = createOrderMutation.isPending || updateOrderMutation.isPending

  const reset = useCallback(() => {
    setFormData(INITIAL_FORM_DATA)
    setErrors({})
  }, [])

  const updateField = useCallback((name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleChange = useCallback((e) => {
    const { name, value } = e.target

    setFormData((prev) => {
      const next = { ...prev, [name]: value }

      // 「日時指定」に切り替わったとき、現在時刻をデフォルト値として埋める
      if (name === 'order_type' && value === 'SCHEDULED' && !prev.scheduled_at) {
        next.scheduled_at = getCurrentDateTimeLocal()
      }

      // scheduled_at 変更時は 15 分刻みにスナップ + 営業時間チェック
      if (name === 'scheduled_at' && value) {
        const snapped = snapDateTimeTo15Minutes(value)
        next.scheduled_at = snapped
        setErrors((prevErrors) => {
          const cleared = { ...prevErrors }
          if (!isWithinBusinessHours(snapped)) {
            cleared.scheduled_at = SCHEDULED_OUT_OF_HOURS
          } else {
            cleared.scheduled_at = null
          }
          return cleared
        })
      }

      return next
    })

    // scheduled_at 以外はエラーをクリア（残しておくとちらつく）
    if (name !== 'scheduled_at') {
      setErrors((prev) => (prev[name] ? { ...prev, [name]: null } : prev))
    }
  }, [])

  const handleScheduledBlur = useCallback((e) => {
    const value = e.target.value
    if (!value) return
    const snapped = snapDateTimeTo15Minutes(value)
    if (snapped !== value) {
      setFormData((prev) => ({ ...prev, scheduled_at: snapped }))
    }
    if (!isWithinBusinessHours(snapped)) {
      setErrors((prev) => ({ ...prev, scheduled_at: SCHEDULED_OUT_OF_HOURS }))
    }
  }, [])

  const addWaypoint = useCallback(() => {
    setFormData((prev) => ({ ...prev, waypoints: [...prev.waypoints, ''] }))
  }, [])

  const updateWaypoint = useCallback((index, value) => {
    setFormData((prev) => {
      const next = [...prev.waypoints]
      next[index] = value
      return { ...prev, waypoints: next }
    })
  }, [])

  const removeWaypoint = useCallback((index) => {
    setFormData((prev) => ({
      ...prev,
      waypoints: prev.waypoints.filter((_, i) => i !== index),
    }))
  }, [])

  const validate = useCallback(() => {
    const newErrors = {}

    if (!formData.pickup_address.trim()) {
      newErrors.pickup_address = '出発地を入力してください'
    }
    if (!formData.dropoff_address.trim()) {
      newErrors.dropoff_address = '目的地を入力してください'
    }
    if (formData.order_type === 'SCHEDULED') {
      if (!formData.scheduled_at) {
        newErrors.scheduled_at = '予約日時を入力してください'
      } else if (!isWithinBusinessHours(formData.scheduled_at)) {
        newErrors.scheduled_at = SCHEDULED_OUT_OF_HOURS
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleSubmit = useCallback(
    async (e) => {
      if (e?.preventDefault) e.preventDefault()
      if (!validate()) return

      try {
        const order = await submitOrderWithRouteCalculation({
          formData,
          createOrder: (payload) => createOrderMutation.mutateAsync(payload),
          updateOrder: (args) => updateOrderMutation.mutateAsync(args),
          fetchVehicles: async () => {
            const { data, error } = await getVehicles()
            if (error) throw error
            return data || []
          },
        })
        onSuccess?.(order)
      } catch (error) {
        console.error('Error creating order:', error)
        setErrors({ submit: '依頼の作成に失敗しました。もう一度お試しください。' })
      }
    },
    [formData, validate, createOrderMutation, updateOrderMutation, onSuccess]
  )

  return {
    formData,
    errors,
    loading,
    setFormData,
    setErrors,
    updateField,
    handleChange,
    handleScheduledBlur,
    addWaypoint,
    updateWaypoint,
    removeWaypoint,
    validate,
    handleSubmit,
    reset,
  }
}
