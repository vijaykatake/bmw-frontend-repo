import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRightToBracket, faBan, faEye, faEyeSlash, faLock, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { useTheme } from '../theme/ThemeContext.jsx'
import { BMW_VERSION } from '../config/version.js'
import { API_BASE_URL } from '../config/api.js'

const developmentLoginId = import.meta.env.DEV ? import.meta.env.VITE_DEV_LOGIN_ID ?? '' : ''
const developmentPassword = import.meta.env.DEV ? import.meta.env.VITE_DEV_LOGIN_PASSWORD ?? '' : ''

export default function LoginScreen({ onLogin }) {
  const { activeTheme } = useTheme()
   const [loginId, setLoginId] = useState(() => sessionStorage.getItem('bmw.loginId') ?? developmentLoginId)
   const [password, setPassword] = useState(developmentPassword)
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [forgotMessage, setForgotMessage] = useState('')

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
      const result = await response.json()
      if (!response.ok) throw new Error(result.message ?? 'Login failed.')
      onLogin(result.user)
    } catch (error) {
      setMessage(error.message)
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
        <form className="space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium">
            Login ID Or Email
            <input className="mt-2 w-full rounded-lg border px-3 py-2.5 outline-none focus:ring-2" style={{ background: 'var(--app-input-bg)', borderColor: 'var(--app-input-border)', '--tw-ring-color': 'var(--app-focus-ring)' }} value={loginId} onChange={(event) => { setLoginId(event.target.value); sessionStorage.setItem('bmw.loginId', event.target.value) }} required autoComplete="username"  />
          </label>
          <label className="block text-sm font-medium">
            Password
            <span className="relative mt-2 block">
              <input type={showPassword ? 'text' : 'password'} className="w-full rounded-lg border px-3 py-2.5 pr-11 outline-none focus:ring-2" style={{ background: 'var(--app-input-bg)', borderColor: 'var(--app-input-border)', '--tw-ring-color': 'var(--app-focus-ring)' }} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center transition hover:opacity-70" style={{ color: 'var(--app-muted-text)' }}>
                <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
              </button>
            </span>
          </label>
          {message && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}
          <div className="flex gap-3">
             <button type="button" onClick={cancel} className="flex-1 rounded-lg border px-4 py-3 font-semibold transition hover:opacity-80" style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted-text)' }}>
              <FontAwesomeIcon icon={faBan} className="mr-2" />Cancel
            </button>
            <button type="submit" className="flex-1 rounded-lg px-4 py-3 font-semibold transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60" style={{ background: 'var(--app-primary)', color: 'var(--app-sidebar-active-text)' }} disabled={submitting}>
              <FontAwesomeIcon icon={submitting ? faLock : faArrowRightToBracket} className="mr-2" />{submitting ? 'Verifying...' : 'Login'}
            </button>
          </div>
          <a href="#forgot-password" onClick={forgotPassword} className="block text-center text-sm font-medium hover:underline" style={{ color: 'var(--bmw-accent)' }}>Forgot Password?</a>
          {forgotMessage && <p className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800"><FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5" />{forgotMessage}</p>}
        </form>
         <p className="mt-6 text-center text-xs" style={{ color: 'var(--app-muted-text)' }}>{BMW_VERSION}{activeTheme ? ` ... ${activeTheme.themeName}` : ''}</p>
      </section>
    </main>
  )
}
