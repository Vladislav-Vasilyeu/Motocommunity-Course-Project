import './reference-account.css'
import { t, useLocale, getIntlLocale } from '../shared/i18n'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import type { Dialog, User } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'
import { useDebouncedValue, usePageResource } from './usePageResource'
import './routes-messages.css'

export default function MessagesPage() {
  useLocale()
  const { user, loading: authLoading } = useAuth()
  const [query, setQuery] = useState('')
  const search = useDebouncedValue(query.trim())
  const dialogs = usePageResource<{ dialogs: Dialog[] }>(user ? '/api/dialogs' : null, user?.id)
  const people = usePageResource<{ users: User[] }>(user && search.length >= 2 ? `/api/users?search=${encodeURIComponent(search)}` : null, user?.id)
  if (authLoading) return <LoadingState/>
  if (!user) return <EmptyState title={t("Личные сообщения")} description={t("Войдите, чтобы открыть свои диалоги.")} action={<Link className="button button-primary" to="/login">{t("Войти")}</Link>}/>
  return <div className="messages-feature mc-account-page mc-messages-page"><PageTitle eyebrow={t("Ваше сообщество")} title={t("Сообщения")} description={t("Обсудите маршрут, договоритесь о встрече или задайте вопрос продавцу.")} action={<button className="button button-secondary" onClick={dialogs.reload} disabled={dialogs.loading}>{t("Обновить")}</button>}/>
    <div className="mc-messenger"><aside className="panel mc-dialog-sidebar"><section className="dialog-search"><label>{t("Начать разговор")}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Найдите участника по имени")} aria-describedby="recipient-search-hint"/></label><p id="recipient-search-hint" className="feature-muted">{t("Введите минимум два символа.")}</p>
      {people.loading ? <LoadingState label={t("Ищем участников…")}/> : people.error ? <ErrorState message={people.error} onRetry={people.reload}/> : people.data && <div className="dialog-list">{people.data.users.filter((person) => person.id !== user.id).map((person) => <Link className="dialog-row" key={person.id} to={`/messages/${person.id}`}><span className="avatar">{person.displayName.slice(0, 1).toUpperCase()}</span><span className="dialog-person"><strong>{person.displayName}</strong><small>{person.profile?.city || t("Участник Moto Club")}</small></span><span>{t("Написать →")}</span></Link>)}{people.data.users.filter((person) => person.id !== user.id).length === 0 && <p className="feature-muted">{t("Участники не найдены. Попробуйте другое имя.")}</p>}</div>}
    </section>
    <h2 className="feature-section-title">{t("Ваши диалоги")}</h2>
    {dialogs.loading ? <LoadingState/> : dialogs.error ? <ErrorState message={dialogs.error} onRetry={dialogs.reload}/> : !dialogs.data?.dialogs.length ? <EmptyState title={t("Пока нет сообщений")} description={t("Найдите участника по имени и начните разговор.")}/> : <section className="dialog-list">{dialogs.data.dialogs.map((dialog) => <Link key={dialog.user.id} to={`/messages/${dialog.user.id}`} className="dialog-row"><span className="avatar">{dialog.user.displayName.slice(0, 1).toUpperCase()}</span><span className="dialog-person"><strong>{dialog.user.displayName}</strong><span className="dialog-preview">{dialog.lastMessage.senderId === user.id ? t("Вы: ") : ''}{dialog.lastMessage.content}</span></span><time dateTime={dialog.lastMessage.createdAt}>{new Intl.DateTimeFormat(getIntlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(dialog.lastMessage.createdAt))}</time></Link>)}</section>}
    </aside><section className="panel mc-chat-placeholder"><h2>{t("Начать разговор")}</h2><p>{t("Найдите участника по имени и начните разговор.")}</p></section></div>
  </div>
}
