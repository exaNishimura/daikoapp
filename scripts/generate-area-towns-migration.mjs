import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(fs.readFileSync(path.join(root, 'src/data/areaTowns.json'), 'utf8'))

const PREFECTURE = data.prefecture || '三重県'
const CITIES = ['鈴鹿市', '亀山市', '四日市市', '津市']

function sqlStr(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`
}

const rows = CITIES.flatMap((city) =>
  (data.cities[city] ?? []).map((town) => ({
    prefecture: PREFECTURE,
    city,
    name: town.name,
    kana: town.kana ?? '',
    postal_code: town.zip || null,
  }))
)

if (rows.length === 0) {
  throw new Error('areaTowns.json から行を作れませんでした')
}

const valueTuples = rows.map(
  (row) =>
    `(${sqlStr(row.prefecture)}, ${sqlStr(row.city)}, ${sqlStr(row.name)}, ${sqlStr(row.kana)}, ${
      row.postal_code ? sqlStr(row.postal_code) : 'NULL'
    })`
)

const CHUNK = 80
const insertChunks = []
for (let i = 0; i < valueTuples.length; i += CHUNK) {
  insertChunks.push(valueTuples.slice(i, i + CHUNK).join(',\n  '))
}

const insertSql = insertChunks
  .map(
    (chunk) => `INSERT INTO public.area_towns (prefecture, city, name, kana, postal_code)
VALUES
  ${chunk}
ON CONFLICT (prefecture, city, name) DO UPDATE
SET
  kana = EXCLUDED.kana,
  postal_code = EXCLUDED.postal_code,
  updated_at = NOW();`
  )
  .join('\n\n')

const sql = `-- 営業エリア町名マスタ（鈴鹿・亀山・四日市・津）
-- 出典: 日本郵便 utf_ken_all.csv / ${data.updatedAt}
-- ${rows.length} 件。地名 (name) とフリガナ (kana) を保存する。

CREATE TABLE IF NOT EXISTS public.area_towns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefecture    TEXT NOT NULL DEFAULT '三重県',
  city          TEXT NOT NULL,
  name          TEXT NOT NULL,
  kana          TEXT NOT NULL DEFAULT '',
  postal_code   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT area_towns_prefecture_city_name_key UNIQUE (prefecture, city, name)
);

CREATE INDEX IF NOT EXISTS area_towns_city_idx
  ON public.area_towns (city);

CREATE INDEX IF NOT EXISTS area_towns_kana_idx
  ON public.area_towns (kana);

DROP TRIGGER IF EXISTS update_area_towns_updated_at ON public.area_towns;
CREATE TRIGGER update_area_towns_updated_at
  BEFORE UPDATE ON public.area_towns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.area_towns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read" ON public.area_towns;
CREATE POLICY "public_read" ON public.area_towns
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated_write" ON public.area_towns;
CREATE POLICY "authenticated_write" ON public.area_towns
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.area_towns TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.area_towns TO authenticated;

${insertSql}
`

const outPath = path.join(root, 'supabase/migrations/20260901033000_area_towns.sql')
fs.writeFileSync(outPath, sql, 'utf8')
console.log(`wrote ${outPath} (${rows.length} rows)`)
