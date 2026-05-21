// pages/AdminDashboard.jsx

import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
import { getPendingDoctorRequests, getApprovedDoctors, approveDoctor, rejectDoctor } from "../services/blockchain";
import ConfirmDialog from "../components/ConfirmDialog";
import { getPhotoUrl } from "../services/pinata";

const Spinner = ({ size = 14 }) => (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
);

const short = a => a ? `${a.slice(0, 8)}...${a.slice(-6)}` : "-";

const formatDate = ts => ts ? new Date(ts * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

const formatPhone = digits => {
    if (!digits) return "—";
    if (digits.length <= 4) return digits;
    if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
};

const Badge = ({ label, color = "#64748b", bg = "#f8fafc", border = "#e2e8f0" }) => (
    <span style={{ fontSize: "0.68rem", fontWeight: 700, padding: "3px 10px", borderRadius: "8px", background: bg, color, border: `1px solid ${border}` }}>{label}</span>
);

export default function AdminDashboard() {
    const { account, disconnect } = useWallet();
    const [tab, setTab] = useState("pending");
    const [pending, setPending] = useState([]);
    const [approved, setApproved] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectReason, setRejectReason] = useState("");
    const [toast, setToast] = useState(null);

    const showToast = (msg, type = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [p, a] = await Promise.all([
                getPendingDoctorRequests(account.signer),
                getApprovedDoctors(account.signer),
            ]);
            setPending(p);
            setApproved(a);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (account) loadData(); }, [account]);

    const handleApprove = (req) => {
        setConfirmDialog({
            title: "Setujui Dokter",
            message: `Akun dokter ini akan diaktifkan dan dapat menggunakan sistem.`,
            confirmLabel: "Setujui",
            variant: "success",
            details: [
                { label: "Nama", value: req.name },
                { label: "Nomor SIP", value: req.licenseNumber, mono: false },
                { label: "Spesialisasi", value: req.specialization },
                { label: "Rumah Sakit", value: req.hospital },
                { label: "Wallet", value: req.addr, mono: true },
            ],
            onConfirm: async () => {
                setConfirmDialog(null);
                setActionLoading(req.addr);
                try {
                    await approveDoctor(account.signer, req.addr);
                    showToast(`dr. ${req.name} berhasil disetujui`);
                    await loadData();
                } catch (err) {
                    showToast(err.message || "Gagal menyetujui dokter", "error");
                } finally {
                    setActionLoading(null);
                }
            },
        });
    };

    const handleRejectOpen = (req) => {
        setRejectTarget(req);
        setRejectReason("");
    };

    const handleRejectConfirm = async () => {
        if (!rejectTarget) return;
        setActionLoading(rejectTarget.addr);
        setRejectTarget(null);
        try {
            await rejectDoctor(account.signer, rejectTarget.addr, rejectReason || "Tidak memenuhi persyaratan.");
            showToast(`Permohonan ${rejectTarget.name} ditolak`);
            await loadData();
        } catch (err) {
            showToast(err.message || "Gagal menolak permohonan", "error");
        } finally {
            setActionLoading(null);
            setRejectReason("");
        }
    };

    return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)" }}>
            {/* Toast */}
            {toast && (
                <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, padding: "12px 18px", borderRadius: "12px", background: toast.type === "error" ? "#fef2f2" : "#f0fdf4", border: `1px solid ${toast.type === "error" ? "#fca5a5" : "#bbf7d0"}`, color: toast.type === "error" ? "#dc2626" : "#16a34a", fontSize: "0.82rem", fontWeight: 600, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: "8px" }}>
                    {toast.type === "error" ? "✕" : "✓"} {toast.msg}
                </div>
            )}

            {/* Reject Modal */}
            {rejectTarget && (
                <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
                    <div className="glass-card animate-fade-in" style={{ padding: "28px", maxWidth: "440px", width: "100%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
                            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                            </div>
                            <div>
                                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Tolak Permohonan</h3>
                                <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>{rejectTarget.name}</p>
                            </div>
                        </div>
                        <div style={{ marginBottom: "14px" }}>
                            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Alasan Penolakan (opsional)</label>
                            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Contoh: Nomor SIP tidak valid atau tidak dapat diverifikasi..." className="input-field" rows={3} style={{ resize: "vertical" }} />
                        </div>
                        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                            <button onClick={() => setRejectTarget(null)} className="btn btn-ghost" style={{ fontSize: "0.82rem" }}>Batal</button>
                            <button onClick={handleRejectConfirm} className="btn btn-danger" style={{ fontSize: "0.82rem" }}>Tolak Permohonan</button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={!!confirmDialog} title={confirmDialog?.title || ""} message={confirmDialog?.message || ""}
                details={confirmDialog?.details} confirmLabel={confirmDialog?.confirmLabel}
                variant={confirmDialog?.variant} onConfirm={confirmDialog?.onConfirm || (() => {})} onCancel={() => setConfirmDialog(null)}
            />

            {/* Header */}
            <div style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 clamp(16px, 4vw, 40px)" }}>
                <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px", gap: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        </div>
                        <div>
                            <span style={{ fontSize: "1rem", fontWeight: 700, color: "white" }}>RME Vault</span>
                            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)", marginLeft: "8px" }}>Admin Panel</span>
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "20px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="#ef4444" stroke="none"><circle cx="12" cy="12" r="10"/></svg>
                            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#fca5a5" }}>ADMIN</span>
                        </div>
                        <span className="hidden sm:inline" style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", fontFamily: "monospace", whiteSpace: "nowrap" }}>{short(account?.address)}</span>
                        <button onClick={disconnect} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "clamp(24px, 4vw, 40px) clamp(16px, 4vw, 40px)" }}>

                {/* Page Title */}
                <div style={{ marginBottom: "28px" }}>
                    <h1 style={{ fontSize: "clamp(1.3rem, 3vw, 1.8rem)", fontWeight: 800, color: "white", margin: 0 }}>Panel Administrasi</h1>
                    <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.45)", marginTop: "4px" }}>Kelola verifikasi dokter dan akun sistem</p>
                </div>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "28px" }}>
                    {[
                        { label: "Menunggu Verifikasi", value: pending.length, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                        { label: "Dokter Aktif", value: approved.length, color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
                        { label: "Total Terdaftar", value: pending.length + approved.length, color: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.2)", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                    ].map((s, i) => (
                        <div key={i} style={{ padding: "20px", borderRadius: "14px", background: s.bg, border: `1px solid ${s.border}` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>{s.icon}<span style={{ fontSize: "0.72rem", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>{s.label}</span></div>
                            <div style={{ fontSize: "2rem", fontWeight: 800, color: s.color }}>{loading ? "—" : s.value}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "rgba(255,255,255,0.05)", padding: "4px", borderRadius: "12px", width: "fit-content" }}>
                    {[
                        { key: "pending", label: `Menunggu (${pending.length})` },
                        { key: "approved", label: `Dokter Aktif (${approved.length})` },
                    ].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            style={{ padding: "9px 18px", borderRadius: "9px", border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, transition: "all 0.2s", fontFamily: "inherit", background: tab === t.key ? "rgba(255,255,255,0.12)" : "transparent", color: tab === t.key ? "white" : "rgba(255,255,255,0.45)" }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {loading ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "40px 0", color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>
                        <Spinner size={16}/> Memuat data...
                    </div>
                ) : tab === "pending" ? (
                    pending.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "60px 20px" }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 14px", display: "block" }}>
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.3)", margin: 0 }}>Tidak ada permohonan yang menunggu verifikasi</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                            {pending.map(req => (
                                <div key={req.addr} className="glass-card animate-fade-in" style={{ padding: "22px" }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>

                                            {/* Header: foto + nama + badge */}
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                                                {req.photoCid ? (
                                                    <img src={getPhotoUrl(req.photoCid)} alt={req.name}
                                                        style={{ width: "52px", height: "52px", borderRadius: "50%", objectFit: "cover", border: "2px solid #e2e8f0", flexShrink: 0 }} />
                                                ) : (
                                                    <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
                                                    </div>
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>{req.name}</div>
                                                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "1px" }}>{req.specialization || "—"} · {req.hospital || "—"}</div>
                                                </div>
                                                <Badge label="Menunggu" color="#d97706" bg="#fffbeb" border="#fde68a" />
                                            </div>

                                            {/* Detail grid */}
                                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", padding: "14px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #f1f5f9" }}>
                                                {[
                                                    { label: "Nomor SIP", value: req.licenseNumber, mono: true },
                                                    { label: "Nomor KTP (NIK)", value: req.ktpNumber ? `${req.ktpNumber.slice(0,6)} ${req.ktpNumber.slice(6,12)} ${req.ktpNumber.slice(12)}` : "—", mono: true },
                                                    { label: "Nomor Telepon", value: req.phoneNumber ? formatPhone(req.phoneNumber) : "—", mono: true },
                                                    { label: "Wallet", value: short(req.addr), mono: true },
                                                    { label: "Tanggal Pengajuan", value: formatDate(req.requestedAt) },
                                                ].map((f, i) => (
                                                    <div key={i}>
                                                        <div style={{ fontSize: "0.65rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>{f.label}</div>
                                                        <div style={{ fontSize: "0.8rem", fontWeight: 500, color: "#334155", fontFamily: f.mono ? "monospace" : "inherit", wordBreak: "break-all" }}>{f.value || "—"}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", gap: "8px", flexShrink: 0, alignItems: "flex-start", flexWrap: "wrap" }}>
                                            <button onClick={() => handleRejectOpen(req)} disabled={actionLoading === req.addr} className="btn btn-danger" style={{ fontSize: "0.8rem", padding: "9px 16px" }}>
                                                {actionLoading === req.addr ? <Spinner/> : "✕ Tolak"}
                                            </button>
                                            <button onClick={() => handleApprove(req)} disabled={actionLoading === req.addr} className="btn btn-primary" style={{ fontSize: "0.8rem", padding: "9px 16px", background: "#22c55e", borderColor: "#22c55e" }}>
                                                {actionLoading === req.addr ? <Spinner/> : "✓ Setujui"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    approved.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "60px 20px" }}>
                            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.3)", margin: 0 }}>Belum ada dokter yang disetujui</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {approved.map(req => (
                                <div key={req.addr} className="glass-card" style={{ padding: "18px 22px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                                        {req.photoCid ? (
                                            <img src={getPhotoUrl(req.photoCid)} alt={req.name}
                                                style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", border: "2px solid #bbf7d0", flexShrink: 0 }} />
                                        ) : (
                                            <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
                                            </div>
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>{req.name}</div>
                                            <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{req.specialization} · {req.hospital}</div>
                                            {req.phoneNumber && <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontFamily: "monospace", marginTop: "1px" }}>{formatPhone(req.phoneNumber)}</div>}
                                        </div>
                                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontFamily: "monospace" }}>{short(req.addr)}</div>
                                        <Badge label="Aktif" color="#16a34a" bg="#f0fdf4" border="#bbf7d0" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
