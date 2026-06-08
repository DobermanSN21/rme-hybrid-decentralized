// components/QRScanModal.jsx
// QR scanner untuk dokter membaca wallet address pasien
// Mode 1: Kamera (live scan) — Mode 2: Upload gambar QR

import { useState, useRef, useEffect, useCallback } from "react";
import jsQR from "jsqr";

// ── Icons ────────────────────────────────────────────────────────────
const IconCamera = ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
        <circle cx="12" cy="13" r="3"/>
    </svg>
);

const IconUpload = ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" x2="12" y1="3" y2="15"/>
    </svg>
);

const IconX = ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
);

const IconCheck = ({ size = 16, color = "#16a34a" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
    </svg>
);

const IconLoader = ({ size = 16 }) => (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
);

const IconQR = ({ size = 22, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="6" height="6" x="3" y="3" rx="1"/>
        <rect width="6" height="6" x="15" y="3" rx="1"/>
        <rect width="6" height="6" x="3" y="15" rx="1"/>
        <path d="M15 15h.01M15 18h.01M18 15h.01M18 18h.01M21 15h.01M21 18h.01M21 21h.01M18 21h.01M15 21h.01"/>
    </svg>
);

// ── Decode QR dari ImageData menggunakan jsQR ────────────────────────
function decodeImageData(canvas, ctx, source, width, height) {
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(source, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    return jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
}

// ── Validasi wallet address Ethereum ────────────────────────────────
function isEthAddress(str) {
    return /^0x[0-9a-fA-F]{40}$/.test(str);
}

// ── Komponen utama ───────────────────────────────────────────────────
export default function QRScanModal({ isOpen, onClose, onScan }) {
    const [mode, setMode] = useState("upload"); // "camera" | "upload"
    const [error, setError] = useState("");
    const [scanning, setScanning] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const [uploadPreview, setUploadPreview] = useState(null);
    const [uploadResult, setUploadResult] = useState(null);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const rafRef = useRef(null);
    const fileInputRef = useRef(null);

    // ── Stop kamera ─────────────────────────────────────────────────
    const stopCamera = useCallback(() => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setCameraReady(false);
    }, []);

    // ── Scan frame dari kamera ───────────────────────────────────────
    const scanFrame = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
            rafRef.current = requestAnimationFrame(scanFrame);
            return;
        }
        const ctx = canvas.getContext("2d");
        const code = decodeImageData(canvas, ctx, video, video.videoWidth, video.videoHeight);
        if (code) {
            if (isEthAddress(code.data)) {
                stopCamera();
                onScan(code.data);
                onClose();
            } else {
                setError("QR terdeteksi tapi bukan wallet address Ethereum.");
                rafRef.current = requestAnimationFrame(scanFrame);
            }
        } else {
            rafRef.current = requestAnimationFrame(scanFrame);
        }
    }, [stopCamera, onScan, onClose]);

    // ── Start kamera ────────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        setCameraError("");
        setError("");
        setCameraReady(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setCameraReady(true);
                rafRef.current = requestAnimationFrame(scanFrame);
            }
        } catch (err) {
            const msg = err.name === "NotAllowedError"
                ? "Izin kamera ditolak. Mohon izinkan akses kamera di browser."
                : err.name === "NotFoundError"
                ? "Tidak ada kamera yang terdeteksi di perangkat ini."
                : "Gagal mengakses kamera: " + err.message;
            setCameraError(msg);
        }
    }, [scanFrame]);

    // ── Lifecycle ────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            setError("");
            setCameraError("");
            setUploadPreview(null);
            setUploadResult(null);
            setMode("upload");
        }
    }, [isOpen, stopCamera]);

    useEffect(() => {
        if (isOpen && mode === "camera") {
            startCamera();
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen, mode, startCamera, stopCamera]);

    // ── Upload gambar QR ─────────────────────────────────────────────
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError("");
        setUploadResult(null);
        setScanning(true);

        const objectUrl = URL.createObjectURL(file);
        setUploadPreview(objectUrl);

        try {
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = objectUrl;
            });

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const code = decodeImageData(canvas, ctx, img, img.width, img.height);

            if (code && isEthAddress(code.data)) {
                setUploadResult(code.data);
            } else if (code) {
                setError("QR terdeteksi tapi bukan wallet address Ethereum.");
            } else {
                setError("QR tidak terdeteksi. Pastikan gambar jelas dan berisi QR code wallet.");
            }
        } catch {
            setError("Gagal membaca gambar. Coba dengan file lain.");
        } finally {
            setScanning(false);
            e.target.value = "";
        }
    };

    const handleConfirmUpload = () => {
        if (uploadResult) { onScan(uploadResult); onClose(); }
    };

    if (!isOpen) return null;

    return (
        <div
            style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
            onClick={onClose}
        >
            <div
                style={{ background: "white", borderRadius: "20px", width: "100%", maxWidth: "420px", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#eef5ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <IconQR size={18} color="#2E7DDB"/>
                        </div>
                        <div>
                            <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a", margin: 0 }}>Scan QR Pasien</h3>
                            <p style={{ fontSize: "0.7rem", color: "#94a3b8", margin: 0 }}>Baca wallet address dari QR code</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ width: "30px", height: "30px", borderRadius: "8px", background: "#f1f5f9", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                        <IconX size={14}/>
                    </button>
                </div>

                {/* Mode Tabs */}
                <div style={{ display: "flex", gap: "4px", margin: "14px 20px 0", background: "#f1f5f9", padding: "4px", borderRadius: "10px" }}>
                    {[
                        { id: "upload", label: "Upload Gambar", icon: <IconUpload size={14}/> },
                        { id: "camera", label: "Kamera Live", icon: <IconCamera size={14}/> },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => { setMode(tab.id); setError(""); setUploadPreview(null); setUploadResult(null); }}
                            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px", borderRadius: "7px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem", fontFamily: "inherit", transition: "all 0.2s", background: mode === tab.id ? "white" : "transparent", color: mode === tab.id ? "#0f172a" : "#64748b", boxShadow: mode === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>

                <div style={{ padding: "16px 20px 20px" }}>

                    {/* ── Upload Mode ── */}
                    {mode === "upload" && (
                        <div>
                            <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "12px", lineHeight: 1.5 }}>
                                Upload screenshot/foto QR code wallet pasien. Sistem akan membaca alamat wallet secara otomatis.
                            </p>

                            {!uploadPreview ? (
                                <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "28px 16px", border: "2px dashed #bfdbfe", borderRadius: "12px", cursor: "pointer", background: "#f8fbff", transition: "border-color 0.2s" }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = "#2E7DDB"}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = "#bfdbfe"}>
                                    <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#eef5ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <IconUpload size={22} color="#2E7DDB"/>
                                    </div>
                                    <div style={{ textAlign: "center" }}>
                                        <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155", margin: 0 }}>Klik untuk pilih gambar QR</p>
                                        <p style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "3px" }}>PNG, JPG, WebP — gambar QR wallet pasien</p>
                                    </div>
                                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }}/>
                                </label>
                            ) : (
                                <div>
                                    <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden", border: "1px solid #e2e8f0", marginBottom: "10px" }}>
                                        <img src={uploadPreview} alt="QR preview" style={{ width: "100%", maxHeight: "200px", objectFit: "contain", display: "block", background: "#f8fafc" }}/>
                                        {scanning && (
                                            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "0.82rem", color: "#2E7DDB", fontWeight: 600 }}>
                                                <IconLoader size={16}/> Membaca QR...
                                            </div>
                                        )}
                                    </div>

                                    {uploadResult && (
                                        <div style={{ padding: "12px 14px", borderRadius: "10px", background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: "10px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                                                <IconCheck size={14}/>
                                                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#16a34a" }}>Wallet address terdeteksi!</span>
                                            </div>
                                            <p style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: "0.68rem", color: "#166534", wordBreak: "break-all", margin: 0, lineHeight: 1.6 }}>
                                                {uploadResult}
                                            </p>
                                        </div>
                                    )}

                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button onClick={() => { setUploadPreview(null); setUploadResult(null); setError(""); }} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                                            Ganti Gambar
                                        </button>
                                        {uploadResult && (
                                            <button onClick={handleConfirmUpload} className="btn btn-primary" style={{ flex: 1, justifyContent: "center", fontSize: "0.78rem", padding: "9px" }}>
                                                <IconCheck size={13}/> Gunakan Address
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Camera Mode ── */}
                    {mode === "camera" && (
                        <div>
                            <p style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "12px", lineHeight: 1.5 }}>
                                Arahkan kamera ke QR code wallet pasien. Wallet address akan terisi otomatis saat QR terbaca.
                            </p>

                            {cameraError ? (
                                <div style={{ padding: "16px", borderRadius: "10px", background: "#fff5f5", border: "1px solid #fecaca", textAlign: "center" }}>
                                    <p style={{ fontSize: "0.8rem", color: "#dc2626", margin: "0 0 12px", lineHeight: 1.5 }}>{cameraError}</p>
                                    <button onClick={startCamera} className="btn btn-primary" style={{ fontSize: "0.78rem", padding: "8px 16px" }}>
                                        Coba Lagi
                                    </button>
                                </div>
                            ) : (
                                <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden", background: "#0f172a", aspectRatio: "4/3" }}>
                                    <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} playsInline muted/>

                                    {/* Scan overlay */}
                                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                                        <div style={{ width: "180px", height: "180px", position: "relative" }}>
                                            {/* Corner brackets */}
                                            {[
                                                { top: 0, left: 0, borderTop: "3px solid #2E7DDB", borderLeft: "3px solid #2E7DDB" },
                                                { top: 0, right: 0, borderTop: "3px solid #2E7DDB", borderRight: "3px solid #2E7DDB" },
                                                { bottom: 0, left: 0, borderBottom: "3px solid #2E7DDB", borderLeft: "3px solid #2E7DDB" },
                                                { bottom: 0, right: 0, borderBottom: "3px solid #2E7DDB", borderRight: "3px solid #2E7DDB" },
                                            ].map((s, i) => (
                                                <div key={i} style={{ position: "absolute", width: "24px", height: "24px", borderRadius: "2px", ...s }}/>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Status */}
                                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px", background: "linear-gradient(transparent, rgba(0,0,0,0.7)", textAlign: "center" }}>
                                        {!cameraReady ? (
                                            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                                <IconLoader size={13}/> Memulai kamera...
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.9)" }}>
                                                Arahkan ke QR code wallet pasien
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                            <canvas ref={canvasRef} style={{ display: "none" }}/>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div style={{ marginTop: "10px", padding: "10px 13px", borderRadius: "8px", background: "#fff5f5", border: "1px solid #fecaca" }}>
                            <p style={{ fontSize: "0.75rem", color: "#dc2626", margin: 0 }}>{error}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}