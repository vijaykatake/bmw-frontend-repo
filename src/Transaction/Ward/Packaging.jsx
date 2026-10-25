import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faTrashAlt, faXmark, faExclamationCircle, faEnvelope, faClipboard, faQrcode, faPrint, faSave, faChevronDown, faCheckCircle, faExclamationTriangle, faBan, faEdit, faPlus, faSearch, faFilePdf, faFileExcel, faDownload, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import DataLoadingOverlay from "../../components/DataLoadingOverlay.jsx";
import { API_BASE_URL } from "../../config/api.js";

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
        try {
            const [wardRes, catRes, unitRes, listRes] = await Promise.all([
                axios.post(`${API_BASE_URL}/api/wardentry`, { TransactionValue: 7 }, { withCredentials: true }).catch(() => ({ data: [] })),
                axios.post(`${API_BASE_URL}/api/wardentry`, { TransactionValue: 8 }, { withCredentials: true }).catch(() => ({ data: [] })),
                axios.post(`${API_BASE_URL}/api/wardentry`, { TransactionValue: 10 }, { withCredentials: true }).catch(() => ({ data: [] })),
                axios.post(`${API_BASE_URL}/api/wardentry`, { TransactionValue: 11 }, { withCredentials: true }),
            ]);
            setWards(Array.isArray(wardRes.data) ? wardRes.data : []);
            setCategories(Array.isArray(catRes.data) ? catRes.data : []);
            setUnits(Array.isArray(unitRes.data) ? unitRes.data : []);
            setEntries(Array.isArray(listRes.data) ? listRes.data : []);
        } catch (err) {
            const message = normalizeErrorMessage(err.response?.data?.message || err.message || "Unable to load packaging data.");
            if (!errorDialogDismissed.current) {
                setErrorDialog({ message, operation: "Load Ward Waste Packaging data" });
            }
        } finally {
            setLoading(false);
        }
    };

    const filteredRecords = useMemo(() => {
        const val = search.trim().toLowerCase();
        if (!val) return entries;
        return entries.filter((item) => {
            const waste = item.Waste ?? item.waste ?? "";
            const qr = item.QR ?? item.qr ?? "";
            const user = item.User ?? item.user ?? "";
            return [waste, qr, user].some((field) =>
                String(field).toLowerCase().includes(val)
            );
        });
    }, [entries, search]);

    const exportRows = filteredRecords.slice(0, pageSize);

    // Export Column Definitions and Handlers matching Ward.jsx reference standard
    const exportColumns = [
        ['Waste', (row) => String(row.Waste ?? row.waste ?? '').replaceAll('$$', ' | ')],
        ['QR', (row) => String(row.QR ?? row.qr ?? '').replaceAll('$$', ' | ')],
        ['User', (row) => String(row.User ?? row.user ?? '').replaceAll('$$', ' | ')],
    ];

    function exportCsv() {
        downloadFile(`${csvText(exportRows, exportColumns)}`, 'WardWastePackaging.csv', 'text/csv;charset=utf-8');
    }

    function exportExcel() {
        const body = exportRows.map((row) => `<tr>${exportColumns.map(([, value]) => `<td>${escapeHtml(value(row))}</td>`).join('')}</tr>`).join('');
        const html = `<html><head><meta charset="utf-8"></head><body><h1>Ward Waste Packaging</h1><table><thead><tr>${exportColumns.map(([name]) => `<th>${name}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></body></html>`;
        downloadFile(html, 'WardWastePackaging.xls', 'application/vnd.ms-excel');
    }

    async function copyExport() {
        await navigator.clipboard?.writeText(csvText(exportRows, exportColumns));
        setNotification({ type: 'success', message: 'Ward waste packaging data copied to the clipboard.' });
    }

    async function exportPdf() {
        const previewWindow = window.open('', '_blank');
        if (!previewWindow) return;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const generated = new Date().toLocaleString();
        const theme = getPdfTheme();
        const logo = await loadImageData(settings?.hospitalLogoUrl);
        if (logo) doc.addImage(logo, 'PNG', 12, 8, 24, 15);
        doc.setTextColor(...toRgb(theme.text));
        doc.setFontSize(16);
        doc.text('Ward Waste Packaging', 148, 16, { align: 'center' });
        doc.setFontSize(8);
        doc.text(generated, 285, 14, { align: 'right' });
        doc.text(`Generated By: ${profile?.userName ?? 'Administrator'}`, 285, 20, { align: 'right' });
        doc.setDrawColor(...toRgb(theme.primary));
        doc.setLineWidth(0.6);
        doc.line(12, 25, 285, 25);
        autoTable(doc, {
            startY: 28,
            head: [exportColumns.map(([name]) => name)],
            body: exportRows.map((row) => exportColumns.map(([, value]) => String(value(row) ?? ''))),
            margin: { left: 12, right: 12 },
            styles: { fontSize: 8, textColor: toRgb(theme.text), fillColor: toRgb(theme.content), lineColor: toRgb(theme.border) },
            headStyles: { fillColor: toRgb(theme.page), textColor: toRgb(theme.muted), lineColor: toRgb(theme.border) }
        });
        const previewUrl = doc.output('bloburl');
        previewWindow.location.href = previewUrl;
    }

    function getPdfTheme() {
        const styles = getComputedStyle(document.documentElement);
        return {
            primary: styles.getPropertyValue('--app-primary').trim() || '#0284c7',
            text: styles.getPropertyValue('--app-text').trim() || '#0f172a',
            muted: styles.getPropertyValue('--app-muted-text').trim() || '#64748b',
            border: styles.getPropertyValue('--app-border').trim() || '#cbd5e1',
            page: styles.getPropertyValue('--app-page-bg').trim() || '#f8fafc',
            content: styles.getPropertyValue('--app-content-bg').trim() || '#ffffff'
        };
    }

    function toRgb(color) {
        const value = color.replace('#', '');
        const hex = value.length === 3 ? value.split('').map((part) => part + part).join('') : value;
        return [Number.parseInt(hex.slice(0, 2), 16), Number.parseInt(hex.slice(2, 4), 16), Number.parseInt(hex.slice(4, 6), 16)];
    }

    function csvText(rows, columns) {
        return [columns.map(([name]) => name).join(','), ...rows.map((row) => columns.map(([, value]) => `"${String(value(row) ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');
    }

    function downloadFile(content, filename, type) {
        const url = URL.createObjectURL(new Blob([content], { type }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    function escapeHtml(value) {
        return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    }

    async function loadImageData(url) {
        if (!url) return null;
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        } catch { return null; }
    }

    const handleCategoryChange = async (categoryId) => {
        const catId = categoryId && categoryId !== "0" ? Number(categoryId) : "";
        setFormData((prev) => {
            const next = { ...prev, CategoryId: catId, TypeID: "" };
            checkDataDrift(next);
            return next;
        });

        clearFieldError("CategoryId");

        if (catId) {
            try {
                const res = await axios.post(`${API_BASE_URL}/api/wardentry`, {
                    CategoryId: catId,
                    TransactionValue: 9,
                }, { withCredentials: true });
                setTypes(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error("Error fetching waste types", err);
            }
        } else {
            setTypes([]);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => {
            const next = { ...prev, [name]: value };
            checkDataDrift(next);
            return next;
        });
        clearFieldError(name);
    };

    const checkDataDrift = (currentForm) => {
        if (!lastPrintedPayloadRef.current) return;
        const last = lastPrintedPayloadRef.current;
        const currentRelevant = {
            WardId: currentForm.WardId,
            CategoryId: currentForm.CategoryId,
            TypeID: currentForm.TypeID,
            Volume: currentForm.Volume,
            UnitID: currentForm.UnitID,
        };
        const hasChanged = JSON.stringify(last) !== JSON.stringify(currentRelevant);
        if (hasChanged) {
            setShowSaveButton(false);
            setHasPrintedQr(false);
            setFormData(prev => ({ ...prev, ScanCode: "" }));
            lastPrintedPayloadRef.current = null;
        }
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

        const firstErrorKey = Object.keys(errors)[0];
        setActiveErrorField(firstErrorKey || null);

        return Object.keys(errors).length === 0;
    };

    const handleGenerateQrClick = (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        const activeScanCode = formData.ScanCode && formData.ScanCode.trim()
            ? formData.ScanCode
            : generateUniqueScanCode();

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
            lastPrintedPayloadRef.current = {
                WardId: formData.WardId,
                CategoryId: formData.CategoryId,
                TypeID: formData.TypeID,
                Volume: formData.Volume,
                UnitID: formData.UnitID,
            };
        }
    };

    const handleRegenerateAndPrintFromConfirm = () => {
        setConfirmDialog(false);
        setIsQrModalOpen(true);
    };

    const [confirmDialog, setConfirmDialog] = useState(false);

    const handleSubmitClick = (e) => {
        e.preventDefault();
        if (!validateForm() || saving || !showSaveButton) return;
        setConfirmDialog(true);
    };

    const executeConfirmedSave = async () => {
        setConfirmDialog(false);
        if (!validateForm() || saving || !showSaveButton) return;

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

            const response = await axios.post(`${API_BASE_URL}/api/wardentry`, payload, { withCredentials: true });
            const result = response.data;

            await handleTransaction(
                result,
                response.status >= 200 && response.status < 300,
                transactionValue === 1 ? "Package record saved successfully." : "Package record updated successfully."
            );
        } catch (err) {
            const errorMsg = err.response?.data?.transMessage || err.response?.data?.message || err.message;
            showError(errorMsg || "Operation failed. Please check inputs and try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async (wardEntryId) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/api/wardentry`, { WardEntryId: wardEntryId, TransactionValue: 4 }, { withCredentials: true });
            const record = res.data;
            if (record) {
                const catId = record.CategoryId ?? record.categoryId;
                if (catId) {
                    const typeRes = await axios.post(`${API_BASE_URL}/api/wardentry`, { CategoryId: Number(catId), TransactionValue: 9 }, { withCredentials: true });
                    setTypes(Array.isArray(typeRes.data) ? typeRes.data : []);
                }
                setFormData({
                    WardEntryId: record.WardEntryId ?? record.wardEntryId ?? 0,
                    WardId: String(record.WardId ?? record.wardId ?? ""),
                    CategoryId: String(record.CategoryId ?? record.categoryId ?? ""),
                    TypeID: String(record.TypeID ?? record.typeID ?? ""),
                    UnitID: String(record.UnitID ?? record.unitID ?? ""),
                    Volume: String(record.Volume ?? record.volume ?? ""),
                    ScanCode: record.ScanCode ?? record.scanCode ?? "",
                    Remark: record.Remark ?? record.remark ?? "",
                    StatusID: record.StatusID ?? record.statusID ?? 2,
                });
                setIsEditing(true);
                setEditingRowId(wardEntryId);
                setHasPrintedQr(true);
                setShowSaveButton(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } catch (err) {
            showError("Unable to load record for editing.");
        }
    };

    const handleDeleteRecord = async () => {
        if (!confirmRecord) return;
        const recordId = confirmRecord.Action ?? confirmRecord.action;
        setConfirmRecord(null);
        try {
            const response = await axios.post(`${API_BASE_URL}/api/wardentry`, {
                WardEntryId: recordId,
                TransactionValue: 3,
            }, { withCredentials: true });
            const result = response.data;
            await handleTransaction(
                result,
                response.status >= 200 && response.status < 300,
                "Package entry deleted successfully.",
                { type: "danger", icon: faCheck }
            );
        } catch (err) {
            showError(err.response?.data?.message || err.message || "Error deleting record.");
        }
    };

    async function handleTransaction(result, responseOk, successMessage, noticeOptions = {}) {
        const resultId = Number(result?.ResultID ?? result?.resultID ?? result?.resultId ?? 0);

        if (!responseOk || resultId === 206) {
            showError(result?.TransMessage ?? result?.transMessage ?? result?.message ?? "The operation failed.");
            return;
        }
        if (resultId === 201) {
            setNotification({ type: "danger", message: result.TransMessage || "Validation error." });
            return;
        }
        if ([202, 204, 205].includes(resultId) || responseOk) {
            setNotification({
                type: resultId === 205 ? "danger" : "success",
                message: result.TransMessage || successMessage,
                ...noticeOptions,
            });
            resetFormAfterSuccessfulSave();
            await loadData();
            return;
        }
        if (resultId === 207) {
            setNotification({ type: "danger", message: result.TransMessage });
            window.setTimeout(() => window.location.reload(), 10000);
            return;
        }
        setNotification({ type: "success", message: result?.TransMessage || successMessage, ...noticeOptions });
        resetFormAfterSuccessfulSave();
        await loadData();
    }

    function showError(message) {
        errorDialogDismissed.current = false;
        setErrorDialog({ message: normalizeErrorMessage(message), operation: "Ward Waste Packaging transaction" });
    }

    function closeErrorDialog() {
        errorDialogDismissed.current = true;
        setErrorDialog(null);
    }

    const resetFormAfterSuccessfulSave = () => {
        setFormData({
            ...initialForm,
            ScanCode: "",
        });
        setFieldErrors({});
        setActiveErrorField(null);
        setIsEditing(false);
        setEditingRowId(null);
        setShowSaveButton(false);
        setHasPrintedQr(false);
        setQrGeneratedTime("");
        setShowScanCodeInfo(false);
        lastPrintedPayloadRef.current = null;
    };

    const resetForm = () => {
        setFormData({
            ...initialForm,
            ScanCode: "",
        });
        setFieldErrors({});
        setActiveErrorField(null);
        setIsEditing(false);
        setEditingRowId(null);
        setShowSaveButton(false);
        setHasPrintedQr(false);
        setQrGeneratedTime("");
        setShowScanCodeInfo(false);
        lastPrintedPayloadRef.current = null;
    };

    const selectedWardObj = wards.find(w => String(w.WardId ?? w.wardId) === String(formData.WardId));
    const wardDisplayName = selectedWardObj?.WardName ?? selectedWardObj?.wardName ?? "-";

    const selectedCatObj = categories.find(c => String(c.WasteCategoryId ?? c.wasteCategoryId) === String(formData.CategoryId));
    const catDisplayName = selectedCatObj?.WasteCategoryName ?? selectedCatObj?.wasteCategoryName ?? "-";

    const selectedTypeObj = types.find(t => String(t.WasteTypeId ?? t.wasteTypeId) === String(formData.TypeID));
    const typeDisplayName = selectedTypeObj?.WasteTypeName ?? selectedTypeObj?.wasteTypeName ?? "-";

    const selectedUnitObj = units.find(u => String(u.UnitId ?? u.unitId) === String(formData.UnitID));
    const unitDisplayName = selectedUnitObj?.Short ?? selectedUnitObj?.short ?? selectedUnitObj?.Unit ?? selectedUnitObj?.unit ?? "";
    const volumeWithUnit = formData.Volume ? `${formData.Volume} ${unitDisplayName}`.trim() : "-";
    const displayTimestamp = qrGeneratedTime || formatCurrentTimestamp();

    const hasValidScanCode = Boolean(formData.ScanCode && formData.ScanCode.trim().length > 0);
    const isFormValidForQr = Boolean(formData.WardId && formData.CategoryId && formData.TypeID && formData.Volume && formData.UnitID);

    // Helpers for parsing $$ separated column cells safely supporting case-insensitivity
    const parseDelimitedCell = (str) => {
        if (!str) return [];
        return String(str).split("$$").map(item => {
            const parts = item.split(":");
            const label = parts[0]?.trim() || "";
            const value = parts.slice(1).join(":").trim() || "";
            return { label, value };
        }).filter(item => item.label || item.value);
    };

    const parseQrCell = (str) => {
        if (!str) return { scanCode: "", status: "", info: "" };
        const parts = String(str).split("$$").map(p => p.trim());
        const scanCode = parts[0] || "";
        const statusPart = parts[1] || "";
        const statusVal = statusPart.includes(":") ? statusPart.split(":")[1].trim() : statusPart;
        const infoPart = parts[2] || "";
        const infoVal = infoPart.includes(":") ? infoPart.split(":").slice(1).join(":").trim() : infoPart;
        return { scanCode, status: statusVal, info: infoVal };
    };

    const getCategoryColorByName = (catName) => {
        const found = categories.find(c => (c.WasteCategoryName ?? c.wasteCategoryName ?? "").toLowerCase() === String(catName || "").toLowerCase());
        return found?.WasteCategoryColorCode ?? found?.wasteCategoryColorCode ?? null;
    };

    return (
        <section className="relative rounded-2xl p-4 shadow-sm ring-1 sm:p-6 space-y-6 w-full overflow-x-hidden" style={{ background: "var(--app-content-bg)", "--tw-ring-color": "var(--app-border)", color: "var(--app-text)" }}>
            {notification && (
                <TransactionNotice
                    notification={notification}
                    onDismiss={() => setNotification(null)}
                />
            )}

            <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        Ward Waste Packaging
                        {isEditing && (
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5" style={{ background: "color-mix(in srgb, var(--app-primary) 15%, var(--app-content-bg))", borderColor: "var(--app-primary)", color: "var(--app-primary)" }}>
                                <FontAwesomeIcon icon={faEdit} /> Edit Mode ({formData.ScanCode || `ID: ${formData.WardEntryId}`})
                            </span>
                        )}
                    </h2>
                    <p className="text-sm italic" style={{ color: 'var(--app-muted-text)' }}>
                        {isEditing ? "Modify existing waste package record" : "Create new waste package record"}
                    </p>
                </div>
            </div>

            {/* Entry Form */}
            <form
                onSubmit={handleSubmitClick}
                noValidate
                className="p-4 sm:p-6 rounded-xl shadow-sm border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
                style={{
                    background: "var(--app-content-bg)",
                    borderColor: "var(--app-border)",
                }}
            >
                {/* 1. Ward Dropdown */}
                <div className="relative">
                    <label
                        className="block text-xs font-semibold uppercase mb-1"
                        style={{ color: "var(--app-muted-text)" }}
                    >
                        Ward <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    {fieldErrors.WardId && activeErrorField === "WardId" && (
                        <ValidationPopover message={fieldErrors.WardId} />
                    )}
                    <select
                        name="WardId"
                        value={formData.WardId}
                        onChange={handleInputChange}
                        onFocus={() => fieldErrors.WardId && setActiveErrorField("WardId")}
                        className="w-full h-10 rounded-lg border p-2 text-sm outline-none transition"
                        style={{
                            background: "var(--app-content-bg)",
                            borderColor: fieldErrors.WardId ? "#dc2626" : "var(--app-border)",
                            color: "var(--app-text)",
                        }}
                    >
                        <option value="">-- Choose Ward --</option>
                        {wards.map((w, index) => {
                            const id = w.WardId ?? w.wardId ?? index;
                            const name = w.WardName ?? w.wardName ?? "Ward";
                            return (
                                <option key={`ward-${id}`} value={id}>
                                    {name}
                                </option>
                            );
                        })}
                    </select>
                </div>

                {/* 2. Waste Category Custom Picker */}
                <div className="relative">
                    <label
                        className="block text-xs font-semibold uppercase mb-1"
                        style={{ color: "var(--app-muted-text)" }}
                    >
                        Waste Category <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    {fieldErrors.CategoryId && activeErrorField === "CategoryId" && (
                        <ValidationPopover message={fieldErrors.CategoryId} />
                    )}
                    <CategoryPicker
                        value={formData.CategoryId}
                        categories={categories}
                        hasError={Boolean(fieldErrors.CategoryId)}
                        onChange={(val) => {
                            handleCategoryChange(val);
                        }}
                        onFocus={() => fieldErrors.CategoryId && setActiveErrorField("CategoryId")}
                    />
                </div>

                {/* 3. Waste Type Dropdown */}
                <div className="relative">
                    <label
                        className="block text-xs font-semibold uppercase mb-1"
                        style={{ color: "var(--app-muted-text)" }}
                    >
                        Waste Type <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    {fieldErrors.TypeID && activeErrorField === "TypeID" && (
                        <ValidationPopover message={fieldErrors.TypeID} />
                    )}
                    <select
                        name="TypeID"
                        value={formData.TypeID}
                        onChange={handleInputChange}
                        onFocus={() => fieldErrors.TypeID && setActiveErrorField("TypeID")}
                        className="w-full h-10 rounded-lg border p-2 text-sm outline-none transition"
                        style={{
                            background: "var(--app-content-bg)",
                            borderColor: fieldErrors.TypeID ? "#dc2626" : "var(--app-border)",
                            color: "var(--app-text)",
                        }}
                    >
                        <option value="">-- Choose Waste Type --</option>
                        {types.map((t, index) => {
                            const id = t.WasteTypeId ?? t.wasteTypeId ?? index;
                            const name = t.WasteTypeName ?? t.wasteTypeName ?? "Type";
                            return (
                                <option key={`type-${id}`} value={id}>
                                    {name}
                                </option>
                            );
                        })}
                    </select>
                </div>

                {/* 4. Volume Input */}
                <div className="relative">
                    <label
                        className="block text-xs font-semibold uppercase mb-1"
                        style={{ color: "var(--app-muted-text)" }}
                    >
                        Volume <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    {fieldErrors.Volume && activeErrorField === "Volume" && (
                        <ValidationPopover message={fieldErrors.Volume} />
                    )}
                    <input
                        type="text"
                        name="Volume"
                        autoComplete="off"
                        value={formData.Volume}
                        onFocus={() => fieldErrors.Volume && setActiveErrorField("Volume")}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                handleInputChange(e);
                            }
                        }}
                        placeholder="0.00"
                        className="w-full h-10 rounded-lg border p-2 text-sm outline-none transition"
                        style={{
                            background: "var(--app-content-bg)",
                            borderColor: fieldErrors.Volume ? "#dc2626" : "var(--app-border)",
                            color: "var(--app-text)",
                        }}
                    />
                </div>

                {/* 5. Unit Dropdown */}
                <div className="relative">
                    <label
                        className="block text-xs font-semibold uppercase mb-1"
                        style={{ color: "var(--app-muted-text)" }}
                    >
                        Unit <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    {fieldErrors.UnitID && activeErrorField === "UnitID" && (
                        <ValidationPopover message={fieldErrors.UnitID} />
                    )}
                    <select
                        name="UnitID"
                        value={formData.UnitID}
                        onChange={handleInputChange}
                        onFocus={() => fieldErrors.UnitID && setActiveErrorField("UnitID")}
                        className="w-full h-10 rounded-lg border p-2 text-sm outline-none transition"
                        style={{
                            background: "var(--app-content-bg)",
                            borderColor: fieldErrors.UnitID ? "#dc2626" : "var(--app-border)",
                            color: "var(--app-text)",
                        }}
                    >
                        <option value="">-- Choose Unit --</option>
                        {units.map((u, index) => {
                            const id = u.UnitId ?? u.unitId ?? index;
                            const unitName = u.Unit ?? u.unit ?? "Unit";
                            const short = u.Short ?? u.short ?? "";
                            return (
                                <option key={`unit-${id}`} value={id}>
                                    {unitName} {short ? `(${short})` : ""}
                                </option>
                            );
                        })}
                    </select>
                </div>

                {/* 6. Scan Code with Corrected z-[9999] Stacking Context Popup Info */}
                <div className="relative">
                    <label
                        className="block text-xs font-semibold uppercase mb-1"
                        style={{ color: "var(--app-muted-text)" }}
                    >
                        Scan Code <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <div
                        className="relative inline-block w-full cursor-pointer"
                        onMouseEnter={() => hasValidScanCode && setShowScanCodeInfo(true)}
                        onMouseLeave={() => setShowScanCodeInfo(false)}
                        onClick={() => hasValidScanCode && setShowScanCodeInfo((prev) => !prev)}
                    >
                        <input
                            type="text"
                            name="ScanCode"
                            value={formData.ScanCode}
                            readOnly
                            placeholder="Auto-generated upon QR creation..."
                            className="w-full h-10 rounded-lg border p-2 text-sm outline-none cursor-pointer font-mono truncate"
                            style={{
                                background: "color-mix(in srgb, var(--app-border) 20%, var(--app-content-bg))",
                                borderColor: "var(--app-border)",
                                color: "var(--app-text)",
                            }}
                            title={hasValidScanCode ? "Click or hover to inspect package information" : "Scan code is empty"}
                        />
                        {showScanCodeInfo && hasValidScanCode && (
                            <div
                                className="absolute left-0 bottom-full mb-2 z-[9999] w-72 rounded-xl border p-3 text-xs shadow-2xl space-y-1.5"
                                style={{
                                    background: "var(--app-content-bg)",
                                    borderColor: "var(--app-primary)",
                                    color: "var(--app-text)",
                                    boxShadow: "0 15px 30px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)",
                                }}
                            >
                                <p className="font-bold border-b pb-1 mb-1" style={{ color: "var(--app-primary)" }}>Package Scan Info</p>
                                <p><span className="font-semibold">Ward:</span> {wardDisplayName}</p>
                                <p><span className="font-semibold">Waste Category:</span> {catDisplayName}</p>
                                <p><span className="font-semibold">Waste Type:</span> {typeDisplayName}</p>
                                <p><span className="font-semibold">Volume:</span> {volumeWithUnit}</p>
                                <p><span className="font-semibold">Time:</span> {displayTimestamp}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 7. Remark TextArea (Optional) */}
                <div className="sm:col-span-2 md:col-span-3 relative">
                    <label
                        className="block text-xs font-semibold uppercase mb-1"
                        style={{ color: "var(--app-muted-text)" }}
                    >
                        Remark (Optional)
                    </label>
                    <textarea
                        name="Remark"
                        value={formData.Remark}
                        onChange={handleInputChange}
                        rows="2"
                        placeholder="Enter description (optional)..."
                        className="w-full rounded-lg border p-2 text-sm outline-none transition"
                        style={{
                            background: "var(--app-content-bg)",
                            borderColor: "var(--app-border)",
                            color: "var(--app-text)",
                        }}
                    ></textarea>
                </div>

                <div className="sm:col-span-2 md:col-span-3 flex justify-end flex-wrap gap-2 pt-2 items-center">
                    {isEditing && (
                        <button
                            type="button"
                            onClick={resetForm}
                            className="h-10 px-4 rounded-lg text-sm font-medium border transition hover:opacity-80 flex items-center gap-1.5"
                            style={{
                                borderColor: "var(--app-border)",
                                color: "var(--app-text)",
                            }}
                        >
                            <FontAwesomeIcon icon={faBan} /> Cancel Edit
                        </button>
                    )}

                    {isFormValidForQr && (!showSaveButton || showSaveButton) && (
                        <button
                            type="button"
                            onClick={handleGenerateQrClick}
                            className="h-10 flex items-center justify-center gap-2 px-5 rounded-lg text-sm font-semibold shadow-sm transition hover:opacity-95"
                            style={{
                                background: "var(--app-primary, #0369a1)",
                                color: "#ffffff",
                            }}
                        >
                            <FontAwesomeIcon icon={faQrcode} /> Generate QR Code
                        </button>
                    )}

                    {showSaveButton && (
                        <button
                            type="submit"
                            disabled={saving}
                            className="h-10 flex items-center justify-center gap-2 px-5 rounded-lg text-sm font-semibold shadow-sm transition hover:opacity-95 disabled:opacity-60"
                            style={{
                                background: "#059669",
                                color: "#ffffff",
                            }}
                        >
                            <FontAwesomeIcon icon={faSave} /> {saving ? "Saving..." : isEditing ? "Update Package" : "Save Package"}
                        </button>
                    )}
                </div>
            </form>

            {/* DataTable Controls & Search with Clear Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
                <label className="relative min-w-[12rem] flex-1 sm:max-w-xs flex items-center">
                    <span className="sr-only">Search Packaging records</span>
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-sm" style={{ color: 'var(--app-muted-text)' }} />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search packaging records"
                        className="h-10 w-full rounded-lg border pl-9 pr-9 text-sm outline-none focus-visible:ring-2"
                        style={{ background: 'var(--app-input-bg)', color: 'var(--app-text)', borderColor: 'var(--app-input-border)', '--tw-ring-color': 'var(--app-focus-ring)' }}
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-5 w-5 rounded-full hover:opacity-100 opacity-60 transition"
                            style={{ color: 'var(--app-muted-text)' }}
                            title="Clear search"
                        >
                            <FontAwesomeIcon icon={faXmark} className="text-xs" />
                        </button>
                    )}
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

            {/* Data Table Grid (Center-aligned column headers) */}
            <div
                className="relative overflow-x-auto rounded-xl border"
                aria-busy={loading}
                style={{
                    background: "var(--app-content-bg)",
                    borderColor: "var(--app-border)",
                }}
            >
                <table className="w-full text-left text-sm min-w-[850px]">
                    <thead
                        className="border-b text-xs uppercase font-semibold"
                        style={{
                            background: "var(--app-page-bg)",
                            borderColor: "var(--app-border)",
                            color: "var(--app-muted-text)",
                        }}
                    >
                        <tr>
                            <th className="p-3 text-center">Waste</th>
                            <th className="p-3 text-center">QR</th>
                            <th className="p-3 text-center min-w-[110px]">Action</th>
                            <th className="p-3 text-center">User</th>
                        </tr>
                    </thead>
                    <tbody
                        className="divide-y"
                        style={{ borderColor: "var(--app-border)" }}
                    >
                        {loading ? (
                            <tr>
                                <td colSpan="4" className="p-8 text-center" style={{ color: "var(--app-muted-text)" }}>
                                    Loading packaging records...
                                </td>
                            </tr>
                        ) : exportRows.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="p-8 text-center" style={{ color: "var(--app-muted-text)" }}>
                                    No packaging records found.
                                </td>
                            </tr>
                        ) : (
                            exportRows.map((item, index) => {
                                const actionId = item.Action ?? item.action ?? index;
                                const isRowEditing = editingRowId === actionId;
                                const wasteValue = item.Waste ?? item.waste ?? "";
                                const qrValue = item.QR ?? item.qr ?? "";
                                const userValue = item.User ?? item.user ?? "";

                                const wasteItems = parseDelimitedCell(wasteValue);
                                const qrInfo = parseQrCell(qrValue);
                                const userItems = parseDelimitedCell(userValue);

                                return (
                                    <tr
                                        key={`pkg-${actionId}-${index}`}
                                        className="transition hover:opacity-95"
                                        style={{
                                            background: isRowEditing ? "color-mix(in srgb, var(--app-primary) 15%, var(--app-content-bg))" : "transparent",
                                            borderColor: "var(--app-border)",
                                            color: "var(--app-text)"
                                        }}
                                    >
                                        {/* Waste Column */}
                                        <td className="p-3 align-top space-y-1">
                                            {wasteItems.map((w, idx) => {
                                                const isCat = w.label.toLowerCase() === "category";
                                                const catColor = isCat ? getCategoryColorByName(w.value) : null;
                                                return (
                                                    <div key={`w-${idx}`} className="text-xs flex items-center flex-wrap gap-1">
                                                        <span className="font-semibold" style={{ color: "var(--app-muted-text)" }}>{w.label}:</span>
                                                        {isCat ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold" style={{ background: "var(--app-content-bg)", borderColor: catColor || "var(--app-border)", color: "var(--app-text)" }}>
                                                                <span className="h-2.5 w-2.5 rounded-sm inline-block shrink-0" style={{ background: catColor || "var(--app-muted-text)" }} />
                                                                {w.value}
                                                            </span>
                                                        ) : (
                                                            <span className="font-medium">{w.value}</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </td>

                                        {/* QR Column */}
                                        <td className="p-3 align-top space-y-1.5 font-mono text-xs">
                                            <div>
                                                <span className="font-semibold text-xs font-sans" style={{ color: "var(--app-muted-text)" }}>Scan Code:</span>{" "}
                                                <span className="font-bold">{qrInfo.scanCode}</span>
                                            </div>
                                            <div>
                                                <span className="font-semibold text-xs font-sans" style={{ color: "var(--app-muted-text)" }}>Status:</span>{" "}
                                                <span className="font-medium">{qrInfo.status}</span>
                                            </div>
                                            {qrInfo.info && (
                                                <div>
                                                    <span className="font-semibold text-xs font-sans" style={{ color: "var(--app-muted-text)" }}>Info:</span>{" "}
                                                    <span className="font-medium">{qrInfo.info}</span>
                                                </div>
                                            )}
                                            <div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const parsedWard = wasteItems.find(i => i.label.toLowerCase() === "ward")?.value || "-";
                                                        const parsedCategory = wasteItems.find(i => i.label.toLowerCase() === "category")?.value || "-";
                                                        const parsedType = wasteItems.find(i => i.label.toLowerCase() === "type")?.value || "-";
                                                        const parsedVolume = wasteItems.find(i => i.label.toLowerCase() === "volume")?.value || "-";
                                                        setReprintModalData({
                                                            scanCode: qrInfo.scanCode,
                                                            status: qrInfo.status,
                                                            info: qrInfo.info || "Waste has been generated at ward/room.",
                                                            wardName: parsedWard,
                                                            catName: parsedCategory,
                                                            typeName: parsedType,
                                                            volume: parsedVolume,
                                                            timestamp: displayTimestamp,
                                                            items: wasteItems
                                                        });
                                                    }}
                                                    className="mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition hover:opacity-80 shadow-sm"
                                                    style={{ borderColor: "var(--app-primary)", color: "var(--app-primary)", background: "color-mix(in srgb, var(--app-primary) 10%, var(--app-content-bg))" }}
                                                >
                                                    <FontAwesomeIcon icon={faPrint} /> Print QR Code
                                                </button>
                                            </div>
                                        </td>

                                        {/* Action Column with Improved Spacing & Sizing */}
                                        <td className="p-3 text-center align-middle">
                                            <div className="inline-flex items-center justify-center gap-2">
                                                <IconButton
                                                    label={`Edit package record`}
                                                    icon={faEdit}
                                                    variant="edit"
                                                    onClick={() => handleEdit(actionId)}
                                                />
                                                <IconButton
                                                    label={`Delete package record`}
                                                    icon={faTrashAlt}
                                                    variant="delete"
                                                    onClick={() => setConfirmRecord(item)}
                                                />
                                            </div>
                                        </td>

                                        {/* User Column */}
                                        <td className="p-3 align-top text-xs space-y-1" style={{ color: "var(--app-muted-text)" }}>
                                            {userItems.map((u, idx) => (
                                                <div key={`u-${idx}`} className="flex flex-wrap gap-1 leading-tight">
                                                    <span className="font-semibold">{u.label}:</span>
                                                    <span className="font-normal" style={{ color: "var(--app-text)" }}>{u.value}</span>
                                                </div>
                                            ))}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                {loading && <DataLoadingOverlay message="Loading packaging records, please wait" />}
            </div>

            {/* QR Code Modal / Popup for New/Edit Workflow with Standardized Printable Layout */}
            {isQrModalOpen && (
                <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 overflow-y-auto" style={{ background: "var(--app-overlay-bg, rgba(0,0,0,0.6))" }}>
                    <div
                        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl relative space-y-4 my-auto"
                        style={{ background: "var(--app-content-bg)", color: "var(--app-text)", borderColor: "var(--app-border)" }}
                    >
                        <div className="flex justify-between items-center border-b pb-3 no-print">
                            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--app-primary)" }}>
                                <FontAwesomeIcon icon={faQrcode} /> Package QR Code
                            </h3>
                        </div>

                        <div id="printable-qr-area" className="p-4 rounded-xl border flex flex-col items-center text-center space-y-3" style={{ background: "var(--app-page-bg)", borderColor: "var(--app-border)" }}>
                            <div className="p-2 bg-white rounded-lg shadow-sm border inline-block qr-code-svg-box">
                                <QRCodeSVG
                                    value={formData.ScanCode || "BMW-WNG-PENDING"}
                                    size={140}
                                    level="M"
                                    marginSize={4}
                                    bgColor="#FFFFFF"
                                    fgColor="#000000"
                                />
                            </div>
                            <p className="font-mono text-xs font-bold screen-only-metadata" style={{ color: "var(--app-primary)" }}>{formData.ScanCode}</p>

                            <div className="text-left w-full text-xs space-y-1 border-t pt-2 mt-2 screen-only-metadata" style={{ borderColor: "var(--app-border)" }}>
                                <p><span className="font-semibold">Ward:</span> {wardDisplayName}</p>
                                <p><span className="font-semibold">Waste Category:</span> {catDisplayName}</p>
                                <p><span className="font-semibold">Waste Type:</span> {typeDisplayName}</p>
                                <p><span className="font-semibold">Volume:</span> {volumeWithUnit}</p>
                                <p><span className="font-semibold">Status:</span> Generated</p>
                                <p><span className="font-semibold">Info:</span> Waste has been generated at ward/room.</p>
                                <p><span className="font-semibold">Time:</span> {displayTimestamp}</p>
                            </div>
                        </div>

                        {/* Center-Aligned Print QR Code Button and Close Workflow */}
                        <div className={`flex items-center flex-wrap gap-2 pt-2 no-print ${hasPrintedQr ? "justify-between" : "justify-center"}`}>
                            <button
                                type="button"
                                onClick={handlePrintQr}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition hover:opacity-80 shadow-sm mx-auto"
                                style={{ borderColor: "var(--app-primary)", color: "var(--app-primary)", background: "color-mix(in srgb, var(--app-primary) 10%, var(--app-content-bg))" }}
                            >
                                <FontAwesomeIcon icon={faPrint} /> Print QR Code
                            </button>

                            {hasPrintedQr && (
                                <button
                                    type="button"
                                    onClick={handleCloseQrModal}
                                    className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 animate-pulse shadow-sm"
                                    style={{ background: "#059669" }}
                                >
                                    <FontAwesomeIcon icon={faCheckCircle} /> Close & Enable Save
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reprint QR Code Modal Using Identical Printable Layout (#printable-qr-area) */}
            {reprintModalData && (
                <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 overflow-y-auto" style={{ background: "var(--app-overlay-bg, rgba(0,0,0,0.6))" }}>
                    <div
                        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl relative space-y-4 my-auto"
                        style={{ background: "var(--app-content-bg)", color: "var(--app-text)", borderColor: "var(--app-border)" }}
                    >
                        <div className="flex justify-between items-center border-b pb-3 no-print">
                            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--app-primary)" }}>
                                <FontAwesomeIcon icon={faQrcode} /> Reprint Package QR Code
                            </h3>
                            <button onClick={() => setReprintModalData(null)} className="opacity-70 hover:opacity-100">
                                <FontAwesomeIcon icon={faXmark} />
                            </button>
                        </div>

                        <div id="printable-qr-area" className="p-4 rounded-xl border flex flex-col items-center text-center space-y-3" style={{ background: "var(--app-page-bg)", borderColor: "var(--app-border)" }}>
                            <div className="p-2 bg-white rounded-lg shadow-sm border inline-block qr-code-svg-box">
                                <QRCodeSVG
                                    value={reprintModalData.scanCode}
                                    size={140}
                                    level="M"
                                    marginSize={4}
                                    bgColor="#FFFFFF"
                                    fgColor="#000000"
                                />
                            </div>
                            <p className="font-mono text-xs font-bold screen-only-metadata" style={{ color: "var(--app-primary)" }}>{reprintModalData.scanCode}</p>

                            <div className="text-left w-full text-xs space-y-1 border-t pt-2 mt-2 screen-only-metadata" style={{ borderColor: "var(--app-border)" }}>
                                <p><span className="font-semibold">Ward:</span> {reprintModalData.wardName}</p>
                                <p><span className="font-semibold">Waste Category:</span> {reprintModalData.catName}</p>
                                <p><span className="font-semibold">Waste Type:</span> {reprintModalData.typeName}</p>
                                <p><span className="font-semibold">Volume:</span> {reprintModalData.volume}</p>
                                <p><span className="font-semibold">Status:</span> {reprintModalData.status || "Generated"}</p>
                                <p><span className="font-semibold">Info:</span> {reprintModalData.info}</p>
                                <p><span className="font-semibold">Time:</span> {reprintModalData.timestamp}</p>
                            </div>
                        </div>

                        <div className="flex justify-center gap-2 pt-2 no-print">
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition hover:opacity-80 shadow-sm mx-auto"
                                style={{ borderColor: "var(--app-primary)", color: "var(--app-primary)", background: "color-mix(in srgb, var(--app-primary) 10%, var(--app-content-bg))" }}
                            >
                                <FontAwesomeIcon icon={faPrint} /> Print Label
                            </button>
                            <button
                                type="button"
                                onClick={() => setReprintModalData(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium border transition hover:opacity-80"
                                style={{ borderColor: "var(--app-border)", color: "var(--app-text)" }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Dialog Before Saving */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto" style={{ background: "var(--app-overlay-bg, rgba(0,0,0,0.6))" }}>
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-5 my-auto"
                        style={{ background: "var(--app-content-bg)", color: "var(--app-text)", borderColor: "var(--app-border)" }}
                    >
                        <div className="flex flex-col items-center text-center space-y-3">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-sm" style={{ background: "color-mix(in srgb, #d97706 15%, var(--app-content-bg))", color: "#d97706" }}>
                                <FontAwesomeIcon icon={faExclamationTriangle} className="text-xl" />
                            </span>
                            <h3 className="text-base font-bold tracking-wide uppercase" style={{ color: "#d97706" }}>
                                QR LABEL ATTACHMENT REQUIRED
                            </h3>

                            <div className="rounded-xl border p-4 text-left w-full space-y-2 text-sm leading-relaxed" style={{ background: "color-mix(in srgb, #d97706 8%, var(--app-content-bg))", borderColor: "color-mix(in srgb, #d97706 30%, var(--app-border))" }}>
                                <p className="font-medium text-center" style={{ color: "var(--app-text)" }}>
                                    “Have you printed the QR code and securely attached the label to the correct BMW waste bag? Confirm only after completing this step. The package cannot be saved until you confirm.”
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-center pt-1">
                            <button
                                type="button"
                                onClick={handleRegenerateAndPrintFromConfirm}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition hover:opacity-85 shadow-sm w-full sm:w-auto"
                                style={{ borderColor: "var(--app-primary)", color: "var(--app-primary)", background: "color-mix(in srgb, var(--app-primary) 8%, var(--app-content-bg))" }}
                            >
                                <FontAwesomeIcon icon={faQrcode} /> Regenerate & Print QR Code
                            </button>
                        </div>

                        <div className="flex flex-wrap justify-end items-center gap-2 pt-4 border-t" style={{ borderColor: "var(--app-border)" }}>
                            <button
                                type="button"
                                autoFocus
                                onClick={() => setConfirmDialog(false)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition hover:opacity-80 shadow-sm"
                                style={{ borderColor: "var(--app-border)", color: "var(--app-text)", background: "color-mix(in srgb, var(--app-border) 15%, var(--app-content-bg))" }}
                            >
                                <FontAwesomeIcon icon={faBan} /> No (Cancel)
                            </button>
                            <button
                                type="button"
                                onClick={executeConfirmedSave}
                                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 shadow-sm"
                                style={{ background: "#059669" }}
                            >
                                <FontAwesomeIcon icon={faSave} /> Yes (Proceed & Save)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Dialog with Detailed Waste Column Summary */}
            {confirmRecord && (
                <div className="fixed inset-0 z-[66] flex items-center justify-center p-4 overflow-y-auto" style={{ background: "var(--app-overlay-bg)" }}>
                    <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border p-5 shadow-2xl space-y-4" style={{ background: "var(--app-content-bg)", color: "var(--app-text)", borderColor: "var(--app-border)" }}>
                        <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: "#dc2626" }}>
                            <FontAwesomeIcon icon={faTrashAlt} /> Confirm Deletion
                        </h3>
                        <p className="text-sm">Are you sure you want to delete the following package entry?</p>
                        <div className="rounded-xl border p-3 text-xs space-y-1" style={{ background: "var(--app-page-bg)", borderColor: "var(--app-border)" }}>
                            {parseDelimitedCell(confirmRecord.Waste ?? confirmRecord.waste).map((item, idx) => (
                                <div key={`del-w-${idx}`} className="flex gap-1">
                                    <span className="font-semibold" style={{ color: "var(--app-muted-text)" }}>{item.label}:</span>
                                    <span className="font-medium">{item.value}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" className="rounded-lg border px-4 py-2 text-sm" style={{ borderColor: "var(--app-border)", color: "var(--app-text)" }} onClick={() => setConfirmRecord(null)}>No</button>
                            <button type="button" className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: '#b91c1c', color: '#fff' }} onClick={handleDeleteRecord}>Yes, Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {errorDialog && (
                <ErrorDialog
                    message={errorDialog.message}
                    operation={errorDialog.operation}
                    onClose={closeErrorDialog}
                />
            )}

            {/* Print-Specific CSS rules optimized for single-page thermal/small label printers */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @page {
                    size: 50mm 30mm;
                    margin: 0;
                }
                @media print {
                    html, body {
                        width: 50mm;
                        height: 30mm;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        overflow: hidden !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #printable-qr-area, #printable-qr-area * {
                        visibility: visible !important;
                    }
                    .screen-only-metadata {
                        display: none !important;
                    }
                    #printable-qr-area {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 50mm !important;
                        height: 30mm !important;
                        margin: 0 !important;
                        border: none !important;
                        background: #ffffff !important;
                        box-shadow: none !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: center !important;
                        padding: 1.5mm !important;
                        page-break-after: avoid !important;
                        page-break-before: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    #printable-qr-area .qr-code-svg-box {
                        padding: 0.5mm !important;
                        background: #ffffff !important;
                        border: none !important;
                    }
                }
            `}} />
        </section>
    );
};

/* 
  Theme-Aligned Anchored Validation Popover Component
*/
function ValidationPopover({ message }) {
    return (
        <div
            className="absolute -top-9 left-2 z-40 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold shadow-lg animate-bounce pointer-events-none"
            style={{
                background: "#dc2626",
                color: "#ffffff",
                boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
            }}
        >
            <FontAwesomeIcon icon={faExclamationCircle} className="text-xs" />
            <span>{message}</span>
            <div
                className="absolute left-4 -bottom-1 h-2 w-2 rotate-45"
                style={{ background: "#dc2626" }}
            />
        </div>
    );
}

/* 
  Standardized Transaction Notice Matching Ward Screen Pattern
*/
function TransactionNotice({ notification, onDismiss }) {
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        setClosing(false);
        const closeTimer = window.setTimeout(() => setClosing(true), 4500);
        const dismissTimer = window.setTimeout(onDismiss, 5000);
        return () => {
            window.clearTimeout(closeTimer);
            window.clearTimeout(dismissTimer);
        };
    }, [notification, onDismiss]);

    const accent = notification.type === "success" ? "#15803d" : "#b91c1c";
    const accentDark = notification.type === "success" ? "#166534" : "#991b1b";

    return (
        <div
            className={`transaction-notice fixed right-4 top-4 z-[100] flex w-max max-w-[calc(100vw-2rem)] flex-col items-center gap-1 rounded-xl border p-3 pt-3 text-center text-base shadow-2xl transition-all duration-300 ${closing ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}
            style={{
                '--notice-accent': accent,
                '--notice-accent-dark': accentDark,
                background: 'var(--app-content-bg)',
                color: accent,
                borderColor: accent,
            }}
        >
            <span className="transaction-notice-icon">
                <FontAwesomeIcon icon={notification.icon || (notification.type === 'success' ? faCheck : faXmark)} />
            </span>
            <span className="transaction-notice-message font-semibold text-sm">{notification.message}</span>
        </div>
    );
}

/* 
  Error Dialog Component (Standard Enterprise Reference)
*/
function ErrorDialog({ message, operation, onClose }) {
    const [recipient, setRecipient] = useState("");
    const [copied, setCopied] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendMessage, setSendMessage] = useState("");

    async function copy() {
        await navigator.clipboard?.writeText(message);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    }

    async function sendDetails(event) {
        event.preventDefault();
        if (!recipient.trim() || sending) return;
        setSending(true);
        setSendMessage("");
        try {
            const response = await fetch(`${API_BASE_URL}/api/support/email/error-details`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: recipient.trim(), errorMessage: message, screen: "Ward Packaging", route: window.location.pathname, operation }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.message || "The error details email could not be sent.");
            setSendMessage("Error details sent successfully.");
        } catch (sendError) {
            setSendMessage(sendError.message);
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[67] flex items-center justify-center overflow-y-auto p-4" style={{ background: "var(--app-overlay-bg)" }}>
            <div role="alertdialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border p-5 shadow-2xl" style={{ background: "var(--app-content-bg)", color: "var(--app-text)", borderColor: "var(--app-border)" }}>
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--app-primary) 15%, var(--app-content-bg))", color: "var(--app-primary)" }}>
                        <FontAwesomeIcon icon={faXmark} />
                    </span>
                    <div>
                        <h3 className="text-lg font-bold" style={{ color: "var(--app-primary)" }}>Operation failed</h3>
                        <p className="mt-1 text-sm" style={{ color: "var(--app-muted-text)" }}>Review the details below or send them to support.</p>
                    </div>
                </div>
                <div className="mt-4 rounded-xl border p-3" style={{ background: "var(--app-page-bg)", borderColor: "var(--app-border)" }}>
                    <p className="break-words whitespace-pre-wrap text-sm">{message}</p>
                </div>
                <form onSubmit={sendDetails} className="mt-4">
                    <label className="block text-sm font-semibold">Send details to email
                        <input type="email" required value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="recipient@example.com" className="mt-2 h-11 w-full rounded-lg border px-3 font-normal outline-none focus-visible:ring-2" style={{ background: "var(--app-input-bg)", color: "var(--app-text)", borderColor: "var(--app-input-border)", "--tw-ring-color": "var(--app-focus-ring)" }} />
                    </label>
                    {sendMessage && <p className="mt-2 text-sm font-semibold" style={{ color: "var(--app-primary)" }}>{sendMessage}</p>}
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <button type="button" className="flex items-center gap-2 rounded-lg border px-4 py-2" style={{ borderColor: "var(--app-border)", color: "var(--app-text)" }} onClick={copy}>
                            <FontAwesomeIcon icon={faClipboard} />{copied ? "Copied !!!" : "Copy"}
                        </button>
                        <button type="submit" disabled={sending} className="flex items-center gap-2 rounded-lg px-4 py-2 font-semibold disabled:opacity-60" style={{ background: "var(--app-primary)", color: "var(--app-sidebar-active-text)" }}>
                            <FontAwesomeIcon icon={faEnvelope} />{sending ? "Sending..." : "Email"}
                        </button>
                        <button type="button" className="flex items-center gap-2 rounded-lg border px-4 py-2" style={{ borderColor: "var(--app-border)", color: "var(--app-text)" }} onClick={onClose}>
                            <FontAwesomeIcon icon={faXmark} />Close
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function normalizeErrorMessage(message) {
    const lines = String(message ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const uniqueLines = [...new Set(lines)];
    return uniqueLines.join("\n") || "The operation could not be completed.";
}

function ExportButton({ icon, label, onClick }) {
    return (
        <button type="button" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition hover:opacity-80" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }} onClick={onClick}>
            <FontAwesomeIcon icon={icon} />{label}
        </button>
    );
}

function IconButton({ icon, label, variant = 'default', onClick }) {
    const isDelete = variant === 'delete';
    const isEdit = variant === 'edit';
    const accentColor = isDelete ? '#dc2626' : isEdit ? 'var(--app-primary)' : 'var(--app-text)';
    const bgColor = isDelete
        ? 'color-mix(in srgb, #dc2626 10%, var(--app-content-bg))'
        : isEdit
            ? 'color-mix(in srgb, var(--app-primary) 10%, var(--app-content-bg))'
            : 'color-mix(in srgb, var(--app-text) 5%, var(--app-content-bg))';
    const borderColor = isDelete
        ? 'color-mix(in srgb, #dc2626 28%, var(--app-border))'
        : isEdit
            ? 'color-mix(in srgb, var(--app-primary) 28%, var(--app-border))'
            : 'var(--app-border)';

    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm transition-all duration-150 hover:scale-105 hover:shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2"
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
    );
}

/* 
  CategoryPicker & CategorySwatch Component
*/
function CategoryPicker({ value, categories, hasError, onChange, onFocus, onBlur }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    const selectedCatId = value ? String(value) : "";
    const selected = categories.find(
        (category) =>
            String(category.WasteCategoryId ?? category.wasteCategoryId) === selectedCatId
    );

    useEffect(() => {
        function onDocumentMouseDown(event) {
            if (!rootRef.current?.contains(event.target)) {
                if (open) {
                    setOpen(false);
                    onBlur?.(value);
                }
            }
        }
        function onDocumentKeyDown(event) {
            if (event.key === "Escape") {
                if (open) {
                    setOpen(false);
                    onBlur?.(value);
                }
            }
        }
        document.addEventListener("mousedown", onDocumentMouseDown);
        document.addEventListener("keydown", onDocumentKeyDown);
        return () => {
            document.removeEventListener("mousedown", onDocumentMouseDown);
            document.removeEventListener("keydown", onDocumentKeyDown);
        };
    }, [open, value, onBlur]);

    function handleContainerBlur(event) {
        if (rootRef.current?.contains(event.relatedTarget)) {
            return;
        }
        if (!open) {
            onBlur?.(value);
        }
    }

    function handleSelect(nextVal) {
        onChange(nextVal);
        setOpen(false);
        onBlur?.(nextVal);
    }

    const selectedName =
        selected?.WasteCategoryName ??
        selected?.wasteCategoryName ??
        "Select Waste Category";
    const selectedColor =
        selected?.WasteCategoryColorCode ?? selected?.wasteCategoryColorCode;

    return (
        <div ref={rootRef} onBlur={handleContainerBlur} className="relative">
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                onFocus={onFocus}
                className="flex h-10 w-full cursor-pointer items-center justify-between rounded-lg border px-3 text-left text-sm transition-colors duration-150 outline-none"
                style={{
                    background: "var(--app-input-bg, var(--app-content-bg))",
                    color: "var(--app-text)",
                    borderColor: hasError ? "#dc2626" : open ? "var(--app-primary)" : "var(--app-border)",
                }}
                onClick={() => setOpen((current) => !current)}
            >
                <div className="flex items-center gap-2 truncate flex-1">
                    {selected && <CategorySwatch color={selectedColor} />}
                    <span className="truncate">{selected ? selectedName : "Select Waste Category"}</span>
                </div>
                <FontAwesomeIcon icon={faChevronDown} className="text-xs opacity-60 shrink-0 ml-2" />
            </button>
            {open && (
                <div
                    role="listbox"
                    className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border p-1 shadow-xl"
                    style={{
                        background: "var(--app-content-bg)",
                        borderColor: "var(--app-border)",
                    }}
                >
                    <button
                        type="button"
                        role="option"
                        aria-selected={!selected}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:opacity-80"
                        style={{ color: "var(--app-muted-text)" }}
                        onClick={() => handleSelect("")}
                    >
                        Select Waste Category
                    </button>
                    {categories.map((category) => {
                        const catId = String(
                            category.WasteCategoryId ?? category.wasteCategoryId
                        );
                        const catName =
                            category.WasteCategoryName ?? category.wasteCategoryName;
                        const catColor =
                            category.WasteCategoryColorCode ?? category.wasteCategoryColorCode;
                        return (
                            <button
                                type="button"
                                role="option"
                                aria-selected={catId === selectedCatId}
                                key={catId}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:opacity-80"
                                style={{
                                    color: "var(--app-text)",
                                    background:
                                        catId === selectedCatId
                                            ? "color-mix(in srgb, var(--app-primary) 12%, var(--app-content-bg))"
                                            : "transparent",
                                }}
                                onClick={() => handleSelect(catId)}
                            >
                                <CategorySwatch color={catColor} />
                                <span className="truncate">{catName}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function CategorySwatch({ color }) {
    return (
        <span
            aria-hidden="true"
            title={color || undefined}
            className="inline-block h-4 w-4 shrink-0 rounded border shadow-sm"
            style={{
                background: color || "var(--app-muted-text)",
                borderColor:
                    color === "#F8FAFC"
                        ? "var(--app-border)"
                        : color || "var(--app-border)",
            }}
        />
    );
}

export default Packaging;