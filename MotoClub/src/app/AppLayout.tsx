import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import Icon from '../shared/Icon'

const links = [
  { to: '/', label: 'Лента', icon: 'home', end: true },
  { to: '/trips', label: 'Поездки', icon: 'route' },
  { to: '/communities', label: 'Клубы', icon: 'users' },
  { to: '/market', label: 'Объявления', icon: 'listing' },
  { to: '/map', label: 'Карта', icon: 'map' },
]

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return <div className="app-frame">
    <aside className="sidebar">
      <NavLink to="/" className="brand"><span className="brand-icon">M</span><span>MotoClub<small>СВОИ НА ДОРОГЕ</small></span></NavLink>
      <p className="nav-label">Сообщество</p>
      <nav className="main-nav" aria-label="Основная навигация">
        {links.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}><span className="nav-icon"><Icon name={item.icon}/></span>{item.label}</NavLink>)}
      </nav>
      <p className="nav-label personal-label">Личное</p>
      <nav className="main-nav" aria-label="Личные разделы">
        <NavLink to="/garage" className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}><span className="nav-icon"><Icon name="bike"/></span>Мой гараж</NavLink>
        <NavLink to="/friends" className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}><span className="nav-icon"><Icon name="users"/></span>Друзья</NavLink>
      </nav>
      <div className="sidebar-bottom">
        {user ? <><div className="account-summary"><span className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>{user.profile?.city || 'Райдер MotoClub'}</small></span></div><button className="button button-quiet button-full" onClick={async () => { await signOut(); navigate('/') }}>Выйти</button></> : <button className="button button-primary button-full" onClick={() => navigate('/login')}>Войти в аккаунт</button>}
      </div>
    </aside>
    <div className="app-main">
      <header className="topbar"><button className="mobile-brand" onClick={() => navigate('/')}>MotoClub</button><span className="topbar-spacer"/><NavLink to="/profile" className="account-link">{user ? user.displayName : <span>Войти</span>}</NavLink></header>
      <main className="page-container"><Outlet /></main>
    </div>
    <nav className="mobile-nav" aria-label="Мобильная навигация">{links.slice(0, 5).map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => isActive ? 'active' : ''}><span><Icon name={item.icon}/></span>{item.label}</NavLink>)}</nav>
  </div>
}
