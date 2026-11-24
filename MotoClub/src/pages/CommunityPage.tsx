import './reference-social.css'
import Icon from '../shared/Icon'
import ReportButton from '../features/reports/ReportButton'
import { t, useLocale, getIntlLocale } from '../shared/i18n'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { formObject, type Community, type Post } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'

export default function CommunityPage() {
  useLocale()
  const { id = '' } = useParams(); const { user } = useAuth(); const navigate = useNavigate()
  const [community, setCommunity] = useState<Community | null>(null); const [isMember, setIsMember] = useState(false); const [posts, setPosts] = useState<Post[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { const [detail, feed] = await Promise.all([api<{ community: Community; isMember: boolean }>(`/api/communities/${id}`), api<{ posts: Post[] }>(`/api/posts?communityId=${encodeURIComponent(id)}`)]); setCommunity(detail.community); setIsMember(detail.isMember); setPosts(feed.posts) } catch (err) { setError(getErrorMessage(err)) } finally { setLoading(false) } }, [id])
  useEffect(() => { void load() }, [load])
  async function toggleMembership() { if (!user) { navigate('/login'); return }; setBusy(true); try { await api(`/api/communities/${id}${isMember ? '/membership' : '/join'}`, { method: isMember ? 'DELETE' : 'POST' }); setIsMember(!isMember) } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) } }
  async function publish(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!user) { navigate('/login'); return }; const form = event.currentTarget; setBusy(true); setError(''); try { const result = await api<{ post: Post }>('/api/posts', { method: 'POST', body: JSON.stringify({ ...formObject(form), communityId: id }) }); setPosts((items) => [result.post, ...items]); form.reset() } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) } }
  if (loading) return <LoadingState/>
  if (error && !community) return <><ErrorState message={error} onRetry={load}/><Link to="/communities">{t("К списку клубов")}</Link></>
  if (!community) return <EmptyState title={t("Клуб не найден")} description={t("Возможно, его удалили или ссылка устарела.")} action={<Link to="/communities">{t("К клубам")}</Link>}/>
  return <>
    <Link to="/communities" className="back-link">{t("← Все клубы")}</Link>
    <div className="mc-social-heading"><PageTitle eyebrow={t("Сообщество")} title={t("Клубы и группы")} description=""/></div>
    <section className="panel mc-community-profile"><div className="mc-community-banner" aria-hidden="true"><Icon name="users" size={100}/></div><div className="mc-card-body"><PageTitle eyebrow={community.city || t("Сообщество")} title={community.name} description={community.description || t("Описание пока не добавлено.")}/><div className="mc-community-actions"><button className={`button ${isMember ? 'button-secondary' : 'button-primary'}`} onClick={() => void toggleMembership()} disabled={busy}>{busy ? t("Обновляю…") : isMember ? t("Покинуть клуб") : t("Вступить в клуб")}</button>{user && <ReportButton targetType="COMMUNITY" targetId={community.id}/>}</div></div></section>
    <div className="mc-section-heading">{t("Публикация клуба")}</div>
    {error && <ErrorState message={error}/>}
    {isMember && <form className="composer panel" onSubmit={publish}><label htmlFor="club-post">{t("Публикация клуба")}</label><textarea id="club-post" name="content" required maxLength={2000} placeholder={t("Поделитесь новостью с участниками")}/><div className="composer-footer"><button className="button button-primary" disabled={busy}>{busy ? t("Публикую…") : t("Опубликовать")}</button></div></form>}
    {posts.length ? <div className="post-list mc-post-list">{posts.map((post) => <article className="panel post-card" key={post.id}><div className="post-meta"><span className="avatar">{post.author.displayName.slice(0, 1)}</span><div><strong>{post.author.displayName}</strong><small>{post.author.profile?.city || t("Участник MotoClub")}</small></div><time>{new Date(post.createdAt).toLocaleDateString(getIntlLocale())}</time></div><p className="post-text">{post.content}</p>{user && user.id !== post.author.id && <ReportButton targetType="POST" targetId={post.id}/>}</article>)}</div> : <EmptyState title={t("Публикаций пока нет")} description={isMember ? t("Добавьте первую запись клуба.") : t("Вступите в клуб, чтобы опубликовать первую запись.")}/>}
  </>
}
