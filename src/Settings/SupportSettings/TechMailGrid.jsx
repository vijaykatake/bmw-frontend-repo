import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBan, faCheck, faClipboard, faDownload, faEdit, faFileExcel, faFilePdf, faFloppyDisk, faPlus, faSearch, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { API_BASE_URL } from '../../config/api.js'
import DataLoadingOverlay from '../../components/DataLoadingOverlay.jsx'

const emptyForm = { techMailId: null, mailType: '', email: '', isTechMailActive: true }
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function TechMailGrid({ settings, profile }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [fieldHints, setFieldHints] = useState({})
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState(null)
  const [confirmRecord, setConfirmRecord] = useState(null)
  const [errorDialog, setErrorDialog] = useState(null)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/support/tech-mail`, { credentials: 'include' })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.message || 'Unable to load Support Settings email records.')
      setRecords(result.records ?? [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => {
    if (!notification) return undefined
    const timer = window.setTimeout(() => setNotification(null), 5000)
    return () => window.clearTimeout(timer)
  }, [notification])

  const filteredRecords = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return records
    return records.filter((record) => [record.mailType, record.email, record.aUser, record.uUser].some((field) => String(field ?? '').toLowerCase().includes(value)))
  }, [records, search])

  function validate(values = form) {
    const nextErrors = {}
    if (!['TO', 'CC', 'BCC'].includes(values.mailType)) nextErrors.mailType = 'Select TO, CC, or BCC.'
    if (!values.email.trim()) nextErrors.email = 'Email is required.'
    else if (!emailPattern.test(values.email.trim())) nextErrors.email = 'Enter a valid email address.'
    setFieldErrors(nextErrors)
    setFieldHints({})
    return !Object.keys(nextErrors).length
  }

  function validateField(field) {
    const value = String(form[field] ?? '')
    let message = ''
    if (field === 'mailType' && !['TO', 'CC', 'BCC'].includes(value)) message = 'Select a Send Type.'
    if (field === 'email' && !value.trim()) message = 'Email is required.'
    else if (field === 'email' && !emailPattern.test(value.trim())) message = 'Enter a valid email address.'
    setFieldErrors((current) => {
      const next = { ...current }
      if (message) next[field] = message
      else delete next[field]
      return next
    })
    setFieldHints((current) => ({ ...current, [field]: Boolean(message) }))
  }

  function openAdd() { setForm(emptyForm); setFieldErrors({}); setFieldHints({}); setModalOpen(true) }
  function openEdit(record) { setForm({ techMailId: record.techMailId, mailType: record.mailType, email: record.email, isTechMailActive: record.isTechMailActive }); setFieldErrors({}); setFieldHints({}); setModalOpen(true) }

  async function save(event) {
    event.preventDefault()
    if (!validate() || saving) return
    setSaving(true)
    const transactionValue = form.techMailId ? 2 : 1
    try {
      const response = await fetch(`${API_BASE_URL}/api/support/tech-mail/transaction`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, email: form.email.trim(), transactionValue }) })
      const result = await response.json()
      await handleTransaction(result, response.ok, transactionValue === 1 ? 'TechMail added successfully.' : 'TechMail updated successfully.')
    } catch (saveError) {
      showError(saveError.message)
    } finally { setSaving(false) }
  }

  async function deleteRecord() {
    if (!confirmRecord) return
    const record = confirmRecord
    setConfirmRecord(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/support/tech-mail/transaction`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ techMailId: record.techMailId, mailType: record.mailType, email: record.email, isTechMailActive: false, transactionValue: 3 }) })
      const result = await response.json()
      await handleTransaction(result, response.ok, 'TechMail deleted successfully.', true)
    } catch (deleteError) { showError(deleteError.message) }
  }

  async function handleTransaction(result, responseOk, successMessage, deletion = false) {
    const resultId = Number(result?.ResultID ?? result?.resultID ?? result?.resultId)
    const messageId = Number(result?.TransMessageId ?? result?.transMessageId ?? result?.transMessageID)
    const transactionMessage = result?.TransMessage ?? result?.transMessage ?? result?.message
    const standardMessage = messageId === 5050 ? 'TechMail added successfully.' : messageId === 5051 ? 'TechMail updated successfully.' : messageId === 5052 ? 'TechMail deleted successfully.' : successMessage
    if (!responseOk || resultId === 206) { showError(result?.TransMessage ?? result?.transMessage ?? result?.message ?? 'The TechMail operation failed.'); return }
    if (resultId === 203) { setNotification({ type: 'danger', icon: faBan, message: transactionMessage ?? 'The active TO email business rule prevents this operation.' }); return }
    if (resultId === 201) { setNotification({ type: 'danger', message: transactionMessage ?? 'The TechMail operation was rejected.' }); return }
    if ([202, 204, 205].includes(resultId)) { setNotification({ type: deletion ? 'danger' : 'success', icon: deletion ? faCheck : null, message: transactionMessage || standardMessage }); setModalOpen(false); await loadData(); return }
    setNotification({ type: 'success', message: transactionMessage || standardMessage })
  }

  function showError(message) {
    setErrorDialog(message)
  }

  const exportRows = filteredRecords.slice(0, pageSize)
  const columns = [['Send To', (row) => row.mailType], ['Email', (row) => row.email], ['Active', (row) => row.isTechMailActive ? 'Yes' : 'No'], ['AUser', (row) => row.aUser ?? ''], ['ADate', (row) => row.aDate ?? ''], ['UUser', (row) => row.uUser ?? ''], ['UDate', (row) => row.uDate ?? '']]

  function exportCsv() { downloadFile(csvText(exportRows, columns), 'Support Settings.csv', 'text/csv;charset=utf-8') }
  function exportExcel() { downloadFile(`<html><head><meta charset="utf-8"></head><body><h1>Support Settings</h1><table><thead><tr>${columns.map(([name]) => `<th>${name}</th>`).join('')}</tr></thead><tbody>${exportRows.map((row) => `<tr>${columns.map(([, value]) => `<td>${escapeHtml(value(row))}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`, 'Support Settings.xls', 'application/vnd.ms-excel') }
  async function copyExport() { await navigator.clipboard?.writeText(csvText(exportRows, columns)); setNotification({ type: 'success', message: 'Support Settings data copied to the clipboard.' }) }
  async function exportPdf() {
    const previewWindow = window.open('', '_blank')
    if (!previewWindow) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const generated = new Date().toLocaleString()
    const theme = getPdfTheme()
    const logo = await loadImageData(settings?.hospitalLogoUrl)
    if (logo) doc.addImage(logo, 'PNG', 12, 8, 24, 15)
    doc.setTextColor(...toRgb(theme.text))
    doc.setFontSize(16)
    doc.text('Support Settings', 148, 16, { align: 'center' })
    doc.setFontSize(8)
    doc.text(generated, 285, 14, { align: 'right' })
    doc.text(`Generated By: ${profile?.userName ?? ''}`, 285, 20, { align: 'right' })
    doc.setDrawColor(...toRgb(theme.primary))
    doc.setLineWidth(0.6)
    doc.line(12, 25, 285, 25)
    autoTable(doc, { startY: 28, head: [columns.map(([name]) => name)], body: exportRows.map((row) => columns.map(([, value]) => String(value(row) ?? ''))), margin: { left: 12, right: 12 }, styles: { fontSize: 8, textColor: toRgb(theme.text), fillColor: toRgb(theme.content), lineColor: toRgb(theme.border) }, headStyles: { fillColor: toRgb(theme.page), textColor: toRgb(theme.muted), lineColor: toRgb(theme.border) } })
    const previewUrl = doc.output('bloburl')
    previewWindow.location.href = previewUrl
  }
function getPdfTheme() { const styles = getComputedStyle(document.documentElement); return { primary: styles.getPropertyValue('--app-primary').trim() || '#0284c7', text: styles.getPropertyValue('--app-text').trim() || '#0f172a', muted: styles.getPropertyValue('--app-muted-text').trim() || '#64748b', border: styles.getPropertyValue('--app-border').trim() || '#cbd5e1', page: styles.getPropertyValue('--app-page-bg').trim() || '#f8fafc', content: styles.getPropertyValue('--app-content-bg').trim() || '#ffffff' } }
function toRgb(color) { const value = color.replace('#', ''); const hex = value.length === 3 ? value.split('').map((part) => part + part).join('') : value; return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)] }

  return (
    <section className="relative rounded-2xl p-4 shadow-sm ring-1 sm:p-6" style={{ background: 'var(--app-content-bg)', '--tw-ring-color': 'var(--app-border)' }}>
      {notification && <TransactionNotice notification={notification} onDismiss={() => setNotification(null)} />}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold">Email Support</h2><p className="mt-1 text-sm" style={{ color: 'var(--app-muted-text)' }}>Manage support email recipients.</p></div>
        <button type="button" className="flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--app-primary)', color: 'var(--app-sidebar-active-text)' }} onClick={openAdd}><FontAwesomeIcon icon={faPlus} />Add</button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[12rem] flex-1 basis-64"><span className="sr-only">Search Support Settings email records</span><FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-sm" style={{ color: 'var(--app-muted-text)' }} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Email Support" className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm outline-none focus-visible:ring-2" style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)', '--tw-ring-color': 'var(--app-focus-ring)' }} /></label>
        <div className="flex flex-wrap gap-2"><ExportButton icon={faFilePdf} label="PDF" onClick={exportPdf} /><ExportButton icon={faFileExcel} label="Excel" onClick={exportExcel} /><ExportButton icon={faDownload} label="CSV" onClick={exportCsv} /><ExportButton icon={faClipboard} label="Copy" onClick={copyExport} /></div>
        <label className="flex items-center gap-2 text-sm sm:ml-auto" style={{ color: 'var(--app-muted-text)' }}>Records<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-10 rounded-lg border px-2" style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)' }}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label>
      </div>
      {error && <p className="mb-4 rounded-lg border p-3 text-sm" style={{ color: '#b91c1c', borderColor: 'var(--app-border)' }}>{error}</p>}
      <div className="relative overflow-x-auto rounded-xl border" aria-busy={loading} style={{ borderColor: 'var(--app-border)' }}><table className="min-w-[980px] w-full text-left text-sm"><thead style={{ background: 'var(--app-page-bg)', color: 'var(--app-muted-text)' }}><tr>{columns.map(([name]) => <th key={name} className="whitespace-nowrap px-3 py-3 font-semibold">{name}</th>)}<th className="px-3 py-3 font-semibold">Action</th></tr></thead><tbody>{loading ? <tr><td colSpan="8" className="px-3 py-8 text-center">Loading Support Settings records...</td></tr> : !exportRows.length ? <tr><td colSpan="8" className="px-3 py-8 text-center" style={{ color: 'var(--app-muted-text)' }}>No Support Settings email records found.</td></tr> : exportRows.map((record) => <tr key={record.techMailId} className="border-t" style={{ borderColor: 'var(--app-border)' }}><td className="px-3 py-3"><MailTypeBadge type={record.mailType} /></td><td className={`px-3 py-3 ${!emailPattern.test(record.email) ? 'font-semibold text-red-700' : ''}`}>{record.email}</td><td className="px-3 py-3 text-center"><ActiveToggle active={record.isTechMailActive} /></td><td className="px-3 py-3">{record.aUser || '-'}</td><td className="whitespace-nowrap px-3 py-3">{record.aDate || '-'}</td><td className="px-3 py-3">{record.uUser || '-'}</td><td className="whitespace-nowrap px-3 py-3">{record.uDate || '-'}</td><td className="px-3 py-3"><div className="flex gap-1"><IconButton label={`Edit TechMail ${record.email}`} icon={faEdit} onClick={() => openEdit(record)} /><IconButton label={`Delete TechMail ${record.email}`} icon={faTrash} onClick={() => setConfirmRecord(record)} /></div></td></tr>)}</tbody></table>{loading && <DataLoadingOverlay message="Loading Support Settings records, please wait" />}</div>
      {modalOpen && <TechMailModal form={form} setForm={setForm} errors={fieldErrors} hints={fieldHints} validateField={validateField} saving={saving} onClose={() => !saving && setModalOpen(false)} onSubmit={save} editing={Boolean(form.techMailId)} />}{confirmRecord && <ConfirmDialog record={confirmRecord} onNo={() => setConfirmRecord(null)} onYes={deleteRecord} />}{errorDialog && <ErrorDialog message={errorDialog} onClose={() => setErrorDialog(null)} />}
    </section>
  )
}

