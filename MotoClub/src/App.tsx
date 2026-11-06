import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerRetinaIcon from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import './App.css'

L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerRetinaIcon, shadowUrl: markerShadow })

type Page = 'feed' | 'trips' | 'communities' | 'market' | 'map' | 'garage' | 'profile' | 'friends'
type User = { id: string; email?: string; displayName: string; role?: string; profile?: { bio?: string; city?: string; ridingStyle?: string } }
type Post = { id: string; content: string; createdAt: string; author: User; community?: { id: string; name: string } | null }
type Listing = { id: string; title: string; description: string; category: string; price: string | number; condition: string; city: string; imageUrl?: string | null; status: string; seller: User }
type Community = { id: string; name: string; description: string; city: string; _count?: { members: number; posts: number } }
type FriendRequest = { id: string; sender: User }
type Motorcycle = { id: string; make: string; model: string; year?: number | null; mileage?: number | null }
type Trip = { id: string; title: string; description: string; startsAt: string; organizer: User; waypoints: { id: string; latitude: number | string; longitude: number | string; label: string }[]; _count?: { participants: number } }
type Place = { id: string; name: string; category: string; city: string; latitude: number | string; longitude: number | string; description?: string }

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const demoPosts: Post[] = [
  { id: 'post-1', content: 'Нашёл отличный маршрут через Логойск и Плещеницы. Асфальт хороший, машин мало — добавил остановку у озера. Кто хочет прокатиться в субботу?', createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(), author: { id: 'u2', displayName: 'Илья Романов', profile: { city: 'Минск' } } },
  { id: 'post-2', content: 'После зимнего ТО заменил цепь и колодки. Если кто-то ищет нормальный сервис в районе Уручья — подскажу контакты.', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), author: { id: 'u3', displayName: 'Марина Коваль', profile: { city: 'Минск' } }, community: { id: 'c1', name: 'Мотоклуб Минск' } },
]
const demoCommunities: Community[] = [
  { id: 'c1', name: 'Мотоклуб Минск', description: 'Встречи, городские маршруты и совместные выезды по выходным.', city: 'Минск', _count: { members: 248, posts: 36 } },
  { id: 'c2', name: 'Туринг Беларусь', description: 'Дальние поездки, подготовка техники и полезные остановки.', city: 'Беларусь', _count: { members: 176, posts: 22 } },
  { id: 'c3', name: 'Классика и кастом', description: 'Ретро-мотоциклы, кастом-проекты и обмен опытом.', city: 'Минск', _count: { members: 94, posts: 14 } },
]
const demoListings: Listing[] = [
  { id: 'l1', title: 'Honda CB650R, 2021', description: 'Один владелец, сервисная история, бережная эксплуатация.', category: 'Мотоциклы', price: 27500, condition: 'used', city: 'Минск', status: 'ACTIVE', seller: { id: 'u4', displayName: 'Дмитрий Лис' } },
  { id: 'l2', title: 'Куртка REV’IT! Sand 4', description: 'Размер L, защита в комплекте. Надевалась несколько раз.', category: 'Экипировка', price: 790, condition: 'used', city: 'Гродно', status: 'ACTIVE', seller: { id: 'u5', displayName: 'Анастасия К.' } },
  { id: 'l3', title: 'Комплект боковых кофров Givi', description: 'Крепления для V-Strom 650, без трещин и ремонта.', category: 'Запчасти', price: 1250, condition: 'used', city: 'Брест', status: 'ACTIVE', seller: { id: 'u6', displayName: 'Павел Мирный' } },
]
const demoTrips: Trip[] = [
  { id: 't1', title: 'Субботний круг: Минск — Нарочь', description: 'Спокойный темп, остановка на кофе и обед у озера. Подходит для любого класса.', startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(), organizer: { id: 'u2', displayName: 'Илья Романов' }, waypoints: [{ id: 'w1', latitude: 53.9, longitude: 27.56, label: 'Минск' }, { id: 'w2', latitude: 54.9, longitude: 26.7, label: 'Нарочь' }], _count: { participants: 8 } },
  { id: 't2', title: 'Вечерняя поездка на Дубровское', description: 'Встречаемся на заправке у МКАД, едем без спешки.', startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(), organizer: { id: 'u3', displayName: 'Марина Коваль' }, waypoints: [{ id: 'w3', latitude: 53.9, longitude: 27.56, label: 'Минск' }, { id: 'w4', latitude: 54.05, longitude: 27.85, label: 'Дубровское' }], _count: { participants: 5 } },
]
const demoPlaces: Place[] = [
  { id: 'p1', name: 'АЗС и точка сбора', category: 'Точка встречи', city: 'Минск', latitude: 53.9, longitude: 27.56, description: 'Удобно встретиться перед выездом' },
  { id: 'p2', name: 'Кафе у озера', category: 'Кафе', city: 'Нарочь', latitude: 54.9, longitude: 26.7, description: 'Парковка для мотоциклов' },
]

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error?.message ?? `Ошибка запроса (${response.status})`)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    home: 'M3 10.8 12 3l9 7.8M5.5 9.2V21h13V9.2M9 21v-6h6v6',
    route: 'M4 18c2.5-5 4-8 7-8s4.5 5 7 0M4 18h4m9-8h4M5 5h.01M19 18h.01',
    users: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    bag: 'M5 8h14l1 13H4L5 8Zm4 0V6a3 3 0 0 1 6 0v2',
    map: 'M3 6 9 3l6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',
    bike: 'm5 16 3-7h7l4 7M8 9l-2-3H3m12 3 2-3h3M5 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm14 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM8 9l4 7',
    user: 'M20 21a8 8 0 0 0-16 0m8-10a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
    search: 'm20 20-4.5-4.5M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
    plus: 'M12 5v14m-7-7h14',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    pin: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    clock: 'M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    heart: 'M20.8 8.6c0 5.4-8.8 10.4-8.8 10.4S3.2 14 3.2 8.6a4.5 4.5 0 0 1 8.8-1.2 4.5 4.5 0 0 1 8.8 1.2Z',
    chat: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8v.5Z',
    logout: 'M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7',
    close: 'm18 6-12 12M6 6l12 12',
    filter: 'M4 7h16M7 12h10m-7 5h4',
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.home} /></svg>
}

