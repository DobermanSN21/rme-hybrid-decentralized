// components/AccessManager.jsx
// ============================================================
// Grant/Revoke doctor access + list authorized doctors
// ============================================================

import { useState, useEffect } from "react";
import { isAddress } from "ethers";
import { useWallet } from "../context/WalletContext";
import ConfirmDialog from "./ConfirmDialog";
import {
    grantAccess,
    revokeAccess,
    getAuthorizedDoctors,
    getEncryptedKey,
    getPublicKey,
    getMyCids,
    getMyRecords,
    getPendingRecords,
} from "../services/blockchain";
import {
    decryptWithPrivateKey,
    encryptWithPublicKey,
    deserializeEncrypted,
    serializeEncrypted,
} from "../services/crypto";

// SVG Icons
const IconSend = ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
    </svg>
);

const IconShieldOff = ({ size = 14, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m2 2 20 20" /><path d="M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67.01c2.35-.82 4.48-2.34 5.86-4.54" />
        <path d="M9.3 3.18A1 1 0 0 1 10 3h4a1 1 0 0 1 .7.3l3.65 3.52a1 1 0 0 1 .3.7V13" />
    </svg>
);

const IconStethoscope = ({ size = 16, color = "#0d9488" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
        <path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4" />
        <circle cx="20" cy="10" r="2" />
    </svg>
);

const IconUserX = ({ size = 16, color = "#e11d48" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="17" x2="22" y1="8" y2="13" /><line x1="22" x2="17" y1="8" y2="13" />
    </svg>
);

const IconLoader = ({ size = 14 }) => (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

const IconAlertCircle = ({ size = 14, color = "#e11d48" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
);

const IconUsersEmpty = ({ size = 48, color = "#cbd5e1" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

export default function AccessManager() {
    const { account, privateKey, setError } = useWallet();
    const [doctorAddress, setDoctorAddress] = useState("");
    const [manualInput, setManualInput] = useState(false);
    const [manualAddress, setManualAddress] = useState("");
    const [knownDoctors, setKnownDoctors] = useState([]);
    const [cidDetailsMap, setCidDetailsMap] = useState({}); // cid -> { fileName, fileType, doctorAddress, timestamp }
    const [selectedCids, setSelectedCids] = useState(new Set());
    const [cids, setCids] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [revokeTarget, setRevokeTarget] = useState("");
    const [loading, setLoading] = useState(false);
    const [grantLoading, setGrantLoading] = useState(false);

    // Confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState(null);

    // Load CIDs and authorized doctors
    useEffect(() => {
        if (!account) return;
        loadData();
    }, [account]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [cidList, doctorList, approvedRecs, pendingRecs] = await Promise.all([
                getMyCids(account.signer),
                getAuthorizedDoctors(account.signer),
                getMyRecords(account.signer),
                getPendingRecords(account.signer),
            ]);
            setCids(cidList);
            // Deduplicate — contract bug: revoking then re-granting pushes duplicate entries
            setDoctors([...new Set(doctorList)]);
            if (cidList.length > 0) setSelectedCids(new Set(cidList));
            // Collect unique doctor addresses from all records
            const allDoctors = [...new Set([
                ...approvedRecs.map(r => r.doctorAddress),
                ...pendingRecs.map(r => r.doctorAddress),
            ].filter(Boolean))];
            setKnownDoctors(allDoctors);

            // Build CID → record detail map for display
            const detailMap = {};
            for (const r of approvedRecs) {
                if (r.cid) detailMap[r.cid] = { fileName: r.fileName, fileType: r.fileType, doctorAddress: r.doctorAddress, timestamp: r.timestamp };
            }
            setCidDetailsMap(detailMap);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const toggleCid = (cid) => {
        setSelectedCids(prev => {
            const next = new Set(prev);
            next.has(cid) ? next.delete(cid) : next.add(cid);
            return next;
        });
    };

    const toggleAll = () => {
        setSelectedCids(prev => prev.size === cids.length ? new Set() : new Set(cids));
    };

    const effectiveDoctorAddress = manualInput ? manualAddress.trim() : doctorAddress;

    const handleGrant = async () => {
        if (!effectiveDoctorAddress || selectedCids.size === 0 || !privateKey) {
            setError("Please select a doctor, select at least one record, and ensure private key is imported.");
            return;
        }
        if (!isAddress(effectiveDoctorAddress)) {
            setError("Invalid doctor wallet address. Must be a valid Ethereum address (0x...).");
            return;
        }

        setGrantLoading(true);
        setError(null);
        try {
            // Get doctor's public key once (shared for all CIDs)
            const doctorPubKey = await getPublicKey(account.signer, effectiveDoctorAddress);

            // Grant access per CID
            for (const cid of selectedCids) {
                const myEncKeyStr = await getEncryptedKey(account.signer, cid);
                const myEncKey = deserializeEncrypted(myEncKeyStr);
                const aesKeyHex = await decryptWithPrivateKey(privateKey, myEncKey);
                const encKeyForDoctor = await encryptWithPublicKey(doctorPubKey, aesKeyHex);
                const serializedForDoctor = serializeEncrypted(encKeyForDoctor);
                await grantAccess(account.signer, effectiveDoctorAddress, cid, serializedForDoctor);
            }

            setDoctorAddress("");
            setManualAddress("");
            setManualInput(false);
            await loadData();
        } catch (err) {
            setError(err.message || "Failed to grant access.");
        } finally {
            setGrantLoading(false);
        }
    };

    const handleRevoke = (doctor) => {
        setConfirmDialog({
            title: "Revoke Doctor Access",
            message: `Are you sure you want to revoke access for doctor ${doctor.slice(0, 6)}...${doctor.slice(-4)}? They will no longer be able to view your medical records.`,
            confirmLabel: "Revoke Access",
            variant: "danger",
            onConfirm: async () => {
                setConfirmDialog(null);
                try {
                    await revokeAccess(account.signer, doctor);
                    setRevokeTarget("");
                    await loadData();
                } catch (err) {
                    setError(err.message || "Failed to revoke access.");
                }
            },
        });
    };

    const shortenAddr = (a) => `${a.slice(0, 6)}...${a.slice(-4)}`;

    const addressValid = manualInput
        ? (!manualAddress || isAddress(manualAddress))
        : true;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Confirmation Dialog */}
            <ConfirmDialog
                isOpen={!!confirmDialog}
                title={confirmDialog?.title || ""}
                message={confirmDialog?.message || ""}
                confirmLabel={confirmDialog?.confirmLabel}
                variant={confirmDialog?.variant}
                onConfirm={confirmDialog?.onConfirm || (() => {})}
                onCancel={() => setConfirmDialog(null)}
            />

            {/* Grant Access Form */}
            <div className="glass-card" style={{ padding: "24px" }}>
                <h3 className="section-title" style={{ marginBottom: "20px" }}>Grant Access to Doctor</h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Doctor Address — dropdown from known doctors */}
                    <div>
                        <label style={{ display:"block",fontSize:"0.72rem",fontWeight:600,color:"#64748b",marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.06em" }}>
                            Select Doctor
                        </label>

                        {!manualInput ? (
                            <>
                                <select
                                    value={doctorAddress}
                                    onChange={e => {
                                        if (e.target.value === "__manual__") {
                                            setManualInput(true);
                                            setDoctorAddress("");
                                        } else {
                                            setDoctorAddress(e.target.value);
                                        }
                                    }}
                                    style={{ width:"100%",padding:"10px 12px",borderRadius:"10px",border:"1.5px solid #e2e8f0",background:"white",fontSize:"0.85rem",color: doctorAddress ? "#0f172a" : "#94a3b8",fontFamily:"inherit",cursor:"pointer",appearance:"auto",outline:"none" }}
                                >
                                    <option value="">— Select a doctor —</option>
                                    {knownDoctors.map((addr, i) => (
                                        <option key={i} value={addr}>
                                            {addr.slice(0,10)}...{addr.slice(-8)}
                                        </option>
                                    ))}
                                    <option value="__manual__">✏️ Enter address manually...</option>
                                </select>
                                {/* Show full address of selected */}
                                {doctorAddress && isAddress(doctorAddress) && (
                                    <div style={{ marginTop:"6px",padding:"6px 10px",borderRadius:"8px",background:"#f0fdf9",border:"1px solid #99f6e4" }}>
                                        <span style={{ fontFamily:"monospace",fontSize:"0.7rem",color:"#0d9488",wordBreak:"break-all" }}>{doctorAddress}</span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div style={{ display:"flex",gap:"8px",alignItems:"center",marginBottom:"6px" }}>
                                    <button type="button" onClick={()=>{setManualInput(false);setManualAddress("");}} style={{ fontSize:"0.72rem",color:"#2E7DDB",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"inherit" }}>
                                        ← Back to list
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={manualAddress}
                                    onChange={e => setManualAddress(e.target.value)}
                                    placeholder="0x..."
                                    className="input-field"
                                    style={{ borderColor: manualAddress && !isAddress(manualAddress) ? "#fca5a5" : undefined, background: manualAddress && !isAddress(manualAddress) ? "#fff1f2" : undefined }}
                                    autoFocus
                                />
                                {manualAddress && !isAddress(manualAddress) && (
                                    <div style={{ display:"flex",alignItems:"center",gap:"5px",marginTop:"6px" }}>
                                        <IconAlertCircle size={13} color="#e11d48" />
                                        <span style={{ fontSize:"0.75rem",color:"#e11d48" }}>Invalid Ethereum address format</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* CID Selection — multi-select */}
                    <div>
                        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px" }}>
                            <label style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                Select Medical Records
                            </label>
                            {cids.length > 1 && (
                                <button type="button" onClick={toggleAll} style={{ fontSize:"0.72rem",fontWeight:600,color:"#2E7DDB",background:"none",border:"none",cursor:"pointer",padding:0 }}>
                                    {selectedCids.size === cids.length ? "Deselect All" : "Select All"}
                                </button>
                            )}
                        </div>
                        {cids.length === 0 ? (
                            <div style={{ padding: "12px 16px", borderRadius: "10px", background: "#f8fafc", border: "1.5px solid #e2e8f0", color: "#94a3b8", fontSize: "0.85rem" }}>
                                No approved medical records available
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {cids.map((cid, i) => {
                                    const checked = selectedCids.has(cid);
                                    const detail = cidDetailsMap[cid];
                                    const isImage = detail?.fileType?.startsWith("image/");
                                    const isPdf = detail?.fileType === "application/pdf";
                                    return (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => toggleCid(cid)}
                                            style={{
                                                display: "flex", alignItems: "center", gap: "12px",
                                                padding: "12px 14px", borderRadius: "10px",
                                                border: checked ? "2px solid #2E7DDB" : "1.5px solid #e2e8f0",
                                                background: checked ? "#eef5ff" : "white",
                                                cursor: "pointer", transition: "all 0.2s ease",
                                                textAlign: "left", width: "100%",
                                            }}
                                        >
                                            {/* Checkbox */}
                                            <div style={{ width:"18px",height:"18px",borderRadius:"5px",border:`2px solid ${checked?"#2E7DDB":"#cbd5e1"}`,background:checked?"#2E7DDB":"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s" }}>
                                                {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                            </div>
                                            {/* File type icon */}
                                            <div style={{ width:"34px",height:"34px",borderRadius:"8px",background:checked?(isImage?"#dbeafe":isPdf?"#fee2e2":"#dbeafe"):(isImage?"#f0f9ff":isPdf?"#fff1f2":"#f8fafc"),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                                                {isImage
                                                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={checked?"#2E7DDB":"#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                                                    : isPdf
                                                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={checked?"#e11d48":"#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                                                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={checked?"#2E7DDB":"#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                                                }
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: checked ? "#1e40af" : "#334155", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                                    {detail?.fileName || `Record #${i + 1}`}
                                                </div>
                                                <div style={{ display:"flex", gap:"8px", marginTop:"2px", flexWrap:"wrap" }}>
                                                    {detail?.fileType && (
                                                        <span style={{ fontSize:"0.67rem", color: checked ? "#2E7DDB" : "#94a3b8" }}>{detail.fileType}</span>
                                                    )}
                                                    {detail?.timestamp && (
                                                        <span style={{ fontSize:"0.67rem", color:"#94a3b8" }}>
                                                            {new Date(detail.timestamp * 1000).toLocaleDateString("en-US", { day:"numeric", month:"short", year:"numeric" })}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mono" style={{ fontSize:"0.65rem", color: checked ? "#93c5fd" : "#cbd5e1", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:"2px" }} title={cid}>
                                                    {cid}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {selectedCids.size > 0 && (
                            <p style={{ fontSize:"0.7rem",color:"#64748b",marginTop:"6px" }}>
                                {selectedCids.size} of {cids.length} record{cids.length > 1 ? "s" : ""} selected — doctor will need {selectedCids.size} transaction{selectedCids.size > 1 ? "s" : ""} to confirm
                            </p>
                        )}
                    </div>

                    {/* Info note */}
                    <div style={{ padding:"10px 14px",borderRadius:"10px",background:"#fffbeb",border:"1px solid #fde68a",fontSize:"0.72rem",color:"#92400e",lineHeight:1.5 }}>
                        <strong>Note:</strong> The doctor will be able to <em>see metadata</em> of all your approved records once access is granted, but can only <em>decrypt</em> the records you select above.
                    </div>

                    {/* Submit */}
                    <button
                        onClick={handleGrant}
                        disabled={grantLoading || !effectiveDoctorAddress || selectedCids.size === 0 || !addressValid}
                        className="btn btn-accent"
                        style={{
                            width: "100%", justifyContent: "center",
                            padding: "11px 22px", fontSize: "0.85rem",
                        }}
                    >
                        {grantLoading
                            ? <><IconLoader size={15} /> Encrypting & Submitting...</>
                            : <><IconSend size={15} /> Grant Access{selectedCids.size > 1 ? ` (${selectedCids.size} Records)` : ""}</>
                        }
                    </button>
                </div>
            </div>

            {/* Authorized Doctors — Revoke Section */}
            <div className="glass-card" style={{ padding: "24px" }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px",flexWrap:"wrap",gap:"8px" }}>
                    <h3 className="section-title" style={{ marginBottom:0 }}>Doctors with Active Access</h3>
                    {doctors.length > 0 && (
                        <span style={{ fontSize:"0.72rem",fontWeight:700,padding:"3px 10px",borderRadius:"20px",background:"#f0fdf9",color:"#0d9488",border:"1px solid #99f6e4" }}>
                            {doctors.length} active
                        </span>
                    )}
                </div>

                {loading && (
                    <div style={{ display:"flex",alignItems:"center",gap:"8px",padding:"12px 0" }}>
                        <IconLoader size={16} />
                        <span style={{ fontSize:"0.85rem",color:"#64748b" }}>Loading...</span>
                    </div>
                )}

                {!loading && doctors.length === 0 ? (
                    <div style={{ textAlign:"center",padding:"28px 16px" }}>
                        <div style={{ margin:"0 auto 12px",opacity:0.5 }}>
                            <IconUsersEmpty size={44} color="#cbd5e1" />
                        </div>
                        <p style={{ fontSize:"0.85rem",color:"#94a3b8" }}>No doctors have been granted access yet</p>
                    </div>
                ) : !loading && (
                    <>
                        {/* Doctor list (read-only, informational) */}
                        <div style={{ display:"flex",flexDirection:"column",gap:"6px",marginBottom:"20px" }}>
                            {doctors.map((doc, i) => (
                                <div key={i} style={{ display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",borderRadius:"10px",background:"#f8fafc",border:"1px solid #e2e8f0" }}>
                                    <div style={{ width:"30px",height:"30px",borderRadius:"8px",background:"#f0fdf9",border:"1px solid #99f6e4",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                                        <IconStethoscope size={15} color="#0d9488" />
                                    </div>
                                    <div style={{ flex:1,minWidth:0 }}>
                                        <span className="mono" style={{ fontSize:"0.78rem",color:"#334155",fontWeight:500 }}>{shortenAddr(doc)}</span>
                                        <div style={{ fontSize:"0.65rem",color:"#94a3b8",marginTop:"1px" }}>Authorized Doctor</div>
                                    </div>
                                    <span style={{ fontSize:"0.65rem",fontWeight:700,padding:"2px 8px",borderRadius:"10px",background:"#f0fdf4",color:"#16a34a",border:"1px solid #bbf7d0",flexShrink:0 }}>Active</span>
                                </div>
                            ))}
                        </div>

                        {/* Revoke via dropdown */}
                        <div style={{ padding:"16px",borderRadius:"12px",background:"#fff5f5",border:"1px solid #fecaca" }}>
                            <div style={{ fontSize:"0.72rem",fontWeight:700,color:"#dc2626",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"10px" }}>Revoke Access</div>
                            <div style={{ display:"flex",gap:"8px",flexWrap:"wrap" }}>
                                <select
                                    value={revokeTarget}
                                    onChange={e => setRevokeTarget(e.target.value)}
                                    style={{ flex:"1 1 200px",padding:"9px 12px",borderRadius:"9px",border:"1.5px solid #fca5a5",background:"white",fontSize:"0.82rem",color:"#334155",fontFamily:"inherit",cursor:"pointer",appearance:"auto" }}
                                >
                                    <option value="">— Select doctor to revoke —</option>
                                    {doctors.map((doc, i) => (
                                        <option key={i} value={doc}>{doc}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => revokeTarget && handleRevoke(revokeTarget)}
                                    disabled={!revokeTarget}
                                    className="btn btn-danger"
                                    style={{ fontSize:"0.82rem",padding:"9px 20px",flex:"0 0 auto" }}
                                >
                                    <IconUserX size={14} color="white" /> Revoke
                                </button>
                            </div>
                            <p style={{ fontSize:"0.7rem",color:"#b91c1c",marginTop:"8px" }}>
                                Warning: This revokes ALL record access for the selected doctor.
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
