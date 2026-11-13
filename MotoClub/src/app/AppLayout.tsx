import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import Icon from '../shared/Icon'
import brandMark from '../assets/moto-club-mark.svg'
import './RoadPulse.css'

const links = [
  { to: '/', label: 'Лента', icon: 'home', end: true },
  { to: '/communities', label: 'Клубы', icon: 'users' },
  { to: '/trips', label: 'Поездки', icon: 'route' },
  { to: '/market', label: 'Маркет', icon: 'listing' },
]

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const inTravel = /^\/(trips|routes|map)(\/|$)/.test(pathname)
  const navigation = (mobile: boolean) => <nav className={mobile ? 'road-mobile-nav' : 'road-nav'} aria-label="Основная навигация">
    {links.map(({to, label, icon, end}) => <NavLink key={to} to={to} end={end} aria-current={to === '/trips' && inTravel ? 'page' : undefined}
      className={({isActive}) => isActive || (to === '/trips' && inTravel) ? 'current' : ''}>
      {mobile && <Icon name={icon}/>}<span>{label}</span>
    </NavLink>)}
  </nav>
  return <div className="road-app">
    <a className="road-skip" href="#main-content">Перейти к содержанию</a>
    <header className="road-header">
      <Link to="/" className="road-brand"><img src={brandMark} alt="" width="30" height="22"/>Moto Club</Link>
      {navigation(false)}
      <div className="road-account">
        {user && <NavLink to="/messages" className="road-icon-link" aria-label="Сообщения"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16v12H9l-5 4zM8 8h8m-8 4h6"/></svg></NavLink>}
        {user ? <details className="road-user" key={pathname}>
          <summary aria-label="Меню профиля">{user.displayName.slice(0, 1).toUpperCase()}</summary>
          <div className="road-user-menu"><Link to="/profile">Профиль</Link><Link to="/garage">Мой гараж</Link><Link to="/friends">Друзья</Link><button onClick={async () => { await signOut(); navigate('/') }}>Выйти</button></div>
        </details> : <Link className="button button-secondary" to="/login">Войти</Link>}
      </div>
    </header>
    <main className={pathname === '/login' || pathname === '/register' ? 'page-container road-auth' : 'page-container'} id="main-content" tabIndex={-1}>
      {inTravel && <nav className="road-travel" aria-label="Поездки и маршруты"><NavLink to="/trips">Поездки</NavLink><NavLink to="/routes">Маршруты</NavLink><NavLink to="/map">Карта и места</NavLink></nav>}
      <Outlet />
    </main>
    {navigation(true)}
  </div>
}
