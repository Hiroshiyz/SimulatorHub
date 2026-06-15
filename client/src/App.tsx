import { SimulatorProvider } from "./context/SimulatorContext";
import CpoDashboard from "./pages/CpoDashboard";

export default function App() {
  return (
    <SimulatorProvider>
      <CpoDashboard />
    </SimulatorProvider>
  );
}
