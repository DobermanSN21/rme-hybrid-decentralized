// pages/DoctorDashboard.jsx
// ============================================================
// Doctor Dashboard — Upload records for patients + view records
// ============================================================

import { useState } from "react";
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
} from "../services/crypto";
import { uploadToPinata, downloadFromPinata, isPinataConfigured } from "../services/pinata";

const ACCEPTED_TYPES = {
    "image/jpeg": "JPEG Image",
    "image/png": "PNG Image",
    "image/webp": "WebP Image",
    "application/pdf": "PDF Document",
};

export default function DoctorDashboard() {
    const { account, privateKey, setError, savePrivateKey } = useWallet();
    const [activeTab, setActiveTab] = useState("upload");

    // Upload state
    const [patientAddress, setPatientAddress] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [uploadLoading, setUploadLoading] = useState(false);
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
            setError("Hanya file gambar (JPEG, PNG, WebP) dan PDF yang diperbolehkan.");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setError("Ukuran file maksimal 10MB.");
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

    // Upload record
    const handleUpload = async () => {
        if (!selectedFile || !patientAddress) {
            setError("Pilih file dan masukkan alamat pasien.");
            return;
        }

        if (!isPinataConfigured()) {
            setError("Pinata not configured. Set VITE_PINATA_JWT di .env");
            return;
        }

        setUploadLoading(true);
        setError(null);
        try {
            // 1. Generate AES key
            const aesKeyHex = await generateAESKey();

            // 2. Read file as ArrayBuffer
            const fileBuffer = await selectedFile.arrayBuffer();

            // 3. Encrypt file with AES
            const encryptedBlob = await encryptFile(fileBuffer, aesKeyHex);

            // 4. Upload encrypted file to Pinata
            const cid = await uploadToPinata(encryptedBlob, selectedFile.name);

            // 5. Get patient's public key from blockchain
            const patientPubKey = await getBlockchainPublicKey(account.signer, patientAddress);

            // 6. Encrypt AES key with patient's public key
            const encAesKey = await encryptWithPublicKey(patientPubKey, aesKeyHex);
            const serializedKey = serializeEncrypted(encAesKey);

            // 7. Submit to blockchain (status: PENDING)
            await submitRecord(
                account.signer,
                patientAddress,
                cid,
                serializedKey,
                selectedFile.type,
                selectedFile.name
            );

            setUploadSuccess({
                cid,
                fileName: selectedFile.name,
                fileType: selectedFile.type,
            });
            setSelectedFile(null);
            setFilePreview(null);
        } catch (err) {
            setError("Upload failed: " + (err.reason || err.message || err));
        } finally {
            setUploadLoading(false);
        }
    };

    // Search patient records
    const handleSearch = async () => {
        if (!searchAddress) {
            setError("Masukkan alamat wallet pasien");
            return;
        }
        setSearchLoading(true);
        setError(null);
        setDecryptedMap({});
        try {
            const recs = await getPatientRecords(account.signer, searchAddress);
            setRecords(recs);
            if (recs.length === 0) {
                setError("Tidak ada rekam medis atau Anda tidak memiliki akses ke pasien ini.");
            }
        } catch (err) {
            setRecords([]);
            setError(err.reason || err.message || "Failed mengambil rekam medis");
        } finally {
            setSearchLoading(false);
        }
    };

    // Decrypt a record
    const handleDecrypt = async (cid, fileType) => {
        if (!privateKey) {
            setError("Private key tidak tersedia. Import terlebih dahulu.");
            return;
        }
        try {
            // 1. Get encrypted AES key
            const encKeyStr = await getEncryptedKey(account.signer, cid);
            const encKey = deserializeEncrypted(encKeyStr);

            // 2. Decrypt AES key
            const aesKeyHex = await decryptWithPrivateKey(privateKey, encKey);

            // 3. Download encrypted file from Pinata
            const encryptedBuffer = await downloadFromPinata(cid);

            // 4. Decrypt file
            const decryptedBuffer = await decryptFile(encryptedBuffer, aesKeyHex);

            // 5. Create blob URL for display
            const blob = new Blob([decryptedBuffer], { type: fileType });
            const url = URL.createObjectURL(blob);

            setDecryptedMap((prev) => ({ ...prev, [cid]: { url, fileType } }));
        } catch (err) {
            setError("Decrypt failed: " + (err.message || err));
        }
    };

    const handleImportKey = () => {
        const key = keyInput.trim();
        if (key.length !== 64) {
            setError("Private key harus 64 karakter hex");
            return;
        }
        savePrivateKey(key);
        setKeyInput("");
    };

    const tabs = [
        { id: "upload", label: "📤 Upload Medical Record" },
        { id: "view", label: "📋 View Medical Records" },
    ];

    return (
        <Layout>
            {/* Private Key Import */}
            {!privateKey && (
                <div className="glass-card border-warning-500/30 mb-6 animate-fade-in">
                    <p className="text-warning-500 text-xs font-bold mb-2">
                        ⚠️ Import ECC Private Key untuk enkripsi/dekripsi data
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="password"
                            value={keyInput}
                            onChange={(e) => setKeyInput(e.target.value)}
                            placeholder="Masukkan ECC private key (hex)..."
                            className="input-field flex-1 text-xs"
                        />
                        <button onClick={handleImportKey} className="btn btn-primary text-xs">
                            Import
                        </button>
                    </div>
                </div>
            )}

            {privateKey && (
                <div className="mb-4">
                    <span className="badge badge-success">✓ Private key active</span>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`btn text-sm ${activeTab === tab.id ? "btn-primary" : "btn-ghost"}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Upload Tab */}
            {activeTab === "upload" && (
                <div className="max-w-2xl">
                    <h2 className="section-title">Upload Medical Record Patient</h2>

                    <div className="glass-card">
                        {/* Patient Address */}
                        <div className="mb-4">
                            <label>Wallet Address Patient</label>
                            <input
                                type="text"
                                value={patientAddress}
                                onChange={(e) => setPatientAddress(e.target.value)}
                                placeholder="0x..."
                                className="input-field"
                            />
                        </div>

                        {/* File Picker */}
                        <div className="mb-4">
                            <label>File Medical Records</label>
                            <div className="border-2 border-dashed border-surface-200 rounded-xl p-6 text-center hover:border-primary-500/40 transition-colors">
                                <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label htmlFor="file-upload" className="cursor-pointer">
                                    <div className="text-3xl mb-2">📁</div>
                                    <p className="text-sm text-surface-700/60">
                                        Click to select file
                                    </p>
                                    <p className="text-xs text-surface-700/40 mt-1">
                                        JPEG, PNG, WebP, PDF — max 10MB
                                    </p>
                                </label>
                            </div>
                        </div>

                        {/* File Preview */}
                        {filePreview && (
                            <div className="mb-4 p-3 rounded-lg bg-surface-50 border border-surface-200">
                                {filePreview.type === "image" ? (
                                    <img
                                        src={filePreview.url}
                                        alt="Preview"
                                        className="max-h-48 rounded-lg mx-auto"
                                    />
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <div className="text-3xl">📄</div>
                                        <div>
                                            <p className="text-sm text-surface-900 font-medium">{filePreview.name}</p>
                                            <p className="text-xs text-surface-700/50">
                                                {(filePreview.size / 1024).toFixed(1)} KB
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={() => {
                                        setSelectedFile(null);
                                        setFilePreview(null);
                                    }}
                                    className="btn btn-ghost text-xs mt-2"
                                >
                                    ✕ Remove file
                                </button>
                            </div>
                        )}

                        {/* Encryption Info */}
                        <div className="p-3 rounded-lg bg-surface-50 border border-primary-200 mb-4">
                            <p className="text-xs text-surface-700/60">
                                <strong className="text-primary-600">Encryption flow:</strong>{" "}
                                File → AES-256-GCM → Pinata (IPFS) → AES Key → ECIES(ECC PubKey Patient) → Blockchain
                            </p>
                        </div>

                        {/* Upload Button */}
                        <button
                            onClick={handleUpload}
                            disabled={uploadLoading || !selectedFile || !patientAddress}
                            className="btn btn-accent w-full justify-center"
                        >
                            {uploadLoading
                                ? "⟳ Encrypting...mengupload..."
                                : "🔒 Encrypt & Upload to IPFS"}
                        </button>
                    </div>

                    {/* Upload Success */}
                    {uploadSuccess && (
                        <div className="glass-card mt-4 border-success-500/30 animate-fade-in">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">✅</span>
                                <span className="text-success-500 font-bold text-sm">Upload Success!</span>
                            </div>
                            <div className="space-y-1 text-xs text-surface-700/60">
                                <p>📄 File: <span className="text-surface-900">{uploadSuccess.fileName}</span></p>
                                <p style={{ overflow: "hidden", textOverflow: "ellipsis" }}>🔗 CID: <span className="mono text-primary-600">{uploadSuccess.cid}</span></p>
                                <p>⏳ Status: <span className="text-warning-500">PENDING (menunggu persetujuan pasien)</span></p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* View Tab */}
            {activeTab === "view" && (
                <div className="max-w-3xl">
                    <h2 className="section-title">View Medical Records Patient</h2>

                    {/* Search */}
                    <div className="glass-card mb-6">
                        <h3 className="text-sm font-bold text-surface-900 mb-3">Cari Medical Records Patient</h3>
                        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                            <input
                                type="text"
                                value={searchAddress}
                                onChange={(e) => setSearchAddress(e.target.value)}
                                placeholder="Alamat wallet pasien (0x...)"
                                className="input-field"
                                style={{ flex: "1 1 200px", minWidth: 0 }}
                            />
                            <button
                                onClick={handleSearch}
                                disabled={searchLoading || !searchAddress}
                                className="btn btn-primary shrink-0"
                                style={{ flex: "0 0 auto" }}
                            >
                                {searchLoading ? "⟳" : "🔍 Cari"}
                            </button>
                        </div>
                    </div>

                    {/* Records */}
                    {records.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="section-title" style={{ marginBottom: 0 }}>
                                    Medical Records
                                </h3>
                                <span className="badge badge-patient">
                                    {records.length} record
                                </span>
                            </div>
                            <div className="space-y-3">
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
                        <div className="glass-card text-center py-10">
                            <div className="text-4xl mb-3">🔒</div>
                            <p className="text-surface-700/50 text-sm">
                                Tidak ada rekam medis yang tersedia
                            </p>
                        </div>
                    )}
                </div>
            )}
        </Layout>
    );
}
