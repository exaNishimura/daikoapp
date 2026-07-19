# Implementation Tasks

## Overview

号車付け替え／入れ替えの純関数 → Service → Hook → `VehicleSalesModal` UI の順で実装する。

## Tasks

- [x] 1. 純関数レイヤ `src/lib/billing/reassignVehicleSales.js`
  - [x] 1.1 `hasVehicleData` / `decideReassignMode` / `getReassignableCarNums`
  - [x] 1.2 `swapVehicleFields`（reassign / swap）
  - [x] 1.3 `buildShiftCarUpdates` / `buildReceivableVehicleNumUpdates`
  - [x] 1.4 単体テスト `reassignVehicleSales.test.js`

- [x] 2. Service / Hook
  - [x] 2.1 `reassignVehicleSalesService.js`（取得→更新→人件費等再計算）
  - [x] 2.2 `shifts` 一意制約なし（index のみ）→ ID 単位一括更新で OK
  - [x] 2.3 `useReassignVehicleSales`（invalidate 対象クエリ設定）

- [x] 3. UI
  - [x] 3.1 dirty 判定（初期 form との比較）
  - [x] 3.2 `ReassignVehicleDialog`（変更先選択・mode 注記）
  - [x] 3.3 `VehicleSalesModal` に管理者向け「号車変更」ボタン統合（成功で close + refresh）

- [x] 4. 検証
  - [x] 4.1 単体テスト実行（15 passed）
  - [x] 4.2 lint 対象ファイルの確認
