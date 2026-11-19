import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { getIntlLocale, useLocale } from '../shared/i18n'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'
import { reportText as t, targetLabels, statusLabels } from '../features/reports/copy'
import type { Report, ReportAction, ReportStatus } from '../features/reports/types'
import { usePageResource } from './usePageResource'
import '../features/reports/reports.css'

export default function ModerationPage() {
  useLocale()
  const { user, loading } = useAuth()
  if (loading) return <LoadingState/>
  if (!user || !['MODERATOR', 'ADMIN'].includes(user.role ?? '')) return <EmptyState title={t('Недостаточно прав')} description={t('Этот раздел доступен модераторам и администраторам.')} action={!user && <Link className="button button-primary" to="/login">{t('Войти')}</Link>}/>
  return <ModerationQueue key={user.id} userId={user.id}/>
}

function ModerationQueue({ userId }: { userId: string }) {
  const [status, setStatus] = useState<ReportStatus | 'ALL'>('PENDING')
  const resource = usePageResource<{ reports: Report[] }>(`/api/moderation/reports?status=${status}`, userId)
  const [saved, setSaved] = useState(false)
  return <div>
    <PageTitle eyebrow={t('Модерация')} title={t('Очередь жалоб')} description={t('Проверьте обращение и сохраните решение.')}/>
    <div className="report-filters">{(['PENDING', 'RESOLVED', 'DISMISSED', 'ALL'] as const).map(value => <button className="category-chip" key={value} aria-pressed={status === value} onClick={() => { setStatus(value); setSaved(false) }}>{t(value === 'ALL' ? 'Все' : statusLabels[value])}</button>)}</div>
    {saved && <p role="status" className="report-feedback">{t('Решение сохранено.')}</p>}
    {resource.loading ? <LoadingState/> : resource.error ? <ErrorState message={resource.error} onRetry={resource.reload}/> : !resource.data?.reports.length ? <EmptyState title={t('Нет жалоб')} description={t('В выбранном статусе пока нет обращений.')}/> : <ul className="report-list">{resource.data.reports.map(report => <ReviewCard key={report.id} report={report} onSaved={() => { setSaved(true); resource.reload() }}/>)}</ul>}
  </div>
}

function ReviewCard({ report, onSaved }: { report: Report; onSaved: () => void }) {
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function review(action: ReportAction) {
    if (busy) return
    if (action === 'DELETE_TARGET' && !window.confirm(t('Удалить этот объект? Для сообщества также удалятся его публикации. Действие нельзя отменить.'))) return
    setBusy(true); setError('')
    try {
      await api(`/api/moderation/reports/${encodeURIComponent(report.id)}`, { method: 'PATCH', body: JSON.stringify({ action, note }) })
      onSaved()
    } catch (cause) { setError(getErrorMessage(cause)) } finally { setBusy(false) }
  }
  const targetLink = report.targetType === 'COMMUNITY' ? `/communities/${encodeURIComponent(report.targetId)}` : null
  return <li className="panel report-card">
    <h2>{t(targetLabels[report.targetType])} · {report.targetTitle}</h2>
    <span className="status-pill">{t(statusLabels[report.status])}</span>
    <p>{report.reason}</p>
    <p className="report-meta">{t('Отправитель')}: {report.reporter?.displayName} · <time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString(getIntlLocale())}</time></p>
    <p className="report-meta">ID: {report.targetId}</p>
    {targetLink && <Link to={targetLink}>{t('Открыть объект')}</Link>}
    {report.status === 'PENDING' ? <>
      <label>{t('Комментарий модератора')}<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1000} disabled={busy}/></label>
      {error && <ErrorState message={error}/>}
      <div className="report-actions">
        <button className="button button-primary" disabled={busy} onClick={() => void review('RESOLVE')}>{t(busy ? 'Сохраняю…' : 'Решить')}</button>
        <button className="button button-secondary" disabled={busy} onClick={() => void review('DISMISS')}>{t('Отклонить')}</button>
        {report.targetType !== 'USER' && <button className="button button-quiet" disabled={busy} onClick={() => void review('DELETE_TARGET')}>{t('Удалить объект')}</button>}
      </div>
    </> : report.note && <p>{t('Комментарий модератора')}: {report.note}</p>}
  </li>
}
