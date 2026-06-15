import { useSimulator } from "../context/SimulatorContext";
import { FileText } from "../components/Icons";
import type { OcpiCdr } from "../types/simulator";

export default function PayloadPage() {
  const {
    emsps,
    sessionPayloadEdit,
    setSessionPayloadEdit,
    cdrPayloadEdit,
    setCdrPayloadEdit,
    triggerManualSessionSend,
    triggerManualCdrSend,
    cdrs,
    transmitCdr,
  } = useSimulator();

  const handleUpdateSessionPayload = (field: string, value: unknown) => {
    if (!sessionPayloadEdit) return;
    const val = (field === "kwh" || field === "soc" || field === "total_cost") ? parseFloat(String(value)) || 0 : value;
    setSessionPayloadEdit((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: val,
      };
    });
  };

  const handleUpdateCdrPayload = (field: string, value: unknown) => {
    if (!cdrPayloadEdit) return;
    const val = (field === "total_energy" || field === "total_cost" || field === "total_time") ? parseFloat(String(value)) || 0 : value;
    setCdrPayloadEdit((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        [field]: val,
      };
    });
  };

  return (
    <div className="workspace">
      {/* 2-Column Parameter board */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        
        {/* Session payload board */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="card-title">
              <FileText size={18} style={{ color: "var(--accent-blue)" }} />
              <span>3. 模擬自定義 OCPI Session 參數</span>
            </h3>
            {sessionPayloadEdit && (
              <span style={{ fontSize: "10px", color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
                載入中: {sessionPayloadEdit.id}
              </span>
            )}
          </div>

          {sessionPayloadEdit ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label>Session ID (OCPI)</label>
                  <input
                    type="text"
                    value={sessionPayloadEdit.id}
                    onChange={(e) => handleUpdateSessionPayload("id", e.target.value)}
                    style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                  />
                </div>

                <div className="form-group">
                  <label>對接 eMSP ID</label>
                  <select
                    value={sessionPayloadEdit.emsp_id || ""}
                    onChange={(e) => handleUpdateSessionPayload("emsp_id", e.target.value)}
                  >
                    {emsps.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>累計電量 (kwh)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={sessionPayloadEdit.kwh}
                    onChange={(e) => handleUpdateSessionPayload("kwh", e.target.value)}
                    style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                  />
                </div>

                <div className="form-group">
                  <label>當前金額 (total_cost)</label>
                  <input
                    type="number"
                    step="1"
                    value={sessionPayloadEdit.total_cost?.incl_vat !== undefined ? sessionPayloadEdit.total_cost.incl_vat : 0}
                    onChange={(e) => {
                      const costVal = parseFloat(e.target.value) || 0;
                      if (sessionPayloadEdit.total_cost) {
                        setSessionPayloadEdit((prev) => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            total_cost: {
                              excl_vat: Number((costVal * 0.95).toFixed(2)),
                              incl_vat: costVal,
                            },
                          };
                        });
                      } else {
                        handleUpdateSessionPayload("total_cost", costVal);
                      }
                    }}
                    style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                  />
                </div>
              </div>

              {/* JSON preview */}
              <div className="form-group">
                <label>// OCPI Session Payload Preview</label>
                <textarea
                  readOnly
                  value={JSON.stringify(sessionPayloadEdit, null, 2)}
                  style={{ minHeight: "180px", color: "var(--text-secondary)" }}
                />
              </div>

              <button onClick={triggerManualSessionSend} className="button" style={{ width: "100%" }}>
                <span>傳送自訂 Session 給 HUB ➔</span>
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: "13px" }}>
              請先手動「啟動充電」來產生一個暫存 Session 用於修改測試。
            </div>
          )}
        </div>

        {/* CDR payload board */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="card-title">
              <FileText size={18} style={{ color: "var(--accent-green)" }} />
              <span>4. 模擬自定義 OCPI CDR 結算單</span>
            </h3>
            {cdrPayloadEdit && (
              <span style={{ fontSize: "10px", color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
                載入中: {cdrPayloadEdit.id}
              </span>
            )}
          </div>

          {cdrPayloadEdit ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="form-group">
                  <label>CDR ID (結算單號)</label>
                  <input
                    type="text"
                    value={cdrPayloadEdit.id}
                    onChange={(e) => handleUpdateCdrPayload("id", e.target.value)}
                    style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                  />
                </div>

                <div className="form-group">
                  <label>總充電時數 (total_time)</label>
                  <input
                    type="number"
                    step="1"
                    value={cdrPayloadEdit.total_time}
                    onChange={(e) => handleUpdateCdrPayload("total_time", e.target.value)}
                    style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                  />
                </div>

                <div className="form-group">
                  <label>總消耗度數 (total_energy)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={cdrPayloadEdit.total_energy}
                    onChange={(e) => handleUpdateCdrPayload("total_energy", e.target.value)}
                    style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                  />
                </div>

                <div className="form-group">
                  <label>結算金額 (total_cost)</label>
                  <input
                    type="number"
                    step="1"
                    value={cdrPayloadEdit.total_cost?.incl_vat !== undefined ? cdrPayloadEdit.total_cost.incl_vat : 0}
                    onChange={(e) => {
                      const costVal = parseFloat(e.target.value) || 0;
                      if (cdrPayloadEdit.total_cost) {
                        setCdrPayloadEdit((prev) => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            total_cost: {
                              excl_vat: Number((costVal * 0.95).toFixed(2)),
                              incl_vat: costVal,
                            },
                          };
                        });
                      } else {
                        handleUpdateCdrPayload("total_cost", costVal);
                      }
                    }}
                    style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                  />
                </div>
              </div>

              {/* JSON preview */}
              <div className="form-group">
                <label>// OCPI CDR Payload Preview</label>
                <textarea
                  readOnly
                  value={JSON.stringify(cdrPayloadEdit, null, 2)}
                  style={{ minHeight: "180px", color: "var(--text-secondary)" }}
                />
              </div>

              <button
                onClick={triggerManualCdrSend}
                className="button"
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, var(--accent-green), #059669)",
                  boxShadow: "0 4px 15px var(--accent-green-glow)",
                }}
              >
                <span>傳送自訂 CDR 結算單給 HUB ➔</span>
              </button>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-muted)", fontSize: "13px" }}>
              請在「儀表板」或「模擬器」中停止一個正在進行的充電，來生成最新的 CDR 單進行修改。
            </div>
          )}
        </div>

      </div>

      {/* CDR report view */}
      <div className="card">
        <h3 className="card-title">OCPI CDR (結算單報表) 發送狀態追蹤</h3>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
          {cdrs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: "13px" }}>
              目前無歷史結算單記錄。
            </div>
          ) : (
            cdrs.map((cdr) => {
              const raw = cdr.rawJson as OcpiCdr | undefined;
              const status = cdrPayloadEdit?.id === cdr.id ? (cdrPayloadEdit.transmission_status || "SUCCESS") : "SUCCESS";

              return (
                <div
                  key={cdr.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "rgba(255, 255, 255, 0.01)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "6px",
                    padding: "12px 16px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontWeight: 600 }}>{cdr.id}</span>
                    <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
                      度數: {(raw?.total_energy || 0).toFixed(1)} kWh | 金額: ${raw?.total_cost?.incl_vat || 0} TWD | 對接 eMSP: {raw?.emsp_id || "EMSP-A"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background: status === "SUCCESS" ? "rgba(16, 185, 129, 0.15)" : status === "FAILED" ? "rgba(239, 68, 68, 0.15)" : "rgba(255, 255, 255, 0.06)",
                        color: status === "SUCCESS" ? "var(--accent-green)" : status === "FAILED" ? "var(--accent-red)" : "var(--text-secondary)",
                        border: `1px solid ${status === "SUCCESS" ? "rgba(16, 185, 129, 0.3)" : status === "FAILED" ? "rgba(239, 68, 68, 0.3)" : "var(--glass-border)"}`,
                      }}
                    >
                      {status === "SUCCESS" ? "已成功結算" : status === "FAILED" ? "發送失敗" : "待處理"}
                    </span>

                    {status !== "SUCCESS" && (
                      <button
                        onClick={() => transmitCdr(cdr.id)}
                        className="button button-secondary"
                        style={{ padding: "4px 8px", fontSize: "11px", height: "28px" }}
                      >
                        手動推送 ➔
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
