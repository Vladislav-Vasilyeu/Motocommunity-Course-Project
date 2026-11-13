import { Link } from 'react-router'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { formObject, type Listing } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'

const categories = ['Все категории', 'Мотоциклы', 'Экипировка', 'Запчасти']

export default function MarketPage() {
  const { user } = useAuth()
  const [listings, setListings] = useState<Listing[]>([]); const [query, setQuery] = useState(''); const [category, setCategory] = useState('Все категории')
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [editing, setEditing] = useState<Listing | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const params = new URLSearchParams(); if (query.trim()) params.set('q', query.trim()); if (category !== 'Все категории') params.set('category', category); setListings((await api<{ listings: Listing[] }>(`/api/listings?${params}`)).listings) }
    catch (err) { setError(getErrorMessage(err)) } finally { setLoading(false) }
  }, [category, query])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 280); return () => window.clearTimeout(timer) }, [load])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) { window.location.assign('/login'); return }
    setBusy(true); setError(''); const form = event.currentTarget
    try {
      const result = editing
        ? await api<{ listing: Listing }>(`/api/listings/${editing.id}`, { method: 'PATCH', body: JSON.stringify(formObject(form)) })
        : await api<{ listing: Listing }>('/api/listings', { method: 'POST', body: JSON.stringify(formObject(form)) })
      setListings((items) => editing ? items.map((item) => item.id === result.listing.id ? result.listing : item) : [result.listing, ...items])
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

  return <>
    <PageTitle eyebrow="Объявления райдеров" title="Мотобарахолка" description="Ищите мотоциклы, экипировку и запчасти по названию и городу."/>
    <section className="panel market-controls"><label className="search-field"><span>Поиск</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Например, шлем или Минск"/></label><div className="category-list" aria-label="Категории">{categories.map((item) => <button key={item} className={`category-chip${item === category ? ' selected' : ''}`} onClick={() => setCategory(item)} aria-pressed={item === category}>{item}</button>)}</div></section>
    {user && <details className="panel create-panel" open={Boolean(editing)}><summary>{editing ? 'Изменить объявление' : 'Разместить объявление'}</summary><form className="form-grid" key={editing?.id ?? 'new'} onSubmit={save}><label className="field-wide">Название<input name="title" required minLength={4} maxLength={120} defaultValue={editing?.title}/></label><label>Категория<select name="category" defaultValue={editing?.category ?? 'Мотоциклы'}>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>Цена, BYN<input name="price" type="number" min="0" required defaultValue={editing?.price}/></label><label>Состояние<select name="condition" defaultValue={editing?.condition ?? 'used'}><option value="new">Новое</option><option value="used">С пробегом</option><option value="for-parts">На запчасти</option></select></label><label>Город<input name="city" maxLength={100} defaultValue={editing?.city}/></label><label className="field-wide">Описание<textarea name="description" maxLength={3000} rows={3} defaultValue={editing?.description}/></label><div className="form-buttons"><button className="button button-primary" disabled={busy}>{busy ? 'Сохраняю…' : editing ? 'Сохранить' : 'Разместить'}</button>{editing && <button type="button" className="button button-quiet" onClick={() => setEditing(null)}>Отмена</button>}</div></form></details>}
    {error && <ErrorState message={error} onRetry={load}/>}
    {loading ? <LoadingState/> : listings.length === 0 ? <EmptyState title="Объявлений не найдено" description="Попробуйте другой запрос или категорию."/> : <div className="card-grid listing-grid">{listings.map((listing) => <article className="panel listing-card" key={listing.id}><div className="listing-top"><span className="eyebrow">{listing.category}</span><span className="listing-state">{listing.condition === 'new' ? 'Новое' : listing.condition === 'used' ? 'С пробегом' : 'На запчасти'}</span></div><h2>{listing.title}</h2><strong className="listing-price">{Number(listing.price).toLocaleString('ru-RU')} BYN</strong><p>{listing.description || 'Описание не добавлено.'}</p><div className="listing-meta"><span>{listing.city || listing.seller.profile?.city || 'Беларусь'}</span><span>Продавец: {listing.seller.displayName}</span></div>{user && user.id !== listing.seller.id && <div className="card-actions"><Link className="button button-secondary" to={`/messages/${listing.seller.id}`}>Написать продавцу</Link></div>}{user?.id === listing.seller.id && <div className="card-actions"><button className="button button-quiet" onClick={() => { setEditing(listing); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Изменить</button><button className="button button-quiet" onClick={() => void closeListing(listing)}>Закрыть</button><button className="button button-danger-quiet" onClick={() => void deleteListing(listing)}>Удалить</button></div>}</article>)}</div>}
  </>
}
