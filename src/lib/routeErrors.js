/**
 * ルート計算エラー（estimateDuration が返す error 文字列）を
 * ユーザー向けの日本語メッセージに整形する。
 *
 * @param {string|Error} error - estimateDuration の error フィールド
 * @returns {string}
 */
export function formatRouteCalculationError(error) {
  if (!error) return 'ルート計算に失敗しました'
  const message = typeof error === 'string' ? error : error.message || String(error)

  if (message === 'API key not configured') {
    return 'Google Maps APIキーが設定されていません。.env.localファイルを確認してください。'
  }

  if (message === 'Address is missing') {
    return '出発地または目的地が入力されていません'
  }

  if (message.includes('REQUEST_DENIED')) {
    if (message.includes('referer restrictions') || message.includes('referer restriction')) {
      return [
        'APIキーにHTTPリファラー制限が設定されています。',
        '',
        '解決方法:',
        '1. Google Cloud Console (https://console.cloud.google.com/apis/credentials) にアクセス',
        '2. APIキーを選択',
        '3. 「アプリケーションの制限」を「なし」に変更（開発環境の場合）',
        '4. 「保存」をクリック',
        '',
        '※本番環境では、バックエンドAPI経由で呼び出すことを推奨します。',
      ].join('\n')
    }
    if (message.includes('This API project is not authorized')) {
      return [
        'Directions APIが有効になっていません。',
        '',
        '解決方法:',
        '1. Google Cloud Console (https://console.cloud.google.com/apis/library) にアクセス',
        '2. 「Directions API」を検索',
        '3. 「有効にする」をクリック',
      ].join('\n')
    }
    return [
      'APIキーの権限がありません。',
      '',
      `エラー詳細: ${message}`,
      '',
      '確認事項:',
      '1. Directions APIが有効になっているか',
      '2. APIキーの制限設定が適切か（開発環境では「なし」を推奨）',
      '3. APIキーが正しく設定されているか',
      '',
      'Google Cloud Console: https://console.cloud.google.com/apis/credentials',
    ].join('\n')
  }

  if (message.includes('OVER_QUERY_LIMIT')) {
    return 'APIの使用量制限に達しました。課金設定を確認してください。'
  }

  if (message.includes('ZERO_RESULTS')) {
    return 'ルートが見つかりませんでした。住所を確認してください。'
  }

  if (message.includes('INVALID_REQUEST')) {
    return '無効なリクエストです。住所を確認してください。'
  }

  return `ルート計算に失敗しました: ${message}`
}
