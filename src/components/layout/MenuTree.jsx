import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBed, faBox, faBoxOpen, faCalendarAlt, faCalendarCheck, faCalendarDay, faChartBar, faCheckCircle, faCircleCheck,
  faChevronDown, faChevronRight, faClipboardCheck, faClinicMedical, faCog, faCogs, faDesktop,
  faDolly, faDollyFlatbed, faDumpster, faFileInvoiceDollar, faHourglassHalf, faHospitalUser, faLifeRing, faPalette,
  faQrcode, faReceipt, faRecycle, faServer, faShoppingBag, faSlidersH, faTools, faTrashAlt,
  faUserCheck, faUserShield, faWarehouse,
} from '@fortawesome/free-solid-svg-icons'

const icons = {
  'fa-bed': faBed, 'fa-box': faBox, 'fa-box-open': faBoxOpen, 'fa-calendar-alt': faCalendarAlt,
  'fa-calendar-check': faCalendarCheck, 'fa-calendar-day': faCalendarDay,
  'fa-chart-bar': faChartBar, 'fa-check-circle': faCheckCircle, 'fa-circle-check': faCircleCheck, 'fa-clipboard-check': faClipboardCheck, 'fa-clinic-medical': faClinicMedical,
  'fa-cog': faCog, 'fa-cogs': faCogs, 'fa-desktop': faDesktop, 'fa-dolly': faDolly,
  'fa-dolly-flatbed': faDollyFlatbed, 'fa-dumpster': faDumpster, 'fa-file-invoice-dollar': faFileInvoiceDollar,
  'fa-hourglass-half': faHourglassHalf, 'fa-hospital-user': faHospitalUser, 'fa-life-ring': faLifeRing, 'fa-palette': faPalette,
  'fa-qrcode': faQrcode, 'fa-receipt': faReceipt, 'fa-recycle': faRecycle, 'fa-server': faServer,
  'fa-shopping-bag': faShoppingBag, 'fa-sliders-h': faSlidersH, 'fa-tools': faTools,
  'fa-trash-alt': faTrashAlt, 'fa-user-check': faUserCheck, 'fa-user-shield': faUserShield,
  'fa-warehouse': faWarehouse,
}

function MenuIcon({ name }) {
  const icon = icons[name]
  return icon ? <FontAwesomeIcon icon={icon} fixedWidth /> : <span className="inline-block w-4" aria-hidden="true" />
}

