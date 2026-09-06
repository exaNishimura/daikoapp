import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AREA_CITIES, AREA_TOWNS, chunkArray, filterAreaTowns } from '@/lib/areaTowns'
import { formatRouteCalculationError } from '@/lib/routeErrors'
import { importMapsLibrary } from '@/lib/places'
import { fetchDrivingDurations } from '@/services/distanceMatrixService'
import { fetchFavoriteTownIds, setAreaTownFavorite } from '@/services/areaTownsService'
import {
  clearFavoriteTownIds,
  loadFavoriteTownIds,
  setFavoriteTownId,
  townIdFromParts,
} from '@/lib/travelTimeFavorites'
import { supabase } from '@/lib/supabase'

const geocodeCache = new Map()
const KNOWN_TOWN_IDS = new Set(AREA_TOWNS.map((town) => town.id))

function createFavoriteIdSet() {
  return new Set(loadFavoriteTownIds().filter((id) => KNOWN_TOWN_IDS.has(id)))
}

function geolocationErrorMessage(error) {
  if (!error) return '現在地を取得できませんでした'
  if (error.code === 1) return '現在地の利用が拒否されました。ブラウザの許可を確認してください。'
  if (error.code === 2) return '現在地を特定できませんでした。'
  if (error.code === 3) return '現在地の取得がタイムアウトしました。'
  return error.message || '現在地を取得できませんでした'
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('このブラウザでは現在地を取得できません'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
    })
  })
}

async function geocodeAddress(address) {
  if (geocodeCache.has(address)) return geocodeCache.get(address)
  const maps = await importMapsLibrary()
  if (!maps || !window.google?.maps?.Geocoder) return null
  const geocoder = new window.google.maps.Geocoder()
  try {
    const response = await geocoder.geocode({ address, region: 'jp', language: 'ja' })
    const loc = response.results?.[0]?.geometry?.location
    if (!loc) return null
    const coords = { lat: loc.lat(), lng: loc.lng() }
    geocodeCache.set(address, coords)
    return coords
  } catch {
    return null
  }
}

async function reverseGeocodeLabel({ lat, lng }) {
  const maps = await importMapsLibrary()
  if (!maps || !window.google?.maps?.Geocoder) return '現在地'
  const geocoder = new window.google.maps.Geocoder()
  try {
    const response = await geocoder.geocode({
      location: { lat, lng },
      language: 'ja',
    })
    return response.results?.[0]?.formatted_address || '現在地'
  } catch {
    return '現在地'
  }
}

