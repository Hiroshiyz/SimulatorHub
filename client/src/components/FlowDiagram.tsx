import { useSimulator } from "../context/SimulatorContext";

export default function FlowDiagram() {
  const { flowStep } = useSimulator();

  return (
    <div className="flow-diagram-container">
      <label
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        OCPI Roaming Data Pipeline Flow
      </label>
      <div style={{ position: "relative" }}>
        <svg className="flow-diagram-svg" viewBox="0 0 500 70">
          {/* Connecting Lines */}
          <path
            d="M 100 35 L 250 35"
            className={`flow-path ${flowStep === "cpo" || flowStep === "hub" ? "active" : ""}`}
          />
          <path
            d="M 250 35 L 400 35"
            className={`flow-path ${flowStep === "hub" || flowStep === "emsp" ? "active" : ""}`}
          />

          {/* Animated Pulse Circles */}
          {flowStep === "cpo" && (
            <circle cx="100" cy="35" r="5" className="pulse-circle">
              <animate
                attributeName="cx"
                from="100"
                to="250"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </circle>
          )}
          {flowStep === "hub" && (
            <circle cx="250" cy="35" r="5" className="pulse-circle">
              <animate
                attributeName="cx"
                from="250"
                to="400"
                dur="0.8s"
                repeatCount="indefinite"
              />
            </circle>
          )}

          {/* Node CPO */}
          <rect
            x="20"
            y="10"
            width="80"
            height="50"
            rx="8"
            className={`flow-node ${flowStep === "cpo" ? "active" : ""}`}
          />
          <text x="60" y="32" className="flow-node-text">
            CPO Simulator
          </text>
          <text x="60" y="48" className="flow-node-sub">
            (充電樁端)
          </text>

          {/* Node HUB */}
          <rect
            x="210"
            y="10"
            width="80"
            height="50"
            rx="8"
            className={`flow-node ${flowStep === "hub" ? "active" : ""}`}
          />
          <text x="250" y="32" className="flow-node-text">
            Mock HUB
          </text>
          <text x="250" y="48" className="flow-node-sub">
            (漫遊中心)
          </text>

          {/* Node EMSP */}
          <rect
            x="400"
            y="10"
            width="80"
            height="50"
            rx="8"
            className={`flow-node ${flowStep === "emsp" ? "active" : ""}`}
          />
          <text x="440" y="32" className="flow-node-text">
            EMSP Server
          </text>
          <text x="440" y="48" className="flow-node-sub">
            (地端車主 App)
          </text>
        </svg>
      </div>
    </div>
  );
}
