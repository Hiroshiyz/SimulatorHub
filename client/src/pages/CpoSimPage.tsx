import { useSimulator } from "../context/SimulatorContext";
import { MapPin, DollarSign, UserCheck, Flame, Zap, Database } from "../components/Icons";
import { useState, useEffect } from "react";

interface OcpiEvseRawJson {
  evse_id?: string;
  capabilities?: string[];
}

const OCPP_TO_OCPI: Record<string, string> = {
  Available: "AVAILABLE",
  Preparing: "CHARGING",
  Charging: "CHARGING",
  SuspendedEV: "CHARGING",
  SuspendedEVSE: "CHARGING",
  Finishing: "BLOCKED",
  Reserved: "RESERVED",
  Unavailable: "INOPERATIVE",
  Faulted: "OUTOFORDER"
};

const OCPI_TO_OCPP: Record<string, string> = {
  AVAILABLE: "Available",
  CHARGING: "Charging",
  BLOCKED: "Finishing",
  RESERVED: "Reserved",
  INOPERATIVE: "Unavailable",
  OUTOFORDER: "Faulted"
};

export default function CpoSimPage() {
  const {
    locations,
    selectedLocationId,
    setSelectedLocationId,
    selectedEvseUid,
    setSelectedEvseUid,
    handleSyncTariff,
    autoCharges,
    startSimulatedCharging,
    stopSimulatedCharging,
    activeChargingSessions,
    customEvseStatus,
    setCustomEvseStatus,
    handlePatchStatus,
    handleSyncCustomLocation,
    handleSyncCustomTariff,
  } = useSimulator();

  const [tariffInput, setTariffInput] = useState<number>(9.5);
  const [selectedMac, setSelectedMac] = useState<string>(
    autoCharges.length > 0 ? autoCharges[0].mac : ""
  );

  const matchedLocation = locations.find((l) => l.id === selectedLocationId);
  const matchedEvses = matchedLocation?.evses || [];
  const selectedEvse = matchedEvses.find((e) => e.uid === selectedEvseUid);

  // 自訂場站同步狀態
  const [locCountry, setLocCountry] = useState<string>("TW");
  const [locPartyId, setLocPartyId] = useState<string>("CPO");
  const [locIdInput, setLocIdInput] = useState<string>("loc_002");
  const [locJson, setLocJson] = useState<string>(
    JSON.stringify({
      id: "loc_002",
      name: "台中七期超級充電站",
      operator: {
        name: "Tesla Flagship Station CPO",
      },
      address: "台中市西屯區市政路",
      city: "Taichung",
      postal_code: "407",
      country: "TWN",
      coordinates: { latitude: "24.1612", longitude: "120.6391" },
      parking_type: "ON_STREET",
      opening_times: "24/7",
      charging_when_closed: true,
      evses: [
        {
          uid: "TW-CPO-EVSE-003",
          evse_id: "TW*CPO*E003",
          status: "AVAILABLE",
          capabilities: ["REMOTE_START_STOP_ALLOWED"],
          connectors: [
            {
              id: "1",
              format: "CABLE",
              standard: "CCS_2",
              power_type: "DC",
              tariff_ids: ["TAR-REGULAR"],
              max_voltage: 800,
              max_amperage: 300,
              max_electric_power: 120000,
            },
          ],
        },
      ],
    }, null, 2)
  );

  // 自訂費率同步狀態
  const [tfCountry, setTfCountry] = useState<string>("TW");
  const [tfPartyId, setTfPartyId] = useState<string>("CPO");
  const [tfIdInput, setTfIdInput] = useState<string>("TAR-REGULAR");
  const [tfJson, setTfJson] = useState<string>(
    JSON.stringify({
      id: "TAR-REGULAR",
      currency: "TWD",
      elements: [
        {
          price_components: [
            {
              type: "ENERGY",
              price: 9.5,
              step_size: 1,
            },
            {
              type: "FLAT",
              price: 20.0,
              step_size: 1,
            },
          ],
        },
      ],
      last_updated: new Date().toISOString(),
    }, null, 2)
  );

  const [activeSyncTab, setActiveSyncTab] = useState<"location" | "tariff">("location");

  const handleSyncCustomLocClick = async () => {
    try {
      const parsed = JSON.parse(locJson);
      if (parsed.id !== locIdInput) {
        alert("JSON 中的 id 與輸入的場站 ID 欄位不一致，請確認！");
        return;
      }
      const res = await handleSyncCustomLocation(locCountry, locPartyId, locIdInput, parsed);
      if (res.success) {
        alert(`場站 ${locIdInput} 同步成功！`);
      } else {
        alert(`同步失敗: ${res.error}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(`JSON 格式錯誤: ${errorMsg}`);
    }
  };

  const handleSyncCustomTfClick = async () => {
    try {
      const parsed = JSON.parse(tfJson);
      if (parsed.id !== tfIdInput) {
        alert("JSON 中的 id 與輸入的費率 ID 欄位不一致，請確認！");
        return;
      }
      const res = await handleSyncCustomTariff(tfCountry, tfPartyId, tfIdInput, parsed);
      if (res.success) {
        alert(`費率 ${tfIdInput} 同步成功！`);
      } else {
        alert(`同步失敗: ${res.error}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(`JSON 格式錯誤: ${errorMsg}`);
    }
  };

  // 當選擇的場站改變時，可提供一鍵載入當前場站 JSON
  const handleLoadCurrentLocationJson = () => {
    if (matchedLocation) {
      const cleanedEvses = (matchedLocation.evses || []).map((e) => {
        const connectors = e.connectors || e.rawJson?.connectors || [
          {
            id: "1",
            format: "CABLE",
            standard: "CCS_2",
            power_type: "DC",
            tariff_ids: ["TAR-REGULAR"],
            max_voltage: 800,
            max_amperage: 300,
            max_electric_power: 120000,
          }
        ];
        return {
          uid: e.uid,
          evse_id: e.evse_id || (e.rawJson as OcpiEvseRawJson)?.evse_id || e.uid,
          status: e.status,
          capabilities: (e.rawJson as OcpiEvseRawJson)?.capabilities || ["REMOTE_START_STOP_ALLOWED"],
          connectors,
        };
      });

      const payload = {
        id: matchedLocation.id,
        name: matchedLocation.name || "台北內湖特斯拉旗艦站",
        operator: {
          name: "Tesla Flagship Station CPO",
        },
        address: matchedLocation.address || "台北市內湖區舊宗路一段",
        city: matchedLocation.city || "Taipei",
        postal_code: matchedLocation.postalCode || "114",
        country: "TWN",
        coordinates: matchedLocation.coordinates || { latitude: "25.0612", longitude: "121.5791" },
        parking_type: "ON_STREET",
        opening_times: "24/7",
        charging_when_closed: true,
        evses: cleanedEvses,
      };

      setLocIdInput(matchedLocation.id);
      setLocJson(JSON.stringify(payload, null, 2));
    }
  };

  useEffect(() => {
    if (selectedEvse) {
      const ocppStatus = OCPI_TO_OCPP[selectedEvse.status] || "Available";
      setCustomEvseStatus(ocppStatus);
    }
  }, [selectedEvseUid, selectedEvse, setCustomEvseStatus]);

  return (
    <div className="workspace">
      {/* 2-Column Controls Header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        
        {/* Location & EVSE Picker */}
        <div className="card">
          <h3 className="card-title">
            <MapPin size={18} style={{ color: "var(--accent-red)" }} />
            <span>1. 選擇場站 (Location) 與 樁 (EVSE)</span>
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
            <div className="form-group">
              <label>充電場站</label>
              <select
                value={selectedLocationId}
                onChange={(e) => {
                  const locId = e.target.value;
                  setSelectedLocationId(locId);
                  const loc = locations.find((l) => l.id === locId);
                  if (loc && loc.evses.length > 0) {
                    setSelectedEvseUid(loc.evses[0].uid);
                  }
                }}
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name || loc.id} ({loc.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>充電槍/樁 選擇</label>
              <select
                value={selectedEvseUid || ""}
                onChange={(e) => setSelectedEvseUid(e.target.value)}
              >
                {matchedEvses.map((evse) => (
                  <option key={evse.uid} value={evse.uid}>
                    {evse.evse_id || evse.uid} - [最大功率: {evse.connectors?.[0]?.max_electric_power ? `${evse.connectors[0].max_electric_power / 1000}kW` : "120kW"}]
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "12px", marginTop: "4px" }}>
              <label>手動修改充電樁狀態 (如：插槍模擬)</label>
              <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
                <select
                  value={customEvseStatus}
                  onChange={(e) => setCustomEvseStatus(e.target.value)}
                  style={{ flexGrow: 1 }}
                >
                  <option value="Available">Available (空閒就緒)</option>
                  <option value="Preparing">Preparing (插槍/準備中)</option>
                  <option value="Charging">Charging (充電中)</option>
                  <option value="SuspendedEV">SuspendedEV (車端暫停)</option>
                  <option value="SuspendedEVSE">SuspendedEVSE (樁端暫停)</option>
                  <option value="Finishing">Finishing (結束中)</option>
                  <option value="Reserved">Reserved (預約保留)</option>
                  <option value="Unavailable">Unavailable (暫停服務)</option>
                  <option value="Faulted">Faulted (故障)</option>
                </select>
                <button
                  onClick={() => {
                    if (selectedLocationId && selectedEvseUid) {
                      const ocpiStatus = OCPP_TO_OCPI[customEvseStatus] || "AVAILABLE";
                      handlePatchStatus(selectedLocationId, selectedEvseUid, ocpiStatus);
                    }
                  }}
                  className="button"
                  style={{
                    padding: "0 16px",
                    height: "44px",
                  }}
                  disabled={!selectedEvseUid}
                >
                  更新狀態
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Tariff Controls */}
        <div className="card">
          <h3 className="card-title">
            <DollarSign size={18} style={{ color: "var(--accent-green)" }} />
            <span>2. 動態調整 OCPI 費率 (Tariff)</span>
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
            <div className="form-group">
              <label>能量服務費率 (TWD / kWh)</label>
              <div style={{ display: "flex", gap: "12px" }}>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  value={tariffInput}
                  onChange={(e) => setTariffInput(parseFloat(e.target.value) || 0)}
                  style={{ flexGrow: 1 }}
                />
                <button
                  onClick={() => handleSyncTariff(tariffInput)}
                  className="button"
                  style={{
                    background: "linear-gradient(135deg, var(--accent-green), #059669)",
                    boxShadow: "0 4px 15px var(--accent-green-glow)",
                    padding: "0 16px",
                    height: "44px",
                  }}
                >
                  應用新費率
                </button>
              </div>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              * 更改此費率將發送 PUT 請求同步至 HUB 與 EMSP，影響隨後所有計費計價項目。
            </p>
          </div>
        </div>
      </div>

      {/* Authorization Scenarios */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
        
        {/* Scenario A: RFID Swipe Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h4
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                letterSpacing: "1px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <UserCheck size={16} style={{ color: "var(--accent-blue)" }} />
              情境 A: 傳統 RF-ID 卡片刷卡認證
            </h4>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px", lineHeight: "1.6" }}>
              模擬車主使用 eMSP App 或是實體 RFID 卡靠槍解鎖。點擊後，CPO 會先將 Authorization 發送給 HUB，HUB 再路由給 eMSP 校驗，批准後才開始送電。
            </p>
          </div>

          <button
            onClick={() => {
              if (selectedEvseUid) {
                startSimulatedCharging(selectedLocationId, selectedEvseUid, false);
              }
            }}
            className="button"
            style={{ marginTop: "24px", width: "100%" }}
            disabled={!selectedEvseUid}
          >
            <Zap size={16} />
            <span>送出 RFID 授權並啟動充電</span>
          </button>
        </div>

        {/* Scenario B: AutoCharge Plug and Charge */}
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h4
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary)",
                letterSpacing: "1px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Flame size={16} style={{ color: "var(--accent-red)" }} />
              情境 B: Tesla 般 AutoCharge 免解鎖
            </h4>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px", lineHeight: "1.6" }}>
              插槍後，充電樁自動讀取車輛 MAC/EVCCID。CPO 自動比對並匹配對應的 eMSP Token 進行免刷卡授權。
            </p>

            <div style={{ marginTop: "16px" }} className="form-group">
              <label>選擇模擬插入車輛的 MAC 地址</label>
              <select value={selectedMac} onChange={(e) => setSelectedMac(e.target.value)}>
                {autoCharges.map((item) => (
                  <option key={item.mac} value={item.mac}>
                    {item.vehicleModel} ({item.mac})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => {
              if (selectedEvseUid) {
                startSimulatedCharging(selectedLocationId, selectedEvseUid, true, selectedMac);
              }
            }}
            className="button"
            style={{
              marginTop: "20px",
              width: "100%",
              background: "linear-gradient(135deg, var(--accent-red), #b91c1c)",
              boxShadow: "0 4px 15px rgba(239, 68, 68, 0.3)",
            }}
            disabled={!selectedEvseUid || !selectedMac}
          >
            <Flame size={16} />
            <span>插槍 (AutoCharge)</span>
          </button>
        </div>
      </div>

      {/* Advanced JSON Sync Console */}
      <div className="card">
        <h3 className="card-title">
          <Database size={18} style={{ color: "var(--accent-blue)" }} />
          <span>3. 漫遊資產管理與自訂同步 (JSON Sync Console)</span>
        </h3>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", lineHeight: "1.6" }}>
          在此您可以透過編輯 OCPI 規格的 JSON 檔案，以動態呼叫 `PUT` 的方式直接向 HUB 與對接的 EMSP 新增或變更場站（Location）及費率（Tariff）。
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)", paddingBottom: "12px", marginTop: "16px" }}>
          <button
            onClick={() => setActiveSyncTab("location")}
            className={`button ${activeSyncTab === "location" ? "" : "button-secondary"}`}
            style={{ padding: "6px 16px", height: "32px", fontSize: "12px" }}
          >
            同步自訂場站 (Locations)
          </button>
          <button
            onClick={() => setActiveSyncTab("tariff")}
            className={`button ${activeSyncTab === "tariff" ? "" : "button-secondary"}`}
            style={{ padding: "6px 16px", height: "32px", fontSize: "12px" }}
          >
            同步自訂費率 (Tariffs)
          </button>
        </div>

        {activeSyncTab === "location" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
              <div className="form-group">
                <label>國家代碼 (Country Code)</label>
                <input
                  type="text"
                  value={locCountry}
                  onChange={(e) => setLocCountry(e.target.value.toUpperCase())}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                />
              </div>
              <div className="form-group">
                <label>CPO 企業代碼 (Party ID)</label>
                <input
                  type="text"
                  value={locPartyId}
                  onChange={(e) => setLocPartyId(e.target.value.toUpperCase())}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                />
              </div>
              <div className="form-group">
                <label>場站 ID (Location ID)</label>
                <input
                  type="text"
                  value={locIdInput}
                  onChange={(e) => setLocIdInput(e.target.value)}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>編輯 Location JSON Payload :</span>
              <button
                onClick={handleLoadCurrentLocationJson}
                className="button button-secondary"
                style={{ padding: "4px 8px", fontSize: "11px", height: "24px" }}
              >
                載入當前場站 JSON
              </button>
            </div>

            <textarea
              value={locJson}
              onChange={(e) => setLocJson(e.target.value)}
              rows={12}
              style={{
                width: "100%",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                background: "rgba(0, 0, 0, 0.2)",
                border: "1px solid var(--glass-border)",
                borderRadius: "6px",
                padding: "12px",
                color: "#f3f4f6",
                lineHeight: "1.5",
              }}
            />

            <button
              onClick={handleSyncCustomLocClick}
              className="button"
              style={{
                alignSelf: "flex-end",
                background: "linear-gradient(135deg, var(--accent-blue), #1d4ed8)",
                boxShadow: "0 4px 15px rgba(59, 130, 246, 0.3)",
                padding: "0 24px",
                height: "38px",
                fontSize: "12px",
              }}
            >
              同步自訂場站 (PUT Location)
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
              <div className="form-group">
                <label>國家代碼 (Country Code)</label>
                <input
                  type="text"
                  value={tfCountry}
                  onChange={(e) => setTfCountry(e.target.value.toUpperCase())}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                />
              </div>
              <div className="form-group">
                <label>CPO 企業代碼 (Party ID)</label>
                <input
                  type="text"
                  value={tfPartyId}
                  onChange={(e) => setTfPartyId(e.target.value.toUpperCase())}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                />
              </div>
              <div className="form-group">
                <label>費率 ID (Tariff ID)</label>
                <input
                  type="text"
                  value={tfIdInput}
                  onChange={(e) => setTfIdInput(e.target.value)}
                  style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
                />
              </div>
            </div>

            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>編輯 Tariff JSON Payload :</span>

            <textarea
              value={tfJson}
              onChange={(e) => setTfJson(e.target.value)}
              rows={8}
              style={{
                width: "100%",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                background: "rgba(0, 0, 0, 0.2)",
                border: "1px solid var(--glass-border)",
                borderRadius: "6px",
                padding: "12px",
                color: "#f3f4f6",
                lineHeight: "1.5",
              }}
            />

            <button
              onClick={handleSyncCustomTfClick}
              className="button"
              style={{
                alignSelf: "flex-end",
                background: "linear-gradient(135deg, var(--accent-green), #047857)",
                boxShadow: "0 4px 15px rgba(16, 185, 129, 0.3)",
                padding: "0 24px",
                height: "38px",
                fontSize: "12px",
              }}
            >
              同步自訂費率 (PUT Tariff)
            </button>
          </div>
        )}
      </div>

      {/* Hardware Status Monitors */}
      <div className="card">
        <h3 className="card-title">CPO 充電樁硬件狀態監控</h3>
        
        <div className="evse-grid" style={{ marginTop: "16px" }}>
          {matchedEvses.map((evse) => {
            const isCharging = Object.keys(activeChargingSessions).includes(evse.uid);
            const session = activeChargingSessions[evse.uid];

            return (
              <div
                key={evse.uid}
                className={`evse-card ${isCharging ? "charging" : ""}`}
                style={{ cursor: "default" }}
              >
                <div className="evse-header">
                  <span style={{ fontSize: "12px", fontWeight: 700 }}>{evse.evse_id || evse.uid}</span>
                  <span className={`evse-badge ${isCharging ? "charging" : evse.status.toLowerCase()}`}>
                    {isCharging ? "CHARGING" : evse.status}
                  </span>
                </div>

                <div className="evse-visual">
                  <span className="evse-icon-glow" style={{ fontSize: "32px" }}>
                    {isCharging ? "⚡" : "🔋"}
                  </span>
                </div>

                {isCharging && session ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }} className="evse-telemetry-mini">
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                      <span>SoC {session.soc}%</span>
                      <span>{session.kwh.toFixed(1)} kWh</span>
                    </div>
                    <div className="charging-bar-container">
                      <div className="charging-bar-fill" style={{ width: `${session.soc}%` }}></div>
                    </div>
                    <button
                      onClick={() => stopSimulatedCharging(evse.uid)}
                      className="button button-secondary"
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        color: "var(--accent-red)",
                        borderColor: "rgba(239, 68, 68, 0.2)",
                        marginTop: "4px",
                      }}
                    >
                      手動斷電拔槍
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", marginTop: "4px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", paddingTop: "4px" }}>
                      狀態: {evse.status}
                    </div>
                    <div style={{ display: "flex", gap: "6px", width: "100%" }}>
                      {evse.status === "AVAILABLE" ? (
                        <button
                          onClick={() => handlePatchStatus(selectedLocationId, evse.uid, "CHARGING")}
                          className="button button-secondary"
                          style={{ flex: 1, padding: "4px 0", fontSize: "11px", height: "28px" }}
                        >
                          模擬插槍
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePatchStatus(selectedLocationId, evse.uid, "AVAILABLE")}
                          className="button button-secondary"
                          style={{ flex: 1, padding: "4px 0", fontSize: "11px", height: "28px" }}
                        >
                          拔槍歸位
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
