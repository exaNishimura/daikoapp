import { Layout, LayoutContent } from '@astryxdesign/core/Layout'

/**
 * ページ共通フレーム。横幅上限なし（contentWidth なし）。
 * height は auto。AppShell が fill なので、ここを fill にすると縦スクロールが二重になる。
 */
export function PageFrame({ children, padding = 4 }) {
  return (
    <Layout padding={padding} height="auto">
      <LayoutContent>{children}</LayoutContent>
    </Layout>
  )
}
