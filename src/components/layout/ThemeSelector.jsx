import { useState } from 'react'
import { useTheme } from '../../theme/ThemeContext.jsx'

export default function ThemeSelector({ savedThemeId }) {
  const { themes, activeTheme, changeTheme, loading } = useTheme()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selectedId = activeTheme?.themeId ?? savedThemeId ?? ''

  async function selectTheme(event) {
    const themeId = Number(event.target.value)
    setError('')
    setSaving(true)
    try {
      await changeTheme(themeId)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative shrink-0">
      <label className="sr-only" htmlFor="theme-selector">Application theme</label>
      <select id="theme-selector" aria-label="Application theme" title={error || 'Select application theme'} value={selectedId} onChange={selectTheme} disabled={loading || saving || !themes.length} className="h-10 max-w-36 cursor-pointer rounded-lg border px-2 text-xs outline-none transition hover:opacity-80 focus-visible:ring-2 disabled:cursor-wait disabled:opacity-60 sm:max-w-48" style={{ background: 'var(--app-header-bg)', color: 'var(--app-header-text)', borderColor: 'var(--app-border)', '--tw-ring-color': 'var(--app-focus-ring)' }}>
        {!themes.length && <option value="">Loading themes...</option>}
              {(themes || []).map((theme, index) => (
                  <option key={theme.themeId || index} value={theme.themeId}>
                      {theme.themeName}
                  </option>
              ))}
      </select>
    </div>
  )
}
