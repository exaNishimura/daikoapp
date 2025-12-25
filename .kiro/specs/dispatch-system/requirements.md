# Requirements Document

## Introduction

本仕様書は、鈴鹿市近辺の代行運転における配車管理Webアプリケーション（MVP）の要件を定義する。電話で受けた依頼を配車係が手入力し、車両タイムラインにドラッグ&ドロップで割り当て・確定できる機能を提供する。配車オペレーションが回ることを最優先とし、会員管理・決済・ドライバーアプリ等の機能は後回しとする。

## Project Description (Input)

代行運転 配車Webアプリ（MVP：電話受注のみ）仕様書 v0.1

1. 目的

鈴鹿市近辺の代行運転において、電話で受けた依頼を配車係が手入力し、車両（1号車、2号車…）のタイムラインにドラッグ＆ドロップで割当・確定できるようにする。
まずは「配車オペレーションが回ること」を最優先し、会員/決済/ドライバーアプリ等は後回し。

2. スコープ（MVP）
2.1 すること

配車係（管理者）が電話依頼を手入力して案件作成

到着した依頼をカード形式で表示（未割当一覧）

車両レーン（1号車、2号車…）×タイムライン（18:00〜翌06:00 / 15分刻み）へドラッグ&ドロップで仮配置

仮配置後、詳細を確認して確定

確定済みの枠はタイムラインに表示され、重複は警告（確定不可）

2.2 しないこと（今日入れない）

利用者アプリ / LINEログイン / 会員

オンライン決済 / 請求書発行 / 領収書メール

ドライバーへの通知 / 追跡 / チャット / 電話発信

実走行距離入力・精算（日報も後回し）

自動配車（最寄り提案）は後日

3. 利用者（権限）

**配車係（管理者）**のみが利用

ログインはMVPでは省略可（ローカル運用なら簡易パスコードでも可）

4. 画面仕様（配車画面 1画面で完結）
4.1 画面レイアウト
ヘッダー

営業日表示：例「2025/12/23 営業（18:00–翌06:00）」

表示ズーム：固定で 15分刻み

ボタン：［＋新規依頼（電話）］

左ペイン：未割当（カード一覧）

到着順で表示（新しい順）

カードをドラッグ可能

右ペイン：車両タイムライン

表示範囲：18:00〜翌06:00

時間刻み：15分

レーン：1号車、2号車…（増やせる）

ドロップで枠（slot）作成（仮配置）

slotはドラッグで時刻調整・レーン移動可能（確定前のみ推奨）

右サイド：詳細パネル（スライドイン）

カード/slotクリックで表示

依頼詳細、ルート、所要、バッファ、確定/解除/削除（キャンセル）を操作

4.2 電話依頼入力（新規依頼モーダル）

必須

依頼日時：作成時刻（自動）

予約種別：今すぐ / 日時指定

日時指定の場合：予約日時（datetime）

出発地：住所テキスト

目的地：住所テキスト

車情報：

車種（任意）

ナンバー（任意）

色（任意）

駐車位置メモ（任意・長文可）

連絡先電話番号（任意だが推奨）

支払方法：現金（MVP固定でOK：将来拡張枠だけ残す）

保存後

未割当一覧にカードとして追加

4.3 依頼カード表示項目（左ペイン）

ステータス：未割当 / 仮配置 / 確定

予約：今すぐ or 日時（例：23:10）

出発地（短縮）→目的地（短縮）

所要時間（後述）：base + buffer = 合計枠（例：25 + 10 = 35分）

目安料金：今回は表示しない（MVP外）※将来追加

車情報：ナンバー下4桁（任意）＋色（任意）＋メモ有無アイコン

4.4 ドラッグ＆ドロップ（確定仕様）

カードを車両レーンへドロップ

ドロップ位置の時刻＝slot開始時刻（確定）

slot終了時刻は 開始 + (base_duration + buffer) で自動計算

