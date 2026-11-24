import './reference-account.css'
import { t, useLocale, getIntlLocale } from '../shared/i18n'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import type { DirectMessage, MessageHistory } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'
import './routes-messages.css'
import { usePageResource } from './usePageResource'
import type { Dialog } from '../shared/types'

type HistoryState = { key: string; revision: number; userName: string; messages: DirectMessage[]; nextCursor: string | null; loading: boolean; error: string }
const emptyHistory = (key: string, revision = -1): HistoryState => ({ key, revision, userName: '', messages: [], nextCursor: null, loading: true, error: '' })
function uniqueMessages(items: DirectMessage[]) { return [...new Map(items.map((item) => [item.id, item])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) }

export default function DialogPage() {
  useLocale()
  const { userId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const dialogs = usePageResource<{ dialogs: Dialog[] }>(user ? '/api/dialogs' : null, user?.id)
  const key = `${user?.id ?? ''}:${userId ?? ''}`
  const activeKey = useRef(key)
  useLayoutEffect(() => { activeKey.current = key }, [key])
  const [history, setHistory] = useState<HistoryState>(() => emptyHistory(''))
  const [revision, setRevision] = useState(0)
  const [draft, setDraft] = useState({ key: '', content: '' })
  const [sendingKey, setSendingKey] = useState('')
  const [olderKey, setOlderKey] = useState('')
  const [operationError, setOperationError] = useState({ key: '', message: '' })
  const endpoint = userId ? `/api/dialogs/${encodeURIComponent(userId)}/messages` : ''
  const valid = Boolean(user && userId && userId !== user.id)

  useEffect(() => {
    if (!valid) return
    const controller = new AbortController()
    api<MessageHistory>(endpoint, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setHistory({ key, revision, userName: data.user.displayName, messages: data.messages, nextCursor: data.nextCursor, loading: false, error: '' }) })
      .catch((error: unknown) => { if (!controller.signal.aborted) setHistory({ ...emptyHistory(key, revision), loading: false, error: getErrorMessage(error) }) })
    return () => controller.abort()
  }, [endpoint, key, revision, valid])

  const current = history.key === key && history.revision === revision ? history : emptyHistory(key, revision)
  const content = draft.key === key ? draft.content : ''
  const sending = sendingKey === key
  const loadingOlder = olderKey === key

  async function loadOlder() {
    if (!current.nextCursor || loadingOlder) return
    const requestKey = key
    setOlderKey(requestKey); setOperationError({ key, message: '' })
    try {
      const data = await api<MessageHistory>(`${endpoint}?cursor=${encodeURIComponent(current.nextCursor)}`)
      if (activeKey.current === requestKey) setHistory((previous) => previous.key === requestKey ? { ...previous, messages: uniqueMessages([...data.messages, ...previous.messages]), nextCursor: data.nextCursor } : previous)
    } catch (error) { if (activeKey.current === requestKey) setOperationError({ key: requestKey, message: getErrorMessage(error) }) }
    finally { setOlderKey((previous) => previous === requestKey ? '' : previous) }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = content.trim()
    if (!message || sending || !valid) return
    const requestKey = key
    setSendingKey(key); setOperationError({ key, message: '' })
    try {
      const result = await api<{ message: DirectMessage }>(endpoint, { method: 'POST', body: JSON.stringify({ content: message }) })
      if (activeKey.current === requestKey) {
        setHistory((previous) => previous.key === requestKey ? { ...previous, messages: uniqueMessages([...previous.messages, result.message]) } : previous)
        setDraft({ key, content: '' })
      }
    } catch (error) { if (activeKey.current === requestKey) setOperationError({ key: requestKey, message: getErrorMessage(error) }) }
    finally { setSendingKey((previous) => previous === requestKey ? '' : previous) }
  }

  if (authLoading) return <LoadingState/>
  if (!user) return <EmptyState title={t("Личный диалог")} description={t("Войдите, чтобы прочитать сообщения.")} action={<Link to="/login" className="button button-primary">{t("Войти")}</Link>}/>
  if (!valid) return <EmptyState title={t("Выберите собеседника")} description={t("Откройте диалог с другим участником сообщества.")} action={<Link to="/messages" className="button button-primary">{t("К сообщениям")}</Link>}/>
  return <div className="messages-feature mc-account-page mc-dialog-page"><Link className="feature-back" to="/messages">{t("← Все сообщения")}</Link><PageTitle eyebrow={t("Личный диалог")} title={current.userName || t("Сообщения")} description={t("Договорённости и разговоры с участником сообщества.")} action={<button className="button button-secondary" disabled={current.loading || sending || loadingOlder} onClick={() => { setOperationError({ key, message: '' }); setRevision((value) => value + 1) }}>{t("Обновить")}</button>}/>
    <div className="mc-messenger mc-messenger-active"><aside className="panel mc-dialog-sidebar"><Link className="feature-back" to="/messages">{t("← Все сообщения")}</Link>{dialogs.loading ? <LoadingState/> : dialogs.error ? <ErrorState message={dialogs.error} onRetry={dialogs.reload}/> : dialogs.data?.dialogs.map(dialog => <Link key={dialog.user.id} className={`dialog-row ${dialog.user.id === userId ? 'mc-dialog-selected' : ''}`} aria-current={dialog.user.id === userId ? 'page' : undefined} to={`/messages/${dialog.user.id}`}><span className="avatar">{dialog.user.displayName.slice(0, 1).toUpperCase()}</span><span className="dialog-person"><strong>{dialog.user.displayName}</strong><span className="dialog-preview">{dialog.lastMessage.content}</span></span></Link>)}</aside>
    {current.loading ? <LoadingState/> : current.error ? <ErrorState message={current.error} onRetry={() => setRevision((value) => value + 1)}/> : <section className="panel conversation-panel">
      {current.nextCursor && <button className="button button-secondary older-messages" disabled={loadingOlder} onClick={() => void loadOlder()}>{loadingOlder ? t("Загружаем…") : t("Загрузить более ранние сообщения")}</button>}
      {!current.messages.length && <EmptyState title={t("Начните разговор")} description={t("Первое сообщение появится здесь после отправки.")}/>}
      <ol className="conversation-log" aria-label={t("История сообщений")} aria-live="polite" aria-relevant="additions">{current.messages.map((message) => <li key={message.id} className={`message-bubble ${message.senderId === user.id ? 'message-own' : ''}`}><span className="sr-only">{message.senderId === user.id ? t("Вы") : current.userName}: </span><p>{message.content}</p><time dateTime={message.createdAt}>{new Intl.DateTimeFormat(getIntlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt))}</time></li>)}</ol>
      {operationError.key === key && operationError.message && <ErrorState message={operationError.message}/>}
      <form className="message-form" onSubmit={send}><label htmlFor="message-content">{t("Сообщение")}</label><textarea id="message-content" maxLength={2000} required value={content} disabled={sending} onChange={(event) => setDraft({ key, content: event.target.value })} placeholder={t("Напишите участнику…")} rows={3}/><div className="feature-actions"><span className="feature-muted">{content.length} / 2 000</span><button className="button button-primary" disabled={sending || !content.trim()}>{sending ? t("Отправляем…") : t("Отправить")}</button></div></form>
    </section>}
    </div>
  </div>
}
