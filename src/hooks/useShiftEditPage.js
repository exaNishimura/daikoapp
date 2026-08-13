import { useEffect, useMemo, useState } from 'react'
import {
  useShiftsByMonth,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  useDeleteShiftsByDate,
} from '@/hooks/useShifts'
import { useEmployees } from '@/hooks/useEmployees'
import {
  buildStaffColorByName,
  getEmployeeSelectOptions,
  resolveShiftEmployee,
  toShiftStaffFields,
} from '@/lib/staffFromEmployees'
import {
  DOW_MAP,
  getDaysInMonth,
  getShiftPlannedTimesForCopy,
  withPlannedShiftTimes,
} from '@/lib/shiftEditUtils'

const EMPTY_NEW_SHIFT = {
  car: '',
  role: '',
  employee_id: '',
  start: '',
  end: '',
  note: '',
}

/**
 * ShiftEditPage 用のステート + ハンドラーをまとめた hook
 *
 * - フェッチ系: useShiftsByMonth / useEmployees
 * - 編集系: 日次の新規追加、既存シフトの編集、一括保存、削除、ステータス変更
 * - コピー系: 単日コピー、一括コピー
 *
 * UI 由来の state (router の year/month) は呼び出し側に残し、
 * ここでは描画に必要な集計と CRUD のみを提供する。
 */
