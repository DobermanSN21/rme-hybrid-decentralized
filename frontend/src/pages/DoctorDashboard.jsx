// pages/DoctorDashboard.jsx
// ============================================================
// Doctor Dashboard — Upload records for patients + view records
// ============================================================

import { useState } from "react";
import { isAddress } from "ethers";
import { useWallet } from "../context/WalletContext";
import Layout from "../components/Layout";
import RecordCard from "../components/RecordCard";
import {
    submitRecord,
    getPatientRecords,
    getPublicKey as getBlockchainPublicKey,
    getEncryptedKey,
} from "../services/blockchain";
import {
    generateAESKey,
    encryptFile,
    decryptFile,
    encryptWithPublicKey,
    decryptWithPrivateKey,
    serializeEncrypted,
    deserializeEncrypted,
    sha256Hex,
} from "../services/crypto";
import { uploadToPinata, downloadFromPinata, isPinataConfigured } from "../services/pinata";

const ACCEPTED_TYPES = {
    "image/jpeg": "JPEG Image",
    "image/png": "PNG Image",
    "image/webp": "WebP Image",
    "application/pdf": "PDF Document",
};

// Upload progress steps
const UPLOAD_STEPS = [
    { key: "encrypt", label: "Encrypting file with AES-256-CBC..." },
    { key: "upload", label: "Uploading encrypted file to IPFS..." },
    { key: "key", label: "Encrypting AES key with patient's public key..." },
    { key: "blockchain", label: "Submitting record to blockchain..." },
    { key: "done", label: "Upload complete!" },
];

