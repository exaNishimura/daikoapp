-- shifts に従業員マスタへの参照 (employee_id) を追加
-- staff 列は表示用スナップショットとして残す（移行期間の後方互換）

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_employee_id ON public.shifts(employee_id);

-- 既存: staff 名から employee_id をバックフィル
UPDATE public.shifts s
SET employee_id = e.id
FROM public.employees e
WHERE s.employee_id IS NULL
  AND s.staff IS NOT NULL
  AND btrim(s.staff) = btrim(e.name);
