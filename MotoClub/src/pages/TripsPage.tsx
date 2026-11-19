import { t, useLocale, countLabel, getIntlLocale } from '../shared/i18n'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { formObject, type Trip } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'

type Participant = { user: { id: string; displayName: string } }

function Participants({ trip, canManage, onCountChange }: { trip: Trip; canManage: boolean; onCountChange: () => void }) {
  useLocale()
  const [participants, setParticipants] = useState<Participant[] | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function load() {
    setError(''); setPending(true)
    try { setParticipants((await api<{ participants: Participant[] }>(`/api/trips/${trip.id}/participants`)).participants) }
    catch (err) { setError(getErrorMessage(err)) }
    finally { setPending(false) }
  }
  async function remove(person: Participant) {
    if (!window.confirm(t("Исключить участника «{p0}» из поездки?", { p0: person.user.displayName }))) return
    setPending(true); setError('')
    try {
      await api(`/api/trips/${trip.id}/participants/${person.user.id}`, { method: 'DELETE' })
      setParticipants(items => items?.filter(item => item.user.id !== person.user.id) ?? [])
      onCountChange()
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setPending(false) }
  }
  return <details className="trip-participants" onToggle={event => { if (event.currentTarget.open) void load() }}>
    <summary>{t("Участники")}</summary>
    {error && <ErrorState message={error} onRetry={load}/>}
    {pending && <p role="status">{t("Обновляем список…")}</p>}
    {participants?.length === 0 && <p>{t("К поездке пока никто не присоединился.")}</p>}
    {participants && participants.length > 0 && <ul>{participants.map(person => <li key={person.user.id}>
      <span>{person.user.displayName}</span>
      {canManage && <button type="button" className="button button-danger-quiet" disabled={pending} onClick={() => void remove(person)}>{t("Исключить")}</button>}
    </li>)}</ul>}
  </details>
}

