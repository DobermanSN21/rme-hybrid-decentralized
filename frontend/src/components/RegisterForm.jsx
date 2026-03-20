// components/RegisterForm.jsx
// ============================================================
// Registration form (English)
// ============================================================

import { useState, useEffect } from "react";
import { useWallet, ROLES } from "../context/WalletContext";
import { registerAsPatient, registerAsDoctor } from "../services/blockchain";
import { generateKeyPair } from "../services/crypto";

export default function RegisterForm() {
    const { account, savePrivateKey, refreshRole, setError } = useWallet();
    const [selectedRole, setSelectedRole] = useState("patient");
    const [loading, setLoading] = useState(false);
    const [generatedKeys, setGeneratedKeys] = useState(null);
    const [registrationSuccess, setRegistrationSuccess] = useState(false);
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        if (!registrationSuccess) return;
        if (countdown <= 0) return;
        const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [registrationSuccess, countdown]);

    const handleRegister = async () => {
        setLoading(true);
        setError(null);
        try {
            const keyPair = generateKeyPair();
            setGeneratedKeys(keyPair);

            if (selectedRole === "patient") {
                await registerAsPatient(account.signer, keyPair.publicKey);
            } else {
                await registerAsDoctor(account.signer, keyPair.publicKey);
            }

            savePrivateKey(keyPair.privateKey);
            setRegistrationSuccess(true);

            setTimeout(async () => {
                await refreshRole();
            }, 5000);
        } catch (err) {
            setGeneratedKeys(null);
            setError(err.message || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    if (registrationSuccess) {
        return (
            <div className="glass-card max-w-lg mx-auto animate-fade-in">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
                        style={{ background: "rgba(16, 185, 129, 0.12)" }}>
                        ✅
                    </div>
                    <h2 className="text-xl font-bold text-surface-900 mb-2">Registration Successful!</h2>
                    <p className="text-sm text-surface-700/50">
                        You are registered as{" "}
                        <span className={`font-bold ${selectedRole === "patient" ? "text-primary-600" : "text-accent-600"}`}>
                            {selectedRole === "patient" ? "Patient" : "Doctor"}
                        </span>
                    </p>
                </div>

                {generatedKeys && (
                    <div className="p-4 rounded-xl bg-warning-500/5 border border-warning-500/20 mb-5">
                        <p className="text-warning-500 text-xs font-bold mb-2">
                            ⚠️ IMPORTANT — SAVE YOUR PRIVATE KEY
                        </p>
                        <p className="text-surface-700/40 text-xs mb-3">
                            This private key is only shown once. You need it to encrypt and decrypt medical records.
                        </p>
                        <div className="p-3 rounded-lg bg-surface-50 border border-surface-200">
                            <p className="mono text-xs break-all text-surface-700 select-all">
                                {generatedKeys.privateKey}
                            </p>
                        </div>
                        <button
                            onClick={() => navigator.clipboard.writeText(generatedKeys.privateKey)}
                            className="btn btn-ghost text-xs mt-3 w-full justify-center"
                        >
                            📋 Copy to Clipboard
                        </button>
                    </div>
                )}

                <div className="text-center">
                    <p className="text-surface-300 text-xs">
                        Redirecting to dashboard in {countdown > 0 ? `${countdown} seconds` : "..."}
                    </p>
                    <div className="w-full bg-surface-100 rounded-full h-1 mt-2 overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-1000 ease-linear"
                            style={{
                                width: `${((5 - countdown) / 5) * 100}%`,
                                background: "linear-gradient(90deg, #2E7DDB, #14b8a6)",
                            }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card max-w-lg mx-auto animate-fade-in">
            <h2 className="section-title">Account Registration</h2>
            <p className="text-sm text-surface-700/40 mb-6">
                Select your role and the system will automatically generate an ECC key pair for data encryption.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                    onClick={() => setSelectedRole("patient")}
                    className={`glass-card text-center cursor-pointer transition-all ${selectedRole === "patient"
                            ? "border-primary-500/50 bg-primary-500/8"
                            : "hover:border-surface-200"
                        }`}
                    style={{ padding: "24px 16px" }}
                >
                    <div className="text-3xl mb-2">🏥</div>
                    <div className="font-bold text-sm text-surface-900">Patient</div>
                    <div className="text-xs text-surface-700/40 mt-1">Medical data owner</div>
                </button>

                <button
                    onClick={() => setSelectedRole("doctor")}
                    className={`glass-card text-center cursor-pointer transition-all ${selectedRole === "doctor"
                            ? "border-accent-500/50 bg-accent-500/8"
                            : "hover:border-surface-200"
                        }`}
                    style={{ padding: "24px 16px" }}
                >
                    <div className="text-3xl mb-2">👨‍⚕️</div>
                    <div className="font-bold text-sm text-surface-900">Doctor</div>
                    <div className="text-xs text-surface-700/40 mt-1">Data accessor (with permission)</div>
                </button>
            </div>

            <button
                onClick={handleRegister}
                disabled={loading}
                className={`btn w-full justify-center ${selectedRole === "patient" ? "btn-primary" : "btn-accent"
                    }`}
            >
                {loading ? "⟳ Registering..." : `Register as ${selectedRole === "patient" ? "Patient" : "Doctor"}`}
            </button>
        </div>
    );
}
