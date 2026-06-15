import { useSimulator } from "../context/SimulatorContext";
import { Layers, RefreshCw, Plus } from "../components/Icons";
import { useState } from "react";

export default function HubRouterPage() {
  const {
    emsps,
    setEmsps,
    fetchEmspStatus,
    addLog,
    handleAddCpo,
    handleAddEmsp,
    cpos,
  } = useSimulator();

  // 新增租戶表單狀態
  const [tenantType, setTenantType] = useState<"CPO" | "EMSP">("CPO");
  const [newCountryCode, setNewCountryCode] = useState<string>("TW");
  const [newPartyId, setNewPartyId] = useState<string>("");
  const [newName, setNewName] = useState<string>("");
  const [newTokenVal, setNewTokenVal] = useState<string>("");
  const [newUrl, setNewUrl] = useState<string>("");

  const handleRegisterTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCountryCode || !newPartyId || !newName || !newTokenVal) {
      alert("請填寫所有必要欄位！");
      return;
    }

    if (tenantType === "CPO") {
      const res = await handleAddCpo(
        newCountryCode,
        newPartyId,
        newName,
        newTokenVal,
      );
      if (res.success) {
        alert(`CPO ${newPartyId} 註冊成功！`);
        setNewPartyId("");
        setNewName("");
        setNewTokenVal("");
      } else {
        alert(`CPO 註冊失敗: ${res.error}`);
      }
    } else {
      const res = await handleAddEmsp(
        newCountryCode,
        newPartyId,
        newName,
        newUrl,
        newTokenVal,
      );
      if (res.success) {
        alert(`EMSP ${newPartyId} 註冊成功！`);
        setNewPartyId("");
        setNewName("");
        setNewTokenVal("");
        setNewUrl("");
      } else {
        alert(`EMSP 註冊失敗: ${res.error}`);
      }
    }
  };

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
        <h3 className="card-title">
          <Layers size={18} style={{ color: "var(--accent-red)" }} />
          <span>OCPI HUB 智能分發路由匹配規則 (Routing Policy)</span>
        </h3>
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
                <span style={{ textAlign: "center", color: "var(--text-muted)" }}>
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
                <span style={{ textAlign: "center", color: "var(--text-muted)" }}>
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

      {/* Dynamic Tenant Onboarding Panel */}
      <div className="card">
        <h3 className="card-title">
          <Plus size={18} style={{ color: "var(--accent-red)" }} />
          <span>動態註冊 CPO / EMSP 漫遊廠商 (Onboard Tenant)</span>
        </h3>
        <p
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            marginTop: "4px",
          }}
        >
          在這裡可以直接向 HUB 動態建立新的廠商設定與 OCPI
          憑證關係，免重置資料庫，即刻生效。
        </p>

        {/* Selector Tabs */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "16px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            paddingBottom: "12px",
          }}
        >
          <button
            type="button"
            onClick={() => setTenantType("CPO")}
            className={`button ${tenantType === "CPO" ? "" : "button-secondary"}`}
            style={{ padding: "4px 16px", height: "30px", fontSize: "12px" }}
          >
            註冊新 CPO
          </button>
          <button
            type="button"
            onClick={() => setTenantType("EMSP")}
            className={`button ${tenantType === "EMSP" ? "" : "button-secondary"}`}
            style={{ padding: "4px 16px", height: "30px", fontSize: "12px" }}
          >
            註冊新 EMSP
          </button>
        </div>

        <form
          onSubmit={handleRegisterTenant}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            marginTop: "16px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            <div className="form-group">
              <label>國家代碼 (Country Code)</label>
              <input
                type="text"
                required
                placeholder="TW"
                value={newCountryCode}
                onChange={(e) =>
                  setNewCountryCode(e.target.value.toUpperCase())
                }
                style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
              />
            </div>

            <div className="form-group">
              <label>企業代碼 (Party ID)</label>
              <input
                type="text"
                required
                placeholder={tenantType === "CPO" ? "CPO" : "EMSP"}
                value={newPartyId}
                onChange={(e) => setNewPartyId(e.target.value.toUpperCase())}
                style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
              />
            </div>

            <div className="form-group">
              <label>廠商名稱 (Tenant Name)</label>
              <input
                type="text"
                required
                placeholder={
                  tenantType === "CPO" ? "SMARTHUB" : "SMARTHUB EMSP"
                }
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ fontSize: "13px" }}
              />
            </div>

            <div className="form-group">
              <label>
                {tenantType === "CPO"
                  ? "對接憑證 (Token B)"
                  : "目標接收端金鑰 (Token C)"}
              </label>
              <input
                type="text"
                required
                placeholder={
                  tenantType === "CPO"
                    ? "mock_cpo_token_b_123"
                    : "mock_emsp_token_c_123"
                }
                value={newTokenVal}
                onChange={(e) => setNewTokenVal(e.target.value)}
                style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
              />
            </div>
          </div>

          {tenantType === "EMSP" && (
            <div className="form-group">
              <label>EMSP 伺服器網址 (Receiver Base URL)</label>
              <input
                type="url"
                required
                placeholder="http://localhost:5053"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
              />
            </div>
          )}

          <button
            type="submit"
            className="button"
            style={{
              alignSelf: "flex-end",
              background:
                tenantType === "CPO"
                  ? "linear-gradient(135deg, var(--accent-blue), #1d4ed8)"
                  : "linear-gradient(135deg, var(--accent-green), #047857)",
              boxShadow:
                tenantType === "CPO"
                  ? "0 4px 15px rgba(59, 130, 246, 0.25)"
                  : "0 4px 15px rgba(16, 185, 129, 0.25)",
              padding: "0 24px",
              height: "38px",
              fontSize: "12px",
            }}
          >
            <span>註冊 {tenantType} 廠商關係</span>
          </button>
        </form>
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
