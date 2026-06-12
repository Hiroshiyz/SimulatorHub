import { useState, useEffect, useRef } from "react";

// Interfaces
interface EvseConnector {
  id: string;
  format: string;
  standard: string;
  power_type: string;
  tariff_ids: string[];
  max_voltage: number;
  max_amperage: number;
  max_electric_power: number;
}

interface Evse {
  uid: string;
  evse_id: string | null;
  status: string;
  rawJson?: {
    connectors?: {
      power_type?: string;
      max_electric_power?: number;
    }[];
  };
  connectors?: EvseConnector[];
}

interface Location {
  partyId: string;
  id: string;
  name: string | null;
  address: string;
  city: string;
  postalCode: string | null;
  country: string;
  coordinates: {
    latitude?: string;
    longitude?: string;
  };
  evses: Evse[];
}

interface LogEntry {
  id: string;
  time: string;
  action: string;
  method: string;
  url: string;
  payload?: unknown;
  response?: unknown;
  success: boolean;
}

interface DbSession {
  id: string;
  evseUid: string;
  kwh: number;
  status: string;
  updatedAt: string;
}

interface DbCdr {
  id: string;
  createdAt: string;
  rawJson?: {
    total_cost?: {
      incl_vat?: number;
    };
    total_time?: number;
    total_energy?: number;
  };
}

interface ActiveSessionState {
  sessionId: string;
  evseUid: string;
  locationId: string;
  kwh: number;
  soc: number;
  cost: number;
  startTime: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "stations" | "transactions"
  >("overview");
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [serverVersion, setServerVersion] = useState<string>("Unknown");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [targetCpoUrl] = useState<string>("http://localhost:3030");

  // Database states
  const [locations, setLocations] = useState<Location[]>([]);
  const [sessions, setSessions] = useState<DbSession[]>([]);
  const [cdrs, setCdrs] = useState<DbCdr[]>([]);

  // RWD & UI layout states
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [terminalExpanded, setTerminalExpanded] = useState<boolean>(false);
  const [filterMethod, setFilterMethod] = useState<string>("ALL");

  // Interactive flow animation state
  const [flowStep, setFlowStep] = useState<"idle" | "cpo" | "hub" | "emsp">(
    "idle",
  );

  // Selection & Input states
  const [selectedEvseUid, setSelectedEvseUid] = useState<string | null>(null);
  const [customEvseStatus, setCustomEvseStatus] = useState<string>("AVAILABLE");
  const [newSessionId, setNewSessionId] = useState<string>("");

  // Client-side local active charging sessions simulation tracker
  const [activeChargingSessions, setActiveChargingSessions] = useState<{
    [evseUid: string]: ActiveSessionState;
  }>({});

  const terminalBodyRef = useRef<HTMLDivElement>(null);

