import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faKey, faRightFromBracket, faUser } from '@fortawesome/free-solid-svg-icons'

const fallbackPhoto = '/assets/images/profile/MyProfile.png'

export default function UserProfileDropdown({ profile, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const photoUrl = resolvePhoto(profile?.userPhoto)

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  function select(action) {
    setOpen(false)
    if (action === 'logout') {
      onLogout()
      return
    }
    onNavigate(action)
  }

  return (
    <div ref={containerRef} className="relative shrink-0 self-stretch">
      <button type="button" aria-label="Open user profile menu" aria-expanded={open} className="app-topbar-action flex h-full items-center gap-2 rounded-lg px-2 py-1 outline-none transition focus-visible:ring-2" style={{ color: 'var(--app-header-text)', '--tw-ring-color': 'var(--app-focus-ring)' }} onClick={() => setOpen((value) => !value)}>
        <img src={photoUrl} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackPhoto }} className="h-10 w-10 rounded-full border-2 object-cover" style={{ borderColor: 'var(--app-border)' }} alt="User profile" />
        <span className="hidden max-w-28 truncate text-xs font-medium sm:block" style={{ color: 'var(--app-header-muted)' }}>{profile?.roleName ?? 'User'}</span>
        <FontAwesomeIcon icon={faChevronDown} className={`hidden text-xs transition sm:block ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--app-header-muted)' }} />
      </button>
      {open && <div role="menu" aria-label="User profile actions" className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border p-1 shadow-xl" style={{ background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}>
        {profile?.userName && <div className="truncate px-3 py-2 text-sm font-semibold" style={{ color: 'var(--app-text)' }}>Welcome, {profile.userName}</div>}
        <ProfileAction icon={faUser} label="Profile" onClick={() => select('/profile')} />
        <ProfileAction icon={faKey} label="Change Password" onClick={() => select('/change-password')} />
        <div className="my-1 border-t" style={{ borderColor: 'var(--app-border)' }} />
        <ProfileAction icon={faRightFromBracket} label="Logout" onClick={() => select('logout')} danger />
      </div>}
    </div>
  )
}

function ProfileAction({ icon, label, onClick, danger = false }) {
  return <button type="button" role="menuitem" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:opacity-80 focus-visible:outline-none" style={{ color: danger ? '#dc2626' : 'var(--app-text)' }} onClick={onClick}><FontAwesomeIcon icon={icon} fixedWidth />{label}</button>
}

function resolvePhoto(value) {
  if (!value || !/^[a-zA-Z0-9._-]+$/.test(value)) return fallbackPhoto
  return `/assets/images/profile/${encodeURIComponent(value)}`
}
