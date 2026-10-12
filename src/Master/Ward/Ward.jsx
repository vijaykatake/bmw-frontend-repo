import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faClipboard, faDownload, faEdit, faEnvelope, faFileExcel, faFilePdf, faPlus, faSearch, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import { API_BASE_URL } from '../../config/api.js'

const initialForm = { wardId: null, stationId: '0', wardName: '', wardDescription: '', isWardActive: true }

export default function Ward() {
  const [records, setRecords] = useState([])
  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState(null)
  const [confirmRecord, setConfirmRecord] = useState(null)
  const [errorDialog, setErrorDialog] = useState(null)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/master/ward`, { credentials: 'include' })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.transMessage || result?.message || 'Unable to load Ward data.')
      setRecords(result.records ?? [])
      setStations(result.stations ?? [])
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
    return records.filter((record) => [record.stationName, record.wardName, record.wardDescription, record.aUser, record.uUser].some((field) => String(field ?? '').toLowerCase().includes(value)))
  }, [records, search])

  function openAdd() {
    setForm(initialForm)
    setFieldErrors({})
    setModalOpen(true)
  }

  function openEdit(record) {
    const station = stations.find((item) => item.stationName === record.stationName)
    setForm({ wardId: record.wardId, stationId: station?.stationId?.toString() ?? '0', wardName: record.wardName ?? '', wardDescription: record.wardDescription ?? '', isWardActive: Boolean(record.isWardActive) })
    setFieldErrors({})
    setModalOpen(true)
  }

  function validate() {
    const nextErrors = {}
    if (!form.stationId || form.stationId === '0') nextErrors.stationId = 'Select a Station.'
    if (form.wardName.trim().length < 3) nextErrors.wardName = 'Ward must contain at least 3 characters.'
    if (form.wardDescription.trim().length < 15) nextErrors.wardDescription = 'Description must contain at least 15 characters.'
    setFieldErrors(nextErrors)
    return !Object.keys(nextErrors).length
  }

  async function save(event) {
    event.preventDefault()
    if (!validate() || saving) return
    setSaving(true)
    const transactionValue = form.wardId ? 2 : 1
    try {
      const response = await fetch(`${API_BASE_URL}/api/master/ward/transaction`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionValue, wardId: form.wardId, stationId: Number(form.stationId), wardName: form.wardName.trim(), wardDescription: form.wardDescription.trim(), isWardActive: form.isWardActive }),
      })
      const result = await response.json()
      await handleTransaction(result, response.ok, transactionValue === 1 ? 'Ward added successfully.' : 'Ward updated successfully.')
    } catch (saveError) {
      showError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteRecord() {
    if (!confirmRecord) return
    const record = confirmRecord
    setConfirmRecord(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/master/ward/transaction`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionValue: 3, wardId: record.wardId, stationId: 0, wardName: record.wardName, wardDescription: record.wardDescription, isWardActive: false }),
      })
      const result = await response.json()
      await handleTransaction(result, response.ok, 'Ward deleted successfully.')
    } catch (deleteError) {
      showError(deleteError.message)
    }
  }

  async function handleTransaction(result, responseOk, successMessage) {
    const resultId = Number(result?.ResultID ?? result?.resultID ?? result?.resultId)
    if (!responseOk || resultId === 206) {
      showError(result?.TransMessage ?? result?.transMessage ?? result?.message ?? 'The Ward operation failed.')
      return
    }
    if (resultId === 201) {
      setNotification({ type: 'danger', message: result.TransMessage })
      return
    }
    if ([202, 204, 205].includes(resultId)) {
      setNotification({ type: resultId === 205 ? 'danger' : 'success', message: result.TransMessage || successMessage })
      setModalOpen(false)
      await loadData()
      return
    }
    if (resultId === 207) {
      setNotification({ type: 'danger', message: result.TransMessage })
      window.setTimeout(() => fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' }).then(() => window.location.reload()), 10000)
      return
    }
    setNotification({ type: 'success', message: result.TransMessage || successMessage })
  }

  function showError(message) {
    setErrorDialog(message)
  }

  const exportRows = filteredRecords.slice(0, pageSize)
  const columns = [
    ['Station', (row) => row.stationName ?? ''], ['Ward', (row) => row.wardName], ['Description', (row) => row.wardDescription],
    ['Active', (row) => row.isWardActive ? 'Yes' : 'No'], ['AUser', (row) => row.aUser ?? ''], ['ADate', (row) => row.aDate ?? ''],
    ['UUser', (row) => row.uUser ?? ''], ['UDate', (row) => row.uDate ?? ''],
  ]

  function exportCsv() {
    downloadFile(`${csvText(exportRows, columns)}`, 'Ward.csv', 'text/csv;charset=utf-8')
  }

  function exportExcel() {
    const body = exportRows.map((row) => `<tr>${columns.map(([, value]) => `<td>${escapeHtml(value(row))}</td>`).join('')}</tr>`).join('')
    const html = `<html><head><meta charset="utf-8"></head><body><h1>Ward</h1><table><thead><tr>${columns.map(([name]) => `<th>${name}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></body></html>`
    downloadFile(html, 'Ward.xls', 'application/vnd.ms-excel')
  }

  async function copyExport() {
    await navigator.clipboard?.writeText(csvText(exportRows, columns))
    setNotification({ type: 'success', message: 'Ward data copied to the clipboard.' })
  }

  function exportPdf() {
    const generated = new Date().toLocaleString()
    const body = exportRows.map((row) => `<tr>${columns.map(([, value]) => `<td>${escapeHtml(value(row))}</td>`).join('')}</tr>`).join('')
    const printWindow = window.open('', '_blank', 'width=1100,height=750')
    if (!printWindow) return
    printWindow.document.write(`<html><head><title>Ward</title><style>@page{margin:18mm}body{font:12px Arial;color:#111}h1{margin-bottom:4px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px;text-align:left}th{background:#eee}@media print{footer:after{content:'Page ' counter(page)}}</style></head><body><h1>Ward</h1><p>Generated: ${escapeHtml(generated)}</p><table><thead><tr>${columns.map(([name]) => `<th>${name}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table><footer></footer><script>window.onload=()=>window.print()</script></body></html>`)
    printWindow.document.close()
  }

  return <section className="relative rounded-2xl p-4 shadow-sm ring-1 sm:p-6" style={{ background: 'var(--app-content-bg)', '--tw-ring-color': 'var(--app-border)' }}>
    {notification && <div className="fixed right-4 top-20 z-[70] flex max-w-sm items-start gap-3 rounded-xl border p-4 text-sm shadow-xl" style={{ background: 'var(--app-content-bg)', color: notification.type === 'success' ? '#15803d' : '#b91c1c', borderColor: 'var(--app-border)' }}><FontAwesomeIcon icon={notification.type === 'success' ? faCheck : faXmark} /><span>{notification.message}</span></div>}
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Ward</h2><p className="mt-1 text-sm" style={{ color: 'var(--app-muted-text)' }}>Manage hospital wards.</p></div><button type="button" className="flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--app-primary)', color: 'var(--app-sidebar-active-text)' }} onClick={openAdd}><FontAwesomeIcon icon={faPlus} />Add</button></div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><label className="relative min-w-[12rem] flex-1 sm:max-w-sm"><span className="sr-only">Search Ward records</span><FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-sm" style={{ color: 'var(--app-muted-text)' }} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Ward" className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm outline-none focus-visible:ring-2" style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)', '--tw-ring-color': 'var(--app-focus-ring)' }} /></label><label className="flex items-center gap-2 text-sm" style={{ color: 'var(--app-muted-text)' }}>Records<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-10 rounded-lg border px-2" style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)' }}><option value="10">10</option><option value="25">25</option><option value="50">50</option></select></label></div>
    {error && <p className="mb-4 rounded-lg border p-3 text-sm" style={{ color: '#b91c1c', borderColor: 'var(--app-border)' }}>{error}</p>}
    <div className="mb-4 flex flex-wrap gap-2"><ExportButton icon={faFilePdf} label="PDF" onClick={exportPdf} /><ExportButton icon={faFileExcel} label="Excel" onClick={exportExcel} /><ExportButton icon={faDownload} label="CSV" onClick={exportCsv} /><ExportButton icon={faClipboard} label="Copy" onClick={copyExport} /></div>
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--app-border)' }}><table className="min-w-[1100px] w-full text-left text-sm"><thead style={{ background: 'var(--app-page-bg)', color: 'var(--app-muted-text)' }}><tr>{columns.map(([name]) => <th key={name} className="whitespace-nowrap px-3 py-3 font-semibold">{name}</th>)}<th className="px-3 py-3 font-semibold">Action</th></tr></thead><tbody>{loading ? <tr><td colSpan="9" className="px-3 py-8 text-center">Loading Ward records...</td></tr> : !exportRows.length ? <tr><td colSpan="9" className="px-3 py-8 text-center" style={{ color: 'var(--app-muted-text)' }}>No Ward records found.</td></tr> : exportRows.map((record) => <tr key={record.wardId} className="border-t" style={{ borderColor: 'var(--app-border)' }}><td className="px-3 py-3">{record.stationName}</td><td className="px-3 py-3 font-medium">{record.wardName}</td><td className="max-w-xs truncate px-3 py-3">{record.wardDescription}</td><td className="px-3 py-3"><FontAwesomeIcon icon={record.isWardActive ? faCheck : faXmark} title={record.isWardActive ? 'Active' : 'Inactive'} aria-label={record.isWardActive ? 'Active' : 'Inactive'} style={{ color: record.isWardActive ? '#16a34a' : '#9ca3af' }} /></td><td className="px-3 py-3">{record.aUser || '-'}</td><td className="whitespace-nowrap px-3 py-3">{record.aDate || '-'}</td><td className="px-3 py-3">{record.uUser || '-'}</td><td className="whitespace-nowrap px-3 py-3">{record.uDate || '-'}</td><td className="px-3 py-3"><div className="flex gap-1"><IconButton label={`Edit Ward ${record.wardName}`} icon={faEdit} onClick={() => openEdit(record)} /><IconButton label={`Delete Ward ${record.wardName}`} icon={faTrash} onClick={() => setConfirmRecord(record)} /></div></td></tr>)}</tbody></table></div>
    {modalOpen && <WardModal form={form} setForm={setForm} stations={stations} errors={fieldErrors} saving={saving} onClose={() => !saving && setModalOpen(false)} onSubmit={save} editing={Boolean(form.wardId)} />}
    {confirmRecord && <ConfirmDialog record={confirmRecord} onNo={() => setConfirmRecord(null)} onYes={deleteRecord} />}
    {errorDialog && <ErrorDialog message={errorDialog} onClose={() => setErrorDialog(null)} />}
  </section>
}

