import { useEffect, useMemo, useRef, useState } from 'react'
import Breadcrumbs from './Breadcrumbs.jsx'
import Sidebar from './Sidebar.jsx'
import TopBar from './TopBar.jsx'
import { normalizePath } from './MenuTree.jsx'
import Ward from '../../Master/Ward/Ward.jsx'
import WasteType from '../../Master/WasteType/WasteType.jsx'
import StorageArea from '../../Master/StorageArea/StorageArea.jsx'
import StorageRoom from '../../Master/StorageRoom/StorageRoom.jsx'
import Profile from '../../Profile/Profile.jsx'
import ChangePassword from '../../ChangePassword/ChangePassword.jsx'
import SupportSettings from '../../Settings/SupportSettings/SupportSettings.jsx'

export default function AppLayout({ user, layout, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [path, setPath] = useState(() => window.location.pathname.toLowerCase())
  const lastNonSupportPath = useRef(path === '/settings/supportsettings' ? '/profile' : path)

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname.toLowerCase())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (nextPath) => {
    const normalizedPath = nextPath.toLowerCase()
    if (normalizedPath !== '/settings/supportsettings') lastNonSupportPath.current = normalizedPath
    window.history.pushState({}, '', normalizedPath)
    setPath(normalizedPath)
  }

  const currentMenu = useMemo(() => layout.menus.find((menu) => normalizePath(menu.menuUrl) === path), [layout.menus, path])
  const content = path === '/master/ward' ? <Ward settings={layout.settings} profile={layout.profile} /> : path === '/master/wastetype' ? <WasteType settings={layout.settings} profile={layout.profile} /> : (path === '/master/storagearea' || path === '/master/storage-area') ? <StorageArea settings={layout.settings} profile={layout.profile} /> : (path === '/master/storageroom' || path === '/master/storage-room') ? <StorageRoom settings={layout.settings} profile={layout.profile} /> : path === '/profile' ? <Profile profile={layout.profile} /> : path === '/change-password' ? <ChangePassword /> : path === '/settings/supportsettings' ? <SupportSettings user={user} settings={layout.settings} profile={layout.profile} onCancel={() => navigate(lastNonSupportPath.current)} /> : <PlaceholderPage menu={currentMenu} />

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-page-bg)', color: 'var(--app-text)' }}>
      <Sidebar settings={layout.settings} menus={layout.menus} currentPath={path} open={sidebarOpen} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((value) => !value)} onClose={() => setSidebarOpen(false)} onNavigate={navigate} />
      <div className={`min-h-screen transition-[padding] duration-300 ${sidebarCollapsed ? 'md:pl-20' : 'md:pl-72'}`}>
        <TopBar settings={layout.settings} profile={layout.profile} onMenuToggle={() => setSidebarOpen(true)} onNavigate={navigate} onLogout={onLogout} />
        <main className={`mx-auto ${sidebarCollapsed ? 'max-w-none p-3 sm:p-4 lg:p-5' : 'max-w-7xl px-1 py-4 sm:px-1.5 sm:py-6 lg:px-2 lg:py-8'}`}>
          <Breadcrumbs menu={currentMenu} />
          {content}
          <p className="mt-8 text-xs text-slate-500">Signed in as {user.userName}</p>
        </main>
      </div>
    </div>
  )
}

function PlaceholderPage({ menu }) {
  return <section className="rounded-2xl p-6 shadow-sm ring-1" style={{ background: 'var(--app-content-bg)', '--tw-ring-color': 'var(--app-border)' }}><h2 className="text-2xl font-bold">{menu?.menuName ?? 'BMWSystem'}</h2><p className="mt-2" style={{ color: 'var(--app-muted-text)' }}>This page is ready for its business functionality.</p></section>
}
