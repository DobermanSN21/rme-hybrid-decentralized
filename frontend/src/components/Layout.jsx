// components/Layout.jsx
// ============================================================
// Dashboard Layout — Responsive for mobile and desktop
// ============================================================

import { useState } from "react";
import { useWallet, ROLE_LABELS, ROLES } from "../context/WalletContext";

// SVG Icons
const IconLogout = ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
    </svg>
);

const IconCopy = ({ size = 13, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
);

const IconCheck = ({ size = 13, color = "#16a34a" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

export default function Layout({ children }) {
    const { account, role, disconnect, isPatient } = useWallet();
    const [copied, setCopied] = useState(false);

    const shortenAddress = (addr) =>
        addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

    const handleCopy = async () => {
        if (!account?.address) return;
        try {
            await navigator.clipboard.writeText(account.address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const el = document.createElement("textarea");
            el.value = account.address;
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: "#f0f4f8" }}>
            {/* Top Nav */}
            <header className="sui-navbar">
                <div
                    className="w-full max-w-[1400px] mx-auto"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "8px",
                    }}
                >
                    <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0">
                            <img src="/logo.png" alt="RME" className="w-full h-full object-contain" />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h1 className="text-base font-bold text-surface-900 leading-tight tracking-tight">
                                RME <span className="gradient-text">Vault</span>
                            </h1>
                        </div>
                    </div>

                    <div
                        className="flex items-center"
                        style={{ gap: "clamp(6px, 1.5vw, 12px)", minWidth: 0, flexWrap: "wrap", justifyContent: "flex-end" }}
                    >
                        <span className={`badge ${isPatient ? "badge-patient" : "badge-doctor"}`}>
                            {ROLE_LABELS[role]}
                        </span>
                        <button
                            onClick={handleCopy}
                            title={copied ? "Copied!" : `Copy address: ${account?.address}`}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "4px 10px",
                                borderRadius: "8px",
                                border: copied ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
                                background: copied ? "#f0fdf4" : "#f8fafc",
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                                fontSize: "0.75rem",
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                color: copied ? "#16a34a" : "#64748b",
                            }}
                        >
                            {shortenAddress(account?.address)}
                            {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
                        </button>
                        <button
                            onClick={disconnect}
                            className="btn btn-ghost"
                            style={{ fontSize: "0.78rem", padding: "7px 14px" }}
                        >
                            <IconLogout size={14} /> Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 page-container animate-fade-in">{children}</main>

            {/* Footer */}
            <footer className="text-center py-5 text-xs text-surface-300 tracking-wide">
                RME Hybrid-Decentralized © 2026 — Thesis Prototype
            </footer>
        </div>
    );
}
