import { useSimulator } from "../context/SimulatorContext";

export default function TopBar() {
  const { activeTab, isOnline, serverVersion, sidebarOpen, setSidebarOpen } = useSimulator();

  return (
    <header className="top-bar">
      <div style={{ display: "flex", alignItems: "center" }}>
        <button
          className="menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="top-bar-title">
          {activeTab === "dashboard" && "OCPI 漫遊中心 & 拓撲架構"}
          {activeTab === "cpo-sim" && "CPO 模擬充電站控制面板"}
          {activeTab === "hub-router" && "HUB 智能路由與轉送通道"}
          {activeTab === "autocharge" && "AutoCharge 雲端車輛映射庫"}
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <div
          className={`server-status-badge ${!isOnline ? "offline" : ""}`}
        >
          <span className="status-dot"></span>
          {isOnline ? `Mock HUB (OCPI ${serverVersion})` : "Disconnected"}
        </div>
      </div>
    </header>
  );
}