function TransactionNotice({ notification, onDismiss }) {
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    setClosing(false)
    const closeTimer = window.setTimeout(() => setClosing(true), 4500)
    const dismissTimer = window.setTimeout(onDismiss, 5000)
    return () => {
      window.clearTimeout(closeTimer)
      window.clearTimeout(dismissTimer)
    }
  }, [notification, onDismiss])

  const accent = notification.type === 'success' ? '#15803d' : '#b91c1c'
  const accentDark = notification.type === 'success' ? '#166534' : '#991b1b'
  return <div className={`transaction-notice fixed right-4 top-4 z-[100] flex w-max max-w-[calc(100vw-2rem)] flex-col items-center gap-1 rounded-xl border p-3 pt-3 text-center text-base shadow-2xl ${closing ? 'transaction-notice-closing' : ''}`} style={{ '--notice-accent': accent, '--notice-accent-dark': accentDark, background: 'var(--app-content-bg)', color: accent, borderColor: accent }}><span className="transaction-notice-icon"><FontAwesomeIcon icon={notification.icon || (notification.type === 'success' ? faCheck : faXmark)} /></span><span className="transaction-notice-message">{notification.message}</span></div>
}

function ErrorDialog({ message, onClose }) {
  async function copy() { await navigator.clipboard?.writeText(message) }
  return <div className="fixed inset-0 z-[67] flex items-center justify-center p-4" style={{ background: 'var(--app-overlay-bg)' }}><div role="alertdialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border p-5 shadow-2xl" style={{ background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: '#b91c1c' }}><h3 className="text-lg font-bold" style={{ color: '#b91c1c' }}>TechMail operation error</h3><p className="mt-3 break-words text-sm">{message}</p><div className="mt-5 flex justify-end gap-2"><button type="button" className="flex items-center gap-2 rounded-lg border px-4 py-2" style={{ borderColor: 'var(--app-border)' }} onClick={copy}><FontAwesomeIcon icon={faClipboard} />Copy</button><button type="button" className="rounded-lg px-4 py-2" style={{ background: 'var(--app-primary)', color: 'var(--app-sidebar-active-text)' }} onClick={onClose}>Close</button></div></div></div>
}

