import { Avatar } from '@astryxdesign/core/Avatar'
import { Button } from '@astryxdesign/core/Button'
import { VStack } from '@astryxdesign/core/Layout'
import { Popover } from '@astryxdesign/core/Popover'
import { Text } from '@astryxdesign/core/Text'

/**
 * ヘッダー用アカウントメニュー。閉じた状態はユーザーアイコンのみ。
 */
export function AccountMenu({ email, onLogout }) {
  return (
    <Popover
      placement="below"
      alignment="end"
      width={260}
      label="アカウント"
      closeButtonLabel="閉じる"
      content={
        <VStack gap={3} padding={2}>
          <Text color="secondary">{email || 'ログイン中'}</Text>
          <Button label="ログアウト" variant="ghost" size="sm" width="100%" onClick={onLogout} />
        </VStack>
      }
    >
      <Avatar
        name={email || 'ユーザー'}
        alt="アカウント"
        size="sm"
        tooltip={false}
        onClick={() => {}}
      />
    </Popover>
  )
}
