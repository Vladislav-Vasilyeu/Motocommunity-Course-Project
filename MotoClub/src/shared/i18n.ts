import { useSyncExternalStore } from 'react'
import { en } from './translations'
const sourceKeys = new Map(Object.entries(en).map(([key, value]) => [value, key]))

export const locales = [
  { code: 'ru', label: 'Русский', intlLocale: 'ru-RU' },
  { code: 'en', label: 'English', intlLocale: 'en-US' },
] as const
export type Locale = typeof locales[number]['code']
export const defaultLocale: Locale = 'ru'
const dictionaries: Record<Locale, Record<string, string>> = { ru: {}, en }
const storageKey = 'motoclub_locale'
let storageAvailable = true
function isLocale(value: unknown): value is Locale { return locales.some(item => item.code === value) }
function readLocale(): Locale {
  try { const value = localStorage.getItem(storageKey); return isLocale(value) ? value : defaultLocale }
  catch { storageAvailable = false; return defaultLocale }
}
let currentLocale = readLocale()
const listeners = new Set<() => void>()
function applyLocale() { if (typeof document !== 'undefined') document.documentElement.lang = currentLocale }
applyLocale()
export function getLocale() { return currentLocale }
export function getIntlLocale() { return locales.find(item => item.code === currentLocale)!.intlLocale }
export function setLocale(locale: Locale) {
  if (!isLocale(locale)) return
  currentLocale = locale
  try { localStorage.setItem(storageKey, locale); storageAvailable = true } catch { storageAvailable = false }
  applyLocale()
  for (const listener of listeners) listener()
}
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return
  currentLocale = readLocale(); applyLocale()
  for (const listener of listeners) listener()
})
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function t(key: string, params: Record<string, string | number> = {}) {
  const source = sourceKeys.get(key) ?? key
  const template = dictionaries[currentLocale][source] ?? dictionaries[defaultLocale][source] ?? source
  return template.replace(/\{(\w+)\}/g, (match, name: string) => Object.hasOwn(params, name) ? String(params[name]) : match)
}
export function useLocale() {
  useSyncExternalStore(subscribe, () => `${currentLocale}:${storageAvailable}`, () => `${defaultLocale}:true`)
  return { locale: currentLocale, setLocale, t, intlLocale: getIntlLocale(), storageAvailable }
}
export const useI18n = useLocale
export function formatDate(value: string | number | Date, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  return new Intl.DateTimeFormat(getIntlLocale(), options).format(new Date(value))
}
export function formatNumber(value: number, options?: Intl.NumberFormatOptions) { return new Intl.NumberFormat(getIntlLocale(), options).format(value) }
export function formatCurrency(value: number, currency = 'BYN') { return formatNumber(value, { style: 'currency', currency }) }
export function countLabel(count: number, noun: 'waypoint' | 'member' | 'club') {
  const forms = currentLocale === 'ru'
    ? { waypoint: ['точка', 'точки', 'точек'], member: ['участник', 'участника', 'участников'], club: ['клуб', 'клуба', 'клубов'] }
    : { waypoint: ['waypoint', 'waypoints', 'waypoints'], member: ['member', 'members', 'members'], club: ['club', 'clubs', 'clubs'] }
  const plural = new Intl.PluralRules(getIntlLocale()).select(count)
  return `${formatNumber(count)} ${forms[noun][plural === 'one' ? 0 : plural === 'few' ? 1 : 2]}`
}
