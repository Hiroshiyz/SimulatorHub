# OCPI 2.2.1 Mock Hub Simulator 規格說明書

本專案是一個基於 **NestJS** 架構開發的 **OCPI 2.2.1 充電網路 HUB 模擬器**。
主要用於模擬與測試電動車（EV）漫遊基礎設施中，CPO（充電站營運商）與 EMSP（能源服務提供商）之間的雙向資訊傳遞、動態數據路由與連線狀態檢測。

---

## 1. 系統架構與角色運作

本模擬器在 e-Roaming 漫遊測試中扮演 Hub 中轉角色，串接多個 CPO 與 EMSP：

```mermaid
graph TD
    TestRunner[測試人員 / API 測試工具] -->|1. 模擬樁狀態變更或觸發資料| MockHub[OCPI Mock Hub (Port: 3030)]

    subgraph CPO Receiver
        MockHub -->|2. 接收並儲存 CPO 資訊| DB[(Prisma PostgreSQL)]
    end

    subgraph Multi-Tenant Routing (分流與廣播)
        MockHub -->|3. 動態轉發 OCPI 請求| LocalEMSP[本地 EMSP (Port: 5053)]
        MockHub -->|3. 動態轉發 OCPI 請求| Evoasis[EVOASIS 模擬端]
        MockHub -->|3. 動態轉發 OCPI 請求| FET[uTagGo 模擬端]
        MockHub -->|3. 動態轉發 OCPI 請求| SMB[SMARTHUBLCU 模擬端]
    end

    LocalEMSP -->|4. 下發控制指令 START/STOP_SESSION| MockHub
```

1. **Receiver（接收端，模擬 Hub/CPO）**：
   - 接收來自 CPO 的資料同步請求（如 Locations、Sessions、CDRs）。
   - 接收來自 EMSP 的遠端控制指令（例如：開始充電、停止充電），並以 RxJS Subject 廣播給模擬 CPO 樁。
2. **Sender/Simulator（發送/模擬端）**：
   - 提供一系列開發測試用 API（以 `/simulate/` 開頭）。
   - 當測試人員在網頁控制台或 API 工具觸發狀態變更時，模擬器將數據轉換為標準 OCPI 格式，發送至目標主系統。
3. **Multi-Tenant Routing Engine（多租戶分流引擎）**：
   - 接收到 CPO 資料更新後，Hub 會查表找出所有已啟用之 EMSP，以其對應的端點與憑證進行多路分流（廣播）轉發。

---

## 2. 環境變數配置

模擬器啟動時會讀取以下環境變數（或使用預設值）：

- **`PORT`** (預設: `3030`)：模擬器運行的本機埠號。
- **`HUB_BASE_URL`** (預設: `http://localhost:3030`)：Mock Hub 自行呼叫 Receiver 端點時的基底網址。
- **`CPO_BASE_URL`** (預設: `http://localhost:3000`)：目標 CPO/EMSP 系統的基礎 API 網址。
- **`CREDENTIALS_TOKEN_B`** (預設: `mock_token_b_12345`)：發送 OCPI 請求時的 `Authorization: Bearer <TOKEN_B>` 標頭憑證。

---

## 3. API 端點詳細規格

### 3.1 模擬器接收端 API (OCPI Receiver Endpoints)

這些 API 用於接收來自目標系統的指令。

#### 3.1.1 查詢支援版本 (Version Information)

- **Method**: `GET`
- **Endpoint**: `/ocpi/versions`
- **說明**: 取得此 Mock 服務支援的 OCPI 版本。

#### 3.1.2 查詢版本詳細資訊 (Version Details)

- **Method**: `GET`
- **Endpoint**: `/ocpi/2.2.1`
- **說明**: 取得版本 2.2.1 下支援的端點與角色配置。

#### 3.1.3 遠端啟動充電會話 (Remote Start Session Command)

- **Method**: `POST`
- **Endpoint**: `/ocpi/2.2.1/commands/START_SESSION`
- **說明**: 接收啟動充電指令，並回傳 `ACCEPTED` 狀態。

#### 3.1.4 遠端停止充電會話 (Remote Stop Session Command)

- **Method**: `POST`
- **Endpoint**: `/ocpi/2.2.1/commands/STOP_SESSION`
- **說明**: 接收停止充電指令，並回傳 `ACCEPTED` 狀態。

---

### 3.2 模擬發送端 API (Simulation Trigger Endpoints)

這些端點供開發或測試工具調用，用以推送測試數據至目標主系統。

#### 3.2.1 模擬發送充電站資訊 (Simulate Location)

- **Method**: `POST`
- **Endpoint**: `/simulate/locations/:countryCode/:partyId/:locationId`
- **轉發動作**: `PUT ${HUB_BASE_URL}/ocpi/2.2.1/locations/:countryCode/:partyId/:locationId`

