import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faXmark, faExclamationCircle, faEnvelope, faClipboard, faQrcode, faPrint, faSearch, faFilePdf, faFileExcel, faDownload, faCheckCircle, faShieldHalved, faQuestionCircle, faBan } from "@fortawesome/free-solid-svg-icons";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import DataLoadingOverlay from "../../components/DataLoadingOverlay.jsx";

const WardInChargeApproval = ({ settings, profile }) => {
    const [entries, setEntries] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [pageSize, setPageSize] = useState(10);

    const [notification, setNotification] = useState(null);
    const [errorDialog, setErrorDialog] = useState(null);
    const [reprintModalData, setReprintModalData] = useState(null);
    const [confirmRecord, setConfirmRecord] = useState(null);
    const [approving, setApproving] = useState(false);
    const errorDialogDismissed = useRef(false);

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
            const [catRes, listRes] = await Promise.all([
                axios.post("/api/wardinchargeapproval", { TransactionValue: 8 }, { withCredentials: true }).catch(() => ({ data: [] })),
                axios.post("/api/wardinchargeapproval", { TransactionValue: 11 }, { withCredentials: true }),
            ]);
            setCategories(Array.isArray(catRes.data) ? catRes.data : []);
            setEntries(Array.isArray(listRes.data) ? listRes.data : []);
        } catch (err) {
            const message = normalizeErrorMessage(err.response?.data?.message || err.message || "Unable to load approval packaging records.");
            if (!errorDialogDismissed.current) {
                setErrorDialog({ message, operation: "Load Ward In-Charge Approval records" });
            }
        } finally {
            setLoading(false);
        }
    };

    const executeApprovedSave = async () => {
        if (!confirmRecord || approving) return;
        setApproving(true);
        const recordId = confirmRecord.Action ?? confirmRecord.action;
        const wasteItems = parseDelimitedCell(confirmRecord.Waste ?? confirmRecord.waste ?? "");
        const scanCodeVal = parseQrCell(confirmRecord.QR ?? confirmRecord.qr ?? "").scanCode;

        try {
            const payload = {
                WardEntryId: Number(recordId),
                TransactionValue: 6,
            };

            const response = await axios.post("/api/wardinchargeapproval", payload, { withCredentials: true });
            const result = response.data;
            const resultId = Number(result?.ResultID ?? result?.resultID ?? result?.resultId ?? 0);

            if (response.status >= 200 && response.status < 300 && resultId !== 206 && resultId !== 201) {
                setNotification({
                    type: "success",
                    message: result?.TransMessage || `Package ${scanCodeVal} approved successfully.`
                });
                setConfirmRecord(null);
                await loadData();
            } else {
                showError(result?.TransMessage || result?.message || "Approval operation failed.");
            }
        } catch (err) {
            const errorMsg = err.response?.data?.transMessage || err.response?.data?.message || err.message;
            showError(errorMsg || "Operation failed. Please check inputs and try again.");
        } finally {
            setApproving(false);
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

    const exportColumns = [
        ['Waste Details', (row) => String(row.Waste ?? row.waste ?? '').replaceAll('$$', ' | ')],
        ['Storage Area Approval', (row) => String(row.QR ?? row.qr ?? '').replaceAll('$$', ' | ')],
        ['Recorded User', (row) => String(row.User ?? row.user ?? '').replaceAll('$$', ' | ')],
    ];

    function exportCsv() {
        downloadFile(`${csvText(exportRows, exportColumns)}`, 'WardInChargeApprovalRecords.csv', 'text/csv;charset=utf-8');
    }

    function exportExcel() {
        const body = exportRows.map((row) => `<tr>${exportColumns.map(([, value]) => `<td>${escapeHtml(value(row))}</td>`).join('')}</tr>`).join('');
        const html = `<html><head><meta charset="utf-8"></head><body><h1>Ward In-Charge Approval List</h1><table><thead><tr>${exportColumns.map(([name]) => `<th>${name}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></body></html>`;
        downloadFile(html, 'WardInChargeApprovalRecords.xls', 'application/vnd.ms-excel');
    }

    async function copyExport() {
        await navigator.clipboard?.writeText(csvText(exportRows, exportColumns));
        setNotification({ type: 'success', message: 'Approval records copied to clipboard.' });
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
        doc.text('Ward In-Charge Waste Approval List', 148, 16, { align: 'center' });
        doc.setFontSize(8);
        doc.text(generated, 285, 14, { align: 'right' });
        doc.text(`Generated By: ${profile?.userName ?? 'Ward In-Charge'}`, 285, 20, { align: 'right' });
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

    function showError(message) {
        errorDialogDismissed.current = false;
        setErrorDialog({ message: normalizeErrorMessage(message), operation: "Ward In-Charge Approval transaction" });
    }

    function closeErrorDialog() {
        errorDialogDismissed.current = true;
        setErrorDialog(null);
    }

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
                        <FontAwesomeIcon icon={faShieldHalved} style={{ color: "var(--app-primary)" }} /> Ward In-Charge Approval
                    </h2>
                    <p className="text-sm italic" style={{ color: 'var(--app-muted-text)' }}>
                        Inspect and verify packaged biomedical waste packages prior to storage area
                    </p>
                </div>
            </div>

            {/* Controls & Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="relative min-w-[12rem] flex-1 sm:max-w-xs flex items-center">
                    <span className="sr-only">Search packaging approval records</span>
                    <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-sm" style={{ color: 'var(--app-muted-text)' }} />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search packaging records..."
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

            {/* Approval Table Grid */}
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
                            <th className="p-3 text-center">Waste Package Details</th>
                            <th className="p-3 text-center">Storage Area Approval</th>
                            <th className="p-3 text-center">Recorded User</th>
                        </tr>
                    </thead>
                    <tbody
                        className="divide-y"
                        style={{ borderColor: "var(--app-border)" }}
                    >
                        {loading ? (
                            <tr>
                                <td colSpan="3" className="p-8 text-center" style={{ color: "var(--app-muted-text)" }}>
                                    Loading approval records, please wait...
                                </td>
                            </tr>
                        ) : exportRows.length === 0 ? (
                            <tr>
                                <td colSpan="3" className="p-8 text-center" style={{ color: "var(--app-muted-text)" }}>
                                    No waste package records available for approval.
                                </td>
                            </tr>
                        ) : (
                            exportRows.map((item, index) => {
                                const actionId = item.Action ?? item.action ?? index;
                                const wasteValue = item.Waste ?? item.waste ?? "";
                                const qrValue = item.QR ?? item.qr ?? "";
                                const userValue = item.User ?? item.user ?? "";

                                const wasteItems = parseDelimitedCell(wasteValue);
                                const qrInfo = parseQrCell(qrValue);
                                const userItems = parseDelimitedCell(userValue);

                                return (
                                    <tr
                                        key={`appr-${actionId}-${index}`}
                                        className="transition hover:opacity-95"
                                        style={{
                                            background: "transparent",
                                            borderColor: "var(--app-border)",
                                            color: "var(--app-text)"
                                        }}
                                    >
                                        <td className="p-3 align-top space-y-1">
                                            {wasteItems.map((w, idx) => {
                                                const isCat = w.label.toLowerCase() === "category";
                                                const catColor = isCat ? getCategoryColorByName(w.value) : null;
                                                return (
                                                    <div key={`w-${idx}`} className="text-xs flex items-center flex-wrap gap-1">
                                                        <span className="font-semibold" style={{ color: "var(--app-muted-text)" }}>{w.label}:</span>
                                                        {isCat ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold" style={{ background: "var(--app-content-bg)", borderColor: catColor || "var(--app-border)", color: "var(--app-text)" }}>
                                                                <CategorySwatch color={catColor} />
                                                                {w.value}
                                                            </span>
                                                        ) : (
                                                            <span className="font-medium">{w.value}</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </td>

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
                                            <div className="flex flex-wrap items-center gap-2 pt-1">
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
                                                            info: qrInfo.info || "Waste package awaiting ward in-charge verification.",
                                                            wardName: parsedWard,
                                                            catName: parsedCategory,
                                                            typeName: parsedType,
                                                            volume: parsedVolume,
                                                        });
                                                    }}
                                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition hover:opacity-80 shadow-sm"
                                                    style={{ borderColor: "var(--app-primary)", color: "var(--app-primary)", background: "color-mix(in srgb, var(--app-primary) 10%, var(--app-content-bg))" }}
                                                >
                                                    <FontAwesomeIcon icon={faQrcode} /> Inspect QR Code
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmRecord(item)}
                                                    className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold text-white transition hover:opacity-90 shadow-sm"
                                                    style={{ background: "#059669" }}
                                                    title="Approve package for storage area"
                                                >
                                                    <FontAwesomeIcon icon={faCheck} /> Approve
                                                </button>
                                            </div>
                                        </td>

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
                {loading && <DataLoadingOverlay message="Loading approval records, please wait" />}
            </div>

            {/* Approval Confirmation Dialog (Referencing Packaging.jsx Layout with Requested Customizations) */}
            {confirmRecord && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto" style={{ background: "var(--app-overlay-bg, rgba(0,0,0,0.6))" }}>
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-5 my-auto"
                        style={{ background: "var(--app-content-bg)", color: "var(--app-text)", borderColor: "var(--app-border)" }}
                    >
                        <div className="flex flex-col items-center text-center space-y-3">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-sm" style={{ background: "color-mix(in srgb, var(--app-primary) 15%, var(--app-content-bg))", color: "var(--app-primary)" }}>
                                <FontAwesomeIcon icon={faQuestionCircle} className="text-xl" />
                            </span>
                            <h3 className="text-base font-bold tracking-wide uppercase" style={{ color: "var(--app-primary)" }}>
                                Are You Sure To Approve Following Waste Bag?
                            </h3>

                            <div className="rounded-xl border p-4 text-left w-full space-y-1 text-xs leading-relaxed" style={{ background: "var(--app-page-bg)", borderColor: "var(--app-border)" }}>
                                {parseDelimitedCell(confirmRecord.Waste ?? confirmRecord.waste).map((item, idx) => (
                                    <div key={`conf-w-${idx}`} className="flex gap-1">
                                        <span className="font-semibold" style={{ color: "var(--app-muted-text)" }}>{item.label}:</span>
                                        <span className="font-medium" style={{ color: "var(--app-text)" }}>{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-wrap justify-end items-center gap-2 pt-4 border-t" style={{ borderColor: "var(--app-border)" }}>
                            <button
                                type="button"
                                autoFocus
                                onClick={() => setConfirmRecord(null)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition hover:opacity-80 shadow-sm"
                                style={{ borderColor: "var(--app-border)", color: "var(--app-text)", background: "color-mix(in srgb, var(--app-border) 15%, var(--app-content-bg))" }}
                            >
                                <FontAwesomeIcon icon={faBan} /> No (Cancel)
                            </button>
                            <button
                                type="button"
                                disabled={approving}
                                onClick={executeApprovedSave}
                                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 shadow-sm disabled:opacity-60"
                                style={{ background: "#059669" }}
                            >
                                <FontAwesomeIcon icon={faCheck} /> {approving ? "Approving..." : "Yes (Proceed & Approve)"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Code Inspection Modal with Clean Print Isolation */}
            {reprintModalData && (
                <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 overflow-y-auto" style={{ background: "var(--app-overlay-bg, rgba(0,0,0,0.6))" }}>
                    <div
                        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl relative space-y-4 my-auto"
                        style={{ background: "var(--app-content-bg)", color: "var(--app-text)", borderColor: "var(--app-border)" }}
                    >
                        <div className="flex justify-between items-center border-b pb-3 no-print">
                            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--app-primary)" }}>
                                <FontAwesomeIcon icon={faQrcode} /> Inspect Package QR Label
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
                            <p className="font-mono text-xs font-bold" style={{ color: "var(--app-primary)" }}>{reprintModalData.scanCode}</p>

                            <div className="text-left w-full text-xs space-y-1 border-t pt-2 mt-2" style={{ borderColor: "var(--app-border)" }}>
                                <p><span className="font-semibold">Ward:</span> {reprintModalData.wardName}</p>
                                <p><span className="font-semibold">Waste Category:</span> {reprintModalData.catName}</p>
                                <p><span className="font-semibold">Waste Type:</span> {reprintModalData.typeName}</p>
                                <p><span className="font-semibold">Volume:</span> {reprintModalData.volume}</p>
                                <p><span className="font-semibold">Status:</span> {reprintModalData.status || "Pending Approval"}</p>
                            </div>
                        </div>

                        <div className="flex justify-center gap-2 pt-2 no-print">
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition hover:opacity-80 shadow-sm"
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

            {errorDialog && (
                <ErrorDialog
                    message={errorDialog.message}
                    operation={errorDialog.operation}
                    onClose={closeErrorDialog}
                />
            )}

            {/* Print-Specific CSS rules optimized for reference image label output */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @page {
                    size: auto;
                    margin: 10mm;
                }
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #printable-qr-area, #printable-qr-area * {
                        visibility: visible !important;
                    }
                    #printable-qr-area {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        max-width: 80mm !important;
                        margin: 0 auto !important;
                        border: 1px solid #cbd5e1 !important;
                        background: #f8fafc !important;
                        box-shadow: none !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        text-align: center !important;
                        padding: 12px !important;
                    }
                }
            `}} />
        </section>
    );
};

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
            const response = await fetch("/api/support/email/error-details", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: recipient.trim(), errorMessage: message, screen: "Ward In-Charge Approval", route: window.location.pathname, operation }),
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

export default WardInChargeApproval;