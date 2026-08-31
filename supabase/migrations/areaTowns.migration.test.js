import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATION_NAME = '20260901033000_area_towns.sql'
const migrationPath = join(process.cwd(), 'supabase', 'migrations', MIGRATION_NAME)

describe('area_towns migration', () => {
  it('マイグレーションファイルが存在する', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('地名・フリガナのスキーマと RLS を含む', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.area_towns/)
    expect(sql).toMatch(/name\s+TEXT NOT NULL/)
    expect(sql).toMatch(/kana\s+TEXT NOT NULL DEFAULT ''/)
    expect(sql).toMatch(/area_towns_prefecture_city_name_key/)
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(sql).toMatch(/POLICY "public_read" ON public\.area_towns/)
    expect(sql).toMatch(/POLICY "authenticated_write" ON public\.area_towns/)
    expect(sql).toMatch(/INSERT INTO public\.area_towns/)
    expect(sql).toMatch(/アコソチョウ/)
    expect(sql).toMatch(/鈴鹿市/)
    expect(sql).toMatch(/亀山市/)
    expect(sql).toMatch(/四日市市/)
    expect(sql).toMatch(/津市/)
  })

  it('820 件分の VALUES 行を含む', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    const valueRows = sql.match(/^\s+\('三重県',/gm) ?? []
    expect(valueRows).toHaveLength(820)
  })
})

describe('area_towns favorite migration', () => {
  const favoritePath = join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260901041100_area_towns_favorite.sql'
  )

  it('adds shared is_favorite column and realtime', () => {
    expect(existsSync(favoritePath)).toBe(true)
    const sql = readFileSync(favoritePath, 'utf8')
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false/)
    expect(sql).toMatch(/POLICY "public_favorite_update"/)
    expect(sql).toMatch(/GRANT UPDATE \(is_favorite\)/)
    expect(sql).toMatch(/supabase_realtime ADD TABLE public\.area_towns/)
  })
})
