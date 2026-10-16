import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBan, faCheck, faChevronRight, faClipboard, faDownload, faEdit,
  faEnvelope, faFileExcel, faFilePdf, faFloppyDisk, faPlus, faSearch, faTrash, faXmark
} from '@fortawesome/free-solid-svg-icons'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { API_BASE_URL } from '../../config/api.js'
import DataLoadingOverlay from '../../components/DataLoadingOverlay.jsx'

const initialForm = {
  storageAreaId: null,
  storageAreaName: '',
  storageAreaDescription: '',
  isStorageAreaActive: true
}

export default function StorageArea({ settings, profile }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [fieldHints, setFieldHints] = useState({})
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState(null)
  const [confirmRecord, setConfirmRecord] = useState(null)
  const [errorDialog, setErrorDialog] = useState(null)
  const errorDialogDismissed = useRef(false)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/master/storage-area`, { credentials: 'include' })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.transMessage || result?.message || 'Unable to load Storage Area data.')
      setRecords(result.records ?? [])
    } catch (loadError) {
      const normalizedMessage = normalizeErrorMessage(loadError.message)
      setError(normalizedMessage)
      if (!errorDialogDismissed.current) setErrorDialog({ message: normalizedMessage, operation: 'Load Storage Area data' })
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
    return records.filter((record) =>
      [record.storageAreaName, record.storageAreaDescription, record.aUser, record.uUser].some((field) =>
        String(field ?? '').toLowerCase().includes(value)
      )
    )
  }, [records, search])

  function openAdd() {
    setForm(initialForm)
    setFieldErrors({})
    setFieldHints({})
    setModalOpen(true)
  }

  function openEdit(record) {
    setForm({
      storageAreaId: record.storageAreaId,
      storageAreaName: record.storageAreaName ?? '',
      storageAreaDescription: record.storageAreaDescription ?? '',
      isStorageAreaActive: Boolean(record.isStorageAreaActive)
    })
    setFieldErrors({})
    setFieldHints({})
    setModalOpen(true)
  }

  function validate() {
    const nextErrors = {}
    if (form.storageAreaName.trim().length < 3) nextErrors.storageAreaName = 'Storage Area must contain at least 3 characters.'
    if (form.storageAreaDescription.trim().length < 15) nextErrors.storageAreaDescription = 'Description must contain at least 15 characters.'
    setFieldHints({})
    setFieldErrors(nextErrors)
    return !Object.keys(nextErrors).length
  }

  function validateField(field) {
    const value = String(form[field] ?? '')
    let message = ''
    if (field === 'storageAreaName' && value.trim().length < 3) message = 'Storage Area must contain at least 3 characters.'
    if (field === 'storageAreaDescription' && value.trim().length < 15) message = 'Description must contain at least 15 characters.'
    setFieldErrors((current) => {
      const next = { ...current }
      if (message) next[field] = message
      else delete next[field]
      return next
    })
    setFieldHints((current) => {
      const next = { ...current }
      if (message) next[field] = true
      else delete next[field]
      return next
    })
  }

  async function save(event) {
    event.preventDefault()
    if (!validate() || saving) return
    setSaving(true)
    const transactionValue = form.storageAreaId ? 2 : 1
    try {
      const response = await fetch(`${API_BASE_URL}/api/master/storage-area/transaction`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionValue,
          storageAreaId: form.storageAreaId,
          storageAreaName: form.storageAreaName.trim(),
          storageAreaDescription: form.storageAreaDescription.trim(),
          isStorageAreaActive: form.isStorageAreaActive
        }),
      })
      const result = await response.json()
      await handleTransaction(result, response.ok, transactionValue === 1 ? 'Storage Area added successfully.' : 'Storage Area updated successfully.')
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
      const response = await fetch(`${API_BASE_URL}/api/master/storage-area/transaction`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionValue: 3,
          storageAreaId: record.storageAreaId,
          storageAreaName: record.storageAreaName,
          storageAreaDescription: record.storageAreaDescription || 'N/A',
          isStorageAreaActive: false
        }),
      })
      const result = await response.json()
      await handleTransaction(result, response.ok, 'Storage Area deleted successfully.', { type: 'danger', icon: faCheck })
    } catch (deleteError) {
      showError(deleteError.message)
    }
  }

  async function handleTransaction(result, responseOk, successMessage, noticeOptions = {}) {
    const resultId = Number(result?.ResultID ?? result?.resultID ?? result?.resultId)
    if (!responseOk || resultId === 206) {
      showError(result?.TransMessage ?? result?.transMessage ?? result?.message ?? 'The Storage Area operation failed.')
      return
    }
    if (resultId === 201) {
      setNotification({ type: 'danger', message: result.TransMessage })
      return
    }
    if ([202, 204, 205].includes(resultId)) {
      setNotification({ type: resultId === 205 ? 'danger' : 'success', message: result.TransMessage || successMessage, ...noticeOptions })
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
    errorDialogDismissed.current = false
    setErrorDialog({ message: normalizeErrorMessage(message), operation: 'Storage Area transaction' })
  }

  function closeErrorDialog() {
    errorDialogDismissed.current = true
    setErrorDialog(null)
  }

  const exportRows = filteredRecords.slice(0, pageSize)
  const columns = [
    ['Storage Area', (row) => row.storageAreaName],
    ['Description', (row) => row.storageAreaDescription],
    ['Active', (row) => row.isStorageAreaActive ? 'Yes' : 'No'],
    ['AUser', (row) => row.aUser ?? ''],
    ['ADate', (row) => row.aDate ?? ''],
    ['UUser', (row) => row.uUser ?? ''],
    ['UDate', (row) => row.uDate ?? ''],
  ]

  function exportCsv() {
    downloadFile(`${csvText(exportRows, columns)}`, 'Storage Area.csv', 'text/csv;charset=utf-8')
  }

  function exportExcel() {
    const body = exportRows.map((row) => `<tr>${columns.map(([, value]) => `<td>${escapeHtml(value(row))}</td>`).join('')}</tr>`).join('')
    const html = `<html><head><meta charset="utf-8"></head><body><h1>Storage Area</h1><table><thead><tr>${columns.map(([name]) => `<th>${name}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></body></html>`
    downloadFile(html, 'Storage Area.xls', 'application/vnd.ms-excel')
  }

  async function copyExport() {
    await navigator.clipboard?.writeText(csvText(exportRows, columns))
    setNotification({ type: 'success', message: 'Storage Area data copied to the clipboard.' })
  }

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
    doc.text('Storage Area', 148, 16, { align: 'center' })
    doc.setFontSize(8)
    doc.text(generated, 285, 14, { align: 'right' })
    doc.text(`Generated By: ${profile?.userName ?? ''}`, 285, 20, { align: 'right' })
    doc.setDrawColor(...toRgb(theme.primary))
    doc.setLineWidth(0.6)
    doc.line(12, 25, 285, 25)
    autoTable(doc, {
      startY: 28,
      head: [columns.map(([name]) => name)],
      body: exportRows.map((row) => columns.map(([, value]) => String(value(row) ?? ''))),
      margin: { left: 12, right: 12 },
      styles: { fontSize: 8, textColor: toRgb(theme.text), fillColor: toRgb(theme.content), lineColor: toRgb(theme.border) },
      headStyles: { fillColor: toRgb(theme.page), textColor: toRgb(theme.muted), lineColor: toRgb(theme.border) }
    })
    const previewUrl = doc.output('bloburl')
    previewWindow.location.href = previewUrl
  }

  function getPdfTheme() {
    const styles = getComputedStyle(document.documentElement)
    return {
      primary: styles.getPropertyValue('--app-primary').trim() || '#0284c7',
      text: styles.getPropertyValue('--app-text').trim() || '#0f172a',
      muted: styles.getPropertyValue('--app-muted-text').trim() || '#64748b',
      border: styles.getPropertyValue('--app-border').trim() || '#cbd5e1',
      page: styles.getPropertyValue('--app-page-bg').trim() || '#f8fafc',
      content: styles.getPropertyValue('--app-content-bg').trim() || '#ffffff'
    }
  }

  function toRgb(color) {
    const value = color.replace('#', '')
    const hex = value.length === 3 ? value.split('').map((part) => part + part).join('') : value
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16)
    ]
  }

  return (
    <section className="relative rounded-2xl p-4 shadow-sm ring-1 sm:p-6" style={{ background: 'var(--app-content-bg)', '--tw-ring-color': 'var(--app-border)' }}>
      {notification && <TransactionNotice notification={notification} onDismiss={() => setNotification(null)} />}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-2xl font-bold">Storage Area</h2>
          <p className="text-sm italic" style={{ color: 'var(--app-muted-text)' }}>Manage Storage Area&apos;s</p>
        </div>
        <button
          type="button"
          className="flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--app-primary)', color: 'var(--app-sidebar-active-text)' }}
          onClick={openAdd}
        >
          <FontAwesomeIcon icon={faPlus} />Add
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <span className="sr-only">Search Storage Area records</span>
          <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-sm" style={{ color: 'var(--app-muted-text)' }} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Storage Area"
            className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm outline-none focus-visible:ring-2"
            style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)', '--tw-ring-color': 'var(--app-focus-ring)' }}
          />
        </label>
        <div className="flex flex-wrap justify-center gap-2">
          <ExportButton icon={faFilePdf} label="PDF" onClick={exportPdf} />
          <ExportButton icon={faFileExcel} label="Excel" onClick={exportExcel} />
          <ExportButton icon={faDownload} label="CSV" onClick={exportCsv} />
          <ExportButton icon={faClipboard} label="Copy" onClick={copyExport} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:ml-auto" style={{ color: 'var(--app-muted-text)' }}>
          Records
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="h-10 rounded-lg border px-2"
            style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)' }}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
        </label>
      </div>
      <div className="relative overflow-x-auto rounded-xl border" aria-busy={loading} style={{ borderColor: 'var(--app-border)' }}>
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead style={{ background: 'var(--app-page-bg)', color: 'var(--app-muted-text)' }}>
            <tr>
              {columns.map(([name]) => <th key={name} className="whitespace-nowrap px-3 py-3 font-semibold">{name}</th>)}
              <th className="whitespace-nowrap px-3 py-3 font-semibold text-center min-w-[96px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="px-3 py-8 text-center">Loading Storage Area records...</td></tr>
            ) : error ? (
              <tr>
                <td colSpan="8" className="px-3 py-8 text-center">
                  <div className="mx-auto max-w-2xl rounded-xl border p-4 text-left" style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, var(--app-content-bg))', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
                    <p className="font-semibold" style={{ color: 'var(--app-primary)' }}>Unable to load Storage Area data.</p>
                    <p className="mt-1 break-words text-sm" style={{ color: 'var(--app-muted-text)' }}>{error}</p>
                  </div>
                </td>
              </tr>
            ) : !exportRows.length ? (
              <tr><td colSpan="8" className="px-3 py-8 text-center" style={{ color: 'var(--app-muted-text)' }}>No Storage Area records found.</td></tr>
            ) : (
              exportRows.map((record) => (
                <tr key={record.storageAreaId} className="border-t" style={{ borderColor: 'var(--app-border)' }}>
                  <td className="px-3 py-3 font-medium"><TruncatedCell text={record.storageAreaName} maxWidth="max-w-[180px]" className="font-medium" /></td>
                  <td className="px-3 py-3"><TruncatedCell text={record.storageAreaDescription} maxWidth="max-w-xs" /></td>
                  <td className="px-3 py-3 text-center"><ActiveToggle active={record.isStorageAreaActive} /></td>
                  <td className="px-3 py-3">{record.aUser || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-3"><DateTimeCell value={record.aDate} /></td>
                  <td className="px-3 py-3">{record.uUser || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-3"><DateTimeCell value={record.uDate} /></td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <IconButton label={`Edit Storage Area ${record.storageAreaName}`} icon={faEdit} variant="edit" onClick={() => openEdit(record)} />
                      <IconButton label={`Delete Storage Area ${record.storageAreaName}`} icon={faTrash} variant="delete" onClick={() => setConfirmRecord(record)} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {loading && <DataLoadingOverlay message="Loading Storage Area records, please wait" />}
      </div>
      {modalOpen && (
        <StorageAreaModal
          form={form}
          setForm={setForm}
          errors={fieldErrors}
          hints={fieldHints}
          validateField={validateField}
          saving={saving}
          onClose={() => !saving && setModalOpen(false)}
          onSubmit={save}
          editing={Boolean(form.storageAreaId)}
        />
      )}
      {confirmRecord && <ConfirmDialog record={confirmRecord} onNo={() => setConfirmRecord(null)} onYes={deleteRecord} />}
      {errorDialog && <ErrorDialog message={errorDialog.message} operation={errorDialog.operation} onClose={closeErrorDialog} />}
    </section>
  )
}

function StorageAreaModal({ form, setForm, errors, hints, validateField, saving, onClose, onSubmit, editing }) {
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto p-4" style={{ background: 'var(--app-overlay-bg)' }}>
      <form onSubmit={onSubmit} className="w-full max-w-lg rounded-2xl border p-5 shadow-2xl" style={{ background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="flex min-w-0 flex-nowrap items-center gap-1.5 text-sm font-medium sm:text-base">
            <span className="flex shrink-0 items-center gap-1.5" style={{ color: 'var(--app-primary)' }}>
              <FontAwesomeIcon icon={editing ? faEdit : faPlus} aria-hidden="true" />
              {editing ? 'Edit Storage Area' : 'Add New'}
            </span>
            {editing && (
              <>
                <FontAwesomeIcon icon={faChevronRight} className="shrink-0 text-[0.6rem]" style={{ color: 'var(--app-muted-text)' }} aria-hidden="true" />
                <span className="min-w-0 truncate" style={{ color: 'var(--app-text)' }}>{form.storageAreaName}</span>
              </>
            )}
          </h3>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            className="storage-area-modal-close flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-md transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
            style={{ background: 'var(--app-page-bg)', color: 'var(--app-primary)', borderColor: 'var(--app-border)', '--tw-ring-color': 'var(--app-focus-ring)' }}
            onClick={onClose}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
        <Field label="Storage Area" required error={errors.storageAreaName} hint={hints.storageAreaName}>
          <input
            value={form.storageAreaName}
            maxLength="150"
            onBlur={() => validateField('storageAreaName')}
            onChange={(event) => setForm({ ...form, storageAreaName: event.target.value })}
            className="h-11 w-full rounded-lg border px-3"
            style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)' }}
          />
        </Field>
        <Field label="Description" required error={errors.storageAreaDescription} hint={hints.storageAreaDescription}>
          <textarea
            value={form.storageAreaDescription}
            maxLength="2000"
            rows="4"
            onBlur={() => validateField('storageAreaDescription')}
            onChange={(event) => setForm({ ...form, storageAreaDescription: event.target.value })}
            className="w-full rounded-lg border px-3 py-2"
            style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)' }}
          />
        </Field>
        <label className="mb-5 flex items-center justify-center gap-3 text-sm">
          <span className="font-semibold" style={{ color: 'var(--app-primary)' }}>Active</span>
          <span className="inline-flex h-6 w-11 items-center rounded-full p-0.5 shadow-inner" style={{ background: form.isStorageAreaActive ? 'var(--app-primary)' : 'var(--app-muted-text)' }}>
            <input
              type="checkbox"
              checked={form.isStorageAreaActive}
              onChange={(event) => setForm({ ...form, isStorageAreaActive: event.target.checked })}
              aria-label="Active"
              className="sr-only"
            />
            <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${form.isStorageAreaActive ? 'translate-x-5' : 'translate-x-0'}`} />
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border px-4 py-2 font-medium transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)', '--tw-ring-color': 'var(--app-focus-ring)' }}
            onClick={onClose}
          >
            <FontAwesomeIcon icon={faBan} />Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg px-4 py-2 font-semibold shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
            style={{ background: 'var(--app-primary)', color: 'var(--app-sidebar-active-text)', '--tw-ring-color': 'var(--app-focus-ring)' }}
          >
            <FontAwesomeIcon icon={faFloppyDisk} />{saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
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
  return (
    <div
      className={`transaction-notice fixed right-4 top-4 z-[100] flex w-max max-w-[calc(100vw-2rem)] flex-col items-center gap-1 rounded-xl border p-3 pt-3 text-center text-base shadow-2xl ${closing ? 'transaction-notice-closing' : ''}`}
      style={{ '--notice-accent': accent, '--notice-accent-dark': accentDark, background: 'var(--app-content-bg)', color: accent, borderColor: accent }}
    >
      <span className="transaction-notice-icon">
        <FontAwesomeIcon icon={notification.icon || (notification.type === 'success' ? faCheck : faXmark)} />
      </span>
      <span className="transaction-notice-message">{notification.message}</span>
    </div>
  )
}

function ConfirmDialog({ record, onNo, onYes }) {
  const noRef = useRef(null)
  useEffect(() => { noRef.current?.focus() }, [])
  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center p-4" style={{ background: 'var(--app-overlay-bg)' }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border p-5 shadow-2xl" style={{ background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}>
        <h3 className="text-lg font-bold">Confirm deletion</h3>
        <p className="mt-3 text-sm">Are you sure you want to delete Storage Area &apos;{record.storageAreaName}&apos;?</p>
        <div className="mt-5 flex justify-end gap-2">
          <button ref={noRef} type="button" className="rounded-lg border px-4 py-2" style={{ borderColor: 'var(--app-border)' }} onClick={onNo}>No</button>
          <button type="button" className="rounded-lg px-4 py-2 font-semibold" style={{ background: '#b91c1c', color: '#fff' }} onClick={onYes}>Yes</button>
        </div>
      </div>
    </div>
  )
}

function ErrorDialog({ message, operation, onClose }) {
  const [recipient, setRecipient] = useState('')
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendMessage, setSendMessage] = useState('')

  async function copy() {
    await navigator.clipboard?.writeText(message)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  async function sendDetails(event) {
    event.preventDefault()
    if (!recipient.trim() || sending) return
    setSending(true)
    setSendMessage('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/support/email/error-details`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recipient.trim(), errorMessage: message, screen: 'Storage Area', route: window.location.pathname, operation })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'The error details email could not be sent.')
      setSendMessage('Error details sent successfully.')
    } catch (sendError) {
      setSendMessage(sendError.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[67] flex items-center justify-center overflow-y-auto p-4" style={{ background: 'var(--app-overlay-bg)' }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="storage-area-error-title" className="w-full max-w-lg rounded-2xl border p-5 shadow-2xl" style={{ background: 'var(--app-content-bg)', color: 'var(--app-text)', borderColor: 'var(--app-border)' }}>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--app-primary) 15%, var(--app-content-bg))', color: 'var(--app-primary)' }}>
            <FontAwesomeIcon icon={faXmark} />
          </span>
          <div>
            <h3 id="storage-area-error-title" className="text-lg font-bold" style={{ color: 'var(--app-primary)' }}>Storage Area operation failed</h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--app-muted-text)' }}>Review the details below or send them to a person responsible for resolving the issue.</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border p-3" style={{ background: 'var(--app-page-bg)', borderColor: 'var(--app-border)' }}>
          <p className="break-words whitespace-pre-wrap text-sm">{message}</p>
        </div>
        <form onSubmit={sendDetails} className="mt-4">
          <label className="block text-sm font-semibold">
            Send details to email
            <input
              type="email"
              required
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="recipient@example.com"
              className="mt-2 h-11 w-full rounded-lg border px-3 font-normal outline-none focus-visible:ring-2"
              style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)', '--tw-ring-color': 'var(--app-focus-ring)' }}
            />
          </label>
          {sendMessage && <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--app-primary)' }}>{sendMessage}</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" className="flex items-center gap-2 rounded-lg border px-4 py-2" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }} onClick={copy}>
              <FontAwesomeIcon icon={faClipboard} />{copied ? 'Copied !!!' : 'Copy'}
            </button>
            <button type="submit" disabled={sending} className="flex items-center gap-2 rounded-lg px-4 py-2 font-semibold disabled:opacity-60" style={{ background: 'var(--app-primary)', color: 'var(--app-sidebar-active-text)' }}>
              <FontAwesomeIcon icon={faEnvelope} />{sending ? 'Sending...' : 'Email'}
            </button>
            <button type="button" className="flex items-center gap-2 rounded-lg border px-4 py-2" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }} onClick={onClose}>
              <FontAwesomeIcon icon={faXmark} />Close
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function normalizeErrorMessage(message) {
  const lines = String(message ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const uniqueLines = [...new Set(lines)]
  return uniqueLines.join('\n') || 'The Storage Area operation could not be completed.'
}

function Field({ label, required, error, hint, children }) {
  return (
    <label className="relative mb-4 block pt-2 text-sm font-medium">
      <span className="pointer-events-none absolute left-3 top-0 z-10 px-1 text-sm font-semibold" style={{ background: 'var(--app-content-bg)', color: 'var(--app-primary)' }}>
        {label}{required && <span aria-hidden="true" className="ml-1" style={{ color: 'color-mix(in srgb, #b91c1c 55%, var(--app-content-bg))' }}>*</span>}
      </span>
      {children}
      <span className={`mt-1 block text-sm font-semibold ${hint ? 'text-right' : 'text-left'}`} style={{ color: hint ? 'var(--app-primary)' : '#b91c1c' }}>
        {error || ''}
      </span>
    </label>
  )
}

function ExportButton({ icon, label, onClick }) {
  return (
    <button type="button" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition hover:opacity-80" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }} onClick={onClick}>
      <FontAwesomeIcon icon={icon} />{label}
    </button>
  )
}

function ActiveToggle({ active }) {
  return (
    <span role="img" aria-label={active ? 'Active' : 'Inactive'} title={active ? 'Active' : 'Inactive'} className="mx-auto inline-flex h-6 w-11 items-center rounded-full p-0.5 shadow-inner" style={{ background: active ? 'var(--app-primary)' : 'var(--app-muted-text)' }}>
      <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`} />
    </span>
  )
}

function DateTimeCell({ value }) {
  if (!value || value === '-') return '-'
  const str = String(value).trim()
  const spaceIndex = str.indexOf(' ')
  if (spaceIndex !== -1) {
    const datePart = str.slice(0, spaceIndex)
    const timePart = str.slice(spaceIndex + 1).trim()
    return (
      <span className="flex flex-col leading-tight">
        <span>{datePart}</span>
        {timePart && <span className="text-xs italic" style={{ color: 'var(--app-muted-text)' }}>{timePart}</span>}
      </span>
    )
  }
  if (str.includes('T')) {
    const [datePart, rawTime] = str.split('T')
    const timePart = rawTime ? rawTime.split('.')[0] : ''
    return (
      <span className="flex flex-col leading-tight">
        <span>{datePart}</span>
        {timePart && <span className="text-xs italic" style={{ color: 'var(--app-muted-text)' }}>{timePart}</span>}
      </span>
    )
  }
  return value
}

function TruncatedCell({ text, maxWidth = 'max-w-xs', className = '' }) {
  const textRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    if (!tooltip) return undefined
    function hide() { setTooltip(null) }
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [tooltip])

  function handleMouseEnter() {
    const el = textRef.current
    if (!el || !text) return
    if (el.scrollWidth > el.clientWidth + 1) {
      const rect = el.getBoundingClientRect()
      const showBelow = rect.top < 70
      setTooltip({
        top: showBelow ? rect.bottom + 6 : rect.top - 6,
        left: Math.max(160, Math.min(window.innerWidth - 160, rect.left + rect.width / 2)),
        placement: showBelow ? 'bottom' : 'top',
        content: String(text),
      })
    }
  }

  function handleMouseLeave() {
    setTooltip(null)
  }

  return (
    <>
      <span
        ref={textRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`block truncate ${maxWidth} ${className}`}
      >
        {text || '-'}
      </span>
      {tooltip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[9999] max-w-sm rounded-lg border px-3 py-2 text-xs leading-relaxed shadow-xl break-words"
          style={{
            top: tooltip.top,
            left: tooltip.left,
            transform: tooltip.placement === 'bottom' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            background: 'var(--app-content-bg)',
            color: 'var(--app-text)',
            borderColor: 'var(--app-border)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.15)',
          }}
        >
          {tooltip.content}
        </div>
      )}
    </>
  )
}

function IconButton({ icon, label, variant = 'default', onClick }) {
  const isDelete = variant === 'delete'
  const isEdit = variant === 'edit'
  const accentColor = isDelete ? '#dc2626' : isEdit ? 'var(--app-primary)' : 'var(--app-text)'
  const bgColor = isDelete
    ? 'color-mix(in srgb, #dc2626 10%, var(--app-content-bg))'
    : isEdit
      ? 'color-mix(in srgb, var(--app-primary) 10%, var(--app-content-bg))'
      : 'color-mix(in srgb, var(--app-text) 5%, var(--app-content-bg))'
  const borderColor = isDelete
    ? 'color-mix(in srgb, #dc2626 28%, var(--app-border))'
    : isEdit
      ? 'color-mix(in srgb, var(--app-primary) 28%, var(--app-border))'
      : 'var(--app-border)'

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm transition-all duration-150 hover:scale-105 hover:shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2"
      style={{
        color: accentColor,
        background: bgColor,
        borderColor: borderColor,
        '--tw-ring-color': isDelete ? '#dc2626' : 'var(--app-focus-ring)',
      }}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={icon} />
    </button>
  )
}

function csvText(rows, columns) {
  return [
    columns.map(([name]) => name).join(','),
    ...rows.map((row) => columns.map(([, value]) => `"${String(value(row) ?? '').replaceAll('"', '""')}"`).join(','))
  ].join('\n')
}

function downloadFile(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

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
  } catch {
    return null
  }
}
