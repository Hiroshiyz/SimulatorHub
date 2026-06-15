import { useSimulator } from "../context/SimulatorContext";
import { Zap, Cpu, Database, Share2, ArrowRight, Square } from "../components/Icons";

export default function Dashboard() {
  const {
    sessions,
    activeChargingSessions,
    stopSimulatedCharging,
    emsps,
  } = useSimulator();

  const activeCount = Object.keys(activeChargingSessions).length;
  
  // Calculate total session database statistics
  const totalKwh = sessions.reduce((acc, curr) => acc + (curr.kwh || 0), 0);
  const totalCost = sessions.reduce((acc, curr) => {
    const raw = curr.rawJson as { total_cost?: { incl_vat?: number } } | undefined;
    const cost = raw?.total_cost?.incl_vat || 0;
    return acc + cost;
  }, 0);

  return (
    <div className="workspace">
      {/* Metrics Row */}
      <div className="status-grid">
        <div className="card status-card">
          <span className="label">當前正在充電</span>
          <div className="value">{activeCount}</div>
          <div className="charging-bar-container" style={{ height: "4px" }}>
            <div
              className="charging-bar-fill"
              style={{
                width: `${Math.min(100, (activeCount / 4) * 100)}%`,
                background: "linear-gradient(90deg, var(--accent-red), var(--accent-purple))",
              }}
            ></div>
          </div>
        </div>

        <div className="card status-card">
          <span className="label">本節累計充電量</span>
          <div className="value">
            {totalKwh.toFixed(1)} <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>kWh</span>
          </div>
        </div>

        <div className="card status-card">
          <span className="label">總結算金額</span>
          <div className="value">
            ${totalCost.toFixed(1)} <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>TWD</span>
          </div>
        </div>

        <div className="card status-card">
          <span className="label">AutoCharge 授權率</span>
          <div className="value" style={{ color: "var(--accent-green)" }}>
            100%
          </div>
        </div>
      </div>

      {/* Topology Map */}
      <div className="card">
        <h3 className="card-title">
          <Share2 size={18} style={{ color: "var(--accent-purple)" }} />
          <span>OCPI 數據交換拓撲 (CPO ➔ HUB ➔ eMSP)</span>
        </h3>
        
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(5, 7, 18, 0.4)",
            border: "1px solid var(--glass-border)",
            borderRadius: "12px",
            padding: "32px",
            marginTop: "16px",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          {/* CPO Node */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--glass-border)",
              borderRadius: "8px",
              padding: "16px",
              width: "180px",
              textAlign: "center",
            }}
          >
            <Database size={32} style={{ color: "var(--accent-blue)", marginBottom: "8px" }} />
            <span style={{ fontSize: "14px", fontWeight: 600 }}>TWCPO 模擬器</span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>台灣站點控制台</span>
            <div
              style={{
                marginTop: "12px",
                fontSize: "10px",
                background: "rgba(56, 189, 248, 0.1)",
                color: "var(--accent-blue)",
                padding: "2px 8px",
                borderRadius: "4px",
                fontFamily: "var(--font-mono)",
              }}
            >
              Locations / Tariffs
            </div>
          </div>

          {/* Arrow 1 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, minWidth: "40px" }}>
            <ArrowRight size={20} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
              Sessions/CDRs
            </span>
          </div>

          {/* HUB Node */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(157, 78, 221, 0.05)",
              border: "2px solid var(--accent-red)",
              borderRadius: "8px",
              padding: "20px",
              width: "220px",
              textAlign: "center",
              boxShadow: "0 0 15px rgba(239, 68, 68, 0.15)",
            }}
          >
            <Cpu size={36} style={{ color: "var(--accent-red)", marginBottom: "8px" }} />
            <span style={{ fontSize: "15px", fontWeight: 700 }}>OCPI CENTRAL HUB</span>
            <span style={{ fontSize: "11px", color: "var(--accent-red)", marginTop: "4px" }}>數據分發與中繼站</span>
            <div style={{ marginTop: "12px", display: "flex", gap: "6px" }}>
              <span
                style={{
                  fontSize: "9px",
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "var(--accent-red)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                }}
              >
                Routing Table
              </span>
            </div>
          </div>

          {/* Arrow 2 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexGrow: 1, minWidth: "40px" }}>
            <ArrowRight size={20} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: "9px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>
              Filtered Forward
            </span>
          </div>

          {/* eMSPs Node Group */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "200px" }}>
            {emsps.map((emsp) => (
              <div
                key={emsp.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "6px",
                  padding: "8px 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: emsp.active ? "var(--accent-green)" : "var(--text-muted)",
                      boxShadow: emsp.active ? "0 0 8px var(--accent-green)" : "none",
                    }}
                  ></span>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{emsp.name}</span>
                </div>
                <span style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                  {emsp.countryCode}-{emsp.partyId}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Charging Sessions Grid */}
      <div className="card">
        <h3 className="card-title">
          <Zap size={18} style={{ color: "var(--accent-red)" }} />
          <span>當前活動充電會話 (Active Sessions)</span>
        </h3>

        {activeCount === 0 ? (
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "14px",
            }}
          >
            🔋 目前無任何充電活動。請至「多樁充電模擬」進行插槍啟動。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
            {Object.values(activeChargingSessions).map((session) => (
              <div
                key={session.sessionId}
                style={{
                  background: "rgba(255, 255, 255, 0.01)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "24px",
                  flexWrap: "wrap",
                }}
              >
                {/* Session Details */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "180px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "14px" }}>
                      {session.sessionId}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        background: "rgba(157, 78, 221, 0.15)",
                        color: "var(--accent-purple)",
                        border: "1px solid rgba(157, 78, 221, 0.3)",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {session.evseUid}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    啟動時間: {new Date(session.startTime).toLocaleTimeString()}
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ flexGrow: 1, minWidth: "200px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>電量 SoC {session.soc}%</span>
                    <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      120 kW (DC)
                    </span>
                  </div>
                  <div className="charging-bar-container">
                    <div className="charging-bar-fill" style={{ width: `${session.soc}%` }}></div>
                  </div>
                </div>

                {/* Costs & Telemetry metrics */}
                <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "16px", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                      {session.kwh.toFixed(2)} kWh
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--accent-green)", fontWeight: 500 }}>
                      ${session.cost.toFixed(1)} TWD
                    </div>
                  </div>

                  <button
                    onClick={() => stopSimulatedCharging(session.evseUid)}
                    className="button button-secondary"
                    style={{
                      padding: "8px 12px",
                      background: "rgba(239, 68, 68, 0.15)",
                      color: "var(--accent-red)",
                      borderColor: "rgba(239, 68, 68, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "36px",
                    }}
                    title="停止充電"
                  >
                    <Square size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