slot生成後、カードはステータス 仮配置 になり、タイムラインに枠が表示される

slotの移動（確定前）

同じ車両レーン内：左右ドラッグで 15分刻みスナップ移動

別レーンへ：ドラッグで車両変更

確定後の移動

MVP推奨：確定済みslotを動かすと自動で確定解除（事故防止）

もしくは「確定済みは移動不可」でもOK（より安全）

4.5 slot（タイムライン枠）表示項目

状態：仮 / 確定（バッジ）

時刻：開始–終了

出発→目的地（超短縮）

アイコン：メモ有無、電話番号有無

4.6 競合（重複）ルール

同一車両レーンで時間が重なる slot がある場合：

重複slotを赤枠＋⚠表示

確定ボタンを無効化

解決：slotを動かす / 別車両へ移す / バッファ手動調整

4.7 06:00超の扱い

slotが翌06:00を超える配置は 配置不可（ドロップを拒否してトースト表示）

メッセージ例：「06:00を超えるため配置できません。開始時刻を前にずらしてください。」

5. 所要時間（Googleルート）とバッファ仕様
5.1 base_duration（Googleルート）

入力：出発地住所テキスト、目的地住所テキスト

出力：所要時間（分）

取得タイミング：

依頼作成後に自動取得（可能ならバックグラウンドで）

失敗した場合は base_duration = null とし、詳細で「再計算」ボタン

5.2 バッファ（余剰）

初期（固定値でOK。今日動かす優先）

pickup_wait = 5分

buffer = max(5分, ceil(base * 0.15)) + pickup_wait

baseがnull（ルート未取得）の場合

base = 20分（仮） として計算して仮枠生成（詳細で再計算可能）

5.3 手動上書き

詳細パネルで buffer_min を手動で +/− できる

手動設定された場合、slotに「手」アイコンを表示（説明用）

6. データモデル（最小）

DBはSQLiteでもPostgresでも可。型は例。

6.1 vehicles（車両）

id (uuid/int)

name（例：1号車）

is_active (bool)

sort_order (int)

6.2 orders（依頼）

id

created_at

order_type: NOW / SCHEDULED

scheduled_at（nullable）

pickup_address（text）

dropoff_address（text）

contact_phone（text, nullable）

car_model（text, nullable）

car_plate（text, nullable）

car_color（text, nullable）

parking_note（text, nullable）

base_duration_min（int, nullable）

buffer_min（int, nullable）

buffer_manual (bool default false)

status: UNASSIGNED / TENTATIVE / CONFIRMED / CANCELLED

6.3 dispatch_slots（タイムライン枠）

id

order_id (FK)

vehicle_id (FK)

start_at (datetime)

end_at (datetime)

status: TENTATIVE / CONFIRMED

conflict (bool) ※計算結果を保持しても良いが、基本は動的算出でもOK

6.4 audit_logs（任意・今日なくてもOK）

id, actor, action, payload, created_at

7. 振る舞い仕様（状態遷移）

UNASSIGNED（未割当）

タイムラインにドロップ → TENTATIVE（仮配置）＋slot作成

TENTATIVE（仮配置）

「確定」→ CONFIRMED

「仮配置解除」→ UNASSIGNED（slot削除）

CONFIRMED（確定）

「確定解除」→ TENTATIVE（運用次第）

「キャンセル」→ CANCELLED（slot削除 or キャンセル表示）

8. API（ローカルでも将来でも使える最低限）

実装形態はNext.js/Express等自由。以下はREST例。

Vehicles

GET /api/vehicles

POST /api/vehicles（今日不要でもOK）

Orders

POST /api/orders（電話依頼作成）

GET /api/orders?status=UNASSIGNED|TENTATIVE|CONFIRMED

PATCH /api/orders/:id（住所修正、メモ更新、buffer更新、キャンセル等）

Slots

