import { useEffect, useState } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import { useTheme } from './theme/ThemeContext.jsx'
import AppLayout from './components/layout/AppLayout.jsx'
import CookieConsent from './components/CookieConsent.jsx'

function App() {
  const { themes, loading, error, setActiveThemeById } = useTheme()
  const [user, setUser] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [layout, setLayout] = useState(null)
  const [layoutError, setLayoutError] = useState('')

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (result?.user) setUser(result.user) })
      .catch(() => {})
      .finally(() => setCheckingSession(false))
  }, [])

  useEffect(() => {
    if (!user) return undefined
    let cancelled = false
    fetch('/api/layout', { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error(response.status === 401 ? 'Your session has expired.' : 'Unable to load the application layout.')
        return response.json()
      })
      .then((result) => { if (!cancelled) setLayout(result) })
      .catch((loadError) => { if (!cancelled) setLayoutError(loadError.message) })
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!layout) return
    const themeId = layout.profile.themeId ?? themes.find((theme) => theme.isDefault)?.themeId
    if (themeId) setActiveThemeById(themeId)
  }, [layout, themes, setActiveThemeById])

  async function logout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
      if (!response.ok) throw new Error('Unable to sign out securely. Please try again.')
      setLayout(null)
      setUser(null)
      setLayoutError('')
    } catch (logoutError) {
      setLayoutError(logoutError.message)
    }
  }

  let content
  if (loading || checkingSession) content = <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading BMWSystem design system...</div>
  else if (!user) content = <LoginScreen onLogin={setUser} />
  else if (layoutError) content = <div className="flex min-h-screen items-center justify-center p-6 text-center text-red-700">{layoutError}</div>
  else if (!layout) content = <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">Loading application layout...</div>
  else content = <AppLayout user={user} layout={layout} onLogout={logout} />

  return <>{content}<CookieConsent /></>
}

export default App
