import './reference-social.css'
import Icon from '../shared/Icon'
import ReportButton from '../features/reports/ReportButton'
import { t, useLocale, formatCurrency } from '../shared/i18n'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { formObject, type Listing } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'

const categories = ['Все категории', 'Мотоциклы', 'Экипировка', 'Запчасти']

type MarketListing = Listing & { isFavorite?: boolean }

export default function MarketPage() {
  useLocale()
  const { user, loading } = useAuth()
  const [params, setParams] = useSearchParams()
  const favorites = params.get('favorites') === '1'
  if (loading) return <LoadingState/>
  return <MarketCatalog key={`${user?.id ?? 'guest'}:${favorites}`} favorites={favorites} setFavorites={value => setParams(value ? { favorites: '1' } : {})}/>
}

function MarketCatalog({ favorites, setFavorites }: { favorites: boolean; setFavorites: (value: boolean) => void }) {
  useLocale()
  const { user } = useAuth()
  const navigate = useNavigate()
  const creator = useRef<HTMLDetailsElement>(null)
  function openCreator() { if (creator.current) { creator.current.open = true; creator.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); requestAnimationFrame(() => creator.current?.querySelector('input')?.focus()) } }
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
    if (!window.confirm(t("Удалить объявление?"))) return
    try { await api(`/api/listings/${listing.id}`, { method: 'DELETE' }); setListings((items) => items.filter((item) => item.id !== listing.id)) }
    catch (err) { setError(getErrorMessage(err)) }
  }

  if (favorites && !user) return <EmptyState title={t("Избранное")} description={t("Войдите, чтобы увидеть сохранённые объявления.")} action={<Link className="button button-primary" to="/login">{t("Войти")}</Link>}/>
  return <>
    <div className="mc-social-heading"><PageTitle eyebrow={t("Объявления райдеров")} title={favorites ? t("Избранное") : t("Мотобарахолка")} description={favorites ? t("Объявления, которые вы сохранили.") : t("Ищите мотоциклы, экипировку и запчасти по названию и городу.")} action={user && !favorites && <button className="button button-primary" onClick={() => { setEditing(null); openCreator() }}><span aria-hidden="true">+</span>{t("Разместить объявление")}</button>}/></div>
    <section className="panel market-controls mc-market-filters"><label className="search-field"><span>{t("Поиск")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Например, шлем или Минск")}/></label><label className="search-field"><span>{t("Категория")}</span><select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item} value={item}>{t(item)}</option>)}</select></label></section>
    <div className="personal-filters mc-market-tabs" aria-label={t("Раздел маркета")}>{([{ label: t("Все объявления"), isFavorite: false }, { label: t("Избранное"), isFavorite: true }]).map(({ label, isFavorite }) => <button key={String(label)} className="category-chip" type="button" aria-pressed={isFavorite === favorites} onClick={() => { if (isFavorite !== favorites) { setLoading(true); setFavorites(isFavorite) } }}>{label}</button>)}</div>
    {user && !favorites && <details className="panel create-panel" ref={creator}><summary>{editing ? t("Изменить объявление") : t("Разместить объявление")}</summary><form className="form-grid" key={editing?.id ?? 'new'} onSubmit={save}><label className="field-wide">{t("Название")}<input name="title" required minLength={4} maxLength={120} defaultValue={editing?.title}/></label><label>{t("Категория")}<select name="category" defaultValue={editing?.category ?? 'Мотоциклы'}>{categories.slice(1).map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></label><label>{t("Цена, BYN")}<input name="price" type="number" min="0" required defaultValue={editing?.price}/></label><label>{t("Состояние")}<select name="condition" defaultValue={editing?.condition ?? 'used'}><option value="new">{t("Новое")}</option><option value="used">{t("С пробегом")}</option><option value="for-parts">{t("На запчасти")}</option></select></label><label>{t("Город")}<input name="city" maxLength={100} defaultValue={editing?.city}/></label><label className="field-wide">{t("Описание")}<textarea name="description" maxLength={3000} rows={3} defaultValue={editing?.description}/></label><div className="form-buttons"><button className="button button-primary" disabled={busy}>{busy ? t("Сохраняю…") : editing ? t("Сохранить") : t("Разместить")}</button>{editing && <button type="button" className="button button-quiet" onClick={() => setEditing(null)}>{t("Отмена")}</button>}</div></form></details>}
    {error && <ErrorState message={error} onRetry={() => void load()}/>}
    {loading ? <LoadingState/> : loadFailed ? null : listings.length === 0 ? <EmptyState title={favorites ? t("Нет сохранённых объявлений") : t("Объявлений не найдено")} description={favorites ? t("Сохраняйте объявления из маркета, чтобы вернуться к ним позже.") : t("Попробуйте другой запрос или категорию.")}/> : <div className="card-grid listing-grid mc-social-grid">{listings.map((listing) => <article className="panel listing-card mc-listing-card" key={listing.id}><div className="mc-listing-art" aria-hidden="true"><Icon name={listing.category === 'Мотоциклы' ? 'bike' : 'listing'} size={90}/></div><div className="mc-card-body"><div className="listing-top"><span className="eyebrow">{t(listing.category)}</span><span className="listing-state">{listing.status === 'CLOSED' ? t("Закрыто") : listing.condition === 'new' ? t("Новое") : listing.condition === 'used' ? t("С пробегом") : t("На запчасти")}</span></div><h2>{listing.title}</h2><strong className="listing-price">{formatCurrency(Number(listing.price))}</strong><p>{listing.description || t("Описание не добавлено.")}</p><div className="listing-meta"><span>{listing.city || listing.seller.profile?.city || t("Беларусь")}</span><span>{t("Продавец:")}{' '}{listing.seller.displayName}</span></div><div className="card-actions"><button type="button" className="button button-secondary" aria-pressed={Boolean(favorites || listing.isFavorite)} disabled={favoriteBusy} onClick={() => void toggleFavorite(listing)}>{favorites || listing.isFavorite ? t("Убрать из избранного") : t("Сохранить в избранное")}</button></div>{user && user.id !== listing.seller.id && <div className="card-actions"><ReportButton targetType="LISTING" targetId={listing.id}/><Link className="button button-secondary" to={`/messages/${listing.seller.id}`}>{t("Написать продавцу")}</Link></div>}{!favorites && user?.id === listing.seller.id && <div className="card-actions"><button className="button button-quiet" onClick={() => { setEditing(listing); openCreator() }}>{t("Изменить")}</button><button className="button button-quiet" onClick={() => void closeListing(listing)}>{t("Закрыть")}</button><button className="button button-danger-quiet" onClick={() => void deleteListing(listing)}>{t("Удалить")}</button></div>}</div></article>)}</div>}
  </>
}
