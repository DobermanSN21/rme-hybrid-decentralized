// components/RecordCard.jsx
// ============================================================
// Medical Record display card — supports images and PDFs
// ============================================================

import { useState } from "react";
import { useDisplayName } from "../hooks/useDisplayName";

// SVG Icons
const IconImage = ({ size = 18, color = "#2E7DDB" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
);

const IconFilePdf = ({ size = 18, color = "#e11d48" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
);

const IconFileGeneric = ({ size = 18, color = "#64748b" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
);

const IconLock = ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const IconUnlock = ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
);

const IconDownload = ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" />
    </svg>
);

const IconEye = ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
);

const IconEyeOff = ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" />
    </svg>
);

const IconExternalLink = ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
);

const IconLoader = ({ size = 14 }) => (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

const IconLockClosed = ({ size = 16, color = "#d97706" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
);

export default function RecordCard({ record, onDecrypt, decryptedData, keyAvailable }) {
    const [expanded, setExpanded] = useState(false);
    const [decrypting, setDecrypting] = useState(false);
    const doctorName = useDisplayName(record.doctorAddress);
    const patientName = useDisplayName(record.patientAddress);

    const formatDate = (ts) => {
        const d = new Date(ts * 1000);
        return d.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const shortenAddr = (a) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "-";

    const getFileIcon = (fileType) => {
        if (fileType?.startsWith("image/")) return <IconImage size={20} />;
        if (fileType === "application/pdf") return <IconFilePdf size={20} />;
        return <IconFileGeneric size={20} />;
    };

    const handleDecrypt = async () => {
        setDecrypting(true);
        try {
            await onDecrypt(record.cid);
        } finally {
            setDecrypting(false);
            setExpanded(true);
        }
    };

    const handleDownload = () => {
        if (!decryptedData?.url) return;
        const a = document.createElement("a");
        a.href = decryptedData.url;
        a.download = record.fileName || "record";
        a.click();
    };

    return (
        <div className="glass-card animate-fade-in" style={{ padding: "22px", borderLeft: keyAvailable === false ? "3px solid #fde68a" : undefined }}>
            {/* No-key warning banner */}
            {keyAvailable === false && (
                <div style={{ display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px",borderRadius:"10px",background:"#fffbeb",border:"1px solid #fde68a",marginBottom:"14px" }}>
                    <IconLockClosed size={16} color="#d97706" />
                    <div style={{ flex:1 }}>
                        <div style={{ fontSize:"0.75rem",fontWeight:700,color:"#b45309" }}>Kunci dekripsi tidak tersedia</div>
                        <div style={{ fontSize:"0.7rem",color:"#92400e",marginTop:"1px" }}>Minta pasien untuk memberikan akses rekam ini melalui tab <strong>Kelola Akses</strong> mereka.</div>
                    </div>
                </div>
            )}
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* File info row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                        <div style={{
                            width: "42px", height: "42px", borderRadius: "10px",
                            background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                        }}>
                            {getFileIcon(record.fileType)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={record.fileName}>
                                {record.fileName || "Unknown File"}
                            </div>
                            <div style={{ fontSize: "0.73rem", color: "#94a3b8", marginTop: "2px" }}>
                                {record.fileType} · {formatDate(record.timestamp)}
                            </div>
                        </div>
                    </div>

                    {/* Meta info */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.73rem", padding: "10px 14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                            {record.doctorAddress && (
                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <span style={{ color: "#94a3b8" }}>Dokter:</span>
                                    <span style={{ color: "#0d9488", fontWeight: 600 }}>{doctorName || shortenAddr(record.doctorAddress)}</span>
                                </div>
                            )}
                            {record.patientAddress && patientName && (
                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <span style={{ color: "#94a3b8" }}>Pasien:</span>
                                    <span style={{ color: "#2E7DDB", fontWeight: 600 }}>{patientName}</span>
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0, overflow: "hidden" }}>
                            <span style={{ color: "#94a3b8", flexShrink: 0 }}>CID:</span>
                            <span className="mono" style={{ color: "#2E7DDB", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={record.cid}>{record.cid}</span>
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: "8px", flexShrink: 0, alignItems: "flex-start", flexWrap: "wrap" }}>
                    {!decryptedData && onDecrypt && keyAvailable === false ? (
                        <div style={{ display:"flex",alignItems:"center",gap:"6px",padding:"7px 14px",borderRadius:"9px",background:"#fffbeb",border:"1.5px solid #fde68a",fontSize:"0.75rem",fontWeight:600,color:"#b45309",whiteSpace:"nowrap" }}>
                            <IconLockClosed size={13} color="#b45309" /> Tanpa Kunci
                        </div>
                    ) : !decryptedData && onDecrypt && (
                        <button
                            onClick={handleDecrypt}
                            disabled={decrypting || keyAvailable === false}
                            className="btn btn-primary"
                            style={{ fontSize: "0.78rem", padding: "8px 16px" }}
                        >
                            {decrypting
                                ? <><IconLoader size={14} /> Mendekripsi...</>
                                : <><IconUnlock size={14} /> Dekripsi</>
                            }
                        </button>
                    )}
                    {decryptedData && (
                        <>
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className="btn btn-ghost"
                                style={{ fontSize: "0.78rem", padding: "8px 14px" }}
                            >
                                {expanded
                                    ? <><IconEyeOff size={14} /> Tutup</>
                                    : <><IconEye size={14} /> Lihat</>
                                }
                            </button>
                            <button
                                onClick={handleDownload}
                                className="btn btn-ghost"
                                style={{ fontSize: "0.78rem", padding: "8px 14px" }}
                            >
                                <IconDownload size={14} /> Unduh
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Decrypted status badge */}
            {decryptedData && !expanded && (
                <div style={{ marginTop: "10px" }}>
                    <span style={{
                        display: "inline-flex", alignItems: "center", gap: "5px",
                        padding: "3px 10px", borderRadius: "6px", fontSize: "0.7rem",
                        fontWeight: 600, background: "#f0fdf4", color: "#16a34a",
                        border: "1px solid #bbf7d0",
                    }}>
                        <IconLock size={11} color="#16a34a" /> Terdekripsi
                    </span>
                </div>
            )}

            {/* Decrypted Content Display */}
            {decryptedData && expanded && (
                <div style={{
                    marginTop: "16px", paddingTop: "16px",
                    borderTop: "1px solid #e2e8f0",
                }}>
                    {decryptedData.fileType?.startsWith("image/") ? (
                        <div style={{ textAlign: "center" }}>
                            <img
                                src={decryptedData.url}
                                alt={record.fileName}
                                style={{
                                    maxHeight: "400px", maxWidth: "100%",
                                    borderRadius: "10px", margin: "0 auto",
                                    border: "1px solid #e2e8f0",
                                }}
                            />
                            <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "8px" }}>
                                {record.fileName} — Terdekripsi
                            </p>
                        </div>
                    ) : decryptedData.fileType === "application/pdf" ? (
                        <div style={{
                            background: "#f8fafc", borderRadius: "10px",
                            padding: "24px", textAlign: "center",
                        }}>
                            <IconFilePdf size={40} color="#e11d48" />
                            <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#0f172a", marginTop: "10px" }}>{record.fileName}</p>
                            <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "14px" }}>Dokumen PDF — Terdekripsi</p>
                            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                                <a
                                    href={decryptedData.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-primary"
                                    style={{ fontSize: "0.78rem" }}
                                >
                                    <IconExternalLink size={14} /> Buka PDF
                                </a>
                                <button onClick={handleDownload} className="btn btn-ghost" style={{ fontSize: "0.78rem" }}>
                                    <IconDownload size={14} /> Unduh
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            background: "#f8fafc", borderRadius: "10px",
                            padding: "20px", textAlign: "center",
                        }}>
                            <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "8px" }}>File berhasil didekripsi</p>
                            <button onClick={handleDownload} className="btn btn-primary" style={{ fontSize: "0.78rem" }}>
                                <IconDownload size={14} /> Unduh File
                            </button>
                        </div>
                    )}

                    {/* SHA-256 Integrity Hash */}
                    {decryptedData.sha256 && (
                        <div style={{ marginTop: "14px", padding: "10px 12px", borderRadius: "8px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.06em" }}>SHA-256 (decrypted file)</span>
                            </div>
                            <div style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#166534", wordBreak: "break-all", lineHeight: 1.5 }}>{decryptedData.sha256}</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
