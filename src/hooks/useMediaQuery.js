import { useEffect, useState } from 'react'

/** 売掛・請求など管理画面のスマホ判定（Tailwind md 未満） */
export const MOBILE_MEDIA_QUERY = '(max-width: 767px)'

/**
 * CSS media query のマッチ状態。SSR 初回は false。
 * @param {string} query
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}

/** `max-width: 767px` のショートカット */
export function useIsMobile() {
  return useMediaQuery(MOBILE_MEDIA_QUERY)
}
