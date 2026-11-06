import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { getErrorMessage } from '../shared/api'
import { formObject } from '../shared/types'
import { PageTitle } from '../shared/ui'

export default function AuthPage() {
  const { pathname } = useLocation(); const navigate = useNavigate(); const { user, signIn, signUp, loading } = useAuth()
  const isRegister = pathname === '/register'; const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = formObject(event.currentTarget); setBusy(true); setError(''); try { if (isRegister) await signUp(String(data.displayName), String(data.email), String(data.password)); else await signIn(String(data.email), String(data.password)); navigate('/') } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) } }
  if (loading) return <div className="loading-block">Проверяю сессию…</div>
  if (user) return <div className="panel callout">Вы вошли как {user.displayName}. <Link to="/profile">Открыть профиль</Link></div>
  return <><PageTitle eyebrow="MotoClub" title={isRegister ? 'Создать аккаунт' : 'Войти'} description={isRegister ? 'Присоединяйтесь к сообществу райдеров.' : 'Войдите, чтобы публиковать и сохранять изменения.'}/><form className="panel auth-form" onSubmit={submit}>{isRegister && <label>Имя<input name="displayName" minLength={2} maxLength={60} autoComplete="name" required/></label>}<label>Email<input name="email" type="email" autoComplete="email" required/></label><label>Пароль<input name="password" type="password" minLength={10} maxLength={128} autoComplete={isRegister ? 'new-password' : 'current-password'} required/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" disabled={busy}>{busy ? 'Подождите…' : isRegister ? 'Создать аккаунт' : 'Войти'}</button><p>{isRegister ? 'Уже зарегистрированы?' : 'Впервые в MotoClub?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Войти' : 'Создать аккаунт'}</Link></p></form></>
}
