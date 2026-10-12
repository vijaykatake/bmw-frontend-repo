import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faThumbtack } from '@fortawesome/free-solid-svg-icons'
import MenuTree from './MenuTree.jsx'

export default function Sidebar({ settings, menus, currentPath, open, collapsed, onToggleCollapse, onClose, onNavigate }) {
  const [desktopViewport, setDesktopViewport] = useState(() => window.matchMedia('(min-width: 768px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const updateViewport = () => setDesktopViewport(media.matches)
    updateViewport()
    media.addEventListener?.('change', updateViewport)
    return () => media.removeEventListener?.('change', updateViewport)
  }, [])

  const desktopCollapsed = collapsed && desktopViewport
  const mobileCollapsed = collapsed && !desktopViewport
  return (
    <>
      {open && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 md:hidden" style={{ background: 'var(--app-overlay-bg)' }} onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex flex-col shadow-xl transition-[width,transform] duration-300 md:translate-x-0 ${collapsed ? 'w-20 md:w-20' : 'w-72 md:w-72'} ${open ? 'translate-x-0' : '-translate-x-full'}`} style={{ background: 'var(--app-sidebar-bg)', color: 'var(--app-sidebar-text)' }}>
        <div className={`relative flex min-h-24 items-center border-b py-4 ${mobileCollapsed ? 'justify-end gap-1 px-1' : desktopCollapsed ? 'px-1 md:justify-between' : 'gap-3 px-3'}`} style={{ borderColor: 'var(--app-border)' }}>
          <img src={settings.hospitalLogoUrl} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/assets/images/settings/hospital-logo.png' }} className={`h-14 w-14 shrink-0 rounded-xl bg-white/90 object-contain p-2 shadow-md ${desktopCollapsed ? 'md:h-9 md:w-9 md:p-1' : ''} ${mobileCollapsed ? 'hidden' : ''}`} alt="Hospital logo" />
          <div className={`flex min-h-14 min-w-0 flex-1 items-center ${mobileCollapsed ? 'hidden' : desktopCollapsed ? 'md:hidden' : ''}`}>
            <p className="truncate text-sm font-semibold">{settings.shortName}</p>
          </div>
          <button type="button" aria-label="Close navigation" className={`ml-auto rounded hover:opacity-80 md:hidden ${mobileCollapsed ? 'p-1 text-base' : 'p-2 text-xl'}`} onClick={onClose}>x</button>
          <button type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={`sidebar-pin z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-[background-color,box-shadow,filter] duration-200 shadow-lg hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 ${desktopViewport ? 'absolute right-0 top-1/2 ml-0 translate-x-1/2 -translate-y-1/2' : ''}`} style={{ background: 'var(--pin-bg, var(--app-sidebar-active-bg))', color: 'var(--app-sidebar-active-text)', borderColor: 'var(--app-border)', boxShadow: '0 3px 0 var(--app-border), 0 8px 16px var(--app-overlay-bg)', '--tw-ring-color': 'var(--app-focus-ring)' }} onClick={onToggleCollapse}>
            <FontAwesomeIcon icon={faThumbtack} className={`transition-transform duration-200 ${collapsed ? 'rotate-45' : ''}`} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-4"><MenuTree menus={menus} currentPath={currentPath} collapsed={desktopCollapsed || mobileCollapsed} mobileCollapsed={mobileCollapsed} onNavigate={onNavigate} onClose={onClose} /></div>
      </aside>
    </>
  )
}
