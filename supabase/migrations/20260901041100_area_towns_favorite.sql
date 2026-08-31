-- よく使う町名（☆）を全端末で共有する
ALTER TABLE public.area_towns
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS area_towns_is_favorite_idx
  ON public.area_towns (city)
  WHERE is_favorite;

DROP POLICY IF EXISTS "public_favorite_update" ON public.area_towns;
CREATE POLICY "public_favorite_update" ON public.area_towns
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT UPDATE (is_favorite) ON public.area_towns TO anon, authenticated;

ALTER TABLE public.area_towns REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.area_towns;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
