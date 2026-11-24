import { t, useLocale, countLabel, getIntlLocale } from '../shared/i18n'
import { useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import type { CommunityRoute } from '../shared/types'
import { ErrorState, LoadingState, PageTitle } from '../shared/ui'
import { usePageResource } from './usePageResource'
import './routes-messages.css'

export default function RoutePage() {
  useLocale()
  const { id } = useParams()
  const { user, loading: authLoading } = useAuth()
  const scope = `${user?.id ?? ''}:${id ?? ''}`
  const activeScope = useRef(scope)
  useLayoutEffect(() => { activeScope.current = scope }, [scope])
  const route = usePageResource<{ route: CommunityRoute }>(id && !authLoading ? `/api/routes/${encodeURIComponent(id)}` : null, user?.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState({ scope: '', message: '' })
  const [feedback, setFeedback] = useState({ scope: '', message: '' })
  async function toggleFavorite() {
    if (!route.data || !user) return
    const current = route.data.route
    setBusy(true); setError({ scope, message: '' }); setFeedback({ scope, message: '' })
    try {
      await api(`/api/routes/${encodeURIComponent(current.id)}/favorite`, { method: current.isFavorite ? 'DELETE' : 'PUT' })
      if (activeScope.current === scope) {
        setFeedback({ scope, message: current.isFavorite ? 'Маршрут удалён из избранного.' : 'Маршрут сохранён в избранном.' })
        route.reload()
      }
    } catch (err) { if (activeScope.current === scope) setError({ scope, message: getErrorMessage(err) }) }
    finally { setBusy(false) }
  }
  if (authLoading || route.loading) return <LoadingState/>
  if (route.error) return <ErrorState message={route.error} onRetry={route.reload}/>
  if (!route.data) return <ErrorState message={t("Маршрут не найден.")}/>
  const item = route.data.route
  return <div className="route-feature"><Link className="feature-back" to="/routes">{t("← Все маршруты")}</Link><PageTitle eyebrow={t("Маршрут · {p0}", { p0: item.author.displayName })} title={item.title} description={t("{p0} · опубликован {p1}", { p0: countLabel(item.waypoints.length, 'waypoint'), p1: new Intl.DateTimeFormat(getIntlLocale(), { dateStyle: 'medium' }).format(new Date(item.createdAt)) })} action={<Link className="button button-primary" to={`/map?route=${encodeURIComponent(item.id)}`}>{t("Открыть на карте")}</Link>}/><section className="panel route-detail"><p className="route-detail-description">{item.description || t("Описание не добавлено.")}</p><h2>{t("Точки маршрута")}</h2><ol className="route-timeline">{item.waypoints.map((point, index) => <li key={point.id}><span className="route-point-number">{index + 1}</span><div><h3>{point.title}</h3><p className="feature-muted">{Number(point.latitude).toFixed(5)}, {Number(point.longitude).toFixed(5)}</p></div></li>)}</ol><div className="feature-actions">{user ? <button className="button button-secondary" aria-pressed={item.isFavorite} disabled={busy} onClick={() => void toggleFavorite()}>{busy ? t("Сохраняем…") : item.isFavorite ? t("Убрать из избранного") : t("Сохранить в избранное")}</button> : <Link className="button button-secondary" to="/login">{t("Войти и сохранить")}</Link>}<Link className="button button-quiet" to="/trips">{t("Найти совместную поездку")}</Link></div>{feedback.scope === scope && feedback.message && <p role="status">{t(feedback.message)}</p>}{error.scope === scope && error.message && <ErrorState message={error.message}/>}</section></div>
}
