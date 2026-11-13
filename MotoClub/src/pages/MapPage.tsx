import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import type { LatLngTuple } from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerRetinaIcon from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import type { CommunityRoute, Place, Trip } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'
import { usePageResource } from './usePageResource'
import './routes-messages.css'

L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerRetinaIcon, shadowUrl: markerShadow })
const isCoordinate = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

function MapFocus({ points, selected }: { points: LatLngTuple[]; selected: LatLngTuple | null }) {
  const map = useMap()
  useEffect(() => {
    if (selected) map.setView(selected, 14)
    else if (points.length === 1) map.setView(points[0], 12)
    else if (points.length > 1) map.fitBounds(points, { padding: [32, 32], maxZoom: 14 })
    else map.setView([53.9, 27.56], 7)
  }, [map, points, selected])
  return null
}

export default function MapPage() {
  const [params] = useSearchParams()
  const routeId = params.get('route')
  const tripId = params.get('trip')
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const selectionScope = `${routeId ?? ''}:${tripId ?? ''}`
  const [selection, setSelection] = useState<{ scope: string; id: string | null }>({ scope: '', id: null })
  const selectedPlace = selection.scope === selectionScope ? selection.id : null
  const setSelectedPlace = (id: string | null) => setSelection({ scope: selectionScope, id })
  const places = usePageResource<{ places: Place[] }>('/api/places')
  const trips = usePageResource<{ trips: Trip[] }>(routeId || tripId ? null : '/api/trips')
  const tripDetail = usePageResource<{ trip: Trip }>(tripId && !routeId ? `/api/trips/${encodeURIComponent(tripId)}` : null)
  const route = usePageResource<{ route: CommunityRoute }>(routeId ? `/api/routes/${encodeURIComponent(routeId)}` : null)
  const selectedTrip = tripDetail.data?.trip
  const categories = useMemo(() => [...new Set(places.data?.places.map((place) => place.category) ?? [])].sort(), [places.data])
  const visiblePlaces = useMemo(() => (places.data?.places ?? []).filter((place) => (!category || place.category === category) && `${place.name} ${place.city} ${place.description ?? ''}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))), [places.data, category, query])
  const placePoints = useMemo(() => visiblePlaces.map((place) => ({ place, lat: Number(place.latitude), lng: Number(place.longitude) })).filter((point) => isCoordinate(point.lat, point.lng)), [visiblePlaces])
  const tripPoints = useMemo(() => (routeId ? [] : tripId ? selectedTrip ? [selectedTrip] : [] : trips.data?.trips ?? []).flatMap((trip) => trip.waypoints.map((point) => ({ id: `${trip.id}-${point.id}`, title: point.label || trip.title, detail: trip.title, lat: Number(point.latitude), lng: Number(point.longitude) }))).filter((point) => isCoordinate(point.lat, point.lng)), [routeId, tripId, selectedTrip, trips.data])
  const routePoints = useMemo(() => (route.data?.route.waypoints ?? []).map((point) => ({ id: point.id, title: point.title, lat: Number(point.latitude), lng: Number(point.longitude) })).filter((point) => isCoordinate(point.lat, point.lng)), [route.data])
  const focusPoints = useMemo<LatLngTuple[]>(() => (routeId ? routePoints : tripId ? tripPoints : [...placePoints, ...tripPoints]).map((point) => [point.lat, point.lng]), [routeId, tripId, routePoints, tripPoints, placePoints])
  const selected = useMemo<LatLngTuple | null>(() => { const point = placePoints.find((item) => item.place.id === selectedPlace); return point ? [point.lat, point.lng] : null }, [placePoints, selectedPlace])
  const loading = places.loading || trips.loading || route.loading || tripDetail.loading
  const title = route.data?.route.title || selectedTrip?.title
  const line = routeId ? routePoints : tripId ? tripPoints : []

  return <div className="route-feature"><PageTitle eyebrow="Карта сообщества" title="Карта и места" description="Маршруты, точки поездок и полезные остановки. Все места доступны также списком." action={<Link className="button button-secondary" to="/routes">Каталог маршрутов</Link>}/>
    <div className="panel map-feature-controls"><label>Поиск места<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setSelectedPlace(null) }} placeholder="Название, город или описание"/></label><label>Категория<select value={category} onChange={(event) => { setCategory(event.target.value); setSelectedPlace(null) }}><option value="">Все места</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
    {title && <div className="panel map-route-notice"><strong>{routeId ? 'Маршрут' : 'Поездка'} · {title}</strong><p className="feature-muted">Лаймовая линия соединяет точки по порядку, а не показывает автомобильный маршрут по дорогам.</p><Link to={routeId ? `/routes/${routeId}` : '/trips'}>Вернуться к {routeId ? 'маршруту' : 'поездкам'}</Link></div>}
    {places.error && <ErrorState message={places.error} onRetry={places.reload}/ >}{trips.error && <ErrorState message={trips.error} onRetry={trips.reload}/ >}{route.error && <ErrorState message={route.error} onRetry={route.reload}/ >}{tripDetail.error && <ErrorState message={tripDetail.error} onRetry={tripDetail.reload}/ >}
    {!loading && tripId && !routeId && !selectedTrip && !tripDetail.error && <ErrorState message="Выбранная поездка не найдена. Возможно, она была удалена."/>}
    {loading ? <LoadingState/> : <div className="map-feature-grid"><div className="map-panel panel"><MapContainer center={[53.9, 27.56]} zoom={7} scrollWheelZoom={false} className="leaflet-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><MapFocus points={focusPoints} selected={selected}/>{placePoints.map(({ place, lat, lng }) => <Marker key={`place-${place.id}`} position={[lat, lng]}><Popup><strong>{place.name}</strong><br/>{place.category} · {place.city}{place.description && <p>{place.description}</p>}</Popup></Marker>)}{tripPoints.map((point) => <Marker key={`trip-${point.id}`} position={[point.lat, point.lng]}><Popup><strong>{point.title}</strong><br/>{point.detail}</Popup></Marker>)}{routePoints.map((point, index) => <Marker key={`route-${point.id}`} position={[point.lat, point.lng]}><Popup><strong>{index + 1}. {point.title}</strong></Popup></Marker>)}{line.length > 1 && <Polyline positions={line.map((point) => [point.lat, point.lng])} pathOptions={{ color: '#CCFA4B', weight: 5 }}/> }</MapContainer><div className="map-caption">{placePoints.length} мест · {routePoints.length + tripPoints.length} точек поездок и маршрутов</div></div><section className="panel"><h2 className="map-list-title">Полезные места</h2>{!visiblePlaces.length ? <EmptyState title="Нет подходящих мест" description="Измените запрос или выберите другую категорию."/> : <ul className="map-places-list">{visiblePlaces.map((place) => { const coordinatesValid = isCoordinate(Number(place.latitude), Number(place.longitude)); return <li key={place.id} className={`map-place-card ${selectedPlace === place.id ? 'is-selected' : ''}`}><button type="button" disabled={!coordinatesValid} aria-pressed={selectedPlace === place.id} onClick={() => setSelectedPlace(place.id)}><strong className="map-place-name">{place.name}</strong><span className="feature-muted">{place.category} · {place.city}</span></button>{place.description && <p>{place.description}</p>}<small className="feature-muted">{coordinatesValid ? `${Number(place.latitude).toFixed(5)}, ${Number(place.longitude).toFixed(5)}` : 'Координаты недоступны'}</small></li> })}</ul>}</section></div>}
  </div>
}
