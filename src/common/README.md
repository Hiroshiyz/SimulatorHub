# src/common/ - 共享基礎設施與公共工具 / Shared Infrastructure & Utilities

---

## 繁體中文 (Traditional Chinese)

本目錄存放專案中各模組共用的基礎組件與攔截工具，如身分安全驗證、動態限流以及請求日誌追蹤，不包含具體的業務邏輯。

### 常規設施與架構職責

#### 裝飾器 (decorators/)
* **[current-party.decorator.ts](file:///home/theodore/project/mock-hub/src/common/decorators/current-party.decorator.ts)**：
  自訂 NestJS 參數裝飾器 `@CurrentParty()`。在 Controller 接口接收請求時，自動解碼安全 Token 並注入當前已驗證租戶的身分上下文資訊（國家代碼、商戶ID、角色），省去在代碼中重複編寫解析邏輯。

#### 安全守衛 (gurads/)
* **[api-key.guard.ts](file:///home/theodore/project/mock-hub/src/common/gurads/api-key.guard.ts)**：
  身分驗證守衛。負責讀取並校驗 HTTP 請求頭中的 `Authorization: Token <key>` 或 `Bearer <key>`。確保僅有已註冊的合法商戶能存取對應的 OCPI API 路由。
* **[throttler.guard.ts](file:///home/theodore/project/mock-hub/src/common/gurads/throttler.guard.ts)**：
  多租戶動態限流守衛。利用 Redis 滑動窗口快取即時計算請求頻率，針對未驗證 IP 提供基本保護（預設限流為 60 秒內上限 30 次），並依據已註冊租戶的專屬限流設定檔實施動態阻斷保護。

#### 攔截器 (interceptors/)
* **[logging.interceptors.ts](file:///home/theodore/project/mock-hub/src/common/interceptors/logging.interceptors.ts)**：
  全域日誌攔截器。攔截並記錄每一次 HTTP 請求的傳入參數與相應的執行結果（如狀態碼、用時 ms），提供統一格式的系統可觀測性日誌，有利於排查錯誤與效能追蹤。

---

## English

This directory houses reusable base components and middleware shared across all application modules, providing security checks, traffic control, and execution logs, without carrying any direct OCPI domain logic.

### Infrastructure Components

#### Decorators (decorators/)
* **[current-party.decorator.ts](file:///home/theodore/project/mock-hub/src/common/decorators/current-party.decorator.ts)**:
  Exposes the custom NestJS parameter decorator `@CurrentParty()`. It extracts authenticated CPO or EMSP tenant information from request objects and binds it directly to handler parameters.

#### Guards (gurads/)
* **[api-key.guard.ts](file:///home/theodore/project/mock-hub/src/common/gurads/api-key.guard.ts)**:
  API Token verification guard. Resolves and validates standard `Authorization: Token <token>` or `Bearer <token>` headers to protect backend paths against anonymous requests.
* **[throttler.guard.ts](file:///home/theodore/project/mock-hub/src/common/gurads/throttler.guard.ts)**:
  Multi-tenant rate limiting guard. Queries Redis cache registers to track API request volumes. It enforces a fallback rate limit (`30` reqs/60s) for public IPs and resolves customized limits for authenticated tenants.

#### Interceptors (interceptors/)
* **[logging.interceptors.ts](file:///home/theodore/project/mock-hub/src/common/interceptors/logging.interceptors.ts)**:
  Global request logger. Intercepts incoming requests and corresponding outgoing server responses to write tracking details, including URL paths, execution latencies, status codes, and message bodies.