POST /api/slots（ドロップ時：vehicle_id, order_id, start_at）

サーバで base/buffer を参照して end_at 算出（推奨）

PATCH /api/slots/:id（移動：start_at更新 → end_at再計算）

POST /api/slots/:id/confirm（確定）

DELETE /api/slots/:id（仮配置解除）

Route

POST /api/route/estimate（pickup_address, dropoff_address → base_duration_min）

失敗時は null を返す

9. 受け入れ基準（今日のチェックリスト）

 新規依頼（電話）を登録でき、未割当カードに表示される

 カードを車両レーンへドロップできる

 ドロップ位置の時刻がslot開始になり、終了が自動計算される

 15分刻みでスナップして移動できる（確定前）

 重複すると赤表示され、確定できない

 06:00を超える配置はできない

 ルート取得失敗でも仮枠で運用でき、再計算できる

10. 実装ノート（Cursor向け、迷いを減らす決め）
UI推奨

タイムラインは「CSS Grid + absolute配置」でも良い

DnDは @dnd-kit（React）などで実装が楽

時間→px 変換：

15分 = 20px（など固定）にして、18:00〜06:00（12時間）= 48コマ

競合判定（サーバ or クライアント）

同一vehicle_idで、(startA < endB) && (endA > startB) なら衝突

confirm時にサーバ側でも再チェック（必須）

営業日（18:00〜翌06:00）の扱い

UI上は「営業日=日付キー」を持つ（例：12/23営業）

18:00以前/翌06:00以降は表示しない

11. 直後の拡張ポイント（後で足す前提の枠だけ残す）

ドライバー通知（確定時にpush/SMS）

実走行距離入力（小数第1位）→料金計算

遅延料（到着ボタン起点）・キャンセル料（回送開始以降）

管理者追跡（地図）・ETA表示

会員/LINEログイン・オンライン決済（会員のみ）

## Requirements

### Requirement 1: 電話依頼の登録機能
**Objective:** As a 配車係, I want 電話で受けた依頼を手入力して登録できる, so that 配車オペレーションを開始できる

#### Acceptance Criteria
1. When 配車係が「＋新規依頼（電話）」ボタンをクリックする, the 配車システム shall 新規依頼入力モーダルを表示する
2. When 配車係が必須項目（予約種別、出発地、目的地）を入力して保存する, the 配車システム shall 依頼を作成し、未割当一覧にカードとして追加する
3. When 依頼が作成される, the 配車システム shall 作成時刻を自動的に記録する
4. When 予約種別が「日時指定」の場合, the 配車システム shall 予約日時の入力フィールドを表示する
5. When 予約種別が「今すぐ」の場合, the 配車システム shall 予約日時フィールドを非表示にする
6. When 依頼が作成される, the 配車システム shall 出発地と目的地からGoogleルートAPIを使用して所要時間（base_duration）を自動取得する
7. If ルート取得が失敗する, the 配車システム shall base_durationをnullとして保存し、詳細パネルで「再計算」ボタンを表示する
8. When 依頼が作成される, the 配車システム shall バッファ時間を自動計算する（buffer = max(5分, ceil(base * 0.15)) + pickup_wait(5分)）
9. If base_durationがnullの場合, the 配車システム shall base = 20分（仮）としてバッファを計算する

### Requirement 2: 依頼カードの表示と管理
**Objective:** As a 配車係, I want 未割当の依頼をカード形式で確認できる, so that 配車状況を把握できる

#### Acceptance Criteria
1. The 配車システム shall 未割当の依頼を到着順（新しい順）で左ペインにカード形式で表示する
2. When 依頼カードが表示される, the 配車システム shall ステータス（未割当/仮配置/確定）を表示する
3. When 依頼カードが表示される, the 配車システム shall 予約種別（今すぐ or 日時）を表示する
4. When 依頼カードが表示される, the 配車システム shall 出発地と目的地を短縮表示する
5. When 依頼カードが表示される, the 配車システム shall 所要時間（base + buffer = 合計枠）を表示する
6. When 依頼カードが表示される, the 配車システム shall 車情報（ナンバー下4桁、色、メモ有無アイコン）を表示する
7. The 配車システム shall 依頼カードをドラッグ可能にする

