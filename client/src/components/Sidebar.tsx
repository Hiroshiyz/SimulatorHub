import { useSimulator } from "../context/SimulatorContext";
import { Zap, Cpu, Layers, UserCheck } from "./Icons";

export default function Sidebar() {
  const {
    activeTab,
    setActiveTab,
    isOnline,
    sidebarOpen,
    setSidebarOpen,
    sessions,
  } = useSimulator();

  const activeSessionsCount = sessions.filter(
    (s) => s.status === "ACTIVE",
  ).length;

  return (
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="brand-section">
        <div
          className="brand-logo"
          style={{
            width: "auto",
            padding: "0 10px",
            fontSize: "13px",
            textTransform: "uppercase",
          }}
        >
          smart HUB
        </div>
        <span className="brand-name" style={{ textTransform: "uppercase" }}>
          Simulator
        </span>
      </div>

      <ul className="nav-links">
        <li>
          <a
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("dashboard");
              setSidebarOpen(false);
            }}
          >
            <Zap size={18} />
            Dashboard
          </a>
        </li>
        <li>
          <a
            className={`nav-item ${activeTab === "cpo-sim" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("cpo-sim");
              setSidebarOpen(false);
            }}
          >
            <Cpu size={18} />
            Charger Simulator ({activeSessionsCount})
          </a>
        </li>
        <li>
          <a
            className={`nav-item ${activeTab === "emsp-sim" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("emsp-sim");
              setSidebarOpen(false);
            }}
          >
            <UserCheck size={18} />
            eMSP Simulator
          </a>
        </li>
        <li>
          <a
            className={`nav-item ${activeTab === "hub-router" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("hub-router");
              setSidebarOpen(false);
            }}
          >
            <Layers size={18} />
            HUB Dashboard
          </a>
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
        <p>Mock Hub Portal</p>
        <p style={{ marginTop: "4px" }}>
          Status: {isOnline ? "Online" : "Offline"}
        </p>
      </div>
    </aside>
  );
}