#### 3.2.2 模擬發送費率資訊 (Simulate Tariff)

- **Method**: `POST`
- **Endpoint**: `/simulate/tariffs/:countryCode/:partyId/:tariffId`
- **轉發動作**: `PUT ${HUB_BASE_URL}/ocpi/2.2.1/tariffs/:countryCode/:partyId/:tariffId`

#### 3.2.3 模擬更新充電樁狀態 (Simulate EVSE Status Patch)

- **Method**: `POST`
- **Endpoint**: `/simulate/locations/:countryCode/:partyId/:locationId/:evseUid`
- **轉發動作**: `PATCH ${HUB_BASE_URL}/ocpi/2.2.1/locations/:countryCode/:partyId/:locationId/:evseUid`

#### 3.2.4 模擬發送充電會話資訊 (Simulate Session)

- **Method**: `POST`
- **Endpoint**: `/simulate/sessions/:countryCode/:partyId/:sessionId`
- **轉發動作**: `PUT ${HUB_BASE_URL}/ocpi/2.2.1/sessions/:countryCode/:partyId/:sessionId`

#### 3.2.5 模擬發送充電結束明細 (Simulate CDR)

- **Method**: `POST`
- **Endpoint**: `/simulate/cdrs`
- **轉發動作**: `POST ${HUB_BASE_URL}/ocpi/2.2.1/cdrs`

#### 3.2.6 模擬遠端取消充電會話 (Simulate Cancel Session)

- **Method**: `POST`
- **Endpoint**: `/simulate/sessions/cancel/:countryCode/:partyId/:transactionNo`
- **轉發動作**: `POST ${HUB_BASE_URL}/ocpi/2.2.1/sessions/:countryCode/:partyId/:transactionNo`

---

### 3.3 模擬器管理與檢測 API (Management & Health Check Endpoints)

#### 3.3.1 查詢所有 EMSP 連線與延遲狀態 (Get EMSP Connection Status)

- **Method**: `GET`
- **Endpoint**: `/simulator/emsps/status`
- **說明**: 後端主動向資料庫中所有註冊的 EMSP 發送連線測試（包含 `localhost:5053` 與其他模擬端點），測量延遲並回傳在線狀態。
- **回應**:
  ```json
  [
    {
      "id": "emsp-uuid-1",
      "countryCode": "TW",
      "partyId": "EMSP",
      "name": "Taiwan Roaming EMSP (Local)",
      "url": "http://localhost:5053",
      "online": true,
      "latency": 15,
      "error": null
    },
    {
      "id": "emsp-uuid-2",
      "countryCode": "TW",
      "partyId": "EVO",
      "name": "EVOASIS",
      "url": "http://localhost:3030/simulator/mock-emsp/EVO",
      "online": true,
      "latency": 2,
      "error": null
    }
  ]
  ```

---

## 4. 核心功能實作細節

### 4.1 多租戶路由分流機制 (Multi-Tenant Routing Policy)

當 Hub 的接收端點（如 Locations、Sessions、CDRs）收到來自 CPO 端的上報資料時，會自動進行以下分流動作：

1. **資料落庫**：將最新的 Location/EVSE/Session 寫入本機 PostgreSQL。
2. **多路廣播轉發 (Broadcasting)**：
   - 系統查詢 `Party` 資料表中所有角色為 `EMSP` 的租戶。
   - 為每一個 EMSP 組裝標準 OCPI Header：
     - `OCPI-to-party-id` / `OCPI-to-country-code`：對應個別 EMSP 的註冊 ID 與國家碼。
     - `OCPI-from-party-id` / `OCPI-from-country-code`：`HUB` / `TW`。
     - `Authorization`: 使用對應的 `tokenC`。
   - 以異步非阻塞方式將資料同時轉發（`PUT`/`POST`/`PATCH`）至各家 EMSP。
   - 藉此實現「一份 CPO 變更，全網 EMSP 同步分流」。

### 4.2 EMSP 通道健康檢查與連線狀態監控 (Connectivity Health Checks)

- **檢測策略**：
  - **模擬 EMSP 端點**：針對路徑中包含 `mock-emsp` 的頻道，發送 `GET /health` 進行輕量化檢查。
  - **真實 EMSP 系統 (如 localhost:5053)**：發送 `GET /ocpi/2.2.1/versions`，或在連線超時/回傳錯誤時備用 ping 其根目錄。
- **前端展示**：
  - **連接狀態面板 (Hub Router Control Panel)**：即時呈現在線狀態（綠燈/紅燈）、連線延遲 (ms)。
  - 提供「手動重新整理」按鈕，方便開發者在重啟本地 EMSP 時即時測試通訊。

