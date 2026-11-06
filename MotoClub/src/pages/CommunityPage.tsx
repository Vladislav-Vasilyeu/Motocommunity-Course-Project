import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { formObject, type Community, type Post } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'

export default function CommunityPage() {
  const { id = '' } = useParams(); const { user } = useAuth(); const navigate = useNavigate()
  const [community, setCommunity] = useState<Community | null>(null); const [isMember, setIsMember] = useState(false); const [posts, setPosts] = useState<Post[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { const [detail, feed] = await Promise.all([api<{ community: Community; isMember: boolean }>(`/api/communities/${id}`), api<{ posts: Post[] }>(`/api/posts?communityId=${encodeURIComponent(id)}`)]); setCommunity(detail.community); setIsMember(detail.isMember); setPosts(feed.posts) } catch (err) { setError(getErrorMessage(err)) } finally { setLoading(false) } }, [id])
  useEffect(() => { void load() }, [load])
  async function toggleMembership() { if (!user) { navigate('/login'); return }; setBusy(true); try { await api(`/api/communities/${id}${isMember ? '/membership' : '/join'}`, { method: isMember ? 'DELETE' : 'POST' }); setIsMember(!isMember) } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) } }
  async function publish(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!user) { navigate('/login'); return }; const form = event.currentTarget; setBusy(true); setError(''); try { const result = await api<{ post: Post }>('/api/posts', { method: 'POST', body: JSON.stringify({ ...formObject(form), communityId: id }) }); setPosts((items) => [result.post, ...items]); form.reset() } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) } }
  if (loading) return <LoadingState/>
  if (error && !community) return <><ErrorState message={error} onRetry={load}/><Link to="/communities">К списку клубов</Link></>
  if (!community) return <EmptyState title="Клуб не найден" description="Возможно, его удалили или ссылка устарела." action={<Link to="/communities">К клубам</Link>}/>
  return <>
    <Link to="/communities" className="back-link">← Все клубы</Link>
    <PageTitle eyebrow={community.city || 'Сообщество'} title={community.name} description={community.description || 'Описание пока не добавлено.'} action={<button className={`button ${isMember ? 'button-secondary' : 'button-primary'}`} onClick={() => void toggleMembership()} disabled={busy}>{busy ? 'Обновляю…' : isMember ? 'Покинуть клуб' : 'Вступить в клуб'}</button>}/>
    {error && <ErrorState message={error}/>}
    {isMember && <form className="composer panel" onSubmit={publish}><label htmlFor="club-post">Публикация клуба</label><textarea id="club-post" name="content" required maxLength={2000} placeholder="Поделитесь новостью с участниками"/><div className="composer-footer"><button className="button button-primary" disabled={busy}>{busy ? 'Публикую…' : 'Опубликовать'}</button></div></form>}
    {posts.length ? <div className="post-list">{posts.map((post) => <article className="panel post-card" key={post.id}><div className="post-meta"><span className="avatar">{post.author.displayName.slice(0, 1)}</span><div><strong>{post.author.displayName}</strong><small>{post.author.profile?.city || 'Участник MotoClub'}</small></div><time>{new Date(post.createdAt).toLocaleDateString('ru-RU')}</time></div><p className="post-text">{post.content}</p></article>)}</div> : <EmptyState title="Публикаций пока нет" description={isMember ? 'Добавьте первую запись клуба.' : 'Вступите в клуб, чтобы опубликовать первую запись.'}/>}
  </>
}
