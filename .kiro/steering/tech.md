# Technology Stack

## Architecture

シングルページアプリケーション (SPA) + Backend-as-a-Service (Supabase) 構成。専用のバックエンドサーバは持たず、React フロントエンドから Supabase クライアント（PostgREST / Auth / Storage / Realtime）を直接呼び出す。Google Maps だけは Vite Dev Server のプロキシを介して叩く。

```
React SPA  ──▶  Supabase (Postgres / Auth / Storage / Realtime)
       └──▶  Google Maps Directions / Places API (Vite proxy 経由)
```

## Core Technologies

- **Language**: JavaScript (ES Modules)。型は段階的に TypeScript 化可能（現状は JS）。
- **Frontend Framework**: React 18.3
- **Routing**: React Router DOM 7（`BrowserRouter` + `Routes`）
- **Build Tool**: Vite 5（`@vitejs/plugin-react`、`@/` エイリアスは `src/` を指す）
- **BaaS**: Supabase（PostgreSQL + Auth + Storage + Realtime）。マイグレーションは `supabase/migrations/` で管理。
- **External API**: Google Maps Directions / Places API

## Key Libraries

- **UI**: `@mui/material` v7 + `@mui/icons-material` + `@emotion/*`（ダークテーマを `main.jsx` で `ThemeProvider` 提供）
- **Date Pickers**: `@mui/x-date-pickers` v9 + `dayjs`（`AdapterDayjs`、locale=ja を `main.jsx` の `LocalizationProvider` で全体に適用）
- **Data fetching / cache**: `@tanstack/react-query` v5。`src/lib/queryClient.js` で `QueryClient` と `queryKeys` を集約管理。
- **Drag & Drop**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- **Supabase**: `@supabase/supabase-js`（Auth / Realtime / PostgREST）
- **Excel I/O**: `exceljs`（請求書テンプレート出力）と `xlsx`（売上シート読み込み）
- **Testing**: `vitest` + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom`
- **Lint / Format**: ESLint 9 + Prettier 3（`eslint-config-prettier`, `eslint-plugin-react*`）

## Development Standards

### Type Safety

現状は JavaScript。`@types/react` 等のみ導入。新しいユーティリティから段階的に TypeScript 化することは可（必須ではない）。

### Code Quality

- ES Modules (`"type": "module"`)
- 関数コンポーネント + React Hooks（`useState`, `useEffect`, `useContext`）
- データ取得・キャッシュは **React Query 経由が原則**（直接 `useEffect` で fetch しない）
- Supabase アクセスは `src/services/**` でラップし、UI からは Hook (`src/hooks/**`) 経由で呼ぶ
- ESLint + Prettier で統一（`npm run lint` / `npm run format`）

### Testing

- フレームワーク: Vitest（`jsdom` 環境、`src/test/setup.js` でセットアップ）
- 配置: テスト対象と同階層に `*.test.js` を置く（例: `timeUtils.js` ↔ `timeUtils.test.js`）
- 重点: ビジネスロジック（時間計算、競合検出、Excel パース、会社名マッチ等）

## Development Environment

### Required Tools

- Node.js（`npm` 使用）
- モダンブラウザ
- Supabase プロジェクト（URL / Anon Key を `.env` に設定）
- Google Maps API キー（`VITE_GOOGLE_MAPS_API_KEY`）

### Common Commands

```bash
# Dev:     npm run dev
# Build:   npm run build
# Preview: npm run preview
# Lint:    npm run lint    /  npm run lint:fix
# Format:  npm run format  /  npm run format:check
# Test:    npm test        /  npm run test:watch  /  npm run test:ui  /  npm run test:coverage
```

## Key Technical Decisions

- **Backend-less (Supabase 直叩き)**: 小規模運用のため専用 API サーバを持たず、Supabase の PostgREST / Auth / Realtime を直接利用。RLS でアクセス制御する前提（`supabase/migrations/*_enable_rls.sql`）。
- **React Query をデータ層の Single Source of Truth に**: `queryKeys` を `src/lib/queryClient.js` に集約し、mutation 後は関連キーを `invalidateQueries` で一括無効化することで楽観的更新と一貫性を両立。
- **Service 層で Supabase をラップ**: `src/services/**` は `{ data, error }` 形式で値を返し、Hook 側で `unwrap` してから React Query に渡す。UI から直接 `supabase.from(...)` を呼ばない。
- **MUI + 個別 CSS 併用**: 基本コンポーネントは MUI、レイアウト・タイムライン等のドメイン固有 UI はコンポーネント同階層の `*.css` で書く（Tailwind は未導入）。
- **@dnd-kit を採用**: タイムラインへの依頼ドロップ・スロット並び替えに `@dnd-kit/core` + `sortable` を使用。
- **Supabase Realtime**: `orders` / `dispatch_slots` 等の変更を購読し、複数の配車係の画面を自動同期。
- **Google Maps は Vite proxy 経由**: API キーを `vite.config.js` の `server.proxy` でサーバ側から付与し、ブラウザに鍵を露出しすぎないようにする。
- **Excel 入出力で既存運用と接続**: `exceljs` で請求書テンプレート（`src/assets/invoice-template.xlsx`）に書き込み、`xlsx` で売上日報シートを読み込む二刀流。
- **Auth は Supabase マジックリンク**: パスワード管理を避け、`shouldCreateUser: false` で許可ユーザーのみログイン可能とする運用。

---
_Document standards and patterns, not every dependency_
