/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type {
  Location,
  DbSession,
  DbCdr,
  LogEntry,
  ActiveSessionState,
  SessionTemplate,
  CdrTemplate,
  AutoChargeMapping,
  EmspChannel,
  OcpiSession,
  OcpiCdr,
  OcpiTotalCost,
  CpoTenant,
} from "../types/simulator";

interface SimulatorContextType {
  activeTab:
    | "dashboard"
    | "cpo-sim"
    | "hub-router"
    | "autocharge"
    | "ocpi-payload";
  setActiveTab: (
    tab: "dashboard" | "cpo-sim" | "hub-router" | "autocharge" | "ocpi-payload",
  ) => void;
  isOnline: boolean;
  serverVersion: string;
  logs: LogEntry[];
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  targetCpoUrl: string;
  locations: Location[];
  sessions: DbSession[];
  cdrs: DbCdr[];
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  terminalExpanded: boolean;
  setTerminalExpanded: (expanded: boolean) => void;
  filterMethod: string;
  setFilterMethod: (method: string) => void;
  flowStep: "idle" | "cpo" | "hub" | "emsp";
  setFlowStep: (step: "idle" | "cpo" | "hub" | "emsp") => void;
  selectedLocationId: string;
  setSelectedLocationId: (id: string) => void;
  selectedEvseUid: string | null;
  setSelectedEvseUid: (uid: string | null) => void;
  customEvseStatus: string;
  setCustomEvseStatus: (status: string) => void;
  newSessionId: string;
  setNewSessionId: (id: string) => void;
  activeChargingSessions: { [evseUid: string]: ActiveSessionState };
  sessionTemplate: SessionTemplate;
  setSessionTemplate: (template: SessionTemplate) => void;
  cdrTemplate: CdrTemplate;
  setCdrTemplate: (template: CdrTemplate) => void;

  // Phase 2 state variables
  emsps: EmspChannel[];
  setEmsps: React.Dispatch<React.SetStateAction<EmspChannel[]>>;
  cpos: CpoTenant[];
  setCpos: React.Dispatch<React.SetStateAction<CpoTenant[]>>;
  autoCharges: AutoChargeMapping[];
  setAutoCharges: React.Dispatch<React.SetStateAction<AutoChargeMapping[]>>;
  sessionPayloadEdit: OcpiSession | null;
  setSessionPayloadEdit: React.Dispatch<
    React.SetStateAction<OcpiSession | null>
  >;
  cdrPayloadEdit: OcpiCdr | null;
  setCdrPayloadEdit: React.Dispatch<React.SetStateAction<OcpiCdr | null>>;

  newMac: string;
  setNewMac: (val: string) => void;
  newModel: string;
  setNewModel: (val: string) => void;
  newToken: string;
  setNewToken: (val: string) => void;
  newEmsp: string;
  setNewEmsp: (val: string) => void;

