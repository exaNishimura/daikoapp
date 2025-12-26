/**
 * 随伴車の稼働状況を判定するユーティリティ
 */

/**
 * 指定時刻で車両が稼働中かどうかを判定
 * @param {string} vehicleId - 車両ID
 * @param {Date} targetTime - 判定対象時刻
 * @param {Array} operationStatuses - 稼働状況設定の配列
 * @returns {boolean} 稼働中の場合true
 */
export function isVehicleOperational(vehicleId, targetTime, operationStatuses) {
  if (!operationStatuses || operationStatuses.length === 0) {
    // 設定がない場合はデフォルトで稼働
    return true
  }

  // 対象日付を取得（営業日: 18:00〜翌06:00）
  const targetDate = new Date(targetTime)
  const targetHours = targetDate.getHours()
  const targetMinutesValue = targetDate.getMinutes()

  // 営業日の開始時刻（18:00）を基準に日付を判定
  let businessDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
  if (targetHours < 6) {
    // 06:00未満の場合は前日の営業日として扱う
    businessDate.setDate(businessDate.getDate() - 1)
  }

  // 対象日の稼働状況設定をフィルタ
  const dateStr = businessDate.toISOString().split('T')[0]
  const dayStatuses = operationStatuses.filter(status => {
    const statusDate = new Date(status.date + 'T00:00:00')
    return statusDate.toISOString().split('T')[0] === dateStr
  })

  if (dayStatuses.length === 0) {
    // 対象日の設定がない場合はデフォルトで稼働
    return true
  }

  // 優先順位: START > STOP > DAY_OFF > DEFAULT
  // より後の時刻の設定を優先
  const sortedStatuses = dayStatuses.sort((a, b) => {
    const priorityOrder = { START: 4, STOP: 3, DAY_OFF: 2, DEFAULT: 1 }
    const aPriority = priorityOrder[a.type] || 0
    const bPriority = priorityOrder[b.type] || 0

    if (aPriority !== bPriority) {
      return bPriority - aPriority // 優先度の高い順
    }

    // 同じ優先度の場合、時刻で比較
    if (a.time && b.time) {
      const aTime = a.time.split(':').map(Number)
      const bTime = b.time.split(':').map(Number)
      const aMinutes = aTime[0] * 60 + aTime[1]
      const bMinutes = bTime[0] * 60 + bTime[1]
      return bMinutes - aMinutes // より後の時刻を優先
    }

    // timeがない場合（DAY_OFF）は先に評価
    if (!a.time) return -1
    if (!b.time) return 1

    return 0
  })

  // 対象時刻に適用される設定を判定（総分数に変換）
  const targetMinutes = targetHours * 60 + targetMinutesValue

  for (const status of sortedStatuses) {
    if (status.type === 'DAY_OFF') {
      // 1日稼働しない: 全日（18:00〜翌06:00）を非稼働
      // ただし、より後の時刻にSTARTがあれば上書きされる
      // ここでは一旦非稼働として扱い、後続のSTARTで上書きされる可能性を考慮
      continue
    }

    if (status.type === 'DEFAULT') {
      // 基本は稼働: 常に稼働
      return true
    }

    if (status.type === 'STOP') {
      // 途中で稼働停止: 指定時刻以降を非稼働
      if (status.time) {
        const [hours, minutes] = status.time.split(':').map(Number)
        const stopMinutes = hours * 60 + minutes
        if (targetMinutes >= stopMinutes) {
          // 停止時刻以降は非稼働
          // ただし、より後の時刻にSTARTがあれば上書きされる
          continue
        }
      }
    }

    if (status.type === 'START') {
      // 途中で稼働開始: 指定時刻以降を稼働
      if (status.time) {
        const [hours, minutes] = status.time.split(':').map(Number)
        const startMinutes = hours * 60 + minutes
        if (targetMinutes >= startMinutes) {
          return true // 開始時刻以降は稼働
        }
      }
    }
  }

  // DAY_OFFが設定されている場合、デフォルトで非稼働
  const hasDayOff = dayStatuses.some(s => s.type === 'DAY_OFF')
  if (hasDayOff) {
    // STOPが設定されているかチェック
    const hasStop = dayStatuses.some(s => s.type === 'STOP' && s.time)
    if (hasStop) {
      // STOPの時刻より前の場合、DAY_OFFが適用される
      const stopStatus = dayStatuses.find(s => s.type === 'STOP' && s.time)
      if (stopStatus) {
        const [hours, minutes] = stopStatus.time.split(':').map(Number)
        const stopMinutes = hours * 60 + minutes
        if (targetMinutes < stopMinutes) {
          return false // DAY_OFFが適用される
        }
      }
    } else {
      // STOPがない場合、全日がDAY_OFF
      return false
    }
  }

  // デフォルトで稼働
  return true
}

/**
 * 指定時刻で稼働中の車両リストを取得
 * @param {Array} vehicles - 車両の配列
 * @param {Date} targetTime - 判定対象時刻
 * @param {Object} operationStatusesMap - vehicleIdをキーとした稼働状況設定のマップ
 * @returns {Array} 稼働中の車両の配列
 */
export function getOperationalVehicles(vehicles, targetTime, operationStatusesMap) {
  if (!vehicles || vehicles.length === 0) {
    return []
  }

  return vehicles.filter(vehicle => {
    const statuses = operationStatusesMap[vehicle.id] || []
    return isVehicleOperational(vehicle.id, targetTime, statuses)
  })
}

/**
 * 複数の稼働状況設定をマージし、優先順位を適用
 * @param {Array} statuses - 稼働状況設定の配列
 * @returns {Array} マージされた稼働状況設定の配列
 */
export function mergeOperationStatuses(statuses) {
  if (!statuses || statuses.length === 0) {
    return []
  }

  // 優先順位: START > STOP > DAY_OFF > DEFAULT
  const priorityOrder = { START: 4, STOP: 3, DAY_OFF: 2, DEFAULT: 1 }

  return statuses
    .slice()
    .sort((a, b) => {
      const aPriority = priorityOrder[a.type] || 0
      const bPriority = priorityOrder[b.type] || 0

      if (aPriority !== bPriority) {
        return bPriority - aPriority
      }

      // 同じ優先度の場合、時刻で比較
      if (a.time && b.time) {
        const aTime = a.time.split(':').map(Number)
        const bTime = b.time.split(':').map(Number)
        const aMinutes = aTime[0] * 60 + aTime[1]
        const bMinutes = bTime[0] * 60 + bTime[1]
        return bMinutes - aMinutes
      }

      if (!a.time) return -1
      if (!b.time) return 1

      return 0
    })
}

