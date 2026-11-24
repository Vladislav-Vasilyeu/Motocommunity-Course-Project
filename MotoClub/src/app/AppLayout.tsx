import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import Icon from '../shared/Icon'
import { useLocale } from '../shared/i18n'
import { useTheme } from '../features/preferences/theme'
import './RoadPulse.css'
import './ReferenceLayout.css'

const mainLinks = [
  { to: '/', label: 'Лента', icon: 'home', end: true },
  { to: '/communities', label: 'Клубы', icon: 'users' },
  { to: '/market', label: 'Маркет', icon: 'listing' },
  { to: '/messages', label: 'Сообщения', icon: 'message' },
]
const personalLinks = [
  { to: '/garage', label: 'Мой гараж', icon: 'bike' },
  { to: '/market?favorites=1', label: 'Избранное', icon: 'bookmark' },
  { to: '/friends', label: 'Друзья', icon: 'users' },
  { to: '/notifications', label: 'Уведомления', icon: 'bell' },
  { to: '/trips', label: 'Поездки', icon: 'route' },
  { to: '/routes', label: 'Маршруты', icon: 'route' },
  { to: '/map', label: 'Карта и места', icon: 'map' },
  { to: '/reports', label: 'Мои жалобы', icon: 'shield' },
  { to: '/settings', label: 'Настройки', icon: 'settings' },
]

export default function AppLayout() {
  const { t, locale, setLocale } = useLocale()
  const { resolvedTheme, setTheme } = useTheme()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const [signOutError, setSignOutError] = useState(false)
  const inTravel = /^\/(trips|routes|map)(\/|$)/.test(pathname)
  const links = [...personalLinks, ...(user?.role === 'ADMIN' || user?.role === 'MODERATOR' ? [{ to: '/moderation', label: 'Модерация', icon: 'shield' }] : [])]
  function secondaryNavigation() {
    return <>{user && <Link to="/profile"><Icon name="users"/><span>{t('Профиль')}</span></Link>}{links.map(({ to, label, icon }) => <Link key={to} to={to} className={(to.includes('?') ? pathname + search === to : pathname === to) ? 'current' : ''}><Icon name={icon}/><span>{t(label)}</span></Link>)}</>
  }
  async function logout() {
    try { await signOut(); setSignOutError(false); navigate('/') } catch { setSignOutError(true) }
  }
  function navigation(mobile: boolean) {
    const items = mobile ? [...mainLinks, { to: '/garage', label: 'Гараж', icon: 'bike', end: false }] : mainLinks
    return <nav className={mobile ? 'road-mobile-nav' : 'road-nav'} aria-label={t('Основная навигация')}>{items.map(({ to, label, icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'current' : ''}><Icon name={icon}/><span>{t(label)}</span></NavLink>)}</nav>
  }
  return <div className="road-app mc-reference-app">
    <a className="road-skip" href="#main-content">{t('Перейти к содержанию')}</a>
    <header className="road-header">
      <Link to="/" className="road-brand"><span className="mc-brand-mark"><Icon name="bike" size={28}/></span><span>MOTO<span className="mc-brand-light">CLUB</span><small>RIDE. CONNECT. BELONG.</small></span></Link>
      {navigation(false)}
      <div className="road-account">
        <button className="mc-header-control mc-language" aria-label={t('Язык интерфейса')} onClick={() => setLocale(locale === 'ru' ? 'en' : 'ru')}><Icon name="globe"/><span>{locale.toUpperCase()}</span></button>
        <button className="mc-header-control mc-theme" aria-label={t('Оформление')} onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}><Icon name={resolvedTheme === 'dark' ? 'sun' : 'moon'}/></button>
        {user && <NavLink to="/notifications" className="mc-header-control" aria-label={t('Уведомления')}><Icon name="bell"/></NavLink>}
        <details className="road-user" key={pathname + search}>
          <summary aria-label={t(user ? 'Меню профиля' : 'Все разделы')}>{user ? user.displayName.slice(0, 1).toUpperCase() : <Icon name="menu"/>}</summary>
          <nav className="road-user-menu" aria-label={t('Все разделы')}>{secondaryNavigation()}{user && <button onClick={() => void logout()}><Icon name="logout"/>{t('Выйти')}</button>}</nav>
        </details>
        {!user && <Link className="button button-primary mc-login" to="/login">{t('Войти')}</Link>}
      </div>
    </header>
    <div className="mc-app-grid">
      <aside className="mc-sidebar" aria-label={t('Личные разделы')}>
        <p className="eyebrow">{t('Мотосообщество')}</p>
        <nav>{secondaryNavigation()}</nav>
        <div className="mc-sidebar-note"><Icon name="bike" size={42}/><h3>Moto Club</h3><p>{t('Общайтесь, находите единомышленников и делитесь своей историей.')}</p>{!user && <Link to="/register">{t('Создать аккаунт')}</Link>}</div>
        {user && <button className="mc-logout" onClick={() => void logout()}><Icon name="logout"/>{t('Выйти')}</button>}
        <footer>MOTO CLUB © 2026<br/>RIDE TOGETHER</footer>
      </aside>
      <main className={pathname === '/login' || pathname === '/register' ? 'page-container road-auth' : 'page-container'} id="main-content" tabIndex={-1}>
        {signOutError && <p className="form-error" role="alert">{t('Не удалось выйти. Попробуйте снова.')}</p>}
        {inTravel && <nav className="road-travel" aria-label={t('Поездки и маршруты')}><NavLink to="/trips">{t('Поездки')}</NavLink><NavLink to="/routes">{t('Маршруты')}</NavLink><NavLink to="/map">{t('Карта и места')}</NavLink></nav>}
        <Outlet/>
      </main>
      <aside className="mc-rightbar" aria-label={t('Сообщество Moto Club')}>
        <section className="panel mc-community-panel"><p className="eyebrow">MOTO / COMMUNITY</p><Icon name="bike" size={76}/><h2>{t('Твои люди. Твоя дорога.')}</h2><p>{t('Общайтесь, находите единомышленников и делитесь своей историей.')}</p><Link className="button button-primary" to={user ? '/?compose=1' : '/register'}><Icon name="plus"/>{t(user ? 'Создать публикацию' : 'Создать аккаунт')}</Link></section>
        <section className="panel mc-community-links"><h3>{t('Клубы')}</h3><p>{t('Найдите сообщество по интересам и присоединяйтесь к обсуждению.')}</p><Link to="/communities">{t('Найти клуб')}</Link></section>
        <p className="mc-footer">MOTO CLUB · 2026</p>
      </aside>
    </div>
    {navigation(true)}
  </div>
}