  fetchDatabaseState: () => Promise<void>;
  fetchEmspStatus: () => Promise<void>;
  addLog: (
    module: "SYSTEM" | "HUB" | "eMSP" | "CPO_SIM",
    action: string,
    detail: string,
    type?: "success" | "warning" | "error" | "info",
    payload?: unknown,
    response?: unknown,
  ) => void;
  triggerFlowAnimation: (hasForwarding?: boolean) => void;
  sendRequest: (
    action: string,
    endpoint: string,
    method: "POST" | "PUT" | "PATCH",
    bodyObj?: unknown,
    hasForwarding?: boolean,
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  handleSyncLocation: () => Promise<void>;
  handleSyncTariff: (energyPrice?: number) => Promise<void>;
  handleSyncCustomLocation: (
    countryCode: string,
    partyId: string,
    locationId: string,
    payload: unknown,
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  handleSyncCustomTariff: (
    countryCode: string,
    partyId: string,
    tariffId: string,
    payload: unknown,
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  handleAddCpo: (
    countryCode: string,
    partyId: string,
    name: string,
    tokenB: string,
  ) => Promise<{ success: boolean; error?: string }>;
  handleAddEmsp: (
    countryCode: string,
    partyId: string,
    name: string,
    url: string,
    tokenC: string,
  ) => Promise<{ success: boolean; error?: string }>;
  handleSyncAllLocations: () => Promise<{ success: boolean; count: number }>;
  initializeMockStations: () => Promise<void>;
  handlePatchStatus: (
    locationId: string,
    evseUid: string,
    nextStatus: string,
  ) => Promise<void>;
  startSimulatedCharging: (
    locationId: string,
    evseUid: string,
    isAutoCharge?: boolean,
    customMac?: string | null,
    customSessId?: string,
  ) => Promise<void>;
  stopSimulatedCharging: (evseUid: string) => Promise<void>;
  updateSessionTelemetryAndSend: (
    evseUid: string,
    fields: Partial<ActiveSessionState>,
  ) => Promise<void>;
  updateSessionTelemetryOnly: (
    evseUid: string,
    fields: Partial<ActiveSessionState>,
  ) => void;
  tariffPrice: number;
  transmitCdr: (cdrId: string) => Promise<void>;
  triggerManualSessionSend: () => Promise<void>;
  triggerManualCdrSend: () => Promise<void>;
  handleAddAutoCharge: (e: React.FormEvent) => void;
  terminalBodyRef: React.RefObject<HTMLDivElement | null>;
}

const INITIAL_AUTOCHARGE_MAPPINGS: AutoChargeMapping[] = [
  {
    mac: "00:1A:2B:3C:4D:5E",
    vehicleModel: "Model Y LR",
    tokenUid: "TW-EVO-889900",
    emspId: "EMSP-B",
    active: true,
  },
  {
    mac: "AA:BB:CC:DD:EE:FF",
    vehicleModel: "Model 3 Highland",
    tokenUid: "TW-EVA-112233",
    emspId: "EMSP-A",
    active: true,
  },
];

const SimulatorContext = createContext<SimulatorContextType | undefined>(
  undefined,
);

function generateRandomCdrId() {
  return `CDR-${Math.floor(100000 + Math.random() * 900000)}`;
}

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "cpo-sim" | "hub-router" | "autocharge" | "ocpi-payload"
  >("dashboard");
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [serverVersion, setServerVersion] = useState<string>("Unknown");
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "init-sys",
      time: new Date().toLocaleTimeString(),
      module: "SYSTEM",
      action: "INIT",
      detail: "OCPI HUB 數據中繼平台載入完成",
      type: "success",
    },
    {
      id: "init-hub",
      time: new Date().toLocaleTimeString(),
      module: "HUB",
      action: "ROUTING_ENGINE",
      detail: "路由策略已就緒: 基於 Country Code & Party ID 自動分發",
      type: "info",
    },
    {
      id: "init-cpo",
      time: new Date().toLocaleTimeString(),
      module: "CPO_SIM",
      action: "READY",
      detail: "已偵測到模擬充電樁及場站配置",
      type: "success",
    },
  ]);
  const [targetCpoUrl] = useState<string>("http://localhost:3030");

  // Database states
  const [locations, setLocations] = useState<Location[]>([]);
  const [sessions, setSessions] = useState<DbSession[]>([]);
  const [cdrs, setCdrs] = useState<DbCdr[]>([]);

  // UI layout states
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [terminalExpanded, setTerminalExpanded] = useState<boolean>(false);
  const [filterMethod, setFilterMethod] = useState<string>("ALL");

  // Flow animation
  const [flowStep, setFlowStep] = useState<"idle" | "cpo" | "hub" | "emsp">(
    "idle",
  );

  // Selection & Input states
  const [selectedLocationId, setSelectedLocationId] =
    useState<string>("loc_001");
  const [selectedEvseUid, setSelectedEvseUid] = useState<string | null>(null);
  const [customEvseStatus, setCustomEvseStatus] = useState<string>("AVAILABLE");
  const [newSessionId, setNewSessionId] = useState<string>("");

  // Phase 2 states
  const [emsps, setEmsps] = useState<EmspChannel[]>([]);
  const [cpos, setCpos] = useState<CpoTenant[]>([]);
  const [autoCharges, setAutoCharges] = useState<AutoChargeMapping[]>(
    INITIAL_AUTOCHARGE_MAPPINGS,
  );
  const [sessionPayloadEdit, setSessionPayloadEdit] =
    useState<OcpiSession | null>(null);
  const [cdrPayloadEdit, setCdrPayloadEdit] = useState<OcpiCdr | null>(null);

  // AutoCharge register input fields
  const [newMac, setNewMac] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newToken, setNewToken] = useState("");
  const [newEmsp, setNewEmsp] = useState("");

  // OCPI Templates
  const [sessionTemplate, setSessionTemplate] = useState<SessionTemplate>({
    cdr_token: {
      uid: "token_abc123",
      type: "RFID",
      contract_id: "TW-EMSP-C1001",
    },
    auth_method: "AUTH_REQUEST",
    connector_id: "1",
  });

  const [cdrTemplate, setCdrTemplate] = useState<CdrTemplate>({
    ctr_code: "TW",
    party_id: "CPO",
    auth_method: "AUTH_REQUEST",
    cdr_token: {
      uid: "token_abc123",
      type: "RFID",
      contract_id: "TW-EMSP-C1001",
    },
  });

  // Client-side local active charging sessions simulation tracker
  const [activeChargingSessions, setActiveChargingSessions] = useState<{
    [evseUid: string]: ActiveSessionState;
  }>({});

  const [tariffPrice, setTariffPrice] = useState<number>(9.5);

  const terminalBodyRef = useRef<HTMLDivElement | null>(null);

  // Refs for callbacks to read fresh state without reconnecting
  const activeSessionsRef = useRef(activeChargingSessions);
  const sessionTemplateRef = useRef(sessionTemplate);
  const cdrTemplateRef = useRef(cdrTemplate);
  const newSessionIdRef = useRef(newSessionId);
  const locationsRef = useRef(locations);
  const emspsRef = useRef(emsps);

  useEffect(() => {
    activeSessionsRef.current = activeChargingSessions;
  }, [activeChargingSessions]);
  useEffect(() => {
    sessionTemplateRef.current = sessionTemplate;
  }, [sessionTemplate]);
  useEffect(() => {
    cdrTemplateRef.current = cdrTemplate;
  }, [cdrTemplate]);
  useEffect(() => {
    newSessionIdRef.current = newSessionId;
  }, [newSessionId]);
  useEffect(() => {
    locationsRef.current = locations;
  }, [locations]);
  useEffect(() => {
    emspsRef.current = emsps;
  }, [emsps]);

  const getLocCpoInfo = (locId: string) => {
    const loc = locationsRef.current.find((l) => l.id === locId);
    if (loc && loc.party) {
      return {
        countryCode: loc.party.countryCode.toUpperCase(),
        partyId: loc.party.partyId.toUpperCase(),
      };
    }
    return { countryCode: "TW", partyId: "CPO" };
  };

  // Log activity appender matching CPO/HUB/eMSP console style
  const addLog = (
    module: "SYSTEM" | "HUB" | "eMSP" | "CPO_SIM",
    action: string,
    detail: string,
    type: "success" | "warning" | "error" | "info" = "info",
    payload?: unknown,
    response?: unknown,
  ) => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString(),
      module,
      action,
      detail,
      type,
      payload,
      response,
    };
    setLogs((prev) => [...prev, newEntry]);
  };

  // Fetch all databases (locations, sessions, CDRs, CPOs) from simulator backend
  const fetchDatabaseState = async () => {
    try {
      const [locRes, sessRes, cdrRes, cpoRes] = await Promise.all([
        fetch("/simulator/locations"),
        fetch("/simulator/sessions"),
        fetch("/simulator/cdrs"),
        fetch("/simulator/cpos"),
      ]);

      if (locRes.ok) {
        const locData = await locRes.json();
        setLocations(locData);
        if (locData.length > 0 && !selectedLocationId) {
          setSelectedLocationId(locData[0].id);
        }
      }
      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setSessions(sessData);
      }
      if (cdrRes.ok) {
        const cdrData = await cdrRes.json();
        setCdrs(cdrData);
      }
      if (cpoRes.ok) {
        const cpoData = await cpoRes.json();
        setCpos(cpoData);
      }
    } catch (err) {
      console.error("Failed to query database state:", err);
    }
  };
  // Check EMSP connectivity health and latency
  const fetchEmspStatus = async () => {
    try {
      const res = await fetch("/simulator/emsps/status");
      if (res.ok) {
        const emspData = (await res.json()) as Array<{
          id: string;
          partyId: string;
          countryCode: string;
          name: string;
          url: string;
          online: boolean;
          latency: number;
        }>;
        setEmsps((prev) => {
          return emspData.map((backendEmsp) => {
            const existing = prev.find(
              (e) =>
                e.partyId === backendEmsp.partyId &&
                e.countryCode === backendEmsp.countryCode,
            );
            return {
              id: backendEmsp.id,
              name:
                backendEmsp.name ||
                `${backendEmsp.countryCode}-${backendEmsp.partyId}`,
              partyId: backendEmsp.partyId,
              countryCode: backendEmsp.countryCode,
              url: backendEmsp.url,
              online: backendEmsp.online,
              latency: backendEmsp.latency,
              active: existing ? existing.active : true,
            };
          });
        });

        if (emspData.length > 0) {
          setNewEmsp((current) => {
            const hasMatch = emspData.some((e) => e.id === current);
            return hasMatch ? current : emspData[0].id;
          });
        }
      }
    } catch (err) {
      console.error("Failed to query EMSP status:", err);
    }
  }; // Check connection status & retrieve version details
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
      await fetchEmspStatus();
    };
    init();

    const statusTimer = setInterval(checkStatus, 15000);
    const dbTimer = setInterval(fetchDatabaseState, 15000);
    const emspTimer = setInterval(fetchEmspStatus, 30000);

    return () => {
      active = false;
      clearInterval(statusTimer);
      clearInterval(dbTimer);
      clearInterval(emspTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom of terminal when logs update
  useEffect(() => {
    if (terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs]);

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

      // Log into terminal
      const mod = endpoint.includes("/commands/") ? "eMSP" : "HUB";
      addLog(
        mod,
        action,
        `HTTP ${method} -> ${endpoint.replace("http://localhost:3030", "")}`,
        res.ok ? "success" : "error",
        bodyObj,
        resData,
      );

      // Refresh DB state
      await fetchDatabaseState();

      return { success: res.ok, data: resData };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addLog(
        "SYSTEM",
        action,
        `Failed request: ${errorMessage}`,
        "error",
        bodyObj,
        { error: errorMessage },
      );
      return { success: false, error: errorMessage };
    }
  };

  // Synchronize Location to HUB and EMSP
  const handleSyncLocation = async () => {
    const defaultPayload = {
      id: "loc_001",
      name: "台北內湖特斯拉旗艦站",
      operator: {
        name: "Tesla Flagship Station CPO",
      },
      address: "台北市內湖區舊宗路一段",
      city: "Taipei",
      postal_code: "114",
      country: "TWN",
      coordinates: { latitude: "25.0612", longitude: "121.5791" },
      parking_type: "ON_STREET",
      opening_times: "24/7",
      charging_when_closed: true,
      evses: [
        {
          uid: "TW-CPO-EVSE-001",
          evse_id: "TW*CPO*E001",
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
        {
          uid: "TW-CPO-EVSE-002",
          evse_id: "TW*CPO*E002",
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
              max_amperage: 400,
              max_electric_power: 250000,
            },
          ],
        },
      ],
    };

    let payload: unknown = defaultPayload;
    if (locations.length > 0 && locations[0].rawJson) {
      payload = {
        ...(locations[0].rawJson as Record<string, unknown>),
        name: "台北內湖特斯拉旗艦站",
      };
    }

    addLog(
      "CPO_SIM",
      "SYNC_LOCATION",
      "發送 CPO 場站資訊至 HUB OCPI 接口",
      "info",
      payload,
    );

    await sendRequest(
      "Sync Location -> loc_001",
      "/simulator/simulate/locations/TW/CPO/loc_001",
      "POST",
      payload,
    );
  };

  // Synchronize Tariff to HUB and EMSP
  const handleSyncTariff = async (energyPrice = 9.5) => {
    setTariffPrice(energyPrice);
    const tariffPayload = {
      id: "TAR-REGULAR",
      currency: "TWD",
      elements: [
        {
          price_components: [
            {
              type: "ENERGY",
              price: energyPrice,
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
    };

    addLog(
      "CPO_SIM",
      "SYNC_TARIFF",
      `調整並同步費率 (單價: ${energyPrice} TWD/kWh)`,
      "info",
      tariffPayload,
    );

    const { countryCode, partyId } = getLocCpoInfo(selectedLocationId);
    await sendRequest(
      "Sync Tariff -> TAR-REGULAR",
      `/simulator/simulate/tariffs/${countryCode}/${partyId}/TAR-REGULAR`,
      "POST",
      tariffPayload,
    );
  };

  const initializeMockStations = async () => {
    await handleSyncLocation();
    await handleSyncTariff();
  };

  const handleSyncCustomLocation = async (
    countryCode: string,
    partyId: string,
    locationId: string,
    payload: unknown,
  ) => {
    addLog(
      "CPO_SIM",
      "SYNC_LOCATION",
      `同步自訂場站資訊 ${locationId} 至 HUB OCPI 接口`,
      "info",
      payload,
    );
    const res = await sendRequest(
      `Sync Location -> ${locationId}`,
      `/simulator/simulate/locations/${countryCode}/${partyId}/${locationId}`,
      "POST",
      payload,
    );
    return res;
  };

  const handleSyncCustomTariff = async (
    countryCode: string,
    partyId: string,
    tariffId: string,
    payload: unknown,
  ) => {
    addLog(
      "CPO_SIM",
      "SYNC_TARIFF",
      `同步自訂費率 ${tariffId} 至 HUB OCPI 接口`,
      "info",
      payload,
    );
    const res = await sendRequest(
      `Sync Tariff -> ${tariffId}`,
      `/simulator/simulate/tariffs/${countryCode}/${partyId}/${tariffId}`,
      "POST",
      payload,
    );
    return res;
  };

  const handleAddCpo = async (
    countryCode: string,
    partyId: string,
    name: string,
    tokenB: string,
  ) => {
    addLog(
      "SYSTEM",
      "REGISTER_CPO",
      `在 HUB 註冊新 CPO: [${countryCode}-${partyId}] ${name}`,
      "info",
      { countryCode, partyId, name, tokenB },
    );
    const res = await sendRequest(
      `Register CPO -> ${partyId}`,
      "/simulator/cpos",
      "POST",
      { countryCode, partyId, name, tokenB },
      false,
    );
    return { success: res.success, error: res.error };
  };

  const handleAddEmsp = async (
    countryCode: string,
    partyId: string,
    name: string,
    url: string,
    tokenC: string,
  ) => {
    addLog(
      "SYSTEM",
      "REGISTER_EMSP",
      `在 HUB 註冊新 EMSP: [${countryCode}-${partyId}] ${name}`,
      "info",
      { countryCode, partyId, name, url, tokenC },
    );
    const res = await sendRequest(
      `Register EMSP -> ${partyId}`,
      "/simulator/emsps",
      "POST",
      { countryCode, partyId, name, url, tokenC },
      false,
    );
    if (res.success) {
      await fetchEmspStatus();
    }
    return { success: res.success, error: res.error };
  };

  const handleSyncAllLocations = async () => {
    addLog(
      "SYSTEM",
      "SYNC_ALL_LOCATIONS",
      "手動補發資料庫中所有場站資訊至已啟用之 EMSP 接收端",
      "info",
    );
    const res = await sendRequest(
      "Sync All Locations",
      "/simulator/locations/sync-all",
      "POST",
      undefined,
      true,
    );
    const dataObj = res.data as { count?: number } | undefined;
    return { success: res.success, count: dataObj?.count || 0 };
  };

  const handlePatchStatus = async (
    locationId: string,
    evseUid: string,
    nextStatus: string,
  ) => {
    const payload = {
      status: nextStatus,
      last_updated: new Date().toISOString(),
    };
    const { countryCode, partyId } = getLocCpoInfo(locationId);
    await sendRequest(
      `Patch Status -> ${nextStatus}`,
      `/simulator/simulate/locations/${countryCode}/${partyId}/${locationId}/${evseUid}`,
      "POST",
      payload,
    );
  };

  // Start Simulated Charging session (RFID swipe or AutoCharge lookup)
  const startSimulatedCharging = async (
    locationId: string,
    evseUid: string,
    isAutoCharge = false,
    customMac: string | null = null,
    customSessId?: string,
  ) => {
    // Check if EVSE is already charging
    const activeUids = Object.keys(activeSessionsRef.current);
    if (activeUids.includes(evseUid)) {
      addLog(
        "CPO_SIM",
        "START_ERROR",
        `充電樁 ${evseUid} 正在充電中，無法重複啟動`,
        "warning",
      );
      return;
    }

    let tokenUid = "MANUAL-TOKEN-CPO";
    let emspId = "EMSP-A";
    let authMethod = "RFID_SWIPE";

    if (isAutoCharge && customMac) {
      const mapping = autoCharges.find((m) => m.mac === customMac);
      if (mapping) {
        tokenUid = mapping.tokenUid;
        emspId = mapping.emspId;
        authMethod = "AUTO_CHARGE";
        addLog(
          "CPO_SIM",
          "AUTOCHARGE_DETECTED",
          `偵測車輛 MAC: ${customMac}，自動映射 OCPI Token: ${tokenUid}`,
          "success",
        );
      } else {
        addLog(
          "CPO_SIM",
          "AUTOCHARGE_FAILED",
          `無法識別的車輛 MAC: ${customMac}，拒絕免刷卡授權`,
          "warning",
        );
        return;
      }
    }

    const matchedEmsp = emspsRef.current.find((e) => e.id === emspId);

    // 1. Authorize lookup simulation
    addLog(
      "HUB",
      "AUTHORIZE_REQUEST",
      `收到 CPO 請求授權 Token [${tokenUid}] - 方式: ${authMethod}`,
      "info",
    );

    if (matchedEmsp && matchedEmsp.active) {
      addLog(
        "HUB",
        "ROUTING_AUTH",
        `HUB 自動識別對應 eMSP [${matchedEmsp.name}]，轉發中...`,
        "info",
      );
      addLog(
        "eMSP",
        "AUTH_APPROVED",
        `eMSP [${matchedEmsp.name}] 成功授權合約! Token: ${tokenUid}`,
        "success",
      );
    } else {
      addLog(
        "HUB",
        "ROUTING_AUTH_ERROR",
        `路由失敗: 未能找到可用或啟用的 eMSP 處理此 Token: ${tokenUid}`,
        "error",
      );
      return;
    }

    const generatedSessId =
      customSessId ||
      newSessionIdRef.current.trim() ||
      `SES-${Math.floor(100000 + Math.random() * 900000)}`;

    const startTimeStr = new Date().toISOString();

    // 1. PATCH EVSE status to CHARGING
    await handlePatchStatus(locationId, evseUid, "CHARGING");

    // 2. Put Session to CPO receiver (State: ACTIVE)
    const initialSessionPayload = {
      id: generatedSessId,
      start_date_time: startTimeStr,
      kwh: 0.0,
      location_id: locationId,
      evse_uid: evseUid,
      status: "ACTIVE",
      total_cost: { excl_vat: 0.0, incl_vat: 0.0 },
      auth_token_uid: tokenUid,
      emsp_id: emspId,
      auth_method: authMethod,
      last_updated: startTimeStr,
      ...sessionTemplateRef.current, // Merge template variables
    };

    const { countryCode, partyId } = getLocCpoInfo(locationId);
    const res = await sendRequest(
      `Start Session [${generatedSessId}]`,
      `/simulator/simulate/sessions/${countryCode}/${partyId}/${generatedSessId}`,
      "POST",
      initialSessionPayload,
    );

    if (res.success) {
      let initialKw = 120.0;
      const matchedEvse = locationsRef.current
        .flatMap((l) => l.evses)
        .find((e) => e.uid === evseUid);
      if (matchedEvse) {
        const connectors = matchedEvse.connectors || matchedEvse.rawJson?.connectors;
        if (connectors?.[0]?.max_electric_power) {
          initialKw = connectors[0].max_electric_power / 1000;
        }
      }
      const initialVoltage = 400.0;
      const initialCurrent = Math.round(((initialKw * 1000) / initialVoltage) * 10) / 10;

      const activeObj: ActiveSessionState = {
        sessionId: generatedSessId,
        evseUid,
        locationId,
        kwh: 0.0,
        soc: 15.0,
        cost: 0.0,
        startTime: startTimeStr,
        kw: initialKw,
        voltage: initialVoltage,
        current: initialCurrent,
        status: "ACTIVE",
        isAuto: true,
      };

      setActiveChargingSessions((prev) => ({
        ...prev,
        [evseUid]: activeObj,
      }));
      setSessionPayloadEdit(initialSessionPayload);
      setNewSessionId("");
      addLog(
        "CPO_SIM",
        "SESSION_STARTED",
        `啟動充電成功! Session ID: ${generatedSessId}，開始發送 telemetry`,
        "success",
      );
    } else {
      addLog(
        "CPO_SIM",
        "START_ERROR",
        "無法寫入 Session 到 CPO 收取端",
        "error",
      );
    }
  };

  // Update session telemetry only (local state update without sending)
  const updateSessionTelemetryOnly = (
    evseUid: string,
    fields: Partial<ActiveSessionState>,
  ) => {
    setActiveChargingSessions((prev) => {
      if (!prev[evseUid]) return prev;
      return {
        ...prev,
        [evseUid]: {
          ...prev[evseUid],
          ...fields,
        },
      };
    });
  };

  // Update session telemetry and send PUT request to HUB
  const updateSessionTelemetryAndSend = async (
    evseUid: string,
    fields: Partial<ActiveSessionState>,
  ) => {
    const session = activeSessionsRef.current[evseUid];
    if (!session) return;

    const mergedSession = {
      ...session,
      ...fields,
    };

    const price = tariffPrice;
    const computedCost = Math.round((20.0 + (mergedSession.kwh || 0.0) * price) * 10) / 10;
    mergedSession.cost = computedCost;

    setActiveChargingSessions((prev) => {
      if (!prev[evseUid]) return prev;
      return {
        ...prev,
        [evseUid]: mergedSession,
      };
    });

    const sessionPayload = {
      id: mergedSession.sessionId,
      start_date_time: mergedSession.startTime,
      kwh: mergedSession.kwh,
      location_id: mergedSession.locationId,
      evse_uid: mergedSession.evseUid,
      status: mergedSession.status || "ACTIVE",
      total_cost: {
        excl_vat: Number((computedCost * 0.95).toFixed(2)),
        incl_vat: computedCost,
      },
      charging_periods: [
        {
          start_date_time: mergedSession.startTime,
          dimensions: [
            { type: "STATE_OF_CHARGE", volume: mergedSession.soc },
            { type: "POWER", volume: mergedSession.kw },
            { type: "ENERGY", volume: mergedSession.kwh },
            { type: "CURRENT", volume: mergedSession.current },
            { type: "VOLTAGE", volume: mergedSession.voltage }
          ]
        }
      ],
      last_updated: new Date().toISOString(),
      ...sessionTemplateRef.current,
    };

    const { countryCode, partyId } = getLocCpoInfo(mergedSession.locationId);
    
    await sendRequest(
      `Update Session [${mergedSession.sessionId}] (${mergedSession.status})`,
      `/simulator/simulate/sessions/${countryCode}/${partyId}/${mergedSession.sessionId}`,
      "POST",
      sessionPayload,
    );

    if (mergedSession.status === "COMPLETED" || mergedSession.status === "INVALID") {
      await handlePatchStatus(mergedSession.locationId, evseUid, "AVAILABLE");

      addLog(
        "CPO_SIM",
        "GENERATING_CDR",
        `會話結束 (${mergedSession.status})，自動生成 CDR 結算單 (單號: ${mergedSession.sessionId})`,
        "info",
      );

      const stopTimeStr = new Date().toISOString();
      const newCdr = {
        id: generateRandomCdrId(),
        start_date_time: mergedSession.startTime,
        end_date_time: stopTimeStr,
        kwh: mergedSession.kwh,
        authorization_reference: mergedSession.sessionId,
        total_cost: {
          excl_vat: Number((computedCost * 0.95).toFixed(2)),
          incl_vat: computedCost,
        },
        total_energy: mergedSession.kwh,
        total_time: Math.floor(
          (new Date(stopTimeStr).getTime() -
            new Date(mergedSession.startTime).getTime()) /
            1000,
        ),
        last_updated: stopTimeStr,
        ctr_code: countryCode,
        party_id: partyId,
        settled: false,
        transmission_status: "PENDING",
        ...cdrTemplateRef.current,
      };

      setCdrPayloadEdit(newCdr);

      const cdrRes = await sendRequest(
        `Post CDR Receipt`,
        "/simulator/simulate/cdrs",
        "POST",
        newCdr,
      );

      if (cdrRes.success) {
        await transmitCdr(newCdr.id);
      }

      setActiveChargingSessions((prev) => {
        const next = { ...prev };
        delete next[evseUid];
        return next;
      });

      addLog(
        "CPO_SIM",
        "SESSION_STOPPED",
        `充電會話 [${mergedSession.sessionId}] 結束！狀態: ${mergedSession.status}，已自動發送結算單。`,
        "info",
      );
    }
  };

  // Stop charging & Generate CDR
  const stopSimulatedCharging = async (evseUid: string) => {
    await updateSessionTelemetryAndSend(evseUid, { status: "COMPLETED" });
  };

  // Push CDR settlement invoice to matching EMSP via HUB
  const transmitCdr = async (cdrId: string) => {
    // Find the record
    const matchedCdr = cdrs.find((c) => c.id === cdrId);
    const payload = matchedCdr
      ? (matchedCdr.rawJson as unknown as OcpiCdr)
      : cdrPayloadEdit;

    if (!payload) return;

    const matchedEmsp = emsps.find(
      (e) => e.id === payload.emsp_id || e.id === "EMSP-A",
    );
    addLog(
      "HUB",
      "ROUTING_CDR",
      `HUB 接收到 CDR 結算單 [${payload.id}]，匹配通道中...`,
      "info",
    );

    if (matchedEmsp && matchedEmsp.active) {
      addLog(
        "HUB",
        "CDR_ROUTED",
        `CDR 轉發對接: [${matchedEmsp.name}] (${matchedEmsp.partyId})`,
        "success",
      );
      addLog(
        "eMSP",
        "CDR_SETTLED_SUCCESS",
        `eMSP [${matchedEmsp.name}] 結帳成功! 金額: $${(payload.total_cost as OcpiTotalCost)?.incl_vat || payload.total_cost || 0} TWD`,
        "success",
      );

      // Set DB values or local payload state
      if (cdrPayloadEdit && cdrPayloadEdit.id === cdrId) {
        setCdrPayloadEdit((prev) => {
          if (!prev) return null;
          return { ...prev, settled: true, transmission_status: "SUCCESS" };
        });
      }
    } else {
      addLog(
        "HUB",
        "CDR_ROUTE_FAILED",
        `無法將 CDR 轉送至 eMSP 通道。通道處於斷線或停用狀態。`,
        "error",
      );
      if (cdrPayloadEdit && cdrPayloadEdit.id === cdrId) {
        setCdrPayloadEdit((prev) => {
          if (!prev) return null;
          return { ...prev, transmission_status: "FAILED" };
        });
      }
    }
  };

  // Transmit customized payloads manually
  const triggerManualSessionSend = async () => {
    if (!sessionPayloadEdit) return;
    addLog(
      "CPO_SIM",
      "MANUAL_PUT_SESSION",
      `手動發送自訂 Session [${sessionPayloadEdit.id}] 給 HUB`,
      "info",
    );

    const matchedEmsp = emsps.find((e) => e.id === sessionPayloadEdit.emsp_id);
    if (matchedEmsp && matchedEmsp.active) {
      const { countryCode, partyId } = getLocCpoInfo(sessionPayloadEdit.location_id || "");
      await sendRequest(
        `Manual PUT Session [${sessionPayloadEdit.id}]`,
        `/simulator/simulate/sessions/${countryCode}/${partyId}/${sessionPayloadEdit.id}`,
        "POST",
        sessionPayloadEdit,
      );
      addLog(
        "HUB",
        "ROUTED_MANUAL_SESSION",
        `[自訂數據] 成功轉送至 ${matchedEmsp.name}. 電量: ${sessionPayloadEdit.kwh} kWh`,
        "success",
      );
    } else {
      addLog(
        "HUB",
        "ROUTE_ERROR",
        `自訂 Session 發送失敗: 目標 eMSP 通道關閉`,
        "error",
      );
    }
  };

  const triggerManualCdrSend = async () => {
    if (!cdrPayloadEdit) return;
    addLog(
      "CPO_SIM",
      "MANUAL_POST_CDR",
      `手動發送自訂 CDR [${cdrPayloadEdit.id}] 給 HUB`,
      "info",
    );
    await transmitCdr(cdrPayloadEdit.id);
  };

  // AutoCharge registration
  const handleAddAutoCharge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMac || !newModel || !newToken) {
      addLog(
        "CPO_SIM",
        "REGISTER_ERROR",
        "AutoCharge 註冊欄位未填寫完整",
        "warning",
      );
      return;
    }

    const mapping: AutoChargeMapping = {
      mac: newMac,
      vehicleModel: newModel,
      tokenUid: newToken,
      emspId: newEmsp,
      active: true,
    };

    setAutoCharges((prev) => [mapping, ...prev]);
    addLog(
      "CPO_SIM",
      "REGISTER_SUCCESS",
      `車輛 ${newModel} (MAC: ${newMac}) 已綁定 Token ${newToken}`,
      "success",
    );
    setNewMac("");
    setNewModel("");
    setNewToken("");
  };

  // High-frequency Charging interval loop (runs every 1.5 seconds)
  useEffect(() => {
    const chargingTimer = setInterval(async () => {
      const activeUids = Object.keys(activeChargingSessions);
      if (activeUids.length === 0) return;

      for (const uid of activeUids) {
        const session = activeChargingSessions[uid];
        // If automatic simulation is disabled, skip auto increment
        if (session.isAuto === false) continue;

        const powerKw = session.kw !== undefined ? session.kw : 120.0;
        const maxSoc = 100.0;

        // Add variance to power
        const powerVar =
          Math.round(powerKw * (0.85 + Math.random() * 0.15) * 10) / 10;
        // speed up charging (1.5s is 1 minute, so factor is 1/60 hr)
        const stepKwh = (powerVar / 3600) * 60;
        const nextKwh = Math.round((session.kwh + stepKwh) * 100) / 100;
        let nextSoc = session.soc + Math.round((stepKwh / 80) * 1000) / 10; // 80kWh battery

        if (nextSoc >= maxSoc) {
          nextSoc = maxSoc;
        }

        // Price calculation based on current tariffPrice
        const nextCost = Math.round((20.0 + nextKwh * tariffPrice) * 10) / 10;

        // Auto Stop when charged to 100%
        if (nextSoc === 100 && session.soc < 100) {
          addLog(
            "CPO_SIM",
            "CHARGING_AUTO_STOP",
            `充電樁 ${uid} 已充滿 100%`,
            "success",
          );
          setTimeout(() => stopSimulatedCharging(uid), 500);
          return;
        }

        const currentVoltage = session.voltage || 400.0;
        const currentAmp = Math.round(((powerVar * 1000) / currentVoltage) * 10) / 10;

        // Update local session tracking state
        setActiveChargingSessions((prev) => {
          if (!prev[uid]) return prev;
          return {
            ...prev,
            [uid]: {
              ...prev[uid],
              soc: Math.round(nextSoc * 10) / 10,
              kwh: nextKwh,
              cost: nextCost,
              kw: powerVar,
              current: currentAmp,
            },
          };
        });

        // Send telemetry Session PUT update to CPO receiver
        const sessionPayload = {
          id: session.sessionId,
          start_date_time: session.startTime,
          kwh: nextKwh,
          location_id: session.locationId,
          evse_uid: session.evseUid,
          status: session.status || "ACTIVE",
          total_cost: {
            excl_vat: Number((nextCost * 0.95).toFixed(2)),
            incl_vat: nextCost,
          },
          charging_periods: [
            {
              start_date_time: session.startTime,
              dimensions: [
                { type: "STATE_OF_CHARGE", volume: Math.round(nextSoc * 10) / 10 },
                { type: "POWER", volume: powerVar },
                { type: "ENERGY", volume: nextKwh },
                { type: "CURRENT", volume: currentAmp },
                { type: "VOLTAGE", volume: currentVoltage }
              ]
            }
          ],
          last_updated: new Date().toISOString(),
          ...sessionTemplateRef.current,
        };

        const { countryCode, partyId } = getLocCpoInfo(session.locationId);
        // Sync with backend API silently
        fetch(
          `/simulator/simulate/sessions/${countryCode}/${partyId}/${session.sessionId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sessionPayload),
          },
        ).catch((err) => console.error("Telemetry sync error:", err));

        // Randomly broadcast PUT session logs in terminal
        if (Math.random() > 0.8) {
          const matchedEmsp = emspsRef.current.find((e) => e.id === "EMSP-A");
          addLog(
            "HUB",
            "ROUTING_SESSION_UPDATE",
            `PUT Session: ${session.sessionId} -> 轉傳給 [${matchedEmsp?.name || "eMSP"}] (${Math.round(nextSoc * 10) / 10}%, ${nextKwh} kWh, $${nextCost} TWD)`,
            "info",
          );
        }
      }

      fetchDatabaseState();
    }, 1500); // 1.5s frequency

    return () => clearInterval(chargingTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChargingSessions, locations, tariffPrice]);

  // Server-Sent Events (SSE) Synchronization listener
  useEffect(() => {
    const eventSource = new EventSource("/simulator/events");

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        console.log("SSE Event Received:", parsed);

        if (parsed.type === "START_SESSION") {
          const { location_id, evse_uid, authorization_reference } =
            parsed.data;
          const locId = location_id || "loc_001";
          const evseU = evse_uid || "TW-CPO-EVSE-001";

          if (!activeSessionsRef.current[evseU]) {
            addLog(
              "CPO_SIM",
              "REMOTE_START",
              `收到遠端啟動指令 via SSE: ${authorization_reference || "N/A"}`,
              "info",
              parsed.data,
            );
            startSimulatedCharging(
              locId,
              evseU,
              false,
              null,
              authorization_reference,
            );
          }
        } else if (parsed.type === "STOP_SESSION") {
          const { session_id } = parsed.data;
          if (session_id) {
            const matchedUid = Object.keys(activeSessionsRef.current).find(
              (uid) => activeSessionsRef.current[uid].sessionId === session_id,
            );

            if (matchedUid) {
              addLog(
                "CPO_SIM",
                "REMOTE_STOP",
                `收到遠端結束指令 via SSE: ${session_id}`,
                "info",
                parsed.data,
              );
              stopSimulatedCharging(matchedUid);
            }
          }
        }
      } catch (err) {
        console.error("Failed to parse SSE command payload:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error, attempting retry:", err);
    };

    return () => {
      eventSource.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SimulatorContext.Provider
      value={{
        activeTab,
        setActiveTab,
        isOnline,
        serverVersion,
        logs,
        setLogs,
        targetCpoUrl,
        locations,
        sessions,
        cdrs,
        sidebarOpen,
        setSidebarOpen,
        terminalExpanded,
        setTerminalExpanded,
        filterMethod,
        setFilterMethod,
        flowStep,
        setFlowStep,
        selectedLocationId,
        setSelectedLocationId,
        selectedEvseUid,
        setSelectedEvseUid,
        customEvseStatus,
        setCustomEvseStatus,
        newSessionId,
        setNewSessionId,
        activeChargingSessions,
        sessionTemplate,
        setSessionTemplate,
        cdrTemplate,
        setCdrTemplate,
        updateSessionTelemetryAndSend,
        updateSessionTelemetryOnly,
        tariffPrice,

        // Phase 2 states
        emsps,
        setEmsps,
        cpos,
        setCpos,
        autoCharges,
        setAutoCharges,
        sessionPayloadEdit,
        setSessionPayloadEdit,
        cdrPayloadEdit,
        setCdrPayloadEdit,

        newMac,
        setNewMac,
        newModel,
        setNewModel,
        newToken,
        setNewToken,
        newEmsp,
        setNewEmsp,

        fetchDatabaseState,
        fetchEmspStatus,
        addLog,
        triggerFlowAnimation,
        sendRequest,
        handleSyncLocation,
        handleSyncTariff,
        handleSyncCustomLocation,
        handleSyncCustomTariff,
        handleAddCpo,
        handleAddEmsp,
        handleSyncAllLocations,
        initializeMockStations,
        handlePatchStatus,
        startSimulatedCharging,
        stopSimulatedCharging,
        transmitCdr,
        triggerManualSessionSend,
        triggerManualCdrSend,
        handleAddAutoCharge,
        terminalBodyRef,
      }}
    >
      {children}
    </SimulatorContext.Provider>
  );
}

export function useSimulator() {
  const context = useContext(SimulatorContext);
  if (context === undefined) {
    throw new Error("useSimulator must be used within a SimulatorProvider");
  }
  return context;
}