export function useShiftEditPage({ year, month }) {
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [editingDates, setEditingDates] = useState({})
  const [newShifts, setNewShifts] = useState({})
  const [editingShiftIds, setEditingShiftIds] = useState({})
  const [editingShifts, setEditingShifts] = useState({})
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copyTargetDate, setCopyTargetDate] = useState(null)
  const [copyDestDates, setCopyDestDates] = useState({})
  const [bulkCopyDialogOpen, setBulkCopyDialogOpen] = useState(false)
  const [bulkCopySourceDate, setBulkCopySourceDate] = useState('')
  const [expandedDates, setExpandedDates] = useState(() => {
    const expanded = {}
    if (year && month) {
      getDaysInMonth(year, month).forEach(({ date }) => {
        expanded[date] = true
      })
    }
    return expanded
  })

  const days = useMemo(() => {
    if (!year || !month) return []
    return getDaysInMonth(year, month)
  }, [year, month])

  const selectedCopyDestCount = useMemo(
    () => Object.values(copyDestDates).filter(Boolean).length,
    [copyDestDates]
  )

  // 月が変わったら一括コピーの選択をリセット
  useEffect(() => {
    setCopyDestDates({})
  }, [year, month])

  const shiftsQuery = useShiftsByMonth(year, month)
  const employeesQuery = useEmployees()
  const createShiftMutation = useCreateShift()
  const updateShiftMutation = useUpdateShift()
  const deleteShiftMutation = useDeleteShift()
  const deleteShiftsByDateMutation = useDeleteShiftsByDate()

  const shifts = shiftsQuery.data ?? []
  const employees = employeesQuery.data ?? []
  const fetchError = shiftsQuery.error
  const isMutating =
    createShiftMutation.isPending ||
    updateShiftMutation.isPending ||
    deleteShiftMutation.isPending ||
    deleteShiftsByDateMutation.isPending
  const loading = shiftsQuery.isLoading || isMutating

  const statuses = useMemo(() => {
    const map = {}
    shifts.forEach((shift) => {
      if (shift.status) {
        map[shift.date] = shift.status
      }
    })
    return map
  }, [shifts])

  const staffColorByName = useMemo(() => {
    const shiftNames = shifts
      .filter((s) => !s.status)
      .map((s) => s.staff)
      .filter(Boolean)
    return buildStaffColorByName(employees, shiftNames)
  }, [employees, shifts])
  const employeeSelectOptions = useMemo(
    () => getEmployeeSelectOptions(employees, shifts),
    [employees, shifts]
  )

  const getShiftsForDate = (date) => shifts.filter((s) => s.date === date && !s.status)

  // ──────────────────────────── 新規追加 ────────────────────────────
  const handleStartEdit = (date) => {
    setEditingDates((prev) => ({ ...prev, [date]: true }))
    setNewShifts((prev) => ({ ...prev, [date]: { ...EMPTY_NEW_SHIFT } }))
  }

  const handleCancelEdit = (date) => {
    setEditingDates((prev) => {
      const next = { ...prev }
      delete next[date]
      return next
    })
    setNewShifts((prev) => {
      const next = { ...prev }
      delete next[date]
      return next
    })
  }

  const handleAddShift = async (date) => {
    const shiftData = newShifts[date]
    if (
      !shiftData ||
      !shiftData.car ||
      !shiftData.role ||
      !shiftData.employee_id ||
      !shiftData.start ||
      !shiftData.end
    ) {
      setError('車両、役割、スタッフ、開始時刻、終了時刻は必須です')
      return
    }

    setError(null)
    setSuccess(null)

    try {
      const dow = DOW_MAP[new Date(date).getDay()]
      await createShiftMutation.mutateAsync(
        withPlannedShiftTimes({
          date,
          dow,
          car: shiftData.car,
          role: shiftData.role,
          ...toShiftStaffFields(shiftData.employee_id, employees),
          start: shiftData.start,
          end: shiftData.end,
          note: shiftData.note || null,
        })
      )
      setNewShifts((prev) => ({ ...prev, [date]: { ...EMPTY_NEW_SHIFT } }))
      setSuccess('シフトを追加しました')
    } catch (err) {
      setError(`シフトの追加に失敗: ${err.message}`)
    }
  }

  // ──────────────────────────── 既存編集 ────────────────────────────
  const handleStartEditShift = (shift) => {
    setEditingShiftIds((prev) => ({ ...prev, [shift.id]: true }))
    setEditingShifts((prev) => ({
      ...prev,
      [shift.id]: {
        car: shift.car,
        role: shift.role,
        employee_id: shift.employee_id || resolveShiftEmployee(shift, employees)?.id || '',
        start: shift.planned_start ?? shift.start,
        end: shift.planned_end ?? shift.end,
        note: shift.note || '',
      },
    }))
  }

  const handleCancelEditShift = (shiftId) => {
    setEditingShiftIds((prev) => {
      const next = { ...prev }
      delete next[shiftId]
      return next
    })
    setEditingShifts((prev) => {
      const next = { ...prev }
      delete next[shiftId]
      return next
    })
  }

  /**
   * 個別保存はせず、handleSaveAll で一括保存する設計。
   * 必須項目だけここでチェックする (UX 上のフィードバック用)。
   */
  const handleUpdateShift = async (shiftId /*, date */) => {
    const shiftData = editingShifts[shiftId]
    if (
      !shiftData ||
      !shiftData.car ||
      !shiftData.role ||
      !shiftData.employee_id ||
      !shiftData.start ||
      !shiftData.end
    ) {
      setError('車両、役割、スタッフ、開始時刻、終了時刻は必須です')
    }
  }

  const handleSaveAll = async () => {
    if (Object.keys(editingShifts).length === 0) {
      setError('保存するシフトがありません。シフトを編集してから保存してください。')
      return
    }

    const invalidShifts = Object.keys(editingShifts).filter((shiftId) => {
      const s = editingShifts[shiftId]
      return !s || !s.car || !s.role || !s.employee_id || !s.start || !s.end
    })

    if (invalidShifts.length > 0) {
      setError(
        '編集中のシフトに必須項目が未入力です。車両、役割、スタッフ、開始時刻、終了時刻は必須です'
      )
      return
    }

    setError(null)
    setSuccess(null)

    try {
      const shiftIdToDateMap = {}
      shifts.forEach((shift) => {
        if (editingShifts[shift.id]) {
          shiftIdToDateMap[shift.id] = shift.date
        }
      })

      const updatePromises = Object.keys(editingShifts)
        .map((shiftId) => {
          const shiftData = editingShifts[shiftId]
          const date = shiftIdToDateMap[shiftId]
          if (!date) return null
          const dow = DOW_MAP[new Date(date).getDay()]
          return updateShiftMutation.mutateAsync({
            id: shiftId,
            shiftData: withPlannedShiftTimes({
              car: shiftData.car,
              role: shiftData.role,
              ...toShiftStaffFields(shiftData.employee_id, employees),
              start: shiftData.start,
              end: shiftData.end,
              note: shiftData.note || null,
              dow,
            }),
          })
        })
        .filter(Boolean)

      await Promise.all(updatePromises)
      setEditingShiftIds({})
      setEditingShifts({})
      setSuccess(`${updatePromises.length}件のシフトを更新しました`)
    } catch (err) {
      setError(`一部のシフトの更新に失敗しました: ${err.message}`)
    }
  }

  // ──────────────────────────── コピー系 ────────────────────────────
  const handleCopyFromDate = async (sourceDate) => {
    const sourceShifts = getShiftsForDate(sourceDate)
    if (sourceShifts.length === 0) {
      setError('選択した日付にシフトが設定されていません')
      setCopyDialogOpen(false)
      return
    }

    setError(null)
    setSuccess(null)

    try {
      await deleteShiftsByDateMutation.mutateAsync(copyTargetDate)
      const dow = DOW_MAP[new Date(copyTargetDate).getDay()]

      await Promise.all(
        sourceShifts.map((shift) => {
          const planned = getShiftPlannedTimesForCopy(shift)
          return createShiftMutation.mutateAsync({
            date: copyTargetDate,
            dow,
            car: shift.car,
            role: shift.role,
            ...toShiftStaffFields(shift.employee_id, employees),
            note: shift.note || null,
            ...planned,
          })
        })
      )
      setSuccess(`${sourceDate}の${sourceShifts.length}件をコピー先に上書きしました`)
    } catch (err) {
      setError(`コピーに失敗しました: ${err.message}`)
    } finally {
      setCopyDialogOpen(false)
    }
  }

  const handleBulkCopyExecute = async () => {
    if (!bulkCopySourceDate) {
      setError('コピー元の日付を選択してください')
      return
    }
    const sourceShifts = getShiftsForDate(bulkCopySourceDate)
    if (sourceShifts.length === 0) {
      setError('コピー元にシフトが設定されていません')
      return
    }
    const targets = days
      .map(({ date }) => date)
      .filter((date) => copyDestDates[date] && date !== bulkCopySourceDate)

    if (targets.length === 0) {
      setError('コピー先がありません。コピー元以外の日にチェックを入れてください。')
      return
    }

    setError(null)
    setSuccess(null)

    try {
      for (const targetDate of targets) {
        await deleteShiftsByDateMutation.mutateAsync(targetDate)
        const dow = DOW_MAP[new Date(targetDate).getDay()]
        await Promise.all(
          sourceShifts.map((shift) => {
            const planned = getShiftPlannedTimesForCopy(shift)
            return createShiftMutation.mutateAsync({
              date: targetDate,
              dow,
              car: shift.car,
              role: shift.role,
              ...toShiftStaffFields(shift.employee_id, employees),
              note: shift.note || null,
              ...planned,
            })
          })
        )
      }

      setCopyDestDates({})
      setBulkCopyDialogOpen(false)
      setBulkCopySourceDate('')
      setSuccess(
        `${bulkCopySourceDate}の${sourceShifts.length}件を${targets.length}日分上書きしました`
      )
    } catch (err) {
      setError(`一括コピーに失敗しました: ${err.message}`)
    }
  }

  // ──────────────────────────── 削除 / ステータス ────────────────────────────
  const handleDeleteShift = async (id /*, _date */) => {
    if (!confirm('このシフトを削除しますか？')) return

    setError(null)
    setSuccess(null)

    try {
      await deleteShiftMutation.mutateAsync(id)
      setSuccess('シフトを削除しました')
    } catch (err) {
      setError(`削除に失敗: ${err.message}`)
    }
  }

  const handleSetStatus = async (date, status) => {
    setError(null)
    setSuccess(null)

    try {
      await deleteShiftsByDateMutation.mutateAsync(date)
      if (status) {
        const dow = DOW_MAP[new Date(date).getDay()]
        await createShiftMutation.mutateAsync({ date, dow, status })
        setSuccess('ステータスを更新しました')
      } else {
        setSuccess('ステータスを解除しました')
      }
    } catch (err) {
      setError(`ステータスの保存に失敗: ${err.message}`)
    }
  }

  return {
    // データ
    shifts,
    employees,
    fetchError,
    loading,
    days,
    statuses,
    staffColorByName,
    employeeSelectOptions,
    getShiftsForDate,
    refetchShifts: shiftsQuery.refetch,

    // フィードバック
    error,
    success,
    setError,
    setSuccess,

    // 折りたたみ
    expandedDates,
    setExpandedDates,

    // 新規追加
    editingDates,
    newShifts,
    setNewShifts,
    handleStartEdit,
    handleCancelEdit,
    handleAddShift,

    // 既存編集
    editingShiftIds,
    editingShifts,
    setEditingShifts,
    handleStartEditShift,
    handleCancelEditShift,
    handleUpdateShift,
    handleSaveAll,

    // コピー (単日)
    copyDialogOpen,
    setCopyDialogOpen,
    copyTargetDate,
    setCopyTargetDate,
    handleCopyFromDate,

    // 一括コピー
    copyDestDates,
    setCopyDestDates,
    selectedCopyDestCount,
    bulkCopyDialogOpen,
    setBulkCopyDialogOpen,
    bulkCopySourceDate,
    setBulkCopySourceDate,
    handleBulkCopyExecute,

    // 削除 / ステータス
    handleDeleteShift,
    handleSetStatus,
  }
}
