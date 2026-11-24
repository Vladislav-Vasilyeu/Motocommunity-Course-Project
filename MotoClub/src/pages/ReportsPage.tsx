import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../features/auth/AuthProvider'
import { api, getErrorMessage } from '../shared/api'
import { getIntlLocale, useLocale } from '../shared/i18n'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../shared/ui'
import { reportText as t, targetLabels, statusLabels } from '../features/reports/copy'
import type { Report, ReportTargetType } from '../features/reports/types'
import { usePageResource } from './usePageResource'
import '../features/reports/reports.css'

export default function ReportsPage() {
  useLocale()
  const { user, loading } = useAuth()
  if (loading) return <LoadingState/>
  if (!user) return <EmptyState title={t('Жалобы')} description={t('Войдите, чтобы отправить жалобу и посмотреть её статус.')} action={<Link className="button button-primary" to="/login">{t('Войти')}</Link>}/>
  return <ReportsContent key={user.id} userId={user.id}/>
}

function ReportsContent({ userId }: { userId: string }) {
  const [params] = useSearchParams()
  const resource = usePageResource<{ reports: Report[] }>('/api/reports', userId)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget, values = new FormData(form)
    setBusy(true); setError(''); setSent(false)
    try {
      await api('/api/reports', { method: 'POST', body: JSON.stringify(Object.fromEntries(values)) })
      form.reset(); setSent(true); resource.reload()
    } catch (cause) { setError(getErrorMessage(cause)) } finally { setBusy(false) }
  }
  const initialType = params.get('targetType') ?? 'POST'
  const targetId = params.get('targetId')
  const canSubmit = Boolean(targetId && Object.hasOwn(targetLabels, initialType))
  return <div>
    <PageTitle eyebrow={t('Безопасность сообщества')} title={t('Мои жалобы')} description={t('Сообщите о нарушении. Решение принимает модератор.')}/>
    {canSubmit ? <form key={params.toString()} className="panel report-form" onSubmit={submit}>
      <h2>{t('Новая жалоба')}</h2>
      <p>{t('Объект')}: {t(targetLabels[initialType as ReportTargetType])}</p>
      <input type="hidden" name="targetType" value={initialType}/>
      <input type="hidden" name="targetId" value={targetId ?? ''}/>
      <label>{t('Причина (5–2000 символов)')}<textarea name="reason" required minLength={5} maxLength={2000}/></label>
      {error && <ErrorState message={error}/>}
      <button disabled={busy} className="button button-primary">{t(busy ? 'Отправляю…' : 'Отправить жалобу')}</button>
      {sent && <p className="report-feedback" role="status">{t('Жалоба отправлена модератору.')}</p>}
    </form> : <p className="panel report-card">{t('Чтобы отправить жалобу, нажмите «Пожаловаться» рядом с публикацией, объявлением, сообществом или профилем.')}</p>}
    <h2>{t('История жалоб')}</h2>
    {resource.loading ? <LoadingState/> : resource.error ? <ErrorState message={resource.error} onRetry={resource.reload}/> : !resource.data?.reports.length ? <EmptyState title={t('Жалоб пока нет')} description={t('Отправленные жалобы и решения появятся здесь.')}/> : <ul className="report-list">{resource.data.reports.map(report => <li className="panel report-card" key={report.id}>
      <h2>{t(targetLabels[report.targetType as ReportTargetType])} · {report.targetTitle}</h2>
      <span className="status-pill">{t(statusLabels[report.status])}</span>
      <p>{report.reason}</p>
      <p className="report-meta"><time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString(getIntlLocale())}</time></p>
      {report.note && <p>{t('Комментарий модератора')}: {report.note}</p>}
    </li>)}</ul>}
  </div>
}
