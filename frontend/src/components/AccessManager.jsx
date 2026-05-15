// components/AccessManager.jsx

import { useState, useEffect, useRef } from "react";
import { isAddress } from "ethers";
import { useWallet } from "../context/WalletContext";
import ConfirmDialog from "./ConfirmDialog";
import {
    grantAccess, revokeAccess, getAuthorizedDoctors,
    getEncryptedKey, getPublicKey, getMyCids,
    getMyRecords, getPendingRecords,
} from "../services/blockchain";
import {
    decryptWithPrivateKey, encryptWithPublicKey,
    deserializeEncrypted, serializeEncrypted,
} from "../services/crypto";

const Ico = ({ d, size = 14, color = "currentColor", fill = "none", sw = 2 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        {d}
    </svg>
);

const IconLoader = ({ size = 14 }) => (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
);

export default function AccessManager() {
    const { account, privateKey, setError } = useWallet();

    // Grant form state
    const [doctorDropOpen, setDoctorDropOpen] = useState(false);
    const [doctorAddress, setDoctorAddress] = useState("");
    const [manualInput, setManualInput] = useState(false);
    const [manualAddress, setManualAddress] = useState("");
    const [knownDoctors, setKnownDoctors] = useState([]);

    // Record selection state
    const [cidDropdownOpen, setCidDropdownOpen] = useState(false);
    const [selectedCids, setSelectedCids] = useState(new Set());
    const [cids, setCids] = useState([]);
    const [cidDetailsMap, setCidDetailsMap] = useState({});

    // Revoke state
    const [doctors, setDoctors] = useState([]);
    const [revokeTarget, setRevokeTarget] = useState("");

    // Loading
    const [loading, setLoading] = useState(false);
    const [grantLoading, setGrantLoading] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState(null);

    const doctorDropRef = useRef(null);
    const cidDropdownRef = useRef(null);

    useEffect(() => { if (account) loadData(); }, [account]);

    // Close dropdowns on outside click
    useEffect(() => {
        const h = (e) => {
            if (doctorDropRef.current && !doctorDropRef.current.contains(e.target)) setDoctorDropOpen(false);
            if (cidDropdownRef.current && !cidDropdownRef.current.contains(e.target)) setCidDropdownOpen(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

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
            setDoctors([...new Set(doctorList)]);
            setSelectedCids(new Set());
            const allDoctors = [...new Set([
                ...approvedRecs.map(r => r.doctorAddress),
                ...pendingRecs.map(r => r.doctorAddress),
            ].filter(Boolean))];
            setKnownDoctors(allDoctors);
            const dm = {};
            for (const r of approvedRecs) {
                if (r.cid) dm[r.cid] = { fileName: r.fileName, fileType: r.fileType, timestamp: r.timestamp };
            }
            setCidDetailsMap(dm);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const effectiveDoctorAddress = manualInput ? manualAddress.trim() : doctorAddress;
    const addressValid = manualInput ? (!manualAddress || isAddress(manualAddress)) : true;

    const toggleCid = (cid) => setSelectedCids(prev => { const n = new Set(prev); n.has(cid) ? n.delete(cid) : n.add(cid); return n; });
    const toggleAll = () => setSelectedCids(prev => prev.size === cids.length ? new Set() : new Set(cids));

    const handleGrant = async () => {
        if (!effectiveDoctorAddress || selectedCids.size === 0 || !privateKey) {
            setError("Select a doctor, select at least one record, and ensure private key is imported.");
            return;
        }
        if (!isAddress(effectiveDoctorAddress)) { setError("Invalid Ethereum address."); return; }
        setGrantLoading(true); setError(null);
        try {
            const doctorPubKey = await getPublicKey(account.signer, effectiveDoctorAddress);
            for (const cid of selectedCids) {
                const myEncKey = deserializeEncrypted(await getEncryptedKey(account.signer, cid));
                const aesKeyHex = await decryptWithPrivateKey(privateKey, myEncKey);
                const encForDoctor = serializeEncrypted(await encryptWithPublicKey(doctorPubKey, aesKeyHex));
                await grantAccess(account.signer, effectiveDoctorAddress, cid, encForDoctor);
            }
            setDoctorAddress(""); setManualAddress(""); setManualInput(false);
            await loadData();
        } catch (err) { setError(err.message || "Failed to grant access."); }
        finally { setGrantLoading(false); }
    };

    const handleRevoke = (doctor) => {
        setConfirmDialog({
            title: "Revoke Doctor Access",
            message: "This doctor will immediately lose access to all your medical records.",
            confirmLabel: "Revoke Access",
            variant: "danger",
            details: [{ label: "Doctor", value: doctor, mono: true }],
            onConfirm: async () => {
                setConfirmDialog(null);
                try { await revokeAccess(account.signer, doctor); setRevokeTarget(""); await loadData(); }
                catch (err) { setError(err.message || "Failed to revoke access."); }
            },
        });
    };

    const short = (a) => `${a.slice(0, 8)}...${a.slice(-6)}`;

    // ── helpers for file icons ──────────────────────────────────
    const FileIcon = ({ fileType, size = 15, color }) => {
        const c = color || (fileType?.startsWith("image/") ? "#2E7DDB" : fileType === "application/pdf" ? "#e11d48" : "#94a3b8");
        if (fileType?.startsWith("image/")) return <Ico size={size} color={c} d={<><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></>}/>;
        return <Ico size={size} color={c} d={<><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></>}/>;
    };

    const Label = ({ children }) => (
        <div style={{ fontSize:"0.68rem",fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"7px" }}>{children}</div>
    );

    return (
        <div style={{ display:"flex",flexDirection:"column",gap:"16px" }}>
            <ConfirmDialog
                isOpen={!!confirmDialog} title={confirmDialog?.title||""} message={confirmDialog?.message||""}
                details={confirmDialog?.details} confirmLabel={confirmDialog?.confirmLabel}
                variant={confirmDialog?.variant} onConfirm={confirmDialog?.onConfirm||(()=>{})} onCancel={()=>setConfirmDialog(null)}
            />

            {/* ── GRANT ACCESS ────────────────────────────────── */}
            <div className="glass-card" style={{ padding:"24px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"20px" }}>
                    <div style={{ width:"34px",height:"34px",borderRadius:"10px",background:"#eef5ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                        <Ico size={16} color="#2E7DDB" d={<><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>}/>
                    </div>
                    <div>
                        <h3 style={{ fontSize:"0.95rem",fontWeight:700,color:"#0f172a",margin:0 }}>Grant Access to Doctor</h3>
                        <p style={{ fontSize:"0.72rem",color:"#94a3b8",margin:0 }}>Share selected records with a specific doctor</p>
                    </div>
                </div>

                <div style={{ display:"flex",flexDirection:"column",gap:"14px" }}>

                    {/* Doctor picker */}
                    <div ref={doctorDropRef} style={{ position:"relative" }}>
                        <Label>Doctor</Label>
                        {!manualInput ? (
                            <>
                                <button type="button" onClick={() => setDoctorDropOpen(o => !o)}
                                    style={{ width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 13px",borderRadius:"10px",border:`1.5px solid ${doctorDropOpen?"#2E7DDB":"#e2e8f0"}`,background:"white",cursor:"pointer",fontFamily:"inherit",transition:"border 0.15s",textAlign:"left" }}>
                                    <span style={{ fontSize:"0.85rem",color:doctorAddress?"#0f172a":"#94a3b8",fontWeight:doctorAddress?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1 }}>
                                        {doctorAddress ? short(doctorAddress) : "— Select a doctor —"}
                                    </span>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform:doctorDropOpen?"rotate(180deg)":"none",transition:"transform 0.2s",flexShrink:0,marginLeft:"8px" }}><polyline points="6 9 12 15 18 9"/></svg>
                                </button>

                                {doctorDropOpen && (
                                    <div style={{ position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:200,background:"white",borderRadius:"12px",border:"1.5px solid #e2e8f0",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",overflow:"hidden" }}>
                                        {knownDoctors.length === 0 ? (
                                            <div style={{ padding:"14px 16px",fontSize:"0.82rem",color:"#94a3b8",textAlign:"center" }}>No known doctors yet</div>
                                        ) : knownDoctors.map((addr, i) => (
                                            <div key={i} onClick={() => { setDoctorAddress(addr); setDoctorDropOpen(false); }}
                                                style={{ display:"flex",alignItems:"center",gap:"10px",padding:"11px 14px",cursor:"pointer",background:doctorAddress===addr?"#eef5ff":"white",borderBottom:"1px solid #f8fafc",transition:"background 0.1s" }}
                                                onMouseEnter={e=>{ if(doctorAddress!==addr) e.currentTarget.style.background="#f8fafc"; }}
                                                onMouseLeave={e=>{ e.currentTarget.style.background=doctorAddress===addr?"#eef5ff":"white"; }}>
                                                <div style={{ width:"30px",height:"30px",borderRadius:"8px",background:"#f0fdf9",border:"1px solid #99f6e4",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                                                    <Ico size={14} color="#0d9488" d={<><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></>}/>
                                                </div>
                                                <div style={{ flex:1,minWidth:0 }}>
                                                    <div style={{ fontSize:"0.8rem",fontWeight:600,color:doctorAddress===addr?"#1e40af":"#334155",fontFamily:"monospace" }}>{short(addr)}</div>
                                                    <div style={{ fontSize:"0.64rem",color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"monospace" }}>{addr}</div>
                                                </div>
                                                {doctorAddress === addr && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E7DDB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                            </div>
                                        ))}
                                        <div onClick={() => { setManualInput(true); setDoctorDropOpen(false); }}
                                            style={{ display:"flex",alignItems:"center",gap:"8px",padding:"10px 14px",cursor:"pointer",borderTop:"1px solid #f1f5f9",color:"#2E7DDB",fontSize:"0.78rem",fontWeight:600 }}
                                            onMouseEnter={e=>e.currentTarget.style.background="#f0f7ff"}
                                            onMouseLeave={e=>e.currentTarget.style.background="white"}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                                            Enter address manually...
                                        </div>
                                    </div>
                                )}

                                {doctorAddress && (
                                    <div style={{ marginTop:"6px",padding:"5px 10px",borderRadius:"8px",background:"#f0fdf9",border:"1px solid #99f6e4",display:"flex",alignItems:"center",gap:"6px" }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        <span style={{ fontFamily:"monospace",fontSize:"0.68rem",color:"#0d9488",wordBreak:"break-all" }}>{doctorAddress}</span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <button type="button" onClick={() => { setManualInput(false); setManualAddress(""); }}
                                    style={{ fontSize:"0.72rem",color:"#2E7DDB",background:"none",border:"none",cursor:"pointer",padding:"0 0 6px",fontFamily:"inherit",display:"flex",alignItems:"center",gap:"4px" }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                                    Back to list
                                </button>
                                <input type="text" value={manualAddress} onChange={e => setManualAddress(e.target.value)} placeholder="0x..." className="input-field" autoFocus
                                    style={{ borderColor: manualAddress && !isAddress(manualAddress) ? "#fca5a5" : undefined, background: manualAddress && !isAddress(manualAddress) ? "#fff1f2" : undefined }}/>
                                {manualAddress && !isAddress(manualAddress) && (
                                    <div style={{ display:"flex",alignItems:"center",gap:"5px",marginTop:"5px" }}>
                                        <Ico size={12} color="#e11d48" d={<><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></>}/>
                                        <span style={{ fontSize:"0.72rem",color:"#e11d48" }}>Invalid Ethereum address</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Record picker */}
                    <div ref={cidDropdownRef} style={{ position:"relative" }}>
                        <Label>Medical Records</Label>
                        {cids.length === 0 ? (
                            <div style={{ padding:"10px 13px",borderRadius:"10px",background:"#f8fafc",border:"1.5px solid #e2e8f0",color:"#94a3b8",fontSize:"0.82rem" }}>No approved records yet</div>
                        ) : (
                            <>
                                <button type="button" onClick={() => setCidDropdownOpen(o => !o)}
                                    style={{ width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 13px",borderRadius:"10px",border:`1.5px solid ${cidDropdownOpen?"#2E7DDB":"#e2e8f0"}`,background:"white",cursor:"pointer",fontFamily:"inherit",transition:"border 0.15s" }}>
                                    <span style={{ fontSize:"0.85rem",color:selectedCids.size===0?"#94a3b8":"#0f172a",fontWeight:selectedCids.size>0?600:400,flex:1 }}>
                                        {selectedCids.size===0 ? "— Select records —" : selectedCids.size===cids.length ? `All ${cids.length} records` : `${selectedCids.size} of ${cids.length} records`}
                                    </span>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform:cidDropdownOpen?"rotate(180deg)":"none",transition:"transform 0.2s",flexShrink:0 }}><polyline points="6 9 12 15 18 9"/></svg>
                                </button>

                                {cidDropdownOpen && (
                                    <div style={{ position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:100,background:"white",borderRadius:"12px",border:"1.5px solid #e2e8f0",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",overflow:"hidden" }}>
                                        <div style={{ padding:"9px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                                            <span style={{ fontSize:"0.7rem",fontWeight:600,color:"#64748b" }}>{selectedCids.size} of {cids.length} selected</span>
                                            <button type="button" onClick={toggleAll} style={{ fontSize:"0.7rem",fontWeight:700,color:"#2E7DDB",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"inherit" }}>
                                                {selectedCids.size===cids.length?"Deselect All":"Select All"}
                                            </button>
                                        </div>
                                        <div style={{ maxHeight:"260px",overflowY:"auto" }}>
                                            {cids.map((cid, i) => {
                                                const checked = selectedCids.has(cid);
                                                const d = cidDetailsMap[cid];
                                                return (
                                                    <div key={i} onClick={() => toggleCid(cid)}
                                                        style={{ display:"flex",alignItems:"center",gap:"11px",padding:"10px 14px",cursor:"pointer",background:checked?"#f0f7ff":"white",borderBottom:"1px solid #f8fafc",transition:"background 0.1s" }}
                                                        onMouseEnter={e=>{ if(!checked) e.currentTarget.style.background="#f8fafc"; }}
                                                        onMouseLeave={e=>{ e.currentTarget.style.background=checked?"#f0f7ff":"white"; }}>
                                                        <div style={{ width:"16px",height:"16px",borderRadius:"4px",border:`2px solid ${checked?"#2E7DDB":"#cbd5e1"}`,background:checked?"#2E7DDB":"white",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.12s" }}>
                                                            {checked && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                                        </div>
                                                        <div style={{ width:"30px",height:"30px",borderRadius:"7px",background:d?.fileType?.startsWith("image/")?"#eff6ff":d?.fileType==="application/pdf"?"#fff1f2":"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                                                            <FileIcon fileType={d?.fileType}/>
                                                        </div>
                                                        <div style={{ minWidth:0,flex:1 }}>
                                                            <div style={{ fontSize:"0.8rem",fontWeight:600,color:checked?"#1e40af":"#334155",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                                                                {d?.fileName||`Record #${i+1}`}
                                                            </div>
                                                            <div style={{ fontSize:"0.65rem",color:"#94a3b8",marginTop:"1px" }}>
                                                                {d?.fileType}{d?.timestamp?` · ${new Date(d.timestamp*1000).toLocaleDateString("en-US",{day:"numeric",month:"short",year:"numeric"})}` : ""}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {selectedCids.size > 0 && (
                            <p style={{ fontSize:"0.68rem",color:"#64748b",marginTop:"5px" }}>
                                {selectedCids.size} record{selectedCids.size>1?"s":""} · {selectedCids.size} blockchain transaction{selectedCids.size>1?"s":""}
                            </p>
                        )}
                    </div>

                    {/* Note */}
                    <div style={{ display:"flex",gap:"8px",padding:"10px 13px",borderRadius:"10px",background:"#fffbeb",border:"1px solid #fde68a" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0,marginTop:"1px" }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                        <span style={{ fontSize:"0.7rem",color:"#92400e",lineHeight:1.5 }}>Doctor can <em>see metadata</em> of all approved records, but can only <em>decrypt</em> the records you select.</span>
                    </div>

                    {/* Grant button */}
                    <div style={{ display:"flex",justifyContent:"flex-end" }}>
                        <button onClick={handleGrant} disabled={grantLoading || !effectiveDoctorAddress || selectedCids.size===0 || !addressValid} className="btn btn-primary"
                            style={{ fontSize:"0.85rem",padding:"10px 24px" }}>
                            {grantLoading
                                ? <><IconLoader size={14}/> Encrypting...</>
                                : <><Ico size={14} color="currentColor" d={<><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>}/> Grant Access{selectedCids.size>1?` (${selectedCids.size})`:""}
                                </>
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* ── ACTIVE DOCTORS / REVOKE ─────────────────────── */}
            <div className="glass-card" style={{ padding:"24px" }}>
                <div style={{ display:"flex",alignItems:"center",gap:"10px",marginBottom:"18px" }}>
                    <div style={{ width:"34px",height:"34px",borderRadius:"10px",background:"#fff5f5",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                        <Ico size={16} color="#dc2626" d={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="8" y2="13"/></>}/>
                    </div>
                    <div style={{ flex:1 }}>
                        <h3 style={{ fontSize:"0.95rem",fontWeight:700,color:"#0f172a",margin:0 }}>Doctors with Active Access</h3>
                        <p style={{ fontSize:"0.72rem",color:"#94a3b8",margin:0 }}>Click a doctor to select, then revoke</p>
                    </div>
                    {!loading && doctors.length > 0 && (
                        <span style={{ fontSize:"0.7rem",fontWeight:700,padding:"3px 10px",borderRadius:"20px",background:"#f0fdf9",color:"#0d9488",border:"1px solid #99f6e4",flexShrink:0 }}>
                            {doctors.length} active
                        </span>
                    )}
                </div>

                {loading ? (
                    <div style={{ display:"flex",alignItems:"center",gap:"8px",padding:"16px 0",color:"#64748b",fontSize:"0.82rem" }}>
                        <IconLoader size={15}/> Loading...
                    </div>
                ) : doctors.length === 0 ? (
                    <div style={{ textAlign:"center",padding:"28px 16px" }}>
                        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin:"0 auto 10px",display:"block" }}>
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <p style={{ fontSize:"0.82rem",color:"#94a3b8",margin:0 }}>No doctors have been granted access yet</p>
                    </div>
                ) : (
                    <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
                        {doctors.map(doc => {
                            const sel = revokeTarget === doc;
                            return (
                                <div key={doc} onClick={() => setRevokeTarget(sel ? "" : doc)}
                                    style={{ display:"flex",alignItems:"center",gap:"12px",padding:"11px 14px",borderRadius:"10px",border:`1.5px solid ${sel?"#fca5a5":"#e2e8f0"}`,background:sel?"#fff5f5":"#f8fafc",cursor:"pointer",transition:"all 0.15s",userSelect:"none" }}>
                                    <div style={{ width:"32px",height:"32px",borderRadius:"8px",background:sel?"#fee2e2":"#f0fdf9",border:`1px solid ${sel?"#fca5a5":"#99f6e4"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s" }}>
                                        <Ico size={15} color={sel?"#dc2626":"#0d9488"} d={<><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></>}/>
                                    </div>
                                    <div style={{ flex:1,minWidth:0 }}>
                                        <div style={{ fontSize:"0.8rem",fontWeight:600,color:sel?"#dc2626":"#334155",fontFamily:"monospace" }}>{short(doc)}</div>
                                        <div style={{ fontSize:"0.63rem",color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"monospace",marginTop:"1px" }}>{doc}</div>
                                    </div>
                                    <span style={{ fontSize:"0.65rem",fontWeight:700,padding:"2px 8px",borderRadius:"7px",background:sel?"#fee2e2":"#f0fdf4",color:sel?"#dc2626":"#16a34a",border:`1px solid ${sel?"#fca5a5":"#bbf7d0"}`,flexShrink:0 }}>
                                        {sel?"Selected":"Active"}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Revoke action panel */}
                        <div style={{ marginTop:"6px",padding:"13px 16px",borderRadius:"10px",border:`1.5px solid ${revokeTarget?"#fecaca":"#f1f5f9"}`,background:revokeTarget?"#fff5f5":"#f8fafc",transition:"all 0.2s",minHeight:"52px",display:"flex",alignItems:"center" }}>
                            {revokeTarget ? (
                                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",width:"100%",flexWrap:"wrap" }}>
                                    <div>
                                        <div style={{ fontSize:"0.68rem",fontWeight:700,color:"#dc2626",textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:"2px" }}>Revoke access for</div>
                                        <div style={{ fontSize:"0.78rem",color:"#7f1d1d",fontWeight:600,fontFamily:"monospace" }}>{short(revokeTarget)}</div>
                                    </div>
                                    <button onClick={() => handleRevoke(revokeTarget)} className="btn btn-danger" style={{ fontSize:"0.8rem",padding:"8px 18px",flexShrink:0 }}>
                                        <Ico size={13} color="white" d={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="8" y2="13"/></>}/> Revoke Access
                                    </button>
                                </div>
                            ) : (
                                <p style={{ fontSize:"0.75rem",color:"#94a3b8",margin:0,textAlign:"center",width:"100%" }}>Select a doctor above to revoke their access</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
