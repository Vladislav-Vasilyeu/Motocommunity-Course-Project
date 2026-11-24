import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
const storageKey = 'motoclub.theme'
const system = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()
let theme: Theme = 'system'
let storageAvailable = true
try {
  const saved = localStorage.getItem(storageKey)
  if (saved === 'light' || saved === 'dark' || saved === 'system') theme = saved
} catch { storageAvailable = false }

function resolve(): ResolvedTheme { return theme === 'system' ? (system.matches ? 'dark' : 'light') : theme }
let snapshot = { theme, resolvedTheme: resolve(), storageAvailable }
function publish() {
  const resolvedTheme = resolve()
  document.documentElement.dataset.theme = resolvedTheme
  document.documentElement.style.colorScheme = resolvedTheme
  snapshot = { theme, resolvedTheme, storageAvailable }
  listeners.forEach(listener => listener())
}
export function setTheme(next: Theme) {
  theme = next
  try { localStorage.setItem(storageKey, next); storageAvailable = true } catch { storageAvailable = false }
  publish()
}
system.addEventListener('change', () => { if (theme === 'system') publish() })
window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return
  theme = event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : 'system'
  publish()
})
publish()
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function useTheme() {
  return { ...useSyncExternalStore(subscribe, () => snapshot), setTheme }
}