function WardModal({ form, setForm, stations, errors, saving, onClose, onSubmit, editing }) {
  return <div className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto p-4" style={{ background: 'var(--app-overlay-bg)' }}><form onSubmit={onSubmit} className="w-full max-w-lg rounded-2xl border p-5 shadow-2xl" style={{ background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}><div className="mb-5 flex items-center justify-between"><h3 className="text-xl font-bold">{editing ? `Edit Ward : ${form.wardName}` : 'Add New'}</h3><button type="button" aria-label="Close" className="rounded-lg p-2" onClick={onClose}>x</button></div><Field label="Station" error={errors.stationId}><select value={form.stationId} onChange={(event) => setForm({ ...form, stationId: event.target.value })} className="h-11 w-full rounded-lg border px-3" style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)' }}><option value="0">Select Station</option>{stations.map((station) => <option key={station.stationId} value={station.stationId}>{station.stationName}</option>)}</select></Field><Field label="Ward" error={errors.wardName}><input value={form.wardName} maxLength="150" onChange={(event) => setForm({ ...form, wardName: event.target.value })} className="h-11 w-full rounded-lg border px-3" style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)' }} /></Field><Field label="Description" error={errors.wardDescription}><textarea value={form.wardDescription} maxLength="2000" rows="4" onChange={(event) => setForm({ ...form, wardDescription: event.target.value })} className="w-full rounded-lg border px-3 py-2" style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)' }} /></Field><label className="mb-5 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isWardActive} onChange={(event) => setForm({ ...form, isWardActive: event.target.checked })} />Active</label><div className="flex justify-end gap-2"><button type="button" className="rounded-lg border px-4 py-2" style={{ borderColor: 'var(--app-border)' }} onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="rounded-lg px-4 py-2 font-semibold disabled:opacity-60" style={{ background: 'var(--app-primary)', color: 'var(--app-sidebar-active-text)' }}>{saving ? 'Saving...' : 'Save'}</button></div></form></div>
}

