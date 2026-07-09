-- シフト設定時の予定時間を保持（売上入力の実績時間で上書きされない）
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS planned_start TIME WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS planned_end TIME WITHOUT TIME ZONE;

UPDATE public.shifts
SET
  planned_start = COALESCE(planned_start, start),
  planned_end = COALESCE(planned_end, "end")
WHERE status IS NULL;
