import Icon from '../shared/Icon'
import './reference-account.css'
import { t, useLocale } from '../shared/i18n'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import googleLogo from '../assets/google-g.svg'
import { useAuth } from '../features/auth/AuthProvider'
import { API_URL, api, getErrorMessage } from '../shared/api'
import { formObject } from '../shared/types'
import { PageTitle } from '../shared/ui'
import './AuthPage.css'

function getGoogleError(code: string | null) {
  switch (code) {
    case 'cancelled':
      return t("Вход через Google отменён. Вы можете попробовать снова.")
    case 'expired':
      return t("Срок действия запроса истёк. Начните вход через Google заново.")
    case 'email_in_use':
      return t("Этот email уже зарегистрирован. Войдите с паролем, затем подключите Google в настройках. После этого вы сможете входить через Google.")
    case 'failed':
      return t("Не удалось войти через Google. Попробуйте снова.")
    default:
      return ''
  }
}

export default function AuthPage() {
  useLocale()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, signIn, signUp, loading } = useAuth()
  const isRegister = pathname === '/register'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const pendingGoogleLink = useRef(false)
  const googleError = getGoogleError(searchParams.get('googleError'))

  useEffect(() => {
    if (loading || user) return
    const controller = new AbortController()
    api<{ enabled: boolean }>('/api/auth/google', { signal: controller.signal })
      .then(({ enabled }) => { if (!controller.signal.aborted) setGoogleEnabled(enabled) })
      .catch(() => { if (!controller.signal.aborted) setGoogleEnabled(false) })
    return () => controller.abort()
  }, [loading, user])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = formObject(event.currentTarget)
    pendingGoogleLink.current ||= !isRegister && searchParams.get('googleError') === 'email_in_use'
    setBusy(true)
    setError('')
    if (searchParams.has('googleError')) {
      const next = new URLSearchParams(searchParams)
      next.delete('googleError')
      setSearchParams(next, { replace: true })
    }
    try {
      if (isRegister) await signUp(String(data.displayName), String(data.email), String(data.password))
      else await signIn(String(data.email), String(data.password))
      navigate(pendingGoogleLink.current ? '/settings?connectGoogle=1' : '/')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="loading-block">{t("Проверяю сессию…")}</div>
  if (user) return <div className="panel callout">{t("Вы вошли как")}{' '}{user.displayName}. <Link to="/profile">{t("Открыть профиль")}</Link></div>

  return (
    <section className="panel mc-auth-card">
      <div className="mc-auth-symbol"><Icon name="bike" size={52}/></div>
      <PageTitle
        eyebrow="MotoClub"
        title={isRegister ? t("Создать аккаунт") : t("Войти")}
        description={isRegister ? t("Присоединяйтесь к сообществу райдеров.") : t("Войдите, чтобы публиковать и сохранять изменения.")}
      />
      <form className="auth-form mc-auth-form" onSubmit={submit}>
        {googleError && <p className="form-error" role="alert">{t(googleError)}</p>}
        {isRegister && (
          <label>{t("Имя")}<input name="displayName" minLength={2} maxLength={60} autoComplete="name" required /></label>
        )}
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>
          {' '}{t("Пароль")}{' '}<input name="password" type="password" minLength={10} maxLength={128}
            autoComplete={isRegister ? 'new-password' : 'current-password'} required />
        </label>
        {error && <p className="form-error" role="alert">{t(error)}</p>}
        <button className="button button-primary" disabled={busy}>
          {busy ? t("Подождите…") : isRegister ? t("Создать аккаунт") : t("Войти")}
        </button>
        {googleEnabled && (
          <a className="button auth-google" href={`${API_URL}/api/auth/google/start?mode=${isRegister ? 'register' : 'login'}`}>
            <img src={googleLogo} alt="" width={20} height={20} />
            {' '}{t("Продолжить с Google")}{' '}</a>
        )}
        <p>
          {isRegister ? t("Уже зарегистрированы?") : t("Впервые в MotoClub?")}{' '}
          <Link to={isRegister ? `/login${searchParams.get('googleError') === 'email_in_use' ? '?googleError=email_in_use' : ''}` : '/register'}>{isRegister ? t("Войти") : t("Создать аккаунт")}</Link>
        </p>
      </form>
    </section>
  )
}
