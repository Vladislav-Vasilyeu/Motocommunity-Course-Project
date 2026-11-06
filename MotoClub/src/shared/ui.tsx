import type { ReactNode } from 'react'

export function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action && <div className="page-title-action">{action}</div>}</div>
}

export function LoadingState({ label = 'Загружаю данные…' }: { label?: string }) {
  return <div className="state-panel" role="status"><span className="spinner" />{label}</div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="state-panel state-error" role="alert"><p>{message}</p>{onRetry && <button className="button button-secondary" onClick={onRetry}>Повторить</button>}</div>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="state-panel state-empty"><span className="empty-mark">—</span><h2>{title}</h2><p>{description}</p>{action}</div>
}

export function LoginPrompt({ children = 'Чтобы выполнить это действие, войдите в аккаунт.' }: { children?: ReactNode }) {
  return <p className="login-prompt">{children}</p>
}

export function ButtonSpinner() { return <span className="button-spinner" aria-hidden="true" /> }
