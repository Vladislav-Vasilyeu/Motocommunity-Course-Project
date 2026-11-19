import { t, getLocale } from './i18n'
import { apiErrorKeys } from './apiErrorKeys'
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// Keep the stable server code so errors can be translated again after switching language.
export class ApiError extends Error {
  code: string
  serverMessage: string | undefined
  status: number
  constructor(code: string, serverMessage: string | undefined, status: number) {
    super(translateApiError(code, serverMessage, status))
    this.code = code; this.serverMessage = serverMessage; this.status = status
  }
}
export function translateApiError(code: string, message?: string, status?: number) {
  const key = apiErrorKeys[code]
  if (key) return t(key)
  if (getLocale() === 'ru' && message) return message
  return status ? t('Ошибка запроса ({status})', { status }) : t('Не удалось выполнить запрос')
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new ApiError(result?.error?.code ?? 'UNKNOWN', result?.error?.message, response.status)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}
export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return translateApiError(error.code, error.serverMessage, error.status)
  if (error instanceof TypeError) return t('Не удалось подключиться к серверу. Проверьте соединение и попробуйте снова.')
  return error instanceof Error ? t(error.message) : t('Не удалось выполнить запрос')
}