export default function MenuTree({ menus, currentPath, collapsed, mobileCollapsed = false, onNavigate, onClose }) {
  const [expandedMasterMenuId, setExpandedMasterMenuId] = useState(null)
  const [popupMasterMenuId, setPopupMasterMenuId] = useState(null)
  const [popupPosition, setPopupPosition] = useState(null)
  const popupRef = useRef(null)
  const closeTimer = useRef(null)
  const masters = menus.filter((menu) => menu.parentMenuId === null)
  const childrenByParent = new Map()
  menus.filter((menu) => menu.parentMenuId !== null).forEach((menu) => {
    const children = childrenByParent.get(menu.parentMenuId) ?? []
    children.push(menu)
    childrenByParent.set(menu.parentMenuId, children)
  })
  const currentParentMenuId = menus.find((menu) => menu.parentMenuId !== null && normalizePath(menu.menuUrl) === currentPath)?.parentMenuId ?? null

  useEffect(() => {
    setExpandedMasterMenuId(currentParentMenuId)
  }, [currentParentMenuId])

  useEffect(() => {
    if (!collapsed || mobileCollapsed) setPopupMasterMenuId(null)
  }, [collapsed, mobileCollapsed])

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  useEffect(() => {
    if (!popupMasterMenuId || !popupRef.current || !popupPosition) return
    const updatePopupPosition = () => {
      const popupBounds = popupRef.current?.getBoundingClientRect()
      if (!popupBounds) return
      const nextTop = Math.max(8, Math.min(popupPosition.top, window.innerHeight - popupBounds.height - 8))
      const nextLeft = Math.max(8, Math.min(popupPosition.left, window.innerWidth - popupBounds.width - 8))
      if (nextTop !== popupPosition.top || nextLeft !== popupPosition.left) {
        setPopupPosition((position) => ({ ...position, top: nextTop, left: nextLeft }))
      }
    }
    updatePopupPosition()
    window.addEventListener('resize', updatePopupPosition)
    return () => window.removeEventListener('resize', updatePopupPosition)
  }, [popupMasterMenuId, popupPosition])

  function closePopup() {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setPopupMasterMenuId(null)
      setPopupPosition(null)
    }, 180)
  }

  function keepPopupOpen() {
    window.clearTimeout(closeTimer.current)
  }

  function openPopup(masterId, element) {
    keepPopupOpen()
    const bounds = element.getBoundingClientRect()
    setPopupPosition({ left: bounds.right + 8, top: bounds.top })
    setPopupMasterMenuId(masterId)
  }

  function navigateMenu(menu) {
    setExpandedMasterMenuId(menu.parentMenuId ?? null)
    setPopupMasterMenuId(null)
    setPopupPosition(null)
    onNavigate(normalizePath(menu.menuUrl))
  }

  return (
    <nav className="space-y-1 px-3" aria-label="Main navigation">
      {masters.map((master) => {
        const children = childrenByParent.get(master.menuId) ?? []
        return (
          <MenuBranch
            key={master.menuId}
            menu={master}
            children={children}
            collapsed={collapsed}
            mobileCollapsed={mobileCollapsed}
            expanded={expandedMasterMenuId === master.menuId}
            popupOpen={popupMasterMenuId === master.menuId}
            popupPosition={popupPosition}
            popupRef={popupRef}
            currentPath={currentPath}
            onToggle={() => setExpandedMasterMenuId((current) => current === master.menuId ? null : master.menuId)}
            onOpenPopup={openPopup}
            onClosePopup={closePopup}
            onKeepPopupOpen={keepPopupOpen}
            onNavigate={navigateMenu}
            onClose={onClose}
          />
        )
      })}
      {!masters.length && <p className="px-3 py-4 text-sm opacity-70">No authorized menus.</p>}
    </nav>
  )
}

