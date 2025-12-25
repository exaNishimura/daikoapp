# Project Structure

## Organization Philosophy

機能別に階層化された構造。UI層、Service層、API層を明確に分離。

## Directory Patterns

### Frontend Source (`/src/`)
**Location**: `/src/`  
**Purpose**: フロントエンドのソースコード  
**Example**: `App.jsx`, `main.jsx`

### UI Components (`/src/components/`)
**Location**: `/src/components/`  
**Purpose**: React UIコンポーネント  
**Example**: `DispatchBoard.jsx`, `OrderCard.jsx`, `TimelineGrid.jsx`

### Services (`/src/services/`)
**Location**: `/src/services/`  
**Purpose**: ビジネスロジックとAPI呼び出し  
**Example**: `orderService.js`, `slotService.js`, `routeService.js`

### API Routes (`/src/api/` または `/api/`)
**Location**: `/src/api/` または `/api/`（Next.jsの場合は `/app/api/`）  
**Purpose**: REST APIエンドポイント  
**Example**: `orders.js`, `slots.js`, `route.js`

### Styles (`/src/styles/`)
**Location**: `/src/styles/`  
**Purpose**: グローバルスタイルとコンポーネント単位のCSS  
**Example**: `index.css`, `components/OrderCard.module.css`

### Database (`/src/db/` または `/db/`)
**Location**: `/src/db/` または `/db/`  
**Purpose**: データベーススキーマとマイグレーション  
**Example**: `schema.js`, `migrations/`

## Naming Conventions

- **Files**: PascalCase（コンポーネント: `OrderCard.jsx`）、camelCase（サービス: `orderService.js`）、kebab-case（設定: `vite.config.js`）
- **Components**: PascalCase（`DispatchBoard`, `OrderCard`, `TimelineGrid`）
- **Services**: camelCase（`orderService`, `slotService`, `routeService`）
- **Functions**: camelCase（`createOrder`, `checkConflict`）
- **CSS Classes**: kebab-case（`.order-card`, `.timeline-grid`）

## Import Organization

```javascript
// React imports first
import { useState, useEffect } from 'react'

// Third-party libraries
import { DndContext } from '@dnd-kit/core'

// Services
import { orderService } from '@/services/orderService'

// Components
import { OrderCard } from '@/components/OrderCard'

// Styles
import './OrderCard.module.css'
```

**Path Aliases**: `@/` エイリアスを `src/` に設定（推奨）

## Code Organization Principles

- **コンポーネント**: 単一責任の原則。UIコンポーネントとロジックを分離
- **状態管理**: React Hooks（useState, useEffect, useContext）を使用。必要に応じてContext APIでグローバル状態管理
- **API呼び出し**: Service層で一元管理。エラーハンドリングとリトライロジックを含める
- **エラーハンドリング**: try-catch + エラー状態管理。ユーザーフレンドリーなエラーメッセージ
- **データ永続化**: REST API経由でデータベースに保存。楽観的更新パターンを採用

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_

