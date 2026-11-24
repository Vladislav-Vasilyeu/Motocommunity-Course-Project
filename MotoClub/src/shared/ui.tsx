import { t, useLocale } from './i18n'
import type { ReactNode } from 'react'

export function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  useLocale()
  return <div className="page-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action && <div className="page-title-action">{action}</div>}</div>
}

export function LoadingState({ label = t('Загружаю данные…') }: { label?: string }) {
  useLocale()
  return <div className="state-panel" role="status"><span className="spinner" />{label}</div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  useLocale()
  return <div className="state-panel state-error" role="alert"><p>{t(message)}</p>{onRetry && <button className="button button-secondary" onClick={onRetry}>{t("Повторить")}</button>}</div>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  useLocale()
  return <div className="state-panel state-empty"><span className="empty-mark">—</span><h2>{title}</h2><p>{description}</p>{action}</div>
}

export function LoginPrompt({ children = t('Чтобы выполнить это действие, войдите в аккаунт.') }: { children?: ReactNode }) {
  useLocale()
  return <p className="login-prompt">{children}</p>
}

export function ButtonSpinner() {
  useLocale()
  return <span className="button-spinner" aria-hidden="true" /> }
