import ReportButton from '../features/reports/ReportButton'
import { t, useLocale, getIntlLocale } from '../shared/i18n'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { formObject, type Post } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'

export default function FeedPage() {
  useLocale()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Post | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setPosts((await api<{ posts: Post[] }>('/api/posts')).posts) }
    catch (err) { setError(getErrorMessage(err)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function savePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) { navigate('/login'); return }
    const form = event.currentTarget
    setBusy(true); setError('')
    const content = String(formObject(form).content ?? '')
    try {
      const result = editing
        ? await api<{ post: Post }>(`/api/posts/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ content }) })
        : await api<{ post: Post }>('/api/posts', { method: 'POST', body: JSON.stringify({ content }) })
      setPosts((items) => editing ? items.map((item) => item.id === result.post.id ? { ...item, ...result.post } : item) : [result.post, ...items])
      setEditing(null)
      form.reset()
    } catch (err) { setError(getErrorMessage(err)) }
    finally { setBusy(false) }
  }

  async function deletePost(post: Post) {
    if (!window.confirm(t("Удалить публикацию?"))) return
    try { await api(`/api/posts/${post.id}`, { method: 'DELETE' }); setPosts((items) => items.filter((item) => item.id !== post.id)) }
    catch (err) { setError(getErrorMessage(err)) }
  }

  return <>
    <div className="road-feed-hero"><PageTitle eyebrow={t("Moto Club · Сообщество")} title={t("Пульс дороги")} description={t("Люди, истории и поводы выехать.")} action={<Link className="button button-secondary" to="/trips">{t("Найти поездку")}</Link>} /></div>
    {user ? <form className="composer panel" key={editing?.id ?? 'new-post'} onSubmit={savePost}><label htmlFor="post-content">{editing ? t("Изменить публикацию") : t("Новая публикация")}</label><textarea id="post-content" name="content" maxLength={2000} minLength={1} required defaultValue={editing?.content} placeholder={t("Что хотите рассказать другим райдерам?")}/><div className="composer-footer">{editing && <button type="button" className="button button-quiet" onClick={() => setEditing(null)}>{t("Отмена")}</button>}<button className="button button-primary" disabled={busy}>{busy ? t("Сохраняю…") : editing ? t("Сохранить") : t("Опубликовать")}</button></div></form> : <div className="callout">{t("Войдите, чтобы поделиться историей.")}{' '}<Link to="/login">{t("Войти")}</Link></div>}
    {error && <ErrorState message={error} onRetry={load}/>}
    {loading ? <LoadingState/> : posts.length === 0 ? <EmptyState title={t("Пока нет публикаций")} description={t("Опубликуйте первую запись в MotoClub.")}/> : <div className="post-list">{posts.map((post) => <article className="post-card panel" key={post.id}><div className="post-meta"><span className="avatar">{post.author.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{post.author.displayName}</strong><small>{post.community ? <Link to={`/communities/${post.community.id}`}>{post.community.name}</Link> : post.author.profile?.city || t("Участник MotoClub")}</small></div><time>{new Intl.DateTimeFormat(getIntlLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post.createdAt))}</time></div><p className="post-text">{post.content}</p>{user && user.id !== post.author.id && <ReportButton targetType="POST" targetId={post.id}/>}{user?.id === post.author.id && <div className="card-actions"><button className="button button-quiet" onClick={() => { setEditing(post); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{t("Редактировать")}</button><button className="button button-danger-quiet" onClick={() => void deletePost(post)}>{t("Удалить")}</button></div>}</article>)}</div>}
  </>
}
