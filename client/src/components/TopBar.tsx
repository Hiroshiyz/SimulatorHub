import { useSimulator } from "../context/SimulatorContext";
import { Terminal, Zap } from "./Icons";

const pageMeta = {
  dashboard: ["營運總覽", "掌握 HUB 與充電模擬的即時狀態"],
  "cpo-sim": ["CPO 充電模擬", "選擇場站與槍頭，執行完整充電流程"],
  "emsp-sim": ["eMSP 指令模擬", "模擬漫遊服務商發送遠端充電指令"],
  "hub-router": ["HUB 路由與租戶", "管理 CPO、eMSP 與 OCPI 資料通道"],
  autocharge: ["AutoCharge", "管理車輛與充電身分映射"],
} as const;

export default function TopBar() {
  const { activeTab, setActiveTab, isOnline, serverVersion, sidebarOpen, setSidebarOpen, logs, terminalExpanded, setTerminalExpanded } = useSimulator();
  const [title, subtitle] = pageMeta[activeTab];

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
        <div className="top-bar-heading">
          <div className="top-bar-title">{title}</div>
          <div className="top-bar-subtitle">{subtitle}</div>
        </div>
      </div>

      <div className="top-bar-actions">
        <div
          className={`server-status-badge ${!isOnline ? "offline" : ""}`}
        >
          <span className="status-dot"></span>
          {isOnline ? `HUB Online · ${serverVersion}` : "HUB Offline"}
        </div>
        <button className="header-button secondary" onClick={() => setTerminalExpanded(!terminalExpanded)}>
          <Terminal size={16} /> 活動紀錄 <span className="header-count">{logs.length}</span>
        </button>
        {activeTab !== "cpo-sim" && (
          <button className="header-button primary" onClick={() => setActiveTab("cpo-sim")}>
            <Zap size={16} /> 開始模擬
          </button>
        )}
      </div>
    </header>
  );
}
