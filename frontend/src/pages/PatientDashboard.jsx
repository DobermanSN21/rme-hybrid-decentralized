// pages/PatientDashboard.jsx

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "../context/WalletContext";
import { useDisplayNames } from "../hooks/useDisplayName";
import Layout from "../components/Layout";
import RecordCard from "../components/RecordCard";
import AccessManager from "../components/AccessManager";
import ConfirmDialog from "../components/ConfirmDialog";
import {
    getMyRecords, getPendingRecords, getPendingCount,
    approveRecord, rejectRecord, getEncryptedKey, grantAccess,
    getPublicKey as getBlockchainPublicKey,
} from "../services/blockchain";
import {
    decryptFile, decryptWithPrivateKey, deserializeEncrypted,
    encryptWithPublicKey, serializeEncrypted, sha256Hex,
} from "../services/crypto";
import { downloadFromPinata } from "../services/pinata";

const POLL_INTERVAL = 30_000;

const IconClock = ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
);
const IconFileText = ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/>
    </svg>
);
const IconKey = ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>
    </svg>
);
const IconCheck = ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
    </svg>
);
const IconX = ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
);
const IconShield = ({ size = 48, color = "#22c55e" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
        <path d="m9 12 2 2 4-4"/>
    </svg>
);
const IconFolder = ({ size = 48, color = "#94a3b8" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
    </svg>
);
const IconAlertTriangle = ({ size = 16, color = "#d97706" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
        <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
    </svg>
);
const IconLoader = ({ size = 14 }) => (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
);

export default function PatientDashboard() {
    const { account, privateKey, setError, savePrivateKey } = useWallet();
    const [records, setRecords] = useState([]);
    const [pendingRecords, setPendingRecords] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [decryptedMap, setDecryptedMap] = useState({});
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [activeTab, setActiveTab] = useState("pending");
    const [keyInput, setKeyInput] = useState("");
    const [confirmDialog, setConfirmDialog] = useState(null);
    const pollRef = useRef(null);
    const prevPendingCountRef = useRef(0);

    // Doctor name lookup for pending records
    const pendingDoctorAddrs = pendingRecords.map(r => r.doctorAddress).filter(Boolean);
    const doctorNamesMap = useDisplayNames(pendingDoctorAddrs);
    const getDrName = (addr) => doctorNamesMap[addr?.toLowerCase()] || "";

    const loadRecords = useCallback(async () => {
        if (!account) return;
        setLoading(true);
        try {
            const [recs, pending, count] = await Promise.all([
                getMyRecords(account.signer),
                getPendingRecords(account.signer),
                getPendingCount(account.signer),
            ]);
            setRecords(recs);
            setPendingRecords(pending);
            setPendingCount(count);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [account]);

    useEffect(() => { loadRecords(); }, [loadRecords]);

    useEffect(() => {
        if (!account) return;
        const poll = async () => {
            try {
                const count = await getPendingCount(account.signer);
                if (count > prevPendingCountRef.current && prevPendingCountRef.current > 0) await loadRecords();
                prevPendingCountRef.current = count;
                setPendingCount(count);
            } catch { /* silent */ }
        };
        pollRef.current = setInterval(poll, POLL_INTERVAL);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [account, loadRecords]);

    const handleApprove = (rec) => {
        const drName = getDrName(rec.doctorAddress);
        setConfirmDialog({
            title: "Setujui Rekam Medis",
            message: "Rekam medis ini akan disimpan permanen di blockchain dan dokter akan dapat mendekripsinya.",
            confirmLabel: "Setujui",
            variant: "primary",
            details: [
                { label: "File", value: rec.fileName || "Tidak diketahui" },
                { label: "Tipe", value: rec.fileType },
                { label: "Dokter", value: drName || rec.doctorAddress, mono: !drName },
                { label: "CID", value: rec.cid, mono: true },
            ],
            onConfirm: async () => {
                setConfirmDialog(null);
                setActionLoading(rec.recordIndex);
                setError(null);
                try {
                    await approveRecord(account.signer, rec.recordIndex);
                    if (privateKey) {
                        try {
                            const encKeyStr = await getEncryptedKey(account.signer, rec.cid);
                            const encKey = deserializeEncrypted(encKeyStr);
                            const aesKeyHex = await decryptWithPrivateKey(privateKey, encKey);
                            const doctorPubKey = await getBlockchainPublicKey(account.signer, rec.doctorAddress);
                            const encForDoctor = await encryptWithPublicKey(doctorPubKey, aesKeyHex);
                            await grantAccess(account.signer, rec.doctorAddress, rec.cid, serializeEncrypted(encForDoctor));
                        } catch (grantErr) {
                            console.warn("[RME] Grant access to doctor failed:", grantErr.message);
                        }
                    }
                    await loadRecords();
                } catch (err) {
                    setError("Gagal menyetujui: " + (err.reason || err.message || err));
                } finally { setActionLoading(null); }
            },
        });
    };

    const handleReject = (recordIndex, fileName) => {
        setConfirmDialog({
            title: "Tolak Rekam Medis",
            message: "Rekam medis ini akan ditolak secara permanen dan tidak dapat disetujui lagi. Dokter perlu mengunggah ulang jika diperlukan.",
            confirmLabel: "Tolak",
            variant: "danger",
            details: [{ label: "File", value: fileName || "Tidak diketahui" }],
            onConfirm: async () => {
                setConfirmDialog(null);
                setActionLoading(recordIndex);
                setError(null);
                try {
                    await rejectRecord(account.signer, recordIndex);
                    await loadRecords();
                } catch (err) {
                    setError("Gagal menolak: " + (err.reason || err.message || err));
                } finally { setActionLoading(null); }
            },
        });
    };

    const handleDecrypt = async (cid, fileType) => {
        if (!privateKey) { setError("Private key belum tersedia. Silakan impor terlebih dahulu."); return; }
        try {
            const encKeyStr = await getEncryptedKey(account.signer, cid);
            const encKey = deserializeEncrypted(encKeyStr);
            const aesKeyHex = await decryptWithPrivateKey(privateKey, encKey);
            const encryptedBuffer = await downloadFromPinata(cid);
            const decryptedBuffer = await decryptFile(encryptedBuffer, aesKeyHex);
            const decryptedHash = sha256Hex(new Uint8Array(decryptedBuffer));
            const blob = new Blob([decryptedBuffer], { type: fileType });
            const url = URL.createObjectURL(blob);
            setDecryptedMap((prev) => ({ ...prev, [cid]: { url, fileType, sha256: decryptedHash } }));
        } catch (err) { setError("Dekripsi gagal: " + (err.message || err)); }
    };

    const handleImportKey = async () => {
        const key = keyInput.trim();
        if (key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
            setError("Private key harus tepat 64 karakter hexadecimal.");
            return;
        }
        try {
            const { privateKeyToPublicKey } = await import("../services/crypto");
            const derivedPubKey = privateKeyToPublicKey(key);
            const onChainPubKey = await getBlockchainPublicKey(account.signer, account.address);
            if (!onChainPubKey || derivedPubKey !== onChainPubKey) { setError("Private key tidak sesuai dengan wallet ini."); return; }
            savePrivateKey(key);
            setKeyInput("");
        } catch (err) { setError("Verifikasi key gagal: " + (err.message || err)); }
    };

    const shortenAddr = (a) => `${a.slice(0, 6)}...${a.slice(-4)}`;

    const tabs = [
        { id: "pending", label: "Persetujuan", icon: <IconClock size={16}/>, count: pendingCount },
        { id: "records", label: "Rekam Medis", icon: <IconFileText size={16}/>, count: records.length },
        { id: "access", label: "Kelola Akses", icon: <IconKey size={16}/> },
    ];

    return (
        <Layout>
            <ConfirmDialog
                isOpen={!!confirmDialog} title={confirmDialog?.title||""} message={confirmDialog?.message||""}
                details={confirmDialog?.details} confirmLabel={confirmDialog?.confirmLabel}
                variant={confirmDialog?.variant} onConfirm={confirmDialog?.onConfirm||(()=>{})}
                onCancel={() => setConfirmDialog(null)}
            />

            {/* Private Key Status */}
            {!privateKey ? (
                <div style={{ display:"flex",alignItems:"center",gap:"8px",padding:"12px 16px",borderRadius:"10px",background:"#fffbeb",border:"1px solid #fde68a",marginBottom:"24px",flexWrap:"wrap" }} className="animate-fade-in">
                    <IconAlertTriangle size={15} color="#d97706"/>
                    <span style={{ fontSize:"0.78rem",fontWeight:600,color:"#b45309",flex:1 }}>Private key belum diimpor — dekripsi tidak tersedia</span>
                    <div style={{ display:"flex",gap:"6px",alignItems:"center" }}>
                        <input type="password" value={keyInput} onChange={e=>setKeyInput(e.target.value)} placeholder="Tempel key..." className="input-field" style={{ width:"200px",fontSize:"0.75rem",padding:"6px 10px" }}/>
                        <button onClick={handleImportKey} className="btn btn-primary" style={{ fontSize:"0.75rem",padding:"6px 14px" }}>Impor</button>
                    </div>
                </div>
            ) : (
                <div style={{ marginBottom:"24px",textAlign:"center" }}>
                    <span style={{ display:"inline-flex",alignItems:"center",gap:"6px",padding:"6px 16px",borderRadius:"20px",fontSize:"0.72rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0" }}>
                        <IconCheck size={12} color="#16a34a"/> Private Key Aktif
                    </span>
                </div>
            )}

            {/* Tab Navigation */}
            <div style={{ display:"flex",gap:"4px",background:"#f1f5f9",padding:"4px",borderRadius:"12px",maxWidth:"560px",margin:"0 auto 28px" }}>
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display:"flex",alignItems:"center",gap:"7px",padding:"10px 18px",borderRadius:"9px",fontSize:"0.82rem",fontWeight:600,border:"none",cursor:"pointer",transition:"all 0.2s ease",flex:"1 1 0",justifyContent:"center",background:activeTab===tab.id?"white":"transparent",color:activeTab===tab.id?"#0f172a":"#64748b",boxShadow:activeTab===tab.id?"0 1px 3px rgba(0,0,0,0.08)":"none" }}>
                        {tab.icon}
                        <span>{tab.label}</span>
                        {tab.count !== undefined && tab.count > 0 && (
                            <span style={{ fontSize:"0.7rem",fontWeight:700,padding:"1px 7px",borderRadius:"10px",background:tab.id==="pending"?"#fef3c7":"#e2e8f0",color:tab.id==="pending"?"#b45309":"#475569" }}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Persetujuan Tab ── */}
            {activeTab === "pending" && (
                <div style={{ maxWidth:"800px",margin:"0 auto" }}>
                    <h2 className="section-title">Menunggu Persetujuan</h2>
                    {loading && (
                        <div style={{ display:"flex",alignItems:"center",gap:"8px",padding:"20px 0" }}>
                            <IconLoader size={16}/><span style={{ fontSize:"0.85rem",color:"#64748b" }}>Memuat...</span>
                        </div>
                    )}
                    {!loading && pendingRecords.length === 0 && (
                        <div className="glass-card" style={{ textAlign:"center",padding:"48px 24px" }}>
                            <div style={{ margin:"0 auto 16px",opacity:0.6 }}><IconShield size={56} color="#22c55e"/></div>
                            <p style={{ fontSize:"0.9rem",color:"#64748b",fontWeight:500 }}>Tidak ada rekam medis yang menunggu persetujuan</p>
                            <p style={{ fontSize:"0.78rem",color:"#94a3b8",marginTop:"4px" }}>Pengajuan baru dari dokter akan muncul di sini</p>
                        </div>
                    )}
                    <div style={{ display:"flex",flexDirection:"column",gap:"12px" }}>
                        {pendingRecords.map(rec => {
                            const drName = getDrName(rec.doctorAddress);
                            return (
                                <div key={rec.recordIndex} className="glass-card animate-fade-in" style={{ padding:"20px",borderLeft:"3px solid #f59e0b" }}>
                                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px",flexWrap:"wrap",gap:"8px" }}>
                                        <span style={{ display:"inline-flex",alignItems:"center",gap:"5px",padding:"3px 10px",borderRadius:"6px",fontSize:"0.7rem",fontWeight:700,background:"#fef3c7",color:"#b45309",textTransform:"uppercase",letterSpacing:"0.04em" }}>
                                            <IconClock size={12} color="#b45309"/> Menunggu
                                        </span>
                                        <span style={{ fontSize:"0.75rem",color:"#94a3b8" }}>
                                            {new Date(rec.timestamp*1000).toLocaleString("id-ID",{ day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit" })}
                                        </span>
                                    </div>
                                    <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:"10px",marginBottom:"16px" }}>
                                        <InfoItem label="Nama File" value={rec.fileName||"Tidak diketahui"}/>
                                        <InfoItem label="Tipe File" value={rec.fileType}/>
                                        <InfoItem label="Dokter" value={drName || shortenAddr(rec.doctorAddress)} accent={!!drName} mono={!drName}/>
                                        <InfoItem label="CID" value={rec.cid} mono truncate/>
                                    </div>
                                    <div style={{ display:"flex",gap:"8px",justifyContent:"flex-end",flexWrap:"wrap" }}>
                                        <button onClick={() => handleApprove(rec)} disabled={actionLoading===rec.recordIndex} className="btn btn-primary" style={{ fontSize:"0.8rem",padding:"8px 20px" }}>
                                            {actionLoading===rec.recordIndex ? <><IconLoader size={14}/> Memproses...</> : <><IconCheck size={14}/> Setujui</>}
                                        </button>
                                        <button onClick={() => handleReject(rec.recordIndex, rec.fileName)} disabled={actionLoading===rec.recordIndex} className="btn btn-danger" style={{ fontSize:"0.8rem",padding:"8px 20px" }}>
                                            {actionLoading===rec.recordIndex ? <><IconLoader size={14}/> Memproses...</> : <><IconX size={14}/> Tolak</>}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Rekam Medis Tab ── */}
            {activeTab === "records" && (
                <div style={{ maxWidth:"800px",margin:"0 auto" }}>
                    <h2 className="section-title">Rekam Medis Saya</h2>
                    {loading && (
                        <div style={{ display:"flex",alignItems:"center",gap:"8px",padding:"20px 0" }}>
                            <IconLoader size={16}/><span style={{ fontSize:"0.85rem",color:"#64748b" }}>Memuat rekam medis...</span>
                        </div>
                    )}
                    {!loading && records.length === 0 && (
                        <div className="glass-card" style={{ textAlign:"center",padding:"48px 24px" }}>
                            <div style={{ margin:"0 auto 16px",opacity:0.5 }}><IconFolder size={56} color="#94a3b8"/></div>
                            <p style={{ fontSize:"0.9rem",color:"#64748b",fontWeight:500 }}>Belum ada rekam medis yang disetujui</p>
                            {pendingCount > 0 && (
                                <button onClick={() => setActiveTab("pending")} className="btn btn-primary" style={{ marginTop:"16px",fontSize:"0.8rem" }}>
                                    Lihat {pendingCount} Menunggu Persetujuan
                                </button>
                            )}
                        </div>
                    )}
                    <div style={{ display:"flex",flexDirection:"column",gap:"12px" }}>
                        {records.map((rec,i) => (
                            <RecordCard key={i} record={rec}
                                onDecrypt={() => handleDecrypt(rec.cid, rec.fileType)}
                                decryptedData={decryptedMap[rec.cid]}/>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Kelola Akses Tab ── */}
            {activeTab === "access" && (
                <div style={{ maxWidth:"680px",margin:"0 auto" }}>
                    <AccessManager/>
                </div>
            )}
        </Layout>
    );
}

function InfoItem({ label, value, mono, accent, truncate }) {
    return (
        <div>
            <div style={{ fontSize:"0.68rem",fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"3px" }}>{label}</div>
            <div style={{ fontSize:"0.8rem",fontWeight:500,color:accent?"#0d9488":"#1e293b",fontFamily:mono?"'JetBrains Mono','Fira Code',monospace":"inherit",overflow:truncate?"hidden":undefined,textOverflow:truncate?"ellipsis":undefined,whiteSpace:truncate?"nowrap":undefined }}>
                {value}
            </div>
        </div>
    );
}
