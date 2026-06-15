export interface EvseConnector {
  id: string;
  format: string;
  standard: string;
  power_type: string;
  tariff_ids: string[];
  max_voltage: number;
  max_amperage: number;
  max_electric_power: number;
}

export interface Evse {
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

export interface Location {
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
  rawJson?: unknown;
}

export interface LogEntry {
  id: string;
  time: string;
  module: "SYSTEM" | "HUB" | "eMSP" | "CPO_SIM";
  action: string;
  detail: string;
  type: "success" | "warning" | "error" | "info";
  payload?: unknown;
  response?: unknown;
  success?: boolean;
}

export interface AutoChargeMapping {
  mac: string;
  vehicleModel: string;
  tokenUid: string;
  emspId: string;
  active: boolean;
}

export interface EmspChannel {
  id: string;
  name: string;
  partyId: string;
  countryCode: string;
  active: boolean;
  url?: string;
  online?: boolean;
  latency?: number;
}

export interface DbSession {
  id: string;
  evseUid: string;
  kwh: number;
  status: string;
  updatedAt: string;
  rawJson?: unknown;
}

export interface DbCdr {
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

export interface ActiveSessionState {
  sessionId: string;
  evseUid: string;
  locationId: string;
  kwh: number;
  soc: number;
  cost: number;
  startTime: string;
}

export interface SessionTemplate {
  cdr_token?: {
    uid?: string;
    type?: string;
    contract_id?: string;
  };
  auth_method?: string;
  connector_id?: string;
  [key: string]: string | number | boolean | object | null | undefined;
}

export interface CdrTemplate {
  ctr_code?: string;
  party_id?: string;
  auth_method?: string;
  cdr_token?: {
    uid?: string;
    type?: string;
    contract_id?: string;
  };
  [key: string]: string | number | boolean | object | null | undefined;
}

export interface OcpiTotalCost {
  excl_vat: number;
  incl_vat: number;
}

export interface OcpiSession {
  id: string;
  start_date_time?: string;
  end_date_time?: string;
  kwh: number;
  location_id?: string;
  evse_uid?: string;
  status?: string;
  total_cost?: OcpiTotalCost;
  auth_token_uid?: string;
  emsp_id?: string;
  auth_method?: string;
  last_updated?: string;
  [key: string]: unknown;
}

export interface OcpiCdr {
  id: string;
  start_date_time?: string;
  end_date_time?: string;
  kwh?: number;
  authorization_reference?: string;
  total_cost?: OcpiTotalCost;
  total_energy?: number;
  total_time?: number;
  last_updated?: string;
  ctr_code?: string;
  party_id?: string;
  settled?: boolean;
  transmission_status?: string;
  emsp_id?: string;
  [key: string]: unknown;
}

export interface CpoTenant {
  id: string;
  countryCode: string;
  partyId: string;
  role: string;
  name: string | null;
  credential?: {
    id: string;
    tokenB: string | null;
    tokenC: string | null;
    url: string | null;
  } | null;
}