### 4.3 OCPP 與 OCPI 狀態轉換映射規則 (OCPP-to-OCPI Status Mapping)

在 CPO 模擬器介面中，變更充電樁（EVSE）狀態時，系統會自動將 OCPP 的物理狀態轉換成標準 OCPI 規格並發送給 Hub：

| OCPP 狀態 (模擬樁操作)   | OCPI 狀態 (傳送給 Hub) | 說明                           |
| :----------------------- | :--------------------- | :----------------------------- |
| **Available** (拔槍歸位) | `AVAILABLE`            | 充電樁空閒中                   |
| **Preparing** (模擬插槍) | `CHARGING`             | 車輛已插槍（平台辨識為充電中） |
| **Charging**             | `CHARGING`             | 充電進行中                     |
| **SuspendedEV**          | `CHARGING`             | 車輛端暫停充電                 |
| **SuspendedEVSE**        | `CHARGING`             | 充電樁端暫停充電               |
| **Finishing**            | `BLOCKED`              | 充電完成，車輛未駛離           |
| **Reserved**             | `RESERVED`             | 預約中                         |
| **Unavailable**          | `INOPERATIVE`          | 暫停服務                       |
| **Faulted**              | `OUTOFORDER`           | 故障                           |

---

## 5. NestJS 請求生命週期與架構流程 (Request Lifecycle & Architecture)

本專案基於 **NestJS** 框架的設計哲學，每個 API 請求皆會依序經過 Middleware、Guard、Interceptor、Pipe、Controller 與 Service 等層級的處理。以下為 OCPI 模組與 Simulator 模組之 Request Lifecycle 與各元件具體職責：

### 5.1 請求生命週期循序圖

當外部系統（如 EMSP）呼叫 OCPI 接收端 API 時，請求在系統內的完整流轉如下：

```mermaid
sequenceDiagram
    autonumber
    actor EMSP as 外部 EMSP 系統
    participant ExpMW as Express Middleware
    participant ThrotG as ThrottlerGuard (全域限流)
    participant ApiKeyG as ApiKeyGuard (金鑰驗證)
    participant LogI as LoggingInterceptor (全域日誌)
    participant Controller as OcpiController (控制器)
    participant Service as OcpiService (服務層)
    participant DB as Prisma PostgreSQL / Redis

    EMSP->>ExpMW: HTTP 請求 (帶有 Authorization & Body)
    Note over ExpMW: 處理 CORS / Static Assets 靜態檔案
    ExpMW->>ThrotG: 轉發請求
    
    alt 請求網址為 /simulator* 開頭
        Note over ThrotG: 直接 Bypass 限流檢查
    else 其他 API 請求
        Note over ThrotG: 依據 IP 或 Authorization Token<br/>使用 Redis 滑動窗口演算法限流
        alt 超過流量限制 (Rate Limit Exceeded)
            ThrotG-->>EMSP: 拋出 429 Too Many Requests
        end
        Note over ThrotG: 將已解析的 partyContext<br/>注入 request.party 中
    end
    
    ThrotG->>ApiKeyG: 轉發請求
    
    alt Redis 快取命中 (Cache Hit)
        Note over ApiKeyG: 從 Redis 讀取快取之 Party 資訊<br/>注入 request.party
    else 快取未命中 (Cache Miss)
        ApiKeyG->>DB: 查詢 Prisma.credential
        alt 查無此 Token 憑證
            ApiKeyG-->>EMSP: 拋出 401 Unauthorized
        else 驗證成功
            Note over ApiKeyG: 快取 Party 資訊至 Redis (TTL: 1hr)<br/>注入 request.party
        end
    end
    
    ApiKeyG->>LogI: 進入前置攔截 (Pre-controller)
    Note over LogI: 記錄請求開始時間 (startTime)
    
    LogI->>Controller: 進入控制器方法
    Note over Controller: 藉由 @CurrentParty() 取得注入之 PartyContext
    Note over Controller: 呼叫 validatePartyMatch() 檢查多租戶越權訪問 (ForbiddenException)
    
    Controller->>Service: 呼叫業務邏輯
    Service->>DB: 讀取或寫入資料
    DB-->>Service: 回傳資料
    Service-->>Controller: 包裝成 OCPI Response 格式 (status_code: 1000)
    Controller-->>LogI: 進入後置攔截 (Post-controller)
    
    Note over LogI: 依據 Production/Dev 環境印出成功或失敗日誌<br/>(非生產環境下會印出 Body，並遮蔽 Authorization Headers)
    LogI-->>EMSP: 回傳 HTTP 200 響應與 OCPI Body
```

