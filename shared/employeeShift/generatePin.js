/**
 * ランダム6桁 PIN を生成
 * @returns {string}
 */
export function generateRandomPin() {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return String(arr[0] % 1_000_000).padStart(6, '0')
}
