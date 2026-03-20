// context/WalletContext.jsx
// ============================================================
// React Context for wallet state & authentication
// ============================================================

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { connectWallet, getCurrentAccount, getRole, getPublicKey as getBlockchainPublicKey } from "../services/blockchain";

const WalletContext = createContext(null);

// Role enum matching smart contract
export const ROLES = {
    NONE: 0,
    PATIENT: 1,
    DOCTOR: 2,
};

export const ROLE_LABELS = {
    [ROLES.NONE]: "Belum Terdaftar",
    [ROLES.PATIENT]: "Patient",
    [ROLES.DOCTOR]: "Doctor",
};

export function WalletProvider({ children }) {
    const [account, setAccount] = useState(null); // { provider, signer, address }
    const [role, setRole] = useState(ROLES.NONE);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [privateKey, setPrivateKey] = useState(null); // ECC private key (stored in memory only)

    // Connect MetaMask
    const connect = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const acc = await connectWallet();
            setAccount(acc);

            // Check if already registered
            try {
                const r = await getRole(acc.signer, acc.address);
                setRole(r);
            } catch {
                setRole(ROLES.NONE);
            }

            // Load ECC private key from sessionStorage if available
            const storedKey = sessionStorage.getItem(`ecc_privkey_${acc.address}`);
            if (storedKey) setPrivateKey(storedKey);

            return acc;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // Disconnect
    const disconnect = useCallback(() => {
        setAccount(null);
        setRole(ROLES.NONE);
        setPrivateKey(null);
        setError(null);
    }, []);

    // Save ECC private key (session only - not persistent)
    const savePrivateKey = useCallback(
        (key) => {
            setPrivateKey(key);
            if (account?.address) {
                sessionStorage.setItem(`ecc_privkey_${account.address}`, key);
            }
        },
        [account]
    );

    // Refresh role from blockchain
    const refreshRole = useCallback(async () => {
        if (!account) return;
        try {
            const r = await getRole(account.signer, account.address);
            setRole(r);
        } catch {
            setRole(ROLES.NONE);
        }
    }, [account]);

    // Listen for MetaMask account changes
    useEffect(() => {
        if (!window.ethereum) return;
        const handleAccountsChanged = (accounts) => {
            if (accounts.length === 0) {
                disconnect();
            } else {
                connect();
            }
        };
        window.ethereum.on("accountsChanged", handleAccountsChanged);
        return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
    }, [connect, disconnect]);

    const value = {
        account,
        role,
        loading,
        error,
        privateKey,
        connect,
        disconnect,
        savePrivateKey,
        refreshRole,
        setError,
        isConnected: !!account,
        isPatient: role === ROLES.PATIENT,
        isDoctor: role === ROLES.DOCTOR,
        isRegistered: role !== ROLES.NONE,
    };

    return (
        <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
    );
}

export function useWallet() {
    const ctx = useContext(WalletContext);
    if (!ctx) throw new Error("useWallet must be used within WalletProvider");
    return ctx;
}
