import { useSimulator } from "../context/SimulatorContext";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import FlowDiagram from "../components/FlowDiagram";
import TerminalConsole from "../components/TerminalConsole";
import ToastContainer from "../components/ToastContainer";

// Import 5 new tabs
import Dashboard from "./Dashboard";
import CpoSimPage from "./CpoSimPage";
import EmspSimPage from "./EmspSimPage";
import HubRouterPage from "./HubRouterPage";
// import AutoChargePage from "./AutoChargePage";

export default function CpoDashboard() {
  const { activeTab, terminalExpanded } = useSimulator();

  return (
    <div className={`app-container ${!terminalExpanded ? "terminal-collapsed" : ""}`}>
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Workspace */}
      <main className="main-content">
        {/* Top Header */}
        <TopBar />

        <div className="workspace">
          {/* CPO -> HUB -> EMSP Flow Diagram */}
          <FlowDiagram />

          {/* Tab Renderers */}
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "cpo-sim" && <CpoSimPage />}
          {activeTab === "emsp-sim" && <EmspSimPage />}
          {activeTab === "hub-router" && <HubRouterPage />}
          {/* {activeTab === "autocharge" && <AutoChargePage />} */}
        </div>
      </main>

      {/* macOS Terminal Logs Console */}
      <TerminalConsole />

      {/* Elegant Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
