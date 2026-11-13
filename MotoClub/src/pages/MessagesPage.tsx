import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import type { Dialog, User } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'
import { useDebouncedValue, usePageResource } from './usePageResource'
import './routes-messages.css'

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth()
  const [query, setQuery] = useState('')
  const search = useDebouncedValue(query.trim())
  const dialogs = usePageResource<{ dialogs: Dialog[] }>(user ? '/api/dialogs' : null, user?.id)
  const people = usePageResource<{ users: User[] }>(user && search.length >= 2 ? `/api/users?search=${encodeURIComponent(search)}` : null, user?.id)
  if (authLoading) return <LoadingState/>
  if (!user) return <EmptyState title="Личные сообщения" description="Войдите, чтобы открыть свои диалоги." action={<Link className="button button-primary" to="/login">Войти</Link>}/>
  return <div className="messages-feature"><PageTitle eyebrow="Ваше сообщество" title="Сообщения" description="Обсудите маршрут, договоритесь о встрече или задайте вопрос продавцу." action={<button className="button button-secondary" onClick={dialogs.reload} disabled={dialogs.loading}>Обновить</button>}/>
    <section className="panel dialog-search"><label>Начать разговор<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найдите участника по имени" aria-describedby="recipient-search-hint"/></label><p id="recipient-search-hint" className="feature-muted">Введите минимум два символа.</p>
      {people.loading ? <LoadingState label="Ищем участников…"/> : people.error ? <ErrorState message={people.error} onRetry={people.reload}/> : people.data && <div className="dialog-list">{people.data.users.filter((person) => person.id !== user.id).map((person) => <Link className="dialog-row" key={person.id} to={`/messages/${person.id}`}><span className="avatar">{person.displayName.slice(0, 1).toUpperCase()}</span><span className="dialog-person"><strong>{person.displayName}</strong><small>{person.profile?.city || 'Участник Moto Club'}</small></span><span>Написать →</span></Link>)}{people.data.users.filter((person) => person.id !== user.id).length === 0 && <p className="feature-muted">Участники не найдены. Попробуйте другое имя.</p>}</div>}
    </section>
    <h2 className="feature-section-title">Ваши диалоги</h2>
    {dialogs.loading ? <LoadingState/> : dialogs.error ? <ErrorState message={dialogs.error} onRetry={dialogs.reload}/> : !dialogs.data?.dialogs.length ? <EmptyState title="Пока нет сообщений" description="Найдите участника по имени и начните разговор."/> : <section className="panel dialog-list">{dialogs.data.dialogs.map((dialog) => <Link key={dialog.user.id} to={`/messages/${dialog.user.id}`} className="dialog-row"><span className="avatar">{dialog.user.displayName.slice(0, 1).toUpperCase()}</span><span className="dialog-person"><strong>{dialog.user.displayName}</strong><span className="dialog-preview">{dialog.lastMessage.senderId === user.id ? 'Вы: ' : ''}{dialog.lastMessage.content}</span></span><time dateTime={dialog.lastMessage.createdAt}>{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(dialog.lastMessage.createdAt))}</time></Link>)}</section>}
  </div>
}
