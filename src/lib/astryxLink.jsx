import { forwardRef } from 'react'
import { Link as RouterLink } from 'react-router-dom'

const EXTERNAL_HREF = /^(https?:|mailto:|tel:)/i

/**
 * Astryx は href、React Router は to。LinkProvider 用のアダプタ。
 * tel/mailto/http(s) はルータに渡さずネイティブリンクにする。
 */
export const AstryxRouterLink = forwardRef(function AstryxRouterLink(
  { href, children, ...props },
  ref
) {
  if (typeof href === 'string' && (EXTERNAL_HREF.test(href) || href.startsWith('//'))) {
    return (
      <a ref={ref} href={href} {...props}>
        {children}
      </a>
    )
  }

  return (
    <RouterLink ref={ref} to={href ?? '/'} {...props}>
      {children}
    </RouterLink>
  )
})
