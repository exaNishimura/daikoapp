# Google Maps API キー設定ガイド

## 1. Google Cloud PlatformでAPIキーを取得

### ステップ1: Google Cloud Platformにアクセス
1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. Googleアカウントでログイン（必要に応じてアカウント作成）

### ステップ2: プロジェクトの作成
1. 画面上部のプロジェクト選択ドロップダウンをクリック
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を入力（例: "代行運転配車システム"）
4. 「作成」をクリック
5. 作成したプロジェクトを選択

### ステップ3: Directions APIを有効化
1. 左メニューから「APIとサービス」→「ライブラリ」を選択
2. 検索バーで「Directions API」を検索
3. 「Directions API」をクリック
4. 「有効にする」ボタンをクリック

### ステップ4: APIキーの作成
1. 左メニューから「APIとサービス」→「認証情報」を選択
2. 画面上部の「+ 認証情報を作成」→「APIキー」をクリック
3. APIキーが作成されます（後でコピーします）

### ステップ5: APIキーの制限設定（重要）

⚠️ **注意**: Google Maps Directions APIは、HTTPリファラー制限が設定されたAPIキーでは使用できません。

**推奨設定（開発環境）**:
1. 作成したAPIキーをクリック
2. 「アプリケーションの制限」で「なし」を選択（開発環境の場合）
   - または「IPアドレス」を選択して、開発サーバーのIPアドレスを追加
3. 「APIの制限」で「特定のAPIを制限」を選択
4. 「Directions API」にチェックを入れる
5. 「保存」をクリック

**本番環境の場合**:
- バックエンドAPIエンドポイントを作成して、サーバー側からGoogle Maps APIを呼び出すことを推奨
- その場合、APIキーにIPアドレス制限を設定できます

## 2. 環境変数ファイルに設定

### `.env.local`ファイルを編集

`.env.local`ファイルに以下のように設定してください：

```env
VITE_SUPABASE_URL=https://ltwekvgqfawkykpvviyx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0d2VrdmdxZmF3a3lrcHZ2aXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0ODc0NzQsImV4cCI6MjA4MjA2MzQ3NH0.X9go-NcjTLFJKWziW1LXMYvj9OC3Z57SZgTH0phaHtc
VITE_GOOGLE_MAPS_API_KEY=ここに取得したAPIキーを貼り付け
```

### 設定例

```env
VITE_GOOGLE_MAPS_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 3. 動作確認

### 開発サーバーを再起動
環境変数を変更した場合は、開発サーバーを再起動してください：

```bash
npm run dev
```

### テスト方法
1. ブラウザでアプリを開く
2. 「＋新規依頼（電話）」ボタンをクリック
3. 出発地と目的地を入力して保存
4. 依頼作成後、バックグラウンドでルート計算が実行されます
5. ブラウザの開発者ツール（F12）のコンソールでエラーがないか確認

## 4. トラブルシューティング

### APIキーが無効な場合
- APIキーが正しくコピーされているか確認
- Directions APIが有効になっているか確認
- APIキーの制限設定を確認（開発環境では制限を緩める）

### エラーメッセージ
- `API key not configured`: `.env.local`ファイルが正しく設定されていない
- `REQUEST_DENIED`: APIキーの制限設定を確認
  - `API keys with referer restrictions cannot be used with this API.`: HTTPリファラー制限が設定されています。制限を「なし」または「IPアドレス」に変更してください
- `OVER_QUERY_LIMIT`: APIの使用量制限に達している（課金設定を確認）
- `CORS policy`: ブラウザから直接呼び出すとCORSエラーが発生します。プロキシ経由で呼び出すか、バックエンドAPIを作成してください

## 5. 料金について

### 無料枠
- Google Maps Directions APIは月間$200分の無料クレジットが提供されます
- 通常の使用量では無料枠内で収まります

### 料金設定
- [Google Maps Platform料金](https://developers.google.com/maps/billing-and-pricing/pricing)を確認
- 予算アラートを設定することを推奨

## 6. セキュリティ注意事項

⚠️ **重要**: 
- `.env.local`ファイルは`.gitignore`に含まれているため、Gitにコミットされません
- APIキーを公開リポジトリにコミットしないでください
- 本番環境では必ずAPIキーの制限を設定してください

