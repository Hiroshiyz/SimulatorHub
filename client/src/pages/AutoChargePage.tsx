import { useSimulator } from "../context/SimulatorContext";
import { Plus, Trash2 } from "../components/Icons";

export default function AutoChargePage() {
  const {
    autoCharges,
    setAutoCharges,
    emsps,
    handleAddAutoCharge,
    newMac,
    setNewMac,
    newModel,
    setNewModel,
    newToken,
    setNewToken,
    newEmsp,
    setNewEmsp,
    addLog,
  } = useSimulator();

  const handleRemoveMapping = (mac: string, model: string) => {
    setAutoCharges((prev) => prev.filter((m) => m.mac !== mac));
    addLog("CPO_SIM", "DELETE_AUTOCHARGE", `車輛 ${model} 的 AutoCharge 配對已被移除`, "warning");
  };

  return (
    <div className="workspace">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        
        {/* Register vehicle form */}
        <div className="card">
          <h3 className="card-title">
            <Plus size={18} style={{ color: "var(--accent-red)" }} />
            <span>註冊 AutoCharge 新車輛</span>
          </h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", lineHeight: "1.6" }}>
            在此註冊車輛 MAC 地址或晶片代號，並與對應的 eMSP 虛擬卡號 Token 進行關聯，達成「插槍即充」免授權。
          </p>

          <form onSubmit={handleAddAutoCharge} style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" }}>
            <div className="form-group">
              <label>車輛識別 MAC (e.g. AA:BB:CC:...)</label>
              <input
                type="text"
                required
                placeholder="00:11:22:33:44:55"
                value={newMac}
                onChange={(e) => setNewMac(e.target.value)}
                style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
              />
            </div>

            <div className="form-group">
              <label>車輛名稱/型號 (e.g. Model Y)</label>
              <input
                type="text"
                required
                placeholder="Model Y Long Range"
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>綁定 OCPI Token ID (虛擬卡號)</label>
              <input
                type="text"
                required
                placeholder="TW-EVO-889900"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
                style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
              />
            </div>

            <div className="form-group">
              <label>歸屬 eMSP</label>
              <select value={newEmsp} onChange={(e) => setNewEmsp(e.target.value)}>
                {emsps.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="button" style={{ marginTop: "8px" }}>
              <span>寫入 CPO 與 HUB 比對庫</span>
            </button>
          </form>
        </div>

        {/* Database table view */}
        <div className="card">
          <h3 className="card-title">AutoCharge 雲端對稱數據表</h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
            已配對之車輛 MAC 與合約憑證。當插槍時，系統以此映射表自動請求遠端 eMSP 開放充電。
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "20px" }}>
            {autoCharges.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: "13px" }}>
                暫無配對資料。
              </div>
            ) : (
              autoCharges.map((item) => (
                <div
                  key={item.mac}
                  style={{
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "8px",
                    padding: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 600 }}>{item.vehicleModel}</span>
                      <span
                        style={{
                          fontSize: "9px",
                          background: "rgba(255,255,255,0.06)",
                          color: "var(--text-secondary)",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          border: "1px solid var(--glass-border)",
                        }}
                      >
                        {item.emspId}
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      MAC: {item.mac}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--accent-blue)", fontFamily: "var(--font-mono)" }}>
                      OCPI Token: {item.tokenUid}
                    </span>
                  </div>

                  <button
                    onClick={() => handleRemoveMapping(item.mac, item.vehicleModel)}
                    className="button button-secondary"
                    style={{
                      padding: "8px",
                      borderColor: "rgba(239, 68, 68, 0.15)",
                      color: "var(--accent-red)",
                      background: "rgba(239, 68, 68, 0.05)",
                    }}
                    title="刪除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
