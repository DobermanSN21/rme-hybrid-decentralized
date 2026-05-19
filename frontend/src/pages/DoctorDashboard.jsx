// pages/DoctorDashboard.jsx

import { useState, useEffect, useRef } from "react";
import { isAddress } from "ethers";
import { useWallet } from "../context/WalletContext";
import { useDisplayName } from "../hooks/useDisplayName";
import Layout from "../components/Layout";
import RecordCard from "../components/RecordCard";
import PatientSearchDropdown from "../components/PatientSearchDropdown";
import {
    submitRecord, getPatientRecords,
    getPublicKey as getBlockchainPublicKey,
    getEncryptedKey, getSubmittedByDoctor, getPatientList,
} from "../services/blockchain";
import {
    generateAESKey, encryptFile, decryptFile,
    encryptWithPublicKey, decryptWithPrivateKey,
    serializeEncrypted, deserializeEncrypted, sha256Hex,
} from "../services/crypto";
import { uploadToPinata, downloadFromPinata, isPinataConfigured } from "../services/pinata";

const ACCEPTED_TYPES = {
    "image/jpeg": "JPEG Image",
    "image/png": "PNG Image",
    "image/webp": "WebP Image",
    "application/pdf": "PDF Document",
};

const UPLOAD_STEPS = [
    { key: "encrypt", label: "Mengenkripsi file dengan AES-256-CBC..." },
    { key: "upload",  label: "Mengunggah file terenkripsi ke IPFS..." },
    { key: "key",     label: "Mengenkripsi kunci AES dengan public key pasien..." },
    { key: "blockchain", label: "Menyimpan rekam medis ke blockchain..." },
    { key: "done",    label: "Unggah selesai!" },
];

function PatientNameDisplay({ address }) {
    const name = useDisplayName(address);
    return (
        <div style={{ marginTop:"2px" }}>
            {name && <p style={{ fontSize:"0.82rem",fontWeight:600,color:"#0f172a",margin:0 }}>{name}</p>}
            <p style={{ fontFamily:"monospace",fontSize:"0.72rem",color:name?"#94a3b8":"#0f172a",margin:0,wordBreak:"break-all" }}>{address}</p>
        </div>
    );
}

const IconLoader = ({ size = 14 }) => (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
);

