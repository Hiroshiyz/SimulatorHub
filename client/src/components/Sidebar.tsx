import { useSimulator } from "../context/SimulatorContext";
import { Zap, Cpu, Layers, UserCheck } from "./Icons";

export default function Sidebar() {
  const {
    activeTab,
    setActiveTab,
    isOnline,
    sidebarOpen,
    setSidebarOpen,
    activeChargingSessions,
    emsps,
  } = useSimulator();

  const mockEmspIds = new Set(
    emsps
      .filter((emsp) => emsp.url?.includes("/mock-emsp/"))
      .map((emsp) => emsp.id),
  );
  const activeSessionsCount = Object.values(activeChargingSessions).filter(
    (session) => session.status === "ACTIVE" && session.emspId && mockEmspIds.has(session.emspId),
  ).length;

  return (
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="brand-section">
        <div className="brand-logo"><Zap size={19} /></div>
        <div className="brand-copy">
          <span className="brand-name">Simulator Hub</span>
          <span className="brand-subtitle">OCPI Operations</span>
        </div>
      </div>

      <ul className="nav-links">
        <li className="nav-section-label">營運中心</li>
        <li>
          <button
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("dashboard");
              setSidebarOpen(false);
            }}
          >
            <Zap size={18} />
            <span><strong>營運總覽</strong><small>即時狀態與快速操作</small></span>
          </button>
        </li>
        <li className="nav-section-label">模擬操作</li>
        <li>
          <button
            className={`nav-item ${activeTab === "cpo-sim" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("cpo-sim");
              setSidebarOpen(false);
            }}
          >
            <Cpu size={18} />
            <span><strong>本機 Mock 測試</strong><small>內建 CPO、eMSP 與充電流程</small></span>
            {activeSessionsCount > 0 && <b className="nav-count">{activeSessionsCount}</b>}
          </button>
        </li>
        <li>
          <button
            className={`nav-item ${activeTab === "emsp-sim" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("emsp-sim");
              setSidebarOpen(false);
            }}
          >
            <UserCheck size={18} />
            <span><strong>實體 eMSP 串接</strong><small>CPO 狀態、SoC 與 Session 回傳</small></span>
          </button>
        </li>
        <li className="nav-section-label">HUB 管理</li>
        <li>
          <button
            className={`nav-item ${activeTab === "hub-router" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("hub-router");
              setSidebarOpen(false);
            }}
          >
            <Layers size={18} />
            <span><strong>路由與租戶</strong><small>CPO / eMSP 通道管理</small></span>
          </button>
        </li>
        {/* <li>
          <a
            className={`nav-item ${activeTab === "autocharge" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("autocharge");
              setSidebarOpen(false);
            }}
          >
            <Flame size={18} />
            AutoCharge
          </a>
        </li> */}
      </ul>

      <div className="sidebar-footer">
        <span className={`sidebar-status-dot ${isOnline ? "online" : ""}`} />
        <div><strong>{isOnline ? "系統運作中" : "服務未連線"}</strong><small>Mock HUB · OCPI 2.2.1</small></div>
      </div>
    </aside>
  );
}