function TechMailModal({ form, setForm, errors, hints, validateField, saving, onClose, onSubmit, editing }) {
  return <div className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto p-4" style={{ background: 'var(--app-overlay-bg)' }}><form onSubmit={onSubmit} className="w-full max-w-lg rounded-2xl border p-5 shadow-2xl sm:max-w-[38.8rem]" style={{ background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}><div className="mb-5 flex items-center justify-between gap-3"><h3 className="flex min-w-0 flex-nowrap items-center gap-1.5 text-sm font-medium sm:text-base"><span className="flex shrink-0 items-center gap-1.5" style={{ color: 'var(--app-primary)' }}><FontAwesomeIcon icon={editing ? faEdit : faPlus} />{editing ? 'Edit TechMail' : 'Add New'}</span>{editing && <><span style={{ color: 'var(--app-muted-text)' }}>&gt;</span><span className="min-w-0 truncate" style={{ color: 'var(--app-text)' }}>{form.email}</span></>}</h3><button type="button" aria-label="Close" title="Close" className="flex h-10 w-10 items-center justify-center rounded-full border shadow-md" style={{ background: 'var(--app-page-bg)', color: 'var(--app-primary)', borderColor: 'var(--app-border)' }} onClick={onClose}><FontAwesomeIcon icon={faXmark} /></button></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-[35fr_45fr_30fr] sm:items-start"><Field label="Send Type" required error={errors.mailType} hint={hints.mailType}><select value={form.mailType} onBlur={() => validateField('mailType')} onChange={(event) => setForm({ ...form, mailType: event.target.value })} className="h-11 w-full rounded-lg border px-3" style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)' }}><option value="">Select Send Type</option><option value="TO">TO</option><option value="CC">CC</option><option value="BCC">BCC</option></select></Field><Field label="Email" required error={errors.email} hint={hints.email}><input type="email" value={form.email} maxLength="50" onBlur={() => validateField('email')} onChange={(event) => setForm({ ...form, email: event.target.value })} className="h-11 w-full rounded-lg border px-3" style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)' }} /></Field><div className="flex self-start mt-2 items-center justify-center gap-2 text-sm"><span className="font-semibold" style={{ color: 'var(--app-primary)' }}>Active</span><ActiveField active={form.isTechMailActive} onChange={(value) => setForm({ ...form, isTechMailActive: value })} /></div></div><div className="flex justify-end gap-2"><button type="button" className="flex items-center gap-2 rounded-lg border px-4 py-2" style={{ borderColor: 'var(--app-border)' }} onClick={onClose}><FontAwesomeIcon icon={faBan} />Cancel</button><button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg px-4 py-2 font-semibold disabled:opacity-60" style={{ background: 'var(--app-primary)', color: 'var(--app-sidebar-active-text)' }}><FontAwesomeIcon icon={faFloppyDisk} />{saving ? 'Saving...' : 'Save'}</button></div></form></div>
}

