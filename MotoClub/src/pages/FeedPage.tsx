import './reference-social.css'
import Icon from '../shared/Icon'
import ReportButton from '../features/reports/ReportButton'
import { t, useLocale, getIntlLocale } from '../shared/i18n'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { formObject, type Post } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'

export default function FeedPage() {
  useLocale()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const composer = useRef<HTMLDetailsElement>(null)
  const [query, setQuery] = useState('')
  function openComposer() { if (composer.current) { composer.current.open = true; composer.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); requestAnimationFrame(() => composer.current?.querySelector('textarea')?.focus()) } }
  const [posts, setPosts] = useState<Post[]>([])
  const visiblePosts = posts.filter(post => `${post.content} ${post.author.displayName} ${post.community?.name ?? ''}`.toLowerCase().includes(query.toLowerCase()))
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
  useEffect(() => {
    if (!user || params.get('compose') !== '1' || !composer.current) return
    setEditing(null)
    composer.current.open = true
    requestAnimationFrame(() => {
      composer.current?.scrollIntoView({ block: 'center' })
      composer.current?.querySelector('textarea')?.focus()
    })
    const next = new URLSearchParams(params)
    next.delete('compose')
    setParams(next, { replace: true })
  }, [params, setParams, user])

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
    <div className="mc-social-heading"><PageTitle eyebrow={t("Moto Club · Сообщество")} title={t("Лента")} description={t("Люди, истории и поводы выехать.")} action={user && <button className="button button-primary" onClick={() => { setEditing(null); openComposer() }}><span aria-hidden="true">+</span>{t("Новая публикация")}</button>}/></div>
    {!user && <section className="mc-feed-hero"><div className="mc-hero-bike"><Icon name="bike" size={190}/></div><p className="eyebrow">MOTO CLUB</p><h2>{t("Пульс дороги")}</h2><p>{t("Люди, истории и поводы выехать.")}</p><Link className="button button-primary" to="/register">{t("Регистрация")}</Link></section>}
    <div className="mc-social-toolbar"><span className="mc-section-label">{t("Лента")}</span><label className="search-field"><span>{t("Поиск")}</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("Поиск")}/></label></div>
    {user ? <details className="panel mc-compose" ref={composer}><summary><span className="mc-compose-plus" aria-hidden="true">+</span>{t("Что хотите рассказать другим райдерам?")}</summary><form className="composer" key={editing?.id ?? 'new-post'} onSubmit={savePost}><label htmlFor="post-content">{editing ? t("Изменить публикацию") : t("Новая публикация")}</label><textarea id="post-content" name="content" maxLength={2000} minLength={1} required defaultValue={editing?.content} placeholder={t("Что хотите рассказать другим райдерам?")}/><div className="composer-footer">{editing && <button type="button" className="button button-quiet" onClick={() => setEditing(null)}>{t("Отмена")}</button>}<button className="button button-primary" disabled={busy}>{busy ? t("Сохраняю…") : editing ? t("Сохранить") : t("Опубликовать")}</button></div></form></details> : <div className="callout">{t("Войдите, чтобы поделиться историей.")}{' '}<Link to="/login">{t("Войти")}</Link></div>}
    {error && <ErrorState message={error} onRetry={load}/>}
    {loading ? <LoadingState/> : visiblePosts.length === 0 ? <EmptyState title={t("Пока нет публикаций")} description={query ? t("Измените поисковый запрос.") : t("Опубликуйте первую запись в MotoClub.")}/> : <div className="post-list mc-post-list">{visiblePosts.map((post) => <article className="post-card panel" key={post.id}><div className="post-meta"><span className="avatar">{post.author.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{post.author.displayName}</strong><small>{post.community ? <Link to={`/communities/${post.community.id}`}>{post.community.name}</Link> : post.author.profile?.city || t("Участник MotoClub")}</small></div><time>{new Intl.DateTimeFormat(getIntlLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(post.createdAt))}</time></div><p className="post-text">{post.content}</p>{user && user.id !== post.author.id && <ReportButton targetType="POST" targetId={post.id}/>}{user?.id === post.author.id && <div className="card-actions"><button className="button button-quiet" onClick={() => { setEditing(post); openComposer() }}>{t("Редактировать")}</button><button className="button button-danger-quiet" onClick={() => void deletePost(post)}>{t("Удалить")}</button></div>}</article>)}</div>}
  </>
}
