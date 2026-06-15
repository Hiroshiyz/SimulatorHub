import { useSimulator } from "../context/SimulatorContext";


export default function TerminalConsole() {
  const {
    logs,
    setLogs,
    terminalExpanded,
    setTerminalExpanded,
    filterMethod,
    setFilterMethod,
    terminalBodyRef,
    addLog,
  } = useSimulator();

  // Filter logs by module if selected, or by method/action
  const filteredLogs = logs.filter((log) => {
    if (filterMethod === "ALL") return true;
    return log.module === filterMethod;
  });

  return (
    <section className={`mac-terminal ${terminalExpanded ? "expanded" : ""}`}>
      <header
        className="mac-titlebar"
        onClick={() => setTerminalExpanded(!terminalExpanded)}
        style={{ cursor: "pointer" }}
      >
        <div className="mac-buttons" onClick={(e) => e.stopPropagation()}>
          <div
            className="mac-btn close"
            onClick={() => {
              setLogs([]);
              addLog("SYSTEM", "CLEAR", "Log 終端緩衝區已清除", "success");
            }}
            title="Clear terminal"
          ></div>
          <div
            className="mac-btn minimize"
            onClick={() => setTerminalExpanded(false)}
            title="Minimize terminal"
          ></div>
          <div
            className="mac-btn maximize"
            onClick={() => setTerminalExpanded(!terminalExpanded)}
            title="Maximize terminal"
          ></div>
        </div>
        <span className="mac-title">
          guest@mock-hub: ~ -zsh ── {logs.length} logs
        </span>
      </header>

      <div className="mac-term-body" ref={terminalBodyRef}>
        <div className="terminal-welcome">
          <p>Last login: {new Date().toDateString()} on ttys001</p>
          <p>
            Welcome to OCPI Mock Hub activity monitor. Output streams from
            local port 3030.
          </p>
          <p style={{ marginTop: "4px" }}>
            Real-time telemetry and broking between CPO, Central HUB, and eMSPs.
          </p>
        </div>

        {filteredLogs.length === 0 ? (
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: "12px",
              padding: "10px 0",
            }}
          >
            <span className="terminal-prompt">$ </span>tail -f /var/log/ocpi-roaming.log
            <p style={{ marginTop: "12px", fontStyle: "italic" }}>
              --- 暫無傳輸日誌 ---
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            let colorClass = "var(--text-secondary)";
            if (log.type === "success") colorClass = "var(--accent-green)";
            if (log.type === "warning") colorClass = "var(--accent-yellow)";
            if (log.type === "error") colorClass = "var(--accent-red)";
            if (log.type === "info") colorClass = "var(--accent-blue)";

            let moduleBadgeColor = "rgba(255, 255, 255, 0.05)";
            let moduleBadgeText = "var(--text-muted)";
            let borderStyle = "1px solid var(--glass-border)";

            if (log.module === "HUB") {
              moduleBadgeColor = "rgba(239, 68, 68, 0.1)";
              moduleBadgeText = "var(--accent-red)";
              borderStyle = "1px solid rgba(239, 68, 68, 0.2)";
            } else if (log.module === "eMSP") {
              moduleBadgeColor = "rgba(16, 185, 129, 0.1)";
              moduleBadgeText = "var(--accent-green)";
              borderStyle = "1px solid rgba(16, 185, 129, 0.2)";
            } else if (log.module === "CPO_SIM") {
              moduleBadgeColor = "rgba(14, 165, 233, 0.1)";
              moduleBadgeText = "var(--accent-blue)";
              borderStyle = "1px solid rgba(14, 165, 233, 0.2)";
            }

            return (
              <div
                key={log.id}
                className={`log-entry-mac`}
                style={{
                  borderLeft: `3px solid ${
                    log.type === "success"
                      ? "var(--accent-green)"
                      : log.type === "error"
                      ? "var(--accent-red)"
                      : log.type === "warning"
                      ? "var(--accent-yellow)"
                      : "var(--glass-border)"
                  }`,
                  background: "rgba(255, 255, 255, 0.01)",
                  borderTop: "1px solid var(--glass-border)",
                  borderRight: "1px solid var(--glass-border)",
                  borderBottom: "1px solid var(--glass-border)",
                }}
              >
                <div className="log-entry-header">
                  <span>[{log.time}]</span>
                  <span
                    style={{
                      background: moduleBadgeColor,
                      color: moduleBadgeText,
                      border: borderStyle,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "9px",
                      fontWeight: 700,
                    }}
                  >
                    {log.module}
                  </span>
                </div>

                <div style={{ marginTop: "6px" }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: 600, marginRight: "6px" }}>
                    [{log.action}]
                  </span>
                  <span style={{ color: colorClass }}>{log.detail}</span>
                </div>

                {!!log.payload && (
                  <details className="log-details">
                    <summary>Request Payload</summary>
                    <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                  </details>
                )}

                {!!log.response && (
                  <details className="log-details">
                    <summary>Response Body</summary>
                    <pre>{JSON.stringify(log.response, null, 2)}</pre>
                  </details>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="term-controls">
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            過濾模組:
          </label>
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            style={{
              padding: "4px 8px",
              fontSize: "12px",
              background: "rgba(0,0,0,0.5)",
              height: "28px",
            }}
          >
            <option value="ALL">ALL (全部)</option>
            <option value="SYSTEM">SYSTEM</option>
            <option value="CPO_SIM">CPO_SIM</option>
            <option value="HUB">HUB</option>
            <option value="eMSP">eMSP</option>
          </select>
        </div>
        <button
          className="button button-secondary"
          style={{ padding: "4px 10px", fontSize: "12px", height: "28px" }}
          onClick={() => {
            setLogs([]);
            addLog("SYSTEM", "CLEAR", "Log 終端緩衝區已清除", "success");
          }}
        >
          清除 (Clear)
        </button>
      </div>
    </section>
  );
}
