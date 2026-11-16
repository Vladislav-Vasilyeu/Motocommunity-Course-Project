import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'
import { usePageResource } from './usePageResource'

type Notice = {
  id: string
  type: 'FRIEND_REQUEST' | 'FRIEND_REQUEST_ACCEPTED' | 'NEW_MESSAGE'
  actor: { id: string; displayName: string } | null
  link: string
  createdAt: string
  readAt: string | null
}

const text: Record<Notice['type'], string> = {
  FRIEND_REQUEST: 'Новая заявка в друзья',
  FRIEND_REQUEST_ACCEPTED: 'Заявка в друзья принята',
  NEW_MESSAGE: 'Новое сообщение',
}

export default function NotificationsPage() {
  const { user, loading } = useAuth()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [read, setRead] = useState<{ owner: string; ids: string[] }>({ owner: '', ids: [] })
  const resource = usePageResource<{ notifications: Notice[]; unreadCount: number }>(user ? '/api/notifications' : null, user?.id)
  const notices = resource.data?.notifications ?? []
  const isRead = (notice: Notice) => Boolean(notice.readAt || (read.owner === user?.id && read.ids.includes(notice.id)))
  const visible = unreadOnly ? notices.filter(notice => !isRead(notice)) : notices

  async function mark(id?: string) {
    if (!user || busy) return
    setBusy(true)
    setError('')
    try {
      await api(id ? `/api/notifications/${encodeURIComponent(id)}/read` : '/api/notifications/read-all', { method: 'PATCH' })
      const ids = id ? [id] : notices.map(notice => notice.id)
      setRead(previous => ({ owner: user.id, ids: [...(previous.owner === user.id ? previous.ids : []), ...ids] }))
    } catch (cause) {
      setError(getErrorMessage(cause))
    } finally { setBusy(false) }
  }

  if (loading) return <LoadingState/>
  if (!user) return <EmptyState title="Уведомления" description="Войдите, чтобы увидеть события вашего аккаунта." action={<Link className="button button-primary" to="/login">Войти</Link>}/>
  return <div className="personal-feature">
    <PageTitle title="Уведомления" eyebrow="Мой аккаунт" description="Сообщения и события вашего сообщества."
      action={<button className="button button-secondary" type="button" onClick={() => void mark()} disabled={busy || !notices.some(notice => !isRead(notice))}>Прочитать все</button>}/>
    <div className="personal-filters" aria-label="Показывать уведомления">
      <button className="category-chip" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>Все</button>
      <button className="category-chip" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Непрочитанные</button>
    </div>
    {error && <ErrorState message={error}/>}
    {resource.loading ? <LoadingState/> : resource.error ? <ErrorState message={resource.error} onRetry={resource.reload}/> : visible.length === 0 ? <EmptyState title={unreadOnly ? 'Всё прочитано' : 'Пока нет уведомлений'} description={unreadOnly ? 'Все события доступны во вкладке «Все».' : 'Здесь появятся сообщения и заявки в друзья.'}/> :
      <ul className="panel personal-notices">{visible.map(notice => <li key={notice.id}>
        <span aria-hidden="true" className="avatar">{notice.actor?.displayName.slice(0, 1).toUpperCase() ?? 'M'}</span>
        <div className="personal-notice-copy"><strong>{text[notice.type]}</strong><p>{notice.actor?.displayName ?? 'Участник Moto Club'} · <time dateTime={notice.createdAt}>{new Date(notice.createdAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}</time></p>{!isRead(notice) && <span className="status-pill">Новое</span>}</div>
        <div className="personal-notice-actions">
          <Link className="button button-secondary" to={notice.link}>{notice.type === 'NEW_MESSAGE' ? 'Диалог' : 'Друзья'}</Link>
          {!isRead(notice) && <button disabled={busy} className="button button-quiet" onClick={() => void mark(notice.id)}>Отметить прочитанным</button>}
        </div>
      </li>)}</ul>}
  </div>
}
