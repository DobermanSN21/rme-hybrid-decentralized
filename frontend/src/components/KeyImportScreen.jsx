import { useState } from "react";
import { useWallet, ROLE_LABELS } from "../context/WalletContext";
import { privateKeyToPublicKey } from "../services/crypto";
import { getPublicKey as getBlockchainPublicKey } from "../services/blockchain";

// SVG Icons
const IconKey = ({ size = 32, color = "#2E7DDB" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
        <path d="m21 2-9.6 9.6" />
        <circle cx="7.5" cy="15.5" r="5.5" />
    </svg>
);

const IconShieldCheck = ({ size = 16, color = "#22c55e" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

const IconArrowRight = ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
);

const IconEye = ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
);

const IconEyeOff = ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" />
    </svg>
);

const IconLogout = ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
    </svg>
);

export default function KeyImportScreen({ onSkip }) {
    const { account, role, savePrivateKey, setError, disconnect } = useWallet();
    const [keyInput, setKeyInput] = useState("");
    const [showKey, setShowKey] = useState(false);
    const [error, setLocalError] = useState("");
    const [loading, setLoading] = useState(false);

    const shortenAddress = (addr) =>
        addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

    const handleImport = async () => {
        const key = keyInput.trim();
        if (!key) {
            setLocalError("Please enter your private key.");
            return;
        }
        if (key.length !== 64) {
            setLocalError("Private key must be exactly 64 hexadecimal characters.");
            return;
        }
        if (!/^[0-9a-fA-F]+$/.test(key)) {
            setLocalError("Private key must contain only hexadecimal characters (0-9, a-f).");
            return;
        }

        setLocalError("");
        setLoading(true);
        try {
            // Derive public key from the entered private key
            const derivedPubKey = privateKeyToPublicKey(key);

            // Get on-chain public key for the connected wallet
            const onChainPubKey = await getBlockchainPublicKey(account.signer, account.address);

            // Verify key belongs to this wallet
            if (!onChainPubKey || derivedPubKey !== onChainPubKey) {
                console.warn("[RME KeyImport] Key mismatch for", account.address);
                setLocalError("This private key does not match your wallet. Please use the key you received when registering this account.");
                return;
            }

            console.log("[RME KeyImport] Key verified for", account.address);
            savePrivateKey(key);
        } catch (err) {
            console.error("[RME KeyImport] Error:", err);
            setLocalError("Failed to verify key: " + (err.message || String(err)));
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") handleImport();
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: "#f0f4f8" }}>
            {/* Subtle top gradient bar */}
            <div style={{
                height: "4px",
                background: "linear-gradient(90deg, #1651A0, #2E7DDB, #14b8a6)",
            }} />

            {/* Top bar */}
            <header style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 24px", background: "white",
                borderBottom: "1px solid #e2e8f0",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "10px", overflow: "hidden" }}>
                        <img src="/logo.png" alt="RME" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a" }}>
                        RME <span className="gradient-text">Vault</span>
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span className="mono" style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                        {shortenAddress(account?.address)}
                    </span>
                    <button
                        onClick={disconnect}
                        className="btn btn-ghost"
                        style={{ fontSize: "0.75rem", padding: "6px 12px" }}
                    >
                        <IconLogout size={13} /> Logout
                    </button>
                </div>
            </header>

            {/* Main content */}
            <div style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                padding: "24px",
            }}>
                <div className="glass-card animate-fade-in" style={{
                    maxWidth: "480px", width: "100%", padding: "40px 36px",
                }}>
                    {/* Header */}
                    <div style={{ textAlign: "center", marginBottom: "32px" }}>
                        <div style={{
                            width: "72px", height: "72px", borderRadius: "50%",
                            background: "linear-gradient(135deg, rgba(46,125,219,0.1), rgba(20,184,166,0.1))",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto 20px",
                        }}>
                            <IconKey size={34} color="#2E7DDB" />
                        </div>
                        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
                            Import Private Key
                        </h2>
                        <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: "1.6" }}>
                            Enter the ECC private key you received during registration to unlock your medical data.
                        </p>
                    </div>

                    {/* Wallet info badge */}
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        gap: "8px", marginBottom: "24px",
                    }}>
                        <span style={{
                            display: "inline-flex", alignItems: "center", gap: "6px",
                            padding: "6px 14px", borderRadius: "20px", fontSize: "0.72rem",
                            fontWeight: 600, background: "#f0fdf4", color: "#16a34a",
                            border: "1px solid #bbf7d0",
                        }}>
                            <IconShieldCheck size={13} color="#16a34a" />
                            Authenticated as {ROLE_LABELS[role]} · {shortenAddress(account?.address)}
                        </span>
                    </div>

                    {/* Key input */}
                    <div style={{ marginBottom: "20px" }}>
                        <label style={{
                            display: "block", fontSize: "0.72rem", fontWeight: 600,
                            color: "#64748b", marginBottom: "8px",
                            textTransform: "uppercase", letterSpacing: "0.06em",
                        }}>
                            ECC Private Key
                        </label>
                        <div style={{ position: "relative" }}>
                            <input
                                type={showKey ? "text" : "password"}
                                value={keyInput}
                                onChange={(e) => { setKeyInput(e.target.value); setLocalError(""); }}
                                onKeyDown={handleKeyDown}
                                placeholder="Paste your 64-character hex private key..."
                                className="input-field"
                                style={{
                                    paddingRight: "44px",
                                    fontFamily: showKey ? "'JetBrains Mono', monospace" : "inherit",
                                    fontSize: "0.85rem",
                                    borderColor: error ? "#fca5a5" : undefined,
                                    background: error ? "#fff5f5" : undefined,
                                }}
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                style={{
                                    position: "absolute", right: "10px", top: "50%",
                                    transform: "translateY(-50%)",
                                    background: "none", border: "none", cursor: "pointer",
                                    padding: "4px", color: "#94a3b8",
                                }}
                                title={showKey ? "Hide key" : "Show key"}
                            >
                                {showKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                            </button>
                        </div>
                        {error && (
                            <p style={{ fontSize: "0.75rem", color: "#e11d48", marginTop: "8px" }}>
                                {error}
                            </p>
                        )}
                        {keyInput && !error && (
                            <p style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "6px" }}>
                                {keyInput.trim().length}/64 characters
                            </p>
                        )}
                    </div>

                    {/* Import button */}
                    <button
                        onClick={handleImport}
                        disabled={!keyInput.trim() || loading}
                        className="btn btn-primary"
                        style={{
                            width: "100%", justifyContent: "center",
                            padding: "12px 22px", fontSize: "0.9rem",
                            marginBottom: "16px",
                        }}
                    >
                        {loading
                            ? <><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Verifying...</>
                            : <>Unlock Dashboard <IconArrowRight size={15} /></>
                        }
                    </button>

                    {/* Help text */}
                    <div style={{
                        marginTop: "20px", padding: "14px 16px",
                        background: "#f8fafc", borderRadius: "10px",
                        border: "1px solid #e2e8f0",
                    }}>
                        <p style={{ fontSize: "0.72rem", color: "#94a3b8", lineHeight: "1.6" }}>
                            <strong style={{ color: "#64748b" }}>Where is my key?</strong><br />
                            Your private key was shown once after registration. It is a 64-character hexadecimal string used to encrypt and decrypt your medical records.
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer style={{ textAlign: "center", padding: "20px", fontSize: "0.72rem", color: "#cbd5e1" }}>
                RME Hybrid-Decentralized © 2026 — Thesis Prototype
            </footer>
        </div>
    );
}
