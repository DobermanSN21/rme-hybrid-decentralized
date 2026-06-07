// context/WalletContext.jsx

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { connectWallet, getRole, getPublicKey as getBlockchainPublicKey, getContractOwner, getDoctorRequest, getDisplayName, clearNameCache } from "../services/blockchain";

const WalletContext = createContext(null);

export const ROLES = { NONE: 0, PATIENT: 1, DOCTOR: 2 };
export const ROLE_LABELS = { [ROLES.NONE]: "Belum Terdaftar", [ROLES.PATIENT]: "Patient", [ROLES.DOCTOR]: "Doctor" };

export function WalletProvider({ children }) {
    const [account, setAccount] = useState(null);
    const [role, setRole] = useState(ROLES.NONE);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isPendingDoctor, setIsPendingDoctor] = useState(false);
    const [pendingDoctorInfo, setPendingDoctorInfo] = useState(null); // { name, licenseNumber, specialization, hospital }
    const [isRejectedDoctor, setIsRejectedDoctor] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [privateKey, setPrivateKey] = useState(null);

    const _loadStatus = useCallback(async (acc) => {
        try {
            const [r, ownerAddr] = await Promise.all([
                getRole(acc.signer, acc.address),
                getContractOwner(acc.signer),
            ]);

            const adminFlag = acc.address.toLowerCase() === ownerAddr.toLowerCase();
            setIsAdmin(adminFlag);
            setRole(r);

            if (r !== ROLES.NONE) {
                const name = await getDisplayName(acc.signer, acc.address);
                setDisplayName(name);
            } else {
                setDisplayName("");
            }

            if (r === ROLES.NONE && !adminFlag) {
                // Check if pending/rejected doctor request
                try {
                    const req = await getDoctorRequest(acc.signer, acc.address);
                    if (req.isPending) {
                        setIsPendingDoctor(true);
                        setIsRejectedDoctor(false);
                        setPendingDoctorInfo({ name: req.name, licenseNumber: req.licenseNumber, specialization: req.specialization, hospital: req.hospital, ktpNumber: req.ktpNumber, phoneNumber: req.phoneNumber, photoCid: req.photoCid });
                    } else if (req.isRejected) {
                        setIsRejectedDoctor(true);
                        setRejectReason(req.rejectReason);
                        setIsPendingDoctor(false);
                    } else {
                        setIsPendingDoctor(false);
                        setIsRejectedDoctor(false);
                    }
                } catch { /* no request */ }
            }
        } catch (e) {
            console.warn("[RME] Failed to load status:", e.message);
        }
    }, []);

    const connect = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const acc = await connectWallet();
            setAccount(acc);
            await _loadStatus(acc);
            return acc;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [_loadStatus]);

    const disconnect = useCallback(() => {
        setAccount(null);
        setRole(ROLES.NONE);
        setIsAdmin(false);
        setIsPendingDoctor(false);
        setIsRejectedDoctor(false);
        setPendingDoctorInfo(null);
        setDisplayName("");
        setPrivateKey(null);
        setError(null);
        clearNameCache();
    }, []);

    const savePrivateKey = useCallback((key) => setPrivateKey(key), []);

    const refreshStatus = useCallback(async () => {
        if (!account) return;
        await _loadStatus(account);
    }, [account, _loadStatus]);

    useEffect(() => {
        if (!window.ethereum) return;
        const handleAccountsChanged = async (accounts) => {
            if (accounts.length === 0) {
                disconnect();
            } else {
                setPrivateKey(null);
                try { await connect(); } catch {}
            }
        };
        window.ethereum.on("accountsChanged", handleAccountsChanged);
        return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    }, [connect, disconnect]);

    const value = {
        account, role, loading, error, privateKey,
        isAdmin, isPendingDoctor, pendingDoctorInfo, isRejectedDoctor, rejectReason,
        displayName, setDisplayName,
        connect, disconnect, savePrivateKey, refreshStatus,
        setRole, setError, setIsPendingDoctor, setPendingDoctorInfo,
        isConnected: !!account,
        isPatient: role === ROLES.PATIENT,
        isDoctor: role === ROLES.DOCTOR,
        isRegistered: role !== ROLES.NONE,
    };

    return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
    const ctx = useContext(WalletContext);
    if (!ctx) throw new Error("useWallet must be used within WalletProvider");
    return ctx;
}
