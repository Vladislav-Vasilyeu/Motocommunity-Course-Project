/// <reference types="google.maps" />
import { t, useLocale, getLocale } from '../../shared/i18n'
import { useTheme } from '../preferences/theme'

import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { useEffect, useRef, useState } from 'react'
import { ErrorState, LoadingState } from '../../shared/ui'

declare global {
  interface Window {
    gm_authFailure?: () => void
  }
}

export type MapPoint = google.maps.LatLngLiteral
export type MapMarker = MapPoint & { id: string; title: string; detail?: string; description?: string; order?: number }

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID'
const center = { lat: 53.9, lng: 27.56 }
const routeColor = '#CCFA4B'
let configured = false
let providerLocale: string | null = null

type MapInstance = {
  map: google.maps.Map
  maps: google.maps.MapsLibrary
  markers: google.maps.MarkerLibrary
}

type GoogleMapProps = {
  markers: MapMarker[]
  line: MapPoint[]
  focus: MapPoint[]
  selectedId: string | null
  onAvailabilityChange: (available: boolean) => void
}

export default function GoogleMap(props: GoogleMapProps) {
  const { resolvedTheme } = useTheme()
  useLocale()
  const [attempt, setAttempt] = useState(0)
  if (!apiKey) {
    return <p className="map-provider-note" role="status">{t("Google Maps не настроена. Места и точки маршрута доступны в списках на этой странице.")}</p>
  }
  return <>{configured && providerLocale !== getLocale() && <p className="map-provider-note">{t('Чтобы обновить язык элементов Google Maps, перезагрузите страницу.')} <button className="button button-secondary" onClick={() => window.location.reload()}>{t('Перезагрузить')}</button></p>}<MapView key={`${attempt}:${resolvedTheme}`} {...props} apiKey={apiKey} onRetry={() => setAttempt((value) => value + 1)}/></>
}

function MapView({ markers, line, focus, selectedId, onAvailabilityChange, apiKey, onRetry }: GoogleMapProps & { apiKey: string; onRetry: () => void }) {
  useLocale()
  const { resolvedTheme } = useTheme()
  const container = useRef<HTMLDivElement>(null)
  const [instance, setInstance] = useState<MapInstance | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const element = container.current
    if (!element) return

    let active = true
    let map: google.maps.Map | undefined
    let failed = false
    const previousAuthFailure = window.gm_authFailure
    const fail = () => {
      if (!active || failed) return
      failed = true
      window.clearTimeout(timeout)
      setStatus('error')
      onAvailabilityChange(false)
    }
    const timeout = window.setTimeout(fail, 15_000)
    const authFailure = () => {
      fail()
      previousAuthFailure?.()
    }
    window.gm_authFailure = authFailure

    async function initialize() {
      if (!configured) {
        setOptions({ key: apiKey, v: 'weekly', language: getLocale() })
        configured = true
        providerLocale = getLocale()
      }
      const [maps, markerLibrary] = await Promise.all([importLibrary('maps'), importLibrary('marker')])
      if (!active || failed) return
      const loadedMap = new maps.Map(element!, {
        center, zoom: 7, maxZoom: 18, mapId, colorScheme: resolvedTheme === 'dark' ? 'DARK' : 'LIGHT',
        backgroundColor: '#253A33', gestureHandling: 'cooperative',
        mapTypeControl: false, streetViewControl: false, clickableIcons: false,
      })
      map = loadedMap
      google.maps.event.addListenerOnce(loadedMap, 'tilesloaded', () => {
        if (!active || failed) return
        window.clearTimeout(timeout)
        setStatus('ready')
        setInstance({ map: loadedMap, maps, markers: markerLibrary })
        onAvailabilityChange(true)
      })
    }

    void initialize().catch(fail)
    return () => {
      active = false
      window.clearTimeout(timeout)
      if (window.gm_authFailure === authFailure) window.gm_authFailure = previousAuthFailure
      if (map) google.maps.event.clearInstanceListeners(map)
      element.replaceChildren()
    }
  }, [apiKey, onAvailabilityChange, resolvedTheme])

  const selected = markers.find((marker) => marker.id === selectedId)
  useEffect(() => {
    if (!instance) return
    const { map } = instance
    if (selected) {
      map.setCenter(selected)
      map.setZoom(14)
    } else if (focus.length > 1 && focus.some(({ lat, lng }) => lat !== focus[0].lat || lng !== focus[0].lng)) {
      const bounds = new google.maps.LatLngBounds()
      for (const point of focus) bounds.extend(point)
      map.fitBounds(bounds, 40)
    } else {
      map.setCenter(focus[0] ?? center)
      map.setZoom(focus.length ? 12 : 7)
    }
  }, [instance, focus, selected])

  useEffect(() => {
    if (!instance) return
    const { map, maps, markers: { AdvancedMarkerElement, PinElement } } = instance
    const info = new maps.InfoWindow()
    const handles = markers.map((point) => {
      const marker = new AdvancedMarkerElement({
        map, position: point, title: point.title, gmpClickable: true,
      })
      if (point.id === selectedId || point.order != null) {
        marker.append(new PinElement({
          background: routeColor, borderColor: '#253A33', glyphColor: '#253A33',
          glyphText: point.order?.toString(),
        }))
      }
      const open = () => {
        const content = document.createElement('div')
        content.className = 'map-marker-info'
        const title = document.createElement('strong')
        title.textContent = point.title
        content.append(title)
        for (const text of [point.detail, point.description]) {
          if (!text) continue
          const paragraph = document.createElement('p')
          paragraph.textContent = text
          content.append(paragraph)
        }
        info.setContent(content)
        info.open({ map, anchor: marker })
      }
      marker.addEventListener('gmp-click', open)
      return { marker, open }
    })
    return () => {
      info.close()
      for (const { marker, open } of handles) {
        marker.removeEventListener('gmp-click', open)
        marker.map = null
      }
    }
  }, [instance, markers, selectedId])

  useEffect(() => {
    if (!instance || line.length < 2) return
    const options = { map: instance.map, path: line, clickable: false }
    const outline = new instance.maps.Polyline({ ...options, strokeColor: '#253A33', strokeWeight: 8, zIndex: 1 })
    const route = new instance.maps.Polyline({ ...options, strokeColor: routeColor, strokeWeight: 5, zIndex: 2 })
    return () => {
      outline.setMap(null)
      route.setMap(null)
    }
  }, [instance, line])

  return <div className="google-map-frame">
    <div className="google-map" ref={container} aria-hidden={status !== 'ready'} inert={status !== 'ready'}/>
    {status === 'loading' && <div className="google-map-status"><LoadingState label={t("Загружаю Google Maps…")}/></div>}
    {status === 'error' && <div className="google-map-status"><ErrorState message={t("Не удалось загрузить Google Maps. Места и точки маршрута доступны в списках на этой странице.")} onRetry={onRetry}/></div>}
  </div>
}
