import { t, useLocale, countLabel } from '../shared/i18n'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import type { CommunityRoute } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'
import { useDebouncedValue, usePageResource } from './usePageResource'
import './routes-messages.css'

type DraftPoint = { key: number; title: string; latitude: string; longitude: string }
const initialPoints = (): DraftPoint[] => [{ key: 0, title: '', latitude: '', longitude: '' }, { key: 1, title: '', latitude: '', longitude: '' }]

export default function RoutesPage() {
  useLocale()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [creating, setCreating] = useState(false)
  const [points, setPoints] = useState(initialPoints)
  const [busy, setBusy] = useState(false)
  const [mutationError, setMutationError] = useState('')
  const search = useDebouncedValue(query.trim())
  const params = new URLSearchParams()
  if (search) params.set('q', search)
  if (favoritesOnly) params.set('favorite', 'true')
  const resource = usePageResource<{ routes: CommunityRoute[] }>(authLoading || (favoritesOnly && !user) ? null : `/api/routes?${params}`, user?.id)

  function updatePoint(key: number, field: keyof Omit<DraftPoint, 'key'>, value: string) {
    setPoints((items) => items.map((point) => point.key === key ? { ...point, [field]: value } : point))
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    const values = new FormData(event.currentTarget)
    const waypoints = points.map((point) => ({ title: point.title.trim(), latitude: Number(point.latitude), longitude: Number(point.longitude) }))
    if (points.some((point) => !point.latitude.trim() || !point.longitude.trim()) || waypoints.some((point) => !point.title || !Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90 || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180)) {
      setMutationError(t("Укажите название и корректные координаты каждой точки.")); return
    }
    setBusy(true); setMutationError('')
    try {
      const result = await api<{ route: CommunityRoute }>('/api/routes', { method: 'POST', body: JSON.stringify({ title: String(values.get('title') ?? '').trim(), description: String(values.get('description') ?? '').trim(), waypoints }) })
      navigate(`/routes/${result.route.id}`)
    } catch (error) { setMutationError(getErrorMessage(error)) }
    finally { setBusy(false) }
  }

  return <div className="route-feature">
    <PageTitle eyebrow={t("Дороги сообщества")} title={t("Маршруты")} description={t("Найдите направление для следующего выезда или поделитесь своим.")} action={user ? <button className="button button-primary" aria-expanded={creating} onClick={() => setCreating(!creating)}>{creating ? t("Закрыть форму") : t("Создать маршрут")}</button> : <Link className="button button-primary" to="/login">{t("Войти для создания")}</Link>} />
    <div className="feature-links"><Link to="/trips">{t("Совместные поездки")}</Link><Link to="/map">{t("Карта и полезные места")}</Link></div>
    {user && creating && <form className="panel route-create" onSubmit={create}>
      <h2>{t("Новый маршрут")}</h2>
      <div className="route-fields"><label>{t("Название")}<input name="title" required minLength={4} maxLength={120} placeholder={t("Например, лесной круг через Заславль")} disabled={busy}/></label><label>{t("Описание")}<textarea name="description" maxLength={2000} placeholder={t("Что стоит знать о дороге и остановках?")} disabled={busy}/></label></div>
      <h3>{t("Точки по порядку")}</h3><p className="feature-muted">{t("Сначала старт, затем остановки и финиш. Координаты можно скопировать из карты.")}</p>
      <ol className="route-point-editor">{points.map((point, index) => <li key={point.key}><fieldset disabled={busy}><legend>{t("Точка")}{' '}{index + 1}{index === 0 ? t(" · старт") : index === points.length - 1 ? t(" · финиш") : ''}</legend><div className="route-coordinate-fields"><label>{t("Название")}<input required maxLength={100} value={point.title} onChange={(event) => updatePoint(point.key, 'title', event.target.value)}/></label><label>{t("Широта")}<input type="number" required min={-90} max={90} step="any" inputMode="decimal" placeholder="53.900" value={point.latitude} onChange={(event) => updatePoint(point.key, 'latitude', event.target.value)}/></label><label>{t("Долгота")}<input type="number" required min={-180} max={180} step="any" inputMode="decimal" placeholder="27.566" value={point.longitude} onChange={(event) => updatePoint(point.key, 'longitude', event.target.value)}/></label></div>{points.length > 2 && <button className="button button-quiet" type="button" onClick={() => setPoints((items) => items.filter((item) => item.key !== point.key))}>{t("Убрать точку")}{' '}{index + 1}</button>}</fieldset></li>)}</ol>
      <button type="button" className="button button-secondary" disabled={busy || points.length >= 30} onClick={() => setPoints((items) => [...items, { key: Math.max(...items.map((point) => point.key)) + 1, title: '', latitude: '', longitude: '' }])}>{t("Добавить точку")}</button>
      {mutationError && <ErrorState message={mutationError}/>}
      <div className="feature-actions"><button className="button button-primary" disabled={busy}>{busy ? t("Сохраняем…") : t("Опубликовать маршрут")}</button></div>
    </form>}
    <div className="route-search panel"><label>{t("Поиск маршрутов")}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Название или описание")} type="search"/></label><label className="route-favorite-filter"><input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)}/>{t("Только избранные")}</label></div>
    {authLoading || resource.loading ? <LoadingState/> : favoritesOnly && !user ? <EmptyState title={t("Ваши сохранённые маршруты")} description={t("Войдите, чтобы увидеть избранное.")} action={<Link className="button button-primary" to="/login">{t("Войти")}</Link>}/> : resource.error ? <ErrorState message={resource.error} onRetry={resource.reload}/> : !resource.data?.routes.length ? <EmptyState title={search ? t("Маршруты не найдены") : favoritesOnly ? t("В избранном пока пусто") : t("Пока нет маршрутов")} description={search ? t("Попробуйте другое название.") : t("Сохраните понравившийся маршрут или создайте свой.")}/> : <div className="route-grid">{resource.data.routes.map((route) => <article className="panel route-card" key={route.id}><div className="route-card-top"><span className="eyebrow">{countLabel(route.waypoints.length, 'waypoint')}</span>{route.isFavorite && <span className="route-saved">{t("В избранном")}</span>}</div><h2><Link to={`/routes/${route.id}`}>{route.title}</Link></h2><p className="route-description">{route.description || t("Автор пока не добавил описание.")}</p><ol className="route-preview-points">{route.waypoints.slice(0, 3).map((point) => <li key={point.id}>{point.title}</li>)}</ol>{route.waypoints.length > 3 && <p className="feature-muted">{t("И ещё")}{' '}{countLabel(route.waypoints.length - 3, 'waypoint')}</p>}<div className="feature-actions"><span className="feature-muted">{route.author.displayName}</span><Link className="button button-secondary" to={`/routes/${route.id}`}>{t("Открыть маршрут")}</Link></div></article>)}</div>}
  </div>
}
