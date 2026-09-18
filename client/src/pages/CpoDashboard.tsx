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

      <main className="main-content">
        <TopBar />

        <div className="page-scroll">
          {activeTab !== "dashboard" && <FlowDiagram />}
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "cpo-sim" && <CpoSimPage />}
          {activeTab === "emsp-sim" && <EmspSimPage />}
          {activeTab === "hub-router" && <HubRouterPage />}
          {/* {activeTab === "autocharge" && <AutoChargePage />} */}
        </div>
      </main>

      <TerminalConsole />

      {/* Elegant Toast Notifications */}
      <ToastContainer />
    </div>
  );
}
