import './reference-account.css'
import { useState } from 'react'
import googleLogo from '../assets/google-g.svg'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { API_URL } from '../shared/api'
import { ErrorState, LoadingState } from '../shared/ui'
import { usePageResource } from './usePageResource'
import { useTheme, type Theme } from '../features/preferences/theme'
import { locales, useLocale } from '../shared/i18n'
import { PageTitle } from '../shared/ui'
import './settings.css'
import './AuthPage.css'

export default function SettingsPage() {
  const { theme, setTheme, storageAvailable } = useTheme()
  const { locale, setLocale, t, storageAvailable: localeStorageAvailable } = useLocale()
  const [changed, setChanged] = useState(false)
  const options: { value: Theme; label: string; detail?: string }[] = [
    { value: 'system', label: 'Системная', detail: 'Следовать настройкам устройства' },
    { value: 'light', label: 'Светлая' },
    { value: 'dark', label: 'Тёмная' },
  ]
  return <div className="settings-page mc-account-page mc-settings-page">
    <PageTitle eyebrow={t('Интерфейс')} title={t('Настройки')} description={t('Тема и язык применяются сразу и сохраняются в этом браузере.')}/>
    <div className="panel settings-panel">
      <fieldset className="settings-group"><legend>{t('Оформление')}</legend>
        <div className="settings-options">{options.map(option => <label className="settings-option" key={option.value}>
          <input type="radio" name="theme" value={option.value} checked={theme === option.value} onChange={() => { setTheme(option.value); setChanged(true) }}/>
          <span><strong>{t(option.label)}</strong>{option.detail && <small>{t(option.detail)}</small>}</span>
        </label>)}</div>
      </fieldset>
      <fieldset className="settings-group"><legend>{t('Язык интерфейса')}</legend>
        <div className="settings-options">{locales.map(language => <label className="settings-option" key={language.code}>
          <input type="radio" name="language" value={language.code} checked={locale === language.code} onChange={() => { setLocale(language.code); setChanged(true) }}/>
          <span><strong lang={language.code}>{language.label}</strong><small>{t(language.code === 'en' ? 'Английский' : language.label)}</small></span>
        </label>)}</div>
      </fieldset>
      <p className="settings-note">{t('Изменения сохраняются автоматически. Вход не требуется.')}</p>
      <div aria-live="polite" aria-atomic="true" className="settings-feedback">{!storageAvailable ? <p className="form-error">{t('Не удалось сохранить тему. Выбор действует до закрытия страницы.')}</p> : !localeStorageAvailable ? <p className="form-error">{t('Не удалось сохранить язык. Выбор действует до закрытия страницы.')}</p> : changed ? <p className="success-message">{t('Настройки обновлены.')}</p> : null}</div>
    </div>
    <GoogleConnection />
  </div>
}

function GoogleConnection() {
  const { user, loading } = useAuth()
  const { t } = useLocale()
  const [params] = useSearchParams()
  const connection = usePageResource<{ enabled: boolean; linked: boolean }>(user ? '/api/auth/google' : null, user?.id)
  const errorKeys: Record<string, string> = {
    session_changed: 'Сессия изменилась. Войдите в свой аккаунт и начните подключение Google заново.',
    email_mismatch: 'Выберите аккаунт Google с тем же email, который указан в вашем профиле MotoClub.',
    already_linked: 'К этому аккаунту уже подключён другой аккаунт Google.',
    identity_in_use: 'Этот аккаунт Google уже подключён к другому профилю MotoClub.',
    cancelled: 'Подключение Google отменено. Можно попробовать снова.',
    expired: 'Срок действия запроса истёк. Начните подключение Google заново.',
    failed: 'Не удалось подключить Google. Попробуйте снова.',
  }
  const error = errorKeys[params.get('googleError') ?? '']
  return <section className="panel settings-panel settings-connection" aria-labelledby="google-connection-title">
    <h2 id="google-connection-title">{t('Вход через Google')}</h2>
    {error && <p className="form-error" role="alert">{t(error)}</p>}
    {loading ? <LoadingState /> : !user ? <p>{t('Войдите с паролем, чтобы подключить Google к существующему аккаунту.')} <Link to="/login">{t('Войти')}</Link></p> : <>
      <p className="settings-note">{user.email ? t('Подключите Google к вашему аккаунту, чтобы входить без пароля. Выберите Google с тем же email: {email}', { email: user.email }) : t('Выберите аккаунт Google с тем же email, который указан в вашем профиле MotoClub.')}</p>
      {connection.loading ? <LoadingState /> : connection.error ? <ErrorState message={connection.error} onRetry={connection.reload} /> : connection.data?.linked ? <p className="success-message" role="status">{t('Google подключён. Теперь вы можете входить через Google.')}</p> : connection.data?.enabled ? <>
        {params.get('connectGoogle') === '1' && <p className="settings-note" role="status">{t('Вы подтвердили вход с паролем. Теперь подключите свой аккаунт Google.')}</p>}
        <a className="button auth-google" href={`${API_URL}/api/auth/google/start?mode=link`}><img src={googleLogo} alt="" width={20} height={20} />{t('Подключить Google')}</a>
      </> : <p className="settings-note">{t('Подключение Google сейчас недоступно. Попробуйте позже.')}</p>}
    </>}
  </section>
}