function Field({ label, required, error, hint, children }) { return <label className="relative mb-4 block pt-2 text-sm font-medium"><span className="pointer-events-none absolute left-3 top-0 z-10 px-1 text-sm font-semibold" style={{ background: 'var(--app-content-bg)', color: 'var(--app-primary)' }}>{label}{required && <span aria-hidden="true" className="ml-1" style={{ color: 'color-mix(in srgb, #b91c1c 55%, var(--app-content-bg))' }}>*</span>}</span>{children}<span className={`mt-1 block text-sm font-semibold ${hint ? 'text-right' : 'text-left'}`} style={{ color: hint ? 'var(--app-primary)' : '#b91c1c' }}>{error || ''}</span></label>
}

function ActiveToggle({ active }) { return <span role="img" aria-label={active ? 'Active' : 'Inactive'} title={active ? 'Active' : 'Inactive'} className="mx-auto inline-flex h-6 w-11 items-center rounded-full p-0.5 shadow-inner" style={{ background: active ? 'var(--app-primary)' : 'var(--app-muted-text)' }}><span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`} /></span> }
function ActiveField({ active, onChange }) {
  return <label className="inline-flex h-6 w-11 cursor-pointer items-center rounded-full p-0.5 shadow-inner" style={{ background: active ? 'var(--app-primary)' : 'var(--app-muted-text)' }}><input type="checkbox" checked={active} onChange={(event) => onChange(event.target.checked)} aria-label="Active" className="sr-only" /><span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`} /></label>
}
function MailTypeBadge({ type }) { return <span className="inline-flex rounded-full px-2 py-1 text-xs font-semibold" style={{ background: type === 'TO' ? 'color-mix(in srgb, var(--app-primary) 18%, var(--app-content-bg))' : type === 'CC' ? 'color-mix(in srgb, var(--app-focus-ring) 18%, var(--app-content-bg))' : 'color-mix(in srgb, var(--app-muted-text) 18%, var(--app-content-bg))', color: 'var(--app-text)' }}>{type}</span> }
function ExportButton({ icon, label, onClick }) { return <button type="button" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition hover:opacity-80" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }} onClick={onClick}><FontAwesomeIcon icon={icon} />{label}</button> }
function IconButton({ icon, label, onClick }) { return <button type="button" aria-label={label} title={label} className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:opacity-80" style={{ color: 'var(--app-text)' }} onClick={onClick}><FontAwesomeIcon icon={icon} /></button> }
function ConfirmDialog({ record, onNo, onYes }) { return <div className="fixed inset-0 z-[66] flex items-center justify-center p-4" style={{ background: 'var(--app-overlay-bg)' }}><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border p-5 shadow-2xl" style={{ background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}><h3 className="text-lg font-bold">Confirm deletion</h3><p className="mt-3 text-sm">Are you sure you want to delete TechMail '{record.email}'?</p><div className="mt-5 flex justify-end gap-2"><button type="button" autoFocus className="rounded-lg border px-4 py-2" style={{ borderColor: 'var(--app-border)' }} onClick={onNo}>No</button><button type="button" className="rounded-lg px-4 py-2 font-semibold" style={{ background: '#b91c1c', color: '#fff' }} onClick={onYes}>Yes</button></div></div></div> }
function csvText(rows, columns) { return [columns.map(([name]) => name).join(','), ...rows.map((row) => columns.map(([, value]) => `"${String(value(row) ?? '').replaceAll('"', '""')}"`).join(','))].join('\n') }
function downloadFile(content, filename, type) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url) }
function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') }
async function loadImageData(url) {
  if (!url) return null
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}
