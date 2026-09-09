import { FORM_FIELD_SIZE } from '@/lib/ui/formFieldSize'
import { useIsMobile } from '@/hooks/useMediaQuery'

/**
 * スマホ向けフォーム／操作ボタンの共通サイズ。
 * 売掛一覧のモバイル対応パターンを再利用する。
 */
export function useMobileLayout() {
  const isMobile = useIsMobile()

  return {
    isMobile,
    /** Selector / フィルタ系（密テーブル以外） */
    controlSize: isMobile ? 'lg' : 'sm',
    /** 業務フォーム入力 */
    fieldSize: isMobile ? 'lg' : FORM_FIELD_SIZE,
    fieldWidth: isMobile ? '100%' : undefined,
    /** フル幅 CTA（新規追加・保存など） */
    actionButtonProps: isMobile ? { size: 'lg', width: '100%' } : {},
  }
}
