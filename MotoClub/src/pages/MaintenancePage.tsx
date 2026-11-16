import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useMatch, useNavigate, useParams } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import type { Motorcycle } from '../shared/types'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'
import { usePageResource } from './usePageResource'
import './maintenance.css'

type MaintenanceRecord = {
  id: string
  title: string
  date: string
  mileage: number | null
  cost: number | null
  notes: string | null
}

type MaintenanceJournal = {
  motorcycle: Pick<Motorcycle, 'id' | 'make' | 'model'>
  records: MaintenanceRecord[]
}

type RecordAction = 'created' | 'updated' | 'deleted'

const actionFeedback = {
  created: 'Запись добавлена.',
  updated: 'Изменения сохранены.',
  deleted: 'Запись удалена.',
}
const serviceDate = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'UTC' })
const distance = new Intl.NumberFormat('ru-RU', { style: 'unit', unit: 'kilometer' })
const amount = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'BYN', currencyDisplay: 'code', minimumFractionDigits: 0 })

export default function MaintenancePage() {
  const { user, loading } = useAuth()
  const { motorcycleId, recordId } = useParams()
  const isNew = Boolean(useMatch('/garage/:motorcycleId/maintenance/new'))

  if (loading) return <LoadingState label="Проверяю вход…"/>
  if (!user) return <div className="panel callout">Войдите, чтобы открыть свой журнал обслуживания. <Link to="/login">Войти</Link></div>
  if (!motorcycleId) return <ErrorState message="Мотоцикл не найден."/>

  return <MaintenanceJournalPage key={`${user.id}:${motorcycleId}`} motorcycleId={motorcycleId} userId={user.id} recordId={recordId} isNew={isNew}/>
}

function MaintenanceJournalPage({ motorcycleId, userId, recordId, isNew }: {
  motorcycleId: string
  userId: string
  recordId?: string
  isNew: boolean
}) {
  const encodedId = encodeURIComponent(motorcycleId)
  const journalUrl = `/garage/${encodedId}/maintenance`
  const endpoint = `/api/motorcycles/${encodedId}/maintenance`
  const journal = usePageResource<MaintenanceJournal>(endpoint, userId)
  const location = useLocation()
  const formOpen = isNew || Boolean(recordId)
  const record = journal.data?.records.find(({ id }) => id === recordId)
  const feedback: unknown = location.state?.maintenanceAction
  const addRecord = <Link className="button button-primary" to={`${journalUrl}/new`}>Добавить запись</Link>

  return <div className="maintenance-page">
    <Link className="maintenance-back" to={formOpen ? journalUrl : '/garage'}>← {formOpen ? 'Журнал обслуживания' : 'Мой гараж'}</Link>
    {journal.loading && <LoadingState label="Загружаю журнал обслуживания…"/>}
    {journal.error && <ErrorState message={journal.error} onRetry={journal.reload}/>}
    {journal.data && (recordId && !record ? <ErrorState message="Запись обслуживания не найдена."/> : <>
      <PageTitle
        eyebrow="Мой гараж"
        title={isNew ? 'Новая запись обслуживания' : record ? 'Запись обслуживания' : 'Журнал обслуживания'}
        description={formOpen ? `${journal.data.motorcycle.make} ${journal.data.motorcycle.model} · личный журнал` : 'История работ по мотоциклу'}
        action={formOpen ? undefined : addRecord}
      />
      {formOpen ? <MaintenanceForm
        key={record?.id ?? 'new'} record={record} endpoint={endpoint} journalUrl={journalUrl}
        reload={journal.reload}
      /> : <>
        {(feedback === 'created' || feedback === 'updated' || feedback === 'deleted') &&
          <p className="maintenance-notice" role="status">{actionFeedback[feedback]}</p>}
        <div className="maintenance-notice">
          <strong>Приватный журнал</strong>
          <p>Записи видите только вы.</p>
        </div>
        <section className="panel maintenance-records" aria-labelledby="maintenance-motorcycle">
          <h2 id="maintenance-motorcycle">{journal.data.motorcycle.make} {journal.data.motorcycle.model}</h2>
          {journal.data.records.length ? <ul className="maintenance-list">
            {journal.data.records.map((item) => <li key={item.id} className="maintenance-record">
              <span className="maintenance-badge" aria-hidden="true">ТО</span>
              <div>
                <h3>{item.title}</h3>
                <p className="maintenance-meta">
                  <time dateTime={item.date}>{serviceDate.format(new Date(`${item.date}T00:00:00Z`))}</time>
                  {item.mileage !== null && <span>{distance.format(item.mileage)}</span>}
                  {item.cost !== null && <span>{amount.format(item.cost)}</span>}
                </p>
              </div>
              <Link className="button button-secondary" to={`${journalUrl}/${encodeURIComponent(item.id)}/edit`} aria-label={`Открыть запись «${item.title}»`}>Запись</Link>
            </li>)}
          </ul> : <EmptyState title="В журнале пока нет записей" description="Добавьте первую работу по этому мотоциклу."/>}
        </section>
      </>}
    </>)}
  </div>
}

