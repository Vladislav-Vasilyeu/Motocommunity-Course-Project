import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { formObject, type Trip } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'

export default function TripsPage() {
  const { user } = useAuth(); const navigate = useNavigate()
  const [trips, setTrips] = useState<Trip[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { setTrips((await api<{ trips: Trip[] }>('/api/trips')).trips) } catch (err) { setError(getErrorMessage(err)) } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) { navigate('/login'); return }; setBusy(true); setError('')
    const form = event.currentTarget; const values = formObject(form)
    try {
      const result = await api<{ trip: Trip }>('/api/trips', { method: 'POST', body: JSON.stringify({ title: values.title, description: values.description, startsAt: new Date(String(values.startsAt)).toISOString(), waypoints: [{ label: values.start, latitude: Number(values.startLat), longitude: Number(values.startLng) }, { label: values.end, latitude: Number(values.endLat), longitude: Number(values.endLng) }] }) })
      setTrips((items) => [...items, { ...result.trip, isJoined: true }].sort((a, b) => a.startsAt.localeCompare(b.startsAt))); form.reset()
    } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) }
  }
  async function toggleParticipation(trip: Trip) { if (!user) { navigate('/login'); return }; setBusy(true); try { const joining = !trip.isJoined; await api(`/api/trips/${trip.id}${joining ? '/join' : '/membership'}`, { method: joining ? 'POST' : 'DELETE' }); setTrips((items) => items.map((item) => item.id === trip.id ? { ...item, isJoined: joining, _count: { participants: Math.max(0, (item._count?.participants ?? 0) + (joining ? 1 : -1)) } } : item)) } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) } }

  return <>
    <PageTitle eyebrow="Планы на дорогу" title="Совместные поездки" description="Создавайте поездки с точками старта и финиша и присоединяйтесь к другим райдерам."/>
    {user && <details className="panel create-panel"><summary>Создать поездку</summary><form className="form-grid" onSubmit={create}><label className="field-wide">Название<input name="title" minLength={4} maxLength={120} required placeholder="Например, выходные у Нарочи"/></label><label>Дата и время<input name="startsAt" type="datetime-local" required/></label><label>Точка старта<input name="start" required placeholder="Минск"/></label><label>Широта старта<input name="startLat" type="number" step="any" min="-90" max="90" required placeholder="53.9"/></label><label>Долгота старта<input name="startLng" type="number" step="any" min="-180" max="180" required placeholder="27.56"/></label><label>Финиш<input name="end" required placeholder="Нарочь"/></label><label>Широта финиша<input name="endLat" type="number" step="any" min="-90" max="90" required placeholder="54.9"/></label><label>Долгота финиша<input name="endLng" type="number" step="any" min="-180" max="180" required placeholder="26.7"/></label><label className="field-wide">Описание<textarea name="description" maxLength={2000} rows={3}/></label><button className="button button-primary" disabled={busy}>{busy ? 'Создаю…' : 'Опубликовать поездку'}</button></form></details>}
    {error && <ErrorState message={error} onRetry={load}/>}
    {loading ? <LoadingState/> : trips.length === 0 ? <EmptyState title="Пока нет запланированных поездок" description="Создайте первую поездку или вернитесь позже."/> : <div className="card-grid">{trips.map((trip) => <article className="panel trip-card" key={trip.id}><p className="eyebrow">{new Date(trip.startsAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}</p><h2>{trip.title}</h2><p>{trip.description}</p><ol className="waypoint-list">{trip.waypoints.map((point) => <li key={point.id}><span>{point.label || `${point.latitude}, ${point.longitude}`}</span><small>{Number(point.latitude).toFixed(3)}, {Number(point.longitude).toFixed(3)}</small></li>)}</ol><div className="card-foot"><span>Организатор: {trip.organizer.displayName} · {trip._count?.participants ?? 0} участников</span>{trip.organizer.id === user?.id ? <span className="status-pill">Вы организатор</span> : <button className={trip.isJoined ? 'button button-secondary' : 'button button-primary'} onClick={() => void toggleParticipation(trip)} disabled={busy}>{trip.isJoined ? 'Покинуть поездку' : 'Присоединиться'}</button>}</div></article>)}</div>}
    <p className="page-note">Метки поездок можно посмотреть на <Link to="/map">карте</Link>.</p>
  </>
}