function Avatar({ name, size = 'normal' }: { name: string; size?: 'normal' | 'large' | 'small' }) {
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <span className={`avatar avatar-${size}`} aria-label={name}>{initials}</span>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function AuthDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const data = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const result = await api<{ user: User }>(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(data) })
      onSuccess(result.user)
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось войти') }
    finally { setBusy(false) }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section className="dialog auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="icon-button dialog-close" onClick={onClose} aria-label="Закрыть"><Icon name="close" /></button><span className="eyebrow">MotoClub · Беларусь</span><h2 id="auth-title">{mode === 'register' ? 'Рады знакомству' : 'С возвращением'}</h2><p className="muted">{mode === 'register' ? 'Создайте аккаунт и найдите своих на дороге.' : 'Войдите, чтобы продолжить.'}</p><form onSubmit={submit} className="form-stack">{mode === 'register' && <label>Как к вам обращаться<input name="displayName" minLength={2} maxLength={60} required autoComplete="name" placeholder="Например, Алексей" /></label>}<label>Email<input name="email" type="email" autoComplete="email" required placeholder="name@example.com" /></label><label>Пароль<input name="password" type="password" minLength={10} maxLength={128} required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="Не менее 10 символов" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary button-wide" disabled={busy}>{busy ? 'Подождите…' : mode === 'register' ? 'Создать аккаунт' : 'Войти'}</button></form><p className="switch-auth">{mode === 'register' ? 'Уже с нами?' : 'Впервые в MotoClub?'} <button className="text-button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError('') }}>{mode === 'register' ? 'Войти' : 'Создать аккаунт'}</button></p></section></div>
}

function MapView({ places, trips }: { places: Place[]; trips: Trip[] }) {
  const center: LatLngExpression = [53.9, 27.56]
  const markers = [
    ...places.map((place) => ({ id: place.id, label: place.name, detail: `${place.category} · ${place.city}`, lat: Number(place.latitude), lng: Number(place.longitude) })),
    ...trips.flatMap((trip) => trip.waypoints.map((point) => ({ id: `${trip.id}-${point.id}`, label: point.label || trip.title, detail: trip.title, lat: Number(point.latitude), lng: Number(point.longitude) }))),
  ]
  return <div className="map-frame"><MapContainer center={center} zoom={7} scrollWheelZoom={false} className="leaflet-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{markers.map((point) => <Marker key={point.id} position={[point.lat, point.lng]}><Popup><strong>{point.label}</strong><br />{point.detail}</Popup></Marker>)}</MapContainer><div className="map-legend"><span className="legend-dot" /> Поездки и места <span className="map-total">{markers.length} точек</span></div></div>
}