export default function TripsPage() {
  useLocale()
  const { user } = useAuth(); const navigate = useNavigate()
  const [stops, setStops] = useState<number[]>([])
  const [nextStop, setNextStop] = useState(1)
  const [trips, setTrips] = useState<Trip[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { setTrips((await api<{ trips: Trip[] }>('/api/trips')).trips) } catch (err) { setError(getErrorMessage(err)) } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) { navigate('/login'); return }; setBusy(true); setError('')
    const form = event.currentTarget; const values = formObject(form)
    try {
      const result = await api<{ trip: Trip }>('/api/trips', { method: 'POST', body: JSON.stringify({ title: values.title, description: values.description, startsAt: new Date(String(values.startsAt)).toISOString(), waypoints: [{ label: values.start, latitude: Number(values.startLat), longitude: Number(values.startLng) }, ...stops.map(id => ({
          label: values[`stop-${id}`], latitude: Number(values[`stopLat-${id}`]), longitude: Number(values[`stopLng-${id}`]),
        })), { label: values.end, latitude: Number(values.endLat), longitude: Number(values.endLng) }] }) })
      setTrips((items) => [...items, { ...result.trip, isJoined: false }].sort((a, b) => a.startsAt.localeCompare(b.startsAt))); form.reset(); setStops([])
    } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) }
  }
  async function toggleParticipation(trip: Trip) { if (!user) { navigate('/login'); return }; setBusy(true); try { const joining = !trip.isJoined; await api(`/api/trips/${trip.id}${joining ? '/join' : '/membership'}`, { method: joining ? 'POST' : 'DELETE' }); setTrips((items) => items.map((item) => item.id === trip.id ? { ...item, isJoined: joining, _count: { participants: Math.max(0, (item._count?.participants ?? 0) + (joining ? 1 : -1)) } } : item)) } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) } }

  return <>
    <PageTitle eyebrow={t("Планы на дорогу")} title={t("Совместные поездки")} description={t("Создавайте поездки с точками старта и финиша и присоединяйтесь к другим райдерам.")}/>
    {user && <details className="panel create-panel"><summary>{t("Создать поездку")}</summary><form className="form-grid" onSubmit={create}><label className="field-wide">{t("Название")}<input name="title" minLength={4} maxLength={120} required placeholder={t("Например, выходные у Нарочи")}/></label><label>{t("Дата и время")}<input name="startsAt" type="datetime-local" required/></label><label>{t("Точка старта")}<input name="start" required placeholder={t("Минск")}/></label><label>{t("Широта старта")}<input name="startLat" type="number" step="any" min="-90" max="90" required placeholder="53.9"/></label><label>{t("Долгота старта")}<input name="startLng" type="number" step="any" min="-180" max="180" required placeholder="27.56"/></label>{stops.map((id, index) => <fieldset key={id} className="field-wide trip-stop">
      <legend>{t("Остановка")}{' '}{index + 1}</legend>
      <label>{t("Название")}<input name={`stop-${id}`} required maxLength={100}/></label>
      <label>{t("Широта")}<input name={`stopLat-${id}`} type="number" step="any" min="-90" max="90" required/></label>
      <label>{t("Долгота")}<input name={`stopLng-${id}`} type="number" step="any" min="-180" max="180" required/></label>
      <button type="button" className="button button-quiet" onClick={() => setStops(items => items.filter(item => item !== id))}>{t("Убрать остановку")}</button>
    </fieldset>)}
    <button type="button" className="button button-secondary field-wide" disabled={stops.length >= 18} onClick={() => { setStops(items => [...items, nextStop]); setNextStop(nextStop + 1) }}>{t("Добавить остановку")}</button>
    <label>{t("Финиш")}<input name="end" required placeholder={t("Нарочь")}/></label><label>{t("Широта финиша")}<input name="endLat" type="number" step="any" min="-90" max="90" required placeholder="54.9"/></label><label>{t("Долгота финиша")}<input name="endLng" type="number" step="any" min="-180" max="180" required placeholder="26.7"/></label><label className="field-wide">{t("Описание")}<textarea name="description" maxLength={2000} rows={3}/></label><button className="button button-primary" disabled={busy}>{busy ? t("Создаю…") : t("Опубликовать поездку")}</button></form></details>}
    {error && <ErrorState message={error} onRetry={load}/>}
    {loading ? <LoadingState/> : trips.length === 0 ? <EmptyState title={t("Пока нет запланированных поездок")} description={t("Создайте первую поездку или вернитесь позже.")}/> : <div className="card-grid">{trips.map((trip) => <article className="panel trip-card" key={trip.id}><p className="eyebrow">{new Date(trip.startsAt).toLocaleString(getIntlLocale(), { dateStyle: 'medium', timeStyle: 'short' })}</p><h2>{trip.title}</h2><p>{trip.description}</p><ol className="waypoint-list">{trip.waypoints.map((point) => <li key={point.id}><span>{point.label || `${point.latitude}, ${point.longitude}`}</span><small>{Number(point.latitude).toFixed(3)}, {Number(point.longitude).toFixed(3)}</small></li>)}</ol><div className="card-foot"><span>{t("Организатор:")}{' '}{trip.organizer.displayName} · {countLabel(trip._count?.participants ?? 0, 'member')}</span>{trip.organizer.id === user?.id ? <span className="status-pill">{t("Вы организатор")}</span> : <button className={trip.isJoined ? 'button button-secondary' : 'button button-primary'} onClick={() => void toggleParticipation(trip)} disabled={busy}>{trip.isJoined ? t("Покинуть поездку") : t("Присоединиться")}</button>}</div>
    <div className="card-actions"><Link className="button button-secondary" to={`/map?trip=${encodeURIComponent(trip.id)}`}>{t("Маршрут на карте")}</Link>{user && user.id !== trip.organizer.id && <Link className="button button-quiet" to={`/messages/${trip.organizer.id}`}>{t("Написать организатору")}</Link>}</div>
    <Participants key={`${trip.id}-${trip.isJoined}`} trip={trip} canManage={trip.organizer.id === user?.id} onCountChange={() => setTrips(items => items.map(item => item.id === trip.id ? { ...item, _count: { participants: Math.max(0, (item._count?.participants ?? 0) - 1) } } : item))}/>
    </article>)}</div>}
    <p className="page-note">{t("Метки поездок можно посмотреть на")}{' '}<Link to="/map">{t("карте")}</Link>.</p>
  </>
}
