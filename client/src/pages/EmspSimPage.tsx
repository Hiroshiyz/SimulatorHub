import { useState } from "react";
import { useSimulator } from "../context/SimulatorContext";
import {
  UserCheck,
  Zap,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from "../components/Icons";

interface ExtendedDbSession {
  id: string;
  evseUid: string;
  kwh: number;
  status: string;
  partyId: string;
  updatedAt: string;
  rawJson?: {
    location_id?: string;
    emsp_id?: string;
    total_cost?: {
      incl_vat?: number;
      excl_vat?: number;
    };
    [key: string]: unknown;
  };
}

interface ExtendedDbCdr {
  id: string;
  createdAt: string;
  partyId: string;
  rawJson?: {
    emsp_id?: string;
    total_cost?: {
      incl_vat?: number;
    };
    total_time?: number;
    total_energy?: number;
  };
}

export default function EmspSimPage() {
  const {
    locations,
    selectedLocationId,
    setSelectedLocationId,
    selectedEvseUid,
    setSelectedEvseUid,
    activeChargingSessions,
    emsps,
    sessions,
    cdrs,
    handleSendEmspCommand,
    fetchDatabaseState,
    addLog,
    showToast,
  } = useSimulator();

  // EMSP Commands Panel State
  const [selectedEmspIdForCmd, setSelectedEmspIdForCmd] = useState<string>("");
  const [cmdTokenUid, setCmdTokenUid] = useState<string>("TW-EMO-889900");
  const [cmdAuthRef, setCmdAuthRef] = useState<string>(
    () => `AUTH-${Math.floor(100000 + Math.random() * 900000)}`,
  );

  const defaultEmsp = emsps.find((e) => e.active) || emsps[0];
  const activeEmspId = selectedEmspIdForCmd || defaultEmsp?.id || "";

  const activeCommandEmsp = emsps.find((e) => e.id === activeEmspId);
  const matchedLocation = locations.find((l) => l.id === selectedLocationId);
  const matchedEvses = matchedLocation?.evses || [];

  // Filter DB logs strictly by the selected EMSP Database ID (emsp_id in rawJson)
  const filteredSessions = (sessions as unknown as ExtendedDbSession[]).filter(
    (s) => s.rawJson?.emsp_id === activeEmspId,
  );
  const filteredCdrs = (cdrs as unknown as ExtendedDbCdr[]).filter(
    (c) => c.rawJson?.emsp_id === activeEmspId,
  );

  const handleSendCommandClick = async (cmdType: "START_SESSION" | "STOP_SESSION") => {
    if (!activeCommandEmsp) {
      showToast("請先選擇一個 eMSP 發送方！", "warning");
      return;
    }

    const tokenC = activeCommandEmsp.tokenC || "";
    if (!tokenC) {
      showToast("所選 eMSP 缺少 Token C 認證，無法發送請求！", "error");
      return;
    }

    let payload: Record<string, unknown>;
    if (cmdType === "START_SESSION") {
      if (!selectedLocationId || !selectedEvseUid) {
        showToast("請先選擇目標場站與充電槍！", "warning");
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
        showToast("該槍頭目前沒有正在充電的 Session，無法發送停止命令！", "warning");
        return;
      }
      payload = {
        response_url: `${activeCommandEmsp.url}/ocpi/2.2.1/commands/STOP_SESSION`,
        session_id: matchedSession.sessionId,
      };
    }

    const res = await handleSendEmspCommand(tokenC, cmdType, payload);
    if (res.success) {
      showToast(`eMSP ${cmdType} 傳送成功！HUB 回應 ACCEPTED。`, "success");
    } else {
      showToast(`eMSP ${cmdType} 發送失敗: ${res.error || "詳細錯誤請見右側 Console 日誌"}`, "error");
    }
  };

  return (
    <div className="workspace">
      {/* Selector Card */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>
              <UserCheck size={18} style={{ color: "var(--accent-purple)" }} />
              <span>eMSP 租戶操作端 (Mock eMSP Portal)</span>
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              切換不同的 eMSP 帳戶，以其角度向 HUB 發送遠端指令，並即時查閱該 eMSP 接收到的漫遊數據。
            </p>
          </div>
          <button
            onClick={() => {
              addLog("SYSTEM", "REFRESH_EMSP_DATA", "手動更新 DB 狀態與漫遊資料...", "info");
              fetchDatabaseState();
            }}
            className="button button-secondary"
            style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", fontSize: "12px", padding: "0 12px", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            <RefreshCw size={13} />
            <span>重新整理</span>
          </button>
        </div>

        <div className="form-group" style={{ marginTop: "16px", maxWidth: "400px" }}>
          <label>切換當前操作的 eMSP</label>
          <select
            value={selectedEmspIdForCmd}
            onChange={(e) => setSelectedEmspIdForCmd(e.target.value)}
          >
            <option value="">-- 請選擇 eMSP 帳戶 --</option>
            {emsps.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.countryCode}-{e.partyId}) - {e.url?.includes("mock-emsp") ? "MOCK" : "REAL"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {emsps.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "10px", padding: "20px", color: "var(--accent-red)" }}>
          <AlertTriangle size={20} />
          <div>
            <h4 style={{ margin: 0, fontWeight: "bold" }}>未偵測到已啟用的 eMSP 租戶</h4>
            <p style={{ fontSize: "12.5px", margin: "4px 0 0 0", color: "var(--text-secondary)" }}>
              請先前往 <strong>HUB 控制面板</strong> 註冊並啟用至少一個 eMSP 租戶，才能使用此處的模擬功能。
            </p>
          </div>
        </div>
      ) : (
        <div className="emsp-grid">
          {/* Left: Remote Commands Card */}
          <div className="card" style={{ borderLeft: "4px solid var(--accent-purple)", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <h3 className="card-title">
                <Zap size={18} style={{ color: "var(--accent-purple)" }} />
                <span>發送遠端充電控制命令 (Remote Commands)</span>
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "-10px" }}>
                模擬車主使用該 eMSP APP 發起遠端充電指令（OCPI Commands 模組）。
              </p>
            </div>

            {activeCommandEmsp ? (
              <div style={{
                background: "rgba(124, 58, 237, 0.03)",
                border: "1px solid rgba(124, 58, 237, 0.15)",
                borderRadius: "10px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}>
                <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", margin: 0, gap: "12px" }}>
                  <div className="form-group">
                    <label>選擇目標 CPO 場站</label>
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
                    <label>選擇目標充電槍 (EVSE)</label>
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

                <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr", margin: 0, gap: "12px" }}>
                  <div className="form-group">
                    <label>RFID 卡號 (token.uid)</label>
                    <input
                      type="text"
                      value={cmdTokenUid}
                      onChange={(e) => setCmdTokenUid(e.target.value)}
                      style={{ height: "34px", fontSize: "12.5px" }}
                    />
                  </div>
                  <div className="form-group">
                    <label>授權交易序號 (auth_ref)</label>
                    <input
                      type="text"
                      value={cmdAuthRef}
                      onChange={(e) => setCmdAuthRef(e.target.value)}
                      style={{ height: "34px", fontSize: "12.5px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  <button
                    onClick={() => handleSendCommandClick("START_SESSION")}
                    className="button"
                    style={{ flex: 1, height: "36px", fontSize: "12px", background: "linear-gradient(135deg, var(--accent-purple), #7c3aed)", whiteSpace: "nowrap" }}
                    disabled={!selectedEvseUid}
                  >
                    <Zap size={13} style={{ marginRight: "4px" }} />
                    遠端啟動 (START)
                  </button>
                  <button
                    onClick={() => handleSendCommandClick("STOP_SESSION")}
                    className="button button-secondary"
                    style={{ flex: 1, height: "36px", fontSize: "12px", color: "var(--accent-red)", borderColor: "rgba(239, 68, 68, 0.2)", whiteSpace: "nowrap" }}
                    disabled={!selectedEvseUid}
                  >
                    遠端停止 (STOP)
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.15)", borderRadius: "8px", padding: "12px", color: "var(--accent-yellow)", fontSize: "12px" }}>
                <AlertTriangle size={16} />
                <span>請先選擇一個已啟用的 eMSP 帳戶</span>
              </div>
            )}
          </div>

          {/* Right: Roaming DB Logs Card */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <h3 className="card-title">
                <CheckCircle size={18} style={{ color: "var(--accent-green)" }} />
                <span>此 eMSP 接收之漫遊資料 (EMSP DB Logs)</span>
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "-10px" }}>
                即時查閱寫入 <strong>{activeCommandEmsp?.name || "此"}</strong> 資料庫之 Sessions 及結算帳單。
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Active Sessions */}
              <div style={{ background: "rgba(0,0,0,0.15)", padding: "14px", borderRadius: "10px", border: "1px solid var(--glass-border)" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>
                  活動中的漫遊 Session ({filteredSessions.filter((s) => s.status === "ACTIVE").length})
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
                  {filteredSessions.length > 0 ? (
                    filteredSessions.map((s) => (
                      <div key={s.id} style={{ fontSize: "11.5px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.01)", padding: "8px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.02)" }}>
                        <span style={{ fontFamily: "var(--font-mono)" }}>ID: {s.id} ({s.evseUid})</span>
                        <span>
                          <strong style={{ color: "white" }}>{s.kwh.toFixed(1)} kWh</strong>
                          <span style={{
                            marginLeft: "8px",
                            fontSize: "9.5px",
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
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", display: "block", padding: "12px 0" }}>
                      目前無此 eMSP 漫遊 Session 資料
                    </span>
                  )}
                </div>
              </div>

              {/* CDRs List */}
              <div style={{ background: "rgba(0,0,0,0.15)", padding: "14px", borderRadius: "10px", border: "1px solid var(--glass-border)" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: "8px" }}>
                  已收訖之結算 CDR 帳單 ({filteredCdrs.length})
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
                  {filteredCdrs.length > 0 ? (
                    filteredCdrs.map((c) => {
                      const cost = c.rawJson?.total_cost?.incl_vat || 0;
                      const energy = c.rawJson?.total_energy || 0;
                      return (
                        <div key={c.id} style={{ fontSize: "11.5px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.01)", padding: "8px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.02)" }}>
                          <span style={{ fontFamily: "var(--font-mono)" }}>單號: {c.id}</span>
                          <span>
                            <span style={{ color: "var(--text-secondary)", marginRight: "8px" }}>{energy.toFixed(1)} kWh</span>
                            <strong style={{ color: "var(--accent-green)" }}>TWD {cost}</strong>
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", display: "block", padding: "12px 0" }}>
                      尚未收到任何結帳帳單 (CDRs)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
