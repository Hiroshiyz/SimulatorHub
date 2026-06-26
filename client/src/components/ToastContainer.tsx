import { useSimulator } from "../context/SimulatorContext";
import { CheckCircle, AlertTriangle } from "./Icons";

export default function ToastContainer() {
  const { toasts, removeToast } = useSimulator();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        let iconNode: React.ReactNode = null;

        if (toast.type === "success") {
          iconNode = <CheckCircle size={18} style={{ color: "var(--accent-green)" }} />;
        } else if (toast.type === "error") {
          iconNode = <AlertTriangle size={18} style={{ color: "var(--accent-red)" }} />;
        } else if (toast.type === "warning") {
          iconNode = <AlertTriangle size={18} style={{ color: "var(--accent-yellow)" }} />;
        } else if (toast.type === "info") {
          iconNode = <CheckCircle size={18} style={{ color: "var(--accent-blue)" }} />;
        }

        return (
          <div key={toast.id} className={`toast-item ${toast.type}`}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {iconNode}
            </div>
            <div className="toast-content">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="toast-close-btn"
              title="Close"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}
