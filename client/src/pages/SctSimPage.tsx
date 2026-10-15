import { useEffect, useState } from "react";
import { useSimulator } from "../context/SimulatorContext";
import { DollarSign, MapPin, UserCheck, FileText } from "../components/Icons";
import {
  SCT_COUNTRY_CODE,
  SCT_PARTY_ID,
  SCT_TARIFF_ID,
  SCT_TEST_CONFIG,
  buildSctTariff,
  computeIdleFee,
  isSctParty,
  sctBufferMinutes,
} from "../billing/sctIdleFee";
import type { ActiveSessionState } from "../types/simulator";

const SCT_LOCATION_ID = "SCT-LOC-001";
const SCT_TOKEN_B = "mock_sct_token_b_123";

function buildSctLocation() {
  const now = new Date().toISOString();
  const evse = (n: number) => ({
    uid: `SCT-EVSE-00${n}`,
    evse_id: `TW*SCT*E00${n}`,
    status: "AVAILABLE",
    capabilities: ["REMOTE_START_STOP_CAPABLE"],
    connectors: [
      {
        id: "1",
        standard: "IEC_62196_T2_COMBO",
        format: "CABLE",
        power_type: "DC",
        max_voltage: 1000,
        max_amperage: 200,
        max_electric_power: 120000,
        tariff_ids: [SCT_TARIFF_ID],
        last_updated: now,
      },
    ],
    last_updated: now,
  });
  return {
    country_code: SCT_COUNTRY_CODE,
    party_id: SCT_PARTY_ID,
    id: SCT_LOCATION_ID,
    publish: true,
    name: "星舟快充示例站",
    address: "示例路 1 號",
    city: "臺北市",
    postal_code: "100",
    country: "TWN",
    coordinates: { latitude: "25.033000", longitude: "121.565400" },
    parking_type: "ON_STREET",
    time_zone: "Asia/Taipei",
    opening_times: { twentyfourseven: true },
    evses: [evse(1), evse(2)],
    last_updated: now,
  };
}

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function IdlePanel({ session, now }: { session: ActiveSessionState; now: number }) {
  const chargingEnd = new Date(session.chargingEndTime!);
  const bufferEnd = chargingEnd.getTime() + sctBufferMinutes() * 60 * 1000;
  const inBuffer = now < bufferEnd;
  const idle = computeIdleFee(session.tariffSnapshot!, chargingEnd, new Date(now));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11.5px" }}>
      <span style={{ color: "var(--text-muted)" }}>佔槍經過</span>
      <span style={{ textAlign: "right" }}>{formatDuration(now - chargingEnd.getTime())}</span>
      <span style={{ color: "var(--text-muted)" }}>{inBuffer ? "緩衝剩餘" : "計費時長"}</span>
      <span style={{ textAlign: "right", color: inBuffer ? "var(--accent-green)" : "var(--accent-yellow)" }}>
        {inBuffer ? formatDuration(bufferEnd - now) : formatDuration(now - bufferEnd)}
      </span>
      <span style={{ color: "var(--text-muted)" }}>充電費</span>
      <span style={{ textAlign: "right" }}>NT$ {session.cost}</span>
      <span style={{ color: "var(--text-muted)" }}>佔槍費 (預估)</span>
      <span style={{ textAlign: "right", color: "var(--accent-yellow)", fontWeight: 700 }}>NT$ {idle.idleCost}</span>
      <span style={{ color: "var(--text-muted)" }}>開始計費推送</span>
      <span style={{ textAlign: "right" }}>{session.idleBillingPushed ? "已推送 ACTIVE" : "尚未 (緩衝中不推送)"}</span>
    </div>
  );
}

