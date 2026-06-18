# src/ocpi/ - OCPI 標準接口模組 / OCPI Standard Interfaces Module

---

## 繁體中文 (Traditional Chinese)

本模組實現了符合 **OCPI 2.2.1** 國際通訊標準的外部路由接口。用於處理來自外部 CPO（充電營運商）或 EMSP（能源服務提供商）的業務交互。

### 模組核心結構

* **[ocpi.controller.ts](file:///home/theodore/project/mock-hub/src/ocpi/ocpi.controller.ts)**：
  接口控制器。負責宣告對外的標準 API 端點：
  - 握手握連與可用版本：`GET /ocpi/versions` 與 `GET /ocpi/2.2.1`。
  - 充電站地圖與槍頭拓樸：`PUT /ocpi/2.2.1/locations/...`。
  - 計費費率：`PUT /ocpi/2.2.1/tariffs/...`。
  - 即時會話：`PUT /ocpi/2.2.1/sessions/...`。
  - 計費明細：`POST /ocpi/2.2.1/cdrs`。
  - 遠端控制：`POST /ocpi/2.2.1/commands/START_SESSION` 等。
* **[ocpi.service.ts](file:///home/theodore/project/mock-hub/src/ocpi/ocpi.service.ts)**：
  業務協調服務。提供握手憑證驗證、路徑參數提取與驗證，並在資料庫中執行持久化更新。
* **[ocpi.module.ts](file:///home/theodore/project/mock-hub/src/ocpi/ocpi.module.ts)**：
  模組配置檔案。封裝並裝配該模組所需的所有 Controller 和 Service 依賴。

### 路由代理人架構 (Sub-agents)
當外交窗口接到不同類別的事務時，會默默把任務發配給定義在 [agent/](file:///home/theodore/project/mock-hub/agent) 資料夾底下的四大 sub-agent：
1. **[CredentialsAgent](file:///home/theodore/project/mock-hub/agent/CredentialsAgent.md)**：處理連線握手驗證、可用版本，並簽發 32 字元的 API Token。
2. **[TopologyAgent](file:///home/theodore/project/mock-hub/agent/TopologyAgent.md)**：處理充電站資訊與充電槍狀態，提供手動及自動的位置同步。
3. **[CommandsAgent](file:///home/theodore/project/mock-hub/agent/CommandsAgent.md)**：處理外部下達的充電桩遠端指令（啟動/停止）及預約。
4. **[BillingAgent](file:///home/theodore/project/mock-hub/agent/BillingAgent.md)**：處理費率表宣告、充電交易追蹤以及最終結帳的計費明細（CDRs）。

---

## English

This module implements standard routing endpoints conforming to the international **OCPI 2.2.1** specifications. It processes roaming business traffic between registered CPOs and EMSPs.

### Core Structure

* **[ocpi.controller.ts](file:///home/theodore/project/mock-hub/src/ocpi/ocpi.controller.ts)**:
  Exposes the compliant OCPI interface endpoints:
  - Versions Handshakes: `GET /ocpi/versions` and `GET /ocpi/2.2.1`.
  - Infrastructure Topologies: `PUT /ocpi/2.2.1/locations/...` and `PATCH /ocpi/2.2.1/locations/...`.
  - Tariff Rates Templates: `PUT /ocpi/2.2.1/tariffs/...`.
  - Real-time Session Statuses: `PUT /ocpi/2.2.1/sessions/...`.
  - Session Invoices (CDRs): `POST /ocpi/2.2.1/cdrs`.
  - Remote Charger Triggers: `POST /ocpi/2.2.1/commands/START_SESSION` and `STOP_SESSION`.
* **[ocpi.service.ts](file:///home/theodore/project/mock-hub/src/ocpi/ocpi.service.ts)**:
  Coordinates dynamic credentials validation, resolves URI parameters parsing, and formats database model queries.
* **[ocpi.module.ts](file:///home/theodore/project/mock-hub/src/ocpi/ocpi.module.ts)**:
  Ties module controller routing configurations and service classes together for NestJS dependency injection.

### Downstream Sub-agent Routing Mappings
Incoming requests are delegated to four logical agent role profiles documented under the [agent/](file:///home/theodore/project/mock-hub/agent) folder:
1. **[CredentialsAgent](file:///home/theodore/project/mock-hub/agent/CredentialsAgent.md)**: Coordinates connection handshake, version directory details, and 32-character UUID API Token generation.
2. **[TopologyAgent](file:///home/theodore/project/mock-hub/agent/TopologyAgent.md)**: Manages EVSE status, charging locations update, and manual single-tenant syncing.
3. **[CommandsAgent](file:///home/theodore/project/mock-hub/agent/CommandsAgent.md)**: Handles active remote charging execution (`START_SESSION`/`STOP_SESSION`) and bookings.
4. **[BillingAgent](file:///home/theodore/project/mock-hub/agent/BillingAgent.md)**: Manages tariff pricing formulas, active transaction telemetry, and Charge Detail Records (CDRs).
