import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'
const THEME_KEY = 'promptrouter-theme'
function storedTheme(): Theme | null {
  try { const value = localStorage.getItem(THEME_KEY); return value === 'dark' || value === 'light' ? value : null } catch { return null }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const onChange = () => { if (!storedTheme()) setTheme(media?.matches ? 'dark' : 'light') }
    media?.addEventListener('change', onChange)
    return () => media?.removeEventListener('change', onChange)
  }, [])
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem(THEME_KEY, next) } catch { /* Theme still works when storage is unavailable. */ }
  }
  return { theme, toggleTheme }
}
