import { Link, useNavigate, useSearchParams } from 'react-router'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { formObject, type Listing } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'

const categories = ['Все категории', 'Мотоциклы', 'Экипировка', 'Запчасти']

type MarketListing = Listing & { isFavorite?: boolean }

export default function MarketPage() {
  const { user, loading } = useAuth()
  const [params, setParams] = useSearchParams()
  const favorites = params.get('favorites') === '1'
  if (loading) return <LoadingState/>
  return <MarketCatalog key={`${user?.id ?? 'guest'}:${favorites}`} favorites={favorites} setFavorites={value => setParams(value ? { favorites: '1' } : {})}/>
}

function MarketCatalog({ favorites, setFavorites }: { favorites: boolean; setFavorites: (value: boolean) => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [favoriteBusy, setFavoriteBusy] = useState(false)
  const [listings, setListings] = useState<MarketListing[]>([]); const [query, setQuery] = useState(''); const [category, setCategory] = useState('Все категории')
  const [loadFailed, setLoadFailed] = useState(false)
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [editing, setEditing] = useState<Listing | null>(null)
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setLoadFailed(false); setError('')
    try {
      const filters = new URLSearchParams()
      if (query.trim()) filters.set('q', query.trim())
      if (category !== 'Все категории') filters.set('category', category)
      const path = favorites ? '/api/listings/favorites' : '/api/listings'
      const data = await api<{ listings: MarketListing[] }>(`${path}?${filters}`, { signal })
      if (!signal?.aborted) setListings(data.listings)
    } catch (cause) { if (!signal?.aborted) { setListings([]); setLoadFailed(true); setError(getErrorMessage(cause)) } }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [category, query, favorites])
  useEffect(() => {
    if (favorites && !user) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => void load(controller.signal), 280)
    return () => { clearTimeout(timer); controller.abort() }
  }, [load, favorites, user])

  async function toggleFavorite(listing: MarketListing) {
    if (!user) { navigate('/login'); return }
    if (favoriteBusy) return
    const adding = !favorites && !listing.isFavorite
    setFavoriteBusy(true)
    setError('')
    try {
      await api(`/api/listings/${encodeURIComponent(listing.id)}/favorite`, { method: adding ? 'PUT' : 'DELETE' })
      setListings(items => favorites ? items.filter(item => item.id !== listing.id) : items.map(item => item.id === listing.id ? { ...item, isFavorite: adding } : item))
    } catch (cause) { setError(getErrorMessage(cause)) }
    finally { setFavoriteBusy(false) }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) { navigate('/login'); return }
    setBusy(true); setError(''); const form = event.currentTarget
    try {
      const result = editing
        ? await api<{ listing: Listing }>(`/api/listings/${editing.id}`, { method: 'PATCH', body: JSON.stringify(formObject(form)) })
        : await api<{ listing: Listing }>('/api/listings', { method: 'POST', body: JSON.stringify(formObject(form)) })
      setListings((items) => editing ? items.map((item) => item.id === result.listing.id ? { ...result.listing, isFavorite: item.isFavorite } : item) : [result.listing, ...items])
      setEditing(null); form.reset()
    } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) }
  }

  async function closeListing(listing: Listing) {
    try { await api(`/api/listings/${listing.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'CLOSED' }) }); setListings((items) => items.filter((item) => item.id !== listing.id)) }
    catch (err) { setError(getErrorMessage(err)) }
  }
  async function deleteListing(listing: Listing) {
    if (!window.confirm('Удалить объявление?')) return
    try { await api(`/api/listings/${listing.id}`, { method: 'DELETE' }); setListings((items) => items.filter((item) => item.id !== listing.id)) }
    catch (err) { setError(getErrorMessage(err)) }
  }

  if (favorites && !user) return <EmptyState title="Избранное" description="Войдите, чтобы увидеть сохранённые объявления." action={<Link className="button button-primary" to="/login">Войти</Link>}/>
  return <>
    <PageTitle eyebrow="Объявления райдеров" title={favorites ? "Избранное" : "Мотобарахолка"} description={favorites ? "Объявления, которые вы сохранили." : "Ищите мотоциклы, экипировку и запчасти по названию и городу."}/>
    <div className="personal-filters" aria-label="Раздел маркета">{([{ label: 'Все объявления', isFavorite: false }, { label: 'Избранное', isFavorite: true }]).map(({ label, isFavorite }) =>
      <button key={String(label)} className="category-chip" type="button" aria-pressed={isFavorite === favorites} onClick={() => { if (isFavorite !== favorites) { setLoading(true); setFavorites(isFavorite) } }}>{label}</button>)}</div>
    <section className="panel market-controls"><label className="search-field"><span>Поиск</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Например, шлем или Минск"/></label><div className="category-list" aria-label="Категории">{categories.map((item) => <button key={item} className={`category-chip${item === category ? ' selected' : ''}`} onClick={() => setCategory(item)} aria-pressed={item === category}>{item}</button>)}</div></section>
    {user && !favorites && <details className="panel create-panel" open={Boolean(editing)}><summary>{editing ? 'Изменить объявление' : 'Разместить объявление'}</summary><form className="form-grid" key={editing?.id ?? 'new'} onSubmit={save}><label className="field-wide">Название<input name="title" required minLength={4} maxLength={120} defaultValue={editing?.title}/></label><label>Категория<select name="category" defaultValue={editing?.category ?? 'Мотоциклы'}>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>Цена, BYN<input name="price" type="number" min="0" required defaultValue={editing?.price}/></label><label>Состояние<select name="condition" defaultValue={editing?.condition ?? 'used'}><option value="new">Новое</option><option value="used">С пробегом</option><option value="for-parts">На запчасти</option></select></label><label>Город<input name="city" maxLength={100} defaultValue={editing?.city}/></label><label className="field-wide">Описание<textarea name="description" maxLength={3000} rows={3} defaultValue={editing?.description}/></label><div className="form-buttons"><button className="button button-primary" disabled={busy}>{busy ? 'Сохраняю…' : editing ? 'Сохранить' : 'Разместить'}</button>{editing && <button type="button" className="button button-quiet" onClick={() => setEditing(null)}>Отмена</button>}</div></form></details>}
    {error && <ErrorState message={error} onRetry={() => void load()}/>}
    {loading ? <LoadingState/> : loadFailed ? null : listings.length === 0 ? <EmptyState title={favorites ? "Нет сохранённых объявлений" : "Объявлений не найдено"} description={favorites ? "Сохраняйте объявления из маркета, чтобы вернуться к ним позже." : "Попробуйте другой запрос или категорию."}/> : <div className="card-grid listing-grid">{listings.map((listing) => <article className="panel listing-card" key={listing.id}><div className="listing-top"><span className="eyebrow">{listing.category}</span><span className="listing-state">{listing.status === 'CLOSED' ? 'Закрыто' : listing.condition === 'new' ? 'Новое' : listing.condition === 'used' ? 'С пробегом' : 'На запчасти'}</span></div><h2>{listing.title}</h2><strong className="listing-price">{Number(listing.price).toLocaleString('ru-RU')} BYN</strong><p>{listing.description || 'Описание не добавлено.'}</p><div className="listing-meta"><span>{listing.city || listing.seller.profile?.city || 'Беларусь'}</span><span>Продавец: {listing.seller.displayName}</span></div><div className="card-actions"><button type="button" className="button button-secondary" aria-pressed={Boolean(favorites || listing.isFavorite)} disabled={favoriteBusy} onClick={() => void toggleFavorite(listing)}>{favorites || listing.isFavorite ? 'Убрать из избранного' : 'Сохранить в избранное'}</button></div>{user && user.id !== listing.seller.id && <div className="card-actions"><Link className="button button-secondary" to={`/messages/${listing.seller.id}`}>Написать продавцу</Link></div>}{!favorites && user?.id === listing.seller.id && <div className="card-actions"><button className="button button-quiet" onClick={() => { setEditing(listing); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Изменить</button><button className="button button-quiet" onClick={() => void closeListing(listing)}>Закрыть</button><button className="button button-danger-quiet" onClick={() => void deleteListing(listing)}>Удалить</button></div>}</article>)}</div>}
  </>
}
