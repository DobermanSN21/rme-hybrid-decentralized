// components/RecordCard.jsx
// ============================================================
// Medical Record display card — supports images and PDFs
// ============================================================

import { useState } from "react";

export default function RecordCard({ record, onDecrypt, decryptedData }) {
    const [expanded, setExpanded] = useState(false);
    const [decrypting, setDecrypting] = useState(false);

    const formatDate = (ts) => {
        const d = new Date(ts * 1000);
        return d.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const shortenAddr = (a) => a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "-";

    const getFileIcon = (fileType) => {
        if (fileType?.startsWith("image/")) return "🖼️";
        if (fileType === "application/pdf") return "📄";
        return "📁";
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
        <div className="glass-card animate-fade-in" style={{ padding: "clamp(12px, 2vw, 20px) clamp(12px, 2.5vw, 20px)" }}>
            <div className="flex items-start justify-between gap-3" style={{ flexWrap: "wrap" }}>
                <div className="flex-1 min-w-0" style={{ minWidth: "180px" }}>
                    <div className="flex items-center gap-2 mb-2" style={{ flexWrap: "wrap" }}>
                        <span className="text-lg">{getFileIcon(record.fileType)}</span>
                        <span className="text-sm font-bold text-surface-900 truncate" title={record.fileName} style={{ maxWidth: "200px" }}>
                            {record.fileName || "Unknown File"}
                        </span>
                        <span className="badge badge-success text-xs">✓ APPROVED</span>
                    </div>

                    <div className="space-y-1 text-xs text-surface-700/50">
                        <p>📅 {formatDate(record.timestamp)}</p>
                        <p>📁 Type: <span className="text-surface-900">{record.fileType}</span></p>
                        {record.doctorAddress && (
                            <p>👨‍⚕️ Doctor: <span className="mono text-accent-600">{shortenAddr(record.doctorAddress)}</span></p>
                        )}
                        <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={record.cid}>
                            🔗 CID: <span className="mono text-primary-600">{record.cid}</span>
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 shrink-0" style={{ flexWrap: "wrap" }}>
                    {!decryptedData && onDecrypt && (
                        <button
                            onClick={handleDecrypt}
                            disabled={decrypting}
                            className="btn btn-primary text-xs py-1.5 px-4"
                        >
                            {decrypting ? "⟳ Memproses..." : "🔓 Decrypt"}
                        </button>
                    )}
                    {decryptedData && (
                        <>
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className="btn btn-ghost text-xs py-1.5 px-3"
                            >
                                {expanded ? "▲ Close" : "▼ Lihat"}
                            </button>
                            <button
                                onClick={handleDownload}
                                className="btn btn-ghost text-xs py-1.5 px-3"
                            >
                                ⬇ Download
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Decrypted Content Display */}
            {decryptedData && expanded && (
                <div className="mt-4 pt-3 border-t border-surface-200">
                    {decryptedData.fileType?.startsWith("image/") ? (
                        <div className="text-center">
                            <img
                                src={decryptedData.url}
                                alt={record.fileName}
                                className="max-h-96 rounded-lg mx-auto border border-surface-200"
                                style={{ maxWidth: "100%" }}
                            />
                            <p className="text-xs text-surface-700/40 mt-2">
                                {record.fileName} — Decrypted
                            </p>
                        </div>
                    ) : decryptedData.fileType === "application/pdf" ? (
                        <div className="space-y-3">
                            <div className="bg-surface-50 rounded-lg p-4 text-center">
                                <div className="text-4xl mb-2">📄</div>
                                <p className="text-sm text-surface-900 mb-1">{record.fileName}</p>
                                <p className="text-xs text-surface-700/40 mb-3">PDF Document — Decrypted</p>
                                <div className="flex gap-2 justify-center">
                                    <a
                                        href={decryptedData.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-primary text-xs"
                                    >
                                        📖 Buka PDF
                                    </a>
                                    <button onClick={handleDownload} className="btn btn-ghost text-xs">
                                        ⬇ Download
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-surface-50 rounded-lg p-3 text-center">
                            <p className="text-sm text-surface-700/50">File terdekripsi</p>
                            <button onClick={handleDownload} className="btn btn-primary text-xs mt-2">
                                ⬇ Download File
                            </button>
                        </div>
                    )}
                </div>
            )}

            {decryptedData && !expanded && (
                <div className="mt-2">
                    <span className="badge badge-success">✓ Terdekripsi</span>
                </div>
            )}
        </div>
    );
}