function MaintenanceForm({ record, endpoint, journalUrl, reload }: {
  record?: MaintenanceRecord
  endpoint: string
  journalUrl: string
  reload: () => void
}) {
  const navigate = useNavigate()
  const [pending, setPending] = useState<'save' | 'delete' | null>(null)
  const [error, setError] = useState('')
  const active = useRef(false)
  useLayoutEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  const recordEndpoint = record ? `${endpoint}/${encodeURIComponent(record.id)}` : endpoint

  async function change(action: RecordAction, request: RequestInit) {
    setPending(action === 'deleted' ? 'delete' : 'save')
    setError('')
    try {
      await api(recordEndpoint, request)
      if (!active.current) return
      reload()
      navigate(journalUrl, { replace: true, state: { maintenanceAction: action } })
    } catch (err) {
      if (active.current) setError(getErrorMessage(err))
    } finally {
      if (active.current) setPending(null)
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title')).trim()
    if (!title) {
      setError('Введите название работы.')
      return
    }
    const mileage = form.get('mileage')
    const cost = form.get('cost')
    void change(record ? 'updated' : 'created', {
      method: record ? 'PATCH' : 'POST',
      body: JSON.stringify({
        title,
        date: form.get('date'),
        mileage: mileage === '' ? null : Number(mileage),
        cost: cost === '' ? null : Number(cost),
        notes: String(form.get('notes')).trim() || null,
      }),
    })
  }

  function remove() {
    if (!record || pending || !window.confirm(`Удалить запись «${record.title}»?`)) return
    void change('deleted', { method: 'DELETE' })
  }

  return <form className="panel form-grid maintenance-form" onSubmit={save} aria-busy={Boolean(pending)}>
    <label>Работа<input name="title" required maxLength={120} defaultValue={record?.title} disabled={Boolean(pending)}/></label>
    <label>Дата<input name="date" type="date" required min="0001-01-01" max="9999-12-31" defaultValue={record?.date} disabled={Boolean(pending)}/></label>
    <label>Пробег, км<input name="mileage" type="number" min="0" max="2147483647" step="1" defaultValue={record?.mileage ?? ''} disabled={Boolean(pending)}/></label>
    <label>Стоимость, BYN (необязательно)<input name="cost" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={record?.cost ?? ''} disabled={Boolean(pending)}/></label>
    <label className="maintenance-full">Заметки<textarea name="notes" rows={3} maxLength={2000} defaultValue={record?.notes ?? ''} disabled={Boolean(pending)}/></label>
    {error && <div className="maintenance-full"><ErrorState message={error}/></div>}
    <div className="maintenance-full maintenance-form-footer">
      <p>Запись останется приватной.</p>
      <div className="maintenance-actions">
        <button type="submit" className="button button-primary" disabled={Boolean(pending)}>{pending === 'save' ? 'Сохраняю…' : 'Сохранить запись'}</button>
        <Link className="button button-quiet" to={journalUrl}>Отмена</Link>
        {record && <button type="button" className="button button-danger-quiet" onClick={remove} disabled={Boolean(pending)}>{pending === 'delete' ? 'Удаляю…' : 'Удалить запись'}</button>}
      </div>
    </div>
  </form>
}
