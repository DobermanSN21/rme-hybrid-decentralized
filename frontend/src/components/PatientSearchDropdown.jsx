// components/PatientSearchDropdown.jsx
// Reusable searchable patient dropdown with name + address

import { useState, useEffect, useRef } from "react";
import { isAddress } from "ethers";

export default function PatientSearchDropdown({ patientList = [], listLoading = false, onSelect }) {
    const [query, setQuery] = useState("");
    const [dropOpen, setDropOpen] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [manualMode, setManualMode] = useState(false);
    const [manualAddr, setManualAddr] = useState("");
    const dropRef = useRef(null);

    useEffect(() => {
        const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const filtered = patientList.filter(p =>
        !query ||
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.address.toLowerCase().includes(query.toLowerCase())
    );

    const handleSelect = (p) => {
        setSelectedPatient(p);
        setQuery(p.name || `${p.address.slice(0, 8)}...`);
        setDropOpen(false);
        onSelect(p.address);
    };

    const handleClear = () => {
        setQuery(""); setSelectedPatient(null); setDropOpen(false); onSelect("");
    };

    if (manualMode) {
        return (
            <div>
                <button type="button"
                    onClick={() => { setManualMode(false); setManualAddr(""); onSelect(""); }}
                    style={{ fontSize:"0.72rem",color:"#2E7DDB",background:"none",border:"none",cursor:"pointer",padding:"0 0 8px",fontFamily:"inherit",display:"flex",alignItems:"center",gap:"4px" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    Kembali ke pencarian nama
                </button>
                <input type="text" value={manualAddr}
                    onChange={e => { setManualAddr(e.target.value); onSelect(e.target.value); }}
                    placeholder="0x..." className="input-field" autoFocus
                    style={{ borderColor: manualAddr && !isAddress(manualAddr) ? "#fca5a5" : undefined }} />
                {manualAddr && !isAddress(manualAddr) && (
                    <div style={{ display:"flex",alignItems:"center",gap:"5px",marginTop:"6px" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                        <span style={{ fontSize:"0.75rem",color:"#e11d48" }}>Format alamat tidak valid</span>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div ref={dropRef} style={{ position:"relative" }}>
            <div style={{ position:"relative" }}>
                <div style={{ position:"absolute",left:"11px",top:"50%",transform:"translateY(-50%)",pointerEvents:"none" }}>
                    {listLoading
                        ? <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    }
                </div>
                <input type="text" value={query}
                    onChange={e => { setQuery(e.target.value); setDropOpen(true); setSelectedPatient(null); onSelect(""); }}
                    onFocus={() => setDropOpen(true)}
                    placeholder="Ketik nama pasien..."
                    className="input-field"
                    style={{ paddingLeft:"34px" }} />
                {query && (
                    <button type="button" onClick={handleClear}
                        style={{ position:"absolute",right:"10px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8",padding:"2px",display:"flex",alignItems:"center" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                )}
            </div>

            {dropOpen && (
                <div style={{ position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:200,background:"white",borderRadius:"12px",border:"1.5px solid #e2e8f0",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",overflow:"hidden",maxHeight:"240px",overflowY:"auto" }}>
                    {listLoading ? (
                        <div style={{ padding:"16px",textAlign:"center",color:"#94a3b8",fontSize:"0.82rem",display:"flex",alignItems:"center",gap:"8px",justifyContent:"center" }}>
                            <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                            Memuat daftar pasien...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding:"16px",textAlign:"center",color:"#94a3b8",fontSize:"0.82rem" }}>
                            {query ? `Tidak ditemukan: "${query}"` : "Belum ada pasien terdaftar"}
                        </div>
                    ) : filtered.map((p, i) => {
                        const sel = selectedPatient?.address === p.address;
                        return (
                            <div key={i} onClick={() => handleSelect(p)}
                                style={{ display:"flex",alignItems:"center",gap:"12px",padding:"11px 14px",cursor:"pointer",background:sel?"#eff6ff":"white",borderBottom:"1px solid #f8fafc",transition:"background 0.1s" }}
                                onMouseEnter={e=>{ if(!sel) e.currentTarget.style.background="#f8fafc"; }}
                                onMouseLeave={e=>{ e.currentTarget.style.background=sel?"#eff6ff":"white"; }}>
                                <div style={{ width:"32px",height:"32px",borderRadius:"8px",background:sel?"#dbeafe":"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={sel?"#2563eb":"#64748b"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                </div>
                                <div style={{ flex:1,minWidth:0 }}>
                                    <div style={{ fontSize:"0.82rem",fontWeight:600,color:sel?"#1e40af":"#334155" }}>{p.name || "—"}</div>
                                    <div style={{ fontSize:"0.63rem",color:"#94a3b8",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:"1px" }}>{p.address}</div>
                                </div>
                                {sel && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedPatient && (
                <div style={{ marginTop:"6px",display:"flex",alignItems:"center",gap:"8px",padding:"7px 11px",borderRadius:"9px",background:"#eff6ff",border:"1px solid #bfdbfe" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span style={{ fontSize:"0.75rem",fontWeight:600,color:"#1e40af" }}>{selectedPatient.name}</span>
                    <span style={{ fontFamily:"monospace",fontSize:"0.63rem",color:"#64748b" }}>
                        {selectedPatient.address.slice(0,8)}...{selectedPatient.address.slice(-6)}
                    </span>
                </div>
            )}

            <button type="button" onClick={() => setManualMode(true)}
                style={{ marginTop:"6px",background:"none",border:"none",fontSize:"0.7rem",color:"#94a3b8",cursor:"pointer",padding:0,fontFamily:"inherit",display:"flex",alignItems:"center",gap:"4px" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                Masukkan alamat wallet secara manual
            </button>
        </div>
    );
}
