// components/ConnectWallet.jsx
// ============================================================
// MetaMask Connect Button — with mobile deeplink support
// ============================================================

import { useWallet } from "../context/WalletContext";

const CHAIN_NAME = import.meta.env.VITE_CHAIN_NAME || "Sepolia Testnet";
const CHAIN_ID = import.meta.env.VITE_CHAIN_ID || "11155111";
const DAPP_URL = typeof window !== "undefined" ? window.location.host : "";

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
}

function isInMetaMaskBrowser() {
    return window.ethereum?.isMetaMask && isMobileDevice();
}

export default function ConnectWallet() {
    const { connect, loading, error } = useWallet();

    const hasEthereum = typeof window !== "undefined" && !!window.ethereum;
    const onMobileWithoutMetaMask = isMobileDevice() && !hasEthereum;

    const handleOpenInMetaMask = () => {
        // MetaMask mobile deeplink — opens the dApp inside MetaMask's browser
        window.location.href = `https://metamask.app.link/dapp/${DAPP_URL}`;
    };

    return (
        <div className="flex flex-col items-center gap-4" style={{ maxWidth: "400px", margin: "0 auto" }}>
            {onMobileWithoutMetaMask ? (
                <>
                    {/* Mobile: MetaMask not detected — show deeplink */}
                    <button
                        onClick={handleOpenInMetaMask}
                        className="btn btn-primary text-base px-8 py-3 animate-pulse-glow"
                        style={{ width: "100%" }}
                    >
                        🦊 Open in MetaMask
                    </button>
                    <p className="text-surface-700/50 text-xs text-center" style={{ lineHeight: 1.5 }}>
                        MetaMask app required. Tap the button above to open this page inside MetaMask's built-in browser.
                    </p>
                    <a
                        href="https://metamask.io/download/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-500 text-xs underline"
                    >
                        Don't have MetaMask? Download here
                    </a>
                </>
            ) : (
                <>
                    {/* Desktop or MetaMask mobile browser */}
                    <button
                        onClick={connect}
                        disabled={loading}
                        className="btn btn-primary text-base px-8 py-3 animate-pulse-glow"
                        style={{ width: "100%" }}
                    >
                        {loading ? (
                            <>
                                <span className="animate-spin">⟳</span> Connecting...
                            </>
                        ) : (
                            <>🦊 Connect MetaMask</>
                        )}
                    </button>

                    {error && (
                        <p className="text-danger-500 text-sm text-center" style={{ wordBreak: "break-word" }}>
                            ⚠️ {error}
                        </p>
                    )}

                    <p className="text-surface-300 text-xs text-center" style={{ lineHeight: 1.5 }}>
                        Make sure MetaMask is connected to{" "}
                        <strong>{CHAIN_NAME}</strong> network
                        <br />
                        <span className="mono text-surface-700/40">
                            (Chain ID: {CHAIN_ID})
                        </span>
                    </p>
                </>
            )}
        </div>
    );
}
