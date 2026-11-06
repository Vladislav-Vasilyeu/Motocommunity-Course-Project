import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { formObject, type Community } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'

export default function CommunitiesPage() {
  const { user } = useAuth(); const navigate = useNavigate()
  const [items, setItems] = useState<Community[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [query, setQuery] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setItems((await api<{ communities: Community[] }>('/api/communities')).communities) } catch (err) { setError(getErrorMessage(err)) } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!user) { navigate('/login'); return }; const form = event.currentTarget; setBusy(true); setError(''); try { const result = await api<{ community: Community }>('/api/communities', { method: 'POST', body: JSON.stringify(formObject(form)) }); setItems((current) => [result.community, ...current]); form.reset() } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) } }
  const filtered = items.filter((item) => `${item.name} ${item.city} ${item.description}`.toLowerCase().includes(query.toLowerCase()))
  return <>
    <PageTitle eyebrow="Сообщество" title="Клубы и группы" description="Находите райдеров рядом и присоединяйтесь к клубам по интересам."/>
    <div className="toolbar panel"><label className="search-field"><span>Поиск клубов</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название или город"/></label><span className="result-count">{filtered.length} клубов</span></div>
    {user && <details className="panel create-panel"><summary>Создать клуб</summary><form className="form-grid" onSubmit={create}><label>Название<input name="name" required minLength={3} maxLength={80}/></label><label>Город<input name="city" maxLength={100}/></label><label className="field-wide">Описание<textarea name="description" maxLength={1000} rows={3}/></label><button className="button button-primary" disabled={busy}>{busy ? 'Создаю…' : 'Создать клуб'}</button></form></details>}
    {error && <ErrorState message={error} onRetry={load}/>}
    {loading ? <LoadingState/> : filtered.length === 0 ? <EmptyState title="Клубы не найдены" description={query ? 'Измените поисковый запрос.' : 'Создайте первый клуб для своего города.'}/> : <div className="card-grid">{filtered.map((item) => <article className="panel community-card" key={item.id}><p className="eyebrow">{item.city || 'MotoClub'}</p><h2>{item.name}</h2><p>{item.description || 'Описание пока не добавлено.'}</p><div className="card-foot"><span>{item._count?.members ?? 0} участников</span><Link className="button button-secondary" to={`/communities/${item.id}`}>Открыть клуб</Link></div></article>)}</div>}
  </>
}
