import { useCallback, useEffect, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerRetinaIcon from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { api, getErrorMessage } from '../shared/api'
import type { Place, Trip } from '../shared/types'
import { ErrorState, LoadingState, PageTitle } from '../shared/ui'

L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerRetinaIcon, shadowUrl: markerShadow })

export default function MapPage() {
  const [places, setPlaces] = useState<Place[]>([]); const [trips, setTrips] = useState<Trip[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { const [placeData, tripData] = await Promise.all([api<{ places: Place[] }>('/api/places'), api<{ trips: Trip[] }>('/api/trips')]); setPlaces(placeData.places); setTrips(tripData.trips) } catch (err) { setError(getErrorMessage(err)) } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  const points = [
    ...places.map((item) => ({ id: item.id, title: item.name, detail: `${item.category} · ${item.city}`, lat: Number(item.latitude), lng: Number(item.longitude) })),
    ...trips.flatMap((trip) => trip.waypoints.map((point) => ({ id: `${trip.id}-${point.id}`, title: point.label || trip.title, detail: trip.title, lat: Number(point.latitude), lng: Number(point.longitude) }))),
  ]
  const center: LatLngExpression = [53.9, 27.56]
  return <><PageTitle eyebrow="Карта маршрутов" title="Карта" description="Места и путевые точки опубликованных поездок."/>{error && <ErrorState message={error} onRetry={load}/ >}{loading ? <LoadingState/> : <div className="map-panel panel"><MapContainer center={center} zoom={7} scrollWheelZoom={false} className="leaflet-map"><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{points.map((point) => <Marker key={point.id} position={[point.lat, point.lng]}><Popup><strong>{point.title}</strong><br/>{point.detail}</Popup></Marker>)}</MapContainer><div className="map-caption">{points.length} точек · карта © OpenStreetMap</div></div>}</>
}
