import { useEffect, useRef } from 'react'
import { formatTownNameWithKana, getDurationBand } from '@/lib/areaTowns'
import { importMapsLibrary } from '@/lib/places'
import './TravelTimeGoogleMap.css'

const SUZUKA_CENTER = { lat: 34.8823, lng: 136.5842 }

const BAND_FILL = {
  near: '#16a34a',
  mid: '#2563eb',
  far: '#d97706',
  long: '#dc2626',
  unknown: '#6b7280',
}

function circleIcon(fillColor, scale = 8) {
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  }
}

export function TravelTimeGoogleMap({ origin, originLabel, towns, selectedId, onSelect }) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map())
  const originMarkerRef = useRef(null)
  const infoRef = useRef(null)
  const townsRef = useRef(towns)
  const onSelectRef = useRef(onSelect)

  useEffect(() => {
    townsRef.current = towns
  }, [towns])

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const maps = await importMapsLibrary()
      if (cancelled || !maps || !hostRef.current || mapRef.current) return
      const map = new maps.Map(hostRef.current, {
        center: SUZUKA_CENTER,
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      })
      mapRef.current = map
      infoRef.current = new window.google.maps.InfoWindow()
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !window.google?.maps) return

    if (!originMarkerRef.current) {
      originMarkerRef.current = new window.google.maps.Marker({
        map,
        zIndex: 1000,
        title: originLabel || '出発地点',
      })
    }

    if (origin && typeof origin !== 'string' && Number.isFinite(origin.lat)) {
      originMarkerRef.current.setPosition(origin)
      originMarkerRef.current.setVisible(true)
      originMarkerRef.current.setTitle(originLabel || '出発地点')
      originMarkerRef.current.setIcon(circleIcon('#0f766e', 9))
    } else {
      originMarkerRef.current.setVisible(false)
    }
  }, [origin, originLabel])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !window.google?.maps) return

    const markers = markersRef.current
    const nextIds = new Set(towns.filter((t) => t.lat != null && t.lng != null).map((t) => t.id))

    for (const [id, marker] of markers) {
      if (!nextIds.has(id)) {
        marker.setMap(null)
        markers.delete(id)
      }
    }

    const bounds = new window.google.maps.LatLngBounds()
    let hasPoint = false

    if (origin && typeof origin !== 'string' && Number.isFinite(origin.lat)) {
      bounds.extend(origin)
      hasPoint = true
    }

    for (const town of towns) {
      if (town.lat == null || town.lng == null) continue
      const position = { lat: town.lat, lng: town.lng }
      bounds.extend(position)
      hasPoint = true
      const band = getDurationBand(town.minutes)
      let marker = markers.get(town.id)
      if (!marker) {
        marker = new window.google.maps.Marker({
          map,
          position,
          title: town.name,
        })
        marker.addListener('click', () => {
          onSelectRef.current?.(town.id)
        })
        markers.set(town.id, marker)
      } else {
        marker.setPosition(position)
      }
      marker.setIcon(circleIcon(BAND_FILL[band.key] || BAND_FILL.unknown))
      const townLabel = formatTownNameWithKana(town.name, town.kana)
      marker.setTitle(
        town.minutes != null
          ? `${town.city}${townLabel}（${town.minutes}分）`
          : `${town.city}${townLabel}`
      )
    }

    if (hasPoint && towns.some((t) => t.lat != null)) {
      map.fitBounds(bounds, 48)
    }
  }, [origin, towns])

  useEffect(() => {
    const map = mapRef.current
    const info = infoRef.current
    if (!map || !info || !selectedId) return
    const town = townsRef.current.find((t) => t.id === selectedId)
    const marker = markersRef.current.get(selectedId)
    if (!town || town.lat == null || town.lng == null) return
    map.panTo({ lat: town.lat, lng: town.lng })
    if (map.getZoom() < 13) map.setZoom(13)
    const duration = town.minutes != null ? `${town.minutes}分` : '未計算'
    const distance = town.distanceKm != null ? ` / ${town.distanceKm}km` : ''
    const townLabel = formatTownNameWithKana(town.name, town.kana)
    info.setContent(`<strong>${townLabel}</strong><br>${town.city}<br>${duration}${distance}`)
    info.open({ map, anchor: marker })
  }, [selectedId])

  return (
    <section ref={hostRef} className="travel-time-google-map" aria-label="各地名の所要時間地図" />
  )
}
