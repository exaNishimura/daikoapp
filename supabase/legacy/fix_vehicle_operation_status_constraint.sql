-- vehicle_operation_statusテーブルのCHECK制約を修正
-- Supabase SQL Editorで実行してください

-- 既存の制約を削除
ALTER TABLE vehicle_operation_status DROP CONSTRAINT IF EXISTS check_time_required;

-- 新しい制約を追加（DEFAULTタイプの場合もtime IS NULLを許可）
ALTER TABLE vehicle_operation_status ADD CONSTRAINT check_time_required CHECK (
  (type IN ('STOP', 'START') AND time IS NOT NULL) OR
  (type = 'DAY_OFF' AND time IS NULL) OR
  (type = 'DEFAULT' AND time IS NULL)
);

