import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRightToBracket, faBan, faClipboard, faEye, faEyeSlash, faLock, faPhone, faSpinner, faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useTheme } from '../theme/ThemeContext.jsx'
import { BMW_VERSION } from '../config/version.js'
import { API_BASE_URL } from '../config/api.js'

const developmentLoginId = import.meta.env.DEV ? import.meta.env.VITE_DEV_LOGIN_ID ?? '' : ''
const developmentPassword = import.meta.env.DEV ? import.meta.env.VITE_DEV_LOGIN_PASSWORD ?? '' : ''
const loginServiceUnavailableMessage = 'The login service is temporarily unavailable.\n\nPossible causes:\n- The backend service is stopped.\n- The database server is unavailable.\n- A network or deployment issue occurred.\n- The server configuration is invalid.\n\nPlease try again shortly.'

export default function LoginScreen({ onLogin }) {
  const { activeTheme } = useTheme()
   const [loginId, setLoginId] = useState(() => sessionStorage.getItem('bmw.loginId') ?? developmentLoginId)
   const [password, setPassword] = useState(developmentPassword)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [forgotMessage, setForgotMessage] = useState('')
  const [errorDialog, setErrorDialog] = useState(null)

  async function submit(event) {
    event.preventDefault()
    setMessage('')
    if (!loginId.trim() || !password) {
      setMessage('Login ID and password are required.')
      return
    }
    setSubmitting(true)
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ loginId, password }),
      })
      const result = await readJsonResponse(response)
       if (!response.ok) {
         const message = response.status === 401
           ? 'The login ID or password is invalid.'
           : response.status === 502 || response.status === 503 || response.status === 504
             ? 'The login service is temporarily unavailable. Please try again shortly.'
             : result.message ?? `Login failed (HTTP ${response.status}).`
         if (response.status >= 500) {
           setErrorDialog({ message: loginServiceUnavailableMessage, operation: 'Login' })
           throw new Error(loginServiceUnavailableMessage)
         }
         throw new Error(message)
      }
      if (!result.user) throw new Error('Login response was incomplete. Please try again.')
      onLogin(result.user)
     } catch (error) {
       const errorMessage = error.message || 'Login failed. Please try again.'
       setMessage(errorMessage)
       if (error instanceof TypeError) {
         setErrorDialog({ message: loginServiceUnavailableMessage, operation: 'Login' })
       } else if (errorMessage !== 'The login ID or password is invalid.') {
         setErrorDialog((current) => current ?? { message: errorMessage, operation: 'Login' })
       }
    } finally {
      setSubmitting(false)
    }

  }

  function cancel() {
     setLoginId(developmentLoginId)
     setPassword(developmentPassword)
    setShowPassword(false)
    setMessage('')
    setForgotMessage('')
  }

