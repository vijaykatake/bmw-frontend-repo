import UserProfileDropdown from './UserProfileDropdown.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBell, faBars } from '@fortawesome/free-solid-svg-icons'
import ThemeSelector from './ThemeSelector.jsx'

function handleNotificationsPlaceholder() {
  // Reserved for the future notification panel and API integration.
}

export default function TopBar({ settings, profile, onMenuToggle, onNavigate, onLogout }) {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 shadow-sm backdrop-blur sm:flex-nowrap sm:py-0 md:px-8" style={{ background: 'var(--app-header-bg)', color: 'var(--app-header-text)', borderColor: 'var(--app-border)' }}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button type="button" aria-label="Open navigation" className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 active:opacity-70 md:hidden" style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted-text)', '--tw-ring-color': 'var(--app-focus-ring)' }} onClick={onMenuToggle}>
          <FontAwesomeIcon icon={faBars} fixedWidth aria-hidden="true" />
          <span>Menu</span>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate whitespace-nowrap text-[0.9375rem] font-bold leading-tight sm:text-lg">
            {settings?.hospitalName}
            {settings?.versionNumber && <span className="ml-1.5 text-[0.6875rem] font-normal italic sm:ml-2 sm:text-sm" style={{ color: 'var(--app-muted-text)' }}>v{settings.versionNumber}</span>}
          </h1>
        </div>
      </div>
      <div className="flex basis-full items-center justify-end gap-3 sm:basis-auto">
        <ThemeSelector savedThemeId={profile?.themeId} />
        <button type="button" aria-label="Notifications" title="Notifications" className="app-topbar-action flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2" style={{ color: 'var(--app-header-text)', '--tw-ring-color': 'var(--app-focus-ring)' }} onClick={handleNotificationsPlaceholder}>
          <FontAwesomeIcon icon={faBell} fixedWidth />
        </button>
        <UserProfileDropdown profile={profile} onNavigate={onNavigate} onLogout={onLogout} />
      </div>
    </header>
  )
}