export function useTravelTimeMap() {
  const [city, setCity] = useState(AREA_CITIES[0])
  const [query, setQuery] = useState('')
  const [listMode, setListMode] = useState('favorites')
  const [favoriteIds, setFavoriteIds] = useState(createFavoriteIdSet)
  const [originAddress, setOriginAddress] = useState('')
  const [origin, setOrigin] = useState(null)
  const [originLabel, setOriginLabel] = useState('')
  const [resultsById, setResultsById] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [isComputing, setIsComputing] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState(null)
  const runIdRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function syncFavorites() {
      const remote = await fetchFavoriteTownIds()
      if (cancelled) return
      if (remote.error) return

      const local = loadFavoriteTownIds().filter((id) => KNOWN_TOWN_IDS.has(id))
      const remoteIds = remote.data.filter((id) => KNOWN_TOWN_IDS.has(id))
      const remoteSet = new Set(remoteIds)
      const toUpload = local.filter((id) => !remoteSet.has(id))
      if (toUpload.length > 0) {
        await Promise.all(toUpload.map((id) => setAreaTownFavorite(id, true)))
      }
      if (cancelled) return
      setFavoriteIds(new Set([...remoteIds, ...toUpload]))
      if (local.length > 0) clearFavoriteTownIds()
    }

    void syncFavorites()

    if (!supabase) {
      return () => {
        cancelled = true
      }
    }

    const channel = supabase
      .channel('area-town-favorites')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'area_towns' },
        (payload) => {
          const row = payload.new
          if (!row?.city || !row?.name) return
          const id = townIdFromParts(row.city, row.name)
          if (!KNOWN_TOWN_IDS.has(id)) return
          setFavoriteIds((prev) => {
            const next = new Set(prev)
            if (row.is_favorite) next.add(id)
            else next.delete(id)
            return next
          })
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      channel.unsubscribe()
    }
  }, [])

  const visibleTowns = useMemo(() => {
    const filtered = filterAreaTowns(AREA_TOWNS, {
      city,
      query,
      favoriteIds: listMode === 'favorites' ? favoriteIds : null,
    })
    return filtered.map((town) => {
      const result = resultsById[town.id]
      return {
        ...town,
        minutes: result?.minutes ?? null,
        distanceKm: result?.distanceKm ?? null,
        lat: result?.lat ?? null,
        lng: result?.lng ?? null,
        routeStatus: result?.status ?? null,
      }
    })
  }, [city, favoriteIds, listMode, query, resultsById])

  const cityFavoriteCount = useMemo(
    () =>
      AREA_TOWNS.reduce(
        (count, town) => count + (town.city === city && favoriteIds.has(town.id) ? 1 : 0),
        0
      ),
    [city, favoriteIds]
  )

  const toggleFavorite = useCallback(async (id, isFavorite) => {
    setFavoriteIds((prev) => new Set(setFavoriteTownId(prev, id, isFavorite)))
    const { error: saveError } = await setAreaTownFavorite(id, isFavorite)
    if (saveError) {
      setFavoriteIds((prev) => new Set(setFavoriteTownId(prev, id, !isFavorite)))
      setError('よく使うの保存に失敗しました。通信を確認してください。')
    }
  }, [])

  const selectTown = useCallback(async (id) => {
    setSelectedId(id)
    const town = AREA_TOWNS.find((item) => item.id === id)
    if (!town) return
    const coords = await geocodeAddress(town.address)
    if (!coords) return
    setResultsById((prev) => {
      if (prev[id]?.lat != null) return prev
      return {
        ...prev,
        [id]: {
          id,
          minutes: prev[id]?.minutes ?? null,
          distanceKm: prev[id]?.distanceKm ?? null,
          status: prev[id]?.status ?? null,
          lat: coords.lat,
          lng: coords.lng,
        },
      }
    })
  }, [])

  const computeDurations = useCallback(async () => {
    const runId = ++runIdRef.current
    const targets = filterAreaTowns(AREA_TOWNS, {
      city,
      query,
      favoriteIds: listMode === 'favorites' ? favoriteIds : null,
    })
    if (targets.length === 0) {
      setError('表示中の町名がありません。市または検索条件を変えてください。')
      return
    }

    setIsComputing(true)
    setError(null)
    setProgress({ done: 0, total: targets.length })

    try {
      const address = originAddress.trim()
      let nextOrigin
      let nextLabel
      if (address) {
        nextLabel = address
        nextOrigin = (await geocodeAddress(address)) || address
      } else {
        const position = await getCurrentPosition()
        nextOrigin = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        nextLabel = await reverseGeocodeLabel(nextOrigin)
      }

      if (runId !== runIdRef.current) return
      setOrigin(nextOrigin)
      setOriginLabel(nextLabel)

      const fetched = await fetchDrivingDurations({
        origin: nextOrigin,
        destinations: targets,
        shouldAbort: () => runId !== runIdRef.current,
        onBatch: async ({ items, done, total }) => {
          if (runId !== runIdRef.current) return
          const townById = new Map(targets.map((town) => [town.id, town]))
          const coordsById = {}
          for (const batch of chunkArray(items, 5)) {
            await Promise.all(
              batch.map(async (item) => {
                const town = townById.get(item.id)
                if (!town) return
                const coords = await geocodeAddress(town.address)
                if (coords) coordsById[item.id] = coords
              })
            )
          }
          if (runId !== runIdRef.current) return
          setProgress({ done, total })
          setResultsById((prev) => {
            const next = { ...prev }
            for (const item of items) {
              next[item.id] = {
                ...item,
                lat: coordsById[item.id]?.lat ?? prev[item.id]?.lat ?? null,
                lng: coordsById[item.id]?.lng ?? prev[item.id]?.lng ?? null,
              }
            }
            return next
          })
        },
      })

      if (runId !== runIdRef.current) return
      if (fetched.error && !fetched.aborted) {
        setError(formatRouteCalculationError(fetched.error))
      }
    } catch (err) {
      if (runId !== runIdRef.current) return
      setError(geolocationErrorMessage(err))
    } finally {
      if (runId === runIdRef.current) {
        setIsComputing(false)
      }
    }
  }, [city, favoriteIds, listMode, originAddress, query])

  return {
    city,
    setCity,
    query,
    setQuery,
    originAddress,
    setOriginAddress,
    origin,
    originLabel,
    visibleTowns,
    selectedId,
    selectTown,
    listMode,
    setListMode,
    favoriteIds,
    toggleFavorite,
    cityFavoriteCount,
    isComputing,
    progress,
    error,
    computeDurations,
  }
}