export default function DoctorDashboard() {
    const { account, privateKey, setError, savePrivateKey } = useWallet();
    const [activeTab, setActiveTab] = useState("upload");

    // Upload state
    const [patientAddress, setPatientAddress] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadStep, setUploadStep] = useState(null); // current step key
    const [uploadSuccess, setUploadSuccess] = useState(null);

    // View state
    const [searchAddress, setSearchAddress] = useState("");
    const [records, setRecords] = useState([]);
    const [decryptedMap, setDecryptedMap] = useState({});
    const [searchLoading, setSearchLoading] = useState(false);

    // Private key import
    const [keyInput, setKeyInput] = useState("");

    // Handle file selection
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!ACCEPTED_TYPES[file.type]) {
            setError("Only image files (JPEG, PNG, WebP) and PDF are allowed.");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setError("Maximum file size is 10MB.");
            return;
        }

        setSelectedFile(file);
        setUploadSuccess(null);

        // Preview
        if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (ev) => setFilePreview({ type: "image", url: ev.target.result });
            reader.readAsDataURL(file);
        } else {
            setFilePreview({ type: "pdf", name: file.name, size: file.size });
        }
    };

    // Validate Ethereum address
    const validateAddress = (address, label) => {
        if (!address) {
            setError(`Please enter the ${label} wallet address.`);
            return false;
        }
        if (!isAddress(address)) {
            setError(`Invalid ${label} wallet address. Must be a valid Ethereum address (0x...).`);
            return false;
        }
        return true;
    };

    // Upload record
    const handleUpload = async () => {
        if (!selectedFile) {
            setError("Please select a file to upload.");
            return;
        }

        if (!validateAddress(patientAddress, "patient")) return;

        if (!isPinataConfigured()) {
            setError("Pinata is not configured. Set VITE_PINATA_JWT in .env file.");
            return;
        }

        setUploadLoading(true);
        setUploadStep("encrypt");
        setError(null);
        try {
            // 1. Generate AES key & encrypt file
            const aesKeyHex = await generateAESKey();
            const fileBuffer = await selectedFile.arrayBuffer();
            const fileBytes = new Uint8Array(fileBuffer);
            const originalHash = sha256Hex(fileBytes);
            const encryptedBlob = await encryptFile(fileBuffer, aesKeyHex);

            // 2. Upload to Pinata
            setUploadStep("upload");
            const cid = await uploadToPinata(encryptedBlob, selectedFile.name);

            // 3. Encrypt AES key with patient's public key
            setUploadStep("key");
            const patientPubKey = await getBlockchainPublicKey(account.signer, patientAddress);
            const encAesKey = await encryptWithPublicKey(patientPubKey, aesKeyHex);
            const serializedKey = serializeEncrypted(encAesKey);

            // 4. Submit to blockchain (status: PENDING)
            setUploadStep("blockchain");
            await submitRecord(
                account.signer,
                patientAddress,
                cid,
                serializedKey,
                selectedFile.type,
                selectedFile.name
            );

            setUploadStep("done");
            setUploadSuccess({
                cid,
                fileName: selectedFile.name,
                fileType: selectedFile.type,
                sha256: originalHash,
            });
            setSelectedFile(null);
            setFilePreview(null);
        } catch (err) {
            const msg = err.reason || err.message || String(err);
            if (msg.includes("getPublicKey")) {
                setError("Upload failed: Patient address is not registered or has no public key on the blockchain. Make sure the patient has completed registration.");
            } else {
                setError("Upload failed: " + msg);
            }
        } finally {
            setUploadLoading(false);
            setTimeout(() => setUploadStep(null), 3000);
        }
    };

    // Search patient records
    const handleSearch = async () => {
        if (!validateAddress(searchAddress, "patient")) return;

        setSearchLoading(true);
        setError(null);
        setDecryptedMap({});
        try {
            const recs = await getPatientRecords(account.signer, searchAddress);
            setRecords(recs);
            if (recs.length === 0) {
                setError("No medical records found or you do not have access to this patient.");
            }
        } catch (err) {
            setRecords([]);
            setError(err.reason || err.message || "Failed to retrieve medical records.");
        } finally {
            setSearchLoading(false);
        }
    };

    // Decrypt a record
    const handleDecrypt = async (cid, fileType) => {
        if (!privateKey) {
            setError("Private key is not available. Please import it first.");
            return;
        }
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
        } catch (err) {
            setError("Decryption failed: " + (err.message || err));
        }
    };

    const handleImportKey = async () => {
        const key = keyInput.trim();
        if (key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
            setError("Private key must be 64 hexadecimal characters.");
            return;
        }
        try {
            const { privateKeyToPublicKey } = await import("../services/crypto");
            const derivedPubKey = privateKeyToPublicKey(key);
            const onChainPubKey = await getBlockchainPublicKey(account.signer, account.address);
            if (!onChainPubKey || derivedPubKey !== onChainPubKey) {
                setError("This private key does not match your wallet.");
                return;
            }
            savePrivateKey(key);
            setKeyInput("");
        } catch (err) {
            setError("Key verification failed: " + (err.message || err));
        }
    };

    // Get current upload step index for progress bar
    const currentStepIndex = uploadStep
        ? UPLOAD_STEPS.findIndex((s) => s.key === uploadStep)
        : -1;

    const tabs = [
        { id: "upload", label: "Upload Medical Record", icon: "upload" },
        { id: "view", label: "View Medical Records", icon: "search" },
    ];

    const TabIcon = ({ type, size = 16 }) => type === "upload" ? (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
    ) : (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    );

    return (
        <Layout>
            {/* Private Key Status */}
            {!privateKey ? (
                <div style={{ display:"flex",alignItems:"center",gap:"8px",padding:"12px 16px",borderRadius:"10px",background:"#fffbeb",border:"1px solid #fde68a",marginBottom:"24px",flexWrap:"wrap" }} className="animate-fade-in">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                    <span style={{ fontSize:"0.78rem",fontWeight:600,color:"#b45309",flex:1 }}>Private key not imported — encryption unavailable</span>
                    <div style={{ display:"flex",gap:"6px",alignItems:"center" }}>
                        <input type="password" value={keyInput} onChange={(e)=>setKeyInput(e.target.value)} placeholder="Paste key..." className="input-field" style={{ width:"200px",fontSize:"0.75rem",padding:"6px 10px" }}/>
                        <button onClick={handleImportKey} className="btn btn-primary" style={{ fontSize:"0.75rem",padding:"6px 14px" }}>Import</button>
                    </div>
                </div>
            ) : (
                <div style={{ marginBottom:"24px",textAlign:"center" }}>
                    <span style={{ display:"inline-flex",alignItems:"center",gap:"6px",padding:"6px 16px",borderRadius:"20px",fontSize:"0.72rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Private Key Active
                    </span>
                </div>
            )}

            {/* Tab Navigation */}
            <div style={{ display:"flex",gap:"4px",marginBottom:"28px",background:"#f1f5f9",padding:"4px",borderRadius:"12px",maxWidth:"500px",margin:"0 auto 28px" }}>
                {tabs.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display:"flex",alignItems:"center",gap:"7px",padding:"10px 18px",borderRadius:"9px",fontSize:"0.82rem",fontWeight:600,border:"none",cursor:"pointer",transition:"all 0.2s ease",flex:"1 1 0",justifyContent:"center",background:activeTab===tab.id?"white":"transparent",color:activeTab===tab.id?"#0f172a":"#64748b",boxShadow:activeTab===tab.id?"0 1px 3px rgba(0,0,0,0.08)":"none" }}>
                        <TabIcon type={tab.icon} size={16}/><span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Upload Tab */}
            {activeTab === "upload" && (
                <div className="max-w-2xl mx-auto">
                    <h2 className="section-title">Upload Patient Medical Record</h2>

                    <div className="glass-card" style={{ padding:"28px" }}>
                        {/* Patient Address */}
                        <div style={{ marginBottom:"20px" }}>
                            <label style={{ display:"block",fontSize:"0.72rem",fontWeight:600,color:"#64748b",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.06em" }}>Patient Wallet Address</label>
                            <input
                                type="text"
                                value={patientAddress}
                                onChange={(e) => setPatientAddress(e.target.value)}
                                placeholder="0x..."
                                className="input-field"
                                style={{ borderColor: patientAddress && !isAddress(patientAddress) ? '#fca5a5' : undefined }}
                            />
                            {patientAddress && !isAddress(patientAddress) && (
                                <div style={{ display:"flex",alignItems:"center",gap:"5px",marginTop:"6px" }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                                    <span style={{ fontSize:"0.75rem",color:"#e11d48" }}>Invalid Ethereum address format</span>
                                </div>
                            )}
                        </div>

                        {/* File Picker */}
                        <div style={{ marginBottom:"20px" }}>
                            <label style={{ display:"block",fontSize:"0.72rem",fontWeight:600,color:"#64748b",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.06em" }}>Medical Record File</label>
                            
                            {/* File Picker — hidden when file is selected */}
                            {!filePreview && (
                                <div style={{ border:"2px dashed #e2e8f0",borderRadius:"14px",padding:"32px 16px",textAlign:"center",transition:"border-color 0.2s",cursor:"pointer" }} onMouseEnter={e=>e.currentTarget.style.borderColor='#93bbf5'} onMouseLeave={e=>e.currentTarget.style.borderColor='#e2e8f0'}>
                                    <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleFileSelect} className="hidden" id="file-upload" />
                                    <label htmlFor="file-upload" style={{ cursor:"pointer",display:"block" }}>
                                        <div style={{ width:"48px",height:"48px",borderRadius:"12px",background:"#eef5ff",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px" }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E7DDB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                                        </div>
                                        <p style={{ fontSize:"0.85rem",fontWeight:600,color:"#334155",marginBottom:"4px" }}>Click to select file</p>
                                        <p style={{ fontSize:"0.75rem",color:"#94a3b8" }}>JPEG, PNG, WebP, PDF — max 10MB</p>
                                    </label>
                                </div>
                            )}

                            {/* File Preview */}
                            {filePreview && (
                                <div style={{ padding:"16px",borderRadius:"12px",background:"#f8fafc",border:"1px solid #e2e8f0" }}>
                                    {filePreview.type === "image" ? (
                                        <div style={{ textAlign:"center" }}>
                                            <img src={filePreview.url} alt="Preview" style={{ maxHeight:"200px",maxWidth:"100%",borderRadius:"10px",border:"1px solid #e2e8f0",margin:"0 auto",display:"block" }} />
                                            <p style={{ fontSize:"0.72rem",color:"#94a3b8",marginTop:"8px" }}>{selectedFile?.name}</p>
                                        </div>
                                    ) : (
                                        <div style={{ display:"flex",alignItems:"center",gap:"12px" }}>
                                            <div style={{ width:"42px",height:"42px",borderRadius:"10px",background:"#fff1f2",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                                            </div>
                                            <div>
                                                <p style={{ fontSize:"0.85rem",fontWeight:600,color:"#0f172a" }}>{filePreview.name}</p>
                                                <p style={{ fontSize:"0.72rem",color:"#94a3b8" }}>{(filePreview.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ display:"flex",gap:"8px",marginTop:"12px",justifyContent:"center" }}>
                                        <button onClick={() => { setSelectedFile(null); setFilePreview(null); }} style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",gap:"5px",fontSize:"0.75rem",padding:"8px 18px",borderRadius:"8px",border:"1px solid #fecaca",background:"#fff5f5",color:"#dc2626",cursor:"pointer",fontWeight:500,lineHeight:1,minWidth:"110px",fontFamily:"inherit",textTransform:"none",letterSpacing:"normal" }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> Remove
                                        </button>
                                        <button onClick={() => document.getElementById('file-upload-replace').click()} style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",gap:"5px",fontSize:"0.75rem",padding:"8px 18px",borderRadius:"8px",border:"1px solid #bfdbfe",background:"#eff6ff",color:"#2563eb",cursor:"pointer",fontWeight:500,lineHeight:1,minWidth:"110px",fontFamily:"inherit",textTransform:"none",letterSpacing:"normal" }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg> Replace
                                        </button>
                                        <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleFileSelect} className="hidden" id="file-upload-replace" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Encryption Info */}
                        <div style={{ padding:"14px 16px",borderRadius:"12px",background:"#f0f7ff",border:"1px solid #bfdbfe",marginBottom:"20px" }}>
                            <p style={{ fontSize:"0.75rem",color:"#475569",lineHeight:"1.6",margin:0 }}>
                                <strong style={{ color:"#2E7DDB" }}>Encryption flow:</strong>{" "}
                                File → SHA-256(hash) → AES-256-CBC → Pinata (IPFS) → AES Key → ECIES(ECC PubKey Patient) → Blockchain
                            </p>
                        </div>

                        {/* Upload Progress Steps */}
                        {uploadStep && (
                            <div style={{ padding:"16px",borderRadius:"12px",background:"#f8fafc",border:"1px solid #e2e8f0",marginBottom:"24px" }}>
                                {UPLOAD_STEPS.map((step, i) => (
                                    <div key={step.key} style={{ display:"flex",alignItems:"center",gap:"10px",padding:"6px 0" }}>
                                        <span style={{ width:"20px",height:"20px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                                            {i < currentStepIndex || (i === currentStepIndex && uploadStep === "done")
                                                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                : i === currentStepIndex
                                                    ? <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2E7DDB" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                                    : <span style={{ width:"8px",height:"8px",borderRadius:"50%",background:"#e2e8f0",display:"block",margin:"0 auto" }}/>}
                                        </span>
                                        <span style={{ fontSize:"0.8rem",fontWeight: i <= currentStepIndex ? 500 : 400, color: i <= currentStepIndex ? "#0f172a" : "#94a3b8" }}>
                                            {step.label}
                                        </span>
                                    </div>
                                ))}
                                {/* Progress bar */}
                                <div style={{ width:"100%",background:"#e2e8f0",borderRadius:"99px",height:"6px",marginTop:"12px",overflow:"hidden" }}>
                                    <div
                                        style={{
                                            height:"100%",
                                            borderRadius:"99px",
                                            transition:"width 0.5s ease",
                                            width: `${((currentStepIndex + 1) / UPLOAD_STEPS.length) * 100}%`,
                                            background: "linear-gradient(90deg, #2E7DDB, #14b8a6)",
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Upload Button */}
                        <button
                            onClick={handleUpload}
                            disabled={uploadLoading || !selectedFile || !patientAddress}
                            className="btn btn-accent"
                            style={{ width:"100%",justifyContent:"center",padding:"13px 22px",fontSize:"0.88rem" }}
                        >
                            {uploadLoading
                                ? <><svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Processing...</>
                                : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Encrypt &amp; Upload to IPFS</>}
                        </button>
                    </div>

                    {/* Upload Success */}
                    {uploadSuccess && (
                        <div className="glass-card animate-fade-in" style={{ marginTop:"16px",padding:"20px",borderLeft:"3px solid #22c55e" }}>
                            <div style={{ display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px" }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                <span style={{ fontSize:"0.9rem",fontWeight:700,color:"#16a34a" }}>Upload Successful!</span>
                            </div>
                            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:"10px" }}>
                                <div><div style={{ fontSize:"0.68rem",fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"3px" }}>File</div><div style={{ fontSize:"0.8rem",color:"#1e293b",fontWeight:500 }}>{uploadSuccess.fileName}</div></div>
                                <div><div style={{ fontSize:"0.68rem",fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"3px" }}>CID</div><div className="mono" style={{ fontSize:"0.8rem",color:"#2E7DDB",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{uploadSuccess.cid}</div></div>
                                <div><div style={{ fontSize:"0.68rem",fontWeight:600,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"3px" }}>Status</div><div style={{ fontSize:"0.8rem",color:"#d97706",fontWeight:500 }}>PENDING (waiting for patient approval)</div></div>
                            </div>
                            {uploadSuccess.sha256 && (
                                <div style={{ marginTop:"12px",padding:"10px 12px",borderRadius:"8px",background:"#f0fdf4",border:"1px solid #bbf7d0" }}>
                                    <div style={{ fontSize:"0.65rem",fontWeight:700,color:"#16a34a",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"4px" }}>SHA-256 (original file integrity)</div>
                                    <div className="mono" style={{ fontSize:"0.72rem",color:"#166534",wordBreak:"break-all",lineHeight:1.5 }}>{uploadSuccess.sha256}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* View Tab */}
            {activeTab === "view" && (
                <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                    <h2 className="section-title" style={{ marginBottom: "20px" }}>View Patient Medical Records</h2>

                    {/* Search */}
                    <div className="glass-card" style={{ marginBottom: "24px", padding: "24px" }}>
                        <h3 style={{ fontSize: "0.88rem", fontWeight: 700, color: "#0f172a", marginBottom: "14px" }}>Search Patient Records</h3>
                        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            <input
                                type="text"
                                value={searchAddress}
                                onChange={(e) => setSearchAddress(e.target.value)}
                                placeholder="Patient wallet address (0x...)"
                                className="input-field"
                                style={{ flex: "1 1 200px", minWidth: 0 }}
                            />
                            <button
                                onClick={handleSearch}
                                disabled={searchLoading || !searchAddress}
                                className="btn btn-primary"
                                style={{ flex:"0 0 auto",fontSize:"0.82rem" }}
                            >
                                {searchLoading
                                    ? <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                    : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Search</>}
                            </button>
                        </div>
                        {searchAddress && !isAddress(searchAddress) && (
                            <div style={{ display:"flex",alignItems:"center",gap:"5px",marginTop:"8px" }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                                <span style={{ fontSize:"0.75rem",color:"#e11d48" }}>Invalid Ethereum address format</span>
                            </div>
                        )}
                    </div>

                    {/* Records */}
                    {records.length > 0 && (
                        <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                                <h3 className="section-title" style={{ marginBottom: 0 }}>
                                    Medical Records
                                </h3>
                                <span className="badge badge-patient">
                                    {records.length} record{records.length > 1 ? "s" : ""}
                                </span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                {records.map((rec, i) => (
                                    <RecordCard
                                        key={i}
                                        record={rec}
                                        onDecrypt={() => handleDecrypt(rec.cid, rec.fileType)}
                                        decryptedData={decryptedMap[rec.cid]}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty */}
                    {!searchLoading && records.length === 0 && searchAddress && (
                        <div className="glass-card" style={{ textAlign:"center",padding:"48px 24px" }}>
                            <div style={{ margin:"0 auto 16px",opacity:0.4 }}>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </div>
                            <p style={{ fontSize:"0.88rem",color:"#64748b",fontWeight:500 }}>No medical records available</p>
                            <p style={{ fontSize:"0.75rem",color:"#94a3b8",marginTop:"4px" }}>This patient has no approved records or you don't have access.</p>
                        </div>
                    )}
                </div>
            )}
        </Layout>
    );
}
