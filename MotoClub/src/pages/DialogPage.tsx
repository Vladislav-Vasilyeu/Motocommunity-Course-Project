import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import type { DirectMessage, MessageHistory } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'
import './routes-messages.css'

type HistoryState = { key: string; revision: number; userName: string; messages: DirectMessage[]; nextCursor: string | null; loading: boolean; error: string }
const emptyHistory = (key: string, revision = -1): HistoryState => ({ key, revision, userName: '', messages: [], nextCursor: null, loading: true, error: '' })
function uniqueMessages(items: DirectMessage[]) { return [...new Map(items.map((item) => [item.id, item])).values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) }

export default function DialogPage() {
  const { userId } = useParams()
  const { user, loading: authLoading } = useAuth()
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
  if (!user) return <EmptyState title="Личный диалог" description="Войдите, чтобы прочитать сообщения." action={<Link to="/login" className="button button-primary">Войти</Link>}/>
  if (!valid) return <EmptyState title="Выберите собеседника" description="Откройте диалог с другим участником сообщества." action={<Link to="/messages" className="button button-primary">К сообщениям</Link>}/>
  return <div className="messages-feature"><Link className="feature-back" to="/messages">← Все сообщения</Link><PageTitle eyebrow="Личный диалог" title={current.userName || 'Сообщения'} description="Договорённости и разговоры с участником сообщества." action={<button className="button button-secondary" disabled={current.loading || sending || loadingOlder} onClick={() => { setOperationError({ key, message: '' }); setRevision((value) => value + 1) }}>Обновить</button>}/>
    {current.loading ? <LoadingState/> : current.error ? <ErrorState message={current.error} onRetry={() => setRevision((value) => value + 1)}/> : <section className="panel conversation-panel">
      {current.nextCursor && <button className="button button-secondary older-messages" disabled={loadingOlder} onClick={() => void loadOlder()}>{loadingOlder ? 'Загружаем…' : 'Загрузить более ранние сообщения'}</button>}
      {!current.messages.length && <EmptyState title="Начните разговор" description="Первое сообщение появится здесь после отправки."/>}
      <ol className="conversation-log" aria-label="История сообщений" aria-live="polite" aria-relevant="additions">{current.messages.map((message) => <li key={message.id} className={`message-bubble ${message.senderId === user.id ? 'message-own' : ''}`}><span className="sr-only">{message.senderId === user.id ? 'Вы' : current.userName}: </span><p>{message.content}</p><time dateTime={message.createdAt}>{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt))}</time></li>)}</ol>
      {operationError.key === key && operationError.message && <ErrorState message={operationError.message}/>}
      <form className="message-form" onSubmit={send}><label htmlFor="message-content">Сообщение</label><textarea id="message-content" maxLength={2000} required value={content} disabled={sending} onChange={(event) => setDraft({ key, content: event.target.value })} placeholder="Напишите участнику…" rows={3}/><div className="feature-actions"><span className="feature-muted">{content.length} / 2 000</span><button className="button button-primary" disabled={sending || !content.trim()}>{sending ? 'Отправляем…' : 'Отправить'}</button></div></form>
    </section>}
  </div>
}
