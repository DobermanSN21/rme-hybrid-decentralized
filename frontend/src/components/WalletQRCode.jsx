// components/WalletQRCode.jsx

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

const IconQR = ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="6" height="6" x="3" y="3" rx="1"/>
        <rect width="6" height="6" x="15" y="3" rx="1"/>
        <rect width="6" height="6" x="3" y="15" rx="1"/>
        <path d="M15 15h.01M15 18h.01M18 15h.01M18 18h.01M21 15h.01M21 18h.01M21 21h.01M18 21h.01M15 21h.01"/>
    </svg>
);

const IconCopy = ({ size = 13, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
);

const IconCheck = ({ size = 13, color = "#16a34a" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
    </svg>
);

const IconX = ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
);

// ── Reusable copy helper ─────────────────────────────────────────────
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        const el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
    }
}

// ── Inline QR card — embed langsung di halaman ───────────────────────
export function WalletQRInline({ address }) {
    const [copied, setCopied] = useState(false);
    if (!address) return null;

    const handleCopy = async () => {
        await copyText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ textAlign: "center", padding: "20px 16px", borderRadius: "14px", background: "white", border: "1.5px solid #e2e8f0" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b", marginBottom: "14px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                QR Wallet Address
            </p>
            <div style={{ display: "inline-block", padding: "14px", background: "white", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <QRCodeSVG value={address} size={150} level="M" includeMargin={false}/>
            </div>
            <p style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: "0.65rem", color: "#475569", marginTop: "12px", wordBreak: "break-all", lineHeight: 1.6, padding: "0 4px" }}>
                {address}
            </p>
            <button
                onClick={handleCopy}
                style={{
                    marginTop: "10px",
                    display: "inline-flex", alignItems: "center", gap: "5px",
                    padding: "7px 16px", borderRadius: "8px", border: "none", cursor: "pointer",
                    fontSize: "0.75rem", fontWeight: 600, fontFamily: "inherit",
                    background: copied ? "#f0fdf4" : "#f1f5f9",
                    color: copied ? "#16a34a" : "#475569",
                    transition: "all 0.2s",
                }}
            >
                {copied ? <><IconCheck size={12}/> Tersalin!</> : <><IconCopy size={12}/> Salin Alamat</>}
            </button>
            <p style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "8px", lineHeight: 1.5 }}>
                Scan QR ini untuk berbagi alamat wallet Anda
            </p>
        </div>
    );
}

// ── Modal version — tombol di navbar yang membuka popup ──────────────
export default function WalletQRModal({ address }) {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    if (!address) return null;

    const handleCopy = async () => {
        await copyText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                title="Tampilkan QR wallet address"
                style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: "30px", height: "30px", borderRadius: "8px",
                    border: "1px solid #e2e8f0", background: "#f8fafc",
                    cursor: "pointer", transition: "all 0.2s",
                    color: "#64748b",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#eef5ff"; e.currentTarget.style.borderColor = "#bfdbfe"; e.currentTarget.style.color = "#2E7DDB"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
            >
                <IconQR size={14}/>
            </button>

            {isOpen && (
                <div
                    style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        style={{ background: "white", borderRadius: "20px", padding: "28px 24px", maxWidth: "320px", width: "100%", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", position: "relative" }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{ position: "absolute", top: "14px", right: "14px", background: "#f1f5f9", border: "none", borderRadius: "8px", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b" }}
                        >
                            <IconX size={14}/>
                        </button>

                        <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#eef5ff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                            <IconQR size={22} color="#2E7DDB"/>
                        </div>
                        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>Wallet Address</h3>
                        <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "18px" }}>Scan untuk berbagi alamat wallet Anda</p>

                        <div style={{ display: "inline-block", padding: "14px", background: "white", borderRadius: "12px", border: "1.5px solid #e2e8f0", marginBottom: "14px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                            <QRCodeSVG value={address} size={180} level="M" includeMargin={false}/>
                        </div>

                        <div style={{ padding: "10px 14px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
                            <p style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: "0.67rem", color: "#334155", wordBreak: "break-all", lineHeight: 1.65, margin: 0 }}>
                                {address}
                            </p>
                        </div>

                        <button
                            onClick={handleCopy}
                            className="btn btn-primary"
                            style={{ width: "100%", justifyContent: "center", fontSize: "0.82rem", padding: "10px" }}
                        >
                            {copied ? <><IconCheck size={13}/> Tersalin!</> : <><IconCopy size={13}/> Salin Alamat</>}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}