import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faHouse } from '@fortawesome/free-solid-svg-icons'

export default function Breadcrumbs({ menu }) {
  if (!menu) return null
  const labels = [menu.bedcrum01, menu.bedcrum02].filter(Boolean)
  if (!labels.length) return null
  return (
    <nav className="mb-5 overflow-x-auto rounded-xl border px-3 py-2.5 text-sm shadow-sm sm:px-4" style={{ background: 'var(--app-content-bg)', borderColor: 'var(--app-border)', color: 'var(--app-muted-text)' }} aria-label="Breadcrumb">
      <ol className="flex min-w-max items-center gap-2 whitespace-nowrap">
        <li className="flex items-center">
          <FontAwesomeIcon icon={faHouse} className="text-xs" style={{ color: 'var(--app-primary)' }} aria-hidden="true" />
          <span className="sr-only">Home</span>
        </li>
        {labels.map((label, index) => <li key={`${label}-${index}`} className="flex items-center gap-2"><FontAwesomeIcon icon={faChevronRight} className="text-[0.65rem]" style={{ color: 'var(--app-border)' }} aria-hidden="true" /><span className={index === labels.length - 1 ? 'rounded-md px-2 py-1 font-semibold' : 'px-1'} style={index === labels.length - 1 ? { background: 'color-mix(in srgb, var(--app-primary) 12%, var(--app-content-bg))', color: 'var(--app-primary)' } : undefined} aria-current={index === labels.length - 1 ? 'page' : undefined}>{label}</span></li>)}
      </ol>
    </nav>
  )
}
