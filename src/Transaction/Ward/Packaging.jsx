import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faTrashAlt, faXmark, faExclamationCircle, faEnvelope, faClipboard, faQrcode, faPrint, faSave, faChevronDown, faCheckCircle, faExclamationTriangle, faBan, faEdit, faPlus, faSearch, faFilePdf, faFileExcel, faDownload, faBug } from "@fortawesome/free-solid-svg-icons";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import DataLoadingOverlay from "../../components/DataLoadingOverlay.jsx";

const generateUniqueScanCode = () => {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `BMW-WNG-${timestamp}-${randomPart}`;
};

const formatCurrentTimestamp = (date = new Date()) => {
    const day = String(date.getDate()).padStart(2, '0');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');

    return `${day}-${month}-${year} ${strHours}:${minutes}:${seconds} ${ampm}`;
};

const initialForm = {
    WardEntryId: 0,
    WardId: "",
    CategoryId: "",
    TypeID: "",
    UnitID: "",
    Volume: "",
    ScanCode: "",
    Remark: "",
    StatusID: 2,
};

const Packaging = ({ settings, profile }) => {
    const [entries, setEntries] = useState([]);
    const [wards, setWards] = useState([]);
    const [categories, setCategories] = useState([]);
    const [types, setTypes] = useState([]);
    const [units, setUnits] = useState([]);

    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(10);

    const [formData, setFormData] = useState(initialForm);
    const [fieldErrors, setFieldErrors] = useState({});
    const [activeErrorField, setActiveErrorField] = useState(null);

    const [isEditing, setIsEditing] = useState(false);
    const [editingRowId, setEditingRowId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState(null);
    const [errorDialog, setErrorDialog] = useState(null);
    const [confirmRecord, setConfirmRecord] = useState(null);
    const errorDialogDismissed = useRef(false);

    // LIVE DEBUG TRACKER STATE FOR TESTING
    const [debugLogs, setDebugLogs] = useState([]);
    const [showDebugPanel, setShowDebugPanel] = useState(true);

    const addDebugLog = (label, status, data) => {
        setDebugLogs(prev => [
            { time: new Date().toLocaleTimeString(), label, status, data: JSON.stringify(data, null, 2) },
            ...prev.slice(0, 9) // keep last 10 logs
        ]);
    };

    // Workflow states for QR Code & Save visibility & Timestamp & Data snapshot tracking
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [hasPrintedQr, setHasPrintedQr] = useState(false);
    const [showSaveButton, setShowSaveButton] = useState(false);
    const [showScanCodeInfo, setShowScanCodeInfo] = useState(false);
    const [qrGeneratedTime, setQrGeneratedTime] = useState("");
    const [reprintModalData, setReprintModalData] = useState(null);
    const lastPrintedPayloadRef = useRef(null);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (!notification) return undefined;
        const timer = window.setTimeout(() => setNotification(null), 5000);
        return () => window.clearTimeout(timer);
    }, [notification]);

    const loadData = async () => {
        setLoading(true);
        addDebugLog("LoadData Initiated", "PENDING", { timestamp: new Date().toISOString() });
        try {
            const [wardRes, catRes, unitRes, listRes] = await Promise.all([
                axios.post("/api/wardentry", { TransactionValue: 7 }, { withCredentials: true }),
                axios.post("/api/wardentry", { TransactionValue: 8 }, { withCredentials: true }),
                axios.post("/api/wardentry", { TransactionValue: 10 }, { withCredentials: true }),
                axios.post("/api/wardentry", { TransactionValue: 11 }, { withCredentials: true }),
            ]);

            addDebugLog("Wards (Trans 7)", wardRes.status, wardRes.data);
            addDebugLog("Categories (Trans 8)", catRes.status, catRes.data);
            addDebugLog("Units (Trans 10)", unitRes.status, unitRes.data);
            addDebugLog("List (Trans 11)", listRes.status, listRes.data);

            setWards(Array.isArray(wardRes.data) ? wardRes.data : []);
            setCategories(Array.isArray(catRes.data) ? catRes.data : []);
            setUnits(Array.isArray(unitRes.data) ? unitRes.data : []);
            setEntries(Array.isArray(listRes.data) ? listRes.data : []);
        } catch (err) {
            const message = normalizeErrorMessage(err.response?.data?.message || err.message || "Unable to load packaging data.");
            addDebugLog("LoadData Error", "ERROR", { message, status: err.response?.status, data: err.response?.data });
            if (!errorDialogDismissed.current) {
                setErrorDialog({ message, operation: "Load Ward Waste Packaging data" });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryChange = async (categoryId) => {
        const catId = categoryId && categoryId !== "0" ? Number(categoryId) : "";
        setFormData((prev) => {
            const next = { ...prev, CategoryId: catId, TypeID: "" };
            return next;
        });

        clearFieldError("CategoryId");

        if (catId) {
            try {
                addDebugLog(`Fetch Waste Types (Trans 9, Cat: ${catId})`, "PENDING", { CategoryId: catId });
                const res = await axios.post("/api/wardentry", {
                    CategoryId: catId,
                    TransactionValue: 9,
                }, { withCredentials: true });
                addDebugLog(`Waste Types Response (Cat: ${catId})`, res.status, res.data);
                setTypes(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                addDebugLog(`Waste Types Error (Cat: ${catId})`, "ERROR", { error: err.message, response: err.response?.data });
                console.error("Error fetching waste types", err);
            }
        } else {
            setTypes([]);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        clearFieldError(name);
    };

    const clearFieldError = (fieldName) => {
        if (fieldErrors[fieldName]) {
            setFieldErrors((current) => {
                const next = { ...current };
                delete next[fieldName];
                return next;
            });
            if (activeErrorField === fieldName) setActiveErrorField(null);
        }
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.WardId) errors.WardId = "Please Select The Ward.";
        if (!formData.CategoryId) errors.CategoryId = "Please Select The Waste Category.";
        if (!formData.TypeID) errors.TypeID = "Please Select The Waste Type.";
        if (!formData.Volume || isNaN(formData.Volume) || Number(formData.Volume) <= 0) {
            errors.Volume = "Please Enter Volume.";
        }
        if (!formData.UnitID) errors.UnitID = "Please Select The Unit.";

        setFieldErrors(errors);
        setActiveErrorField(Object.keys(errors)[0] || null);
        return Object.keys(errors).length === 0;
    };

    const handleGenerateQrClick = (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        const activeScanCode = formData.ScanCode && formData.ScanCode.trim() ? formData.ScanCode : generateUniqueScanCode();
        setFormData(prev => ({ ...prev, ScanCode: activeScanCode }));
        setHasPrintedQr(false);
        setQrGeneratedTime(formatCurrentTimestamp());
        setIsQrModalOpen(true);
    };

    const handlePrintQr = () => {
        setHasPrintedQr(true);
        window.print();
    };

    const handleCloseQrModal = () => {
        setIsQrModalOpen(false);
        if (hasPrintedQr) {
            setShowSaveButton(true);
        }
    };

    const [confirmDialog, setConfirmDialog] = useState(false);

    const handleSubmitClick = (e) => {
        e.preventDefault();
        if (!validateForm() || saving || !showSaveButton) return;
        setConfirmDialog(true);
    };

    const executeConfirmedSave = async () => {
        setConfirmDialog(false);
        if (!validateForm() || saving) return;

        setSaving(true);
        const transactionValue = isEditing ? 2 : 1;

        try {
            const payload = {
                WardEntryId: formData.WardEntryId ? Number(formData.WardEntryId) : 0,
                WardId: Number(formData.WardId),
                CategoryId: Number(formData.CategoryId),
                TypeID: Number(formData.TypeID),
                UnitID: Number(formData.UnitID),
                Volume: Number(formData.Volume),
                ScanCode: formData.ScanCode || generateUniqueScanCode(),
                StatusID: 3,
                Remark: formData.Remark ? formData.Remark.trim() : "",
                TransactionValue: transactionValue,
            };

            const response = await axios.post("/api/wardentry", payload, { withCredentials: true });
            await handleTransaction(response.data, response.status >= 200 && response.status < 300, "Package saved successfully.");
        } catch (err) {
            showError(err.response?.data?.transMessage || err.message || "Operation failed.");
        } finally {
            setSaving(false);
        }
    };

    async function handleTransaction(result, responseOk, successMessage) {
        const resultId = Number(result?.ResultID ?? result?.resultID ?? 0);
        if (!responseOk || resultId === 206 || resultId === 201) {
            showError(result?.TransMessage || "Operation failed.");
            return;
        }
        setNotification({ type: "success", message: result?.TransMessage || successMessage });
        setFormData(initialForm);
        setShowSaveButton(false);
        setHasPrintedQr(false);
        setIsEditing(false);
        await loadData();
    }

    function showError(message) {
        setErrorDialog({ message: normalizeErrorMessage(message), operation: "Packaging transaction" });
    }

    const filteredRecords = useMemo(() => {
        const val = search.trim().toLowerCase();
        if (!val) return entries;
        return entries.filter((item) => {
            const waste = item.Waste ?? item.waste ?? "";
            const qr = item.QR ?? item.qr ?? "";
            const user = item.User ?? item.user ?? "";
            return [waste, qr, user].some((field) => String(field).toLowerCase().includes(val));
        });
    }, [entries, search]);

    const exportRows = filteredRecords.slice(0, pageSize);
    const exportColumns = [
        ['Waste', (row) => String(row.Waste ?? row.waste ?? '').replaceAll('$$', ' | ')],
        ['QR', (row) => String(row.QR ?? row.qr ?? '').replaceAll('$$', ' | ')],
        ['User', (row) => String(row.User ?? row.user ?? '').replaceAll('$$', ' | ')],
    ];

    function exportCsv() { downloadFile(csvText(exportRows, exportColumns), 'WardWastePackaging.csv', 'text/csv;charset=utf-8'); }
    function exportExcel() {
        const body = exportRows.map((row) => `<tr>${exportColumns.map(([, value]) => `<td>${escapeHtml(value(row))}</td>`).join('')}</tr>`).join('');
        downloadFile(`<html><body><table>${body}</table></body></html>`, 'WardWastePackaging.xls', 'application/vnd.ms-excel');
    }
    function csvText(rows, columns) { return [columns.map(([name]) => name).join(','), ...rows.map((row) => columns.map(([, value]) => `"${String(value(row) ?? '')}"`).join(','))].join('\n'); }
    function downloadFile(content, filename, type) {
        const url = URL.createObjectURL(new Blob([content], { type }));
        const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
    }
    function escapeHtml(value) { return String(value ?? '').replaceAll('&', '&amp;'); }
    function normalizeErrorMessage(msg) { return String(msg ?? "").trim(); }

    return (
        <section className="relative rounded-2xl p-4 shadow-sm ring-1 sm:p-6 space-y-6 w-full overflow-x-hidden" style={{ background: "var(--app-content-bg)", "--tw-ring-color": "var(--app-border)", color: "var(--app-text)" }}>
            {/* LIVE API DIAGNOSTICS & DEBUG TRACKER PANEL (TESTING PURPOSES) */}
            <div className="rounded-xl border p-4 shadow-md text-xs font-mono space-y-2" style={{ background: "color-mix(in srgb, #f59e0b 10%, var(--app-content-bg))", borderColor: "#f59e0b" }}>
                <div className="flex justify-between items-center font-bold">
                    <span className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                        <FontAwesomeIcon icon={faBug} /> Live API Debug Tracker (Wards: {wards.length}, Categories: {categories.length}, Units: {units.length}, Types: {types.length})
                    </span>
                    <button type="button" onClick={() => setShowDebugPanel(!showDebugPanel)} className="px-2 py-1 rounded border border-amber-500 text-amber-600 hover:bg-amber-100">
                        {showDebugPanel ? "Hide Logs" : "Show Logs"}
                    </button>
                </div>
                {showDebugPanel && (
                    <div className="max-h-48 overflow-y-auto space-y-1 pt-2 border-t border-amber-300">
                        {debugLogs.length === 0 ? (
                            <p className="italic text-gray-500">Waiting for API calls...</p>
                        ) : (
                            debugLogs.map((log, idx) => (
                                <div key={idx} className="p-1 rounded bg-black/5 dark:bg-white/5 space-x-2">
                                    <span className="font-bold text-blue-600">[{log.time}]</span>
                                    <span className="font-semibold text-purple-600">{log.label}</span>
                                    <span className={`px-1 rounded text-[10px] ${log.status === 'ERROR' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>Status: {log.status}</span>
                                    <pre className="text-[10px] text-gray-700 dark:text-gray-300 overflow-x-auto mt-1">{log.data}</pre>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {notification && <TransactionNotice notification={notification} onDismiss={() => setNotification(null)} />}

            <div className="flex justify-between items-center flex-wrap gap-2">
                <h2 className="text-2xl font-bold flex items-center gap-2">Ward Waste Packaging</h2>
            </div>

            {/* Entry Form */}
            <form onSubmit={handleSubmitClick} noValidate className="p-4 sm:p-6 rounded-xl shadow-sm border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" style={{ background: "var(--app-content-bg)", borderColor: "var(--app-border)" }}>
                {/* 1. Ward Dropdown */}
                <div className="relative">
                    <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "var(--app-muted-text)" }}>Ward * ({wards.length} loaded)</label>
                    <select name="WardId" value={formData.WardId} onChange={handleInputChange} className="w-full h-10 rounded-lg border p-2 text-sm outline-none" style={{ background: "var(--app-content-bg)", borderColor: "var(--app-border)", color: "var(--app-text)" }}>
                        <option value="">-- Choose Ward --</option>
                        {wards.map((w, index) => {
                            const id = w.WardId ?? w.wardId ?? index;
                            const name = w.WardName ?? w.wardName ?? "Ward";
                            return <option key={`ward-${id}`} value={id}>{name}</option>;
                        })}
                    </select>
                </div>

                {/* 2. Waste Category Dropdown */}
                <div className="relative">
                    <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "var(--app-muted-text)" }}>Waste Category * ({categories.length} loaded)</label>
                    <select name="CategoryId" value={formData.CategoryId} onChange={(e) => handleCategoryChange(e.target.value)} className="w-full h-10 rounded-lg border p-2 text-sm outline-none" style={{ background: "var(--app-content-bg)", borderColor: "var(--app-border)", color: "var(--app-text)" }}>
                        <option value="">-- Choose Category --</option>
                        {categories.map((c, index) => {
                            const id = c.WasteCategoryId ?? c.wasteCategoryId ?? index;
                            const name = c.WasteCategoryName ?? c.wasteCategoryName ?? "Category";
                            return <option key={`cat-${id}`} value={id}>{name}</option>;
                        })}
                    </select>
                </div>

                {/* 3. Waste Type Dropdown */}
                <div className="relative">
                    <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "var(--app-muted-text)" }}>Waste Type * ({types.length} loaded)</label>
                    <select name="TypeID" value={formData.TypeID} onChange={handleInputChange} className="w-full h-10 rounded-lg border p-2 text-sm outline-none" style={{ background: "var(--app-content-bg)", borderColor: "var(--app-border)", color: "var(--app-text)" }}>
                        <option value="">-- Choose Waste Type --</option>
                        {types.map((t, index) => {
                            const id = t.WasteTypeId ?? t.wasteTypeId ?? index;
                            const name = t.WasteTypeName ?? t.wasteTypeName ?? "Type";
                            return <option key={`type-${id}`} value={id}>{name}</option>;
                        })}
                    </select>
                </div>

                {/* 4. Volume Input */}
                <div className="relative">
                    <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "var(--app-muted-text)" }}>Volume *</label>
                    <input type="text" name="Volume" value={formData.Volume} onChange={handleInputChange} placeholder="0.00" className="w-full h-10 rounded-lg border p-2 text-sm outline-none" style={{ background: "var(--app-content-bg)", borderColor: "var(--app-border)", color: "var(--app-text)" }} />
                </div>

                {/* 5. Unit Dropdown */}
                <div className="relative">
                    <label className="block text-xs font-semibold uppercase mb-1" style={{ color: "var(--app-muted-text)" }}>Unit * ({units.length} loaded)</label>
                    <select name="UnitID" value={formData.UnitID} onChange={handleInputChange} className="w-full h-10 rounded-lg border p-2 text-sm outline-none" style={{ background: "var(--app-content-bg)", borderColor: "var(--app-border)", color: "var(--app-text)" }}>
                        <option value="">-- Choose Unit --</option>
                        {units.map((u, index) => {
                            const id = u.UnitId ?? u.unitId ?? index;
                            const unitName = u.Unit ?? u.unit ?? "Unit";
                            return <option key={`unit-${id}`} value={id}>{unitName}</option>;
                        })}
                    </select>
                </div>

                {/* Submit / QR Buttons */}
                <div className="sm:col-span-2 md:col-span-3 flex justify-end gap-2 pt-2">
                    {!showSaveButton ? (
                        <button type="button" onClick={handleGenerateQrClick} className="h-10 px-5 rounded-lg text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700">Generate QR Code</button>
                    ) : (
                        <button type="submit" disabled={saving} className="h-10 px-5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700">{saving ? "Saving..." : "Save Package"}</button>
                    )}
                </div>
            </form>

            {/* QR Modal */}
            {isQrModalOpen && (
                <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60">
                    <div className="w-full max-w-md rounded-2xl border p-6 bg-white dark:bg-slate-900 space-y-4">
                        <h3 className="text-lg font-bold">Scan Code QR</h3>
                        <div className="p-4 flex flex-col items-center">
                            <QRCodeSVG value={formData.ScanCode || "PENDING"} size={140} />
                            <p className="font-mono text-xs mt-2">{formData.ScanCode}</p>
                        </div>
                        <div className="flex justify-between">
                            <button type="button" onClick={handlePrintQr} className="px-4 py-2 border rounded">Print</button>
                            {hasPrintedQr && <button type="button" onClick={handleCloseQrModal} className="px-4 py-2 bg-emerald-600 text-white rounded">Close & Enable Save</button>}
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Dialog */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60">
                    <div className="w-full max-w-md rounded-2xl border p-6 bg-white dark:bg-slate-900 space-y-4">
                        <h3 className="text-lg font-bold text-amber-600">Confirm QR Attachment</h3>
                        <p className="text-sm">Have you printed and attached the QR label to the waste bag?</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmDialog(false)} className="px-4 py-2 border rounded">No</button>
                            <button onClick={executeConfirmedSave} className="px-4 py-2 bg-emerald-600 text-white rounded">Yes, Save</button>
                        </div>
                    </div>
                </div>
            )}

            {errorDialog && <ErrorDialog message={errorDialog.message} operation={errorDialog.operation} onClose={() => setErrorDialog(null)} />}
        </section>
    );
};

function TransactionNotice({ notification, onDismiss }) {
    return (
        <div className="fixed right-4 top-4 z-[100] p-3 rounded-xl border bg-white shadow-xl text-emerald-700 border-emerald-600">
            <span className="font-semibold text-sm">{notification.message}</span>
        </div>
    );
}

function ErrorDialog({ message, operation, onClose }) {
    return (
        <div className="fixed inset-0 z-[67] flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-lg rounded-2xl border p-5 bg-white dark:bg-slate-900 text-red-600">
                <h3 className="text-lg font-bold">Error in {operation}</h3>
                <p className="mt-2 text-sm whitespace-pre-wrap">{message}</p>
                <button onClick={onClose} className="mt-4 px-4 py-2 border rounded">Close</button>
            </div>
        </div>
    );
}

export default Packaging;