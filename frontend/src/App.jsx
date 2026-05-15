// App.jsx
// ============================================================
// Main Application — Routing based on role & auth state
// ============================================================

import { useWallet, ROLES } from "./context/WalletContext";
import LandingPage from "./pages/LandingPage";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import KeyImportScreen from "./components/KeyImportScreen";
import { useState, useEffect } from "react";

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const iconMap = {
    error: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
      </svg>
    ),
    success: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    info: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
      </svg>
    ),
  };

  return (
    <div className={`toast toast-${type}`} onClick={onClose} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {iconMap[type]}
      {message}
    </div>
  );
}

export default function App() {
  const { isConnected, isRegistered, role, error, setError, privateKey } = useWallet();
  const [toast, setToast] = useState(null);
  const [skippedKeyImport, setSkippedKeyImport] = useState(false);

  // Show errors as toast
  useEffect(() => {
    if (error) {
      setToast({ message: error, type: "error" });
      // Clear error after showing
      const timer = setTimeout(() => setError(null), 5500);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  // Reset skip when user disconnects
  useEffect(() => {
    if (!isConnected) {
      setSkippedKeyImport(false);
    }
  }, [isConnected]);

  // Route based on state
  const renderPage = () => {
    // Step 1: Not connected or not registered → Landing Page
    if (!isConnected || !isRegistered) {
      return <LandingPage />;
    }

    // Step 2: Connected & registered, but no private key → Key Import Screen
    if (!privateKey && !skippedKeyImport) {
      return <KeyImportScreen onSkip={() => setSkippedKeyImport(true)} />;
    }

    // Step 3: Fully authenticated → Dashboard
    if (role === ROLES.PATIENT) {
      return <PatientDashboard />;
    }

    if (role === ROLES.DOCTOR) {
      return <DoctorDashboard />;
    }

    return <LandingPage />;
  };

  return (
    <>
      {renderPage()}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
