import './reference-account.css'
import { t, useLocale } from '../shared/i18n'
import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { formObject, type User } from '../shared/types'
import { ErrorState, LoadingState, PageTitle } from '../shared/ui'

export default function ProfilePage() {
  useLocale()
  const editor = useRef<HTMLDetailsElement>(null)
  function editProfile() { if (editor.current) { editor.current.open = true; editor.current.scrollIntoView({ block: 'center' }); editor.current.querySelector('input')?.focus() } }
  const { user, loading: authLoading, updateUser } = useAuth(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false)
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); setSaved(false); try { const result = await api<{ user: User }>('/api/profile', { method: 'PATCH', body: JSON.stringify(formObject(event.currentTarget)) }); updateUser(result.user); setSaved(true) } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) } }
  if (authLoading) return <LoadingState label={t("Проверяю вход…")}/>
  return <div className="mc-account-page mc-profile-page">{!user ? <><PageTitle eyebrow={t("Аккаунт")} title={t("Профиль")} description={t("Войдите, чтобы управлять своим профилем.")}/><div className="panel callout"><Link to="/login">{t("Войти")}</Link> {' '}{t("или")}{' '}<Link to="/register">{t("создать аккаунт")}</Link>.</div></> : <>
    <PageTitle eyebrow={t("Аккаунт")} title={t("Профиль")} description={t("Информация, которую видят другие участники MotoClub.")} action={<button className="button button-primary" onClick={editProfile}>{t("Редактировать профиль")}</button>}/>
    <section className="panel mc-profile-summary">
      <div className="mc-profile-cover" aria-hidden="true" />
      <div className="mc-profile-identity"><span className="avatar mc-profile-avatar" aria-hidden="true">{user.displayName.slice(0, 1).toUpperCase()}</span><h2>{user.displayName}</h2><p className="muted">{[user.profile?.city, user.profile?.ridingStyle].filter(Boolean).join(' · ')}</p>{user.profile?.bio && <p className="mc-profile-bio">{user.profile.bio}</p>}<div className="mc-account-links"><Link className="button button-secondary" to="/garage">{t("Открыть гараж")}</Link><Link className="button button-secondary" to="/friends">{t("Друзья")}</Link><Link className="button button-quiet" to="/settings">{t("Настройки")}</Link></div></div>
    </section>
    {error && <ErrorState message={error}/>}{saved && <div className="success-message" role="status">{t("Профиль сохранён.")}</div>}
    <details ref={editor} className="panel create-panel mc-profile-editor-wrap"><summary>{t("Редактировать профиль")}</summary><form className="profile-form mc-profile-editor" onSubmit={save}><h2>{t("Профиль")}</h2><label>{t("Имя")}<input name="displayName" required minLength={2} maxLength={60} defaultValue={user.displayName}/></label><label>{t("Город")}<input name="city" maxLength={100} defaultValue={user.profile?.city}/></label><label>{t("Стиль езды")}<input name="ridingStyle" maxLength={80} defaultValue={user.profile?.ridingStyle}/></label><label>{t("О себе")}<textarea name="bio" maxLength={500} rows={4} defaultValue={user.profile?.bio}/></label><div className="form-buttons"><button className="button button-primary" disabled={busy}>{busy ? t("Сохраняю…") : t("Сохранить профиль")}</button><Link className="button button-secondary" to="/garage">{t("Открыть гараж")}</Link></div></form></details>
  </>}</div>
}
