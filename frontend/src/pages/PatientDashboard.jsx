// pages/PatientDashboard.jsx
// ============================================================
// Patient Dashboard — consent approval, view records, access mgmt
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "../context/WalletContext";
import Layout from "../components/Layout";
import RecordCard from "../components/RecordCard";
import AccessManager from "../components/AccessManager";
import {
    getMyRecords,
    getPendingRecords,
    getPendingCount,
    approveRecord,
    rejectRecord,
    getEncryptedKey,
} from "../services/blockchain";
import {
    decryptFile,
    decryptWithPrivateKey,
    deserializeEncrypted,
} from "../services/crypto";
import { downloadFromPinata } from "../services/pinata";

export default function PatientDashboard() {
    const { account, privateKey, setError, savePrivateKey } = useWallet();
    const [records, setRecords] = useState([]);
    const [pendingRecords, setPendingRecords] = useState([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [decryptedMap, setDecryptedMap] = useState({}); // cid -> { url, fileType }
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null); // recordIndex being processed
    const [activeTab, setActiveTab] = useState("pending");

    // Private key import state
    const [keyInput, setKeyInput] = useState("");

    // Load records
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
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [account]);

    useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    // Approve record
    const handleApprove = async (recordIndex) => {
        setActionLoading(recordIndex);
        setError(null);
        try {
            await approveRecord(account.signer, recordIndex);
            await loadRecords();
        } catch (err) {
            setError("Approve failed: " + (err.reason || err.message || err));
        } finally {
            setActionLoading(null);
        }
    };

    // Reject record
    const handleReject = async (recordIndex) => {
        setActionLoading(recordIndex);
        setError(null);
        try {
            await rejectRecord(account.signer, recordIndex);
            await loadRecords();
        } catch (err) {
            setError("Reject failed: " + (err.reason || err.message || err));
        } finally {
            setActionLoading(null);
        }
    };

    // Decrypt a record
    const handleDecrypt = async (cid, fileType) => {
        if (!privateKey) {
            setError("Private key tidak tersedia. Silakan import kembali.");
            return;
        }
        try {
            // 1. Get encrypted AES key from blockchain
            const encKeyStr = await getEncryptedKey(account.signer, cid);
            const encKey = deserializeEncrypted(encKeyStr);

            // 2. Decrypt AES key with my private key
            const aesKeyHex = await decryptWithPrivateKey(privateKey, encKey);

            // 3. Download encrypted data from Pinata
            const encryptedBuffer = await downloadFromPinata(cid);

            // 4. Decrypt file with AES key
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

    const shortenAddr = (a) => `${a.slice(0, 6)}...${a.slice(-4)}`;

    const tabs = [
        { id: "pending", label: "⏳ Approvals", count: pendingCount },
        { id: "records", label: "📋 Medical Records", count: records.length },
        { id: "access", label: "🔑 Manage Access" },
    ];

    return (
        <Layout>
            {/* Private Key Import */}
            {!privateKey && (
                <div className="glass-card border-warning-500/30 mb-6 animate-fade-in">
                    <p className="text-warning-500 text-xs font-bold mb-2">
                        ⚠️ Import ECC Private Key untuk dekripsi data
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

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`btn text-sm ${activeTab === tab.id ? "btn-primary" : "btn-ghost"}`}
                    >
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className={`ml-1 text-xs px-1.5 rounded-full ${tab.id === "pending"
                                    ? "bg-warning-400/20 text-warning-500"
                                    : "opacity-70"
                                }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Pending Tab */}
            {activeTab === "pending" && (
                <div>
                    <h2 className="section-title">Approvals Medical Records</h2>

                    {loading && (
                        <p className="text-surface-700/50 text-sm">Loading...</p>
                    )}

                    {!loading && pendingRecords.length === 0 && (
                        <div className="glass-card text-center py-12">
                            <div className="text-5xl mb-4">✅</div>
                            <p className="text-surface-700/50">Tidak ada rekam medis yang menunggu persetujuan</p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {pendingRecords.map((rec) => (
                            <div key={rec.recordIndex} className="glass-card border-warning-500/20 animate-fade-in">
                                <div className="flex items-start justify-between gap-4" style={{ flexWrap: "wrap" }}>
                                    <div className="flex-1 min-w-0" style={{ minWidth: "200px" }}>
                                        <div className="flex items-center gap-2 mb-2" style={{ flexWrap: "wrap" }}>
                                            <span className="badge" style={{ background: "var(--color-warning-400)", color: "#000" }}>
                                                ⏳ PENDING
                                            </span>
                                            <span className="text-xs text-surface-700/40">
                                                {new Date(rec.timestamp * 1000).toLocaleString("id-ID")}
                                            </span>
                                        </div>

                                        <div className="space-y-1 text-xs">
                                            <p className="text-surface-700/60">
                                                📄 File: <span className="text-surface-900 font-medium">{rec.fileName}</span>
                                            </p>
                                            <p className="text-surface-700/60">
                                                📁 Type: <span className="text-surface-900">{rec.fileType}</span>
                                            </p>
                                            <p className="text-surface-700/60">
                                                👨‍⚕️ Doctor: <span className="mono text-accent-600">{shortenAddr(rec.doctorAddress)}</span>
                                            </p>
                                            <p className="text-surface-700/60" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                                🔗 CID: <span className="mono text-primary-600">{rec.cid}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 shrink-0" style={{ flexWrap: "wrap" }}>
                                        <button
                                            onClick={() => handleApprove(rec.recordIndex)}
                                            disabled={actionLoading === rec.recordIndex}
                                            className="btn btn-primary text-xs py-1.5 px-4"
                                        >
                                            {actionLoading === rec.recordIndex ? "⟳" : "✅ Approve"}
                                        </button>
                                        <button
                                            onClick={() => handleReject(rec.recordIndex)}
                                            disabled={actionLoading === rec.recordIndex}
                                            className="btn btn-danger text-xs py-1.5 px-4"
                                        >
                                            {actionLoading === rec.recordIndex ? "⟳" : "❌ Reject"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Records Tab */}
            {activeTab === "records" && (
                <div>
                    <h2 className="section-title">My Medical Records (Approved)</h2>

                    {loading && (
                        <p className="text-surface-700/50 text-sm">Loading...kam medis...</p>
                    )}

                    {!loading && records.length === 0 && (
                        <div className="glass-card text-center py-12">
                            <div className="text-5xl mb-4">📂</div>
                            <p className="text-surface-700/50">No medical records yet yang approved</p>
                            {pendingCount > 0 && (
                                <button
                                    onClick={() => setActiveTab("pending")}
                                    className="btn btn-primary mt-4"
                                >
                                    Lihat {pendingCount} Menunggu Approvals
                                </button>
                            )}
                        </div>
                    )}

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

            {/* Access Tab */}
            {activeTab === "access" && (
                <div className="max-w-2xl">
                    <AccessManager />
                </div>
            )}
        </Layout>
    );
}