### Requirement 3: ドラッグ&ドロップによる配車割り当て
**Objective:** As a 配車係, I want 依頼カードを車両タイムラインにドラッグ&ドロップで割り当てられる, so that 視覚的に配車を管理できる

#### Acceptance Criteria
1. When 配車係が依頼カードを車両レーンへドロップする, the 配車システム shall ドロップ位置の時刻をslot開始時刻として設定する
2. When slotが作成される, the 配車システム shall 終了時刻を開始時刻 + (base_duration + buffer)で自動計算する
3. When slotが作成される, the 配車システム shall 依頼のステータスを「仮配置（TENTATIVE）」に変更する
4. When slotが作成される, the 配車システム shall タイムラインに枠を表示する
5. When 配車係がslotを同じ車両レーン内で左右にドラッグする, the 配車システム shall 15分刻みでスナップして移動する
6. When 配車係がslotを別の車両レーンへドラッグする, the 配車システム shall 車両を変更する
7. While slotが確定前（TENTATIVE）の状態, the 配車システム shall slotの移動を許可する
8. When 確定済みslotを動かす, the 配車システム shall 自動で確定解除（TENTATIVE）する（推奨実装）

### Requirement 4: タイムライン表示とslot管理
**Objective:** As a 配車係, I want 車両ごとのタイムラインで配車状況を確認できる, so that 時間軸で配車を管理できる

#### Acceptance Criteria
1. The 配車システム shall タイムラインの表示範囲を18:00〜翌06:00とする
2. The 配車システム shall 時間刻みを15分とする
3. The 配車システム shall 車両レーン（1号車、2号車…）を表示する
4. The 配車システム shall 車両レーンを追加できる
5. When slotが表示される, the 配車システム shall 状態（仮/確定）をバッジで表示する
6. When slotが表示される, the 配車システム shall 開始時刻と終了時刻を表示する
7. When slotが表示される, the 配車システム shall 出発地→目的地を超短縮表示する
8. When slotが表示される, the 配車システム shall メモ有無と電話番号有無をアイコンで表示する
9. When バッファが手動設定されている場合, the 配車システム shall 「手」アイコンを表示する

### Requirement 5: ルート計算とバッファ管理
**Objective:** As a 配車係, I want 出発地と目的地から所要時間を自動計算し、バッファを調整できる, so that 正確な配車時間を設定できる

#### Acceptance Criteria
1. When 依頼が作成される, the 配車システム shall GoogleルートAPIを使用してbase_durationを取得する
2. When base_durationが取得される, the 配車システム shall バッファを自動計算する（buffer = max(5分, ceil(base * 0.15)) + pickup_wait(5分)）
3. When 配車係が詳細パネルで「再計算」ボタンをクリックする, the 配車システム shall ルートを再取得してbase_durationを更新する
4. When 配車係が詳細パネルでbuffer_minを手動で調整する, the 配車システム shall buffer_manualフラグをtrueに設定する
5. When buffer_manualがtrueの場合, the 配車システム shall slotに「手」アイコンを表示する
6. When slotの開始時刻が変更される, the 配車システム shall 終了時刻を開始時刻 + (base_duration + buffer)で再計算する

### Requirement 6: 競合検出と警告
**Objective:** As a 配車係, I want 同一車両で時間が重なる配車を検出して警告できる, so that 配車の重複を防止できる

