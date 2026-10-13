import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBan, faCheck, faEnvelope, faEye, faEyeSlash, faGear, faKey, faSpinner, faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons'
import { API_BASE_URL } from '../../config/api.js'
import TechMailGrid from './TechMailGrid.jsx'
import SupportConfigForm, { DiagnosticsDialog } from './SupportConfigForm.jsx'

export default function SupportSettings({ onCancel, settings, profile }) {
  const [access, setAccess] = useState(false)
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('email')
  const [diagnostics, setDiagnostics] = useState(null)
  const pinRef = useRef(null)

  useEffect(() => {
    pinRef.current?.focus()
    loadDiagnostics()
  }, [])

  useEffect(() => {
    function handleDiagnosticsShortcut(event) {
      if (event.code !== 'Space' || access) return
      event.preventDefault()
      event.stopPropagation()
      loadDiagnostics(true)
    }

    window.addEventListener('keydown', handleDiagnosticsShortcut, true)
    return () => window.removeEventListener('keydown', handleDiagnosticsShortcut, true)
  }, [access])

  async function loadDiagnostics(showDialog = false) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/support/config/diagnostics`, { credentials: 'include' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result?.message || 'Support Settings diagnostics could not be completed.')
      if (showDialog || !result.passed) setDiagnostics(result)
    } catch (diagnosticError) {
      setDiagnostics({ checks: [{ name: 'Diagnostics request', passed: false, message: diagnosticError.message, hint: 'Verify that the API is online and reachable.' }], canResetPin: false })
    }
  }

  async function verify(event) {
    event.preventDefault()
    if (submitting) return
    if (!pin.trim()) {
      setError('PIN is required.')
      pinRef.current?.focus()
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/support/verify-pin`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setPin('')
        setShowPin(false)
        setError(result.message || (response.status === 403 ? 'Invalid PIN. Access denied.' : 'Support Settings verification is currently unavailable.'))
        return
      }
      setPin('')
      setShowPin(false)
      setAccess(true)
    } catch {
      setError('Support Settings verification is currently unavailable.')
    } finally {
      setSubmitting(false)
    }
  }

  function cancel() {
    setPin('')
    setShowPin(false)
    setError('')
    onCancel()
  }

  if (access) return <section className="rounded-2xl p-4 shadow-sm ring-1 sm:p-6" style={{ background: 'var(--app-content-bg)', '--tw-ring-color': 'var(--app-border)' }}><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Support Settings</h2><p className="mt-1 text-sm" style={{ color: 'var(--app-muted-text)' }}>Manage support email configuration.</p></div></div><div role="tablist" aria-label="Support Settings sections" className="mb-5 flex flex-wrap gap-2 border-b" style={{ borderColor: 'var(--app-border)' }}><button type="button" role="tab" aria-selected={activeTab === 'email'} className="flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition" style={{ borderColor: activeTab === 'email' ? 'var(--app-primary)' : 'transparent', color: activeTab === 'email' ? 'var(--app-primary)' : 'var(--app-muted-text)' }} onClick={() => setActiveTab('email')}><FontAwesomeIcon icon={faEnvelope} />Email Support</button><button type="button" role="tab" aria-selected={activeTab === 'config'} className="flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition" style={{ borderColor: activeTab === 'config' ? 'var(--app-primary)' : 'transparent', color: activeTab === 'config' ? 'var(--app-primary)' : 'var(--app-muted-text)' }} onClick={() => setActiveTab('config')}><FontAwesomeIcon icon={faGear} />Config</button></div>{activeTab === 'email' ? <TechMailGrid settings={settings} profile={profile} /> : <SupportConfigForm />}</section>

  return <>{diagnostics && <DiagnosticsDialog diagnostics={diagnostics} onClose={() => setDiagnostics(null)} />}<div className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto p-4" style={{ background: 'var(--app-overlay-bg)' }}><form onSubmit={verify} className="w-full max-w-md rounded-2xl border p-5 shadow-2xl" style={{ background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}><div className="mb-5 flex items-center justify-between gap-3"><h3 className="flex min-w-0 items-center gap-2 text-sm font-medium sm:text-base"><span className="flex min-w-0 items-center gap-1.5" style={{ color: 'var(--app-primary)' }}><FontAwesomeIcon icon={faKey} aria-hidden="true" />Support Settings Verification</span></h3><button type="button" aria-label="Close" title="Close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-md transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2" style={{ background: 'var(--app-page-bg)', color: 'var(--app-primary)', borderColor: 'var(--app-border)', '--tw-ring-color': 'var(--app-focus-ring)' }} onClick={cancel}><FontAwesomeIcon icon={faXmark} /></button></div><label className="relative mb-2 block pt-2 text-sm font-medium"><span className="pointer-events-none absolute left-3 top-0 z-10 px-1 text-sm font-semibold" style={{ background: 'var(--app-content-bg)', color: 'var(--app-primary)' }}>PIN</span><span className="relative block"><input ref={pinRef} type="text" value={pin} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck="false" inputMode="text" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" placeholder="Enter Support Settings PIN" onKeyDown={(event) => { if (event.code === 'Space') event.preventDefault() }} onChange={(event) => { setPin(event.target.value); if (error) setError('') }} className={`h-11 w-full rounded-lg border px-3 pr-11 outline-none focus-visible:ring-2 ${showPin ? '' : 'support-pin-masked'}`} style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)', '--tw-ring-color': 'var(--app-focus-ring)' }} /><button type="button" aria-label={showPin ? 'Hide PIN' : 'Show PIN'} title={showPin ? 'Hide PIN' : 'Show PIN'} onClick={() => setShowPin((visible) => !visible)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center transition hover:opacity-70 focus-visible:outline-none focus-visible:ring-2" style={{ color: 'var(--app-muted-text)', '--tw-ring-color': 'var(--app-focus-ring)' }}><FontAwesomeIcon icon={showPin ? faEyeSlash : faEye} /></button></span></label><div className="mb-4 flex justify-center"><button type="button" onClick={() => loadDiagnostics(true)} className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90" style={{ background: '#b91c1c' }}><FontAwesomeIcon icon={faTriangleExclamation} />Diagnostics</button></div>{error && <p className="mb-4 text-sm font-semibold" style={{ color: '#b91c1c' }}>{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" className="flex items-center gap-2 rounded-lg border px-4 py-2 font-medium transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)', '--tw-ring-color': 'var(--app-focus-ring)' }} onClick={cancel}><FontAwesomeIcon icon={faBan} />Cancel</button><button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-lg px-4 py-2 font-semibold shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60" style={{ background: 'var(--app-primary)', color: 'var(--app-sidebar-active-text)', '--tw-ring-color': 'var(--app-focus-ring)' }}><FontAwesomeIcon icon={submitting ? faSpinner : faCheck} spin={submitting} />{submitting ? 'Verifying...' : 'Confirm'}</button></div></form></div></>
}
