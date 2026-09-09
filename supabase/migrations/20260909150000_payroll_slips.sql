-- 従業員の雇用形態・税額表区分 + 給与明細テーブル

-- =============================================================================
-- employees 追加列
-- =============================================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'EMPLOYED',
  ADD COLUMN IF NOT EXISTS tax_table_type TEXT NOT NULL DEFAULT 'OTSU',
  ADD COLUMN IF NOT EXISTS dependents_count INT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_employment_type_check'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_employment_type_check
      CHECK (employment_type IN ('EMPLOYED', 'CONTRACT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_tax_table_type_check'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_tax_table_type_check
      CHECK (tax_table_type IN ('KOU', 'OTSU'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_dependents_count_check'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_dependents_count_check
      CHECK (dependents_count >= 0 AND dependents_count <= 5);
  END IF;
END $$;

COMMENT ON COLUMN public.employees.employment_type IS 'EMPLOYED=雇用 / CONTRACT=業務委託';
COMMENT ON COLUMN public.employees.tax_table_type IS 'KOU=甲欄 / OTSU=乙欄（源泉徴収）';
COMMENT ON COLUMN public.employees.dependents_count IS '扶養親族等の数（甲欄用・0〜5）';

-- anon は PIN ハッシュ等を読めない（公開列のみ）。列追加に合わせて再付与
REVOKE ALL ON public.employees FROM anon;
GRANT SELECT (
  id,
  name,
  license_type,
  color,
  hourly_wage,
  is_active,
  sort_order,
  created_at,
  updated_at,
  shift_pin_configured,
  employment_type,
  tax_table_type,
  dependents_count
) ON public.employees TO anon;

-- authenticated も同様に SELECT 列を明示（既存 GRANT がある場合は追加）
GRANT SELECT (
  id,
  name,
  license_type,
  color,
  hourly_wage,
  is_active,
  sort_order,
  created_at,
  updated_at,
  shift_pin_configured,
  employment_type,
  tax_table_type,
  dependents_count
) ON public.employees TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.employees TO authenticated;

-- =============================================================================
-- payroll_slips
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payroll_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year_month DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  total_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
  hourly_wage_snapshot NUMERIC(10, 2) NOT NULL DEFAULT 0,
  base_pay INT NOT NULL DEFAULT 0,
  allowance INT NOT NULL DEFAULT 0,
  gross_pay INT NOT NULL DEFAULT 0,
  social_insurance INT NOT NULL DEFAULT 0,
  other_deduction INT NOT NULL DEFAULT 0,
  taxable_base INT NOT NULL DEFAULT 0,
  tax_table_type TEXT NOT NULL DEFAULT 'OTSU',
  dependents_count INT NOT NULL DEFAULT 0,
  withholding_tax INT NOT NULL DEFAULT 0,
  withholding_overridden BOOLEAN NOT NULL DEFAULT false,
  net_pay INT NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_slips_employee_month_unique UNIQUE (employee_id, year_month),
  CONSTRAINT payroll_slips_status_check CHECK (status IN ('DRAFT', 'PUBLISHED')),
  CONSTRAINT payroll_slips_tax_table_type_check CHECK (tax_table_type IN ('KOU', 'OTSU')),
  CONSTRAINT payroll_slips_dependents_count_check CHECK (dependents_count >= 0 AND dependents_count <= 5),
  CONSTRAINT payroll_slips_year_month_first CHECK (EXTRACT(DAY FROM year_month) = 1)
);

CREATE INDEX IF NOT EXISTS idx_payroll_slips_year_month
  ON public.payroll_slips (year_month);

CREATE INDEX IF NOT EXISTS idx_payroll_slips_employee
  ON public.payroll_slips (employee_id);

CREATE INDEX IF NOT EXISTS idx_payroll_slips_status
  ON public.payroll_slips (status);

COMMENT ON TABLE public.payroll_slips IS '従業員給与明細（雇用のみ。業務委託は対象外）';

-- updated_at 自動更新
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_payroll_slips_updated_at ON public.payroll_slips;
    CREATE TRIGGER update_payroll_slips_updated_at
      BEFORE UPDATE ON public.payroll_slips
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.payroll_slips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_slips_authenticated_all" ON public.payroll_slips;
CREATE POLICY "payroll_slips_authenticated_all"
  ON public.payroll_slips
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- anon は直接アクセス不可（Edge Function / service role 経由のみ）
DROP POLICY IF EXISTS "payroll_slips_anon_deny" ON public.payroll_slips;
CREATE POLICY "payroll_slips_anon_deny"
  ON public.payroll_slips
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_slips TO authenticated;
REVOKE ALL ON public.payroll_slips FROM anon;
