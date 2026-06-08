# OCPI 2.2.1 API Specification

This document details the OCPI 2.2.1 endpoints supported by this system, including Receiver endpoints (our server) and Sender endpoints (commands sent to CPO/Hub).

---

## Authentication & Headers

All requests must include the following authentication and custom headers where applicable:

- **Authorization**: `Bearer <token>` (Validated against the `CREDENTIALS_TOKEN_B` environment variable)
- **OCPI-to-party-id**: Target platform's Party ID
- **OCPI-to-country-code**: Target platform's Country Code
- **OCPI-from-party-id**: Source platform's Party ID
- **OCPI-from-country-code**: Source platform's Country Code

Standard OCPI Response Wrap Structure:

```json
{
  "data": null,
  "status_code": 1000,
  "status_message": "Success",
  "timeStamp": "2026-06-08T03:24:37.000Z"
}
```

---

## 1. OCPI Receiver Endpoints (Our Server)

### 1.1 Version Information

Retrieve supported OCPI versions.

- **Method**: `GET`
- **Endpoint**: `/versions`
- **Headers**: `Authorization: Bearer <TOKEN_B>`
- **Response Data**:
  ```json
  {
    "data": [
      {
        "version": "2.2.1",
        "url": "https://<your-domain>/ocpi/2.2.1"
      }
    ],
    "status_code": 1000,
    "status_message": "Success",
    "timeStamp": "2026-06-08T03:24:37.000Z"
  }
  ```

### 1.2 Version Details

Retrieve endpoints mapping for version 2.2.1.

- **Method**: `GET`
- **Endpoint**: `/`
- **Headers**: `Authorization: Bearer <TOKEN_B>`
- **Response Data**:
  ```json
  {
    "data": {
      "version": "2.2.1",
      "endpoints": [
        {
          "identifier": "versions",
          "role": "HUB",
          "url": "https://<your-domain>/2.2.1/versions"
        }
      ]
    },
    "status_code": 1000,
    "status_message": "Success",
    "timeStamp": "2026-06-08T03:24:37.000Z"
  }
  ```

### 1.3 Receive or Update Location Information

Receive or update CPO charging station (location) details.

- **Method**: `PUT`
- **Endpoint**: `/locations/:country_code/:party_id/:location_id`
- **Headers**: `Authorization: Bearer <TOKEN_B>`
- **Request Body**:
  ```json
  {
    "operator": {
      "name": "Operator Name"
    },
    "name": "Station Name",
    "city": "Taipei",
    "state": "Taipei City",
    "address": "No. 1, Sec. 1, Xinyi Rd.",
    "postal_code": "100",
    "coordinates": {
      "latitude": "25.0339",
      "longitude": "121.5645"
    },
    "time_zone": "Asia/Taipei",
    "parking_type": "ON_STREET",
    "opening_times": "24/7",
    "charging_when_closed": true,
    "evses": [
      {
        "uid": "evse_uid_123",
        "status": "AVAILABLE",
        "evse_id": "TW*NPT*E*123",
        "floor_level": "1F",
        "capabilities": ["REMOTE_START_STOP_ALLOWED"],
        "last_updated": "2026-06-08T11:00:00Z",
        "physical_reference": "Ref-123",
        "connectors": [
          {
            "id": "1",
            "format": "CABLE",
            "standard": "IEC_62196_T2",
            "power_type": "AC_3PHASE",
            "tariff_ids": ["tariff_001"],
            "max_voltage": 400,
            "max_amperage": 32,
            "max_electric_power": 22000,
            "last_updated": "2026-06-08T11:00:00Z"
          }
        ]
      }
    ]
  }
  ```
- **Response Data**:
  ```json
  {
    "data": null,
    "status_code": 1000,
    "status_message": "Location accepted",
    "timeStamp": "2026-06-08T03:24:37.000Z"
  }
  ```

### 1.4 Update EVSE Status

Partially update EVSE status (e.g. status heartbeat).

- **Method**: `PATCH`
- **Endpoint**: `/locations/:country_code/:party_id/:location_id/:evse_uid`
- **Headers**: `Authorization: Bearer <TOKEN_B>`
- **Request Body**:
  ```json
  {
    "status": "CHARGING",
    "last_updated": "2026-06-08T11:15:00Z"
  }
  ```
- **Response Data**:
  ```json
  {
    "data": null,
    "status_code": 1000,
    "status_message": "EVSE status updated",
    "timeStamp": "2026-06-08T03:24:37.000Z"
  }
  ```

### 1.5 Receive or Update Tariff Information

Receive pricing structures from CPO.

- **Method**: `PUT`
- **Endpoint**: `/tariffs/:country_code/:party_id/:tariff_id`
- **Headers**: `Authorization: Bearer <TOKEN_B>`
- **Request Body**:
  ```json
  {
    "currency": "TWD",
    "type": "AD_HOC",
    "tariff_alt_url": "https://cpo.com/tariffs/001",
    "last_updated": "2026-06-08T11:00:00Z",
    "tariff_alt_text": [
      {
        "language": "zh",
        "text": "標準費率"
      }
    ],
    "elements": [
      {
        "price_components": [
          {
            "type": "ENERGY",
            "price": 8.5,
            "vat": 0.05,
            "step_size": 1
          }
        ]
      }
    ]
  }
  ```