export default function SctSimPage() {
  const {
    locations,
    emsps,
    routingRules,
    activeChargingSessions,
    cdrPayloadEdit,
    startSimulatedCharging,
    stopSimulatedCharging,
    unplugVehicle,
    handleAddCpo,
    handleAddRoutingRule,
    handleSyncCustomLocation,
    handleSyncCustomTariff,
    fetchDatabaseState,
    showToast,
  } = useSimulator();

  const sctLocations = locations.filter((l) => isSctParty(l.party?.partyId));
  const mockEmsps = emsps.filter((e) => e.url?.includes("/mock-emsp/"));

  const [locationId, setLocationId] = useState("");
  const [tokenUid, setTokenUid] = useState("SCT-TEST-TOKEN-001");
  const [emspId, setEmspId] = useState("");
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const location = sctLocations.find((l) => l.id === locationId) || sctLocations[0];
  const selectedEmspId = emspId || (mockEmsps.find((e) => e.active) || mockEmsps[0])?.id || "";
  const lastSctCdr = cdrPayloadEdit?.party_id === SCT_PARTY_ID ? cdrPayloadEdit : null;

  // Re-render every second for the buffer countdown and the live idle-fee estimate
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pushTariff = () =>
    handleSyncCustomTariff(SCT_COUNTRY_CODE, SCT_PARTY_ID, SCT_TARIFF_ID, buildSctTariff());

  const setupEnvironment = async () => {
    setIsSettingUp(true);
    try {
      const cpo = await handleAddCpo(SCT_COUNTRY_CODE, SCT_PARTY_ID, "星舟快充 (測試)", SCT_TOKEN_B);
      if (!cpo.success) throw new Error(`註冊 CPO 失敗: ${cpo.error}`);

      // Route SCT traffic to every built-in mock eMSP, reusing an existing rule's endpoint when present
      for (const emsp of mockEmsps) {
        const existing = routingRules.find(
          (r) => r.emspPartyId === emsp.partyId && r.emspCountryCode === emsp.countryCode,
        );
        const rule = await handleAddRoutingRule({
          cpoCountryCode: SCT_COUNTRY_CODE,
          cpoPartyId: SCT_PARTY_ID,
          emspCountryCode: emsp.countryCode,
          emspPartyId: emsp.partyId,
          emspBaseUrl: existing?.emspBaseUrl || emsp.url,
          emspTokenB: existing?.emspTokenB || emsp.tokenC || "mock_token",
          channelStatus: "PROD_ACTIVE",
        });
        if (!rule.success) throw new Error(`建立路由 SCT → ${emsp.partyId} 失敗: ${rule.error}`);
      }

      const loc = await handleSyncCustomLocation(SCT_COUNTRY_CODE, SCT_PARTY_ID, SCT_LOCATION_ID, buildSctLocation());
      if (!loc.success) throw new Error(`推送場站失敗: ${loc.error}`);
      const tariff = await pushTariff();
      if (!tariff.success) throw new Error(`推送 Tariff 失敗: ${tariff.error}`);

      await fetchDatabaseState();
      setLocationId(SCT_LOCATION_ID);
      showToast("星舟測試環境建立完成", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setIsSettingUp(false);
    }
  };

  return (
    <div className="workspace">
      <div className="operation-steps" aria-label="星舟佔槍費流程">
        {[
          ["充電", "Session ACTIVE"],
          ["停止充電", "本機或 eMSP STOP"],
          [`緩衝 ${SCT_TEST_CONFIG.bufferMinutes} 分`, "不推送 Session"],
          [`佔槍 NT$${SCT_TEST_CONFIG.idlePricePerMinute}/分`, "推送一次 ACTIVE"],
          ["拔槍", "PATCH COMPLETED → CDR"],
        ].map(([title, sub], i, all) => (
          <div key={title} style={{ display: "contents" }}>
            <div className="operation-step">
              <span>{i + 1}</span>
              <div><strong>{title}</strong><small>{sub}</small></div>
            </div>
            {i < all.length - 1 && <div className="step-connector" />}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "24px" }}>
        <div className="card" style={{ borderLeft: "4px solid var(--accent-yellow)" }}>
          <h3 className="card-title">
            <DollarSign size={18} style={{ color: "var(--accent-yellow)" }} />
            <span>星舟測試環境與費率</span>
          </h3>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "-10px", marginBottom: "16px" }}>
            依《星舟快充佔槍費 OCPI 串接規格 v1.6》模擬。下列為測試用費率，非星舟正式價格。
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12.5px", marginBottom: "16px" }}>
            <span style={{ color: "var(--text-muted)" }}>CPO</span><span>{SCT_COUNTRY_CODE}-{SCT_PARTY_ID}</span>
            <span style={{ color: "var(--text-muted)" }}>Tariff ID</span><span>{SCT_TARIFF_ID} (REGULAR)</span>
            <span style={{ color: "var(--text-muted)" }}>充電費</span><span>NT$ {SCT_TEST_CONFIG.energyPricePerKwh} / kWh</span>
            <span style={{ color: "var(--text-muted)" }}>免費緩衝</span><span>{SCT_TEST_CONFIG.bufferMinutes} 分鐘</span>
            <span style={{ color: "var(--text-muted)" }}>佔槍費</span><span>NT$ {SCT_TEST_CONFIG.idlePricePerMinute} / 分鐘 (不足 1 分以 1 分計)</span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button className="button" onClick={setupEnvironment} disabled={isSettingUp || mockEmsps.length === 0}>
              {isSettingUp ? "建立中..." : "一鍵建立星舟測試環境"}
            </button>
            <button
              className="button button-secondary"
              onClick={async () => {
                const res = await pushTariff();
                showToast(res.success ? "Tariff 已推送" : `推送失敗: ${res.error}`, res.success ? "success" : "error");
              }}
            >
              重新推送 Tariff
            </button>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "10px" }}>
            建立內容：註冊 CPO {SCT_PARTY_ID}、建立 SCT → 內建 Mock eMSP 路由、推送場站 {SCT_LOCATION_ID}（2 槍）、推送依日期展開（今天起 3 天）的 Tariff。
          </p>
          <details style={{ marginTop: "8px" }}>
            <summary style={{ fontSize: "12px", cursor: "pointer" }}>Tariff JSON 預覽</summary>
            <pre style={{ fontSize: "11px", maxHeight: "260px", overflow: "auto" }}>
              {JSON.stringify(buildSctTariff(), null, 2)}
            </pre>
          </details>
        </div>

        <div className="card" style={{ borderLeft: "4px solid var(--accent-blue)" }}>
          <h3 className="card-title">
            <UserCheck size={18} style={{ color: "var(--accent-blue)" }} />
            <span>啟動充電</span>
          </h3>
          {sctLocations.length === 0 ? (
            <p style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>尚無星舟場站，請先「一鍵建立星舟測試環境」。</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="form-group">
                <label>場站</label>
                <select value={location?.id || ""} onChange={(e) => setLocationId(e.target.value)}>
                  {sctLocations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name || l.id}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>RFID 卡號 (Token UID)</label>
                <input type="text" value={tokenUid} onChange={(e) => setTokenUid(e.target.value)} />
              </div>
              <div className="form-group">
                <label>eMSP</label>
                <select value={selectedEmspId} onChange={(e) => setEmspId(e.target.value)}>
                  {mockEmsps.map((e) => (
                    <option key={e.id} value={e.id}>{e.name} ({e.partyId})</option>
                  ))}
                </select>
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                也可以從 Mock eMSP 下 START_SESSION / STOP_SESSION。星舟的 STOP_SESSION 只會停止充電，Session 維持 ACTIVE，直到在下方按「拔槍」。
              </p>
            </div>
          )}
        </div>
      </div>

      {location && (
        <div className="card">
          <h3 className="card-title">
            <MapPin size={18} />
            <span>{location.name || location.id} 充電槍</span>
          </h3>
          <div className="evse-grid">
            {location.evses.map((evse) => {
              const session = activeChargingSessions[evse.uid];
              const phase = session?.phase;
              const badge = !session ? evse.status : phase === "IDLE" ? "IDLE / 佔槍" : "CHARGING";

              return (
                <div key={evse.uid} className={`evse-card ${session ? "charging" : ""}`} style={{ cursor: "default" }}>
                  <div className="evse-header">
                    <span style={{ fontSize: "12.5px", fontWeight: 700 }}>{evse.evse_id || evse.uid}</span>
                    <span className={`evse-badge ${session ? "charging" : evse.status.toLowerCase()}`}>{badge}</span>
                  </div>

                  {!session && (
                    <button
                      className="button"
                      style={{ marginTop: "12px", width: "100%" }}
                      disabled={!selectedEmspId || evse.status !== "AVAILABLE"}
                      onClick={() =>
                        startSimulatedCharging(location.id, evse.uid, false, null, undefined, true, tokenUid, selectedEmspId)
                      }
                    >
                      插槍並刷卡充電
                    </button>
                  )}

                  {session && phase !== "IDLE" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                        <span>SoC {session.soc}%</span>
                        <span>{session.kwh.toFixed(2)} kWh · NT$ {session.cost}</span>
                      </div>
                      <div className="charging-bar-container">
                        <div className="charging-bar-fill" style={{ width: `${session.soc}%` }}></div>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>Session {session.sessionId}</div>
                      <button
                        className="button button-secondary"
                        style={{ color: "var(--accent-red)", borderColor: "rgba(239, 68, 68, 0.2)" }}
                        onClick={() => stopSimulatedCharging(evse.uid)}
                      >
                        停止充電 (車未拔槍)
                      </button>
                    </div>
                  )}

                  {session && phase === "IDLE" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        Session {session.sessionId} · {session.kwh.toFixed(2)} kWh
                      </div>
                      <IdlePanel session={session} now={now} />
                      <button
                        className="button"
                        style={{ background: "linear-gradient(135deg, var(--accent-yellow), var(--accent-red))" }}
                        onClick={() => unplugVehicle(evse.uid)}
                      >
                        拔槍並結算
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {lastSctCdr && (
        <div className="card">
          <h3 className="card-title">
            <FileText size={18} />
            <span>最近一筆星舟 CDR ({lastSctCdr.id})</span>
          </h3>
          <SctCdrSummary cdr={lastSctCdr} />
          <details style={{ marginTop: "8px" }}>
            <summary style={{ fontSize: "12px", cursor: "pointer" }}>完整 CDR JSON</summary>
            <pre style={{ fontSize: "11px", maxHeight: "360px", overflow: "auto" }}>{JSON.stringify(lastSctCdr, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

function SctCdrSummary({ cdr }: { cdr: Record<string, unknown> }) {
  const price = (key: string) => (cdr[key] as { incl_vat?: number } | undefined)?.incl_vat ?? 0;
  const rows: [string, string][] = [
    ["total_energy", `${cdr.total_energy} kWh`],
    ["total_energy_cost", `NT$ ${price("total_energy_cost")}`],
    ["total_time", `${cdr.total_time} h`],
    ["total_parking_time", `${cdr.total_parking_time} h (含免費緩衝)`],
    ["total_parking_cost", `NT$ ${price("total_parking_cost")}`],
    ["total_cost", `NT$ ${price("total_cost")}`],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: "12.5px" }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>{k}</span>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}
