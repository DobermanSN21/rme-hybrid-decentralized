// App.jsx

import { useWallet, ROLES } from "./context/WalletContext";
import LandingPage from "./pages/LandingPage";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import KeyImportScreen from "./components/KeyImportScreen";
import { useState, useEffect } from "react";

function Toast({ message, type, onClose }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const icons = {
        error: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>,
        success: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
        info: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
    };

    return (
        <div className={`toast toast-${type}`} onClick={onClose} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {icons[type]} {message}
        </div>
    );
}

function PendingVerificationScreen() {
    const { pendingDoctorInfo, disconnect } = useWallet();
    return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
            <div className="glass-card animate-fade-in" style={{ maxWidth: "480px", width: "100%", padding: "40px 32px", textAlign: "center" }}>
                <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(245,158,11,0.1)", border: "2px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", animation: "pulse 2s ease-in-out infinite" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                </div>

                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>Menunggu Verifikasi</h2>
                <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.6, marginBottom: "24px" }}>
                    Permohonan verifikasi dokter Anda sedang ditinjau oleh administrator. Harap tunggu konfirmasi.
                </p>

                {pendingDoctorInfo && (
                    <div style={{ textAlign: "left", padding: "18px", borderRadius: "12px", background: "#f8fafc", border: "1px solid #f1f5f9", marginBottom: "24px" }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "12px" }}>Detail Permohonan</div>
                        {[
                            { label: "Nama", value: pendingDoctorInfo.name },
                            { label: "Nomor SIP", value: pendingDoctorInfo.licenseNumber },
                            { label: "Spesialisasi", value: pendingDoctorInfo.specialization },
                            { label: "Rumah Sakit", value: pendingDoctorInfo.hospital },
                        ].map((f, i) => (
                            <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px", fontSize: "0.82rem" }}>
                                <span style={{ color: "#94a3b8", flexShrink: 0, minWidth: "90px" }}>{f.label}:</span>
                                <span style={{ color: "#334155", fontWeight: 500 }}>{f.value}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ padding: "12px 16px", borderRadius: "10px", background: "#fffbeb", border: "1px solid #fde68a", marginBottom: "20px", fontSize: "0.78rem", color: "#92400e", lineHeight: 1.5 }}>
                    Pastikan Anda sudah menyimpan private key yang diberikan saat pendaftaran. Anda akan membutuhkannya untuk login setelah akun disetujui.
                </div>

                <button onClick={disconnect} className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: "0.85rem" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                    Logout / Ganti Wallet
                </button>
            </div>
        </div>
    );
}

function RejectedScreen({ onReapply }) {
    const { rejectReason, disconnect } = useWallet();
    return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
            <div className="glass-card animate-fade-in" style={{ maxWidth: "440px", width: "100%", padding: "40px 32px", textAlign: "center" }}>
                <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(220,38,38,0.1)", border: "2px solid rgba(220,38,38,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
                    </svg>
                </div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>Permohonan Ditolak</h2>
                <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.6, marginBottom: "20px" }}>
                    Maaf, permohonan verifikasi dokter Anda tidak dapat disetujui saat ini.
                </p>
                {rejectReason && (
                    <div style={{ padding: "14px", borderRadius: "10px", background: "#fef2f2", border: "1px solid #fecaca", marginBottom: "20px", fontSize: "0.82rem", color: "#b91c1c", lineHeight: 1.5, textAlign: "left" }}>
                        <strong>Alasan:</strong> {rejectReason}
                    </div>
                )}
                <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: "20px" }}>
                    Hubungi administrator untuk informasi lebih lanjut atau ajukan permohonan ulang dengan data yang benar.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <button onClick={onReapply} className="btn btn-primary" style={{ width: "100%", justifyContent: "center", fontSize: "0.85rem" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                        Ajukan Permohonan Ulang
                    </button>
                    <button onClick={disconnect} className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", fontSize: "0.85rem" }}>
                        Logout / Ganti Wallet
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function App() {
    const { isConnected, isRegistered, isAdmin, isPendingDoctor, isRejectedDoctor, role, error, setError, privateKey } = useWallet();
    const [toast, setToast] = useState(null);
    const [skippedKeyImport, setSkippedKeyImport] = useState(false);
    const [reapplying, setReapplying] = useState(false);

    useEffect(() => {
        if (error) {
            setToast({ message: error, type: "error" });
            const timer = setTimeout(() => setError(null), 5500);
            return () => clearTimeout(timer);
        }
    }, [error, setError]);

    useEffect(() => {
        if (!isConnected) { setSkippedKeyImport(false); setReapplying(false); }
    }, [isConnected]);

    const renderPage = () => {
        if (!isConnected) return <LandingPage />;

        // Admin bypass — no key import needed
        if (isAdmin) return <AdminDashboard />;

        // Not registered
        if (!isRegistered) {
            if (isPendingDoctor) return <PendingVerificationScreen />;
            if (isRejectedDoctor && !reapplying) return <RejectedScreen onReapply={() => setReapplying(true)} />;
            return <LandingPage />;
        }

        // Registered but no private key
        if (!privateKey && !skippedKeyImport) {
            return <KeyImportScreen onSkip={() => setSkippedKeyImport(true)} />;
        }

        if (role === ROLES.PATIENT) return <PatientDashboard />;
        if (role === ROLES.DOCTOR) return <DoctorDashboard />;

        return <LandingPage />;
    };

    return (
        <>
            {renderPage()}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </>
    );
}
