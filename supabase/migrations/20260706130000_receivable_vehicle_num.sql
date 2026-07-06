-- シフト表売掛を号車単位で管理するため vehicle_num を追加

ALTER TABLE public.accounts_receivable
  ADD COLUMN IF NOT EXISTS vehicle_num SMALLINT CHECK (vehicle_num IS NULL OR vehicle_num BETWEEN 1 AND 9);

CREATE INDEX IF NOT EXISTS idx_ar_shift_vehicle
  ON public.accounts_receivable (work_date, vehicle_num)
  WHERE source_file = 'shift-calendar';
