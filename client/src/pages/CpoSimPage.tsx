import { useSimulator } from "../context/SimulatorContext";
import {
  MapPin,
  UserCheck,
  Flame,
  Zap,
  Database,
  CheckCircle,
  AlertTriangle,
} from "../components/Icons";
import { useState, useEffect } from "react";

const OCPP_TO_OCPI: Record<string, string> = {
  Available: "AVAILABLE",
  Preparing: "CHARGING",
  Charging: "CHARGING",
  SuspendedEV: "CHARGING",
  SuspendedEVSE: "CHARGING",
  Finishing: "BLOCKED",
  Reserved: "RESERVED",
  Unavailable: "INOPERATIVE",
  Faulted: "OUTOFORDER",
};

const OCPI_TO_OCPP: Record<string, string> = {
  AVAILABLE: "Available",
  CHARGING: "Charging",
  BLOCKED: "Finishing",
  RESERVED: "Reserved",
  INOPERATIVE: "Unavailable",
  OUTOFORDER: "Faulted",
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
    updateSessionTelemetryAndSend,
    updateSessionTelemetryOnly,
    emsps,
    sessions,
    cdrs,
    handleSendEmspCommand,
  } = useSimulator();

  // Simulator Configuration
  const [tariffInput, setTariffInput] = useState<number>(9.5);
  const [selectedMac, setSelectedMac] = useState<string>(
    autoCharges.length > 0 ? autoCharges[0].mac : "",
  );
  
  // RFID configuration
  const [rfidTokenInput, setRfidTokenInput] = useState<string>("MANUAL-TOKEN-CPO");
  const [selectedRfidEmspId, setSelectedRfidEmspId] = useState<string>("");
  const defaultRfidEmspId =
    selectedRfidEmspId || (emsps.find((e) => e.active) || emsps[0])?.id || "";

  // Custom JSON assets
  const [locJson, setLocJson] = useState<string>(() =>
    JSON.stringify(
      {
        country_code: "TW",
        party_id: "EVZ",
        id: "6619b6ab-c963-5e51-81d3-090251beebbe",
        name: "文桃站",
        address: "桃園市龜山區文吉路28號旁",
        city: "桃園市",
        postal_code: "320",
        country: "TAO",
        coordinates: { latitude: "25.0466870", longitude: "121.3918410" },
        parking_type: "ON_STREET",
        evses: [
          {
            uid: "TW*EVZ*11500104",
            evse_id: "TW*EVZ*11500104",
            status: "AVAILABLE",
            capabilities: ["REMOTE_START_STOP_CAPABLE"],
            connectors: [
              {
                id: "TW*EVZ*11500104",
                standard: "IEC_62196_T2_COMBO",
                format: "CABLE",
                power_type: "DC",
                max_voltage: 380,
                max_amperage: 474,
                max_electric_power: 180000,
                tariff_ids: ["25ebf06c-cfa3-5aa4-af17-3e5a41daaf6a"],
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );

  const [tfJson, setTfJson] = useState<string>(() =>
    JSON.stringify(
      {
        id: "25ebf06c-cfa3-5aa4-af17-3e5a41daaf6a",
        currency: "TWD",
        elements: [
          {
            price_components: [
              {
                type: "ENERGY",
                price: 5.9,
                vat: 0.0,
                step_size: 1,
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );

  const [activeSyncTab, setActiveSyncTab] = useState<"location" | "tariff">(
    "location",
  );

  // EMSP Commands Panel State
  const [selectedEmspIdForCmd, setSelectedEmspIdForCmd] = useState<string>("ALL");
  const [cmdTokenUid, setCmdTokenUid] = useState<string>("TW-EMO-889900");
  const [cmdAuthRef, setCmdAuthRef] = useState<string>(
    () => `AUTH-${Math.floor(100000 + Math.random() * 900000)}`,
  );

  // Derived state
  const matchedLocation = locations.find((l) => l.id === selectedLocationId);
  const matchedEvses = matchedLocation?.evses || [];
  const activeCommandEmsp = emsps.find((e) => e.id === selectedEmspIdForCmd);

  // Update selected EVSE status state when selection changes
  useEffect(() => {
    const matchedLoc = locations.find((l) => l.id === selectedLocationId);
    const evse = (matchedLoc?.evses || []).find((e) => e.uid === selectedEvseUid);
    if (evse) {
      const ocppStatus = OCPI_TO_OCPP[evse.status] || "Available";
      setCustomEvseStatus(ocppStatus);
    }
  }, [selectedLocationId, selectedEvseUid, locations, setCustomEvseStatus]);

  const handleLoadCurrentLocationJson = () => {
    if (matchedLocation) {
      const cleanedEvses = (matchedLocation.evses || []).map((e) => {
        const raw = e.rawJson as { connectors?: unknown[], capabilities?: string[], evse_id?: string } | undefined;
        const connectors = e.connectors ||
          raw?.connectors || [
            {
              id: "1",
              format: "CABLE",
              standard: "CCS_2",
              power_type: "DC",
              tariff_ids: ["25ebf06c-cfa3-5aa4-af17-3e5a41daaf6a"],
              max_voltage: 800,
              max_amperage: 300,
              max_electric_power: 120000,
            },
          ];
        return {
          uid: e.uid,
          evse_id: e.evse_id || raw?.evse_id || e.uid,
          status: e.status,
          capabilities: raw?.capabilities || [
            "REMOTE_START_STOP_ALLOWED",
          ],
          connectors,
        };
      });

      const payload = {
        id: matchedLocation.id,
        name: matchedLocation.name || "台北內湖特斯拉旗艦站",
        operator: { name: "Tesla Flagship Station CPO" },
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

      setLocJson(JSON.stringify(payload, null, 2));
    }
  };

  const handleSyncCustomLocClick = async () => {
    try {
      const parsed = JSON.parse(locJson);
      const country = parsed.country_code || "TW";
      const party = parsed.party_id || "EVZ";
      const id = parsed.id;
      if (!id) {
        alert("JSON 中缺少 id 屬性！");
        return;
      }
      const res = await handleSyncCustomLocation(
        country,
        party,
        id,
        parsed,
      );
      if (res.success) {
        alert(`場站 ${id} 同步成功！`);
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
      const id = parsed.id;
      if (!id) {
        alert("JSON 中缺少 id 屬性！");
        return;
      }
      const res = await handleSyncCustomTariff(
        "TW",
        "EVZ",
        id,
        parsed,
      );
      if (res.success) {
        alert(`費率 ${id} 同步成功！`);
      } else {
        alert(`同步失敗: ${res.error}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert(`JSON 格式錯誤: ${errorMsg}`);
    }
  };

  const handleSendCommandClick = async (cmdType: "START_SESSION" | "STOP_SESSION") => {
    if (!activeCommandEmsp) {
      alert("請先選擇一個 EMSP 發送方！");
      return;
    }

    const tokenC = activeCommandEmsp.tokenC || "";
    if (!tokenC) {
      alert("所選 EMSP 缺少 Token C 認證，無法發送請求！");
      return;
    }

    let payload: Record<string, unknown>;
    if (cmdType === "START_SESSION") {
      if (!selectedLocationId || !selectedEvseUid) {
        alert("請先在 CPO 區塊中選擇場站與充電樁！");
        return;
      }
      payload = {
        response_url: `${activeCommandEmsp.url}/ocpi/2.2.1/commands/START_SESSION`,
        token: {
          country_code: activeCommandEmsp.countryCode,
          party_id: activeCommandEmsp.partyId,
          uid: cmdTokenUid,
          type: "RFID",
          contract_id: "TW-SMB-C1000",
          visual_number: "11223344",
          issuer: "SmartHub",
          valid: true,
        },
        location_id: selectedLocationId,
        evse_uid: selectedEvseUid,
        authorization_reference: cmdAuthRef,
      };
    } else {
      const matchedSession = Object.values(activeChargingSessions).find(
        (sess) => sess.locationId === selectedLocationId && sess.evseUid === selectedEvseUid,
      );
      if (!matchedSession) {
        alert("該槍頭目前沒有正在充電的 Session，無法發送停止命令！");
        return;
      }
      payload = {
        response_url: `${activeCommandEmsp.url}/ocpi/2.2.1/commands/STOP_SESSION`,
        session_id: matchedSession.sessionId,
      };
    }

    const res = await handleSendEmspCommand(tokenC, cmdType, payload);
    if (res.success) {
      alert(`EMSP ${cmdType} 傳送成功！HUB 回應 ACCEPTED。`);
    } else {
      alert(`EMSP ${cmdType} 發送失敗: ${res.error || "詳細錯誤請見右側 Console 日誌"}`);
    }
  };

  return (
    <div className="workspace">
      {/* PAGE HEADER STATS DASHBOARD */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "20px"
      }}>
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px" }}>
          <div style={{ background: "rgba(56, 189, 248, 0.1)", color: "var(--accent-blue)", padding: "10px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MapPin size={22} />
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>場站總數</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "white", marginTop: "2px" }}>{locations.length} 個場站</div>
          </div>
        </div>
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px" }}>
          <div style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--accent-green)", padding: "10px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={22} />
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>進行中充電</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "white", marginTop: "2px" }}>{Object.keys(activeChargingSessions).length} 槍充電中</div>
          </div>
        </div>
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px" }}>
          <div style={{ background: "rgba(245, 158, 11, 0.1)", color: "var(--accent-yellow)", padding: "10px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UserCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>漫遊服務商 (eMSP)</div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "white", marginTop: "2px" }}>{emsps.length} 家已聯網</div>
          </div>
        </div>
      </div>

      {/* CENTER COLS */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "24px" }}>
        
        {/* LEFT COLUMN: Mock CPO Simulator */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Card 1: CPO Control Panel */}
          <div className="card" style={{ borderLeft: "4px solid var(--accent-red)" }}>
            <h3 className="card-title">
              <MapPin size={18} style={{ color: "var(--accent-red)" }} />
              <span>充電運營商模擬控制 (Mock CPO Controller)</span>
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "-10px", marginBottom: "16px" }}>
              選擇模擬場站與槍頭，手動變更物理狀態，或使用 RFID 刷卡/AutoCharge 插槍發起充電。
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", margin: 0, gap: "16px" }}>
                <div className="form-group">
                  <label>選擇充電場站</label>
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
                        {loc.name || loc.id} ({loc.party?.countryCode || "TW"}-{loc.party?.partyId || "EVZ"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>選擇充電樁 / 槍頭</label>
                  <select
                    value={selectedEvseUid || ""}
                    onChange={(e) => setSelectedEvseUid(e.target.value)}
                  >
                    {matchedEvses.map((evse) => (
                      <option key={evse.uid} value={evse.uid}>
                        {evse.evse_id || evse.uid} - [{evse.status}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Physics override */}
              <div style={{ background: "rgba(255,255,255,0.02)", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--glass-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "white" }}>手動改變充電槍狀態</span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>模擬硬體面板手動置換狀態</span>
                </div>
                <div style={{ display: "flex", gap: "8px", flexGrow: 1, justifySelf: "flex-end", maxWidth: "320px" }}>
                  <select
                    value={customEvseStatus}
                    onChange={(e) => setCustomEvseStatus(e.target.value)}
                    style={{ flexGrow: 1, height: "36px", padding: "0 10px" }}
                  >
                    <option value="Available">Available (空閒可充)</option>
                    <option value="Preparing">Preparing (插槍準備)</option>
                    <option value="Charging">Charging (充電中)</option>
                    <option value="Reserved">Reserved (預約保留)</option>
                    <option value="Finishing">Finishing (結束計量)</option>
                    <option value="Unavailable">Unavailable (停止服務)</option>
                    <option value="Faulted">Faulted (樁體故障)</option>
                  </select>
                  <button
                    onClick={() => {
                      if (selectedLocationId && selectedEvseUid) {
                        const ocpiStatus = OCPP_TO_OCPI[customEvseStatus] || "AVAILABLE";
                        handlePatchStatus(selectedLocationId, selectedEvseUid, ocpiStatus);
                      }
                    }}
                    className="button button-secondary"
                    style={{ height: "36px", padding: "0 14px", whiteSpace: "nowrap" }}
                    disabled={!selectedEvseUid}
                  >
                    更新狀態
                  </button>
                </div>
              </div>

              {/* Simulated Charging Scenarios */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                
                {/* Scenario A: RFID Swipe */}
                <div style={{
                  background: "rgba(56, 189, 248, 0.03)",
                  border: "1px solid rgba(56, 189, 248, 0.1)",
                  padding: "16px",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}>
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: "bold", color: "var(--accent-blue)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <UserCheck size={16} />情境 A: RFID 靠卡啟動
                    </span>
                    <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "4px" }}>
                      刷實體 RFID 卡片，透過 HUB 向 eMSP 請求授權。
                    </p>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                      <div className="form-group">
                        <label>RFID 卡號 (Token UID)</label>
                        <input
                          type="text"
                          value={rfidTokenInput}
                          onChange={(e) => setRfidTokenInput(e.target.value)}
                          placeholder="RFID Token UID"
                          style={{ height: "34px", padding: "6px 10px", fontSize: "12.5px" }}
                        />
                      </div>
                      <div className="form-group">
                        <label>卡片發行商 (eMSP)</label>
                        <select
                          value={defaultRfidEmspId}
                          onChange={(e) => setSelectedRfidEmspId(e.target.value)}
                          style={{ height: "34px", padding: "4px 8px", fontSize: "12.5px" }}
                        >
                          {emsps.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (selectedEvseUid) {
                        startSimulatedCharging(
                          selectedLocationId,
                          selectedEvseUid,
                          false,
                          null,
                          undefined,
                          true,
                          rfidTokenInput,
                          defaultRfidEmspId,
                        );
                      }
                    }}
                    className="button"
                    style={{ height: "34px", fontSize: "12px", marginTop: "16px", width: "100%", background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))" }}
                    disabled={!selectedEvseUid}
                  >
                    RFID 刷卡啟動
                  </button>
                </div>

                {/* Scenario B: AutoCharge */}
                <div style={{
                  background: "rgba(239, 68, 68, 0.03)",
                  border: "1px solid rgba(239, 68, 68, 0.1)",
                  padding: "16px",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}>
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: "bold", color: "var(--accent-red)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Flame size={16} />情境 B: AutoCharge 免解鎖
                    </span>
                    <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "4px" }}>
                      模擬車輛插槍，讀取車載 MAC 後自動發起漫遊扣款。
                    </p>
                    
                    <div className="form-group" style={{ marginTop: "12px" }}>
                      <label>車輛 MAC 識別</label>
                      <select
                        value={selectedMac}
                        onChange={(e) => setSelectedMac(e.target.value)}
                        style={{ height: "34px", padding: "4px 8px", fontSize: "12.5px", width: "100%" }}
                      >
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
                    style={{ height: "34px", fontSize: "12px", marginTop: "16px", width: "100%", background: "linear-gradient(135deg, var(--accent-red), #b91c1c)" }}
                    disabled={!selectedEvseUid || !selectedMac}
                  >
                    插槍自動充電
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* Card 2: Tariff & Custom Assets Playground */}
          <div className="card">
            <h3 className="card-title">
              <Database size={18} style={{ color: "var(--accent-blue)" }} />
              <span>費率與自訂數據調試 (Tariff & Custom Assets)</span>
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "-10px", marginBottom: "16px" }}>
              變更計費費率發送至 HUB，或在下方直接自訂發送 Location / Tariff 原始 JSON 數據。
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Dynamic Price */}
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", background: "rgba(255,255,255,0.01)", border: "1px solid var(--glass-border)", padding: "12px 16px", borderRadius: "10px" }}>
                <div className="form-group" style={{ flexGrow: 1 }}>
                  <label>調整充電服務費 (TWD / kWh)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={tariffInput}
                    onChange={(e) => setTariffInput(parseFloat(e.target.value) || 0)}
                    style={{ height: "36px", padding: "6px 12px" }}
                  />
                </div>
                <button
                  onClick={() => handleSyncTariff(tariffInput)}
                  className="button"
                  style={{ height: "36px", background: "linear-gradient(135deg, var(--accent-green), #059669)", whiteSpace: "nowrap" }}
                >
                  應用費率
                </button>
              </div>

              {/* Custom JSON Asset Playground */}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => setActiveSyncTab("location")}
                      className={`button ${activeSyncTab === "location" ? "" : "button-secondary"}`}
                      style={{ padding: "4px 12px", fontSize: "11px", height: "26px" }}
                    >
                      Location JSON
                    </button>
                    <button
                      onClick={() => setActiveSyncTab("tariff")}
                      className={`button ${activeSyncTab === "tariff" ? "" : "button-secondary"}`}
                      style={{ padding: "4px 12px", fontSize: "11px", height: "26px" }}
                    >
                      Tariff JSON
                    </button>
                  </div>
                  {activeSyncTab === "location" && (
                    <button
                      onClick={handleLoadCurrentLocationJson}
                      className="button button-secondary"
                      style={{ padding: "2px 8px", fontSize: "10px", height: "22px" }}
                    >
                      載入當前場站資料
                    </button>
                  )}
                </div>

                {activeSyncTab === "location" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <textarea
                      value={locJson}
                      onChange={(e) => setLocJson(e.target.value)}
                      rows={8}
                      style={{ fontSize: "11.5px", fontFamily: "var(--font-mono)", background: "rgba(0,0,0,0.2)" }}
                    />
                    <button
                      onClick={handleSyncCustomLocClick}
                      className="button"
                      style={{ height: "34px", fontSize: "12px", alignSelf: "flex-end" }}
                    >
                      發送 PUT Location 數據
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <textarea
                      value={tfJson}
                      onChange={(e) => setTfJson(e.target.value)}
                      rows={8}
                      style={{ fontSize: "11.5px", fontFamily: "var(--font-mono)", background: "rgba(0,0,0,0.2)" }}
                    />
                    <button
                      onClick={handleSyncCustomTfClick}
                      className="button"
                      style={{ height: "34px", fontSize: "12px", alignSelf: "flex-end" }}
                    >
                      發送 PUT Tariff 數據
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Mock EMSP Panel & Roaming Logs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Card 1: Mock EMSP Commands */}
          <div className="card" style={{ borderLeft: "4px solid var(--accent-blue)" }}>
            <h3 className="card-title">
              <UserCheck size={18} style={{ color: "var(--accent-blue)" }} />
              <span>移動出行商指令發送 (Mock EMSP Command)</span>
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "-10px", marginBottom: "16px" }}>
              模擬 EMSP 向 HUB 發起遠端遙控充電指令（OCPI Commands 模組）。
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label>選擇發起命令的 EMSP 租戶</label>
                <select
                  value={selectedEmspIdForCmd}
                  onChange={(e) => setSelectedEmspIdForCmd(e.target.value)}
                >
                  <option value="">-- 請選擇 EMSP 租戶 --</option>
                  {emsps.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.countryCode}-{e.partyId}) - {e.url?.includes("mock-emsp") ? "MOCK" : "REAL"}
                    </option>
                  ))}
                </select>
              </div>

              {activeCommandEmsp ? (
                <div style={{
                  background: "rgba(56, 189, 248, 0.03)",
                  border: "1px solid rgba(56, 189, 248, 0.15)",
                  borderRadius: "10px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px"
                }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "12px", color: "white", fontWeight: "bold" }}>發送 OCPI 遠端啟動/停止充電命令</span>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                      指令將帶上 Token C 發送至 HUB，驗證成功後轉發給 CPO 執行。
                    </span>
                  </div>

                  <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", margin: 0, gap: "10px" }}>
                    <div className="form-group">
                      <label>目標場站 (location_id)</label>
                      <input type="text" value={selectedLocationId} readOnly style={{ background: "rgba(0,0,0,0.3)", color: "var(--text-secondary)", height: "32px", fontSize: "12px" }} />
                    </div>
                    <div className="form-group">
                      <label>目標槍頭 (evse_uid)</label>
                      <input type="text" value={selectedEvseUid || ""} readOnly style={{ background: "rgba(0,0,0,0.3)", color: "var(--text-secondary)", height: "32px", fontSize: "12px" }} />
                    </div>
                  </div>

                  <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", margin: 0, gap: "10px" }}>
                    <div className="form-group">
                      <label>RFID 卡號 (token.uid)</label>
                      <input type="text" value={cmdTokenUid} onChange={(e) => setCmdTokenUid(e.target.value)} style={{ height: "32px", fontSize: "12px" }} />
                    </div>
                    <div className="form-group">
                      <label>授權序號 (auth_ref)</label>
                      <input type="text" value={cmdAuthRef} onChange={(e) => setCmdAuthRef(e.target.value)} style={{ height: "32px", fontSize: "12px" }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                    <button
                      onClick={() => handleSendCommandClick("START_SESSION")}
                      className="button"
                      style={{ flex: 1, height: "34px", fontSize: "12px", background: "linear-gradient(135deg, var(--accent-blue), #0284c7)" }}
                      disabled={!selectedEvseUid}
                    >
                      <Zap size={13} /> 遠端啟動 (START)
                    </button>
                    <button
                      onClick={() => handleSendCommandClick("STOP_SESSION")}
                      className="button button-secondary"
                      style={{ flex: 1, height: "34px", fontSize: "12px", color: "var(--accent-red)", borderColor: "rgba(239,68,68,0.2)" }}
                      disabled={!selectedEvseUid}
                    >
                      遠端停止 (STOP)
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.15)", borderRadius: "8px", padding: "12px", color: "var(--accent-yellow)", fontSize: "12px" }}>
                  <AlertTriangle size={16} />
                  <span>請在下拉選單選擇一個 EMSP 帳戶以啟用指令測試</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Active Sessions & CDRs Received at EMSPs */}
          <div className="card">
            <h3 className="card-title">
              <CheckCircle size={18} style={{ color: "var(--accent-green)" }} />
              <span>漫遊數據同步監控 (EMSP Roaming DB Logs)</span>
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "-10px", marginBottom: "16px" }}>
              即時檢視經由 HUB 成功轉發寫入 EMSP 資料庫之會話與帳單。
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Sessions List */}
              <div style={{ background: "rgba(0,0,0,0.15)", padding: "14px", borderRadius: "10px", border: "1px solid var(--glass-border)" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>
                  活動中的漫遊 Session ({sessions.filter(s => s.status === "ACTIVE").length})
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflowY: "auto" }}>
                  {sessions.length > 0 ? (
                    sessions.map((s) => (
                      <div key={s.id} style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.01)", padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.02)" }}>
                        <span style={{ fontFamily: "var(--font-mono)" }}>ID: {s.id} ({s.evseUid})</span>
                        <span>
                          <strong style={{ color: "white" }}>{s.kwh.toFixed(1)} kWh</strong>
                          <span style={{
                            marginLeft: "8px",
                            fontSize: "9px",
                            padding: "2px 6px",
                            borderRadius: "10px",
                            background: s.status === "ACTIVE" ? "rgba(56, 189, 248, 0.15)" : "rgba(255,255,255,0.06)",
                            color: s.status === "ACTIVE" ? "var(--accent-blue)" : "var(--text-secondary)",
                            fontWeight: "bold"
                          }}>{s.status}</span>
                        </span>
                      </div>
                    ))
                  ) : (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", display: "block", padding: "12px 0" }}>目前無漫遊 Session 資料</span>
                  )}
                </div>
              </div>

              {/* CDRs List */}
              <div style={{ background: "rgba(0,0,0,0.15)", padding: "14px", borderRadius: "10px", border: "1px solid var(--glass-border)" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>
                  已結算 CDR 漫遊帳單明細 ({cdrs.length})
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflowY: "auto" }}>
                  {cdrs.length > 0 ? (
                    cdrs.map((c) => {
                      const cost = (c.rawJson as { total_cost?: { excl_vat?: number } })?.total_cost?.excl_vat || 0;
                      const energy = (c.rawJson as { total_energy?: number })?.total_energy || 0;
                      return (
                        <div key={c.id} style={{ fontSize: "11px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.01)", padding: "6px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.02)" }}>
                          <span style={{ fontFamily: "var(--font-mono)" }}>單號: {c.id}</span>
                          <span>
                            <span style={{ color: "var(--text-secondary)", marginRight: "8px" }}>{energy.toFixed(1)} kWh</span>
                            <strong style={{ color: "var(--accent-green)" }}>TWD {cost}</strong>
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", display: "block", padding: "12px 0" }}>尚未產生任何結帳帳單 (CDRs)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 3: Hardware Monitor Grid */}
      <div className="card">
        <h3 className="card-title">CPO 充電槍頭物理硬件狀態與遙測 (Live Telemetry Controls)</h3>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
          模擬實體充電樁硬體。充電啟動後，本區塊將展開遙測控制面板。您可以自訂變更參數（SoC%、功率、計量 kWh），模擬充電樁向 HUB/EMSP 更新狀態。
        </p>

        <div className="evse-grid">
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
                  <span style={{ fontSize: "12.5px", fontWeight: 700 }}>
                    {evse.evse_id || evse.uid}
                  </span>
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
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                      <span>SoC {session.soc}%</span>
                      <span>{session.kwh.toFixed(1)} kWh</span>
                    </div>
                    <div className="charging-bar-container">
                      <div className="charging-bar-fill" style={{ width: `${session.soc}%` }}></div>
                    </div>

                    {/* Telemetry settings fields */}
                    <div className="telemetry-control-grid">
                      <div className="telemetry-input-field">
                        <label>SoC (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={session.soc}
                          onChange={(e) =>
                            updateSessionTelemetryOnly(evse.uid, { soc: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="telemetry-input-field">
                        <label>功率 (kW)</label>
                        <input
                          type="number"
                          min="0"
                          value={session.kw !== undefined ? session.kw : 120}
                          onChange={(e) =>
                            updateSessionTelemetryOnly(evse.uid, { kw: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="telemetry-input-field">
                        <label>能量 (kWh)</label>
                        <input
                          type="number"
                          min="0"
                          value={session.kwh}
                          onChange={(e) =>
                            updateSessionTelemetryOnly(evse.uid, { kwh: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="telemetry-input-field">
                        <label>狀態</label>
                        <select
                          value={session.status || "ACTIVE"}
                          onChange={(e) =>
                            updateSessionTelemetryOnly(evse.uid, {
                              status: e.target.value as "ACTIVE" | "COMPLETED" | "INVALID",
                            })
                          }
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="INVALID">INVALID</option>
                        </select>
                      </div>
                    </div>

                    <div className="telemetry-checkbox-row">
                      <input
                        type="checkbox"
                        id={`auto-sim-${evse.uid}`}
                        checked={session.isAuto !== false}
                        onChange={(e) => updateSessionTelemetryOnly(evse.uid, { isAuto: e.target.checked })}
                      />
                      <label htmlFor={`auto-sim-${evse.uid}`}>啟用充電進度自動累加</label>
                    </div>

                    <div className="telemetry-actions-row">
                      <button
                        onClick={() => updateSessionTelemetryAndSend(evse.uid, {})}
                        className="button telemetry-btn"
                        style={{ background: "linear-gradient(135deg, var(--accent-purple), var(--accent-blue))" }}
                      >
                        推送遙測 Session
                      </button>
                      <button
                        onClick={() => stopSimulatedCharging(evse.uid)}
                        className="button button-secondary telemetry-btn"
                        style={{ color: "var(--accent-red)", borderColor: "rgba(239, 68, 68, 0.2)" }}
                      >
                        停止充電 (Stop)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", marginTop: "4px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center" }}>
                      狀態: {evse.status}
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {evse.status === "AVAILABLE" ? (
                        <button
                          onClick={() => handlePatchStatus(selectedLocationId, evse.uid, "CHARGING")}
                          className="button button-secondary"
                          style={{ flex: 1, padding: "4px 0", fontSize: "11px", height: "28px" }}
                        >
                          模擬物理插槍
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePatchStatus(selectedLocationId, evse.uid, "AVAILABLE")}
                          className="button button-secondary"
                          style={{ flex: 1, padding: "4px 0", fontSize: "11px", height: "28px" }}
                        >
                          拔槍釋放
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
