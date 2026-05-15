// components/ConfirmDialog.jsx
// ============================================================
// Reusable confirmation dialog for destructive actions
// ============================================================

export default function ConfirmDialog({ isOpen, title, message, confirmLabel, cancelLabel, variant, onConfirm, onCancel }) {
    if (!isOpen) return null;

    const variantClass = variant === "danger" ? "btn-danger" : "btn-primary";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
            onClick={onCancel}
        >
            <div
                className="glass-card animate-fade-in"
                style={{
                    maxWidth: "420px",
                    width: "calc(100% - 32px)",
                    margin: "16px",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-surface-900 font-bold text-base mb-2">{title}</h3>
                <p className="text-surface-700/60 text-sm mb-6">{message}</p>

                <div className="flex gap-3 justify-end">
                    <button onClick={onCancel} className="btn btn-ghost text-sm">
                        {cancelLabel || "Cancel"}
                    </button>
                    <button onClick={onConfirm} className={`btn ${variantClass} text-sm`}>
                        {confirmLabel || "Confirm"}
                    </button>
                </div>
            </div>
        </div>
    );
}
