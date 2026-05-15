// components/RegisterForm.jsx
// ============================================================
// Registration + Login form
// ============================================================

import { useState } from "react";
import { useWallet, ROLES } from "../context/WalletContext";
import { registerAsPatient, registerAsDoctor, getRole, getPublicKey as getBlockchainPublicKey } from "../services/blockchain";
import { generateKeyPair, privateKeyToPublicKey } from "../services/crypto";

export default function RegisterForm() {
    const { account, savePrivateKey, setRole, setError } = useWallet();
    const [mode, setMode] = useState("register"); // "register" | "login"
    const [selectedRole, setSelectedRole] = useState("patient");
    const [loading, setLoading] = useState(false);
    const [generatedKeys, setGeneratedKeys] = useState(null);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const [loginKey, setLoginKey] = useState("");
    const [loginError, setLoginError] = useState("");
    const [copied, setCopied] = useState(false);
    const [downloaded, setDownloaded] = useState(false);

    const handleGoToDashboard = () => {
        setRole(selectedRole === "patient" ? ROLES.PATIENT : ROLES.DOCTOR);
    };

    const handleDownloadKey = (privateKey) => {
        const content = `RME Vault — ECC Private Key\n` +
            `Role: ${selectedRole}\n` +
            `Date: ${new Date().toISOString()}\n\n` +
            `PRIVATE KEY (keep this secret!):\n${privateKey}\n\n` +
            `WARNING: Anyone with this key can decrypt your medical records.\n` +
            `Store this file in a safe, private location.`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rme-vault-private-key-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        setDownloaded(true);
    };

    const handleRegister = async () => {
        setLoading(true);
        setError(null);
        try {
            const keyPair = generateKeyPair();
            setGeneratedKeys(keyPair);

            if (selectedRole === "patient") {
                await registerAsPatient(account.signer, keyPair.publicKey);
            } else {
                await registerAsDoctor(account.signer, keyPair.publicKey);
            }

            savePrivateKey(keyPair.privateKey);
            setRegistrationSuccess(true);
        } catch (err) {
            setGeneratedKeys(null);
            setError(err.message || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    // Login with ECC private key
    const handleLogin = async () => {
        const key = loginKey.trim();
        setLoginError("");
        if (!key || key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
            setLoginError("Private key must be exactly 64 hexadecimal characters.");
            return;
        }
        setLoading(true);
        try {
            // 1. Derive public key from private key
            const derivedPubKey = privateKeyToPublicKey(key);
            console.log("[RME Login] Connected address:", account.address);
            console.log("[RME Login] Derived pubkey (first 20):", derivedPubKey.substring(0, 20) + "...");
            
            // 2. Get public key stored on blockchain for THIS specific address
            const onChainPubKey = await getBlockchainPublicKey(account.signer, account.address);
            console.log("[RME Login] On-chain pubkey (first 20):", onChainPubKey ? onChainPubKey.substring(0, 20) + "..." : "EMPTY");
            
            // 3. Verify account exists
            if (!onChainPubKey || onChainPubKey === "" || onChainPubKey === "0x") {
                setLoginError("No account found for this wallet address. Please register first.");
                return;
            }
            
            // 4. STRICT comparison — key must belong to THIS wallet
            if (derivedPubKey !== onChainPubKey) {
                console.warn("[RME Login] Key mismatch! This key does not belong to wallet", account.address);
                setLoginError("This private key does not belong to the currently connected wallet. Make sure you are using the correct MetaMask account.");
                return;
            }
            
            // 5. Get role and authenticate
            const role = await getRole(account.signer, account.address);
            if (role === ROLES.NONE) {
                setLoginError("Account not registered on blockchain.");
                return;
            }
            
            console.log("[RME Login] Success! Role:", role === 1 ? "PATIENT" : "DOCTOR");
            savePrivateKey(key);
            setRole(role);
        } catch (err) {
            const msg = err.message || String(err);
            console.error("[RME Login] Error:", msg);
            if (msg.includes("getPublicKey") || msg.includes("BAD_DATA")) {
                setLoginError("No account found for this wallet address. Please register first.");
            } else {
                setLoginError("Login failed: " + msg);
            }
        } finally {
            setLoading(false);
        }
    };

    if (registrationSuccess) {
        return (
            <div className="glass-card max-w-lg mx-auto animate-fade-in" style={{ padding: "36px 32px 28px" }}>
                {/* Success Header */}
                <div style={{ textAlign: "center", marginBottom: "28px" }}>
                    <div style={{
                        width: "64px", height: "64px", borderRadius: "50%",
                        background: "rgba(34, 197, 94, 0.1)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        margin: "0 auto 16px",
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                    </div>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                        Registration Successful!
                    </h2>
                    <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                        You are registered as{" "}
                        <span style={{
                            fontWeight: 700,
                            color: selectedRole === "patient" ? "#2E7DDB" : "#0d9488",
                        }}>
                            {selectedRole === "patient" ? "Patient" : "Doctor"}
                        </span>
                    </p>
                </div>

                {/* Private Key Warning */}
                {generatedKeys && (
                    <div style={{
                        padding: "20px",
                        borderRadius: "14px",
                        background: "#fffbeb",
                        border: "1.5px solid #fde68a",
                        marginBottom: "24px",
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                <line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" />
                            </svg>
                            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#b45309", letterSpacing: "0.02em" }}>
                                IMPORTANT — SAVE YOUR PRIVATE KEY
                            </span>
                        </div>
                        <p style={{ fontSize: "0.78rem", color: "#92400e", lineHeight: "1.5", marginBottom: "14px", opacity: 0.8 }}>
                            This private key is only shown once. You need it to encrypt and decrypt medical records.
                        </p>
                        <div style={{
                            padding: "14px",
                            borderRadius: "10px",
                            background: "white",
                            border: "1.5px solid #e2e8f0",
                        }}>
                            <p className="mono" style={{
                                fontSize: "0.78rem",
                                wordBreak: "break-all",
                                color: "#334155",
                                userSelect: "all",
                                lineHeight: "1.65",
                                margin: 0,
                            }}>
                                {generatedKeys.privateKey}
                            </p>
                        </div>
                        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(generatedKeys.privateKey);
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2500);
                                }}
                                className="btn btn-ghost"
                                style={{
                                    flex: 1, justifyContent: "center",
                                    fontSize: "0.78rem", padding: "10px",
                                    background: copied ? "#f0fdf4" : undefined,
                                    borderColor: copied ? "#bbf7d0" : undefined,
                                    color: copied ? "#16a34a" : undefined,
                                }}
                            >
                                {copied ? (
                                    <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
                                ) : (
                                    <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Copy</>
                                )}
                            </button>
                            <button
                                onClick={() => handleDownloadKey(generatedKeys.privateKey)}
                                className="btn btn-ghost"
                                style={{
                                    flex: 1, justifyContent: "center",
                                    fontSize: "0.78rem", padding: "10px",
                                    background: downloaded ? "#f0fdf4" : undefined,
                                    borderColor: downloaded ? "#bbf7d0" : undefined,
                                    color: downloaded ? "#16a34a" : undefined,
                                }}
                            >
                                {downloaded ? (
                                    <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Downloaded!</>
                                ) : (
                                    <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg> Download .txt</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Confirmation to proceed */}
                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "20px" }}>
                    <p style={{ fontSize: "0.78rem", color: "#94a3b8", textAlign: "center", marginBottom: "14px" }}>
                        Make sure you have saved your private key before continuing.
                    </p>
                    <button
                        onClick={handleGoToDashboard}
                        disabled={!copied && !downloaded}
                        className="btn btn-primary"
                        style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: "0.88rem", opacity: (copied || downloaded) ? 1 : 0.5, cursor: (copied || downloaded) ? "pointer" : "not-allowed" }}
                    >
                        {(copied || downloaded) ? "✓ I've saved my key — Go to Dashboard" : "Save your key first to continue"}
                    </button>
                    {!copied && !downloaded && (
                        <p style={{ fontSize: "0.72rem", color: "#f59e0b", textAlign: "center", marginTop: "8px" }}>
                            ⚠ Copy or download your private key above before proceeding. This key cannot be recovered if lost.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card max-w-lg mx-auto animate-fade-in" style={{ padding: "32px" }}>
            {/* Mode Tabs */}
            <div style={{ display:"flex",gap:"4px",marginBottom:"24px",background:"#f1f5f9",padding:"4px",borderRadius:"10px" }}>
                <button onClick={() => { setMode("register"); setLoginError(""); }} style={{ flex:1,padding:"10px",borderRadius:"8px",border:"none",cursor:"pointer",fontWeight:600,fontSize:"0.82rem",transition:"all 0.2s",background:mode==="register"?"white":"transparent",color:mode==="register"?"#0f172a":"#64748b",boxShadow:mode==="register"?"0 1px 3px rgba(0,0,0,0.08)":"none" }}>
                    Register
                </button>
                <button onClick={() => { setMode("login"); setLoginError(""); }} style={{ flex:1,padding:"10px",borderRadius:"8px",border:"none",cursor:"pointer",fontWeight:600,fontSize:"0.82rem",transition:"all 0.2s",background:mode==="login"?"white":"transparent",color:mode==="login"?"#0f172a":"#64748b",boxShadow:mode==="login"?"0 1px 3px rgba(0,0,0,0.08)":"none" }}>
                    Login
                </button>
            </div>

            {mode === "login" ? (
                /* ===== LOGIN MODE ===== */
                <div>
                    <div style={{ textAlign:"center",marginBottom:"24px" }}>
                        <div style={{ width:"56px",height:"56px",borderRadius:"50%",background:"rgba(46,125,219,0.1)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px" }}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2E7DDB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>
                        </div>
                        <h2 style={{ fontSize:"1.15rem",fontWeight:700,color:"#0f172a",marginBottom:"6px" }}>Login with Private Key</h2>
                        <p style={{ fontSize:"0.8rem",color:"#94a3b8",lineHeight:"1.5",marginBottom:"10px" }}>
                            Enter the ECC private key you received during registration.
                        </p>
                        <div style={{ display:"inline-flex",alignItems:"center",gap:"6px",padding:"5px 12px",borderRadius:"8px",background:"#f1f5f9",border:"1px solid #e2e8f0" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <span style={{ fontSize:"0.72rem",fontFamily:"'JetBrains Mono',monospace",color:"#475569" }}>{account?.address}</span>
                        </div>
                    </div>

                    <div style={{ marginBottom:"6px" }}>
                        <label style={{ display:"block",fontSize:"0.72rem",fontWeight:600,color:"#64748b",marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.06em" }}>ECC Private Key</label>
                        <input
                            type="password"
                            value={loginKey}
                            onChange={(e) => { setLoginKey(e.target.value); setLoginError(""); }}
                            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                            placeholder="Paste your 64-character hex key..."
                            className="input-field"
                            style={{ fontSize:"0.85rem",borderColor: loginError ? "#fca5a5" : undefined }}
                        />
                        {loginError && <p style={{ fontSize:"0.75rem",color:"#e11d48",marginTop:"8px" }}>{loginError}</p>}
                        {loginKey && !loginError && <p style={{ fontSize:"0.72rem",color:"#94a3b8",marginTop:"4px" }}>{loginKey.trim().length}/64 characters</p>}
                    </div>

                    <div style={{ padding:"10px 12px",borderRadius:"8px",background:"#f8fafc",border:"1px solid #e2e8f0",marginBottom:"16px",marginTop:"12px" }}>
                        <p style={{ fontSize:"0.72rem",color:"#94a3b8",lineHeight:"1.5" }}>
                            <strong style={{ color:"#64748b" }}>How it works:</strong> Your private key is verified against the public key stored on the blockchain for your wallet address.
                        </p>
                    </div>

                    <button
                        onClick={handleLogin}
                        disabled={loading || !loginKey.trim()}
                        className="btn btn-primary w-full justify-center"
                        style={{ padding:"12px 22px",fontSize:"0.9rem" }}
                    >
                        {loading
                            ? <><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Verifying...</>
                            : "Login"}
                    </button>
                </div>
            ) : (
                /* ===== REGISTER MODE ===== */
                <div>
                    <h2 className="section-title" style={{ marginBottom: "8px" }}>Account Registration</h2>
                    <p className="text-sm text-surface-700/40" style={{ marginBottom: "28px", lineHeight: "1.6" }}>
                        Select your role and the system will automatically generate an ECC key pair for data encryption.
                    </p>

                    <div className="grid grid-cols-2 gap-4" style={{ marginBottom: "28px" }}>
                        {/* Patient Card */}
                        <button onClick={() => setSelectedRole("patient")} className="role-select-card" style={{ background:selectedRole==="patient"?"#eef5ff":"white",border:selectedRole==="patient"?"2px solid #2E7DDB":"2px solid #e2e8f0",borderRadius:"14px",padding:"28px 16px 24px",cursor:"pointer",transition:"all 0.25s ease",position:"relative",display:"flex",flexDirection:"column",alignItems:"center",gap:"4px" }}>
                            {selectedRole === "patient" && <div style={{ position:"absolute",top:"10px",right:"10px",width:"22px",height:"22px",borderRadius:"50%",background:"#2E7DDB",display:"flex",alignItems:"center",justifyContent:"center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>}
                            <div style={{ width:"52px",height:"52px",borderRadius:"14px",background:selectedRole==="patient"?"rgba(46,125,219,0.12)":"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"8px",transition:"background 0.25s ease" }}>
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={selectedRole==="patient"?"#2E7DDB":"#64748b"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>
                            </div>
                            <div style={{ fontWeight:700,fontSize:"0.925rem",color:"#0f172a" }}>Patient</div>
                            <div style={{ fontSize:"0.75rem",color:"#94a3b8",marginTop:"2px" }}>Medical data owner</div>
                        </button>

                        {/* Doctor Card */}
                        <button onClick={() => setSelectedRole("doctor")} className="role-select-card" style={{ background:selectedRole==="doctor"?"#f0fdf9":"white",border:selectedRole==="doctor"?"2px solid #14b8a6":"2px solid #e2e8f0",borderRadius:"14px",padding:"28px 16px 24px",cursor:"pointer",transition:"all 0.25s ease",position:"relative",display:"flex",flexDirection:"column",alignItems:"center",gap:"4px" }}>
                            {selectedRole === "doctor" && <div style={{ position:"absolute",top:"10px",right:"10px",width:"22px",height:"22px",borderRadius:"50%",background:"#14b8a6",display:"flex",alignItems:"center",justifyContent:"center" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>}
                            <div style={{ width:"52px",height:"52px",borderRadius:"14px",background:selectedRole==="doctor"?"rgba(20,184,166,0.12)":"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"8px",transition:"background 0.25s ease" }}>
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={selectedRole==="doctor"?"#14b8a6":"#64748b"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
                            </div>
                            <div style={{ fontWeight:700,fontSize:"0.925rem",color:"#0f172a" }}>Doctor</div>
                            <div style={{ fontSize:"0.75rem",color:"#94a3b8",marginTop:"2px" }}>Data accessor (with permission)</div>
                        </button>
                    </div>

                    <button
                        onClick={handleRegister}
                        disabled={loading}
                        className={`btn w-full justify-center ${selectedRole === "patient" ? "btn-primary" : "btn-accent"}`}
                        style={{ padding: "12px 22px", fontSize: "0.9rem" }}
                    >
                        {loading
                            ? (<><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> Registering...</>)
                            : `Register as ${selectedRole === "patient" ? "Patient" : "Doctor"}`
                        }
                    </button>
                </div>
            )}
        </div>
    );
}