function App() {
  const [page, setPage] = useState<Page>('feed')
  const [user, setUser] = useState<User | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [dialog, setDialog] = useState<'post' | 'listing' | 'community' | 'trip' | 'bike' | 'profile' | null>(null)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [editingListing, setEditingListing] = useState<Listing | null>(null)
  const [editingBike, setEditingBike] = useState<Motorcycle | null>(null)
  const [dialogCommunityId, setDialogCommunityId] = useState<string | null>(null)
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null)
  const [communityPosts, setCommunityPosts] = useState<Post[]>([])
  const [communityJoined, setCommunityJoined] = useState(false)
  const [posts, setPosts] = useState(demoPosts)
  const [communities, setCommunities] = useState(demoCommunities)
  const [listings, setListings] = useState(demoListings)
  const [trips, setTrips] = useState(demoTrips)
  const [places, setPlaces] = useState(demoPlaces)
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([])
  const [friends, setFriends] = useState<User[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [riders, setRiders] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Все категории')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      api<{ posts: Post[] }>('/api/posts'), api<{ communities: Community[] }>('/api/communities'),
      api<{ listings: Listing[] }>('/api/listings'), api<{ trips: Trip[] }>('/api/trips'), api<{ places: Place[] }>('/api/places'),
    ])
    if (results[0].status === 'fulfilled') setPosts(results[0].value.posts)
    if (results[1].status === 'fulfilled') setCommunities(results[1].value.communities)
    if (results[2].status === 'fulfilled') setListings(results[2].value.listings)
    if (results[3].status === 'fulfilled') setTrips(results[3].value.trips)
    if (results[4].status === 'fulfilled') setPlaces(results[4].value.places)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    void api<{ user: User }>('/api/auth/me').then((result) => setUser(result.user)).catch(() => undefined)
  }, [refresh])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    if (page !== 'garage' || !user) return
    void api<{ motorcycles: Motorcycle[] }>('/api/motorcycles').then((result) => setMotorcycles(result.motorcycles)).catch((err) => setNotice(err.message))
  }, [page, user])

  useEffect(() => {
    if (page !== 'friends' || !user) return
    void Promise.all([api<{ friends: User[]; requests: FriendRequest[] }>('/api/friends'), api<{ users: User[] }>(`/api/users?search=${encodeURIComponent(search)}`)]).then(([result, directory]) => { setFriends(result.friends); setFriendRequests(result.requests); setRiders(directory.users.filter((rider) => !result.friends.some((friend) => friend.id === rider.id))) }).catch((err) => setNotice(err.message))
  }, [page, user, search])

  useEffect(() => {
    if (page !== 'communities' || !selectedCommunity) return
    void api<{ posts: Post[] }>(`/api/posts?communityId=${encodeURIComponent(selectedCommunity.id)}`).then((result) => setCommunityPosts(result.posts)).catch(() => setCommunityPosts([]))
  }, [page, selectedCommunity])

  const title: Record<Page, string> = { feed: 'Лента', trips: 'Поездки', communities: 'Сообщества', market: 'Объявления', map: 'Карта', garage: 'Мой гараж', profile: 'Профиль', friends: 'Друзья' }
  const filteredListings = useMemo(() => listings.filter((listing) => (category === 'Все категории' || listing.category === category) && `${listing.title} ${listing.description} ${listing.city}`.toLowerCase().includes(search.toLowerCase())), [listings, category, search])

  function requireUser(action: () => void) {
    if (!user) { setAuthOpen(true); return }
    action()
  }

  async function saveForm(event: FormEvent<HTMLFormElement>, path: string, onSaved: (value: any) => void, extra: Record<string, unknown> = {}) {
    event.preventDefault()
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form))
    try {
      const editingItem = path === '/api/posts' ? editingPost : path === '/api/listings' ? editingListing : null
      const actionPath = editingItem ? `${path}/${editingItem.id}` : path
      const result = await api<any>(actionPath, { method: editingItem ? 'PATCH' : 'POST', body: JSON.stringify({ ...data, ...extra }) })
      onSaved(result)
      setDialog(null)
      setEditingPost(null)
      setEditingListing(null)
      setDialogCommunityId(null)
      setNotice('Готово, изменения сохранены')
      form.reset()
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Не удалось сохранить') }
  }

  async function signOut() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    setUser(null); setPage('feed'); setNotice('Вы вышли из аккаунта')
  }

  function createContentDialog() {
    if (page === 'feed') setDialog('post')
    else if (page === 'market') { setEditingListing(null); setDialog('listing') }
    else if (page === 'communities') setDialog('community')
    else if (page === 'trips') setDialog('trip')
    else setDialog('bike')
  }

  const nav: { id: Page; label: string; icon: string }[] = [
    { id: 'feed', label: 'Лента', icon: 'home' }, { id: 'trips', label: 'Поездки', icon: 'route' },
    { id: 'communities', label: 'Сообщества', icon: 'users' }, { id: 'market', label: 'Объявления', icon: 'bag' }, { id: 'map', label: 'Карта', icon: 'map' },
  ]

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setPage('feed')} aria-label="MotoClub — на главную"><span className="brand-mark"><Icon name="bike" size={24} /></span><span>Moto<span>Club</span><small>СВОИ НА ДОРОГЕ</small></span></button>
      <button className="location-pill"><Icon name="pin" size={16} /> Беларусь <span className="chevron">⌄</span></button>
      <nav className="side-nav" aria-label="Основная навигация"><span className="nav-caption">СООБЩЕСТВО</span>{nav.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}><Icon name={item.icon} /><span>{item.label}</span>{item.id === 'trips' && <span className="nav-count">2</span>}</button>)}<span className="nav-caption nav-caption-personal">МОЁ</span><button className={`nav-item ${page === 'garage' ? 'active' : ''}`} onClick={() => setPage('garage')}><Icon name="bike" /><span>Мой гараж</span></button><button className={`nav-item ${page === 'friends' ? 'active' : ''}`} onClick={() => { setPage('friends'); requireUser(() => undefined) }}><Icon name="users" /><span>Друзья</span></button></nav>
      <div className="sidebar-bottom"><div className="weather-chip"><span className="weather-icon">☀</span><div><strong>+12°</strong><small>Отлично для поездки</small></div><span className="weather-spark">↗</span></div>{user ? <button className="profile-mini" onClick={() => setPage('profile')}><Avatar name={user.displayName} /><span><strong>{user.displayName}</strong><small>{user.profile?.city || 'Райдер MotoClub'}</small></span><span className="profile-dots">•••</span></button> : <button className="profile-mini" onClick={() => setAuthOpen(true)}><span className="avatar avatar-guest"><Icon name="user" /></span><span><strong>Войти в MotoClub</strong><small>Сохраните свои поездки</small></span><Icon name="arrow" size={17} /></button>}</div>
    </aside>
    <main className="main-shell">
      <header className="topbar"><div className="mobile-brand"><span className="brand-mark"><Icon name="bike" size={22} /></span> MotoClub</div><div className="breadcrumb"><span>Главная</span><b>/</b><strong>{title[page]}</strong></div><label className="global-search"><Icon name="search" size={18} /><input aria-label="Поиск по MotoClub" placeholder="Поиск по MotoClub" value={page === 'market' ? search : undefined} onChange={(e) => page === 'market' && setSearch(e.target.value)} /><kbd>⌘ K</kbd></label><button className="icon-button notification-button" aria-label="Уведомления" onClick={() => setNotice(user ? 'Новых уведомлений пока нет' : 'Войдите, чтобы посмотреть уведомления')}><Icon name="bell" /><i /></button>{user ? <button className="top-user" onClick={() => setPage('profile')}><Avatar name={user.displayName} size="small" /></button> : <button className="button button-light top-login" onClick={() => setAuthOpen(true)}>Войти</button>}</header>

      <div className="page-body">
        <div className="page-heading"><div><span className="eyebrow">ЧЕТВЕРГ, 6 НОЯБРЯ · СЕЗОН ПРОДОЛЖАЕТСЯ</span><h1>{page === 'feed' ? <>Привет, райдер <span className="heading-sun">✳</span></> : title[page]}</h1><p className="page-subtitle">{page === 'feed' ? 'Здесь начинается следующая хорошая история.' : page === 'market' ? 'Техника, экипировка и детали от райдеров рядом.' : page === 'trips' ? 'Планируйте маршрут и отправляйтесь вместе.' : page === 'map' ? 'Полезные места и совместные поездки поблизости.' : page === 'communities' ? 'Найдите людей, с которыми хочется ехать дальше.' : page === 'garage' ? 'Ваша техника и всё важное о ней.' : page === 'friends' ? 'Райдеры, с которыми вы на одной дороге.' : 'Ваши поездки, техника и публикации.'}</p></div><button className="button button-primary create-button" onClick={() => requireUser(createContentDialog)}><Icon name="plus" size={18} /><span>{page === 'feed' ? 'Новая публикация' : page === 'market' ? 'Разместить объявление' : page === 'communities' ? 'Создать сообщество' : page === 'trips' ? 'Создать поездку' : 'Добавить мотоцикл'}</span></button></div>

        {page === 'feed' && <div className="content-grid"><section className="primary-column"><div className="story-strip"><button className="story-add" onClick={() => requireUser(() => setDialog('post'))}><span className="story-plus"><Icon name="plus" /></span><span><strong>Поделиться</strong><small>Новый момент</small></span></button>{[{name:'Илья Романов', tag:'Минск'}, {name:'Марина Коваль',tag:'Туринг'}, {name:'Павел Мирный',tag:'Классика'}, {name:'Денис Орлов',tag:'Эндуро'}].map((rider, i) => <button className="story-person" key={rider.name} onClick={() => setNotice(`${rider.name} скоро появится в вашем круге`)}><span className={`story-ring story-ring-${i}`}><Avatar name={rider.name} size="large" /></span><strong>{rider.name.split(' ')[0]}</strong></button>)}</div><div className="section-title-row"><div><span className="eyebrow">ВАШ КРУГ</span><h2>Свежие истории</h2></div><button className="text-button" onClick={() => setNotice('Вы просматриваете свежие публикации')}>Сначала новые <span>⌄</span></button></div>{posts.length ? <div className="post-list">{posts.map((post, index) => <article className="post-card" key={post.id}><div className="post-head"><Avatar name={post.author.displayName} /><div className="post-author"><strong>{post.author.displayName}</strong><span>{post.author.profile?.city || 'Райдер'} {post.community && <>· <b>{post.community.name}</b></>}</span></div><time>{formatDate(post.createdAt)}</time>{user?.id === post.author.id && <><button className="icon-button more-button" aria-label="Edit post" onClick={() => {setEditingPost(post);setDialogCommunityId(post.community?.id ?? null);setDialog('post')}}>•••</button><button className="icon-button" aria-label="Delete post" onClick={async () => { try { await api(`/api/posts/${post.id}`, { method: 'DELETE' }); setPosts((items) => items.filter((item) => item.id !== post.id)); setCommunityPosts((items) => items.filter((item) => item.id !== post.id)); setNotice('Post deleted') } catch (err) { setNotice(err instanceof Error ? err.message : 'Delete failed') }}}>x</button></>}</div>{index === 0 && <div className="post-cover ride-cover"><div className="cover-orbit orbit-one" /><div className="cover-orbit orbit-two" /><div className="cover-road" /><div className="cover-label"><span className="cover-kicker">МАРШРУТ ВЫХОДНОГО ДНЯ</span><strong>Едем туда,<br />где тише.</strong><span className="cover-coordinates">53°54′N 27°33′E</span></div><span className="cover-badge"><Icon name="route" size={15} /> 146 км</span></div>}<p className="post-content">{post.content}</p><div className="post-actions"><button onClick={() => setNotice('Войдите, чтобы добавить реакцию')}><Icon name="heart" size={18} /> Нравится <span>12</span></button><button onClick={() => setNotice('Войдите, чтобы ответить')}><Icon name="chat" size={18} /> Ответить <span>4</span></button><button className="save-action" onClick={() => setNotice('Войдите, чтобы сохранить публикацию')}><Icon name="route" size={18} /> Сохранить маршрут</button></div></article>)}</div> : <EmptyState title="Лента пока пуста" body="Начните с первой публикации или загляните в сообщества." action="Создать публикацию" onClick={() => requireUser(() => setDialog('post'))} />}</section>
          <aside className="right-rail"><section className="rail-card ride-card"><div className="rail-heading"><div><span className="eyebrow">НА ЭТИ ВЫХОДНЫЕ</span><h3>Время в путь?</h3></div><span className="rail-icon"><Icon name="route" /></span></div>{trips.slice(0, 1).map((trip) => <div key={trip.id}><div className="mini-route"><span className="route-dot" /><div><strong>{trip.title}</strong><small><Icon name="clock" size={13} /> {formatDate(trip.startsAt).replace(',', ' ·')}</small></div></div><div className="rail-card-footer"><span><Avatar name={trip.organizer.displayName} size="small" /> +{trip._count?.participants ?? 7} райдеров</span><button className="circle-arrow" aria-label="Открыть поездку" onClick={() => setPage('trips')}><Icon name="arrow" size={16} /></button></div></div>)}</section><section className="rail-card club-card"><div className="club-art"><span className="club-mountain"/><span className="club-sun"/><span className="club-wordmark">MINSK<br/>MOTOR<br/>CLUB</span></div><div className="club-card-content"><span className="eyebrow">СООБЩЕСТВО НЕДЕЛИ</span><h3>{communities[0]?.name ?? 'Мотоклуб Минск'}</h3><p>{communities[0]?.description}</p><div className="club-footer"><span><Icon name="users" size={15} /> {communities[0]?._count?.members ?? 248} участников</span><button className="text-button" onClick={() => setPage('communities')}>Открыть <Icon name="arrow" size={14} /></button></div></div></section><div className="weather-note"><span className="note-icon">✦</span><p><strong>Дорога зовёт</strong><br/>Сегодня сухо — отличный повод выбраться за город.</p><button className="text-button" onClick={() => setPage('map')}>Посмотреть карту <Icon name="arrow" size={14} /></button></div></aside></div>}

        {page === 'communities' && <section className="section-content">{selectedCommunity && <article className="community-detail"><button className="text-button" onClick={() => setSelectedCommunity(null)}>{'\u2190 \u041a \u0441\u043f\u0438\u0441\u043a\u0443 \u0441\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432'}</button><h2>{selectedCommunity.name}</h2><p>{selectedCommunity.description}</p><div className="community-meta"><span>{selectedCommunity.city}</span><span>{communityPosts.length} {'\u043f\u0443\u0431\u043b\u0438\u043a\u0430\u0446\u0438\u0439'}</span></div><button className="button button-outline" onClick={() => requireUser(async () => { try { await api(`/api/communities/${selectedCommunity.id}/${communityJoined ? 'membership' : 'join'}`, { method: communityJoined ? 'DELETE' : 'POST' }); setCommunityJoined(!communityJoined); setNotice(communityJoined ? '\u0412\u044b \u043f\u043e\u043a\u0438\u043d\u0443\u043b\u0438 \u0441\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432\u043e' : '\u0412\u044b \u0432\u0441\u0442\u0443\u043f\u0438\u043b\u0438 \u0432 \u0441\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432\u043e') } catch (err) { setNotice(err instanceof Error ? err.message : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0443\u0447\u0430\u0441\u0442\u0438\u0435') } })}>{communityJoined ? '\u041f\u043e\u043a\u0438\u043d\u0443\u0442\u044c \u0441\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432\u043e' : '\u0412\u0441\u0442\u0443\u043f\u0438\u0442\u044c \u0432 \u0441\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432\u043e'}</button><button className="button button-primary" onClick={() => requireUser(() => { setDialogCommunityId(selectedCommunity.id); setDialog('post') })}>{'\u041d\u0430\u043f\u0438\u0441\u0430\u0442\u044c \u0432 \u0441\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432\u043e'}</button><div className="post-list">{communityPosts.map((post) => <article className="post-card" key={post.id}><strong>{post.author.displayName}</strong><time>{formatDate(post.createdAt)}</time><p>{post.content}</p></article>)}</div></article>}<div className="toolbar-row"><label className="inline-search"><Icon name="search" size={17} /><input placeholder="Найти сообщество" value={search} onChange={(e) => setSearch(e.target.value)} /></label><span className="muted">{communities.length} сообществ рядом</span></div><div className="community-grid">{communities.filter((item) => `${item.name} ${item.city} ${item.description}`.toLowerCase().includes(search.toLowerCase())).map((community, index) => <article className="community-card" key={community.id}><div className={`community-cover community-cover-${index % 3}`}><span className="cover-stamp">{index === 0 ? 'M' : index === 1 ? 'R' : 'C'}</span><span>{community.city || 'Беларусь'}</span></div><div className="community-card-body"><span className="eyebrow">{index === 1 ? 'ПОЕЗДКИ И ТУРИНГ' : index === 2 ? 'ТЕХНИКА И КУЛЬТУРА' : 'ГОРОДСКОЕ СООБЩЕСТВО'}</span><h3><button className="text-button" onClick={() => { setSelectedCommunity(community); setCommunityJoined(false) }}>{community.name}</button></h3><p>{community.description}</p><div className="community-meta"><span><Icon name="users" size={15}/>{community._count?.members ?? 0} участников</span><span>{community._count?.posts ?? 0} записей</span></div><button className="button button-outline button-wide" onClick={() => requireUser(async () => { try { await api(`/api/communities/${community.id}/join`, { method: 'POST' }); setNotice('Вы вступили в сообщество') } catch (err) { setNotice(err instanceof Error ? err.message : 'Не удалось вступить') } })}>Вступить в сообщество <Icon name="arrow" size={16}/></button></div></article>)}</div>{communities.length === 0 && <EmptyState title="Сообществ пока нет" body="Создайте первое сообщество для своего города." action="Создать сообщество" onClick={() => requireUser(() => setDialog('community'))} />}</section>}

        {page === 'market' && <section className="section-content"><div className="market-hero"><div><span className="eyebrow">МОТОРЫ · ЭКИПИРОВКА · ДЕТАЛИ</span><h2>Вещи для тех,<br/>кто выбирает дорогу.</h2><p>Объявления от людей, которые тоже ездят.</p></div><div className="market-graphic"><span className="market-wheel wheel-a"/><span className="market-wheel wheel-b"/><span className="market-frame"/><span className="market-light"/></div></div><div className="market-toolbar"><div className="category-tabs">{['Все категории', 'Мотоциклы', 'Экипировка', 'Запчасти'].map((item) => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div><button className="filter-button" onClick={() => setNotice('Поиск фильтрует по названию, описанию и городу')}><Icon name="filter" size={17}/> Фильтры</button></div><div className="listing-grid">{filteredListings.map((listing, index) => <article className="listing-card" key={listing.id}><div className={`listing-art listing-art-${index % 3}`}><span className="listing-category">{listing.category}</span><span className="listing-art-bike"><Icon name="bike" size={76}/></span><button className="listing-save" aria-label="Сохранить объявление" onClick={() => setNotice('Войдите, чтобы добавить в избранное')}><Icon name="heart" size={18}/></button><span className="listing-condition">{listing.condition === 'new' ? 'Новое' : 'С пробегом'}</span></div><div className="listing-body"><h3>{listing.title}</h3><strong className="listing-price">{Number(listing.price).toLocaleString('ru-RU')} BYN</strong><p>{listing.description}</p><div className="listing-meta"><span><Icon name="pin" size={14}/>{listing.city || listing.seller.profile?.city || 'Беларусь'}</span><span><Avatar name={listing.seller.displayName} size="small" />{listing.seller.displayName}</span></div><button className="listing-contact" onClick={() => requireUser(() => setNotice('Диалоги появятся в следующем этапе проекта'))}>Написать продавцу <Icon name="arrow" size={15}/></button>{user?.id === listing.seller.id && <div className="listing-owner-actions"><button className="text-button" onClick={() => { setEditingListing(listing); setDialog('listing') }}>{'\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c'}</button>{listing.status === 'ACTIVE' && <button className="text-button" onClick={async () => { try { const r = await api<{ listing: Listing }>(`/api/listings/${listing.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'CLOSED' }) }); setListings((items) => items.map((item) => item.id === listing.id ? { ...item, ...r.listing } : item)); setNotice('\u041e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u0435 \u0437\u0430\u043a\u0440\u044b\u0442\u043e') } catch (err) { setNotice(err instanceof Error ? err.message : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u043a\u0440\u044b\u0442\u044c \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u0435') } }}>{'\u0417\u0430\u043a\u0440\u044b\u0442\u044c'}</button>}<button className="text-button danger-text" onClick={async () => { try { await api(`/api/listings/${listing.id}`, { method: 'DELETE' }); setListings((items) => items.filter((item) => item.id !== listing.id)); setNotice('\u041e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u043e') } catch (err) { setNotice(err instanceof Error ? err.message : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u0435') } }}>{'\u0423\u0434\u0430\u043b\u0438\u0442\u044c'}</button></div>}</div></article>)}</div>{filteredListings.length === 0 && <EmptyState title="Ничего не найдено" body="Попробуйте изменить категорию или поисковый запрос." action="Сбросить фильтры" onClick={() => {setSearch('');setCategory('Все категории')}} />}</section>}

        {page === 'trips' && <section className="section-content trip-layout"><div className="trip-list"><div className="section-title-row"><div><span className="eyebrow">ПОЕЗДКИ РЯДОМ</span><h2>Выбери направление</h2></div><button className="text-button" onClick={() => setPage('map')}>Открыть карту <Icon name="arrow" size={14}/></button></div>{trips.map((trip, index) => <article className="trip-card" key={trip.id}><div className={`trip-thumb trip-thumb-${index % 2}`}><span>{index === 0 ? '01' : '02'}</span><div className="mini-map-line"/></div><div className="trip-card-body"><div className="trip-date"><Icon name="clock" size={14}/>{formatDate(trip.startsAt)}</div><h3>{trip.title}</h3><p>{trip.description}</p><div className="trip-card-footer"><span><Avatar name={trip.organizer.displayName} size="small"/> Организует {trip.organizer.displayName} · {trip._count?.participants ?? 0} участников</span><button className="button button-primary button-small" onClick={() => requireUser(async () => {try { await api(`/api/trips/${trip.id}/join`, { method: 'POST' });setNotice('Вы присоединились к поездке')} catch (err) {setNotice(err instanceof Error ? err.message : 'Не удалось присоединиться')}})}>Еду с вами</button></div></div></article>)}{trips.length === 0 && <EmptyState title="Поездок пока нет" body="Создайте первую совместную поездку." action="Создать поездку" onClick={() => requireUser(() => setDialog('trip'))}/>}</div><aside className="trip-map-panel"><div className="panel-heading"><div><span className="eyebrow">БЕЛАРУСЬ</span><h3>Рядом на карте</h3></div><button className="icon-button" aria-label="Развернуть карту" onClick={() => setPage('map')}><Icon name="arrow" size={17}/></button></div><MapView places={places} trips={trips}/><button className="text-button map-open" onClick={() => setPage('map')}>Посмотреть все точки <Icon name="arrow" size={14}/></button></aside></section>}

        {page === 'map' && <section className="section-content full-map-section"><div className="map-controls"><div><span className="eyebrow">OPENSTREETMAP</span><h2>Дорога начинается здесь</h2></div><div className="map-filter-pills"><button className="selected">Поездки</button><button className="selected">Полезные места</button></div></div><MapView places={places} trips={trips}/><p className="map-help">Выберите маркер, чтобы увидеть место или остановку маршрута. Карта доступна и без GPS.</p></section>}

        {page === 'garage' && <section className="section-content"><div className="garage-summary"><div className="garage-emblem"><Icon name="bike" size={44}/></div><div><span className="eyebrow">ВАША ТЕХНИКА</span><h2>{motorcycles.length || 0} мотоцикла в гараже</h2><p className="muted">Записывайте технику, чтобы она всегда была под рукой.</p></div><button className="button button-primary" onClick={() => requireUser(() => setDialog('bike'))}><Icon name="plus" size={17}/> Добавить мотоцикл</button></div>{user ? motorcycles.length ? <div className="bike-grid">{motorcycles.map((bike) => <article className="bike-card" key={bike.id}><div className="bike-art"><Icon name="bike" size={65}/></div><span className="eyebrow">МОТОЦИКЛ</span><h3>{bike.make} {bike.model}</h3><p>{bike.year ?? 'Год не указан'}{bike.mileage ? ` · ${bike.mileage.toLocaleString('ru-RU')} км` : ''}</p><button className="text-button" onClick={async () => {try {await api(`/api/motorcycles/${bike.id}`, {method:'DELETE'});setMotorcycles((list) => list.filter((item) => item.id !== bike.id));setNotice('Мотоцикл удалён')} catch (err) {setNotice(err instanceof Error ? err.message : 'Не удалось удалить')}}}>Удалить из гаража</button><button className="text-button" onClick={() => { setEditingBike(bike); setDialog('bike') }}>{'\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c'}</button></article>)}</div> : <EmptyState title="Гараж ждёт первую технику" body="Добавьте мотоцикл, чтобы вести его историю и находить райдеров на похожих моделях." action="Добавить мотоцикл" onClick={() => setDialog('bike')}/> : <div className="login-prompt"><h3>Войдите, чтобы открыть свой гараж</h3><p>Мотоциклы и данные гаража видны только вам.</p><button className="button button-primary" onClick={() => setAuthOpen(true)}>Войти или зарегистрироваться</button></div>}</section>}

        {page === 'profile' && <section className="section-content profile-page">{user ? <><div className="profile-hero"><Avatar name={user.displayName} size="large"/><div><span className="eyebrow">РАЙДЕР MOTОCLUB</span><h2>{user.displayName}</h2><p><Icon name="pin" size={15}/>{user.profile?.city || 'Город не указан'} · {user.profile?.ridingStyle || 'Стиль езды не указан'}</p></div><button className="button button-outline" onClick={() => setDialog('profile')}>Редактировать профиль</button></div><div className="profile-columns"><article className="panel-card"><span className="eyebrow">О СЕБЕ</span><p>{user.profile?.bio || 'Добавьте пару слов о себе и своих поездках.'}</p></article><article className="panel-card"><span className="eyebrow">ГАРАЖ</span><h3>{motorcycles.length} мотоцикла</h3><button className="text-button" onClick={() => setPage('garage')}>Открыть гараж <Icon name="arrow" size={14}/></button></article><article className="panel-card"><span className="eyebrow">АККАУНТ</span><p>{user.email}</p><button className="text-button" onClick={() => void signOut()}>Выйти из аккаунта <Icon name="logout" size={14}/></button></article></div></> : <div className="login-prompt"><h2>Ваш профиль — ваша история</h2><p>Создайте аккаунт, чтобы хранить гараж, публикации и поездки.</p><button className="button button-primary" onClick={() => setAuthOpen(true)}>Создать аккаунт</button></div>}</section>}

        {page === 'friends' && <section className="section-content">{user ? <><div className="section-title-row"><div><span className="eyebrow">ВАШ КРУГ</span><h2>{friends.length} друзей</h2></div></div>{friendRequests.length > 0 && <div className="friend-requests"><h3>{'\u0412\u0445\u043e\u0434\u044f\u0449\u0438\u0435 \u0437\u0430\u044f\u0432\u043a\u0438'}</h3>{friendRequests.map((request) => <article className="friend-card" key={request.id}><Avatar name={request.sender.displayName}/><strong>{request.sender.displayName}</strong><button className="button button-primary" onClick={async () => { try { await api(`/api/friend-requests/${request.id}/respond`, { method: 'POST', body: JSON.stringify({ status: 'accept' }) }); setFriendRequests((items) => items.filter((item) => item.id !== request.id)); setFriends((items) => [...items, request.sender]) } catch (err) { setNotice(err instanceof Error ? err.message : 'Request failed') } }}>{'\u041f\u0440\u0438\u043d\u044f\u0442\u044c'}</button><button className="text-button" onClick={async () => { try { await api(`/api/friend-requests/${request.id}/respond`, { method: 'POST', body: JSON.stringify({ status: 'decline' }) }); setFriendRequests((items) => items.filter((item) => item.id !== request.id)) } catch (err) { setNotice(err instanceof Error ? err.message : 'Request failed') } }}>{'\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c'}</button></article>)}</div>}<div className="friend-directory"><h3>{'\u041d\u0430\u0439\u0442\u0438 \u0440\u0430\u0439\u0434\u0435\u0440\u043e\u0432'}</h3><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search riders" />{riders.map((rider) => <article className="friend-card" key={rider.id}><Avatar name={rider.displayName}/><div><strong>{rider.displayName}</strong><small>{rider.profile?.city || ''}</small></div><button className="button button-outline" onClick={async () => { try { await api(`/api/friend-requests/${rider.id}`, { method: 'POST' }); setRiders((items) => items.filter((item) => item.id !== rider.id)); setNotice('Request sent') } catch (err) { setNotice(err instanceof Error ? err.message : 'Request failed') } }}>{'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c'}</button></article>)}</div>{friends.length ? <div className="friend-grid">{friends.map((friend) => <article className="friend-card" key={friend.id}><Avatar name={friend.displayName} size="large"/><div><strong>{friend.displayName}</strong><small>{friend.profile?.city || 'Райдер MotoClub'}</small></div><button className="icon-button" aria-label={`Написать ${friend.displayName}`} onClick={() => setNotice('Личные сообщения появятся в следующем этапе')}><Icon name="chat"/></button></article>)}</div> : <EmptyState title="Ваш круг только начинается" body="Откройте ленту и сообщества, чтобы познакомиться с райдерами." action="Перейти в ленту" onClick={() => setPage('feed')}/>}</> : <div className="login-prompt"><h2>Поездки лучше вместе</h2><p>Войдите в аккаунт, чтобы видеть список друзей и заявки.</p><button className="button button-primary" onClick={() => setAuthOpen(true)}>Войти</button></div>}</section>}
      </div>
      <footer className="app-footer"><span>© 2026 MotoClub</span><span>Сделано для тех, кто выбирает дорогу.</span><button className="text-button" onClick={() => setNotice('Помощь: hello@motoclub.by')}>Помощь и правила</button></footer>
    </main>

    {dialog && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) {setDialog(null);setEditingPost(null);setEditingListing(null);setEditingBike(null);setDialogCommunityId(null)} }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="form-title"><button className="icon-button dialog-close" onClick={() => {setDialog(null);setEditingPost(null);setEditingListing(null);setEditingBike(null);setDialogCommunityId(null)}} aria-label="Закрыть"><Icon name="close"/></button><span className="eyebrow">MOTOCLUB</span><h2 id="form-title">{dialog === 'post' ? editingPost ? 'Изменить публикацию' : 'Новая публикация' : dialog === 'listing' ? 'Новое объявление' : dialog === 'community' ? 'Новое сообщество' : dialog === 'trip' ? 'Новая поездка' : dialog === 'profile' ? 'Ваш профиль' : 'Мотоцикл в гараж'}</h2><form className="form-stack" onSubmit={async (event) => {
      if (dialog === 'post') await saveForm(event, '/api/posts', (r) => { if (r.post) {setPosts((items) => editingPost ? items.map((item) => item.id === r.post.id ? { ...item, ...r.post, author: item.author } : item) : [r.post, ...items]);setCommunityPosts((items) => editingPost ? items.map((item) => item.id === r.post.id ? { ...item, ...r.post, author: item.author } : item) : dialogCommunityId ? [r.post, ...items] : items)} }, dialogCommunityId && !editingPost ? { communityId: dialogCommunityId } : {})
      if (dialog === 'listing') await saveForm(event, '/api/listings', (r) => { if (r.listing) setListings((items) => editingListing ? items.map((item) => item.id === r.listing.id ? { ...item, ...r.listing } : item) : [r.listing, ...items]) })
      if (dialog === 'community') await saveForm(event, '/api/communities', (r) => { if (r.community) {setCommunities((items) => [r.community, ...items]);setPage('communities')} })
      if (dialog === 'trip') {
        event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
        try { const r = await api<{trip: Trip}>('/api/trips', { method: 'POST', body: JSON.stringify({ title: values.title, description: values.description, startsAt: new Date(String(values.startsAt)).toISOString(), waypoints: [{ label: values.start, latitude: Number(values.startLat), longitude: Number(values.startLng) }, { label: values.end, latitude: Number(values.endLat), longitude: Number(values.endLng) }] }) }); setTrips((items) => [r.trip, ...items]); setDialog(null); setPage('trips'); setNotice('Поездка опубликована') } catch (err) { setNotice(err instanceof Error ? err.message : 'Не удалось создать поездку') }
      }
      if (dialog === 'bike') {
        event.preventDefault(); const form = event.currentTarget;
        try { const r = await api<{motorcycle: Motorcycle}>(editingBike ? `/api/motorcycles/${editingBike.id}` : '/api/motorcycles', { method: editingBike ? 'PATCH' : 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); setMotorcycles((items) => editingBike ? items.map((item) => item.id === r.motorcycle.id ? r.motorcycle : item) : [r.motorcycle, ...items]); setDialog(null); setEditingBike(null); setPage('garage'); setNotice('Мотоцикл добавлен в гараж') } catch (err) { setNotice(err instanceof Error ? err.message : 'Не удалось сохранить мотоцикл') }
      }
      if (dialog === 'profile') {
        event.preventDefault(); const form = event.currentTarget;
        try { const r = await api<{user: User}>('/api/profile', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); setUser(r.user); setDialog(null); setNotice('Профиль обновлён') } catch (err) { setNotice(err instanceof Error ? err.message : 'Не удалось обновить профиль') }
      }
    }}>
      {dialog === 'post' && <><label>{editingPost ? 'Изменить публикацию' : 'Текст публикации'}<textarea name="content" required maxLength={2000} rows={5} placeholder="Чем хочется поделиться с райдерами?" defaultValue={editingPost?.content}/></label><div className="form-hint">До 2000 символов · Безопасно делиться маршрутом можно после поездки</div></>}
      {dialog === 'listing' && <><label>Название<input name="title" minLength={4} maxLength={120} required placeholder="Например, Yamaha MT-07, 2020" defaultValue={editingListing?.title}/></label><div className="form-two"><label>Категория<select name="category" required defaultValue="Мотоциклы"><option>Мотоциклы</option><option>Экипировка</option><option>Запчасти</option></select></label><label>Цена, BYN<input name="price" type="number" min="0" max="999999999" required placeholder="12500" defaultValue={editingListing?.price ?? ''}/></label></div><div className="form-two"><label>Состояние<select name="condition" defaultValue={editingListing?.condition ?? "used"}><option value="used">С пробегом</option><option value="new">Новое</option><option value="for-parts">На запчасти</option></select></label><label>Город<input name="city" maxLength={100} placeholder="Минск" defaultValue={editingListing?.city ?? ''}/></label></div><label>Описание<textarea name="description" maxLength={3000} rows={3} placeholder="Расскажите о состоянии и особенностях" defaultValue={editingListing?.description}/></label></>}
      {dialog === 'community' && <><label>Название<input name="name" minLength={3} maxLength={80} required placeholder="Например, Туринг Беларусь"/></label><label>Город<input name="city" maxLength={100} placeholder="Минск"/></label><label>О сообществе<textarea name="description" maxLength={1000} rows={4} placeholder="Для кого это сообщество?"/></label></>}
      {dialog === 'trip' && <><label>Название поездки<input name="title" minLength={4} maxLength={120} required placeholder="Минск — Нарочь"/></label><label>Дата и время<input name="startsAt" type="datetime-local" required/></label><div className="form-two"><label>Откуда<input name="start" required placeholder="Минск"/></label><label>Куда<input name="end" required placeholder="Нарочь"/></label></div><details className="coordinates-details"><summary>Добавить точки на карту</summary><div className="form-two"><label>Старт · широта<input name="startLat" type="number" step="any" defaultValue="53.9" required/></label><label>Старт · долгота<input name="startLng" type="number" step="any" defaultValue="27.56" required/></label><label>Финиш · широта<input name="endLat" type="number" step="any" defaultValue="54.9" required/></label><label>Финиш · долгота<input name="endLng" type="number" step="any" defaultValue="26.7" required/></label></div></details><label>Описание<textarea name="description" maxLength={2000} rows={3} placeholder="Темп, остановки и что взять с собой"/></label></>}
      {dialog === 'bike' && <><div className="form-two"><label>Марка<input name="make" required maxLength={60} placeholder="Honda" defaultValue={editingBike?.make}/></label><label>Модель<input name="model" required maxLength={80} placeholder="CB650R" defaultValue={editingBike?.model}/></label></div><div className="form-two"><label>Год<input name="year" type="number" min="1885" max={new Date().getFullYear() + 1} placeholder="2021" defaultValue={editingBike?.year ?? ''}/></label><label>Пробег, км<input name="mileage" type="number" min="0" placeholder="12500" defaultValue={editingBike?.mileage ?? ''}/></label></div></>}
      {dialog === 'profile' && <><label>Имя<input name="displayName" minLength={2} maxLength={60} required defaultValue={user?.displayName}/></label><label>Город<input name="city" maxLength={100} defaultValue={user?.profile?.city}/></label><label>Стиль езды<input name="ridingStyle" maxLength={80} defaultValue={user?.profile?.ridingStyle} placeholder="Туринг, город, эндуро…"/></label><label>О себе<textarea name="bio" rows={3} maxLength={500} defaultValue={user?.profile?.bio}/></label></>}
      <button className="button button-primary button-wide" type="submit">{dialog === 'post' ? editingPost ? 'Сохранить изменения' : 'Опубликовать' : dialog === 'listing' ? 'Разместить объявление' : dialog === 'community' ? 'Создать сообщество' : dialog === 'trip' ? 'Опубликовать поездку' : dialog === 'profile' ? 'Сохранить профиль' : 'Добавить в гараж'}</button></form></section></div>}
    {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onSuccess={(nextUser) => {setUser(nextUser);setAuthOpen(false);setNotice(`Добро пожаловать, ${nextUser.displayName}`);void refresh()}}/>}
    {notice && <div className="toast" role="status"><span className="toast-check">✓</span>{notice}<button className="icon-button" aria-label="Закрыть уведомление" onClick={() => setNotice('')}><Icon name="close" size={16}/></button></div>}
    {loading && <span className="sync-indicator" aria-label="Обновление данных"><i/></span>}
  </div>
}

function EmptyState({ title, body, action, onClick }: { title: string; body: string; action: string; onClick: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="route" size={25}/></span><h3>{title}</h3><p>{body}</p><button className="button button-outline" onClick={onClick}>{action} <Icon name="arrow" size={15}/></button></div>
}

export default App