- **Response Data**:
  ```json
  {
    "data": null,
    "status_code": 1000,
    "status_message": "tariffs accepted",
    "timeStamp": "2026-06-08T03:24:37.000Z"
  }
  ```

### 1.6 Receive or Update Session Status

Receive updates on active charging sessions.

- **Method**: `PUT`
- **Endpoint**: `/sessions/:country_code/:party_id/:session_id`
- **Headers**: `Authorization: Bearer <TOKEN_B>`
- **Request Body**:
  ```json
  {
    "status": "ACTIVE",
    "cdr_token": "token_abc123",
    "kwh": 5.4,
    "total_cost": {
      "excl_vat": 45.9,
      "incl_vat": 48.2
    },
    "charging_periods": [
      {
        "dimensions": [
          { "type": "CURRENT", "volume": 16 },
          { "type": "POWER", "volume": 11 },
          { "type": "STATE_OF_CHARGE", "volume": 45 },
          { "type": "ENERGY", "volume": 5.4 }
        ]
      }
    ],
    "last_updated": "2026-06-08T11:20:00Z"
  }
  ```
- **Response Data**:
  ```json
  {
    "data": null,
    "status_code": 1000,
    "status_message": "Session accepted",
    "timeStamp": "2026-06-08T03:24:37.000Z"
  }
  ```

### 1.7 Receive Charge Detail Records (CDRs)

Receive final billing records for a session.

- **Method**: `POST`
- **Endpoint**: `/cdrs`
- **Headers**: `Authorization: Bearer <TOKEN_B>`
- **Request Body**:
  ```json
  {
    "authorization_reference": "session_id_123",
    "total_cost": {
      "excl_vat": 120.0,
      "incl_vat": 126.0
    },
    "total_parking_cost": {
      "excl_vat": 0.0,
      "incl_vat": 0.0
    },
    "total_energy": 15.0,
    "total_time": 3600,
    "end_date_time": "2026-06-08T12:00:00Z"
  }
  ```
- **Response Data**:
  ```json
  {
    "data": null,
    "status_code": 1000,
    "status_message": "cdrs received",
    "timeStamp": "2026-06-08T03:24:37.000Z"
  }
  ```

### 1.8 Cancel Charging Session

Cancel or force completion of an existing transaction session.

- **Method**: `POST`
- **Endpoint**: `/sessions/:country_code/:party_id/:transaction_no`
- **Headers**: `Authorization: Bearer <TOKEN_B>`
- **Response Data**:
  ```json
  {
    "status_code": 1000,
    "status_message": "Session canceled successfully",
    "timeStamp": "2026-06-08T03:24:37.000Z"
  }
  ```

---

## 2. OCPI Sender Endpoints (Commands sent to CPO/Hub)

When our system initiates actions, we send requests to the following endpoints on the Hub/CPO.

### 2.1 Start Charging Session Command

Instruct the CPO to start a charging session.

- **Method**: `POST`
- **Endpoint**: `<CPO_BASE_URL>/ocpi/2.2.1/commands/START_SESSION`
- **Headers**:
  - `Authorization: Bearer <TOKEN_B>`
  - `OCPI-to-party-id`: `<CPO_PARTY_ID>`
  - `OCPI-to-country-code`: `<CPO_COUNTRY_CODE>`
  - `OCPI-from-party-id`: `<SENDER_PARTY_ID>`
  - `OCPI-from-country-code`: `<SENDER_COUNTRY_CODE>`
- **Request Body**:
  ```json
  {
    "response_url": "https://<your-domain>/ocpi/2.2.1/sessions/<SENDER_COUNTRY_CODE>/<SENDER_PARTY_ID>/<SESSION_ID>",
    "location_id": "loc_001",
    "evse_uid": "evse_uid_123",
    "connector_id": "1",
    "authorization_reference": "session_id_123",
    "token": {
      "country_code": "TW",
      "party_id": "NPT",
      "uid": "CARD_UID_12345",
      "type": "APP_USER",
      "contract_id": "contract001",
      "visual_number": "83515567",
      "valid": true,
      "whitelist": "ALLOWED",
      "language": "zh",
      "default_profile_type": "REGULAR",
      "last_updated": "2026-06-08T11:00:00Z",
      "issuer": "NPT"
    }
  }
  ```
- **Response Data**:
  ```json
  {
    "status_code": 1000,
    "status_message": "Success",
    "timeStamp": "2026-06-08T03:24:37.000Z"
  }
  ```

### 2.2 Stop Charging Session Command

Instruct the CPO to stop a charging session.

- **Method**: `POST`
- **Endpoint**: `<CPO_BASE_URL>/ocpi/2.2.1/commands/STOP_SESSION`
- **Headers**:
  - `Authorization: Bearer <TOKEN_B>`
  - `OCPI-to-party-id`: `<CPO_PARTY_ID>`
  - `OCPI-to-country-code`: `<CPO_COUNTRY_CODE>`
- **Request Body**:
  ```json
  {
    "response_url": "https://<your-domain>/ocpi/2.2.1/sessions/<SENDER_COUNTRY_CODE>/<SENDER_PARTY_ID>/<SESSION_ID>",
    "session_id": "session_id_123"
  }
  ```
- **Response Data**:
  ```json
  {
    "status_code": 1000,
    "status_message": "Success",
    "timeStamp": "2026-06-08T03:24:37.000Z"
  }
  ```
