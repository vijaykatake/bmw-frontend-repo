export default function Breadcrumbs({ menu }) {
  if (!menu) return null
  const labels = [menu.bedcrum01, menu.bedcrum02].filter(Boolean)
  if (!labels.length) return null
  return (
    <nav className="mb-5 text-sm" style={{ color: 'var(--app-muted-text)' }} aria-label="Breadcrumb">
      {labels.map((label, index) => <span key={`${label}-${index}`}>{index > 0 && <span className="mx-2">/</span>}<span className={index === labels.length - 1 ? 'font-semibold' : ''} style={index === labels.length - 1 ? { color: 'var(--app-text)' } : undefined}>{label}</span></span>)}
    </nav>
  )
}