function MenuBranch({ menu, children, collapsed, mobileCollapsed, expanded, popupOpen, popupPosition, popupRef, currentPath, onToggle, onOpenPopup, onClosePopup, onKeepPopupOpen, onNavigate, onClose }) {
  const hasChildren = children.length > 0
  const popupCollapsed = collapsed
  const branchRef = useRef(null)
  const masterButtonRef = useRef(null)
  if (!hasChildren && menu.isContainer) return null
  if (!hasChildren) {
    return <MenuLink menu={menu} active={currentPath === normalizePath(menu.menuUrl)} collapsed={collapsed} inSidebar onNavigate={onNavigate} onClose={onClose} />
  }

  const popupId = `submenu-${menu.menuId}`
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      onClosePopup()
      masterButtonRef.current?.focus()
    }
    if (popupCollapsed && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      onOpenPopup(menu.menuId, event.currentTarget)
    }
    if (popupCollapsed && popupOpen && event.key === 'ArrowDown') {
      event.preventDefault()
      popupRef.current?.querySelector('button')?.focus()
    }
  }

  const handlePopupKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClosePopup()
      masterButtonRef.current?.focus()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const items = [...event.currentTarget.querySelectorAll('button')]
    const currentIndex = items.indexOf(document.activeElement)
    const nextIndex = event.key === 'ArrowDown'
      ? (currentIndex + 1) % items.length
      : (currentIndex - 1 + items.length) % items.length
    event.preventDefault()
    items[nextIndex]?.focus()
  }

  const handleBlur = (event) => {
    const nextTarget = event.relatedTarget
    if (!branchRef.current?.contains(nextTarget) && !popupRef.current?.contains(nextTarget)) onClosePopup()
  }

  return (
    <div ref={branchRef} className="group relative" onMouseEnter={(event) => popupCollapsed && !mobileCollapsed && onOpenPopup(menu.menuId, event.currentTarget.querySelector('button'))} onMouseLeave={() => popupCollapsed && !mobileCollapsed && onClosePopup()} onBlur={handleBlur}>
      <button ref={masterButtonRef} type="button" aria-expanded={popupCollapsed ? popupOpen : expanded} aria-controls={popupCollapsed && popupOpen ? popupId : undefined} title={collapsed ? menu.menuName : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold outline-none transition hover:opacity-80 focus-visible:ring-2 ${collapsed ? 'justify-center' : ''}`} style={{ color: 'var(--app-sidebar-text)', '--tw-ring-color': 'var(--app-focus-ring)' }} onClick={popupCollapsed ? (event) => onOpenPopup(menu.menuId, event.currentTarget) : onToggle} onFocus={(event) => popupCollapsed && onOpenPopup(menu.menuId, event.currentTarget)} onKeyDown={handleKeyDown}>
        <MenuIcon name={menu.iconClass} />
        {!collapsed && <span className="min-w-0 flex-1 truncate">{menu.menuName}</span>}
        {!collapsed && <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} className="text-xs opacity-70" />}
      </button>
      {!collapsed && expanded && <div className="ml-3 mt-1 space-y-1 border-l pl-2" style={{ borderColor: 'var(--app-border)' }}>
        {children.map((child) => <MenuLink key={child.menuId} menu={child} active={currentPath === normalizePath(child.menuUrl)} onNavigate={onNavigate} onClose={onClose} inSidebar />)}
      </div>}
      {popupCollapsed && popupOpen && popupPosition && createPortal(<div ref={popupRef} id={popupId} role="menu" className="sidebar-submenu-popup fixed z-[60] w-[min(14rem,calc(100vw-1rem))] rounded-xl border p-2 shadow-2xl" style={{ left: popupPosition.left, top: popupPosition.top, background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }} onMouseEnter={onKeepPopupOpen} onMouseLeave={() => !mobileCollapsed && onClosePopup()} onKeyDown={handlePopupKeyDown}>
        <div className="flex items-center gap-2 px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--app-muted-text)' }}>{menu.menuName}</p>
          {mobileCollapsed && <button type="button" aria-label="Close submenu" className="shrink-0 rounded p-1 text-base leading-none transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2" style={{ color: 'var(--app-muted-text)', '--tw-ring-color': 'var(--app-focus-ring)' }} onClick={onClosePopup}>x</button>}
        </div>
        {children.map((child) => <MenuLink key={child.menuId} menu={child} active={currentPath === normalizePath(child.menuUrl)} onNavigate={onNavigate} onClose={onClose} popup />)}
      </div>, document.body)}
    </div>
  )
}

function MenuLink({ menu, active, collapsed = false, onNavigate, onClose, inSidebar = false }) {
  return (
    <button type="button" role="menuitem" title={collapsed ? menu.menuName : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:opacity-80 focus-visible:ring-2 ${collapsed ? 'justify-center' : ''}`} style={active ? { background: 'var(--app-sidebar-active-bg)', color: 'var(--app-sidebar-active-text)' } : { color: inSidebar ? 'var(--app-sidebar-text)' : 'var(--app-text)', '--tw-ring-color': 'var(--app-focus-ring)' }} onClick={() => { onNavigate(menu); onClose?.() }}>
      <MenuIcon name={menu.iconClass} />
      {!collapsed && <span className="min-w-0 truncate">{menu.menuName}</span>}
    </button>
  )
}

export function normalizePath(value) {
  if (!value || value === '#') return '/'
  const withoutPrefix = value.replace(/^Frontend\//i, '')
  return `/${withoutPrefix.replace(/^\/+|\/+$/g, '').toLowerCase()}`
}
