import { useState } from "react";
import { useSimulator } from "../context/SimulatorContext";

export default function StationsTab() {
  const {
    locations,
    initializeMockStations,
    selectedEvseUid,
    setSelectedEvseUid,
    customEvseStatus,
    setCustomEvseStatus,
    newSessionId,
    setNewSessionId,
    activeChargingSessions,
    sessionTemplate,
    setSessionTemplate,
    cdrTemplate,
    setCdrTemplate,
    handlePatchStatus,
    startSimulatedCharging,
    stopSimulatedCharging,
  } = useSimulator();

  // Find all EVSE details
  const allEvses = locations.flatMap((loc) =>
    loc.evses.map((e) => ({
      ...e,
      locationId: loc.id,
      locationName: loc.name,
    }))
  );

  const selectedEvse = allEvses.find((e) => e.uid === selectedEvseUid);

  // JSON editor local states
  const [sessionJsonText, setSessionJsonText] = useState(
    JSON.stringify(sessionTemplate, null, 2)
  );
  const [cdrJsonText, setCdrJsonText] = useState(
    JSON.stringify(cdrTemplate, null, 2)
  );

  const [sessionJsonError, setSessionJsonError] = useState<string | null>(null);
  const [cdrJsonError, setCdrJsonError] = useState<string | null>(null);

  const [activeTemplateTab, setActiveTemplateTab] = useState<"session" | "cdr">("session");

  // Handle JSON Text changes
  const handleSessionJsonChange = (val: string) => {
    setSessionJsonText(val);
    try {
      const parsed = JSON.parse(val);
      setSessionTemplate(parsed);
      setSessionJsonError(null);
    } catch (err: unknown) {
      setSessionJsonError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCdrJsonChange = (val: string) => {
    setCdrJsonText(val);
    try {
      const parsed = JSON.parse(val);
      setCdrTemplate(parsed);
      setCdrJsonError(null);
    } catch (err: unknown) {
      setCdrJsonError(err instanceof Error ? err.message : String(err));
    }
  };

  // Form helpers to update specific keys inside template
  const updateSessionTemplateKey = (path: string[], val: unknown) => {
    const updated = { ...sessionTemplate };
    let current = updated as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!current[key]) {
        current[key] = {};
      }
      current[key] = { ...(current[key] as Record<string, unknown>) };
      current = current[key] as Record<string, unknown>;
    }
    current[path[path.length - 1]] = val;
    setSessionTemplate(updated);
    setSessionJsonText(JSON.stringify(updated, null, 2));
  };

  const updateCdrTemplateKey = (path: string[], val: unknown) => {
    const updated = { ...cdrTemplate };
    let current = updated as Record<string, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!current[key]) {
        current[key] = {};
      }
      current[key] = { ...(current[key] as Record<string, unknown>) };
      current = current[key] as Record<string, unknown>;
    }
    current[path[path.length - 1]] = val;
    setCdrTemplate(updated);
    setCdrJsonText(JSON.stringify(updated, null, 2));
  };

  return (
    <>
      {locations.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: "center", padding: "40px 20px" }}
        >
          <h3 className="card-title" style={{ justifyContent: "center" }}>
            無任何站點資料
          </h3>
          <p
            style={{
              color: "var(--text-secondary)",
              marginBottom: "20px",
            }}
          >
            資料庫尚無 Locations。請至系統概觀頁面一鍵部署或傳送 Location 封包進行初始化。
          </p>
          <button className="button" onClick={initializeMockStations}>
            初始化部署 4 座充電樁
          </button>
        </div>
      ) : (
        <>
          <div className="card">
            <h3 className="card-title">
              充電樁選擇格點 (請選擇一具充電樁操作)
            </h3>
            <div className="evse-grid">
              {allEvses.map((evse) => {
                const localSim = activeChargingSessions[evse.uid];
                const displayStatus = localSim ? "CHARGING" : evse.status;

                return (
                  <div
                    key={evse.uid}
                    className={`evse-card ${selectedEvseUid === evse.uid ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedEvseUid(evse.uid);
                      setCustomEvseStatus(displayStatus);
                    }}
                  >
                    <div className="evse-header">
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                        }}
                      >
                        {evse.evse_id || "無編號"}
                      </span>
                      <span
                        className={`evse-badge ${displayStatus.toLowerCase()}`}
                      >
                        {displayStatus}
                      </span>
                    </div>

                    <div className="evse-visual">
                      <span
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "50%",
                          backgroundColor:
                            displayStatus === "CHARGING"
                              ? "var(--accent-purple)"
                              : displayStatus === "AVAILABLE"
                                ? "var(--accent-green)"
                                : displayStatus === "RESERVED"
                                  ? "var(--accent-yellow)"
                                  : displayStatus === "BLOCKED"
                                    ? "var(--accent-yellow)"
                                    : displayStatus === "PLANNED" ||
                                        displayStatus === "UNKNOWN"
                                      ? "var(--text-muted)"
                                      : "var(--accent-red)",
                          boxShadow: `0 0 8px currentColor`,
                          color:
                            displayStatus === "CHARGING"
                              ? "var(--accent-purple)"
                              : displayStatus === "AVAILABLE"
                                ? "var(--accent-green)"
                                : displayStatus === "RESERVED"
                                  ? "var(--accent-yellow)"
                                  : displayStatus === "BLOCKED"
                                    ? "var(--accent-yellow)"
                                    : displayStatus === "PLANNED" ||
                                        displayStatus === "UNKNOWN"
                                      ? "var(--text-muted)"
                                      : "var(--accent-red)",
                        }}
                      />
                    </div>

                    <div className="evse-telemetry-mini">
                      <div className="evse-telemetry-row">
                        <span>類型:</span>
                        <span>
                          {evse.rawJson?.connectors?.[0]?.power_type || "AC"}
                        </span>
                      </div>
                      <div className="evse-telemetry-row">
                        <span>功率:</span>
                        <span>
                          {evse.rawJson?.connectors?.[0]?.max_electric_power
                            ? `${evse.rawJson.connectors[0].max_electric_power / 1000}kW`
                            : "22kW"}
                        </span>
                      </div>
                      {localSim && (
                        <>
                          <div
                            className="evse-telemetry-row"
                            style={{
                              marginTop: "4px",
                              color: "var(--accent-purple)",
                            }}
                          >
                            <span>電池 SoC:</span>
                            <span>{localSim.soc}%</span>
                          </div>
                          <div className="charging-bar-container">
                            <div
                              className="charging-bar-fill"
                              style={{ width: `${localSim.soc}%` }}
                            ></div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedEvse && (
            <div className="card">
              <h3 className="card-title">
                充電樁控制中心 [{selectedEvse.evse_id || selectedEvse.uid}]
              </h3>
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                所屬站點：Location {selectedEvse.locationId} ({selectedEvse.locationName})
              </p>

              <div className="evse-quick-panel">
                {/* Status update */}
                <div className="form-group">
                  <label>模擬更變狀態 (PATCH Status)</label>
                  <div className="evse-control-actions">
                    <select
                      value={customEvseStatus}
                      onChange={(e) => setCustomEvseStatus(e.target.value)}
                      style={{ width: "180px" }}
                    >
                      <option value="AVAILABLE">AVAILABLE (空閒)</option>
                      <option value="CHARGING">CHARGING (充電中)</option>
                      <option value="RESERVED">RESERVED (預約)</option>
                      <option value="BLOCKED">BLOCKED (佔用中)</option>
                      <option value="OUTOFORDER">OUTOFORDER (故障)</option>
                      <option value="INOPERATIVE">INOPERATIVE (停用)</option>
                      <option value="PLANNED">PLANNED (規劃中)</option>
                      <option value="UNKNOWN">UNKNOWN (未知)</option>
                    </select>
                    <button
                      className="button button-secondary"
                      onClick={() =>
                        handlePatchStatus(
                          selectedEvse.locationId,
                          selectedEvse.uid,
                          customEvseStatus
                        )
                      }
                    >
                      更新狀態 (PATCH)
                    </button>
                  </div>
                </div>

                {/* Transaction Simulator */}
                <div
                  className="form-group"
                  style={{
                    borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                    paddingTop: "16px",
                  }}
                >
                  <label>交易生命週期模擬 (Transaction Lifecycle)</label>

                  {activeChargingSessions[selectedEvse.uid] ? (
                    <div
                      style={{
                        background: "rgba(14, 165, 233, 0.06)",
                        borderRadius: "8px",
                        padding: "16px",
                      }}
                    >
                      <p
                        style={{
                          color: "white",
                          fontWeight: 600,
                          marginBottom: "8px",
                        }}
                      >
                        模擬充電進行中...
                      </p>
                      <div
                        className="form-grid"
                        style={{
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: "12px",
                          marginBottom: "16px",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            已充入電量
                          </span>
                          <span style={{ fontSize: "18px", fontWeight: "bold", color: "white" }}>
                            {activeChargingSessions[selectedEvse.uid].kwh} kWh
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            電池 SoC
                          </span>
                          <span style={{ fontSize: "18px", fontWeight: "bold", color: "white" }}>
                            {activeChargingSessions[selectedEvse.uid].soc} %
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            累計金額
                          </span>
                          <span style={{ fontSize: "18px", fontWeight: "bold", color: "white" }}>
                            {activeChargingSessions[selectedEvse.uid].cost} TWD
                          </span>
                        </div>
                      </div>
                      <button
                        className="button"
                        style={{ background: "var(--accent-red)" }}
                        onClick={() => stopSimulatedCharging(selectedEvse.uid)}
                      >
                        停止充電並發送帳單 (Stop & Send CDR)
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder="自訂 Session ID (留空將自動隨機產生)"
                          value={newSessionId}
                          onChange={(e) => setNewSessionId(e.target.value)}
                          style={{ flexGrow: 1 }}
                        />
                        <button
                          className="button"
                          onClick={() =>
                            startSimulatedCharging(
                              selectedEvse.locationId,
                              selectedEvse.uid
                            )
                          }
                        >
                          開始充電 (Start Charge Session)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CPO Control Panel Enhancement: Parameter Customization Panel */}
          <div className="card" style={{ marginTop: "20px" }}>
            <h3 className="card-title">
              OCPI 漫遊傳輸封包自訂中心
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "16px" }}>
              在此修改發送至 HUB 漫遊中心的 Session 與 CDR 欄位模版。啟動充電、充電心跳、或結束帳單時將動態套用以下設定值。
            </p>

            {/* Sub-tab navigation */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", marginBottom: "16px" }}>
              <button
                className={`button ${activeTemplateTab === "session" ? "" : "button-secondary"}`}
                style={{
                  borderRadius: "8px 8px 0 0",
                  borderBottom: activeTemplateTab === "session" ? "2px solid var(--accent-purple)" : "none",
                  marginRight: "4px",
                  background: activeTemplateTab === "session" ? "rgba(255,255,255,0.05)" : "transparent",
                }}
                onClick={() => setActiveTemplateTab("session")}
              >
                Session 會話模版
              </button>
              <button
                className={`button ${activeTemplateTab === "cdr" ? "" : "button-secondary"}`}
                style={{
                  borderRadius: "8px 8px 0 0",
                  borderBottom: activeTemplateTab === "cdr" ? "2px solid var(--accent-purple)" : "none",
                  background: activeTemplateTab === "cdr" ? "rgba(255,255,255,0.05)" : "transparent",
                }}
                onClick={() => setActiveTemplateTab("cdr")}
              >
                CDR 帳單明細模版
              </button>
            </div>

            {activeTemplateTab === "session" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {/* Interactive Fields */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "white" }}>視覺化表單編輯</h4>
                    
                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>憑證 RFID Token UID (cdr_token.uid)</label>
                      <input
                        type="text"
                        value={sessionTemplate.cdr_token?.uid || ""}
                        onChange={(e) => updateSessionTemplateKey(["cdr_token", "uid"], e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>Token 類型 (cdr_token.type)</label>
                      <select
                        value={sessionTemplate.cdr_token?.type || "RFID"}
                        onChange={(e) => updateSessionTemplateKey(["cdr_token", "type"], e.target.value)}
                      >
                        <option value="RFID">RFID (實體卡片)</option>
                        <option value="APP_USER">APP_USER (App 用戶)</option>
                        <option value="OTHER">OTHER (其他)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>合約識別碼 (cdr_token.contract_id)</label>
                      <input
                        type="text"
                        value={sessionTemplate.cdr_token?.contract_id || ""}
                        onChange={(e) => updateSessionTemplateKey(["cdr_token", "contract_id"], e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>授權認證方式 (auth_method)</label>
                      <select
                        value={sessionTemplate.auth_method || "AUTH_REQUEST"}
                        onChange={(e) => updateSessionTemplateKey(["auth_method"], e.target.value)}
                      >
                        <option value="AUTH_REQUEST">AUTH_REQUEST (要求授權)</option>
                        <option value="COMMAND">COMMAND (中心遙控)</option>
                        <option value="WHITELIST">WHITELIST (本地白名單)</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>槍口編號 (connector_id)</label>
                      <input
                        type="text"
                        value={sessionTemplate.connector_id || "1"}
                        onChange={(e) => updateSessionTemplateKey(["connector_id"], e.target.value)}
                      />
                    </div>
                  </div>

                  {/* JSON Editor */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h4 style={{ margin: 0, fontSize: "14px", color: "white" }}>JSON 封包編輯器</h4>
                      {sessionJsonError ? (
                        <span style={{ fontSize: "11px", color: "var(--accent-red)" }}>格式錯誤：{sessionJsonError}</span>
                      ) : (
                        <span style={{ fontSize: "11px", color: "var(--accent-green)" }}>✓ JSON 格式正確</span>
                      )}
                    </div>
                    <textarea
                      value={sessionJsonText}
                      onChange={(e) => handleSessionJsonChange(e.target.value)}
                      style={{
                        flexGrow: 1,
                        minHeight: "280px",
                        fontFamily: "monospace",
                        fontSize: "12px",
                        background: "rgba(0,0,0,0.3)",
                        border: sessionJsonError ? "1px solid var(--accent-red)" : "1px solid rgba(255,255,255,0.1)",
                        color: "#a9b2c3",
                        padding: "10px",
                        borderRadius: "6px",
                        resize: "vertical",
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {/* Interactive Fields */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "white" }}>視覺化表單編輯</h4>

                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>國別碼 (ctr_code)</label>
                      <input
                        type="text"
                        value={cdrTemplate.ctr_code || "TW"}
                        onChange={(e) => updateCdrTemplateKey(["ctr_code"], e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>營運商 ID (party_id)</label>
                      <input
                        type="text"
                        value={cdrTemplate.party_id || "CPO"}
                        onChange={(e) => updateCdrTemplateKey(["party_id"], e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>憑證 RFID Token UID (cdr_token.uid)</label>
                      <input
                        type="text"
                        value={cdrTemplate.cdr_token?.uid || ""}
                        onChange={(e) => updateCdrTemplateKey(["cdr_token", "uid"], e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>合約識別碼 (cdr_token.contract_id)</label>
                      <input
                        type="text"
                        value={cdrTemplate.cdr_token?.contract_id || ""}
                        onChange={(e) => updateCdrTemplateKey(["cdr_token", "contract_id"], e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>授權認證方式 (auth_method)</label>
                      <select
                        value={cdrTemplate.auth_method || "AUTH_REQUEST"}
                        onChange={(e) => updateCdrTemplateKey(["auth_method"], e.target.value)}
                      >
                        <option value="AUTH_REQUEST">AUTH_REQUEST (要求授權)</option>
                        <option value="COMMAND">COMMAND (中心遙控)</option>
                        <option value="WHITELIST">WHITELIST (本地白名單)</option>
                      </select>
                    </div>
                  </div>

                  {/* JSON Editor */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h4 style={{ margin: 0, fontSize: "14px", color: "white" }}>JSON 封包編輯器</h4>
                      {cdrJsonError ? (
                        <span style={{ fontSize: "11px", color: "var(--accent-red)" }}>格式錯誤：{cdrJsonError}</span>
                      ) : (
                        <span style={{ fontSize: "11px", color: "var(--accent-green)" }}>✓ JSON 格式正確</span>
                      )}
                    </div>
                    <textarea
                      value={cdrJsonText}
                      onChange={(e) => handleCdrJsonChange(e.target.value)}
                      style={{
                        flexGrow: 1,
                        minHeight: "280px",
                        fontFamily: "monospace",
                        fontSize: "12px",
                        background: "rgba(0,0,0,0.3)",
                        border: cdrJsonError ? "1px solid var(--accent-red)" : "1px solid rgba(255,255,255,0.1)",
                        color: "#a9b2c3",
                        padding: "10px",
                        borderRadius: "6px",
                        resize: "vertical",
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
