# Project Structure

## Organization Philosophy

レイヤー分離 + 機能サブディレクトリ。`components`（UI） / `hooks`（状態・データ取得） / `services`（Supabase アクセス） / `lib`（純粋ロジック・外部 SDK 初期化） / `utils`（小さな関数）の責務を分け、請求 (`billing/`) のような大きな機能領域は各レイヤー内にサブディレクトリで束ねる。

## Directory Patterns

### App Entry (`src/`)
**Location**: `src/`
**Purpose**: アプリのエントリ・ルーティング・グローバル設定
**Example**: `main.jsx`（ReactDOM / ThemeProvider / QueryClientProvider）、`App.jsx`（ルーティング + NavBar）

### UI Components (`src/components/`)
**Location**: `src/components/`
**Purpose**: 画面・機能単位の React コンポーネント。各コンポーネントの CSS は同階層に同名で配置（`Foo.jsx` + `Foo.css`）。
**Example**: `DispatchBoard.jsx`, `TimelineGrid.jsx`, `OrderFormModal.jsx`, `ShiftCalendar.jsx`, `LoginPage.jsx`

### Component Sub-modules (`src/components/<Feature>/`)
**Location**: `src/components/DispatchBoard/`, `src/components/OrderDetailPanel/`, `src/components/ShiftEditPage/`
**Purpose**: 大型コンポーネントを内部的に分割した子コンポーネント群（親と 1:N の関係）。
**Pattern**: 親 `Foo.jsx` が肥大化したら `Foo/` ディレクトリを切り、`Foo/SectionA.jsx` 等に分割する。
**Example**: `DispatchBoard/DispatchHeader.jsx`, `OrderDetailPanel/OrderRouteSection.jsx`, `ShiftEditPage/CopyShiftDialog.jsx`

### Hooks (`src/hooks/`)
**Location**: `src/hooks/`（機能領域ごとにサブディレクトリ可: `src/hooks/billing/`）
**Purpose**: React Query をラップしたデータ取得 / ミューテーション、画面ロジック集約。コンポーネントは原則ここを通してデータにアクセスする。
**Example**: `useOrders.js`, `useDispatchSlots.js`, `useShifts.js`, `billing/useInvoices.js`

### Services (`src/services/`)
**Location**: `src/services/`（機能領域ごとにサブディレクトリ可: `src/services/billing/`）
**Purpose**: Supabase / 外部 API への薄いラッパ。`{ data, error }` 形式で返し、UI ロジックを持たない。
**Example**: `orderService.js`, `routeService.js`, `conflictDetectionService.js`, `billing/invoicesService.js`

### Libraries (`src/lib/`)
**Location**: `src/lib/`（機能領域ごとにサブディレクトリ可: `src/lib/excel/`, `src/lib/billing/`）
**Purpose**: SDK 初期化（`supabase.js`, `queryClient.js`）と、ドメイン寄りだが React に依存しない純粋ロジック・I/O ヘルパ。
**Example**: `supabase.js`, `queryClient.js`, `orderPlacement.js`, `excel/generateInvoice.js`, `billing/matchCompany.js`

### Utils (`src/utils/`)
**Location**: `src/utils/`
**Purpose**: ドメインに薄く依存する小粒なユーティリティ（時間計算、行レイアウト、住所整形など）。
**Example**: `timeUtils.js`, `rowUtils.js`, `slotUtils.js`, `addressUtils.js`, `businessDayUtils.js`

### Contexts (`src/contexts/`)
**Location**: `src/contexts/`
**Purpose**: アプリ全体で共有する React Context（現状は認証）。
**Example**: `AuthContext.jsx`（Supabase Auth セッション、マジックリンク送信、ログアウト）

### Tests (co-located)
**Location**: 各実装ファイルと同階層
**Purpose**: Vitest によるユニットテスト。`<name>.js` に対し `<name>.test.js` を同じ場所に置く。
**Pattern**: テスト基盤の共通セットアップだけ `src/test/setup.js` に集約。
**Example**: `utils/timeUtils.test.js`, `lib/excel/parseDailySheet.test.js`, `services/conflictDetectionService.test.js`

### Assets (`src/assets/`)
**Location**: `src/assets/`
**Purpose**: 画像や Excel テンプレートなどのバイナリ資産。
**Example**: `invoice-template.xlsx`

### Database Migrations (`supabase/`)
**Location**: `supabase/migrations/`（過去のスクリプトは `supabase/legacy/`）
**Purpose**: Supabase の SQL マイグレーション。タイムスタンプ付きファイル名で順序を管理し、`legacy/` は履歴参照用。
**Example**: `supabase/migrations/20260101000000_initial_schema.sql`, `20260601125210_001_enable_rls.sql`

## Naming Conventions

- **Components**: PascalCase。ファイル名と export 名を一致させる（`DispatchBoard.jsx` → `DispatchBoard`）。
- **Hooks**: `use` プレフィックス + camelCase（`useOrders.js`, `useDispatchSlots.js`）。
- **Services / lib / utils**: camelCase（`orderService.js`, `timeUtils.js`）。
- **CSS ファイル**: 対応するコンポーネントと同名（`OrderCard.jsx` + `OrderCard.css`）。
- **CSS クラス**: kebab-case（`.order-card`, `.timeline-grid`）。
- **テスト**: 対象ファイル + `.test.js`（`foo.js` ↔ `foo.test.js`）。
- **設定ファイル**: kebab-case（`vite.config.js`, `eslint.config.js`）。

## Import Organization

```javascript
// 1. React / React 周辺
import { useState, useEffect } from 'react'

// 2. 3rd party
import { useQuery } from '@tanstack/react-query'
import Button from '@mui/material/Button'

// 3. アプリ内（@/ エイリアス）
import { supabase } from '@/lib/supabase'
import { orderService } from '@/services/orderService'
import { OrderCard } from '@/components/OrderCard'

// 4. スタイル
import './OrderCard.css'
```

**Path Aliases**:
- `@/` → `src/`（`vite.config.js` の `resolve.alias` で設定）

## Code Organization Principles

- **依存方向**: `components` → `hooks` → `services` / `lib` → 外部（Supabase / Google Maps）。逆方向の依存は作らない。
- **データアクセス**: UI から直接 `supabase.from(...)` を呼ばず、必ず Service 経由。Service は `{ data, error }` を返し、Hook が `unwrap` して React Query に渡す。
- **クエリキー**: `src/lib/queryClient.js` の `queryKeys` に集約。Mutation 成功時は関連キーを `invalidateQueries` で無効化する。
- **状態管理**: サーバー状態は React Query、グローバルクライアント状態は Context（現状 `AuthContext` のみ）、ローカル状態は `useState` / `useReducer`。
- **コンポーネント分割**: 単一責任。ファイルが大きくなったら `<Feature>/` ディレクトリに分割する。
- **エラーハンドリング**: Service 層でログ + `{ data: null, error }` を返却。Hook 側で throw → React Query の `error` に乗せて UI で表示。

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
