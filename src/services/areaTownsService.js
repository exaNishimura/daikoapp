import { supabase } from '@/lib/supabase'
import { AREA_PREFECTURE } from '@/lib/areaTowns'
import { parseTownId, townIdFromParts } from '@/lib/travelTimeFavorites'

export async function fetchFavoriteTownIds() {
  if (!supabase) return { data: [], error: new Error('Supabase not initialized') }
  try {
    const { data, error } = await supabase
      .from('area_towns')
      .select('city, name')
      .eq('is_favorite', true)
    if (error) throw error
    return {
      data: (data ?? []).map((row) => townIdFromParts(row.city, row.name)),
      error: null,
    }
  } catch (error) {
    console.error('fetchFavoriteTownIds:', error)
    return { data: [], error }
  }
}

export async function setAreaTownFavorite(id, isFavorite) {
  if (!supabase) return { error: new Error('Supabase not initialized') }
  const parsed = parseTownId(id)
  if (!parsed) return { error: new Error('Invalid town id') }
  try {
    const { error } = await supabase
      .from('area_towns')
      .update({ is_favorite: isFavorite })
      .eq('prefecture', AREA_PREFECTURE)
      .eq('city', parsed.city)
      .eq('name', parsed.name)
    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('setAreaTownFavorite:', error)
    return { error }
  }
}
