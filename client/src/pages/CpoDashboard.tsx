import { useSimulator } from "../context/SimulatorContext";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import FlowDiagram from "../components/FlowDiagram";
import TerminalConsole from "../components/TerminalConsole";

// Import 5 new tabs
import Dashboard from "./Dashboard";
import CpoSimPage from "./CpoSimPage";
import HubRouterPage from "./HubRouterPage";
// import AutoChargePage from "./AutoChargePage";
import PayloadPage from "./PayloadPage";

export default function CpoDashboard() {
  const { activeTab } = useSimulator();

  return (
    <div className="app-container">
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
          {activeTab === "hub-router" && <HubRouterPage />}
          {/* {activeTab === "autocharge" && <AutoChargePage />} */}
          {activeTab === "ocpi-payload" && <PayloadPage />}
        </div>
      </main>

      {/* macOS Terminal Logs Console */}
      <TerminalConsole />
    </div>
  );
}
