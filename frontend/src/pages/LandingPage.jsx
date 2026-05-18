// pages/LandingPage.jsx
// ============================================================
// Landing Page — Medical/Hospital inspired hero (English)
// Fully responsive for mobile, tablet, and desktop
// ============================================================

import { useWallet } from "../context/WalletContext";
import ConnectWallet from "../components/ConnectWallet";
import RegisterForm from "../components/RegisterForm";

const CONTRACT_CONFIGURED = !!import.meta.env.VITE_CONTRACT_ADDRESS;

export default function LandingPage() {
    const { isConnected, isRegistered } = useWallet();

    return (
        <div className="min-h-screen flex flex-col">
            {/* Hero Banner — Medical gradient */}
            <div
                className="hero-banner relative z-10"
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    padding: "clamp(32px, 6vw, 56px) clamp(12px, 4vw, 24px)",
                    textAlign: "center",
                }}
            >
                <div style={{ maxWidth: "720px", width: "100%", position: "relative", zIndex: 2 }}>
                    <div
                        className="animate-float"
                        style={{
                            width: "clamp(64px, 12vw, 100px)",
                            height: "clamp(64px, 12vw, 100px)",
                            margin: "0 auto clamp(16px, 3vw, 24px)",
                            borderRadius: "50%",
                            overflow: "hidden",
                            boxShadow: "0 4px 30px rgba(255,255,255,0.25)",
                        }}
                    >
                        <img
                            src="/logo.png"
                            alt="RME Vault Logo"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    </div>
                    <h1
                        style={{
                            fontSize: "clamp(1.6rem, 5vw, 3rem)",
                            fontWeight: 800,
                            color: "white",
                            marginBottom: "12px",
                            letterSpacing: "-0.02em",
                        }}
                    >
                        RME Vault
                    </h1>
                    <p
                        style={{
                            fontSize: "clamp(0.85rem, 2.5vw, 1.1rem)",
                            color: "rgba(255,255,255,0.85)",
                            fontWeight: 500,
                            marginBottom: "8px",
                        }}
                    >
                        Hybrid-Decentralized Electronic Medical Record System
                    </p>
                    <p
                        style={{
                            fontSize: "clamp(0.7rem, 2vw, 0.85rem)",
                            color: "rgba(255,255,255,0.5)",
                        }}
                    >
                        Patient data security with Blockchain, IPFS, and End-to-End Encryption
                    </p>
                </div>
            </div>

            {/* Content Area */}
            <div
                className="flex-1 flex flex-col items-center relative z-20"
                style={{ padding: "clamp(24px, 5vw, 48px) clamp(12px, 3vw, 24px)" }}
            >
                {/* Feature Cards */}
                {!isConnected && (
                    <div
                        className="w-full animate-fade-in"
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
                            gap: "clamp(16px, 3vw, 40px)",
                            maxWidth: "960px",
                        }}
                    >
                        {[
                            {
                                icon: "🏥",
                                title: "Patient Consent",
                                desc: "Doctors submit records, patients approve. Medical data is fully under patient control.",
                                color: "#2E7DDB",
                            },
                            {
                                icon: "🔐",
                                title: "Medical Encryption",
                                desc: "Medical files are encrypted with AES-256-CBC before storage. Only the owner can read them.",
                                color: "#14b8a6",
                            },
                            {
                                icon: "📋",
                                title: "Secure Storage",
                                desc: "Data is stored on decentralized IPFS. Metadata and access are controlled by smart contracts.",
                                color: "#0d9488",
                            },
                        ].map((f, i) => (
                            <div key={i} className="glass-card text-center group" style={{ padding: "clamp(18px, 3vw, 28px) clamp(14px, 2vw, 20px)" }}>
                                <div
                                    className="rounded-xl flex items-center justify-center text-2xl mx-auto mb-3"
                                    style={{
                                        width: "48px",
                                        height: "48px",
                                        background: `${f.color}12`,
                                    }}
                                >
                                    {f.icon}
                                </div>
                                <div className="font-bold text-sm text-surface-900 mb-1">{f.title}</div>
                                <div className="text-xs text-surface-700/60 leading-relaxed">{f.desc}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Step 1: Connect — extra spacing from cards */}
                {!isConnected && (
                    <div style={{ marginTop: "clamp(24px, 5vw, 48px)", marginBottom: "24px" }}>
                        <ConnectWallet />
                    </div>
                )}

                {/* Setup Guide */}
                {isConnected && !CONTRACT_CONFIGURED && (
                    <div className="w-full max-w-lg animate-fade-in mt-4">
                        <div className="glass-card" style={{ borderLeft: "4px solid #f59e0b" }}>
                            <div className="flex items-start gap-3 mb-4">
                                <div className="text-2xl">⚠️</div>
                                <div>
                                    <h3 className="text-surface-900 font-bold text-sm mb-1">Smart Contract Not Deployed</h3>
                                    <p className="text-surface-700/60 text-xs">
                                        Run the following steps in your terminal:
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <SetupStep number={1} title="Start Hardhat Local Node" command="npx hardhat node" />
                                <SetupStep number={2} title="Deploy Smart Contract" command="npx hardhat run scripts/deploy.js --network localhost" />
                                <SetupStep number={3} title="Restart Frontend Dev Server" command="cd frontend && npm run dev" />
                            </div>

                            <div className="mt-4 p-3 rounded-lg bg-primary-50 border border-primary-200">
                                <p className="text-primary-600 text-xs">
                                    💡 The deploy script will automatically create a <span className="mono">.env</span> file with the contract address.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Register */}
                {isConnected && CONTRACT_CONFIGURED && !isRegistered && (
                    <div className="w-full max-w-lg" style={{ marginTop: "8px" }}>
                        <div className="animate-fade-in" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "24px", padding: "8px 18px", borderRadius: "24px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", width: "fit-content", margin: "0 auto 24px" }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", display: "block", animation: "pulse 2s ease-in-out infinite" }} />
                            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#16a34a" }}>Wallet Connected</span>
                        </div>
                        <RegisterForm />
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="text-center py-6 text-xs text-surface-300">
                RME Hybrid-Decentralized © 2026 — Thesis Prototype
            </footer>
        </div>
    );
}

function SetupStep({ number, title, command }) {
    return (
        <div className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600 shrink-0 mt-0.5">
                {number}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-surface-800 text-xs font-medium mb-1">{title}</p>
                <div className="p-2 rounded bg-surface-50 border border-surface-200">
                    <code className="text-xs text-primary-600 break-all">{command}</code>
                </div>
            </div>
        </div>
    );
}