function ConfirmDialog({ record, onNo, onYes }) {
  const noRef = useRef(null)
  useEffect(() => { noRef.current?.focus() }, [])
  return <div className="fixed inset-0 z-[66] flex items-center justify-center p-4" style={{ background: 'var(--app-overlay-bg)' }}><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border p-5 shadow-2xl" style={{ background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}><h3 className="text-lg font-bold">Confirm deletion</h3><p className="mt-3 text-sm">Are you sure you want to delete Ward '{record.wardName}'?</p><div className="mt-5 flex justify-end gap-2"><button ref={noRef} type="button" className="rounded-lg border px-4 py-2" style={{ borderColor: 'var(--app-border)' }} onClick={onNo}>No</button><button type="button" className="rounded-lg px-4 py-2 font-semibold" style={{ background: '#b91c1c', color: '#fff' }} onClick={onYes}>Yes</button></div></div></div>
}

function ErrorDialog({ message, onClose }) {
  async function copy() { await navigator.clipboard?.writeText(message) }
  async function prepareEmail() { await fetch(`${API_BASE_URL}/api/master/ward/email-error`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) }) }
  return <div className="fixed inset-0 z-[67] flex items-center justify-center p-4" style={{ background: 'var(--app-overlay-bg)' }}><div role="alertdialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border p-5 shadow-2xl" style={{ background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: '#b91c1c' }}><h3 className="text-lg font-bold" style={{ color: '#b91c1c' }}>Ward operation error</h3><p className="mt-3 break-words text-sm">{message}</p><div className="mt-5 flex justify-end gap-2"><button type="button" className="flex items-center gap-2 rounded-lg border px-4 py-2" style={{ borderColor: 'var(--app-border)' }} onClick={copy}><FontAwesomeIcon icon={faClipboard} />Copy</button><button type="button" className="flex items-center gap-2 rounded-lg border px-4 py-2" style={{ borderColor: 'var(--app-border)' }} onClick={prepareEmail}><FontAwesomeIcon icon={faEnvelope} />Email</button><button type="button" className="rounded-lg px-4 py-2" style={{ background: 'var(--app-primary)', color: 'var(--app-sidebar-active-text)' }} onClick={onClose}>Close</button></div></div></div>
}

function Field({ label, error, children }) { return <label className="mb-4 block text-sm font-medium">{label}{children}<span className="mt-1 block text-xs font-normal" style={{ color: '#b91c1c' }}>{error || ''}</span></label> }
function ExportButton({ icon, label, onClick }) { return <button type="button" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition hover:opacity-80" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }} onClick={onClick}><FontAwesomeIcon icon={icon} />{label}</button> }
function IconButton({ icon, label, onClick }) { return <button type="button" aria-label={label} title={label} className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:opacity-80 focus-visible:ring-2" style={{ color: 'var(--app-text)', '--tw-ring-color': 'var(--app-focus-ring)' }} onClick={onClick}><FontAwesomeIcon icon={icon} /></button> }
function csvText(rows, columns) { return [columns.map(([name]) => name).join(','), ...rows.map((row) => columns.map(([, value]) => `"${String(value(row) ?? '').replaceAll('"', '""')}"`).join(','))].join('\n') }
function downloadFile(content, filename, type) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url) }
function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') }
