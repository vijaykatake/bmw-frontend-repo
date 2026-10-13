import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBan, faCalendarDays, faCheck, faEye, faEyeSlash, faFloppyDisk, faSpinner, faUser } from '@fortawesome/free-solid-svg-icons'
import { API_BASE_URL } from '../../config/api.js'

const emptyForm = { email: '', gmailAppPassword: '', whatsapp: '', supportPin: '' }

export default function SupportConfigForm() {
  const [form, setForm] = useState(emptyForm)
  const [audit, setAudit] = useState({ aUser: null, aDate: null, uUser: null, uDate: null })
  const [errors, setErrors] = useState({})
  const [hints, setHints] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [notification, setNotification] = useState(null)
  const [diagnostics, setDiagnostics] = useState(null)

  useEffect(() => { loadConfig() }, [])
  useEffect(() => { if (!notification) return undefined; const timer = window.setTimeout(() => setNotification(null), 5000); return () => window.clearTimeout(timer) }, [notification])

  async function loadConfig() {
    setLoading(true)
    try {
      const diagnosticResponse = await fetch(`${API_BASE_URL}/api/support/config/diagnostics`, { credentials: 'include' })
      const diagnosticResult = await diagnosticResponse.json().catch(() => ({}))
      if (!diagnosticResponse.ok) throw new Error(diagnosticResult?.message || 'Support Settings diagnostics could not be completed.')
      if (!diagnosticResult.passed) { setDiagnostics(diagnosticResult); return }
      const response = await fetch(`${API_BASE_URL}/api/support/config`, { credentials: 'include' })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.message || 'Unable to load Support configuration.')
      setForm({ email: result.email ?? '', gmailAppPassword: result.gmailAppPassword ?? '', whatsapp: result.whatsApp ?? '', supportPin: result.supportPin ?? '' })
      setAudit({ aUser: result.aUser, aDate: result.aDate, uUser: result.uUser, uDate: result.uDate })
      setErrors({})
      setHints({})
    } catch (error) { setNotification({ type: 'danger', message: error.message }) } finally { setLoading(false) }
  }

  function validate(values = form) {
    const next = {}
    if (!emailPattern(values.email)) next.email = 'Enter a valid email address.'
    if (!whatsappPattern(values.whatsapp)) next.whatsapp = 'Enter a valid Indian mobile number.'
    if (values.gmailAppPassword && !values.gmailAppPassword.trim()) next.gmailAppPassword = 'Gmail App Password cannot be blank.'
    if (values.supportPin && (values.supportPin.length < 5 || /\s/.test(values.supportPin))) next.supportPin = 'PIN must contain at least 5 characters and no spaces.'
    setErrors(next)
    setHints({})
    return !Object.keys(next).length
  }

  function validateField(field) {
    const value = String(form[field] ?? '')
    let message = ''
    if (field === 'email' && !emailPattern(value)) message = 'Enter a valid email address.'
    if (field === 'whatsapp' && !whatsappPattern(value)) message = 'Enter a valid Indian mobile number.'
    if (field === 'gmailAppPassword' && value && !value.trim()) message = 'Gmail App Password cannot be blank.'
    if (field === 'supportPin' && value && (value.length < 5 || /\s/.test(value))) message = 'PIN must contain at least 5 characters and no spaces.'
    setErrors((current) => { const next = { ...current }; if (message) next[field] = message; else delete next[field]; return next })
    setHints((current) => ({ ...current, [field]: Boolean(message) }))
  }

  async function save(event) {
    event.preventDefault()
    if (!validate() || saving) return
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/support/config`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const result = await response.json()
      const resultId = Number(result?.ResultID ?? result?.resultID ?? result?.resultId)
      if (!response.ok || resultId === 206) throw new Error(result?.TransMessage ?? result?.message ?? 'Support configuration update failed.')
      setNotification({ type: 'success', message: result.TransMessage || 'Support configuration updated successfully.' })
      await loadConfig()
    } catch (error) { setNotification({ type: 'danger', message: error.message }) } finally { setSaving(false) }
  }

  return <section role="tabpanel" className="relative rounded-xl p-5" style={{ background: 'var(--app-page-bg)' }}>{notification && <div className={`transaction-notice fixed right-4 top-4 z-[100] flex w-max max-w-[calc(100vw-2rem)] flex-col items-center gap-1 rounded-xl border p-3 text-center text-base shadow-2xl`} style={{ '--notice-accent': notification.type === 'success' ? '#15803d' : '#b91c1c', '--notice-accent-dark': notification.type === 'success' ? '#166534' : '#991b1b', background: 'var(--app-content-bg)', color: notification.type === 'success' ? '#15803d' : '#b91c1c', borderColor: notification.type === 'success' ? '#15803d' : '#b91b1c' }}><span className="transaction-notice-icon"><FontAwesomeIcon icon={notification.type === 'success' ? faCheck : faBan} /></span><span className="transaction-notice-message">{notification.message}</span></div>}{loading ? <div className="py-10 text-center" style={{ color: 'var(--app-muted-text)' }}><FontAwesomeIcon icon={faSpinner} spin /> Loading Support configuration...</div> : diagnostics ? <DiagnosticsDialog diagnostics={diagnostics} onClose={() => setDiagnostics(null)} /> : <form onSubmit={save}><div className="grid grid-cols-1 gap-x-4 md:grid-cols-2"><Field label="Email" required error={errors.email} hint={hints.email}><input type="email" value={form.email} onBlur={() => validateField('email')} onChange={(event) => setForm({ ...form, email: event.target.value })} className="h-11 w-full rounded-lg border px-3" style={inputStyle} /></Field><Field label="WhatsApp" required error={errors.whatsapp} hint={hints.whatsapp}><input inputMode="tel" value={form.whatsapp} onBlur={() => validateField('whatsapp')} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} className="h-11 w-full rounded-lg border px-3" style={inputStyle} /></Field><Field label="Gmail App Password" error={errors.gmailAppPassword} hint={hints.gmailAppPassword}><SecretInput value={form.gmailAppPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} onBlur={() => validateField('gmailAppPassword')} onChange={(value) => setForm({ ...form, gmailAppPassword: value })} placeholder="Leave blank to keep saved value" label="Gmail App Password" /></Field><Field label="Support Settings PIN" error={errors.supportPin} hint={hints.supportPin}><SecretInput value={form.supportPin} visible={showPin} onToggle={() => setShowPin((value) => !value)} onBlur={() => validateField('supportPin')} onChange={(value) => setForm({ ...form, supportPin: value })} placeholder="Leave blank to keep saved value" label="Support Settings PIN" /></Field></div><div className="mt-2 flex justify-center gap-3"><button type="button" onClick={loadConfig} disabled={saving || loading} className="flex items-center gap-2 rounded-lg border px-4 py-2 font-medium" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}><FontAwesomeIcon icon={faBan} />Cancel</button><button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg px-4 py-2 font-semibold disabled:opacity-60" style={{ background: 'var(--app-primary)', color: 'var(--app-sidebar-active-text)' }}><FontAwesomeIcon icon={saving ? faSpinner : faFloppyDisk} spin={saving} />{saving ? 'Saving...' : 'Save'}</button></div><div className="mt-5 flex flex-wrap justify-center gap-3 border-t pt-4" style={{ borderColor: 'var(--app-border)' }}><AuditCapsule icon={faUser} label="Added By" value={audit.aUser} /><AuditCapsule icon={faCalendarDays} label="Added Date" value={audit.aDate} /><AuditCapsule icon={faUser} label="Updated By" value={audit.uUser} /><AuditCapsule icon={faCalendarDays} label="Updated Date" value={audit.uDate} /></div></form>}</section>
}

const inputStyle = { background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)' }
function emailPattern(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) }
function whatsappPattern(value) { return /^(?:\+91)?[6-9]\d{9}$/.test(value.trim()) }
function Field({ label, required, error, hint, children }) { return <label className="relative mb-4 block pt-2 text-sm font-medium"><span className="pointer-events-none absolute left-3 top-0 z-10 px-1 text-sm font-semibold" style={{ background: 'var(--app-page-bg)', color: 'var(--app-primary)' }}>{label}{required && <span className="ml-1" style={{ color: '#b91c1c' }}>*</span>}</span>{children}<span className={`mt-1 block text-sm font-semibold ${hint ? 'text-right' : 'text-left'}`} style={{ color: hint ? 'var(--app-primary)' : '#b91c1c' }}>{error || ''}</span></label> }
function SecretInput({ value, visible, onToggle, onBlur, onChange, placeholder, label }) { return <span className="relative block"><input type={visible ? 'text' : 'password'} value={value} autoComplete="new-password" data-1p-ignore="true" data-lpignore="true" data-bwignore="true" placeholder={placeholder} aria-label={label} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border px-3 pr-11" style={inputStyle} /><button type="button" aria-label={visible ? `Hide ${label}` : `Show ${label}`} title={visible ? `Hide ${label}` : `Show ${label}`} onClick={onToggle} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center" style={{ color: 'var(--app-muted-text)' }}><FontAwesomeIcon icon={visible ? faEyeSlash : faEye} /></button></span> }
function AuditCapsule({ icon, label, value }) { return <span className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-sm" style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, var(--app-content-bg))', color: 'var(--app-text)', borderColor: 'color-mix(in srgb, var(--app-primary) 45%, var(--app-border))' }}><FontAwesomeIcon icon={icon} style={{ color: 'var(--app-primary)' }} /><span className="font-bold" style={{ color: 'var(--app-primary)' }}>{label}:</span><span className="font-normal" style={{ color: 'var(--app-text)' }}>{value || '-'}</span></span> }
function DiagnosticsDialog({ diagnostics, onClose }) { const details = diagnostics.checks.map((check) => `${(check.Passed ?? check.passed) ? 'PASS' : 'FAIL'} | ${check.Name ?? check.name}: ${check.Message ?? check.message}${(check.Hint ?? check.hint) ? ` Hint: ${check.Hint ?? check.hint}` : ''}`).join('\n'); async function copy() { await navigator.clipboard?.writeText(details) }; return <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ background: 'var(--app-overlay-bg)' }}><div role="alertdialog" aria-modal="true" className="w-full max-w-2xl rounded-2xl border p-5 shadow-2xl" style={{ background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: '#b91c1c' }}><h3 className="text-lg font-bold" style={{ color: '#b91c1c' }}>Support Settings diagnostics failed</h3><p className="mt-2 text-sm" style={{ color: 'var(--app-muted-text)' }}>Copy this safe diagnostic report for deployment troubleshooting.</p><pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border p-3 text-xs" style={{ background: 'var(--app-page-bg)', borderColor: 'var(--app-border)' }}>{details}</pre><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={copy} className="rounded-lg border px-4 py-2" style={{ borderColor: 'var(--app-border)' }}>Copy</button><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 font-semibold" style={{ background: 'var(--app-primary)', color: 'var(--app-sidebar-active-text)' }}>Close</button></div></div></div> }
