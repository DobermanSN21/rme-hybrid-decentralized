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
    const [selectedCid, setSelectedCid] = useState("");
    const [cids, setCids] = useState([]);
    const [doctors, setDoctors] = useState([]);
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
            const [cidList, doctorList] = await Promise.all([
                getMyCids(account.signer),
                getAuthorizedDoctors(account.signer),
            ]);
            setCids(cidList);
            setDoctors(doctorList);
            if (cidList.length > 0 && !selectedCid) setSelectedCid(cidList[0]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleGrant = async () => {
        if (!doctorAddress || !selectedCid || !privateKey) {
            setError("Please enter doctor address, select a CID, and ensure private key is imported.");
            return;
        }
        if (!isAddress(doctorAddress)) {
            setError("Invalid doctor wallet address. Must be a valid Ethereum address (0x...).");
            return;
        }

        setGrantLoading(true);
        setError(null);
        try {
            // 1. Get my encrypted AES key for this CID
            const myEncKeyStr = await getEncryptedKey(account.signer, selectedCid);
            const myEncKey = deserializeEncrypted(myEncKeyStr);

            // 2. Decrypt AES key using my private key
            const aesKeyHex = await decryptWithPrivateKey(privateKey, myEncKey);

            // 3. Get doctor's public key from blockchain
            const doctorPubKey = await getPublicKey(account.signer, doctorAddress);

            // 4. Re-encrypt AES key with doctor's public key
            const encKeyForDoctor = await encryptWithPublicKey(doctorPubKey, aesKeyHex);
            const serializedForDoctor = serializeEncrypted(encKeyForDoctor);

            // 5. Call smart contract
            await grantAccess(account.signer, doctorAddress, selectedCid, serializedForDoctor);

            setDoctorAddress("");
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
                    await loadData();
                } catch (err) {
                    setError(err.message || "Failed to revoke access.");
                }
            },
        });
    };

    const shortenAddr = (a) => `${a.slice(0, 6)}...${a.slice(-4)}`;

    const addressValid = !doctorAddress || isAddress(doctorAddress);

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
                    {/* Doctor Address */}
                    <div>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Doctor Wallet Address
                        </label>
                        <input
                            type="text"
                            value={doctorAddress}
                            onChange={(e) => setDoctorAddress(e.target.value)}
                            placeholder="0x..."
                            className="input-field"
                            style={{
                                borderColor: !addressValid ? "#fca5a5" : undefined,
                                background: !addressValid ? "#fff1f2" : undefined,
                            }}
                        />
                        {!addressValid && (
                            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "6px" }}>
                                <IconAlertCircle size={13} color="#e11d48" />
                                <span style={{ fontSize: "0.75rem", color: "#e11d48" }}>
                                    Invalid Ethereum address format
                                </span>
                            </div>
                        )}
                    </div>

                    {/* CID Selection */}
                    <div>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Select Medical Record (CID)
                        </label>
                        {cids.length === 0 ? (
                            <div style={{ padding: "12px 16px", borderRadius: "10px", background: "#f8fafc", border: "1.5px solid #e2e8f0", color: "#94a3b8", fontSize: "0.85rem" }}>
                                No medical records available
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {cids.map((cid, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => setSelectedCid(cid)}
                                        style={{
                                            display: "flex", alignItems: "center", gap: "10px",
                                            padding: "12px 14px", borderRadius: "10px",
                                            border: selectedCid === cid ? "2px solid #2E7DDB" : "1.5px solid #e2e8f0",
                                            background: selectedCid === cid ? "#eef5ff" : "white",
                                            cursor: "pointer", transition: "all 0.2s ease",
                                            textAlign: "left", width: "100%",
                                        }}
                                    >
                                        <div style={{
                                            width: "32px", height: "32px", borderRadius: "8px",
                                            background: selectedCid === cid ? "#dbeafe" : "#f1f5f9",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            flexShrink: 0,
                                        }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={selectedCid === cid ? "#2E7DDB" : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: selectedCid === cid ? "#2E7DDB" : "#64748b", marginBottom: "2px" }}>
                                                Record #{i + 1}
                                            </div>
                                            <div className="mono" style={{ fontSize: "0.7rem", color: selectedCid === cid ? "#1e40af" : "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={cid}>
                                                {cid}
                                            </div>
                                        </div>
                                        {selectedCid === cid && (
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E7DDB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Submit */}
                    <button
                        onClick={handleGrant}
                        disabled={grantLoading || !doctorAddress || !selectedCid || !addressValid}
                        className="btn btn-accent"
                        style={{
                            width: "100%", justifyContent: "center",
                            padding: "11px 22px", fontSize: "0.85rem",
                        }}
                    >
                        {grantLoading
                            ? <><IconLoader size={15} /> Encrypting & Submitting...</>
                            : <><IconSend size={15} /> Grant Access</>
                        }
                    </button>
                </div>
            </div>

            {/* Authorized Doctors List */}
            <div className="glass-card" style={{ padding: "24px" }}>
                <h3 className="section-title" style={{ marginBottom: "16px" }}>Doctors with Active Access</h3>

                {loading && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 0" }}>
                        <IconLoader size={16} />
                        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Loading...</span>
                    </div>
                )}

                {!loading && doctors.length === 0 && (
                    <div style={{ textAlign: "center", padding: "28px 16px" }}>
                        <div style={{ margin: "0 auto 12px", opacity: 0.5 }}>
                            <IconUsersEmpty size={44} color="#cbd5e1" />
                        </div>
                        <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                            No doctors have been granted access yet
                        </p>
                    </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {doctors.map((doc, i) => (
                        <div
                            key={i}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "12px 14px",
                                borderRadius: "10px",
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                flexWrap: "wrap",
                                gap: "8px",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                                <div style={{
                                    width: "32px", height: "32px", borderRadius: "8px",
                                    background: "#f0fdf9", border: "1px solid #99f6e4",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    flexShrink: 0,
                                }}>
                                    <IconStethoscope size={16} color="#0d9488" />
                                </div>
                                <div>
                                    <span className="mono" style={{ fontSize: "0.8rem", color: "#334155", fontWeight: 500 }}>
                                        {shortenAddr(doc)}
                                    </span>
                                    <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>Authorized Doctor</div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleRevoke(doc)}
                                className="btn btn-danger"
                                style={{ fontSize: "0.75rem", padding: "6px 14px" }}
                            >
                                <IconUserX size={13} color="white" /> Revoke
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
