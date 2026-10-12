import { useEffect, useState } from 'react'

const consentKey = 'bmw.cookieConsent'
const consentVersion = 1

function readConsent() {
  try {
    const saved = JSON.parse(localStorage.getItem(consentKey) ?? 'null')
    return saved?.version === consentVersion && typeof saved?.preferences === 'boolean' ? saved : null
  } catch {
    return null
  }
}

export function getPreferenceConsent() {
  return readConsent()?.preferences === true
}

export default function CookieConsent() {
  const [choice, setChoice] = useState(readConsent)
  const [customizing, setCustomizing] = useState(false)
  const [preferences, setPreferences] = useState(true)

  useEffect(() => {
    try {
      setChoice(readConsent())
    } catch {
      localStorage.removeItem(consentKey)
    }
  }, [])

  function save(nextPreferences) {
    const next = { version: consentVersion, necessary: true, preferences: nextPreferences, analytics: false, updatedAt: new Date().toISOString() }
    localStorage.setItem(consentKey, JSON.stringify(next))
    if (!nextPreferences) localStorage.removeItem('bmw.themePreference')
    setChoice(next)
    setCustomizing(false)
  }

  if (choice) return null

  return (
    <aside role="dialog" aria-label="Cookie preferences" className="fixed inset-x-3 bottom-3 z-50 max-w-xl rounded-2xl border p-5 shadow-2xl sm:left-6 sm:right-auto" style={{ background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}>
      <h2 className="font-semibold">Privacy and storage preferences</h2>
      <p className="mt-2 text-sm" style={{ color: 'var(--app-muted-text)' }}>This application uses necessary authentication storage and may use preference storage for your selected theme. It does not use analytics or marketing cookies.</p>
      {customizing && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={preferences} onChange={(event) => setPreferences(event.target.checked)} /> Allow theme preferences</label>}
      <div className="mt-4 flex flex-wrap gap-2">
        {!customizing && <button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: 'var(--bmw-accent)' }} onClick={() => save(true)}>Accept All</button>}
        <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => save(false)}>Reject Optional</button>
        {!customizing && <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => setCustomizing(true)}>Customize</button>}
        {customizing && <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => save(preferences)}>Save Choices</button>}
      </div>
      <p className="mt-3 text-xs" style={{ color: 'var(--app-muted-text)' }}>No privacy or cookie policy URL is currently configured in this application.</p>
    </aside>
  )
}
