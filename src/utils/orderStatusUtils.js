/**
 * 依頼ステータスに関する定数と遷移ヘルパー
 *
 * ステータスは下記の流れで進行する:
 *   UNASSIGNED -> TENTATIVE -> CONFIRMED -> ARRIVED -> PICKING_UP -> IN_TRANSIT -> COMPLETED
 *   (CANCELLED は終端)
 *
 * 「ステータスを戻す」操作は逆順に 1 段階だけ巻き戻す。
 */

export const ORDER_STATUS = Object.freeze({
  UNASSIGNED: 'UNASSIGNED',
  TENTATIVE: 'TENTATIVE',
  CONFIRMED: 'CONFIRMED',
  ARRIVED: 'ARRIVED',
  PICKING_UP: 'PICKING_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
})

export const STATUS_LABELS = Object.freeze({
  UNASSIGNED: '未割当',
  TENTATIVE: '仮配置',
  CONFIRMED: '確定',
  ARRIVED: '現地到着',
  PICKING_UP: '客車引取',
  IN_TRANSIT: '送客中',
  COMPLETED: '送客完了',
  CANCELLED: 'キャンセル',
})

export const STATUS_COLORS = Object.freeze({
  UNASSIGNED: 'default',
  TENTATIVE: 'warning',
  CONFIRMED: 'success',
  ARRIVED: 'info',
  PICKING_UP: 'info',
  IN_TRANSIT: 'info',
  COMPLETED: 'success',
  CANCELLED: 'error',
})

/**
 * 1 段階前に戻す対応表（逆方向の遷移）
 */
export const STATUS_REVERT_MAP = Object.freeze({
  COMPLETED: 'IN_TRANSIT',
  IN_TRANSIT: 'PICKING_UP',
  PICKING_UP: 'ARRIVED',
  ARRIVED: 'CONFIRMED',
  CONFIRMED: 'TENTATIVE',
})

/**
 * 1 段階先に進める対応表（CONFIRMED 以降のフロー）
 */
export const STATUS_ADVANCE_MAP = Object.freeze({
  CONFIRMED: 'ARRIVED',
  ARRIVED: 'PICKING_UP',
  PICKING_UP: 'IN_TRANSIT',
  IN_TRANSIT: 'COMPLETED',
})

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || '不明'
}

export function getStatusColor(status) {
  return STATUS_COLORS[status] || 'default'
}

export function getRevertStatus(currentStatus) {
  return STATUS_REVERT_MAP[currentStatus] || null
}

export function getAdvanceStatus(currentStatus) {
  return STATUS_ADVANCE_MAP[currentStatus] || null
}
