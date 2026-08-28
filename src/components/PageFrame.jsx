import { Layout, LayoutContent } from '@astryxdesign/core/Layout'

/**
 * ページ共通フレーム。横幅上限なし（contentWidth なし）。
 */
export function PageFrame({ children, padding = 4 }) {
  return (
    <Layout padding={padding} height="fill">
      <LayoutContent>{children}</LayoutContent>
    </Layout>
  )
}
