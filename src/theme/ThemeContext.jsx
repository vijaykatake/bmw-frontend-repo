import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getPreferenceConsent } from '../components/CookieConsent.jsx'

const ThemeContext = createContext(null)

const accents = {
  LIGHT_BIO_CARE: { accent: '#0284c7', background: '#f8fafc', foreground: '#0f172a', header: '#ffffff', headerText: '#0f172a', headerMuted: '#475569', headerHover: '#f1f5f9', sidebar: '#0f3d56', sidebarText: '#e2e8f0', content: '#ffffff', muted: '#64748b', border: '#cbd5e1', active: '#0284c7', input: '#ffffff' },
  DARK_CLINICAL: { accent: '#22d3ee', background: '#020617', foreground: '#e2e8f0', header: '#0f172a', headerText: '#e2e8f0', headerMuted: '#cbd5e1', headerHover: '#1e293b', sidebar: '#020617', sidebarText: '#e2e8f0', content: '#0f172a', muted: '#94a3b8', border: '#334155', active: '#155e75', input: '#111827' },
  HAZARD_ALERT: { accent: '#b91c1c', background: '#fff7ed', foreground: '#450a0a', header: '#991b1b', headerText: '#fff7ed', headerMuted: '#fed7aa', headerHover: '#b91c1c', sidebar: '#450a0a', sidebarText: '#fff7ed', content: '#ffffff', muted: '#7f1d1d', border: '#fecaca', active: '#b91c1c', input: '#ffffff' },
  ECO_GREEN: { accent: '#059669', background: '#f0fdf4', foreground: '#064e3b', header: '#ffffff', headerText: '#064e3b', headerMuted: '#475569', headerHover: '#ecfdf5', sidebar: '#064e3b', sidebarText: '#ecfdf5', content: '#ffffff', muted: '#047857', border: '#bbf7d0', active: '#059669', input: '#ffffff' },
  OCEAN_SANITY: { accent: '#0e7490', background: '#f8fafc', foreground: '#0f172a', header: '#ffffff', headerText: '#0f172a', headerMuted: '#475569', headerHover: '#ecfeff', sidebar: '#164e63', sidebarText: '#cffafe', content: '#ffffff', muted: '#64748b', border: '#cbd5e1', active: '#0e7490', input: '#ffffff' },
}

const themePreferenceKey = 'bmw.themePreference'

function readStoredThemeId(themes) {
  if (!getPreferenceConsent()) return null
  const value = Number.parseInt(localStorage.getItem(themePreferenceKey) ?? '', 10)
  return themes.some((theme) => theme.themeId === value) ? value : null
}

export function ThemeProvider({ children }) {
  const [themes, setThemes] = useState([])
  const [activeTheme, setActiveTheme] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/themes')
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load the BMW theme catalog.')
        return response.json()
      })
      .then((catalog) => {
        if (cancelled) return
        setThemes(catalog.themes)
        const storedThemeId = readStoredThemeId(catalog.themes)
        setActiveTheme(catalog.themes.find((theme) => theme.themeId === storedThemeId)
          ?? catalog.themes.find((theme) => theme.themeCode === catalog.defaultThemeCode)
          ?? catalog.themes[0])
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!activeTheme) return
    const palette = accents[activeTheme.themeCode] ?? accents.LIGHT_BIO_CARE
    document.documentElement.style.setProperty('--bmw-accent', palette.accent)
    document.documentElement.style.setProperty('--bmw-background', palette.background)
    document.documentElement.style.setProperty('--bmw-foreground', palette.foreground)
    document.documentElement.style.setProperty('--app-header-bg', palette.header)
    document.documentElement.style.setProperty('--app-header-text', palette.headerText)
    document.documentElement.style.setProperty('--app-header-muted', palette.headerMuted)
    document.documentElement.style.setProperty('--app-header-hover-bg', palette.headerHover)
    document.documentElement.style.setProperty('--app-sidebar-bg', palette.sidebar)
    document.documentElement.style.setProperty('--app-sidebar-text', palette.sidebarText)
    document.documentElement.style.setProperty('--app-sidebar-active-bg', palette.active)
    document.documentElement.style.setProperty('--app-sidebar-active-text', '#ffffff')
    document.documentElement.style.setProperty('--app-page-bg', palette.background)
    document.documentElement.style.setProperty('--app-content-bg', palette.content)
    document.documentElement.style.setProperty('--app-text', palette.foreground)
    document.documentElement.style.setProperty('--app-muted-text', palette.muted)
    document.documentElement.style.setProperty('--app-border', palette.border)
    document.documentElement.style.setProperty('--app-primary', palette.accent)
    document.documentElement.style.setProperty('--app-primary-hover', palette.active)
    document.documentElement.style.setProperty('--app-input-bg', palette.input)
    document.documentElement.style.setProperty('--app-input-border', palette.border)
    document.documentElement.style.setProperty('--app-focus-ring', palette.accent)
    document.documentElement.style.setProperty('--app-overlay-bg', 'rgba(15, 23, 42, 0.5)')
    document.documentElement.dataset.theme = activeTheme.themeCode
  }, [activeTheme])

  const setActiveThemeById = useCallback((themeId) => {
    const theme = themes.find((candidate) => candidate.themeId === themeId)
    if (theme) setActiveTheme(theme)
    return theme
  }, [themes])

  const changeTheme = useCallback(async (themeId) => {
    const previousTheme = activeTheme
    const selectedTheme = setActiveThemeById(themeId)
    if (!selectedTheme) throw new Error('The selected theme is not available.')

    try {
      const response = await fetch('/api/themes/current', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId }),
      })
      if (!response.ok) throw new Error('Unable to save the selected theme.')
      if (getPreferenceConsent()) localStorage.setItem(themePreferenceKey, String(themeId))
      return selectedTheme
    } catch (error) {
      if (previousTheme) setActiveTheme(previousTheme)
      throw error
    }
  }, [activeTheme, setActiveThemeById])

  const value = useMemo(() => ({ themes, activeTheme, setActiveTheme, setActiveThemeById, changeTheme, loading, error }), [themes, activeTheme, setActiveThemeById, changeTheme, loading, error])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