async function readJsonResponse(response) {
  const text = await response.text()
  if (!text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

  async function forgotPassword(event) {
    event.preventDefault()
    setForgotMessage('')
    if (!loginId.trim()) {
      setForgotMessage('Enter your Login ID first.')
      return
    }
     const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ loginId }),
    })
    const result = await response.json()
    setForgotMessage(result.message)
  }

  return (
    <>
    {errorDialog && <LoginErrorDialog message={errorDialog.message} onClose={() => setErrorDialog(null)} />}
    <main className="flex min-h-screen items-center justify-center px-6 py-12" style={{ background: 'var(--app-page-bg)', color: 'var(--app-text)' }}>
      <section className="w-full max-w-md rounded-2xl p-8 shadow-xl ring-1" style={{ background: 'var(--app-content-bg)', '--tw-ring-color': 'var(--app-border)' }}>
        <div className="mb-8 flex items-start gap-4">
           <img className="h-16 w-16 rounded-xl object-contain p-2" style={{ background: 'var(--app-input-bg)' }} src="/assets/images/settings/hospital-logo.png" alt="Biohazard symbol" />
          <div>
          <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: 'var(--bmw-accent)' }}>BMWSystem</p>
          {/*<h1 className="mt-2 text-3xl font-bold">Welcome back</h1>*/}
           <p className="mt-2 text-sm" style={{ color: 'var(--app-muted-text)' }}>Sign in to manage biomedical waste safely and compliantly.</p>
          </div>
        </div>
         <div className="relative">
         <form className="space-y-5" onSubmit={submit} aria-busy={submitting}>
           <fieldset disabled={submitting} className="space-y-5">
          <label className="block text-sm font-medium">
            Login ID Or Email
           <input className="mt-2 w-full rounded-lg border px-3 py-2.5 outline-none focus:ring-2" style={{ background: 'var(--app-input-bg)', borderColor: 'var(--app-input-border)', '--tw-ring-color': 'var(--app-focus-ring)' }} value={loginId} onChange={(event) => { setLoginId(event.target.value); setMessage(''); sessionStorage.setItem('bmw.loginId', event.target.value) }} required autoComplete="username"  />
          </label>
          <label className="block text-sm font-medium">
            Password
            <span className="relative mt-2 block">
               <input type={showPassword ? 'text' : 'password'} className="w-full rounded-lg border px-3 py-2.5 pr-11 outline-none focus:ring-2" style={{ background: 'var(--app-input-bg)', borderColor: 'var(--app-input-border)', '--tw-ring-color': 'var(--app-focus-ring)' }} value={password} onChange={(event) => { setPassword(event.target.value); setMessage('') }} autoComplete="current-password" />
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center transition hover:opacity-70" style={{ color: 'var(--app-muted-text)' }}>
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </button>
            </span>
          </label>
           {message && <p role="alert" className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, var(--app-content-bg))', color: 'var(--app-primary)', borderColor: 'var(--app-border)' }}><FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />{message}</p>}
          <div className="flex gap-3">
             <button type="button" onClick={cancel} className="flex-1 rounded-lg border px-4 py-3 font-semibold transition hover:opacity-80" style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted-text)' }}>
              <FontAwesomeIcon icon={faBan} className="mr-2" />Cancel
            </button>
            <button type="submit" className="flex-1 rounded-lg px-4 py-3 font-semibold transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60" style={{ background: 'var(--app-primary)', color: 'var(--app-sidebar-active-text)' }} disabled={submitting}>
              <FontAwesomeIcon icon={submitting ? faLock : faArrowRightToBracket} className="mr-2" />{submitting ? 'Verifying...' : 'Login'}
            </button>
          </div>
          <a href="#forgot-password" onClick={forgotPassword} className="block text-center text-sm font-medium hover:underline" style={{ color: 'var(--bmw-accent)' }}>Forgot Password?</a>
           {forgotMessage && <p role="status" className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm" style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, var(--app-content-bg))', color: 'var(--app-primary)', borderColor: 'var(--app-border)' }}><FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" />{forgotMessage}</p>}
           </fieldset>
        </form>
         {submitting && <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg p-4" style={{ background: 'color-mix(in srgb, var(--app-content-bg) 78%, transparent)', backdropFilter: 'blur(2px)' }}><div role="status" className="flex items-center gap-3 rounded-xl border px-5 py-4 text-base font-semibold shadow-lg" style={{ background: 'var(--app-content-bg)', color: 'var(--app-primary)', borderColor: 'var(--app-border)' }}><FontAwesomeIcon icon={faSpinner} spin />Signing in, please wait...</div></div>}
         </div>
         <p className="mt-6 text-center text-xs" style={{ color: 'var(--app-muted-text)' }}>{BMW_VERSION}{activeTheme ? ` ... ${activeTheme.themeName}` : ''}</p>
      </section>
    </main>
    </>
  )
}

function LoginErrorDialog({ message, onClose }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard?.writeText(message)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return <div className="fixed inset-0 z-[67] flex items-center justify-center overflow-y-auto p-4" style={{ background: 'var(--app-overlay-bg)' }}><div role="alertdialog" aria-modal="true" aria-labelledby="login-error-title" className="w-full max-w-lg rounded-2xl border p-5 shadow-2xl" style={{ background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, var(--app-content-bg))', color: 'var(--app-primary)' }}><FontAwesomeIcon icon={faXmark} /></span><div><h3 id="login-error-title" className="text-lg font-bold" style={{ color: 'var(--app-primary)' }}>Login operation failed</h3><p className="mt-1 text-sm" style={{ color: 'var(--app-muted-text)' }}>Review the details below and correct the login problem before trying again.</p></div></div><div className="mt-4 rounded-xl border p-4" style={{ background: 'var(--app-page-bg)', borderColor: 'var(--app-border)' }}><p className="break-words whitespace-pre-line text-left text-sm leading-6" style={{ color: 'var(--app-text)' }}>{message}</p></div><div className="mt-4 flex animate-pulse items-center justify-center gap-3 rounded-xl border p-4 text-base font-semibold shadow-sm" style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, var(--app-content-bg))', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}><FontAwesomeIcon icon={faPhone} className="text-lg" style={{ color: 'var(--app-primary)' }} /><span>Quick Support:</span><a href="tel:9604781258" className="text-lg font-bold hover:underline" style={{ color: 'var(--app-primary)' }}>9604781258</a></div><div className="mt-5 flex flex-wrap justify-center gap-2"><button type="button" className="flex items-center gap-2 rounded-lg border px-4 py-2" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }} onClick={copy}><FontAwesomeIcon icon={faClipboard} />{copied ? 'Copied !!!' : 'Copy'}</button><button type="button" className="flex items-center gap-2 rounded-lg border px-4 py-2" style={{ borderColor: 'var(--app-border)' }} onClick={onClose}><FontAwesomeIcon icon={faXmark} />Close</button></div></div></div>
}
