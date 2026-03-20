// App.jsx
// ============================================================
// Main Application — Routing based on role
// ============================================================

import { useWallet, ROLES } from "./context/WalletContext";
import LandingPage from "./pages/LandingPage";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import { useState, useEffect } from "react";

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${type}`} onClick={onClose}>
      {type === "error" && "❌ "}
      {type === "success" && "✅ "}
      {type === "info" && "ℹ️ "}
      {message}
    </div>
  );
}

export default function App() {
  const { isConnected, isRegistered, role, error, setError } = useWallet();
  const [toast, setToast] = useState(null);

  // Show errors as toast
  useEffect(() => {
    if (error) {
      setToast({ message: error, type: "error" });
      // Clear error after showing
      const timer = setTimeout(() => setError(null), 5500);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  // Route based on state
  const renderPage = () => {
    if (!isConnected || !isRegistered) {
      return <LandingPage />;
    }

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