export default function DoctorDashboard() {
    const { account, privateKey, setError, savePrivateKey } = useWallet();
    const [activeTab, setActiveTab] = useState("upload");

    // Upload state
    const [patientAddress, setPatientAddress] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadStep, setUploadStep] = useState(null);
    const [uploadSuccess, setUploadSuccess] = useState(null);

    // View state
    const [searchAddress, setSearchAddress] = useState("");
    const [records, setRecords] = useState([]);
    const [decryptedMap, setDecryptedMap] = useState({});
    const [keyStatusMap, setKeyStatusMap] = useState({});
    const [searchLoading, setSearchLoading] = useState(false);

    // Patient list (shared between upload + view)
    const [patientList, setPatientList] = useState([]);
    const [patientListLoading, setPatientListLoading] = useState(false);

    // Submissions
    const [submissions, setSubmissions] = useState([]);
    const [submissionsLoading, setSubmissionsLoading] = useState(false);
    const [notification, setNotification] = useState(null);
    const prevApprovedRef = useRef(new Set());

    // Private key import
    const [keyInput, setKeyInput] = useState("");

    // Load patient list on mount
    useEffect(() => {
        if (!account) return;
        setPatientListLoading(true);
        getPatientList(account.signer)
            .then(list => setPatientList(list))
            .catch(err => console.warn("getPatientList:", err))
            .finally(() => setPatientListLoading(false));
    }, [account]);

    // Load submissions + polling
    const loadSubmissions = async () => {
        if (!account) return;
        try {
            const data = await getSubmittedByDoctor(account.signer);
            data.sort((a, b) => b.timestamp - a.timestamp);
            const newlyApproved = data.filter(r => r.status==="APPROVED" && !prevApprovedRef.current.has(r.cid));
            if (newlyApproved.length > 0 && prevApprovedRef.current.size > 0) {
                setNotification(`${newlyApproved.length} rekam medis disetujui pasien!`);
                setTimeout(() => setNotification(null), 5000);
            }
            prevApprovedRef.current = new Set(data.filter(r=>r.status==="APPROVED").map(r=>r.cid));
            setSubmissions(data);
        } catch (err) { console.warn("[RME] loadSubmissions:", err.message); }
    };

    useEffect(() => {
        if (!account) return;
        loadSubmissions();
        const interval = setInterval(loadSubmissions, 30_000);
        return () => clearInterval(interval);
    }, [account]);

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!ACCEPTED_TYPES[file.type]) { setError("Hanya file gambar (JPEG, PNG, WebP) dan PDF yang diizinkan."); return; }
        if (file.size > 10*1024*1024) { setError("Ukuran file maksimal 10 MB."); return; }
        setSelectedFile(file);
        setUploadSuccess(null);
        if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (ev) => setFilePreview({ type:"image",url:ev.target.result });
            reader.readAsDataURL(file);
        } else {
            setFilePreview({ type:"pdf",name:file.name,size:file.size });
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) { setError("Pilih file terlebih dahulu."); return; }
        if (!patientAddress) { setError("Pilih atau masukkan alamat wallet pasien."); return; }
        if (!isAddress(patientAddress)) { setError("Alamat wallet pasien tidak valid."); return; }
        if (!isPinataConfigured()) { setError("Pinata belum dikonfigurasi. Atur VITE_PINATA_JWT di file .env."); return; }

        setUploadLoading(true); setUploadStep("encrypt"); setError(null);
        try {
            const aesKeyHex = await generateAESKey();
            const fileBuffer = await selectedFile.arrayBuffer();
            const fileBytes = new Uint8Array(fileBuffer);
            const originalHash = sha256Hex(fileBytes);
            const encryptedBlob = await encryptFile(fileBuffer, aesKeyHex);

            setUploadStep("upload");
            const cid = await uploadToPinata(encryptedBlob, selectedFile.name);

            setUploadStep("key");
            const patientPubKey = await getBlockchainPublicKey(account.signer, patientAddress);
            const encAesKey = await encryptWithPublicKey(patientPubKey, aesKeyHex);
            const serializedKey = serializeEncrypted(encAesKey);

            setUploadStep("blockchain");
            await submitRecord(account.signer, patientAddress, cid, serializedKey, selectedFile.type, selectedFile.name);

            setUploadStep("done");
            setUploadSuccess({ cid, fileName:selectedFile.name, fileType:selectedFile.type, sha256:originalHash });
            setSelectedFile(null); setFilePreview(null);
        } catch (err) {
            const msg = err.reason || err.message || String(err);
            if (msg.includes("getPublicKey")) {
                setError("Gagal mengunggah: Pasien belum terdaftar atau tidak memiliki public key di blockchain.");
            } else {
                setError("Gagal mengunggah: " + msg);
            }
        } finally {
            setUploadLoading(false);
            setTimeout(() => setUploadStep(null), 3000);
        }
    };

    const handleSearch = async () => {
        if (!searchAddress || !isAddress(searchAddress)) { setError("Pilih atau masukkan alamat wallet pasien yang valid."); return; }
        setSearchLoading(true); setError(null); setDecryptedMap({}); setKeyStatusMap({});
        try {
            const recs = await getPatientRecords(account.signer, searchAddress);
            if (recs.length === 0) { setError("Tidak ada rekam medis atau Anda tidak memiliki akses ke pasien ini."); setRecords([]); return; }
            const statusEntries = await Promise.all(
                recs.map(async r => {
                    try { await getEncryptedKey(account.signer, r.cid); return [r.cid, true]; }
                    catch { return [r.cid, false]; }
                })
            );
            const statusMap = Object.fromEntries(statusEntries);
            setKeyStatusMap(statusMap);
            setRecords(recs.filter(r => statusMap[r.cid] === true));
        } catch (err) {
            setRecords([]);
            setError(err.reason || err.message || "Gagal mengambil rekam medis.");
        } finally { setSearchLoading(false); }
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
            const blob = new Blob([decryptedBuffer], { type:fileType });
            const url = URL.createObjectURL(blob);
            setDecryptedMap(prev => ({ ...prev, [cid]:{ url, fileType, sha256:decryptedHash } }));
        } catch (err) {
            const msg = err.message || String(err);
            if (msg.includes("No encrypted key") || msg.includes("encrypted key found")) {
                setError("Anda tidak memiliki kunci dekripsi untuk rekam medis ini. Minta pasien untuk memberikan akses melalui tab 'Kelola Akses'.");
            } else {
                setError("Dekripsi gagal: " + msg);
            }
        }
    };

    const handleImportKey = async () => {
        const key = keyInput.trim();
        if (key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) { setError("Private key harus tepat 64 karakter hexadecimal."); return; }
        try {
            const { privateKeyToPublicKey } = await import("../services/crypto");
            const derivedPubKey = privateKeyToPublicKey(key);
            const onChainPubKey = await getBlockchainPublicKey(account.signer, account.address);
            if (!onChainPubKey || derivedPubKey !== onChainPubKey) { setError("Private key tidak sesuai dengan wallet ini."); return; }
            savePrivateKey(key);
            setKeyInput("");
        } catch (err) { setError("Verifikasi key gagal: " + (err.message || err)); }
    };

    const currentStepIndex = uploadStep ? UPLOAD_STEPS.findIndex(s => s.key === uploadStep) : -1;
    const pendingCount = submissions.filter(r => r.status === "PENDING").length;

    const tabs = [
        { id:"upload",      label:"Unggah Rekam Medis", icon:"upload" },
        { id:"submissions", label:"Riwayat Kiriman",    icon:"list",   count:pendingCount },
        { id:"view",        label:"Lihat Rekam Medis",  icon:"search" },
    ];

    const TabIcon = ({ type, size = 16 }) => {
        if (type==="upload") return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>;
        if (type==="list")   return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>;
        return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
    };

    return (
        <Layout>
            {/* Notification Toast */}
            {notification && (
                <div style={{ position:"fixed",top:"24px",right:"24px",zIndex:9999,display:"flex",alignItems:"center",gap:"10px",padding:"14px 20px",borderRadius:"12px",background:"#16a34a",color:"white",boxShadow:"0 8px 24px rgba(22,163,74,0.35)",fontSize:"0.85rem",fontWeight:600,maxWidth:"340px" }} className="animate-fade-in">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {notification}
                    <button onClick={() => setNotification(null)} style={{ marginLeft:"auto",background:"none",border:"none",color:"white",cursor:"pointer",opacity:0.7,padding:"0 2px",fontSize:"1rem",lineHeight:1 }}>✕</button>
                </div>
            )}

            {/* Private Key Status */}
            {!privateKey ? (
                <div style={{ display:"flex",alignItems:"center",gap:"8px",padding:"12px 16px",borderRadius:"10px",background:"#fffbeb",border:"1px solid #fde68a",marginBottom:"24px",flexWrap:"wrap" }} className="animate-fade-in">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                    <span style={{ fontSize:"0.78rem",fontWeight:600,color:"#b45309",flex:1 }}>Private key belum diimpor — enkripsi tidak tersedia</span>
                    <div style={{ display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap",width:"100%" }}>
                        <input type="password" value={keyInput} onChange={e=>setKeyInput(e.target.value)} placeholder="Tempel key..." className="input-field" style={{ flex:"1 1 140px",minWidth:0,fontSize:"0.75rem",padding:"6px 10px" }}/>
                        <button onClick={handleImportKey} className="btn btn-primary" style={{ fontSize:"0.75rem",padding:"6px 14px",flexShrink:0 }}>Impor</button>
                    </div>
                </div>
            ) : (
                <div style={{ marginBottom:"24px",textAlign:"center" }}>
                    <span style={{ display:"inline-flex",alignItems:"center",gap:"6px",padding:"6px 16px",borderRadius:"20px",fontSize:"0.72rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Private Key Aktif
                    </span>
                </div>
            )}

            {/* Tab Navigation */}
            <div style={{ display:"flex",gap:"4px",background:"#f1f5f9",padding:"4px",borderRadius:"12px",margin:"0 auto 28px" }}>
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",padding:"8px 6px",borderRadius:"9px",fontSize:"0.72rem",fontWeight:600,border:"none",cursor:"pointer",transition:"all 0.2s ease",flex:"1 1 0",justifyContent:"center",textAlign:"center",lineHeight:1.3,background:activeTab===tab.id?"white":"transparent",color:activeTab===tab.id?"#0f172a":"#64748b",boxShadow:activeTab===tab.id?"0 1px 3px rgba(0,0,0,0.08)":"none",minWidth:0 }}>
                        <TabIcon type={tab.icon} size={15}/>
                        <span style={{ wordBreak:"keep-all" }}>{tab.label}</span>
                        {tab.count > 0 && (
                            <span style={{ minWidth:"16px",height:"16px",padding:"0 4px",borderRadius:"9px",background:"#ef4444",color:"white",fontSize:"0.6rem",fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",lineHeight:1 }}>{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Tab: Unggah ── */}
            {activeTab === "upload" && (
                <div className="max-w-2xl mx-auto">
                    <h2 className="section-title">Unggah Rekam Medis Pasien</h2>
                    <div className="glass-card" style={{ padding:"28px" }}>

                        {/* Pilih Pasien */}
                        <div style={{ marginBottom:"20px" }}>
                            <label style={{ display:"block",fontSize:"0.72rem",fontWeight:600,color:"#64748b",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.06em" }}>Pasien</label>
                            <PatientSearchDropdown
                                patientList={patientList}
                                listLoading={patientListLoading}
                                onSelect={addr => setPatientAddress(addr)}
                            />
                        </div>

                        {/* File Picker */}
                        <div style={{ marginBottom:"20px" }}>
                            <label style={{ display:"block",fontSize:"0.72rem",fontWeight:600,color:"#64748b",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.06em" }}>File Rekam Medis</label>
                            {!filePreview && (
                                <div style={{ border:"2px dashed #e2e8f0",borderRadius:"14px",padding:"32px 16px",textAlign:"center",transition:"border-color 0.2s",cursor:"pointer" }}
                                    onMouseEnter={e=>e.currentTarget.style.borderColor="#93bbf5"}
                                    onMouseLeave={e=>e.currentTarget.style.borderColor="#e2e8f0"}>
                                    <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleFileSelect} className="hidden" id="file-upload"/>
                                    <label htmlFor="file-upload" style={{ cursor:"pointer",display:"block" }}>
                                        <div style={{ width:"48px",height:"48px",borderRadius:"12px",background:"#eef5ff",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px" }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E7DDB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                                        </div>
                                        <p style={{ fontSize:"0.85rem",fontWeight:600,color:"#334155",marginBottom:"4px" }}>Klik untuk memilih file</p>
                                        <p style={{ fontSize:"0.75rem",color:"#94a3b8" }}>JPEG, PNG, WebP, PDF — maks. 10 MB</p>
                                    </label>
                                </div>
                            )}
                            {filePreview && (
                                <div style={{ padding:"16px",borderRadius:"12px",background:"#f8fafc",border:"1px solid #e2e8f0" }}>
                                    {filePreview.type === "image" ? (
                                        <div style={{ textAlign:"center" }}>
                                            <img src={filePreview.url} alt="Preview" style={{ maxHeight:"200px",maxWidth:"100%",borderRadius:"10px",border:"1px solid #e2e8f0",margin:"0 auto",display:"block" }}/>
                                            <p style={{ fontSize:"0.72rem",color:"#94a3b8",marginTop:"8px" }}>{selectedFile?.name}</p>
                                        </div>
                                    ) : (
                                        <div style={{ display:"flex",alignItems:"center",gap:"12px" }}>
                                            <div style={{ width:"42px",height:"42px",borderRadius:"10px",background:"#fff1f2",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                                            </div>
                                            <div>
                                                <p style={{ fontSize:"0.85rem",fontWeight:600,color:"#0f172a" }}>{filePreview.name}</p>
                                                <p style={{ fontSize:"0.72rem",color:"#94a3b8" }}>{(filePreview.size/1024).toFixed(1)} KB</p>
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ display:"flex",gap:"8px",marginTop:"12px",justifyContent:"center" }}>
                                        <button onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                                            style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",gap:"5px",fontSize:"0.75rem",padding:"8px 18px",borderRadius:"8px",border:"1px solid #fecaca",background:"#fff5f5",color:"#dc2626",cursor:"pointer",fontWeight:500,fontFamily:"inherit" }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> Hapus
                                        </button>
                                        <button onClick={() => document.getElementById("file-upload-replace").click()}
                                            style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",gap:"5px",fontSize:"0.75rem",padding:"8px 18px",borderRadius:"8px",border:"1px solid #bfdbfe",background:"#eff6ff",color:"#2563eb",cursor:"pointer",fontWeight:500,fontFamily:"inherit" }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg> Ganti
                                        </button>
                                        <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleFileSelect} className="hidden" id="file-upload-replace"/>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Info Enkripsi */}
                        <div style={{ padding:"14px 16px",borderRadius:"12px",background:"#f0f7ff",border:"1px solid #bfdbfe",marginBottom:"20px" }}>
                            <p style={{ fontSize:"0.75rem",color:"#475569",lineHeight:"1.6",margin:0 }}>
                                <strong style={{ color:"#2E7DDB" }}>Alur enkripsi:</strong>{" "}
                                File → SHA-256(hash) → AES-256-CBC → Pinata (IPFS) → Kunci AES → ECIES(ECC PubKey Pasien) → Blockchain
                            </p>
                        </div>

                        {/* Progress Steps */}
                        {uploadStep && (
                            <div style={{ padding:"16px",borderRadius:"12px",background:"#f8fafc",border:"1px solid #e2e8f0",marginBottom:"24px" }}>
                                {UPLOAD_STEPS.map((step,i) => (
                                    <div key={step.key} style={{ display:"flex",alignItems:"center",gap:"10px",padding:"6px 0" }}>
                                        <span style={{ width:"20px",height:"20px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                                            {i < currentStepIndex || (i===currentStepIndex && uploadStep==="done")
                                                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                : i===currentStepIndex
                                                    ? <IconLoader size={15}/>
                                                    : <span style={{ width:"8px",height:"8px",borderRadius:"50%",background:"#e2e8f0",display:"block",margin:"0 auto" }}/>}
                                        </span>
                                        <span style={{ fontSize:"0.8rem",fontWeight:i<=currentStepIndex?500:400,color:i<=currentStepIndex?"#0f172a":"#94a3b8" }}>{step.label}</span>
                                    </div>
                                ))}
                                <div style={{ width:"100%",background:"#e2e8f0",borderRadius:"99px",height:"6px",marginTop:"12px",overflow:"hidden" }}>
                                    <div style={{ height:"100%",borderRadius:"99px",transition:"width 0.5s ease",width:`${((currentStepIndex+1)/UPLOAD_STEPS.length)*100}%`,background:"linear-gradient(90deg,#2E7DDB,#14b8a6)" }}/>
                                </div>
                            </div>
                        )}

                        <button onClick={handleUpload} disabled={uploadLoading || !selectedFile || !patientAddress || !isAddress(patientAddress)} className="btn btn-accent"
                            style={{ width:"100%",justifyContent:"center",padding:"13px 22px",fontSize:"0.88rem" }}>
                            {uploadLoading
                                ? <><IconLoader size={15}/> Memproses...</>
                                : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Enkripsi &amp; Unggah ke IPFS</>}
                        </button>
                    </div>

                    {uploadSuccess && (
                        <div className="glass-card animate-fade-in" style={{ marginTop:"16px",padding:"20px",borderLeft:"3px solid #22c55e" }}>
                            <div style={{ display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px" }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                <span style={{ fontSize:"0.9rem",fontWeight:700,color:"#16a34a" }}>Unggah Berhasil!</span>
                            </div>
                            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:"10px" }}>
                                <div><div style={{ fontSize:"0.68rem",fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"3px" }}>File</div><div style={{ fontSize:"0.8rem",color:"#1e293b",fontWeight:500 }}>{uploadSuccess.fileName}</div></div>
                                <div><div style={{ fontSize:"0.68rem",fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"3px" }}>CID</div><div className="mono" style={{ fontSize:"0.8rem",color:"#2E7DDB",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{uploadSuccess.cid}</div></div>
                                <div><div style={{ fontSize:"0.68rem",fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"3px" }}>Status</div><div style={{ fontSize:"0.8rem",color:"#d97706",fontWeight:500 }}>MENUNGGU persetujuan pasien</div></div>
                            </div>
                            {uploadSuccess.sha256 && (
                                <div style={{ marginTop:"12px",padding:"10px 12px",borderRadius:"8px",background:"#f0fdf4",border:"1px solid #bbf7d0" }}>
                                    <div style={{ fontSize:"0.65rem",fontWeight:700,color:"#16a34a",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"4px" }}>SHA-256 (integritas file asli)</div>
                                    <div className="mono" style={{ fontSize:"0.72rem",color:"#166534",wordBreak:"break-all",lineHeight:1.5 }}>{uploadSuccess.sha256}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab: Riwayat Kiriman ── */}
            {activeTab === "submissions" && (
                <div style={{ maxWidth:"800px",margin:"0 auto" }}>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"20px",flexWrap:"wrap",gap:"10px" }}>
                        <h2 className="section-title" style={{ marginBottom:0 }}>Riwayat Rekam Medis yang Dikirim</h2>
                        <div style={{ display:"flex",gap:"8px" }}>
                            {[
                                { label:"Menunggu", count:submissions.filter(r=>r.status==="PENDING").length,  color:"#d97706", bg:"#fffbeb", border:"#fde68a" },
                                { label:"Disetujui", count:submissions.filter(r=>r.status==="APPROVED").length, color:"#16a34a", bg:"#f0fdf4", border:"#bbf7d0" },
                                { label:"Ditolak",   count:submissions.filter(r=>r.status==="REJECTED").length, color:"#dc2626", bg:"#fff5f5", border:"#fecaca" },
                            ].map(s => (
                                <span key={s.label} style={{ fontSize:"0.72rem",fontWeight:700,padding:"4px 12px",borderRadius:"20px",background:s.bg,color:s.color,border:`1px solid ${s.border}` }}>
                                    {s.label}: {s.count}
                                </span>
                            ))}
                        </div>
                    </div>

                    {submissions.length === 0 ? (
                        <div className="glass-card" style={{ textAlign:"center",padding:"48px 24px" }}>
                            <div style={{ margin:"0 auto 16px",opacity:0.35 }}>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                            </div>
                            <p style={{ fontSize:"0.88rem",color:"#64748b",fontWeight:500 }}>Belum ada kiriman</p>
                            <p style={{ fontSize:"0.75rem",color:"#94a3b8",marginTop:"4px" }}>Rekam medis yang Anda kirimkan akan muncul di sini.</p>
                        </div>
                    ) : (
                        <div style={{ display:"flex",flexDirection:"column",gap:"12px" }}>
                            {submissions.map((rec,i) => {
                                const statusConfig = {
                                    PENDING:  { label:"MENUNGGU",  color:"#d97706",bg:"#fffbeb",border:"#fde68a" },
                                    APPROVED: { label:"DISETUJUI", color:"#16a34a",bg:"#f0fdf4",border:"#bbf7d0" },
                                    REJECTED: { label:"DITOLAK",   color:"#dc2626",bg:"#fff5f5",border:"#fecaca" },
                                }[rec.status] || { label:rec.status, color:"#64748b",bg:"#f8fafc",border:"#e2e8f0" };
                                return (
                                    <div key={i} className="glass-card" style={{ padding:"18px 20px",borderLeft:`3px solid ${statusConfig.border}` }}>
                                        <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",flexWrap:"wrap" }}>
                                            <div style={{ flex:1,minWidth:0 }}>
                                                <div style={{ display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px",flexWrap:"wrap" }}>
                                                    <span style={{ fontSize:"0.72rem",fontWeight:700,padding:"3px 10px",borderRadius:"20px",background:statusConfig.bg,color:statusConfig.color,border:`1px solid ${statusConfig.border}`,flexShrink:0 }}>
                                                        {statusConfig.label}
                                                    </span>
                                                    <span style={{ fontSize:"0.72rem",color:"#94a3b8",flexShrink:0 }}>
                                                        {new Date(rec.timestamp*1000).toLocaleString("id-ID")}
                                                    </span>
                                                </div>
                                                <div style={{ marginBottom:"6px" }}>
                                                    <span style={{ fontSize:"0.68rem",fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em" }}>Pasien</span>
                                                    <PatientNameDisplay address={rec.patientAddress}/>
                                                </div>
                                                <div>
                                                    <span style={{ fontSize:"0.68rem",fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em" }}>CID</span>
                                                    <p style={{ fontFamily:"monospace",fontSize:"0.72rem",color:"#2E7DDB",marginTop:"2px",wordBreak:"break-all",lineHeight:1.4 }}>{rec.cid}</p>
                                                </div>
                                            </div>
                                            {rec.status==="APPROVED" && (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                            )}
                                            {rec.status==="PENDING" && (
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.5 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <p style={{ textAlign:"center",fontSize:"0.7rem",color:"#94a3b8",marginTop:"16px" }}>
                        Diperbarui otomatis setiap 30 detik. Notifikasi muncul saat pasien menyetujui.
                    </p>
                </div>
            )}

            {/* ── Tab: Lihat Rekam Medis ── */}
            {activeTab === "view" && (
                <div style={{ maxWidth:"800px",margin:"0 auto" }}>
                    <h2 className="section-title" style={{ marginBottom:"20px" }}>Lihat Rekam Medis Pasien</h2>

                    <div className="glass-card" style={{ marginBottom:"24px",padding:"24px" }}>
                        <h3 style={{ fontSize:"0.88rem",fontWeight:700,color:"#0f172a",marginBottom:"4px" }}>Cari Pasien</h3>
                        <p style={{ fontSize:"0.72rem",color:"#94a3b8",marginBottom:"14px" }}>Cari berdasarkan nama atau pilih dari daftar pasien terdaftar</p>
                        <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
                            <PatientSearchDropdown
                                patientList={patientList}
                                listLoading={patientListLoading}
                                onSelect={addr => { setSearchAddress(addr); setRecords([]); setDecryptedMap({}); setKeyStatusMap({}); }}
                            />
                            <button onClick={handleSearch} disabled={searchLoading || !searchAddress} className="btn btn-primary" style={{ fontSize:"0.82rem",justifyContent:"center",width:"100%" }}>
                                {searchLoading
                                    ? <IconLoader size={14}/>
                                    : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Cari Rekam Medis</>}
                            </button>
                        </div>
                    </div>

                    {records.length > 0 && (
                        <div>
                            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px" }}>
                                <h3 className="section-title" style={{ marginBottom:0 }}>Rekam Medis</h3>
                                <span className="badge badge-patient">{records.length} rekam medis</span>
                            </div>
                            <div style={{ display:"flex",flexDirection:"column",gap:"14px",overflow:"hidden",minWidth:0 }}>
                                {records.map((rec,i) => (
                                    <RecordCard key={i} record={rec}
                                        onDecrypt={() => handleDecrypt(rec.cid, rec.fileType)}
                                        decryptedData={decryptedMap[rec.cid]}
                                        keyAvailable={keyStatusMap[rec.cid]}/>
                                ))}
                            </div>
                        </div>
                    )}

                    {!searchLoading && records.length === 0 && searchAddress && (
                        <div className="glass-card" style={{ textAlign:"center",padding:"48px 24px" }}>
                            <div style={{ margin:"0 auto 16px",opacity:0.4 }}>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </div>
                            <p style={{ fontSize:"0.88rem",color:"#64748b",fontWeight:500 }}>Tidak ada rekam medis yang tersedia</p>
                            <p style={{ fontSize:"0.75rem",color:"#94a3b8",marginTop:"4px" }}>Pasien belum memiliki rekam medis atau Anda tidak memiliki akses.</p>
                        </div>
                    )}
                </div>
            )}
        </Layout>
    );
}
