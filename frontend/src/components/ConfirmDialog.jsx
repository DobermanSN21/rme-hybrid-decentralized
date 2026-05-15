// components/ConfirmDialog.jsx

export default function ConfirmDialog({
    isOpen, title, message, details,
    confirmLabel, cancelLabel, variant,
    onConfirm, onCancel,
}) {
    if (!isOpen) return null;

    const isDanger  = variant === "danger";
    const iconColor = isDanger ? "#dc2626" : "#16a34a";
    const iconBg    = isDanger ? "#fff5f5" : "#f0fdf4";
    const iconBorder= isDanger ? "#fecaca" : "#bbf7d0";
    const btnColor  = isDanger ? "#dc2626" : "#2563eb";

    return (
        <div
            style={{ position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(15,23,42,0.55)",backdropFilter:"blur(6px)",padding:"16px" }}
            onClick={onCancel}
        >
            <div
                style={{ background:"white",borderRadius:"20px",maxWidth:"460px",width:"100%",overflow:"hidden",boxShadow:"0 32px 64px rgba(0,0,0,0.22)" }}
                className="animate-fade-in"
                onClick={e => e.stopPropagation()}
            >
                {/* Icon + title header */}
                <div style={{ padding:"32px 28px 22px",textAlign:"center",borderBottom:"1px solid #f1f5f9" }}>
                    <div style={{ width:"60px",height:"60px",borderRadius:"50%",background:iconBg,border:`2px solid ${iconBorder}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px" }}>
                        {isDanger ? (
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                                <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
                            </svg>
                        ) : (
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
                                <path d="m9 12 2 2 4-4"/>
                            </svg>
                        )}
                    </div>
                    <h3 style={{ fontSize:"1.1rem",fontWeight:700,color:"#0f172a",margin:"0 0 10px" }}>{title}</h3>
                    <p style={{ fontSize:"0.83rem",color:"#64748b",lineHeight:1.6,margin:0 }}>{message}</p>
                </div>

                {/* Record details */}
                {details && details.length > 0 && (
                    <div style={{ padding:"18px 28px",background:"#f8fafc",borderBottom:"1px solid #f1f5f9" }}>
                        {details.map((item, i) => (
                            <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"12px",padding:"5px 0",borderBottom:i < details.length-1 ? "1px solid #f1f5f9":"none" }}>
                                <span style={{ fontSize:"0.68rem",fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em",flexShrink:0,paddingTop:"2px" }}>{item.label}</span>
                                <span style={{ fontSize:"0.78rem",color:"#1e293b",fontWeight:500,fontFamily:item.mono?"'JetBrains Mono','Fira Code',monospace":"inherit",textAlign:"right",wordBreak:"break-all",lineHeight:1.5 }}>{item.value}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Warning note for approve */}
                {!isDanger && (
                    <div style={{ padding:"12px 28px 0",display:"flex",alignItems:"center",gap:"8px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
                        <span style={{ fontSize:"0.72rem",color:"#92400e" }}>This action is permanent and recorded on the blockchain.</span>
                    </div>
                )}

                {/* Buttons */}
                <div style={{ padding:"20px 28px 24px",display:"flex",gap:"10px",justifyContent:"flex-end" }}>
                    <button
                        onClick={onCancel}
                        style={{ padding:"10px 22px",borderRadius:"10px",border:"1px solid #e2e8f0",background:"white",color:"#475569",fontSize:"0.85rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"background 0.15s" }}
                        onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                        onMouseLeave={e=>e.currentTarget.style.background="white"}
                    >
                        {cancelLabel || "Cancel"}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{ padding:"10px 26px",borderRadius:"10px",border:"none",background:btnColor,color:"white",fontSize:"0.85rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 4px 12px ${isDanger?"rgba(220,38,38,0.3)":"rgba(37,99,235,0.3)"}` }}
                    >
                        {confirmLabel || "Confirm"}
                    </button>
                </div>
            </div>
        </div>
    );
}
