import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { formObject, type User } from '../shared/types'
import { ErrorState, LoadingState, PageTitle } from '../shared/ui'

export default function ProfilePage() {
  const { user, loading: authLoading, signOut, updateUser } = useAuth(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false)
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); setSaved(false); try { const result = await api<{ user: User }>('/api/profile', { method: 'PATCH', body: JSON.stringify(formObject(event.currentTarget)) }); updateUser(result.user); setSaved(true) } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) } }
  if (authLoading) return <LoadingState label="Проверяю вход…"/>
  return <>{!user ? <><PageTitle eyebrow="Аккаунт" title="Профиль" description="Войдите, чтобы управлять своим профилем."/><div className="panel callout"><Link to="/login">Войти</Link> или <Link to="/register">создать аккаунт</Link>.</div></> : <>
    <PageTitle eyebrow="Аккаунт" title="Профиль" description="Информация, которую видят другие участники MotoClub." action={<button className="button button-quiet" onClick={() => void signOut()}>Выйти</button>}/>
    {error && <ErrorState message={error}/>}{saved && <div className="success-message" role="status">Профиль сохранён.</div>}
    <form className="panel profile-form" onSubmit={save}><label>Имя<input name="displayName" required minLength={2} maxLength={60} defaultValue={user.displayName}/></label><label>Город<input name="city" maxLength={100} defaultValue={user.profile?.city}/></label><label>Стиль езды<input name="ridingStyle" maxLength={80} defaultValue={user.profile?.ridingStyle}/></label><label>О себе<textarea name="bio" maxLength={500} rows={4} defaultValue={user.profile?.bio}/></label><div className="form-buttons"><button className="button button-primary" disabled={busy}>{busy ? 'Сохраняю…' : 'Сохранить профиль'}</button><Link className="button button-secondary" to="/garage">Открыть гараж</Link></div></form>
  </>}</>
}
