import { useEffect, useRef, useState } from "react";
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
  locationId: string;
  evseUid: string;
  kwh: number;
  status: string;
  partyId: string;
  updatedAt: string;
  rawJson?: {
    id?: string;
    start_date_time?: string;
    location_id?: string;
    evse_uid?: string;
    emsp_id?: string;
    charging_periods?: Array<{
      start_date_time?: string;
      dimensions?: Array<{ type: string; volume?: number }>;
    }>;
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

interface EmspSimPageProps {
  mode?: "mock" | "real";
  embedded?: boolean;
}

interface TelemetryDraft {
  soc: number;
  kw: number;
  kwh: number;
  status: string;
}

const telemetryValue = (session: ExtendedDbSession, type: string, fallback: number) => {
  const dimensions = session.rawJson?.charging_periods?.flatMap((period) => period.dimensions || []) || [];
  const value = dimensions.find((dimension) => dimension.type === type)?.volume;
  return typeof value === "number" ? value : fallback;
};

export default function EmspSimPage({ mode = "real", embedded = false }: EmspSimPageProps) {
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
    handlePatchStatus,
    releaseActiveChargingSession,
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
  const [telemetryDrafts, setTelemetryDrafts] = useState<Record<string, TelemetryDraft>>({});
  const [autoTelemetrySessions, setAutoTelemetrySessions] = useState<Record<string, boolean>>({});
  const [historyStatusFilter, setHistoryStatusFilter] = useState("ALL");
  const telemetryDraftsRef = useRef(telemetryDrafts);
  const activeSessionsRef = useRef<ExtendedDbSession[]>([]);
  const locationsRef = useRef(locations);
  const autoTelemetryInFlightRef = useRef(new Set<string>());

  const isMockEmsp = (url?: string) => Boolean(url?.includes("/mock-emsp/"));
  const availableEmsps = emsps.filter((emsp) =>
    mode === "mock" ? isMockEmsp(emsp.url) : !isMockEmsp(emsp.url),
  );
  const defaultEmsp = availableEmsps.find((e) => e.active) || availableEmsps[0];
  const activeEmspId = selectedEmspIdForCmd || defaultEmsp?.id || "";

  const activeCommandEmsp = availableEmsps.find((e) => e.id === activeEmspId);
  const matchedLocation = locations.find((l) => l.id === selectedLocationId);
  const matchedEvses = matchedLocation?.evses || [];

  // Filter DB logs strictly by the selected EMSP Database ID (emsp_id in rawJson)
  const matchedSessions = (sessions as unknown as ExtendedDbSession[]).filter(
    (s) => s.rawJson?.emsp_id === activeEmspId,
  );
  const filteredSessions = Array.from(
    new Map(matchedSessions.map((session) => [session.id, session])).values(),
  );
  const activeFilteredSessions = filteredSessions.filter((s) => s.status === "ACTIVE");
  const historySessions = filteredSessions.filter(
    (session) => historyStatusFilter === "ALL" || session.status === historyStatusFilter,
  );
  const filteredCdrs = (cdrs as unknown as ExtendedDbCdr[]).filter(
    (c) => c.rawJson?.emsp_id === activeEmspId,
  );

  useEffect(() => {
    telemetryDraftsRef.current = telemetryDrafts;
  }, [telemetryDrafts]);

  useEffect(() => {
    activeSessionsRef.current = activeFilteredSessions;
  }, [activeFilteredSessions]);

  useEffect(() => {
    locationsRef.current = locations;
  }, [locations]);

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
      const localSession = Object.values(activeChargingSessions).find(
        (sess) =>
          sess.locationId === selectedLocationId &&
          sess.evseUid === selectedEvseUid &&
          (!sess.emspId || sess.emspId === activeEmspId),
      );
      const persistedSession = activeFilteredSessions.find(
        (session) =>
          session.evseUid === selectedEvseUid &&
          (session.locationId === selectedLocationId || session.rawJson?.location_id === selectedLocationId),
      );
      const sessionId = localSession?.sessionId || persistedSession?.id;
      if (!sessionId) {
        showToast("該槍頭目前沒有正在充電的 Session，無法發送停止命令！", "warning");
        return;
      }
      payload = {
        response_url: `${activeCommandEmsp.url}/ocpi/2.2.1/commands/STOP_SESSION`,
        session_id: sessionId,
      };
    }

    const res = await handleSendEmspCommand(tokenC, cmdType, payload);
    if (res.success) {
      showToast(`eMSP ${cmdType} 傳送成功！HUB 回應 ACCEPTED。`, "success");
    } else {
      showToast(`eMSP ${cmdType} 發送失敗: ${res.error || "詳細錯誤請見右側 Console 日誌"}`, "error");
    }
  };

  const getTelemetryDraft = (session: ExtendedDbSession): TelemetryDraft =>
    telemetryDrafts[session.id] || {
      soc: telemetryValue(session, "STATE_OF_CHARGE", 0),
      kw: telemetryValue(session, "POWER", 0),
      kwh: session.kwh || telemetryValue(session, "ENERGY", 0),
      status: session.status || "ACTIVE",
    };

  const updateTelemetryDraft = (session: ExtendedDbSession, fields: Partial<TelemetryDraft>) => {
    setTelemetryDrafts((current) => ({
      ...current,
      [session.id]: { ...getTelemetryDraft(session), ...fields },
    }));
  };

  const pushRealSessionTelemetry = async (
    session: ExtendedDbSession,
    telemetryOverride?: TelemetryDraft,
    silent = false,
  ) => {
    const draft = telemetryOverride || getTelemetryDraft(session);
    const location = locations.find((item) => item.id === session.locationId);
    const countryCode = location?.party?.countryCode || "TW";
    const partyId = location?.party?.partyId || "CPO";
    const now = new Date().toISOString();
    const startTime = session.rawJson?.start_date_time || session.updatedAt || now;
    const voltage = telemetryValue(session, "VOLTAGE", 400);
    const current = draft.kw > 0 && voltage > 0
      ? Math.round(((draft.kw * 1000) / voltage) * 10) / 10
      : 0;
    const payload = {
      ...session.rawJson,
      id: session.id,
      start_date_time: startTime,
      kwh: draft.kwh,
      location_id: session.locationId,
      evse_uid: session.evseUid,
      status: draft.status,
      emsp_id: activeEmspId,
      charging_periods: [{
        start_date_time: startTime,
        dimensions: [
          { type: "STATE_OF_CHARGE", volume: draft.soc },
          { type: "POWER", volume: draft.kw },
          { type: "ENERGY", volume: draft.kwh },
          { type: "CURRENT", volume: current },
          { type: "VOLTAGE", volume: voltage },
        ],
      }],
      last_updated: now,
    };

    try {
      const response = await fetch(
        `/simulator/simulate/sessions/${countryCode}/${partyId}/${session.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error(await response.text());
      if (draft.status === "COMPLETED" || draft.status === "INVALID") {
        await handlePatchStatus(session.locationId, session.evseUid, "AVAILABLE");
        releaseActiveChargingSession(session.evseUid, session.id);
      }
      addLog(
        "CPO_SIM",
        "REAL_EMSP_TELEMETRY",
        `Session ${session.id} 已回傳至 ${activeCommandEmsp?.name || "實體 eMSP"}: ${draft.status}, SoC ${draft.soc}%, ${draft.kwh} kWh`,
        "success",
        payload,
      );
      if (!silent) showToast(`Session ${session.id} 遙測已回傳`, "success");
      await fetchDatabaseState();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast(`Session 遙測回傳失敗：${message}`, "error");
    }
  };

  useEffect(() => {
    if (mode !== "real") return;

    const intervalSeconds = 15;
    const batteryCapacityKwh = 80;
    const timer = window.setInterval(() => {
      for (const session of activeSessionsRef.current) {
        if (!autoTelemetrySessions[session.id]) continue;
        if (autoTelemetryInFlightRef.current.has(session.id)) continue;

        const location = locationsRef.current.find((item) => item.id === session.locationId);
        const evse = location?.evses.find((item) => item.uid === session.evseUid);
        const connector = evse?.connectors?.[0] || evse?.rawJson?.connectors?.[0];
        const maxPowerKw = connector?.max_electric_power
          ? connector.max_electric_power / 1000
          : 120;
        const currentDraft = telemetryDraftsRef.current[session.id] || {
          soc: telemetryValue(session, "STATE_OF_CHARGE", 0),
          kw: telemetryValue(session, "POWER", maxPowerKw),
          kwh: session.kwh || telemetryValue(session, "ENERGY", 0),
          status: session.status || "ACTIVE",
        };
        const powerKw = currentDraft.kw > 0 ? Math.min(currentDraft.kw, maxPowerKw) : maxPowerKw;
        const addedKwh = powerKw * (intervalSeconds / 3600);
        const nextKwh = Math.round((currentDraft.kwh + addedKwh) * 1000) / 1000;
        const nextSoc = Math.min(
          100,
          Math.round((currentDraft.soc + (addedKwh / batteryCapacityKwh) * 100) * 10) / 10,
        );
        const completed = nextSoc >= 100;
        const nextDraft: TelemetryDraft = {
          ...currentDraft,
          soc: nextSoc,
          kw: completed ? 0 : powerKw,
          kwh: nextKwh,
          status: completed ? "COMPLETED" : "ACTIVE",
        };

        telemetryDraftsRef.current = {
          ...telemetryDraftsRef.current,
          [session.id]: nextDraft,
        };
        setTelemetryDrafts(telemetryDraftsRef.current);
        autoTelemetryInFlightRef.current.add(session.id);
        void pushRealSessionTelemetry(session, nextDraft, true).finally(() => {
          autoTelemetryInFlightRef.current.delete(session.id);
          if (completed) {
            setAutoTelemetrySessions((current) => ({ ...current, [session.id]: false }));
          }
        });
      }
    }, intervalSeconds * 1000);

    return () => window.clearInterval(timer);
    // The latest sessions, locations and drafts are read from refs so field edits do not restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeEmspId, autoTelemetrySessions]);

  const portalLabel = mode === "mock" ? "內建 Mock eMSP" : "實體 eMSP 串接";
  const portalDescription = mode === "mock"
    ? "使用本系統內建的 Mock eMSP 發送遠端指令，並在同一處查看模擬收到的 Session 與 CDR。"
    : "查看 CPO 充電槍硬體狀態，並將 SoC、功率、電量與 Session 狀態經 HUB 回傳至實體 eMSP。";

  return (
    <div className={embedded ? "emsp-embedded" : "workspace"}>
      {/* Selector Card */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>
              <UserCheck size={18} style={{ color: "var(--accent-purple)" }} />
              <span>{portalLabel}</span>
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
              {portalDescription}
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
          <label>切換當前操作的{mode === "mock" ? "內建 Mock" : "實體"} eMSP</label>
          <select
            value={activeEmspId}
            onChange={(e) => {
              setAutoTelemetrySessions({});
              setSelectedEmspIdForCmd(e.target.value);
            }}
          >
            <option value="">-- 請選擇 eMSP 帳戶 --</option>
            {availableEmsps.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.countryCode}-{e.partyId})
              </option>
            ))}
          </select>
        </div>
      </div>

      {availableEmsps.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "10px", padding: "20px", color: "var(--accent-red)" }}>
          <AlertTriangle size={20} />
          <div>
            <h4 style={{ margin: 0, fontWeight: "bold" }}>未偵測到{mode === "mock" ? "內建 Mock" : "實體"} eMSP 租戶</h4>
            <p style={{ fontSize: "12.5px", margin: "4px 0 0 0", color: "var(--text-secondary)" }}>
              請先前往 <strong>路由與租戶</strong> 註冊並啟用至少一個{mode === "mock" ? " Mock" : "實體"} eMSP 租戶。
            </p>
          </div>
        </div>
      ) : mode === "real" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="card" style={{ borderLeft: "4px solid var(--accent-blue)" }}>
            <div>
              <h3 className="card-title">
                <Zap size={18} style={{ color: "var(--accent-blue)" }} />
                <span>CPO 充電槍頭物理硬件狀態</span>
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "-10px", marginBottom: "16px" }}>
                查看目前場站各充電槍的實體狀態，以及是否有傳送至此 eMSP 的 ACTIVE Session。
              </p>
            </div>

            <div className="form-group" style={{ maxWidth: "480px", marginBottom: "16px" }}>
              <label>選擇 CPO 場站</label>
              <select
                value={selectedLocationId}
                onChange={(event) => {
                  const locationId = event.target.value;
                  setSelectedLocationId(locationId);
                  const location = locations.find((item) => item.id === locationId);
                  setSelectedEvseUid(location?.evses[0]?.uid || null);
                }}
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name || location.id} ({location.party?.countryCode || "TW"}-{location.party?.partyId || "CPO"})
                  </option>
                ))}
              </select>
            </div>

            <div className="evse-grid">
              {matchedEvses.map((evse) => {
                const session = activeFilteredSessions.find((item) => item.evseUid === evse.uid);
                return (
                  <div key={evse.uid} className={`evse-card ${session ? "charging" : ""}`} style={{ cursor: "default" }}>
                    <div className="evse-header">
                      <span style={{ fontSize: "12.5px", fontWeight: 700 }}>{evse.evse_id || evse.uid}</span>
                      <span className={`evse-badge ${session ? "charging" : evse.status.toLowerCase()}`}>
                        {evse.status}
                      </span>
                    </div>
                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>Session</span>
                        <strong style={{ color: session ? "var(--accent-blue)" : "var(--text-secondary)" }}>
                          {session?.id || "無 ACTIVE Session"}
                        </strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-muted)" }}>同步狀態</span>
                        <strong>{session?.status || "IDLE"}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ borderLeft: "4px solid var(--accent-green)" }}>
            <div>
              <h3 className="card-title">
                <CheckCircle size={18} style={{ color: "var(--accent-green)" }} />
                <span>Session 遙測與狀態回傳</span>
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "-10px", marginBottom: "16px" }}>
                編輯 CPO 即時量測值，透過 HUB 將 Session PUT 更新回傳至 <strong>{activeCommandEmsp?.name}</strong>。
              </p>
            </div>

            {activeFilteredSessions.length > 0 ? (
              <div className="real-telemetry-list">
                {activeFilteredSessions.map((session) => {
                  const draft = getTelemetryDraft(session);
                  return (
                    <article className="real-telemetry-card" key={`${session.partyId}-${session.id}`}>
                      <div className="real-telemetry-header">
                        <div><strong>{session.id}</strong><small>{session.evseUid}</small></div>
                        <span className={`evse-badge ${draft.status === "ACTIVE" ? "charging" : "available"}`}>{draft.status}</span>
                      </div>
                      <div className="telemetry-control-grid">
                        <div className="telemetry-input-field">
                          <label>SoC (%)</label>
                          <input type="number" min="0" max="100" value={draft.soc} onChange={(event) => updateTelemetryDraft(session, { soc: Number(event.target.value) || 0 })} />
                        </div>
                        <div className="telemetry-input-field">
                          <label>功率 (kW)</label>
                          <input type="number" min="0" value={draft.kw} onChange={(event) => updateTelemetryDraft(session, { kw: Number(event.target.value) || 0 })} />
                        </div>
                        <div className="telemetry-input-field">
                          <label>能量 (kWh)</label>
                          <input type="number" min="0" value={draft.kwh} onChange={(event) => updateTelemetryDraft(session, { kwh: Number(event.target.value) || 0 })} />
                        </div>
                        <div className="telemetry-input-field">
                          <label>Session Status</label>
                          <select value={draft.status} onChange={(event) => updateTelemetryDraft(session, { status: event.target.value })}>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="INVALID">INVALID</option>
                          </select>
                        </div>
                      </div>
                      <label className="real-telemetry-auto-toggle">
                        <input
                          type="checkbox"
                          checked={autoTelemetrySessions[session.id] === true}
                          onChange={(event) => setAutoTelemetrySessions((current) => ({
                            ...current,
                            [session.id]: event.target.checked,
                          }))}
                        />
                        <span>
                          <strong>自動傳送遙測</strong>
                          <small>每 15 秒依 DC 功率累加 SoC 與 kWh；取消勾選即為手動模式</small>
                        </span>
                      </label>
                      <button className="button" onClick={() => pushRealSessionTelemetry(session)}>
                        立即手動回傳
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <span><Zap size={24} /></span>
                <strong>目前沒有此 eMSP 的 ACTIVE Session</strong>
                <p>收到充電 Session 後，這裡會顯示 SoC、功率、kWh 與狀態回傳控制。</p>
              </div>
            )}

            <div className="session-history-section">
              <div className="session-history-toolbar">
                <div>
                  <strong>歷史 Session</strong>
                  <small>此 eMSP 的所有狀態紀錄（{filteredSessions.length}）</small>
                </div>
                <select value={historyStatusFilter} onChange={(event) => setHistoryStatusFilter(event.target.value)}>
                  <option value="ALL">全部狀態</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="INVALID">INVALID</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </div>

              {historySessions.length > 0 ? (
                <div className="session-history-table-wrap">
                  <table className="session-history-table">
                    <thead>
                      <tr>
                        <th>更新時間</th>
                        <th>Session ID</th>
                        <th>場站 / EVSE</th>
                        <th>SoC</th>
                        <th>電量</th>
                        <th>狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historySessions.map((session) => {
                        const location = locations.find((item) => item.id === session.locationId);
                        const soc = telemetryValue(session, "STATE_OF_CHARGE", 0);
                        return (
                          <tr key={`history-${session.partyId}-${session.id}`}>
                            <td>{new Date(session.updatedAt).toLocaleString("zh-TW")}</td>
                            <td className="session-history-id">{session.id}</td>
                            <td><strong>{location?.name || session.locationId}</strong><small>{session.evseUid}</small></td>
                            <td>{soc.toFixed(1)}%</td>
                            <td>{session.kwh.toFixed(1)} kWh</td>
                            <td><span className={`session-status-pill status-${session.status.toLowerCase()}`}>{session.status}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="session-history-empty">此狀態目前沒有 Session 紀錄</div>
              )}
            </div>
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
                {mode === "mock" ? "模擬車主使用 Mock eMSP APP" : "使用實體 eMSP 連線"}發起遠端充電指令（OCPI Commands 模組）。
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
                  活動中的漫遊 Session ({activeFilteredSessions.length})
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
                  {activeFilteredSessions.length > 0 ? (
                    activeFilteredSessions.map((s) => (
                      <div key={`${s.partyId}-${s.id}`} style={{ fontSize: "11.5px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.01)", padding: "8px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.02)" }}>
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
