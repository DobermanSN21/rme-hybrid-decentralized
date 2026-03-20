// components/Layout.jsx
// ============================================================
// Dashboard Layout — Responsive for mobile and desktop
// ============================================================

import { useWallet, ROLE_LABELS, ROLES } from "../context/WalletContext";

export default function Layout({ children }) {
    const { account, role, disconnect, isPatient } = useWallet();

    const shortenAddress = (addr) =>
        addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

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
                            <p className="text-[10px] text-surface-300 font-medium tracking-wide uppercase" style={{ display: "none" }}>
                                Hybrid-Decentralized
                            </p>
                        </div>
                    </div>

                    <div
                        className="flex items-center"
                        style={{ gap: "clamp(4px, 1.5vw, 12px)", minWidth: 0, flexWrap: "wrap", justifyContent: "flex-end" }}
                    >
                        <span className={`badge ${isPatient ? "badge-patient" : "badge-doctor"}`}>
                            {ROLE_LABELS[role]}
                        </span>
                        <span
                            className="mono text-xs text-surface-700/50"
                            style={{
                                maxWidth: "clamp(80px, 15vw, 160px)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {shortenAddress(account?.address)}
                        </span>
                        <button onClick={disconnect} className="btn btn-ghost text-xs py-1.5 px-3">
                            ⏻ Logout
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