### 5.2 各元件職責與專案實作

#### 5.2.1 Middlewares (中間件)
- **CORS 設定**：透過 `app.enableCors({ credentials: true })` 允許跨來源請求。
- **靜態檔案託管**：透過 `app.useStaticAssets()` 託管 `public` 目錄下的前端測試控制台與靜態資源。

#### 5.2.2 Guards (守衛)
- **`ThrottlerGuard`** ([throttler.guard.ts](file:///home/theodore/project/mock-hub/src/common/gurads/throttler.guard.ts))：
  - 註冊為全域守衛 (`APP_GUARD`)。
  - 對於 `/simulator` 開頭的本地端點直接放行。
  - 對於其他外部 OCPI 請求，首先讀取 IP 與 Token。若是已註冊租戶，會從快取或資料庫取得其自訂限流頻率，並利用 **Redis 滑動窗口 (Sliding Window)** 機制在分散式環境下實現精準限流，並將租戶上下文儲存至 `request.party` 中供後續重用。
- **`ApiKeyGuard`** ([api-key.guard.ts](file:///home/theodore/project/mock-hub/src/common/gurads/api-key.guard.ts))：
  - 綁定在 `OcpiController` 類別層級上。
  - 負責 OCPI 要求的 Token 身份驗證，支援 `Token <token>` 與 `Bearer <token>` 格式。
  - 透過 Redis 進行 Token 與 Party 關係的快取以提升效能（TTL: 1 小時）。未命中時使用 Prisma 查詢 PostgreSQL，若無效則丟出 `UnauthorizedException` (401)。

#### 5.2.3 Interceptors (攔截器)
- **`LoggingInterceptor`** ([logging.interceptors.ts](file:///home/theodore/project/mock-hub/src/common/interceptors/logging.interceptors.ts))：
  - 註冊為全域攔截器 (`APP_INTERCEPTOR`)。
  - 採用 RxJS `tap()` 與 `catchError()` 封裝請求流程，量測並記錄 API 處理時間。
  - 具備敏感資料遮蔽機制（自動過濾 Authorization Token），並能針對不同環境輸出合適的日誌細節。

#### 5.2.4 Param Decorators (參數裝飾器)
- **`@CurrentParty()`** ([current-party.decorator.ts](file:///home/theodore/project/mock-hub/src/common/decorators/current-party.decorator.ts))：
  - 用於控制器的方法參數。
  - 從 NestJS `ExecutionContext` 中安全取得 `request.party`，避免在多個控制器中重複撰寫屬性提取代碼。

#### 5.2.5 Controllers (控制器)
- **`OcpiController`** ([ocpi.controller.ts](file:///home/theodore/project/mock-hub/src/ocpi/ocpi.controller.ts))：
  - 接收標準 OCPI 規範的 API 請求（Locations、Tariffs、Sessions、CDRs 及 Commands）。
  - 使用 `@UseGuards(ApiKeyGuard)`。
  - 內建 `validatePartyMatch()` 驗證機制，比對 Token 關聯租戶之 `countryCode` 與 `partyId` 是否與路由 URL 中的參數一致，防範多租戶架構下的越權修改行為（Multi-tenant violation, 403 Forbidden）。
- **`SimulatorController`** ([simulator.controller.ts](file:///home/theodore/project/mock-hub/src/simulator/simulator.controller.ts))：
  - 處理測試控制台專用的觸發和查詢端點，不受 `ApiKeyGuard` 管轄，且能被限流守衛 bypass，確保測試流暢性。
  - 包含 `mock-emsp` 系列端點，用以模擬被轉發端點之響應。

#### 5.2.6 Services (服務層)
- **`OcpiService`** ([ocpi.service.ts](file:///home/theodore/project/mock-hub/src/ocpi/ocpi.service.ts))：
  - 實作資料持久化與標準 OCPI 包裝格式。
  - 當收到 commands 時，使用 RxJS Subject 進行狀態廣播給正在運行的模擬充電樁。
- **`SimulatorService`**：
  - 提供發送端（Sender）的 API 轉發動作、連線狀態檢測（Connectivity Health Check）及 SSE (Server-Sent Events) 事件串流的推送。

---

## 6. 未來擴充計畫 (Roadmap)

1.  **完整握手驗證流程 (Auth Handshake Simulation)**：
    - 支援標準的 Token A / B / C 交換與動態註冊流程。
2.  **狀態機生命週期模擬 (State Machine Flow)**：
    - 提供一鍵觸發的場景測試 API，自動模擬從插槍、啟動、充電更新、停止到產生 CDR 的完整時序流程。
3.  **新增AUTOCHARGE功能提供給EMSP驗證名單是否正確**
    - 支援完整的AUTOCHARGE

