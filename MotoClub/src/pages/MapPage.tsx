import { t, useLocale } from '../shared/i18n'
import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import GoogleMap from '../features/map/GoogleMap'
import type { MapMarker, MapPoint } from '../features/map/GoogleMap'
import type { CommunityRoute, Place, Trip } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'
import { usePageResource } from './usePageResource'
import './routes-messages.css'

function coordinates(latitude: string | number, longitude: string | number): MapPoint | null {
  if (String(latitude).trim() === '' || String(longitude).trim() === '') return null
  const lat = Number(latitude)
  const lng = Number(longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

type Waypoint = {
  id: string
  title: string
  detail?: string
  coordinates: MapPoint | null
}

export default function MapPage() {
  const { locale } = useLocale()
  const [params] = useSearchParams()
  const routeId = params.get('route')
  const tripId = params.get('trip')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [mapAvailable, setMapAvailable] = useState(false)
  const mapSection = useRef<HTMLElement>(null)
  const selectionScope = JSON.stringify([routeId, tripId])
  const [selection, setSelection] = useState<{ scope: string; id: string } | null>(null)
  const selectedPlace = selection?.scope === selectionScope ? selection.id : null

  const places = usePageResource<{ places: Place[] }>('/api/places')
  const trips = usePageResource<{ trips: Trip[] }>(routeId || tripId ? null : '/api/trips')
  const tripDetail = usePageResource<{ trip: Trip }>(tripId && !routeId ? `/api/trips/${encodeURIComponent(tripId)}` : null)
  const route = usePageResource<{ route: CommunityRoute }>(routeId ? `/api/routes/${encodeURIComponent(routeId)}` : null)
  const selectedTrip = tripDetail.data?.trip
  const selectedRoute = route.data?.route

  const categories = useMemo(() => [...new Set(places.data?.places.map((place) => place.category))].sort(), [places.data])
  const visiblePlaces = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('ru')
    return (places.data?.places ?? [])
      .filter((place) => (!category || place.category === category) && `${place.name} ${place.city} ${place.description ?? ''}`.toLocaleLowerCase('ru').includes(search))
      .map((place) => ({ place, coordinates: coordinates(place.latitude, place.longitude) }))
  }, [places.data, category, query])

  const waypoints = useMemo<Waypoint[]>(() => {
    if (routeId) {
      return (selectedRoute?.waypoints ?? []).map((point) => ({
        id: `route-${point.id}`, title: point.title, coordinates: coordinates(point.latitude, point.longitude),
      }))
    }
    const visibleTrips = tripId ? selectedTrip ? [selectedTrip] : [] : trips.data?.trips ?? []
    return visibleTrips.flatMap((trip) => trip.waypoints.map((point) => ({
      id: `trip-${trip.id}-${point.id}`, title: point.label || trip.title, detail: trip.title,
      coordinates: coordinates(point.latitude, point.longitude),
    })))
  }, [routeId, tripId, selectedRoute, selectedTrip, trips.data])
  const hasSelectedPath = Boolean(routeId || tripId)
  const waypointMarkers = useMemo<MapMarker[]>(() => waypoints.flatMap((point, index) => point.coordinates ? [{
    ...point.coordinates, id: point.id, title: point.title, detail: point.detail, order: hasSelectedPath ? index + 1 : undefined,
  }] : []), [waypoints, hasSelectedPath])
  const placeMarkers = useMemo<MapMarker[]>(() => visiblePlaces.flatMap(({ place, coordinates: location }) => location ? [{
    ...location, id: `place-${place.id}`, title: place.name, detail: `${t(place.category)} · ${place.city}`, description: place.description,
  }] : []), [visiblePlaces, locale])
  const markers = useMemo(() => [...placeMarkers, ...waypointMarkers], [placeMarkers, waypointMarkers])
  const line = useMemo(() => hasSelectedPath ? waypointMarkers : [], [hasSelectedPath, waypointMarkers])
  const focus = hasSelectedPath ? waypointMarkers : markers
  const title = selectedRoute?.title || selectedTrip?.title

  return <div className="route-feature">
    <PageTitle eyebrow={t("Карта сообщества")} title={t("Карта и места")} description={t("Маршруты, точки поездок и полезные остановки.")}
      action={<Link className="button button-secondary" to="/routes">{t("Каталог маршрутов")}</Link>}/>
    {places.error && <ErrorState message={places.error} onRetry={places.reload}/>}
    {trips.error && <ErrorState message={trips.error} onRetry={trips.reload}/>}
    {route.error && <ErrorState message={route.error} onRetry={route.reload}/>}
    {tripDetail.error && <ErrorState message={tripDetail.error} onRetry={tripDetail.reload}/>}
    {tripId && !routeId && !tripDetail.loading && !selectedTrip && !tripDetail.error &&
      <ErrorState message={t("Выбранная поездка не найдена. Возможно, она была удалена.")}/>}

    <section className="panel map-workspace" aria-label={t("Карта и фильтры")} ref={mapSection} tabIndex={-1}>
      <div className="map-feature-controls">
        <label>{t("Поиск места")}{' '}<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setSelection(null) }}
            placeholder={t("Название, город или описание")}/>
        </label>
        <label>{t("Категория")}{' '}<select value={category} onChange={(event) => { setCategory(event.target.value); setSelection(null) }}>
            <option value="">{t("Все места")}</option>
            {categories.map((value) => <option key={value} value={value}>{t(value)}</option>)}
          </select>
        </label>
        <a href="#map-places" className="button button-secondary">{t("Список мест")}</a>
      </div>
      <GoogleMap markers={markers} line={line} focus={focus}
        selectedId={selectedPlace ? `place-${selectedPlace}` : null} onAvailabilityChange={setMapAvailable}/>
      {(trips.loading || route.loading || tripDetail.loading) && <p className="feature-muted" role="status">{t("Загружаю точки поездок и маршрутов…")}</p>}
      {title && <div className="map-route-summary">
        <h2>{title}</h2>
        {line.length > 1 && <p className="feature-muted">{t("Линия соединяет остановки по порядку. Навигация по дорогам недоступна.")}</p>}
        <Link className="button button-secondary" to={routeId ? `/routes/${encodeURIComponent(routeId)}` : '/trips'}>
          {' '}{t("Вернуться к")}{' '}{routeId ? t("маршруту") : t("поездкам")}
        </Link>
      </div>}
    </section>

    {title && waypoints.length > 0 && <section className="panel map-detail-list" aria-labelledby="map-waypoints-title">
      <h2 id="map-waypoints-title" className="map-list-title">{t("Остановки")}</h2>
      <ol className="map-waypoint-list">
        {waypoints.map((point) => <li key={point.id}>
          <strong>{point.title}</strong>
          <span className="feature-muted">{point.coordinates ? `${point.coordinates.lat.toFixed(5)}, ${point.coordinates.lng.toFixed(5)}` : t("Координаты недоступны")}</span>
        </li>)}
      </ol>
    </section>}

    <section className="panel map-detail-list" aria-labelledby="map-places-title" id="map-places" tabIndex={-1}>
      <h2 id="map-places-title" className="map-list-title">{t("Полезные места")}</h2>
      {places.loading && <LoadingState/>}
      {places.data && (visiblePlaces.length === 0
        ? <EmptyState title={t("Нет подходящих мест")} description={t("Измените запрос или выберите другую категорию.")}/>
        : <ul className="map-places-list">
          {visiblePlaces.map(({ place, coordinates: location }) => {
            const isSelected = mapAvailable && selectedPlace === place.id
            return <li key={place.id} className={`map-place-card ${isSelected ? 'is-selected' : ''}`}>
              <div>
                <h3>{place.name}</h3>
                <span className="feature-muted">{t(place.category)} · {place.city}</span>
                {place.description && <p>{place.description}</p>}
                <small className="feature-muted">{location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : t("Координаты недоступны")}</small>
              </div>
              {location && mapAvailable && <button type="button" className="button button-secondary"
                aria-label={t("Показать на карте: {p0}", { p0: place.name })} aria-pressed={isSelected}
                onClick={() => {
                  setSelection({ scope: selectionScope, id: place.id })
                  mapSection.current?.focus({ preventScroll: true })
                  mapSection.current?.scrollIntoView({ block: 'start' })
                }}>
                {' '}{t("На карте")}{' '}</button>}
            </li>
          })}
        </ul>)}
    </section>
  </div>
}
