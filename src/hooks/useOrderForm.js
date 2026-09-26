import { useState, useCallback } from 'react'
import { defaultReservationDateTimeLocal } from '@/lib/reservation/reservationTime'
import { formatHourClock, getOperatingHours } from '@/lib/operatingHours'
import {
  isFutureBusinessNight,
  isWithinReservationHours,
  snapDateTimeTo15Minutes,
} from '@/utils/businessDayUtils'
import { useCreateOrder, useUpdateOrder } from '@/hooks/useOrders'
import {
  useCreateReservation,
  useDeleteReservation,
  useUpdateReservation,
} from '@/hooks/useReservations'
import { getVehicles } from '@/services/vehicleService'
import { submitFutureNightOrder, submitOrderWithRouteCalculation } from '@/lib/orderSubmission'

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

function scheduledOutOfHoursMessage() {
  const { reservationStartHour, businessEndHour } = getOperatingHours()
  return `予約時間（${formatHourClock(reservationStartHour)}〜翌${formatHourClock(businessEndHour)}）内で選択してください`
}

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
 * @param {(result: { order: Object, reservation: Object, nightKey: string, orderLinkFailed: boolean }) => void} [options.onScheduledSaved]
 * @returns {Object}
 */
export function useOrderForm({ onSuccess, onScheduledSaved } = {}) {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA)
  const [errors, setErrors] = useState({})

  const createOrderMutation = useCreateOrder()
  const updateOrderMutation = useUpdateOrder()
  const createReservationMutation = useCreateReservation()
  const updateReservationMutation = useUpdateReservation()
  const deleteReservationMutation = useDeleteReservation()
  const loading =
    createOrderMutation.isPending ||
    updateOrderMutation.isPending ||
    createReservationMutation.isPending ||
    updateReservationMutation.isPending ||
    deleteReservationMutation.isPending

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

      // 「日時指定」に切り替わったとき、営業夜のデフォルト（時間外ならその夜の予約開始）
      if (name === 'order_type' && value === 'SCHEDULED' && !prev.scheduled_at) {
        next.scheduled_at = defaultReservationDateTimeLocal()
      }

      // scheduled_at 変更時は 15 分刻みにスナップ + 営業時間チェック
      if (name === 'scheduled_at' && value) {
        const snapped = snapDateTimeTo15Minutes(value)
        next.scheduled_at = snapped
        setErrors((prevErrors) => {
          const cleared = { ...prevErrors }
          if (!isWithinReservationHours(snapped)) {
            cleared.scheduled_at = scheduledOutOfHoursMessage()
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
    if (!isWithinReservationHours(snapped)) {
      setErrors((prev) => ({ ...prev, scheduled_at: scheduledOutOfHoursMessage() }))
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
      } else if (!isWithinReservationHours(formData.scheduled_at)) {
        newErrors.scheduled_at = scheduledOutOfHoursMessage()
      } else if (isFutureBusinessNight(formData.scheduled_at) && !formData.contact_phone.trim()) {
        newErrors.contact_phone = '予約台帳に保存するため電話番号を入力してください'
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
        if (formData.order_type === 'SCHEDULED' && isFutureBusinessNight(formData.scheduled_at)) {
          const saved = await submitFutureNightOrder({
            formData,
            createReservation: (payload) => createReservationMutation.mutateAsync(payload),
            createOrder: (payload) => createOrderMutation.mutateAsync(payload),
            updateOrder: (args) => updateOrderMutation.mutateAsync(args),
            updateReservation: (id, patch) => updateReservationMutation.mutateAsync({ id, patch }),
            deleteReservation: (id) => deleteReservationMutation.mutateAsync(id),
            fetchVehicles: async () => {
              const { data, error } = await getVehicles()
              if (error) throw error
              return data || []
            },
          })
          onScheduledSaved?.(saved)
          return
        }

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
    [
      formData,
      validate,
      createOrderMutation,
      updateOrderMutation,
      createReservationMutation,
      updateReservationMutation,
      deleteReservationMutation,
      onSuccess,
      onScheduledSaved,
    ]
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
