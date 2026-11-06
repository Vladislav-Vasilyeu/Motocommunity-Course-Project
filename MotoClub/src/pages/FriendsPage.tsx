import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import type { FriendRequest, User } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth(); const [friends, setFriends] = useState<User[]>([]); const [requests, setRequests] = useState<FriendRequest[]>([]); const [riders, setRiders] = useState<User[]>([]); const [query, setQuery] = useState(''); const [loading, setLoading] = useState(false); const [searching, setSearching] = useState(false); const [error, setError] = useState('')
  const loadConnections = useCallback(async () => { if (!user) return; setLoading(true); setError(''); try { const data = await api<{ friends: User[]; requests: FriendRequest[] }>('/api/friends'); setFriends(data.friends); setRequests(data.requests) } catch (err) { setError(getErrorMessage(err)) } finally { setLoading(false) } }, [user])
  useEffect(() => { void loadConnections() }, [loadConnections])
  useEffect(() => {
    if (!user) return
    let active = true
    const timeout = window.setTimeout(async () => {
      setSearching(true)
      try { const directory = await api<{ users: User[] }>(`/api/users?search=${encodeURIComponent(query.trim())}`); if (active) setRiders(directory.users.filter((rider) => !friends.some((friend) => friend.id === rider.id))) }
      catch (err) { if (active) setError(getErrorMessage(err)) }
      finally { if (active) setSearching(false) }
    }, query.trim() ? 280 : 0)
    return () => { active = false; window.clearTimeout(timeout) }
  }, [friends, query, user])
  async function respond(request: FriendRequest, status: 'accept' | 'decline') { try { await api(`/api/friend-requests/${request.id}/respond`, { method: 'POST', body: JSON.stringify({ status }) }); setRequests((items) => items.filter((item) => item.id !== request.id)); if (status === 'accept') setFriends((items) => [...items, request.sender]) } catch (err) { setError(getErrorMessage(err)) } }
  async function sendRequest(rider: User) { try { await api(`/api/friend-requests/${rider.id}`, { method: 'POST', body: '{}' }); setRiders((items) => items.filter((item) => item.id !== rider.id)) } catch (err) { setError(getErrorMessage(err)) } }
  if (authLoading) return <LoadingState label="Проверяю вход…"/>
  return <><PageTitle eyebrow="Личное" title="Друзья" description="Заявки и райдеры MotoClub."/>{!user ? <div className="panel callout">Войдите, чтобы управлять контактами. <Link to="/login">Войти</Link></div> : <>
    <label className="panel search-field"><span>Найти райдера</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя или город"/></label>
    {error && <ErrorState message={error} onRetry={loadConnections}/ >}{loading ? <LoadingState/> : <>
      <section className="list-section"><h2>Входящие заявки <span className="count-badge">{requests.length}</span></h2>{requests.length === 0 ? <p className="muted">Новых заявок нет.</p> : <div className="card-grid">{requests.map((request) => <article className="panel person-card" key={request.id}><span className="avatar">{request.sender.displayName.slice(0, 1)}</span><strong>{request.sender.displayName}</strong><div className="card-actions"><button className="button button-primary" onClick={() => void respond(request, 'accept')}>Принять</button><button className="button button-quiet" onClick={() => void respond(request, 'decline')}>Отклонить</button></div></article>)}</div>}</section>
      <section className="list-section"><h2>Мой круг <span className="count-badge">{friends.length}</span></h2>{friends.length === 0 ? <EmptyState title="Список пока пуст" description="Найдите райдеров и отправьте заявку."/> : <div className="card-grid">{friends.map((friend) => <article className="panel person-card" key={friend.id}><span className="avatar">{friend.displayName.slice(0, 1)}</span><strong>{friend.displayName}</strong><small>{friend.profile?.city || 'Райдер MotoClub'}</small></article>)}</div>}</section>
      <section className="list-section"><h2>Райдеры MotoClub</h2>{searching ? <LoadingState label="Ищу райдеров…"/> : riders.length === 0 ? <p className="muted">Никого не нашли по этому запросу.</p> : <div className="card-grid">{riders.map((rider) => <article className="panel person-card" key={rider.id}><span className="avatar">{rider.displayName.slice(0, 1)}</span><strong>{rider.displayName}</strong><small>{rider.profile?.city || 'Райдер MotoClub'}</small><button className="button button-secondary" onClick={() => void sendRequest(rider)}>Добавить в друзья</button></article>)}</div>}</section>
    </>}</>}</>
}
