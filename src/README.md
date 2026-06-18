# src/ - 專案指揮中心 / Project Command Center

---

## 繁體中文 (Traditional Chinese)

歡迎來到這個 NestJS 專案的指揮中心！這裡面裝的是我們後端的核心程式碼。

為了讓系統保持高模組化與清晰的邊界，我們把資料夾依據職責拆分，打理好整個系統的運行邏輯。

### 專案結構導覽

* **[main.ts](file:///home/theodore/project/mock-hub/src/main.ts)**：專案的執行進入點。負責引導 NestJS 啟動、開啟 CORS 跨域設定、註冊靜態資源目錄，並啟動 HTTP 伺服器監聽在 `3030` 埠口。
* **[app.module.ts](file:///home/theodore/project/mock-hub/src/app.module.ts)**：專案的根模組。在此整合並配置全域攔截器、限流守衛、資料庫模組、快取服務，以及各業務模組。
* **[common/](file:///home/theodore/project/mock-hub/src/common)**：存放跨模組共用的基礎設施與工具，例如限流守衛、身分驗證守衛與日誌追蹤攔截器。
* **[ocpi/](file:///home/theodore/project/mock-hub/src/ocpi)**：標準 OCPI 2.2.1 外交窗口。定義符合規範的標準 API，接收並分流外部 CPO 與 EMSP 的連線業務。
* **[prisma/](file:///home/theodore/project/mock-hub/src/prisma)**：資料庫持久化服務。整合 Prisma ORM 連接 PostgreSQL，配置高併發的動態連線池。
* **[redis/](file:///home/theodore/project/mock-hub/src/redis)**：快取與狀態儲存服務。連接 Redis 伺服器提供高速暫存以及滑動時間窗口計數限流。
* **[simulator/](file:///home/theodore/project/mock-hub/src/simulator)**：虛擬充電樁事件模擬器。提供模擬 API 觸發充電樁狀態變更、充電交易進程，並生成 CDR 計費明細以供整合測試。

---

## English

Welcome to the command center of this NestJS project! This directory contains our backend core source code.

To maintain high modularity and clear architectural boundaries, the folders are split by responsibility to manage the overall system execution flow.

### Directory Guide

* **[main.ts](file:///home/theodore/project/mock-hub/src/main.ts)**: The entry-point file of the application. Boots up the NestJS runtime, enables CORS, registers static assets path (`public/`), and starts the HTTP listener on port `3030`.
* **[app.module.ts](file:///home/theodore/project/mock-hub/src/app.module.ts)**: The root application module. Integrates and configures global interceptors, rate-limiting guards, database Prisma modules, Redis services, and all business modules.
* **[common/](file:///home/theodore/project/mock-hub/src/common)**: Houses cross-module infrastructure utilities shared across the app, such as rate limit guards, API key validators, and request logs interceptors.
* **[ocpi/](file:///home/theodore/project/mock-hub/src/ocpi)**: Standard OCPI 2.2.1 diplomatic interface. Exposes specifications-compliant endpoints, receiving and routing webhook connections from CPO and EMSP client nodes.
* **[prisma/](file:///home/theodore/project/mock-hub/src/prisma)**: Database persistence layer. Integrates Prisma ORM with PostgreSQL and manages a high-concurrency connection pool.
* **[redis/](file:///home/theodore/project/mock-hub/src/redis)**: Cache and runtime state storage. Connects to Redis to offer fast temporary storage and sliding window rate limit checks.
* **[simulator/](file:///home/theodore/project/mock-hub/src/simulator)**: Charging network event simulator. Provides mock APIs to trigger EVSE state changes, charging sessions telemetry, and final CDRs receipt calculations.
