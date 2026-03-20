// components/AccessManager.jsx
// ============================================================
// Grant/Revoke doctor access + list authorized doctors
// ============================================================

import { useState, useEffect } from "react";
import { useWallet } from "../context/WalletContext";
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

export default function AccessManager() {
    const { account, privateKey, setError } = useWallet();
    const [doctorAddress, setDoctorAddress] = useState("");
    const [selectedCid, setSelectedCid] = useState("");
    const [cids, setCids] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [grantLoading, setGrantLoading] = useState(false);

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
            setError("Isi alamat dokter dan pilih CID. Pastikan private key tersedia.");
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
            setError(err.message || "Failed memberikan akses");
        } finally {
            setGrantLoading(false);
        }
    };

    const handleRevoke = async (doctor) => {
        try {
            await revokeAccess(account.signer, doctor);
            await loadData();
        } catch (err) {
            setError(err.message || "Failed mencabut akses");
        }
    };

    const shortenAddr = (a) => `${a.slice(0, 6)}...${a.slice(-4)}`;

    return (
        <div className="space-y-6">
            {/* Grant Access Form */}
            <div className="glass-card">
                <h3 className="section-title">Grant Access ke Doctor</h3>

                <div className="space-y-3">
                    <div>
                        <label>Wallet Address Doctor</label>
                        <input
                            type="text"
                            value={doctorAddress}
                            onChange={(e) => setDoctorAddress(e.target.value)}
                            placeholder="0x..."
                            className="input-field"
                        />
                    </div>

                    <div>
                        <label>Pilih Medical Records (CID)</label>
                        <select
                            value={selectedCid}
                            onChange={(e) => setSelectedCid(e.target.value)}
                            className="input-field"
                        >
                            {cids.length === 0 && <option value="">Tidak ada rekam medis</option>}
                            {cids.map((cid, i) => (
                                <option key={i} value={cid}>
                                    {cid.slice(0, 20)}...
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleGrant}
                        disabled={grantLoading || !doctorAddress || !selectedCid}
                        className="btn btn-accent w-full justify-center"
                    >
                        {grantLoading ? "⟳ Encrypting...mengirim..." : "🔑 Grant Access"}
                    </button>
                </div>
            </div>

            {/* Authorized Doctors List */}
            <div className="glass-card">
                <h3 className="section-title">Doctor dengan Akses Aktif</h3>

                {loading && <p className="text-sm text-surface-700/50">Loading...</p>}

                {!loading && doctors.length === 0 && (
                    <p className="text-sm text-surface-700/40 text-center py-4">
                        Belum ada dokter yang diberi akses
                    </p>
                )}

                <div className="space-y-2">
                    {doctors.map((doc, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between p-3 rounded-lg bg-surface-50 border border-surface-200"
                            style={{ flexWrap: "wrap", gap: "8px" }}
                        >
                            <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                                <span className="badge badge-doctor">Doctor</span>
                                <span className="mono text-xs">{shortenAddr(doc)}</span>
                            </div>
                            <button
                                onClick={() => handleRevoke(doc)}
                                className="btn btn-danger text-xs py-1 px-3"
                            >
                                Revoke Access
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