#### Acceptance Criteria
1. When 同一車両レーンで時間が重なるslotが存在する, the 配車システム shall 重複slotを赤枠＋⚠アイコンで表示する
2. When 重複が検出される, the 配車システム shall 確定ボタンを無効化する
3. The 配車システム shall 競合判定を同一vehicle_idで(startA < endB) && (endA > startB)の条件で行う
4. When 配車係が確定ボタンをクリックする, the 配車システム shall サーバ側で競合を再チェックする
5. If サーバ側で競合が検出される, the 配車システム shall 確定を拒否してエラーメッセージを表示する

### Requirement 7: 確定・解除・キャンセル機能
**Objective:** As a 配車係, I want 仮配置した配車を確定・解除・キャンセルできる, so that 配車オペレーションを管理できる

#### Acceptance Criteria
1. When 配車係が詳細パネルで「確定」ボタンをクリックする, the 配車システム shall 依頼のステータスを「確定（CONFIRMED）」に変更する
2. When 配車係が詳細パネルで「仮配置解除」ボタンをクリックする, the 配車システム shall 依頼のステータスを「未割当（UNASSIGNED）」に変更し、slotを削除する
3. When 配車係が詳細パネルで「確定解除」ボタンをクリックする, the 配車システム shall 依頼のステータスを「仮配置（TENTATIVE）」に変更する
4. When 配車係が詳細パネルで「キャンセル」ボタンをクリックする, the 配車システム shall 依頼のステータスを「キャンセル（CANCELLED）」に変更する
5. When 依頼が確定される, the 配車システム shall slotのステータスを「CONFIRMED」に変更する

### Requirement 8: 営業時間制約と06:00超過防止
**Objective:** As a 配車係, I want 営業時間（18:00〜翌06:00）内でのみ配車を配置できる, so that 営業時間外の配車を防止できる

#### Acceptance Criteria
1. The 配車システム shall タイムラインの表示範囲を18:00〜翌06:00に制限する
2. When 配車係がslotを翌06:00を超える位置にドロップしようとする, the 配車システム shall ドロップを拒否する
3. When 06:00超過のドロップが拒否される, the 配車システム shall トーストメッセージ「06:00を超えるため配置できません。開始時刻を前にずらしてください。」を表示する
4. The 配車システム shall ヘッダーに営業日表示（例：「2025/12/23 営業（18:00–翌06:00）」）を表示する
5. The 配車システム shall 18:00以前と翌06:00以降の時間帯を表示しない

### Requirement 9: 詳細パネル表示
**Objective:** As a 配車係, I want 依頼の詳細情報を確認・編集できる, so that 配車情報を正確に管理できる

#### Acceptance Criteria
1. When 配車係が依頼カードまたはslotをクリックする, the 配車システム shall 右サイドに詳細パネルをスライドイン表示する
2. When 詳細パネルが表示される, the 配車システム shall 依頼詳細（出発地、目的地、車情報、連絡先等）を表示する
3. When 詳細パネルが表示される, the 配車システム shall ルート情報と所要時間（base_duration）を表示する
4. When 詳細パネルが表示される, the 配車システム shall バッファ時間を表示し、手動調整（+/-）を可能にする
5. When 詳細パネルが表示される, the 配車システム shall 確定/解除/削除（キャンセル）ボタンを表示する
6. When 配車係が詳細パネルで住所を修正する, the 配車システム shall 依頼情報を更新する
7. When 配車係が詳細パネルでメモを更新する, the 配車システム shall 依頼情報を更新する

### Requirement 10: データ永続化
**Objective:** As a 配車係, I want 依頼・配車・車両情報が永続化される, so that データが失われない

#### Acceptance Criteria
1. The 配車システム shall 依頼（orders）をデータベースに保存する
2. The 配車システム shall 配車スロット（dispatch_slots）をデータベースに保存する
3. The 配車システム shall 車両（vehicles）情報をデータベースから取得する
4. When 依頼が作成・更新・削除される, the 配車システム shall データベースに反映する
5. When slotが作成・移動・確定・削除される, the 配車システム shall データベースに反映する


