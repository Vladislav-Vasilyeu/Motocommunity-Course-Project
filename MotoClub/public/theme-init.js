// Runs before styles and React so a saved dark theme never paints a light canvas.
(() => {
  let theme = 'system'
  try { theme = localStorage.getItem('motoclub.theme') || 'system' } catch { /* Private storage may be unavailable. */ }
  const resolved = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
})()
