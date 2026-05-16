// components/RegisterForm.jsx

import { useState } from "react";
import { useWallet, ROLES } from "../context/WalletContext";
import { registerAsPatient, requestDoctorVerification, getRole, getPublicKey as getBlockchainPublicKey } from "../services/blockchain";
import { generateKeyPair, privateKeyToPublicKey } from "../services/crypto";

const SPECIALIZATIONS = [
    "Dokter Umum",
    "Penyakit Dalam",
    "Bedah Umum",
    "Bedah Ortopedi",
    "Kardiologi",
    "Neurologi",
    "Psikiatri",
    "Anak (Pediatri)",
    "Obstetri & Ginekologi",
    "Radiologi",
    "Anestesiologi",
    "Onkologi",
    "Dermatologi",
    "Oftalmologi",
    "THT (Telinga Hidung Tenggorokan)",
    "Urologi",
    "Pulmonologi",
    "Endokrinologi",
    "Reumatologi",
    "Gizi Klinik",
];

const Spinner = () => (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
);

// ── Private Key Backup Screen ─────────────────────────────────────────

function KeyBackupScreen({ privateKey, onContinue, continueLabel = "Go to Dashboard" }) {
    const [copied, setCopied] = useState(false);
    const [downloaded, setDownloaded] = useState(false);

    const handleDownload = () => {
        const content = `RME Vault — ECC Private Key\nDate: ${new Date().toISOString()}\n\nPRIVATE KEY (keep this secret!):\n${privateKey}\n\nWARNING: Anyone with this key can decrypt medical records. Store safely.`;
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `rme-vault-private-key-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        setDownloaded(true);
    };

    const saved = copied || downloaded;

    return (
        <div style={{ padding: "10px 0" }}>
            <div style={{ padding: "20px", borderRadius: "14px", background: "#fffbeb", border: "1.5px solid #fde68a", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                        <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
                    </svg>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#b45309" }}>SIMPAN PRIVATE KEY ANDA</span>
                </div>
                <p style={{ fontSize: "0.78rem", color: "#92400e", lineHeight: "1.5", marginBottom: "14px" }}>
                    Key ini hanya ditampilkan sekali. Diperlukan untuk mengenkripsi dan mendekripsi rekam medis.
                </p>
                <div style={{ padding: "14px", borderRadius: "10px", background: "white", border: "1.5px solid #e2e8f0", marginBottom: "12px" }}>
                    <p className="mono" style={{ fontSize: "0.78rem", wordBreak: "break-all", color: "#334155", userSelect: "all", lineHeight: "1.65", margin: 0 }}>
                        {privateKey}
                    </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => { navigator.clipboard.writeText(privateKey); setCopied(true); setTimeout(() => setCopied(false), 2500); }}
                        className="btn btn-ghost" style={{ flex: 1, justifyContent: "center", fontSize: "0.78rem", padding: "10px", background: copied ? "#f0fdf4" : undefined, borderColor: copied ? "#bbf7d0" : undefined, color: copied ? "#16a34a" : undefined }}>
                        {copied ? "✓ Copied!" : "Copy"}
                    </button>
                    <button onClick={handleDownload}
                        className="btn btn-ghost" style={{ flex: 1, justifyContent: "center", fontSize: "0.78rem", padding: "10px", background: downloaded ? "#f0fdf4" : undefined, borderColor: downloaded ? "#bbf7d0" : undefined, color: downloaded ? "#16a34a" : undefined }}>
                        {downloaded ? "✓ Downloaded!" : "Download .txt"}
                    </button>
                </div>
            </div>

            <p style={{ fontSize: "0.78rem", color: "#94a3b8", textAlign: "center", marginBottom: "14px" }}>
                Pastikan Anda sudah menyimpan private key sebelum melanjutkan.
            </p>
            <button onClick={onContinue} disabled={!saved} className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: "0.88rem", opacity: saved ? 1 : 0.5, cursor: saved ? "pointer" : "not-allowed" }}>
                {saved ? `✓ Key tersimpan — ${continueLabel}` : "Simpan key terlebih dahulu"}
            </button>
            {!saved && (
                <p style={{ fontSize: "0.72rem", color: "#f59e0b", textAlign: "center", marginTop: "8px" }}>
                    ⚠ Copy atau download private key di atas sebelum melanjutkan.
                </p>
            )}
        </div>
    );
}

// ── Main RegisterForm ─────────────────────────────────────────────────

export default function RegisterForm() {
    const { account, savePrivateKey, setRole, setIsPendingDoctor, setPendingDoctorInfo, setError } = useWallet();

    const [mode, setMode] = useState("register"); // "register" | "login"
    const [regType, setRegType] = useState("patient"); // "patient" | "doctor"

    // Patient fields
    const [patientName, setPatientName] = useState("");

    // Doctor fields
    const [doctorName, setDoctorName] = useState("");
    const [licenseNumber, setLicenseNumber] = useState("");
    const [specialization, setSpecialization] = useState("");
    const [hospital, setHospital] = useState("");

    // Shared state
    const [loading, setLoading] = useState(false);
    const [generatedPrivateKey, setGeneratedPrivateKey] = useState(null);
    const [registrationSuccess, setRegistrationSuccess] = useState(false); // patient success
    const [doctorRequestSent, setDoctorRequestSent] = useState(false);

    // Login
    const [loginKey, setLoginKey] = useState("");
    const [loginError, setLoginError] = useState("");

    // ── Patient Registration ──────────────────────────────────────────

    const handlePatientRegister = async () => {
        if (!patientName.trim()) { setError("Nama lengkap tidak boleh kosong."); return; }
        setLoading(true); setError(null);
        try {
            const keyPair = generateKeyPair();
            await registerAsPatient(account.signer, patientName.trim(), keyPair.publicKey);
            savePrivateKey(keyPair.privateKey);
            setGeneratedPrivateKey(keyPair.privateKey);
            setRegistrationSuccess(true);
        } catch (err) {
            setError(err.message || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    const handlePatientGoToDashboard = () => {
        setRole(ROLES.PATIENT);
    };

    // ── Doctor Request ────────────────────────────────────────────────

    const handleDoctorRequest = async () => {
        if (!doctorName.trim()) { setError("Nama lengkap tidak boleh kosong."); return; }
        if (!licenseNumber.trim()) { setError("Nomor SIP tidak boleh kosong."); return; }
        if (!specialization) { setError("Pilih spesialisasi terlebih dahulu."); return; }
        if (!hospital.trim()) { setError("Nama rumah sakit / klinik tidak boleh kosong."); return; }
        setLoading(true); setError(null);
        try {
            const keyPair = generateKeyPair();
            await requestDoctorVerification(account.signer, doctorName.trim(), licenseNumber.trim(), specialization, hospital.trim(), keyPair.publicKey);
            savePrivateKey(keyPair.privateKey);
            setGeneratedPrivateKey(keyPair.privateKey);
            setDoctorRequestSent(true);
        } catch (err) {
            setError(err.message || "Failed to submit verification request");
        } finally {
            setLoading(false);
        }
    };

    const handleDoctorRequestContinue = () => {
        setIsPendingDoctor(true);
        setPendingDoctorInfo({ name: doctorName.trim(), licenseNumber: licenseNumber.trim(), specialization, hospital: hospital.trim() });
    };

    // ── Login ─────────────────────────────────────────────────────────

    const handleLogin = async () => {
        const key = loginKey.trim();
        setLoginError("");
        if (!key || key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
            setLoginError("Private key harus tepat 64 karakter hexadecimal.");
            return;
        }
        setLoading(true);
        try {
            const derivedPubKey = privateKeyToPublicKey(key);
            const onChainPubKey = await getBlockchainPublicKey(account.signer, account.address);
            if (!onChainPubKey || onChainPubKey === "") {
                setLoginError("Akun tidak ditemukan. Silakan registrasi terlebih dahulu.");
                return;
            }
            if (derivedPubKey !== onChainPubKey) {
                setLoginError("Private key ini tidak sesuai dengan wallet yang terhubung.");
                return;
            }
            const role = await getRole(account.signer, account.address);
            if (role === ROLES.NONE) {
                setLoginError("Akun belum terdaftar di blockchain.");
                return;
            }
            savePrivateKey(key);
            setRole(role);
        } catch (err) {
            const msg = err.message || String(err);
            if (msg.includes("getPublicKey") || msg.includes("BAD_DATA") || msg.includes("No public key")) {
                setLoginError("Akun tidak ditemukan. Silakan registrasi terlebih dahulu.");
            } else {
                setLoginError("Login gagal: " + msg);
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────

    // Patient: show key backup after registration
    if (registrationSuccess) {
        return (
            <div className="glass-card max-w-lg mx-auto animate-fade-in" style={{ padding: "32px" }}>
                <div style={{ textAlign: "center", marginBottom: "24px" }}>
                    <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                    </div>
                    <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>Registrasi Berhasil!</h2>
                    <p style={{ fontSize: "0.85rem", color: "#64748b" }}>Selamat datang, <strong>{patientName}</strong></p>
                </div>
                <KeyBackupScreen privateKey={generatedPrivateKey} onContinue={handlePatientGoToDashboard} continueLabel="Masuk ke Dashboard" />
            </div>
        );
    }

    // Doctor: show key backup after request
    if (doctorRequestSent) {
        return (
            <div className="glass-card max-w-lg mx-auto animate-fade-in" style={{ padding: "32px" }}>
                <div style={{ textAlign: "center", marginBottom: "24px" }}>
                    <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(234,179,8,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                        </svg>
                    </div>
                    <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>Permohonan Terkirim!</h2>
                    <p style={{ fontSize: "0.85rem", color: "#64748b" }}>Simpan private key Anda, lalu tunggu verifikasi admin.</p>
                </div>
                <KeyBackupScreen privateKey={generatedPrivateKey} onContinue={handleDoctorRequestContinue} continueLabel="Lihat Status Permohonan" />
            </div>
        );
    }

    return (
        <div className="glass-card max-w-lg mx-auto animate-fade-in" style={{ padding: "32px" }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: "4px", marginBottom: "28px", background: "#f1f5f9", padding: "4px", borderRadius: "10px" }}>
                {["register", "login"].map(m => (
                    <button key={m} onClick={() => { setMode(m); setLoginError(""); }}
                        style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.82rem", transition: "all 0.2s", background: mode === m ? "white" : "transparent", color: mode === m ? "#0f172a" : "#64748b", boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                        {m === "register" ? "Daftar" : "Login"}
                    </button>
                ))}
            </div>

            {mode === "login" ? (
                /* ── LOGIN ── */
                <div>
                    <div style={{ textAlign: "center", marginBottom: "24px" }}>
                        <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(46,125,219,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2E7DDB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>
                        </div>
                        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>Login dengan Private Key</h2>
                        <p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Masukkan ECC private key yang Anda simpan saat registrasi.</p>
                    </div>

                    <div style={{ marginBottom: "14px" }}>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>ECC Private Key</label>
                        <input type="password" value={loginKey} onChange={e => { setLoginKey(e.target.value); setLoginError(""); }}
                            onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="Paste 64-karakter hex key..." className="input-field"
                            style={{ fontSize: "0.85rem", borderColor: loginError ? "#fca5a5" : undefined }} />
                        {loginError && <p style={{ fontSize: "0.75rem", color: "#e11d48", marginTop: "8px" }}>{loginError}</p>}
                        {loginKey && !loginError && <p style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "4px" }}>{loginKey.trim().length}/64 karakter</p>}
                    </div>

                    <button onClick={handleLogin} disabled={loading || !loginKey.trim()} className="btn btn-primary w-full justify-center" style={{ padding: "12px 22px", fontSize: "0.9rem" }}>
                        {loading ? <><Spinner/> Memverifikasi...</> : "Login"}
                    </button>
                </div>
            ) : (
                /* ── REGISTER ── */
                <div>
                    <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>Buat Akun Baru</h2>
                    <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "24px" }}>Pilih jenis akun Anda untuk mengakses sistem.</p>

                    {/* Type selector */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "28px" }}>
                        {/* Patient */}
                        <button onClick={() => setRegType("patient")}
                            style={{ background: regType === "patient" ? "#eef5ff" : "white", border: regType === "patient" ? "2px solid #2E7DDB" : "2px solid #e2e8f0", borderRadius: "14px", padding: "22px 12px", cursor: "pointer", transition: "all 0.2s", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                            {regType === "patient" && <div style={{ position: "absolute", top: "10px", right: "10px", width: "20px", height: "20px", borderRadius: "50%", background: "#2E7DDB", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>}
                            <div style={{ width: "46px", height: "46px", borderRadius: "12px", background: regType === "patient" ? "rgba(46,125,219,0.12)" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={regType === "patient" ? "#2E7DDB" : "#64748b"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>Pasien</div>
                            <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Pemilik data medis</div>
                        </button>

                        {/* Doctor */}
                        <button onClick={() => setRegType("doctor")}
                            style={{ background: regType === "doctor" ? "#f0fdf9" : "white", border: regType === "doctor" ? "2px solid #14b8a6" : "2px solid #e2e8f0", borderRadius: "14px", padding: "22px 12px", cursor: "pointer", transition: "all 0.2s", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                            {regType === "doctor" && <div style={{ position: "absolute", top: "10px", right: "10px", width: "20px", height: "20px", borderRadius: "50%", background: "#14b8a6", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>}
                            <div style={{ width: "46px", height: "46px", borderRadius: "12px", background: regType === "doctor" ? "rgba(20,184,166,0.12)" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={regType === "doctor" ? "#14b8a6" : "#64748b"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
                            </div>
                            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0f172a" }}>Dokter</div>
                            <div style={{ fontSize: "0.72rem", color: "#94a3b8", textAlign: "center" }}>Perlu verifikasi admin</div>
                        </button>
                    </div>

                    {/* Patient Form */}
                    {regType === "patient" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nama Lengkap</label>
                                <input type="text" value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Masukkan nama lengkap Anda" className="input-field" autoFocus />
                            </div>
                            <div style={{ padding: "10px 13px", borderRadius: "9px", background: "#f0f7ff", border: "1px solid #bfdbfe", fontSize: "0.75rem", color: "#1e40af", lineHeight: 1.5 }}>
                                Sistem akan otomatis membuat ECC key pair untuk enkripsi data medis Anda.
                            </div>
                            <button onClick={handlePatientRegister} disabled={loading || !patientName.trim()} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: "0.9rem" }}>
                                {loading ? <><Spinner/> Mendaftarkan...</> : "Daftar sebagai Pasien"}
                            </button>
                        </div>
                    )}

                    {/* Doctor Request Form */}
                    {regType === "doctor" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            <div style={{ padding: "10px 13px", borderRadius: "9px", background: "#fffbeb", border: "1px solid #fde68a", fontSize: "0.75rem", color: "#92400e", lineHeight: 1.5 }}>
                                <strong>Permohonan Verifikasi Dokter</strong> — Data Anda akan ditinjau oleh administrator rumah sakit. Setelah disetujui, akun dokter Anda akan aktif.
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nama Lengkap (sesuai KTP)</label>
                                <input type="text" value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="dr. Nama Lengkap" className="input-field" autoFocus />
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nomor SIP (Surat Izin Praktik)</label>
                                <input type="text" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} placeholder="Contoh: 503/1234/SIP/2024" className="input-field" />
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Spesialisasi</label>
                                <select value={specialization} onChange={e => setSpecialization(e.target.value)} className="input-field" style={{ cursor: "pointer" }}>
                                    <option value="">— Pilih Spesialisasi —</option>
                                    {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nama Rumah Sakit / Klinik</label>
                                <input type="text" value={hospital} onChange={e => setHospital(e.target.value)} placeholder="RS / Klinik tempat Anda bertugas" className="input-field" />
                            </div>

                            <button onClick={handleDoctorRequest} disabled={loading || !doctorName.trim() || !licenseNumber.trim() || !specialization || !hospital.trim()} className="btn btn-accent" style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: "0.9rem" }}>
                                {loading ? <><Spinner/> Mengirim Permohonan...</> : "Kirim Permohonan Verifikasi"}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