  // Fetch all databases (locations, sessions, CDRs) from simulator backend
  const fetchDatabaseState = async () => {
    try {
      const [locRes, sessRes, cdrRes] = await Promise.all([
        fetch("/simulator/locations"),
        fetch("/simulator/sessions"),
        fetch("/simulator/cdrs"),
      ]);

      if (locRes.ok) {
        const locData = await locRes.json();
        setLocations(locData);
      }
      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setSessions(sessData);
      }
      if (cdrRes.ok) {
        const cdrData = await cdrRes.json();
        setCdrs(cdrData);
      }
    } catch (err) {
      console.error("Failed to query database state:", err);
    }
  };

  // Check connection status & retrieve version details
  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const res = await fetch("/simulator/health");
        if (res.ok) {
          if (!active) return;
          setIsOnline(true);
          setServerVersion("2.2.1");
        } else {
          if (!active) return;
          setIsOnline(false);
        }
      } catch {
        if (!active) return;
        setIsOnline(false);
      }
    };

    const init = async () => {
      await checkStatus();
      await fetchDatabaseState();
    };
    init();

    const statusTimer = setInterval(checkStatus, 10000);
    const dbTimer = setInterval(fetchDatabaseState, 10000); // sync db status every 5s

    return () => {
      active = false;
      clearInterval(statusTimer);
      clearInterval(dbTimer);
    };
  }, []);

  // Scroll to bottom of terminal when logs update
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs]);

  // Log activity appender
  const addLog = (
    action: string,
    method: string,
    url: string,
    payload: unknown,
    response: unknown,
    success: boolean,
  ) => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      action,
      method,
      url,
      payload,
      response,
      success,
    };
    setLogs((prev) => [...prev, newEntry]);
  };

  // Trigger flowchart visual animation path
  const triggerFlowAnimation = (hasForwarding = true) => {
    setFlowStep("cpo");
    setTimeout(() => {
      setFlowStep("hub");
      if (hasForwarding) {
        setTimeout(() => {
          setFlowStep("emsp");
          setTimeout(() => setFlowStep("idle"), 2000);
        }, 800);
      } else {
        setTimeout(() => setFlowStep("idle"), 2000);
      }
    }, 600);
  };

  // Generic request sender
  const sendRequest = async (
    action: string,
    endpoint: string,
    method: "POST" | "PUT" | "PATCH",
    bodyObj?: unknown,
    hasForwarding = true,
  ) => {
    try {
      const options: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
      };
      if (bodyObj) {
        options.body = JSON.stringify(bodyObj);
      }

      triggerFlowAnimation(hasForwarding);
      const res = await fetch(endpoint, options);
      const resData = await res.json();

      addLog(action, method, endpoint, bodyObj, resData, res.ok);

      // Refresh DB state
      await fetchDatabaseState();

      return { success: res.ok, data: resData };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addLog(action, method, endpoint, bodyObj, { error: errorMessage }, false);
      return { success: false, error: errorMessage };
    }
  };

  // Quick seed initialization for 4 stations
  const initializeMockStations = async () => {
    const defaultPayload = {
      id: "loc_001",
      name: "新板特區特快充電站 (Mock CPO)",
      address: "新北市板橋區中山路一段161號",
      city: "板橋區",
      postal_code: "220",
      country: "TWN",
      coordinates: { latitude: "25.0123", longitude: "121.4657" },
      parking_type: "ON_STREET",
      opening_times: "24/7",
      charging_when_closed: true,
      evses: [
        {
          uid: "evse_uid_101",
          evse_id: "TW*CPO*E*101",
          status: "AVAILABLE",
          capabilities: ["REMOTE_START_STOP_ALLOWED"],
          connectors: [
            {
              id: "1",
              format: "CABLE",
              standard: "CCS_2",
              power_type: "DC",
              tariff_ids: ["tariff_001"],
              max_voltage: 800,
              max_amperage: 300,
              max_electric_power: 120000,
            },
          ],
        },
        {
          uid: "evse_uid_102",
          evse_id: "TW*CPO*E*102",
          status: "AVAILABLE",
          capabilities: ["REMOTE_START_STOP_ALLOWED"],
          connectors: [
            {
              id: "1",
              format: "CABLE",
              standard: "CCS_2",
              power_type: "DC",
              tariff_ids: ["tariff_001"],
              max_voltage: 800,
              max_amperage: 300,
              max_electric_power: 120000,
            },
          ],
        },
        {
          uid: "evse_uid_103",
          evse_id: "TW*CPO*E*103",
          status: "AVAILABLE",
          capabilities: ["REMOTE_START_STOP_ALLOWED"],
          connectors: [
            {
              id: "1",
              format: "CABLE",
              standard: "IEC_62196_T2",
              power_type: "AC_3PHASE",
              tariff_ids: ["tariff_001"],
              max_voltage: 400,
              max_amperage: 32,
              max_electric_power: 22000,
            },
          ],
        },
        {
          uid: "evse_uid_104",
          evse_id: "TW*CPO*E*104",
          status: "AVAILABLE",
          capabilities: ["REMOTE_START_STOP_ALLOWED"],
          connectors: [
            {
              id: "1",
              format: "CABLE",
              standard: "IEC_62196_T2",
              power_type: "AC_3PHASE",
              tariff_ids: ["tariff_001"],
              max_voltage: 400,
              max_amperage: 32,
              max_electric_power: 22000,
            },
          ],
        },
      ],
    };

    await sendRequest(
      "Initialize Mock Stations",
      "/simulator/simulate/locations/TW/CPO/loc_001",
      "POST",
      defaultPayload,
    );
  };

  // Change EVSE Status manually (PATCH)
  const handlePatchStatus = async (
    locationId: string,
    evseUid: string,
    nextStatus: string,
  ) => {
    const payload = {
      status: nextStatus,
      last_updated: new Date().toISOString(),
    };
    await sendRequest(
      `Patch Status -> ${nextStatus}`,
      `/simulator/simulate/locations/TW/CPO/${locationId}/${evseUid}`,
      "POST", // Express routing simulator handles POST to forward PATCH
      payload,
    );
  };

  // Simulate Charging Telemetry interval (increments SoC/kWh every 5 seconds)
  useEffect(() => {
    const chargingTimer = setInterval(async () => {
      const activeUids = Object.keys(activeChargingSessions);
      if (activeUids.length === 0) return;

      for (const uid of activeUids) {
        const session = activeChargingSessions[uid];

        // Locate this EVSE connector to see if it's DC or AC
        let powerIncrement = 0.8; // default AC kWh increment
        const maxSoc = 100;

        const matchingEvse = locations
          .flatMap((l) => l.evses)
          .find((e) => e.uid === uid);

        if (
          matchingEvse &&
          matchingEvse.rawJson?.connectors?.[0]?.power_type === "DC"
        ) {
          powerIncrement = 4.2; // faster DC charging
        }

        const nextSoc = Math.min(maxSoc, session.soc + 4);
        const nextKwh = Number((session.kwh + powerIncrement).toFixed(2));
        const nextCost = Number((nextKwh * 8.5).toFixed(1));

        // Update local session state
        setActiveChargingSessions((prev) => ({
          ...prev,
          [uid]: {
            ...prev[uid],
            soc: nextSoc,
            kwh: nextKwh,
            cost: nextCost,
          },
        }));

        // Send telemetry Session PUT update to CPO receiver
        const sessionPayload = {
          id: session.sessionId,
          start_date_time: session.startTime,
          kwh: nextKwh,
          cdr_token: {
            uid: "token_abc123",
            type: "RFID",
            contract_id: "TW-EMSP-C1001",
          },
          auth_method: "AUTH_REQUEST",
          location_id: session.locationId,
          evse_uid: session.evseUid,
          connector_id: "1",
          status: "ACTIVE",
          total_cost: {
            excl_vat: Number((nextCost * 0.95).toFixed(2)),
            incl_vat: nextCost,
          },
          last_updated: new Date().toISOString(),
        };

        // We set hasForwarding=true. This sends PUT and triggers flow lights
        await fetch(
          `/simulator/simulate/sessions/TW/CPO/${session.sessionId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sessionPayload),
          },
        );

        // Trigger flowchart light update locally to indicate heartbeats
        triggerFlowAnimation(true);
      }

      // Sync database overview
      fetchDatabaseState();
    }, 5000);

    return () => clearInterval(chargingTimer);
  }, [activeChargingSessions, locations]);

  // Start simulated charging session
  const startSimulatedCharging = async (
    locationId: string,
    evseUid: string,
  ) => {
    const generatedSessId =
      newSessionId.trim() || `sess_${Math.floor(1000 + Math.random() * 9000)}`;
    const startTimeStr = new Date().toISOString();

    // 1. PATCH EVSE status to CHARGING
    await handlePatchStatus(locationId, evseUid, "CHARGING");

    // 2. Put Session to CPO receiver (State: ACTIVE)
    const initialSessionPayload = {
      id: generatedSessId,
      start_date_time: startTimeStr,
      kwh: 0.0,
      cdr_token: {
        uid: "token_abc123",
        type: "RFID",
        contract_id: "TW-EMSP-C1001",
      },
      auth_method: "AUTH_REQUEST",
      location_id: locationId,
      evse_uid: evseUid,
      connector_id: "1",
      status: "ACTIVE",
      total_cost: { excl_vat: 0.0, incl_vat: 0.0 },
      last_updated: startTimeStr,
    };

    const res = await sendRequest(
      `Start Session [${generatedSessId}]`,
      `/simulator/simulate/sessions/TW/CPO/${generatedSessId}`,
      "POST",
      initialSessionPayload,
    );

    if (res.success) {
      // Record this session in local intervals
      setActiveChargingSessions((prev) => ({
        ...prev,
        [evseUid]: {
          sessionId: generatedSessId,
          evseUid,
          locationId,
          kwh: 0.0,
          soc: 15, // initial SoC
          cost: 0.0,
          startTime: startTimeStr,
        },
      }));
      setNewSessionId("");
    } else {
      alert("Failed to start charging session.");
    }
  };

  // Stop charging & Send CDR Receipt
  const stopSimulatedCharging = async (evseUid: string) => {
    const session = activeChargingSessions[evseUid];
    if (!session) return;

    const stopTimeStr = new Date().toISOString();

    // 1. PUT Session to CPO receiver (State: COMPLETED)
    const finalSessionPayload = {
      id: session.sessionId,
      start_date_time: session.startTime,
      end_date_time: stopTimeStr,
      kwh: session.kwh,
      cdr_token: {
        uid: "token_abc123",
        type: "RFID",
        contract_id: "TW-EMSP-C1001",
      },
      auth_method: "AUTH_REQUEST",
      location_id: session.locationId,
      evse_uid: session.evseUid,
      connector_id: "1",
      status: "COMPLETED",
      total_cost: {
        excl_vat: Number((session.cost * 0.95).toFixed(2)),
        incl_vat: session.cost,
      },
      last_updated: stopTimeStr,
    };

    await sendRequest(
      `Complete Session [${session.sessionId}]`,
      `/simulator/simulate/sessions/TW/CPO/${session.sessionId}`,
      "POST",
      finalSessionPayload,
    );

    // 2. PATCH EVSE status back to AVAILABLE
    await handlePatchStatus(session.locationId, evseUid, "AVAILABLE");

    // 3. POST CDR Receipt to CPO receiver
    const cdrPayload = {
      id: `cdr_${session.sessionId.split("_")[1] || Math.floor(1000 + Math.random() * 9000)}`,
      ctr_code: "TW",
      party_id: "CPO",
      start_date_time: session.startTime,
      end_date_time: stopTimeStr,
      kwh: session.kwh,
      cdr_token: {
        uid: "token_abc123",
        type: "RFID",
        contract_id: "TW-EMSP-C1001",
      },
      auth_method: "AUTH_REQUEST",
      authorization_reference: session.sessionId,
      total_cost: {
        excl_vat: Number((session.cost * 0.95).toFixed(2)),
        incl_vat: session.cost,
      },
      total_energy: session.kwh,
      total_time: Math.floor(
        (new Date(stopTimeStr).getTime() -
          new Date(session.startTime).getTime()) /
          1000,
      ),
      last_updated: stopTimeStr,
    };

    await sendRequest(
      `Post CDR Receipt`,
      "/simulator/simulate/cdrs",
      "POST",
      cdrPayload,
    );

    // Remove from active intervals
    setActiveChargingSessions((prev) => {
      const next = { ...prev };
      delete next[evseUid];
      return next;
    });
  };

  // Find EVSE details
  const allEvses = locations.flatMap((loc) =>
    loc.evses.map((e) => ({
      ...e,
      locationId: loc.id,
      locationName: loc.name,
    })),
  );

  const selectedEvse = allEvses.find((e) => e.uid === selectedEvseUid);

  // Filtered logs
  const filteredLogs = logs.filter((log) => {
    if (filterMethod === "ALL") return true;
    return log.method === filterMethod;
  });

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand-section">
          <div
            className="brand-logo"
            style={{
              width: "auto",
              padding: "0 10px",
              fontSize: "13px",
              textTransform: "uppercase",
            }}
          >
            smart HUB
          </div>
          <span className="brand-name" style={{ textTransform: "uppercase" }}>
            Simulator
          </span>
        </div>

        <ul className="nav-links">
          <li>
            <a
              className={`nav-item ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("overview");
                setSidebarOpen(false);
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              系統架構 & 概觀
            </a>
          </li>
          <li>
            <a
              className={`nav-item ${activeTab === "stations" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("stations");
                setSidebarOpen(false);
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              充電樁模擬控制區 ({allEvses.length})
            </a>
          </li>
          <li>
            <a
              className={`nav-item ${activeTab === "transactions" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("transactions");
                setSidebarOpen(false);
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              漫遊交易紀錄 ({sessions.length})
            </a>
          </li>
        </ul>

        <div className="sidebar-footer">
          <p>Mock Hub Portal</p>
          <p style={{ marginTop: "4px" }}>
            Status: {isOnline ? "Online" : "Offline"}
          </p>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="main-content">
        <header className="top-bar">
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              className="menu-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="top-bar-title">
              {activeTab === "overview" && "OCPI 漫遊中心 & 拓撲架構"}
              {activeTab === "stations" && "CPO 模擬充電站控制面板"}
              {activeTab === "transactions" && "Prisma DB 交易日誌儲存區"}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div
              className={`server-status-badge ${!isOnline ? "offline" : ""}`}
            >
              <span className="status-dot"></span>
              {isOnline ? `Mock HUB (OCPI ${serverVersion})` : "Disconnected"}
            </div>
          </div>
        </header>

        <div className="workspace">
          {/* CPO -> HUB -> EMSP Flow Diagram */}
          <div className="flow-diagram-container">
            <label
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              OCPI Roaming Data Pipeline Flow
            </label>
            <div style={{ position: "relative" }}>
              <svg className="flow-diagram-svg" viewBox="0 0 500 70">
                {/* Connecting Lines */}
                <path
                  d="M 100 35 L 250 35"
                  className={`flow-path ${flowStep === "cpo" || flowStep === "hub" ? "active" : ""}`}
                />
                <path
                  d="M 250 35 L 400 35"
                  className={`flow-path ${flowStep === "hub" || flowStep === "emsp" ? "active" : ""}`}
                />

                {/* Animated Pulse Circles */}
                {flowStep === "cpo" && (
                  <circle cx="100" cy="35" r="5" className="pulse-circle">
                    <animate
                      attributeName="cx"
                      from="100"
                      to="250"
                      dur="0.6s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                {flowStep === "hub" && (
                  <circle cx="250" cy="35" r="5" className="pulse-circle">
                    <animate
                      attributeName="cx"
                      from="250"
                      to="400"
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Node CPO */}
                <rect
                  x="20"
                  y="10"
                  width="80"
                  height="50"
                  rx="8"
                  className={`flow-node ${flowStep === "cpo" ? "active" : ""}`}
                />
                <text x="60" y="32" className="flow-node-text">
                  CPO Simulator
                </text>
                <text x="60" y="48" className="flow-node-sub">
                  (充電樁端)
                </text>

                {/* Node HUB */}
                <rect
                  x="210"
                  y="10"
                  width="80"
                  height="50"
                  rx="8"
                  className={`flow-node ${flowStep === "hub" ? "active" : ""}`}
                />
                <text x="250" y="32" className="flow-node-text">
                  Mock HUB
                </text>
                <text x="250" y="48" className="flow-node-sub">
                  (漫遊中心)
                </text>

                {/* Node EMSP */}
                <rect
                  x="400"
                  y="10"
                  width="80"
                  height="50"
                  rx="8"
                  className={`flow-node ${flowStep === "emsp" ? "active" : ""}`}
                />
                <text x="440" y="32" className="flow-node-text">
                  EMSP Server
                </text>
                <text x="440" y="48" className="flow-node-sub">
                  (地端車主 App)
                </text>
              </svg>
            </div>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <>
              <div className="card status-grid">
                <div className="status-card">
                  <span className="label">HUB 本地連接埠</span>
                  <span
                    className="value"
                    style={{ fontSize: "16px", fontFamily: "monospace" }}
                  >
                    {targetCpoUrl}
                  </span>
                </div>
                <div className="status-card">
                  <span className="label">目前偵測到的 CPO 站點數</span>
                  <span className="value">{locations.length} 站</span>
                </div>
                <div className="status-card">
                  <span className="label">資料庫充電樁總數</span>
                  <span className="value">{allEvses.length} 支</span>
                </div>
                <div className="status-card">
                  <span className="label">歷史交易總數</span>
                  <span className="value">{sessions.length} 筆</span>
                </div>
              </div>

              <div className="card">
                <h3 className="card-title">漫遊中心系統原理說明</h3>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    lineHeight: "1.7",
                    marginBottom: "16px",
                  }}
                >
                  本模擬器模擬了符合 <strong>OCPI 2.2.1 協定規格</strong>{" "}
                  的電子漫遊交易流程。 運作機制如下：
                </p>
                <ul
                  style={{
                    color: "var(--text-secondary)",
                    paddingLeft: "20px",
                    lineHeight: "1.7",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginBottom: "16px",
                  }}
                >
                  <li>
                    <strong>充電樁狀態 (EVSE) ─► CPO</strong>
                    ：車主插槍或狀態改變時，充電樁產生狀態心跳與數據封包。
                  </li>
                  <li>
                    <strong>CPO ─► HUB</strong>：CPO 發送{" "}
                    <code>PUT/PATCH Locations/Sessions</code>{" "}
                    將最新充電狀態與度數推送至 Mock HUB 儲存於 PostgreSQL。
                  </li>
                  <li>
                    <strong>HUB ─► EMSP</strong>：Mock HUB
                    接收並解析，立即透過註冊的 Token C 將交易封包{" "}
                    <strong>Forward (轉發)</strong> 給對接的 EMSP 車友 App
                    做即時電量顯示。
                  </li>
                </ul>

                {locations.length === 0 && (
                  <div
                    style={{
                      background: "rgba(14,165,233,0.06)",
                      border: "1px dashed var(--accent-purple)",
                      borderRadius: "12px",
                      padding: "20px",
                      textAlign: "center",
                      marginTop: "20px",
                    }}
                  >
                    <p
                      style={{
                        color: "white",
                        fontWeight: 600,
                        marginBottom: "12px",
                      }}
                    >
                      目前 PostgreSQL 資料庫中無 CPO 站點資料
                    </p>
                    <button className="button" onClick={initializeMockStations}>
                      一鍵初始化 4 座模擬充電樁
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: STATIONS CONTROLLER */}
          {activeTab === "stations" && (
            <>
              {locations.length === 0 ? (
                <div
                  className="card"
                  style={{ textAlign: "center", padding: "40px 20px" }}
                >
                  <h3
                    className="card-title"
                    style={{ justifyContent: "center" }}
                  >
                    無任何站點資料
                  </h3>
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      marginBottom: "20px",
                    }}
                  >
                    資料庫尚無 Locations。請至系統概觀頁面一鍵部署或傳送
                    Location 封包進行初始化。
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
                        const displayStatus = localSim
                          ? "CHARGING"
                          : evse.status;

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
                                  {evse.rawJson?.connectors?.[0]?.power_type ||
                                    "AC"}
                                </span>
                              </div>
                              <div className="evse-telemetry-row">
                                <span>功率:</span>
                                <span>
                                  {evse.rawJson?.connectors?.[0]
                                    ?.max_electric_power
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
                        充電樁控制中心 [
                        {selectedEvse.evse_id || selectedEvse.uid}]
                      </h3>
                      <p
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "13px",
                          marginBottom: "16px",
                        }}
                      >
                        所屬站點：Location {selectedEvse.locationId} (
                        {selectedEvse.locationName})
                      </p>

                      <div className="evse-quick-panel">
                        {/* Status update */}
                        <div className="form-group">
                          <label>模擬更變狀態 (PATCH Status)</label>
                          <div className="evse-control-actions">
                            <select
                              value={customEvseStatus}
                              onChange={(e) =>
                                setCustomEvseStatus(e.target.value)
                              }
                              style={{ width: "180px" }}
                            >
                              <option value="AVAILABLE">
                                AVAILABLE (空閒)
                              </option>
                              <option value="CHARGING">
                                CHARGING (充電中)
                              </option>
                              <option value="RESERVED">RESERVED (預約)</option>
                              <option value="BLOCKED">BLOCKED (佔用中)</option>
                              <option value="OUTOFORDER">
                                OUTOFORDER (故障)
                              </option>
                              <option value="INOPERATIVE">
                                INOPERATIVE (停用)
                              </option>
                              <option value="PLANNED">PLANNED (規劃中)</option>
                              <option value="UNKNOWN">UNKNOWN (未知)</option>
                            </select>
                            <button
                              className="button button-secondary"
                              onClick={() =>
                                handlePatchStatus(
                                  selectedEvse.locationId,
                                  selectedEvse.uid,
                                  customEvseStatus,
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
                          <label>
                            交易生命週期模擬 (Transaction Lifecycle)
                          </label>

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
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    已充入電量
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "18px",
                                      fontWeight: "bold",
                                      color: "white",
                                    }}
                                  >
                                    {
                                      activeChargingSessions[selectedEvse.uid]
                                        .kwh
                                    }{" "}
                                    kWh
                                  </span>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    電池 SoC
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "18px",
                                      fontWeight: "bold",
                                      color: "white",
                                    }}
                                  >
                                    {
                                      activeChargingSessions[selectedEvse.uid]
                                        .soc
                                    }{" "}
                                    %
                                  </span>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      color: "var(--text-muted)",
                                    }}
                                  >
                                    累計金額
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "18px",
                                      fontWeight: "bold",
                                      color: "white",
                                    }}
                                  >
                                    {
                                      activeChargingSessions[selectedEvse.uid]
                                        .cost
                                    }{" "}
                                    TWD
                                  </span>
                                </div>
                              </div>
                              <button
                                className="button"
                                style={{ background: "var(--accent-red)" }}
                                onClick={() =>
                                  stopSimulatedCharging(selectedEvse.uid)
                                }
                              >
                                停止充電並發送帳單 (Stop & Send CDR)
                              </button>
                            </div>
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "12px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  gap: "10px",
                                  alignItems: "center",
                                }}
                              >
                                <input
                                  type="text"
                                  placeholder="自訂 Session ID (留空將自動隨機產生)"
                                  value={newSessionId}
                                  onChange={(e) =>
                                    setNewSessionId(e.target.value)
                                  }
                                  style={{ flexGrow: 1 }}
                                />
                                <button
                                  className="button"
                                  onClick={() =>
                                    startSimulatedCharging(
                                      selectedEvse.locationId,
                                      selectedEvse.uid,
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
                </>
              )}
            </>
          )}

          {/* TAB 3: TRANSACTION ARCHIVES */}
          {activeTab === "transactions" && (
            <>
              {/* Active Sessions */}
              <div className="card">
                <h3 className="card-title">Prisma DB 中的 Sessions 歷史紀錄</h3>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "14px",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        <th style={{ padding: "12px" }}>Session ID</th>
                        <th style={{ padding: "12px" }}>充電樁 UID</th>
                        <th style={{ padding: "12px" }}>度數 (kWh)</th>
                        <th style={{ padding: "12px" }}>目前狀態</th>
                        <th style={{ padding: "12px" }}>最後更新時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            style={{
                              padding: "24px",
                              textAlign: "center",
                              color: "var(--text-muted)",
                            }}
                          >
                            資料庫中無交易 Session
                          </td>
                        </tr>
                      ) : (
                        sessions.map((sess) => (
                          <tr
                            key={sess.id}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.05)",
                            }}
                          >
                            <td
                              style={{
                                padding: "12px",
                                fontFamily: "monospace",
                              }}
                            >
                              {sess.id}
                            </td>
                            <td
                              style={{
                                padding: "12px",
                                fontFamily: "monospace",
                              }}
                            >
                              {sess.evseUid}
                            </td>
                            <td style={{ padding: "12px" }}>{sess.kwh}</td>
                            <td style={{ padding: "12px" }}>
                              <span
                                className={`evse-badge ${sess.status.toLowerCase()}`}
                                style={{ fontSize: "10px" }}
                              >
                                {sess.status}
                              </span>
                            </td>
                            <td
                              style={{
                                padding: "12px",
                                color: "var(--text-muted)",
                              }}
                            >
                              {new Date(sess.updatedAt).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CDR receipts */}
              <div className="card">
                <h3 className="card-title">Prisma DB 中的 CDR 帳單紀錄</h3>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "14px",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        <th style={{ padding: "12px" }}>CDR ID</th>
                        <th style={{ padding: "12px" }}>度數 (kWh)</th>
                        <th style={{ padding: "12px" }}>計費金額 (TWD)</th>
                        <th style={{ padding: "12px" }}>充電時間 (秒)</th>
                        <th style={{ padding: "12px" }}>記錄時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cdrs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            style={{
                              padding: "24px",
                              textAlign: "center",
                              color: "var(--text-muted)",
                            }}
                          >
                            資料庫中無結帳 CDR
                          </td>
                        </tr>
                      ) : (
                        cdrs.map((cdr) => {
                          const raw = cdr.rawJson || {};
                          const totalCost = raw.total_cost?.incl_vat || 0;
                          const totalTime = raw.total_time || 0;
                          return (
                            <tr
                              key={cdr.id}
                              style={{
                                borderBottom:
                                  "1px solid rgba(255,255,255,0.05)",
                              }}
                            >
                              <td
                                style={{
                                  padding: "12px",
                                  fontFamily: "monospace",
                                }}
                              >
                                {cdr.id}
                              </td>
                              <td style={{ padding: "12px" }}>
                                {raw.total_energy || 0} kWh
                              </td>
                              <td
                                style={{
                                  padding: "12px",
                                  color: "var(--accent-yellow)",
                                  fontWeight: 600,
                                }}
                              >
                                NT$ {totalCost}
                              </td>
                              <td style={{ padding: "12px" }}>
                                {totalTime} 秒
                              </td>
                              <td
                                style={{
                                  padding: "12px",
                                  color: "var(--text-muted)",
                                }}
                              >
                                {new Date(cdr.createdAt).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* macOS Terminal Logs Console */}
      <section className={`mac-terminal ${terminalExpanded ? "expanded" : ""}`}>
        <header
          className="mac-titlebar"
          onClick={() => setTerminalExpanded(!terminalExpanded)}
        >
          <div className="mac-buttons" onClick={(e) => e.stopPropagation()}>
            <div
              className="mac-btn close"
              onClick={() => setLogs([])}
              title="Clear terminal"
            ></div>
            <div
              className="mac-btn minimize"
              onClick={() => setTerminalExpanded(false)}
              title="Minimize terminal"
            ></div>
            <div
              className="mac-btn maximize"
              onClick={() => setTerminalExpanded(!terminalExpanded)}
              title="Maximize terminal"
            ></div>
          </div>
          <span className="mac-title">
            guest@mock-hub: ~ -zsh ── {logs.length} logs
          </span>
        </header>

        <div className="mac-term-body" ref={terminalBodyRef}>
          <div className="terminal-welcome">
            <p>Last login: {new Date().toDateString()} on ttys001</p>
            <p>
              Welcome to OCPI Mock Hub activity monitor. Output streams from
              local port 3030.
            </p>
            <p style={{ marginTop: "4px" }}>
              Type `/help` to see additional simulator control logs.
            </p>
          </div>

          {filteredLogs.length === 0 ? (
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "12px",
                padding: "10px 0",
              }}
            >
              <span className="terminal-prompt">$ </span>tail -f
              /var/log/ocpi-roaming.log
              <p style={{ marginTop: "12px", fontStyle: "italic" }}>
                Listening for API activity... Trigger a simulation request to
                start stream logs.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className={`log-entry-mac ${log.success ? "success" : "error"}`}
              >
                <div className="log-entry-header">
                  <span>
                    [{log.time}] {log.action}
                  </span>
                  <span
                    style={{
                      color: log.success
                        ? "var(--accent-green)"
                        : "var(--accent-red)",
                    }}
                  >
                    {log.success ? "HTTP/1.1 200 OK" : "HTTP/1.1 ERROR"}
                  </span>
                </div>

                <div style={{ fontSize: "13px" }}>
                  <span className={`method-tag ${log.method.toLowerCase()}`}>
                    {log.method}
                  </span>
                  <span className="log-url">
                    {log.url.replace("http://localhost:3030", "")}
                  </span>
                </div>

                {!!log.payload && (
                  <details className="log-details">
                    <summary>Request Payload</summary>
                    <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                  </details>
                )}

                {!!log.response && (
                  <details className="log-details" open>
                    <summary>Response Body</summary>
                    <pre>{JSON.stringify(log.response, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>

        <div className="term-controls">
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              過濾類型:
            </label>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              style={{
                padding: "4px 8px",
                fontSize: "12px",
                background: "rgba(0,0,0,0.5)",
                height: "28px",
              }}
            >
              <option value="ALL">ALL (全部)</option>
              <option value="PUT">PUT</option>
              <option value="POST">POST</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>
          <button
            className="button button-secondary"
            style={{ padding: "4px 10px", fontSize: "12px", height: "28px" }}
            onClick={() => setLogs([])}
          >
            清除日誌 (Clear)
          </button>
        </div>
      </section>
    </div>
  );
}
