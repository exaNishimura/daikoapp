import { useCallback, useEffect, useRef } from 'react'

/**
 * 引数を持ち越せる debounce ヘルパフック。
 *
 * 呼び出すたびにタイマーをリセットし、`delay` ms 静止したら最後の引数で実行する。
 * `callback` の最新参照は ref で更新するので、stale closure にならない。
 *
 * @template {(...args: any[]) => any} T
 * @param {T} callback
 * @param {number} delay  ms
 * @returns {(...args: Parameters<T>) => void}
 */
export function useDebouncedCallback(callback, delay) {
  const callbackRef = useRef(callback)
  const timerRef = useRef(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return useCallback(
    (...args) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        callbackRef.current?.(...args)
      }, delay)
    },
    [delay]
  )
}
