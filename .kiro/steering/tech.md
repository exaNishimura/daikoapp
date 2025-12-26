# Technology Stack

## Architecture

SPA + REST API（クライアント・サーバー分離）。フロントエンドはReact SPA、バックエンドはREST APIでデータ永続化とビジネスロジックを処理する構成。

## Core Technologies

- **Language**: JavaScript (ES Modules) / TypeScript（段階的導入可）
- **Frontend Framework**: React 18.3+
- **Build Tool**: Vite 5.4+
- **Backend**: Next.js API Routes / Express（選択可）
- **Database**: Supabase（PostgreSQLベース）
- **External API**: Google Maps Directions API

## Key Libraries

- **React**: UI構築、状態管理
- **Vite**: 開発サーバー・ビルドツール（HMR対応）
- **Material-UI (@mui/material)**: 主要UIコンポーネントライブラリ（AppBar, Button, Dialog, TextField等）
- **@dnd-kit/core**: ドラッグ&ドロップ機能
- **@supabase/supabase-js**: Supabaseクライアントライブラリ（Realtime機能含む）
- **Tailwind CSS**: 補助的なスタイリング（ユーティリティクラス）
- **Google Maps API**: ルート計算

## Development Standards

### Type Safety

現時点ではJavaScriptを使用。必要に応じてTypeScriptを段階的に導入可能。

### Code Quality

- ES Modules (`type: "module"`)
- React Hooksパターン（useState, useEffect, useContext）
- 関数コンポーネント中心
- REST API設計原則

### Testing

- ユニットテスト: ビジネスロジック（バッファ計算、競合検出等）
- 統合テスト: APIエンドポイント、データベース操作
- E2Eテスト: 主要ユーザーフロー

## Development Environment

### Required Tools

- Node.js（npm使用）
- モダンブラウザ
- Supabaseアカウントとプロジェクト
- Google Maps APIキー

### Common Commands

```bash
# Dev: npm run dev
# Build: npm run build
# Preview: npm run preview
# Test: npm test（導入後）
```

## Key Technical Decisions

- **Vite選択理由**: 高速なHMRとシンプルな設定。SPA構成に適している
- **SPA + REST API**: クライアント・サーバー分離により、将来の拡張性を確保
- **Material-UI**: 豊富なコンポーネントとテーマ機能。MVPでは基本コンポーネントを中心に使用
- **@dnd-kit**: React向けのドラッグ&ドロップライブラリ。タイムライン操作に最適
- **Supabase**: PostgreSQLベースのマネージドデータベース。Realtime機能を使用してデータ変更を自動反映（orders, dispatch_slotsテーブルを監視）
- **Tailwind CSS**: Material-UIと併用。補助的なスタイリングに使用
- **Google Maps API**: ルート計算の標準API。失敗時はnullを返し、手動再計算を可能にする

---
_Document standards and patterns, not every dependency_

