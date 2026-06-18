import { useState } from "react";
import { useSimulator } from "../context/SimulatorContext";
import { Layers, RefreshCw, Plus } from "../components/Icons";

export default function HubRouterPage() {
  const {
    emsps,
    setEmsps,
    fetchEmspStatus,
    addLog,
    handleSyncAllLocations,
    cpos,
    handleAddCpo,
    handleAddEmsp,
    showToast,
  } = useSimulator();

  // CPO Form State
  const [cpoCountryCode, setCpoCountryCode] = useState("TW");
  const [cpoPartyId, setCpoPartyId] = useState("");
  const [cpoName, setCpoName] = useState("");
  const [cpoTokenB, setCpoTokenB] = useState("");

  // EMSP Form State
  const [emspCountryCode, setEmspCountryCode] = useState("TW");
  const [emspPartyId, setEmspPartyId] = useState("");
  const [emspName, setEmspName] = useState("");
  const [emspUrl, setEmspUrl] = useState("");
  const [emspTokenC, setEmspTokenC] = useState("");

  const toggleEmspChannel = (emspId: string) => {
    setEmsps((prev) =>
      prev.map((e) => {
        if (e.id === emspId) {
          const nextActive = !e.active;
          addLog(
            "HUB",
            "TOGGLE_EMSP_CHANNEL",
            `eMSP 通道 [${e.name}] 已${nextActive ? "開啟" : "關閉"}(${e.countryCode}-${e.partyId})`,
            nextActive ? "success" : "warning",
          );
          return { ...e, active: nextActive };
        }
        return e;
      }),
    );
  };

  return (
    <div className="workspace">
      {/* Topology Header */}
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 className="card-title" style={{ margin: 0 }}>
            <Layers size={18} style={{ color: "var(--accent-red)" }} />
            <span>CPO List</span>
          </h3>
          <button
            onClick={async () => {
              if (
                confirm(
                  "是否要將資料庫中現有的所有 CPO 場站資訊，補發/同步至所有已啟用的 EMSP 接收端？",
                )
              ) {
                const res = await handleSyncAllLocations();
                if (res.success) {
                  showToast(`成功補發同步 ${res.count} 筆場站資訊！`, "success");
                } else {
                  showToast("補發場站資訊失敗，請檢查後端控制台日誌。", "error");
                }
              }
            }}
            className="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              height: "32px",
              background: "linear-gradient(135deg, var(--accent-red), #b91c1c)",
              boxShadow: "0 4px 15px rgba(239, 68, 68, 0.25)",
            }}
            title="將所有 Locations 補發廣播給所有 EMSP"
          >
            <RefreshCw size={14} />
            <span>補發所有場站資訊</span>
          </button>
        </div>
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            marginTop: "8px",
            lineHeight: "1.6",
          }}
        >
          當 CPO 透過 HUB 對外發送 Session 或 結算 CDR 時，HUB
          作為數據交換中心，必需能精準決定「收誰的」、「傳遞給誰」。本系統模擬
          OCPI 2.2 標準，基於國家代碼 (Country Code) 與企業代碼 (Party ID)
          建立高精度路由表。
        </p>

        {/* Mappings Visual list */}
        <div
          style={{
            background: "rgba(5, 7, 18, 0.6)",
            border: "1px solid var(--glass-border)",
            borderRadius: "8px",
            padding: "20px",
            marginTop: "20px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              fontSize: "11px",
              color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              paddingBottom: "8px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            <span>CPO 來源資訊</span>
            <span style={{ textAlign: "center" }}></span>
            <span style={{ textAlign: "center" }}>HUB 識別匹配密鑰</span>
            <span style={{ textAlign: "center" }}></span>
            <span>對接憑證 (Token B)</span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: "12px",
            }}
          >
            {cpos.map((cpo) => (
              <div
                key={cpo.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  alignItems: "center",
                  fontSize: "13px",
                  fontFamily: "var(--font-mono)",
                  background: "rgba(255,255,255,0.01)",
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.02)",
                }}
              >
                <span style={{ color: "var(--accent-blue)", fontWeight: 500 }}>
                  {cpo.name || "未命名"}
                </span>
                <span
                  style={{ textAlign: "center", color: "var(--text-muted)" }}
                >
                  ➔
                </span>
                <span
                  style={{
                    textAlign: "center",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    color: "var(--accent-red)",
                    padding: "2px 0",
                    borderRadius: "4px",
                  }}
                >
                  "{cpo.countryCode}" + "{cpo.partyId}"
                </span>
                <span
                  style={{ textAlign: "center", color: "var(--text-muted)" }}
                >
                  ➔
                </span>
                <span
                  style={{
                    color: "var(--accent-green)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={cpo.credential?.tokenB || ""}
                >
                  {cpo.credential?.tokenB || "N/A"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Registration Forms */}
      <div className="card" style={{ borderLeft: "4px solid var(--accent-green)" }}>
        <h3 className="card-title">
          <Plus size={18} style={{ color: "var(--accent-green)" }} />
          <span>註冊新 OCPI 租戶 (Register CPO & eMSP Tenants)</span>
        </h3>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "-10px", marginBottom: "20px" }}>
          在 HUB 中註冊並串接全新的 CPO (充電運營商) 或 eMSP (漫遊服務商)，以動態擴充充電網路路由拓撲。
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
          {/* CPO Registration Form */}
          <div style={{ background: "rgba(255, 255, 255, 0.01)", border: "1px solid var(--glass-border)", padding: "16px", borderRadius: "10px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <h4 style={{ fontSize: "14px", fontWeight: "bold", color: "white", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-blue)" }}></span>
                註冊 CPO (Register CPO)
              </h4>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>國家代碼 (Country Code)</label>
                    <input
                      type="text"
                      value={cpoCountryCode}
                      onChange={(e) => setCpoCountryCode(e.target.value.toUpperCase())}
                      placeholder="例如: TW"
                      style={{ height: "34px", padding: "6px 10px", fontSize: "12.5px" }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>企業代碼 (Party ID)</label>
                    <input
                      type="text"
                      value={cpoPartyId}
                      onChange={(e) => setCpoPartyId(e.target.value.toUpperCase())}
                      placeholder="例如: EVZ"
                      style={{ height: "34px", padding: "6px 10px", fontSize: "12.5px" }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>運營商名稱 (CPO Name)</label>
                  <input
                    type="text"
                    value={cpoName}
                    onChange={(e) => setCpoName(e.target.value)}
                    placeholder="例如: 綠能充電"
                    style={{ height: "34px", padding: "6px 10px", fontSize: "12.5px" }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>對接憑證 (Token B)</label>
                  <input
                    type="text"
                    value={cpoTokenB}
                    onChange={(e) => setCpoTokenB(e.target.value)}
                    placeholder="為此 CPO 指定專屬 Token B 憑證"
                    style={{ height: "34px", padding: "6px 10px", fontSize: "12.5px" }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={async () => {
                if (!cpoCountryCode || !cpoPartyId || !cpoName || !cpoTokenB) {
                  showToast("請填寫所有 CPO 欄位！", "warning");
                  return;
                }
                const res = await handleAddCpo(cpoCountryCode, cpoPartyId, cpoName, cpoTokenB);
                if (res.success) {
                  showToast(`CPO ${cpoName} (${cpoCountryCode}-${cpoPartyId}) 註冊成功！`, "success");
                  setCpoPartyId("");
                  setCpoName("");
                  setCpoTokenB("");
                } else {
                  showToast(`註冊失敗: ${res.error || "詳細錯誤請見 Console 日誌"}`, "error");
                }
              }}
              className="button"
              style={{ height: "36px", fontSize: "12px", marginTop: "20px", background: "linear-gradient(135deg, var(--accent-blue), #0284c7)" }}
            >
              <Plus size={13} style={{ marginRight: "4px" }} />
              註冊 CPO 帳戶
            </button>
          </div>

          {/* eMSP Registration Form */}
          <div style={{ background: "rgba(255, 255, 255, 0.01)", border: "1px solid var(--glass-border)", padding: "16px", borderRadius: "10px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <h4 style={{ fontSize: "14px", fontWeight: "bold", color: "white", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-purple)" }}></span>
                註冊 eMSP (Register eMSP)
              </h4>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>國家代碼 (Country Code)</label>
                    <input
                      type="text"
                      value={emspCountryCode}
                      onChange={(e) => setEmspCountryCode(e.target.value.toUpperCase())}
                      placeholder="例如: TW"
                      style={{ height: "34px", padding: "6px 10px", fontSize: "12.5px" }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>企業代碼 (Party ID)</label>
                    <input
                      type="text"
                      value={emspPartyId}
                      onChange={(e) => setEmspPartyId(e.target.value.toUpperCase())}
                      placeholder="例如: SMB"
                      style={{ height: "34px", padding: "6px 10px", fontSize: "12.5px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>服務商名稱 (eMSP Name)</label>
                    <input
                      type="text"
                      value={emspName}
                      onChange={(e) => setEmspName(e.target.value)}
                      placeholder="例如: 移動漫遊"
                      style={{ height: "34px", padding: "6px 10px", fontSize: "12.5px" }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>串接憑證 (Token C)</label>
                    <input
                      type="text"
                      value={emspTokenC}
                      onChange={(e) => setEmspTokenC(e.target.value)}
                      placeholder="對接此 eMSP 之 Token C"
                      style={{ height: "34px", padding: "6px 10px", fontSize: "12.5px" }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                    接收伺服器網址 (Receiver URL) -
                    <span
                      onClick={() => setEmspUrl(`http://localhost:3030/simulator/mock-emsp/${emspPartyId || "SMB"}`)}
                      style={{ color: "var(--accent-purple)", cursor: "pointer", marginLeft: "4px", textDecoration: "underline" }}
                    >
                      填入模擬網址
                    </span>
                  </label>
                  <input
                    type="text"
                    value={emspUrl}
                    onChange={(e) => setEmspUrl(e.target.value)}
                    placeholder="例如: http://localhost:3030/simulator/mock-emsp/SMB"
                    style={{ height: "34px", padding: "6px 10px", fontSize: "12.5px" }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={async () => {
                if (!emspCountryCode || !emspPartyId || !emspName || !emspUrl || !emspTokenC) {
                  showToast("請填寫所有 eMSP 欄位！", "warning");
                  return;
                }
                const res = await handleAddEmsp(emspCountryCode, emspPartyId, emspName, emspUrl, emspTokenC);
                if (res.success) {
                  showToast(`eMSP ${emspName} (${emspCountryCode}-${emspPartyId}) 註冊成功！`, "success");
                  setEmspPartyId("");
                  setEmspName("");
                  setEmspUrl("");
                  setEmspTokenC("");
                } else {
                  showToast(`註冊失敗: ${res.error || "詳細錯誤請見 Console 日誌"}`, "error");
                }
              }}
              className="button"
              style={{ height: "36px", fontSize: "12px", marginTop: "20px", background: "linear-gradient(135deg, var(--accent-purple), #7c3aed)" }}
            >
              <Plus size={13} style={{ marginRight: "4px" }} />
              註冊 eMSP 帳戶
            </button>
          </div>
        </div>
      </div>

      {/* Endpoint toggler controls */}
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 className="card-title">
              下屬對接之 eMSP 接收伺服器狀態控制 (eMSP Endpoint Status)
            </h3>
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                marginTop: "4px",
              }}
            >
              關閉某個 eMSP 接收端，可模擬「接收端服務中斷」時，HUB 會返回
              5003/5001 路由阻斷代碼的故障場景。
            </p>
          </div>
          <button
            onClick={() => {
              addLog(
                "SYSTEM",
                "HEALTH_CHECK",
                "手動觸發連線狀態重新檢測...",
                "info",
              );
              fetchEmspStatus();
            }}
            className="button button-secondary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              fontSize: "12px",
              height: "32px",
            }}
            title="重新檢測連線狀態"
          >
            <RefreshCw size={14} />
            <span>重新檢測連線</span>
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "16px",
            marginTop: "16px",
          }}
        >
          {emsps.map((emsp) => (
            <div
              key={emsp.id}
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
              <div
                style={{ display: "flex", flexDirection: "column", gap: "2px" }}
              >
                <span style={{ fontSize: "14px", fontWeight: 600 }}>
                  {emsp.name}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Party: {emsp.countryCode}-{emsp.partyId}
                </span>
                {emsp.url && (
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-mono)",
                      marginTop: "4px",
                      wordBreak: "break-all",
                    }}
                  >
                    URL: {emsp.url}
                  </span>
                )}
                {/* Real-time Connectivity Badge */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginTop: "6px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: emsp.online
                        ? "var(--accent-green)"
                        : emsp.online === false
                          ? "var(--accent-red)"
                          : "var(--text-muted)",
                      boxShadow: emsp.online
                        ? "0 0 6px var(--accent-green)"
                        : emsp.online === false
                          ? "0 0 6px var(--accent-red)"
                          : "none",
                    }}
                  ></span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: emsp.online
                        ? "var(--accent-green)"
                        : emsp.online === false
                          ? "var(--accent-red)"
                          : "var(--text-muted)",
                    }}
                  >
                    {emsp.online
                      ? `連線成功 (${emsp.latency || 0}ms)`
                      : emsp.online === false
                        ? "無法連線 (Offline)"
                        : "偵測中..."}
                  </span>
                </div>
              </div>

              <button
                onClick={() => toggleEmspChannel(emsp.id)}
                className={`button ${emsp.active ? "" : "button-secondary"}`}
                style={{
                  padding: "6px 14px",
                  fontSize: "12px",
                  height: "36px",
                  borderColor: emsp.active
                    ? "transparent"
                    : "rgba(239, 68, 68, 0.2)",
                  color: emsp.active
                    ? "var(--accent-green)"
                    : "var(--accent-red)",
                  background: emsp.active
                    ? "rgba(16, 185, 129, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                }}
              >
                {emsp.active ? "通道：啟用" : "通道：關閉"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
