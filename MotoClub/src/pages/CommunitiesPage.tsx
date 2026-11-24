import './reference-social.css'
import Icon from '../shared/Icon'
import { t, useLocale, countLabel } from '../shared/i18n'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { formObject, type Community } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'

export default function CommunitiesPage() {
  useLocale()
  const { user } = useAuth(); const navigate = useNavigate()
  const creator = useRef<HTMLDetailsElement>(null)
  function openCreator() { if (creator.current) { creator.current.open = true; creator.current.querySelector('input')?.focus() } }
  const [items, setItems] = useState<Community[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [query, setQuery] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setItems((await api<{ communities: Community[] }>('/api/communities')).communities) } catch (err) { setError(getErrorMessage(err)) } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!user) { navigate('/login'); return }; const form = event.currentTarget; setBusy(true); setError(''); try { const result = await api<{ community: Community }>('/api/communities', { method: 'POST', body: JSON.stringify(formObject(form)) }); setItems((current) => [result.community, ...current]); form.reset() } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) } }
  const filtered = items.filter((item) => `${item.name} ${item.city} ${item.description}`.toLowerCase().includes(query.toLowerCase()))
  return <>
    <div className="mc-social-heading"><PageTitle eyebrow={t("Сообщество")} title={t("Клубы и группы")} description={t("Находите райдеров рядом и присоединяйтесь к клубам по интересам.")} action={user && <button className="button button-primary" onClick={openCreator}><span aria-hidden="true">+</span>{t("Создать клуб")}</button>}/></div>
    <div className="mc-social-toolbar"><label className="search-field"><span>{t("Поиск клубов")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Название или город")}/></label><span className="result-count mc-result-count">{countLabel(filtered.length, 'club')}</span></div>
    {user && <details className="panel create-panel" ref={creator}><summary>{t("Создать клуб")}</summary><form className="form-grid" onSubmit={create}><label>{t("Название")}<input name="name" required minLength={3} maxLength={80}/></label><label>{t("Город")}<input name="city" maxLength={100}/></label><label className="field-wide">{t("Описание")}<textarea name="description" maxLength={1000} rows={3}/></label><button className="button button-primary" disabled={busy}>{busy ? t("Создаю…") : t("Создать клуб")}</button></form></details>}
    {error && <ErrorState message={error} onRetry={load}/>}
    {loading ? <LoadingState/> : filtered.length === 0 ? <EmptyState title={t("Клубы не найдены")} description={query ? t("Измените поисковый запрос.") : t("Создайте первый клуб для своего города.")}/> : <div className="card-grid mc-social-grid">{filtered.map((item) => <article className="panel community-card mc-community-card" key={item.id}><div className="mc-community-art" aria-hidden="true"><Icon name="users" size={64}/><span>{item.name.slice(0, 2).toUpperCase()}</span></div><div className="mc-card-body"><p className="eyebrow">{item.city || 'MotoClub'}</p><h2><Link to={`/communities/${item.id}`}>{item.name}</Link></h2><p>{item.description || t("Описание пока не добавлено.")}</p><div className="card-foot"><span>{countLabel(item._count?.members ?? 0, 'member')}</span><Link className="button button-secondary" to={`/communities/${item.id}`}>{t("Открыть клуб")}</Link></div></div></article>)}</div>}
  </>
}
