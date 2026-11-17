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
  OcpiCdrToken,
  OcpiTotalCost,
  CpoTenant,
  ToastMessage,
} from "../types/simulator";
import {
  buildSctTariff,
  isSctParty,
} from "../billing/sctIdleFee";

interface SimulatorContextType {
  activeTab:
    | "dashboard"
    | "cpo-sim"
    | "sct-sim"
    | "emsp-sim"
    | "hub-router"
    | "autocharge";
  setActiveTab: (
    tab: "dashboard" | "cpo-sim" | "sct-sim" | "emsp-sim" | "hub-router" | "autocharge",
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
  toasts: ToastMessage[];
  showToast: (message: string, type?: "success" | "error" | "info" | "warning") => void;
  removeToast: (id: string) => void;

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
    method: "POST" | "PUT" | "PATCH" | "DELETE",
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
  handleSyncLocationsToSpecificEmsp: (
    countryCode: string,
    partyId: string,
  ) => Promise<{ success: boolean; count?: number; error?: string }>;
  handleSendEmspCommand: (
    emspToken: string,
    command: "START_SESSION" | "STOP_SESSION",
    payload: unknown,
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
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
    initialIsAuto?: boolean,
    customTokenUid?: string | null,
    customEmspId?: string | null,
    customCdrToken?: OcpiCdrToken | null,
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
  stopChargingForIdle: (evseUid: string, fields?: Partial<ActiveSessionState>) => void;
  unplugVehicle: (evseUid: string) => Promise<void>;
  tariffPrice: number;
  transmitCdr: (cdrId: string, customCdr?: OcpiCdr) => Promise<void>;
  triggerManualSessionSend: () => Promise<void>;
  triggerManualCdrSend: () => Promise<void>;
  handleAddAutoCharge: (e: React.FormEvent) => void;
  terminalBodyRef: React.RefObject<HTMLDivElement | null>;

  // Routing Rules state and functions
  routingRules: HubRoutingRule[];
  fetchRoutingRules: () => Promise<void>;
  handleAddRoutingRule: (data: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  handleToggleRuleStatus: (id: string, currentStatus: string) => Promise<{ success: boolean; error?: string }>;
  handleUpdateRuleFilters: (id: string, filters: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  handleDeleteRoutingRule: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export interface HubRoutingRule {
  id: string;
  cpoCountryCode: string;
  cpoPartyId: string;
  emspCountryCode: string;
  emspPartyId: string;
  contractStatus: string;
  channelStatus: string;
  emspBaseUrl: string;
  emspTokenB: string;
  routingFilters: {
    geographic_regions?: string[];
    power_types?: string[];
  };
  createdAt: string;
  updatedAt: string;
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

function generateRandomSessionId() {
  return `SES-${Math.floor(100000 + Math.random() * 900000)}`;
}

export function SimulatorProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "cpo-sim" | "sct-sim" | "emsp-sim" | "hub-router" | "autocharge"
  >("dashboard");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

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

  // Selection & Input states (Internal raw state)
  const [selectedLocationIdState, setSelectedLocationId] =
    useState<string>("loc_001");
  const [selectedEvseUidState, setSelectedEvseUid] = useState<string | null>(null);

  // Derive normalized/effective values to prevent invalid states without using useEffect
  const hasSelectedLoc = locations.some((l) => l.id === selectedLocationIdState);
  const selectedLocationId = locations.length > 0
    ? (hasSelectedLoc ? selectedLocationIdState : locations[0].id)
    : "loc_001";

  const matchedLoc = locations.find((l) => l.id === selectedLocationId);
  const matchedEvses = matchedLoc?.evses || [];
  const selectedEvseUid = matchedEvses.length > 0
    ? (matchedEvses.some((e) => e.uid === selectedEvseUidState) ? selectedEvseUidState : matchedEvses[0].uid)
    : null;
  const [customEvseStatus, setCustomEvseStatus] = useState<string>("AVAILABLE");
  const [newSessionId, setNewSessionId] = useState<string>("");

  // Phase 2 states
  const [emsps, setEmsps] = useState<EmspChannel[]>([]);
  const [cpos, setCpos] = useState<CpoTenant[]>([]);
  const [routingRules, setRoutingRules] = useState<HubRoutingRule[]>([]);
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

  // Synchronize selection state with loaded locations database
  useEffect(() => {
    if (locations.length > 0) {
      const isLocValid = locations.some((l) => l.id === selectedLocationId);
      if (!isLocValid) {
        const firstLoc = locations[0];
        setTimeout(() => {
          setSelectedLocationId(firstLoc.id);
          if (firstLoc.evses && firstLoc.evses.length > 0) {
            setSelectedEvseUid(firstLoc.evses[0].uid);
          } else {
            setSelectedEvseUid(null);
          }
        }, 0);
      } else {
        const currentLoc = locations.find((l) => l.id === selectedLocationId);
        const isEvseValid = currentLoc?.evses?.some((e) => e.uid === selectedEvseUid);
        if (!isEvseValid && currentLoc?.evses && currentLoc.evses.length > 0) {
          setTimeout(() => {
            setSelectedEvseUid(currentLoc.evses[0].uid);
          }, 0);
        }
      }
    } else {
      setTimeout(() => {
        setSelectedEvseUid(null);
      }, 0);
    }
  }, [locations, selectedLocationId, selectedEvseUid]);

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

  // SCT amounts are VAT-free, so excl_vat equals incl_vat (spec 2.4.1)
  const toOcpiPrice = (session: ActiveSessionState, cost: number) => ({
    excl_vat: session.billingProfile === "SCT" ? cost : Math.round(cost * 0.95),
    incl_vat: cost,
  });

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

  // Fetch all databases (locations, sessions, CDRs, CPOs, routing rules) from simulator backend
  const fetchDatabaseState = async () => {
    try {
      const [locRes, sessRes, cdrRes, cpoRes, ruleRes] = await Promise.all([
        fetch("/simulator/locations"),
        fetch("/simulator/sessions"),
        fetch("/simulator/cdrs"),
        fetch("/simulator/cpos"),
        fetch("/simulator/routing-rules"),
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
      if (ruleRes.ok) {
        const ruleData = await ruleRes.json();
        setRoutingRules(ruleData);
      }
    } catch (err) {
      console.error("Failed to query database state:", err);
    }
  };
  // Ref to hold latest routing rules to avoid stale closures in intervals
  const routingRulesRef = useRef<HubRoutingRule[]>([]);
  useEffect(() => {
    routingRulesRef.current = routingRules;
  }, [routingRules]);

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
          tokenC?: string;
        }>;
        setEmsps((prev) => {
          return emspData.map((backendEmsp) => {
            const existing = prev.find(
              (e) =>
                e.partyId === backendEmsp.partyId &&
                e.countryCode === backendEmsp.countryCode,
            );
            
            const rule = routingRulesRef.current.find(
              (r) =>
                r.emspCountryCode.toUpperCase() === backendEmsp.countryCode.toUpperCase() &&
                r.emspPartyId.toUpperCase() === backendEmsp.partyId.toUpperCase(),
            );
            
            const active = rule
              ? (rule.channelStatus === "PROD_ACTIVE" || rule.channelStatus === "MOCK_TESTING")
              : (existing ? existing.active : true);

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
              active,
              tokenC: backendEmsp.tokenC,
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
  // Sync logic is now cleanly derived on rendering above. No useEffect required.

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
    method: "POST" | "PUT" | "PATCH" | "DELETE",
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
    await Promise.all(Object.values(activeSessionsRef.current)
      .filter((session) => session.billingProfile !== "SCT")
      .map((session) => runtimeRequest(session.evseUid, "", { energyPrice })));
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

  const fetchRoutingRules = async () => {
    try {
      const res = await fetch("/simulator/routing-rules");
      if (res.ok) {
        const data = await res.json();
        setRoutingRules(data);
      }
    } catch (err) {
      console.error("Failed to query routing rules:", err);
    }
  };

  const handleAddRoutingRule = async (data: Record<string, unknown>) => {
    addLog(
      "SYSTEM",
      "ADD_ROUTING_RULE",
      `在 HUB 新增路由規則: CPO [${data.cpoCountryCode}-${data.cpoPartyId}] ➔ eMSP [${data.emspCountryCode}-${data.emspPartyId}]`,
      "info",
      data,
    );
    const res = await sendRequest(
      `Add Routing Rule`,
      "/simulator/routing-rules",
      "POST",
      data,
      false,
    );
    if (res.success) {
      await fetchRoutingRules();
    }
    return { success: res.success, error: res.error };
  };

  const handleToggleRuleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "PROD_ACTIVE" ? "MOCK_TESTING" : currentStatus === "MOCK_TESTING" ? "DISABLED" : "PROD_ACTIVE";
    addLog(
      "SYSTEM",
      "TOGGLE_RULE_STATUS",
      `更新路由規則狀態為: ${nextStatus}`,
      "info",
      { id, nextStatus }
    );
    const res = await sendRequest(
      `Toggle Rule Status`,
      `/simulator/routing-rules/${id}/status`,
      "PATCH",
      { channelStatus: nextStatus },
      false,
    );
    if (res.success) {
      await fetchRoutingRules();
    }
    return { success: res.success, error: res.error };
  };

  const handleUpdateRuleFilters = async (id: string, filters: Record<string, unknown>) => {
    addLog(
      "SYSTEM",
      "UPDATE_RULE_FILTERS",
      `更新路由規則過濾條件`,
      "info",
      { id, filters }
    );
    const res = await sendRequest(
      `Update Rule Filters`,
      `/simulator/routing-rules/${id}/filters`,
      "PATCH",
      { routingFilters: filters },
      false,
    );
    if (res.success) {
      await fetchRoutingRules();
    }
    return { success: res.success, error: res.error };
  };

  const handleDeleteRoutingRule = async (id: string) => {
    addLog(
      "SYSTEM",
      "DELETE_ROUTING_RULE",
      `刪除路由規則`,
      "warning",
      { id }
    );
    const res = await sendRequest(
      `Delete Routing Rule`,
      `/simulator/routing-rules/${id}`,
      "DELETE",
      undefined,
      false,
    );
    if (res.success) {
      await fetchRoutingRules();
    }
    return { success: res.success, error: res.error };
  };

  const handleSyncLocationsToSpecificEmsp = async (
    countryCode: string,
    partyId: string,
  ) => {
    addLog(
      "SYSTEM",
      "SYNC_SPECIFIC_EMSP",
      `手動同步所有場站資訊至特定 EMSP: ${countryCode}-${partyId}`,
      "info",
    );
    const res = await sendRequest(
      `Sync to ${countryCode}-${partyId}`,
      `/simulator/locations/sync-specific/${countryCode}/${partyId}`,
      "POST",
      undefined,
      true,
    );
    const dataObj = res.data as { count?: number } | undefined;
    return { success: res.success, count: dataObj?.count || 0 };
  };

  const handleSendEmspCommand = async (
    emspToken: string,
    command: "START_SESSION" | "STOP_SESSION",
    payload: unknown,
  ) => {
    addLog(
      "eMSP",
      `SEND_${command}`,
      `發送命令 ${command} 呼叫 HUB (以 Token ${emspToken ? emspToken.substring(0, 8) : ""}...)`,
      "info",
      payload,
    );
    try {
      triggerFlowAnimation(true);
      const res = await fetch(`/ocpi/2.2.1/commands/${command}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Token ${emspToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      
      addLog(
        "HUB",
        `${command}_RESPONSE`,
        `收到 HUB 對命令 ${command} 的回傳結果: ${data?.status_message || "N/A"}`,
        res.ok ? "success" : "error",
        undefined,
        data,
      );

      await fetchDatabaseState();
      return { success: res.ok, data };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addLog(
        "SYSTEM",
        `${command}_FAILED`,
        `發送命令 ${command} 失敗: ${errorMsg}`,
        "error",
      );
      return { success: false, error: errorMsg };
    }
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
    initialIsAuto = true,
    customTokenUid: string | null = null,
    customEmspId: string | null = null,
    customCdrToken: OcpiCdrToken | null = null,
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

    const activeEmsp = emspsRef.current.find((e) => e.active) || emspsRef.current[0];
    let emspId = customEmspId || (activeEmsp ? activeEmsp.id : "EMSP-A");
    let tokenUid = customTokenUid || "MANUAL-TOKEN-CPO";
    let authMethod = "RFID_SWIPE";

    if (isAutoCharge && customMac) {
      const mapping = autoCharges.find((m) => m.mac === customMac);
      if (mapping) {
        tokenUid = mapping.tokenUid;
        const matchedDbEmsp = emspsRef.current.find((e) => e.partyId === mapping.emspId || e.id === mapping.emspId);
        emspId = matchedDbEmsp ? matchedDbEmsp.id : emspId;
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

    const matchedEmsp = emspsRef.current.find(
      (e) => e.id === emspId || e.id === "EMSP-A" || e.partyId === "SMB" || e.active
    ) || emspsRef.current[0];

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
      generateRandomSessionId();

    const startTimeStr = new Date().toISOString();

    // The backend atomically owns the simulation and initializes the session/EVSE.

    const { countryCode, partyId } = getLocCpoInfo(locationId);
    const sctSession: ActiveSessionState | null = isSctParty(partyId)
      ? {
          sessionId: generatedSessId,
          evseUid,
          locationId,
          kwh: 0.0,
          soc: 15.0,
          cost: 0.0,
          startTime: startTimeStr,
          status: "ACTIVE",
          emspId,
          authorizationReference: customSessId,
          tokenUid,
          ...(customCdrToken ? { cdrToken: customCdrToken } : {}),
          billingProfile: "SCT",
          phase: "CHARGING",
          tariffSnapshot: buildSctTariff(new Date(startTimeStr)),
        }
      : null;

    // 2. Put Session to CPO receiver (State: ACTIVE)
    const initialSessionPayload = sctSession ? buildSctSessionPayload(sctSession, [], startTimeStr) : {
      id: generatedSessId,
      start_date_time: startTimeStr,
      kwh: 0.0,
      location_id: locationId,
      evse_uid: evseUid,
      status: "ACTIVE",
      total_cost: { excl_vat: 0.0, incl_vat: 0.0 },
      auth_token_uid: tokenUid,
      // Lets the eMSP correlate its START_SESSION command with this session
      ...(customSessId ? { authorization_reference: customSessId } : {}),
      emsp_id: emspId,
      auth_method: authMethod,
      last_updated: startTimeStr,
      ...sessionTemplateRef.current, // Merge template variables
    };

    try {
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

      const activeObj: ActiveSessionState = sctSession
        ? {
            ...sctSession,
            kw: initialKw,
            voltage: initialVoltage,
            current: initialCurrent,
            // SCT sessions are driven from the 星舟 page, which has no manual telemetry: always simulate charging
            isAuto: true,
          }
        : {
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
            isAuto: initialIsAuto,
            emspId,
            authorizationReference: customSessId,
            tokenUid,
          };

      const registered = await fetch("/simulator/charging-runtime", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: activeObj, payload: initialSessionPayload, countryCode, partyId, energyPrice: tariffPrice }),
      });
      if (!registered.ok) {
        showToast(`後端模擬啟動失敗：${await registered.text()}`, "error");
        return;
      }
      const snapshot = await registered.json();
      activeSessionsRef.current = snapshot;
      setActiveChargingSessions(snapshot);
      setSessionPayloadEdit(initialSessionPayload);
      setNewSessionId("");
      addLog(
        "CPO_SIM",
        "SESSION_STARTED",
        `啟動充電成功! Session ID: ${generatedSessId}，開始發送 telemetry`,
        "success",
      );
    } catch (error) {
      showToast(`後端模擬啟動失敗：${error instanceof Error ? error.message : String(error)}`, "error");
    }
  };

  const runtimeRequest = async (evseUid: string, action: string, fields?: Partial<ActiveSessionState>, push = false) => {
    const response = await fetch(`/simulator/charging-runtime/${encodeURIComponent(evseUid)}${action ? `/${action}` : ""}`, {
      method: action ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: activeSessionsRef.current[evseUid]?.sessionId, fields, push }),
    });
    if (!response.ok) {
      const message = await response.text();
      showToast(`遙測操作失敗：${message}`, "error");
      throw new Error(message);
    }
    const snapshot = await response.json();
    activeSessionsRef.current = snapshot;
    setActiveChargingSessions(snapshot);
    if (push || action) await fetchDatabaseState();
  };

  const updateSessionTelemetryOnly = (evseUid: string, fields: Partial<ActiveSessionState>) => {
    // Persist edits without publishing MeterValues until the user presses send.
    void runtimeRequest(evseUid, "", fields).catch(console.error);
  };
  const updateSessionTelemetryAndSend = async (evseUid: string, fields: Partial<ActiveSessionState>) => {
    await runtimeRequest(evseUid, "", fields, true);
  };
  const stopSimulatedCharging = async (evseUid: string) => { await runtimeRequest(evseUid, "stop"); };
  const stopChargingForIdle = (evseUid: string) => { void runtimeRequest(evseUid, "stop").catch(console.error); };
  const unplugVehicle = async (evseUid: string) => { await runtimeRequest(evseUid, "unplug"); };
  const buildSctSessionPayload = (session: ActiveSessionState, chargingPeriods: unknown[], lastUpdated: string) => {
    const { countryCode, partyId } = getLocCpoInfo(session.locationId);
    const emsp = emspsRef.current.find((e) => e.id === session.emspId);
    return {
      country_code: countryCode, party_id: partyId, id: session.sessionId,
      start_date_time: session.startTime, kwh: session.kwh,
      cdr_token: session.cdrToken || { country_code: emsp?.countryCode || "TW", party_id: emsp?.partyId || "EMS", uid: session.tokenUid || "MANUAL-TOKEN-CPO", type: "RFID", contract_id: "" },
      auth_method: session.authorizationReference ? "COMMAND" : "AUTH_REQUEST",
      ...(session.authorizationReference ? { authorization_reference: session.authorizationReference } : {}),
      location_id: session.locationId, evse_uid: session.evseUid, connector_id: String(sessionTemplateRef.current.connector_id || "1"), currency: "TWD",
      charging_periods: chargingPeriods, total_cost: toOcpiPrice(session, session.cost),
      status: session.status || "ACTIVE", last_updated: lastUpdated, emsp_id: session.emspId,
    };
  };

  // Push CDR settlement invoice to matching EMSP via HUB
  const transmitCdr = async (cdrId: string, customCdr?: OcpiCdr) => {
    // Find the record
    const matchedCdr = cdrs.find((c) => c.id === cdrId);
    const payload = customCdr || (matchedCdr
      ? (matchedCdr.rawJson as unknown as OcpiCdr)
      : cdrPayloadEdit);

    if (!payload) return;

    const matchedEmsp = emsps.find(
      (e) => e.id === payload.emsp_id || e.id === "EMSP-A" || e.partyId === "SMB" || e.active
    ) || emsps[0];
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

    const matchedEmsp = emsps.find(
      (e) => e.id === sessionPayloadEdit.emsp_id || e.id === "EMSP-A" || e.partyId === "SMB" || e.active
    ) || emsps[0];
    if (matchedEmsp && matchedEmsp.active) {
      const { countryCode, partyId } = getLocCpoInfo(
        sessionPayloadEdit.location_id || "",
      );
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
    await transmitCdr(cdrPayloadEdit.id, cdrPayloadEdit);
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

  // Reconnects receive a complete snapshot; no browser timers drive charging or forwarding.
  useEffect(() => {
    const eventSource = new EventSource("/simulator/events");
    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "TELEMETRY_SNAPSHOT") {
          activeSessionsRef.current = parsed.data;
          setActiveChargingSessions(parsed.data);
          void fetchDatabaseState();
        }
      } catch (error) { console.error("Invalid telemetry event", error); }
    };
    return () => eventSource.close();
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
        stopChargingForIdle,
        unplugVehicle,
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
        handleSyncLocationsToSpecificEmsp,
        handleSendEmspCommand,
        initializeMockStations,
        handlePatchStatus,
        startSimulatedCharging,
        stopSimulatedCharging,
        transmitCdr,
        triggerManualSessionSend,
        triggerManualCdrSend,
        handleAddAutoCharge,
        terminalBodyRef,
        toasts,
        showToast,
        removeToast,

        // Routing Rules exports
        routingRules,
        fetchRoutingRules,
        handleAddRoutingRule,
        handleToggleRuleStatus,
        handleUpdateRuleFilters,
        handleDeleteRoutingRule,
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
