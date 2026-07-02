# OCPI 智慧路由引擎 / OCPI Smart Routing Engine

[中文版 (Chinese)](#中文版) | [English Version](#english-version)

---

## 中文版

這份文件旨在說明 HUB 模擬器中 `routing` 模組的架構設計、核心元件，以及資料與錯誤處理的流程。

### 核心架構與元件職責

整個 OCPI 路由引擎由以下幾個核心元件組成，採用了「非同步佇列 (Message Queue)」與「快取優先 (Cache-First)」的設計模式來保證高效能與容錯性。

#### 1. `routing-producer.service.ts` (路由轉發生產者)
**職責：決定「要不要轉發」與「轉發給誰」，並將任務放入佇列。**
* **快取讀取**：接收到來自 CPO 的請求後，優先向 `RoutingCacheService` (Redis) 撈取符合 CPO 來源的所有路由規則。
* **狀態檢核**：檢查規則的 `contractStatus` (合約狀態) 與 `channelStatus` (通道狀態)。如果通道狀態為 `DISABLED` 或 `ERROR_DISABLED` (熔斷)，則直接跳過。
* **過濾器比對**：呼叫 `RoutingFilterEngine` 檢查傳入的 Payload (例如場站資訊) 是否符合路由規則設定的過濾條件 (地區、功率等)。
* **推入佇列**：將篩選後確定要轉發的任務 (包含目標 eMSP 網址、Token、Payload) 包裝成 Job，並推入 BullMQ 的 `ocpi-routing-queue` 非同步佇列中。

#### 2. `routing.worker.ts` (路由轉發消費者/執行者)
**職責：從佇列中取出任務，實際執行 HTTP 請求，並處理失敗與重試邏輯。**
* **非同步發送**：接收到 Job 後，使用 `@nestjs/axios` 實際發送 HTTP 請求 (PUT/PATCH/POST) 至目標 eMSP 的伺服器。
* **自動重試與熔斷**：
  * 若請求失敗 (如 `ECONNREFUSED` 或 `Timeout`)，BullMQ 會自動重試預設 3 次。
  * **熔斷機制**：若 3 次皆失敗，觸發 `@OnWorkerEvent("failed")` 監聽器。系統會自動將資料庫中的該條規則 `channelStatus` 更新為 **`ERROR_DISABLED`**，並同步更新 Redis 剔除該規則。
  * **Notion 警報系統**：熔斷觸發的同時，會組裝錯誤資訊，透過 Notion API 自動建立一筆「HUB 錯誤回報」的 Incident 工單。

#### 3. `routing-cache.service.ts` (路由快取服務)
**職責：確保高頻率的路由讀取都在記憶體 (Redis) 進行，避免拖垮 PostgreSQL。**
* **同步寫入**：當透過 API 新增、修改狀態 (`PROD_ACTIVE`, `DISABLED`) 或刪除路由規則時，會同步呼叫此服務更新 Redis 中的 Hash Map。
* **開機自動同步**：每次 NestJS 伺服器啟動時，會自動讀取 PostgreSQL 中所有的路由規則並覆寫 Redis，這能完美防止因為使用 Prisma Studio 直接修改資料庫所導致的「快取資料不同步」問題。

#### 4. `filtering/filter.strategy.ts` (路由過濾引擎)
**職責：負責執行路由規則設定的過濾條件邏輯。**
* 依據設定檔 (`routingFilters`) 中的條件 (例如 `geographic_regions` 和 `power_types`)，與進來的 OCPI Location Payload 進行屬性比對。
* 若不符合條件，則返回 `false`，通知 Producer 放棄轉發這筆資料。

### 完整資料流

1. **[CPO 觸發]** CPO Simulator 點擊「更新狀態」，打到 `SimulatorController` 的 `PATCH /simulator/simulate/locations/...`
2. **[轉交 HUB]** `SimulatorService` 將請求打到 HUB 本身的路由接收端點。
3. **[Producer 處理]** HUB 收到後，交由 `RoutingProducerService` 讀取 Redis 並過濾條件，最後將任務 `job` 放進 BullMQ `ocpi-routing-queue`。
4. **[Worker 執行 (成功)]** `OcpiRoutingWorker` 接手，將請求打給真正的目標 eMSP (`http://localhost:5053`)，回傳 HTTP 200 成功。
5. **[Worker 執行 (失敗)]** 如果對方伺服器掛了，Worker 自動重試 3 次。
6. **[熔斷與警報]** 3 次皆敗後，Worker 將 DB 與 Redis 標記為 `ERROR_DISABLED`，並發送 Notion 錯誤工單。未來再有資料進來，Producer 第一關就會直接擋掉 (Skip)。

### 開發與除錯技巧
* **快取不同步**：如果發現行為跟資料庫狀態不一致，通常是因為底層直接改了 DB 而沒有更新 Redis。重啟伺服器 (`npm run start:dev`) 即可觸發自動同步。
* **測試熔斷**：故意在畫面上將規則的目標網址改為一個打不通的 Port (如 `5053`)，即可觀賞自動重試與發送 Notion 的完整流程。
* **MOCK_TESTING**：將通道切換為 `MOCK_TESTING` 時，系統會無視填寫的目標網址，強制導向內部沙盒，適合用來驗證資料格式，不會產生錯誤警報。

---

## English Version

This document explains the architecture design, core components, and data/error handling flow of the `routing` module in the HUB simulator.

### Core Architecture and Component Responsibilities

The entire OCPI routing engine consists of the following core components, adopting "Message Queue" and "Cache-First" design patterns to ensure high performance and fault tolerance.

#### 1. `routing-producer.service.ts` (Routing Producer)
**Responsibility: Determines "whether to forward" and "who to forward to", and pushes tasks into the queue.**
* **Cache Retrieval**: Upon receiving a request from a CPO, it prioritizes fetching all matching routing rules for the CPO source from `RoutingCacheService` (Redis).
* **Status Validation**: Checks the rule's `contractStatus` and `channelStatus`. If the channel status is `DISABLED` or `ERROR_DISABLED` (circuit broken), the rule is skipped.
* **Filters Evaluation**: Calls `RoutingFilterEngine` to check if the incoming payload (e.g., location info) matches the routing filters (regions, power types, etc.) defined in the rule.
* **Push to Queue**: Wraps the finalized task (including target eMSP URL, Token, Payload) into a Job and pushes it to the BullMQ `ocpi-routing-queue` asynchronous queue.

#### 2. `routing.worker.ts` (Routing Worker)
**Responsibility: Pops tasks from the queue, executes actual HTTP requests, and handles failure/retry logic.**
* **Asynchronous Request**: After receiving a Job, uses `@nestjs/axios` to send the actual HTTP request (PUT/PATCH/POST) to the target eMSP server.
* **Auto-Retry and Circuit Breaker**:
  * If the request fails (e.g., `ECONNREFUSED` or `Timeout`), BullMQ will automatically retry up to 3 times by default.
  * **Circuit Breaker Mechanism**: If all 3 retries fail, the `@OnWorkerEvent("failed")` listener is triggered. The system will automatically update the rule's `channelStatus` in the database to **`ERROR_DISABLED`**, and sync this to Redis to disable the channel.
  * **Notion Alert System**: When the circuit breaker trips, it assembles error information and automatically creates a "HUB Incident Report" ticket via the Notion API.

#### 3. `routing-cache.service.ts` (Routing Cache Service)
**Responsibility: Ensures high-frequency routing reads are performed in memory (Redis) to prevent overloading PostgreSQL.**
* **Synchronous Write**: When routing rules are added, deleted, or their status is modified via API, this service is called synchronously to update the Redis Hash Map.
* **Auto-Sync on Startup**: Every time the NestJS server starts, it automatically reads all routing rules from PostgreSQL and overwrites Redis. This perfectly prevents "cache out-of-sync" issues caused by direct database modifications via tools like Prisma Studio.

#### 4. `filtering/filter.strategy.ts` (Routing Filter Engine)
**Responsibility: Executes the logic for routing filter conditions defined in the rules.**
* Evaluates the incoming OCPI Location Payload against the conditions (e.g., `geographic_regions` and `power_types`) defined in the `routingFilters`.
* Returns `false` if conditions are not met, instructing the Producer to drop/skip the forwarding of this data.

### Complete Data Flow

1. **[CPO Trigger]** Clicking "Update Status" on the CPO Simulator hits `PATCH /simulator/simulate/locations/...` on `SimulatorController`.
2. **[Pass to HUB]** `SimulatorService` sends the request to the HUB's own routing receiver endpoint.
3. **[Producer Processing]** Upon receipt, HUB delegates to `RoutingProducerService` to read Redis, evaluate filters, and push the `job` to the BullMQ `ocpi-routing-queue`.
4. **[Worker Execution (Success)]** `OcpiRoutingWorker` picks it up, sends the request to the real target eMSP, returning an HTTP 200 success.
5. **[Worker Execution (Failure)]** If the target server is down, the Worker auto-retries 3 times.
6. **[Circuit Breaker & Alert]** After 3 consecutive failures, the Worker marks DB/Redis as `ERROR_DISABLED` and fires a Notion error ticket. Future incoming data will be immediately blocked (Skipped) by the Producer.

### Development and Debugging Tips
* **Cache Out-Of-Sync**: If behavior mismatches DB status, it is usually because DB was modified directly without updating Redis. Restarting the server (`npm run start:dev`) triggers an auto-sync.
* **Testing Circuit Breaker**: Purposely change a rule's target URL to an unreachable Port (e.g., `5053`) on the UI to observe the complete auto-retry and Notion alert flow.
* **Mock Testing Mode**: When the channel is switched to `MOCK_TESTING`, the system ignores the specified target URL and forces forwarding to the internal sandbox. Ideal for validating data formats without generating error alerts.
