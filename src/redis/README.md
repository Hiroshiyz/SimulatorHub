# src/redis/ - 快取與狀態儲存模組 / Cache & State Storage Module

---

## 繁體中文 (Traditional Chinese)

本模組封裝了連接 Redis 快取伺服器的連線管道與查詢操作，用於處理臨時狀態、快速防洪限流的邏輯，以及智慧分流路由快取的同步與查詢。

### 模組核心結構

* **[redis.service.ts](file:///Users/yangcanbo/hub/SimulatorHub/src/redis/redis.service.ts)**：
  Redis 服務核心。
  - 使用 `ioredis` 建立快取連線，讀取環境變數 `REDIS_URL` 解析主機密碼與地址。
  - 提供 `isRateLimited(key, limit, windowSeconds)` 滑動窗口計數方法：在 Redis 事務通道中原子地執行 `zremrangebyscore`、`zadd`、`zcard` 以及 `expire`，在極低延遲下確認來訪者是否超出限制。
  - 用於支持 `RoutingCacheService` 實現 CPO 漫遊分流規則的 Redis Hash 儲存與即時讀寫。
* **[redis.module.ts](file:///Users/yangcanbo/hub/SimulatorHub/src/redis/redis.module.ts)**：
  快取模組配置。將 `RedisService` 導出為全域共用模組，以供身分驗證、限流守衛與分流快取使用。

---

## English

This module manages connectivity and query executions targeting the **Redis** server for runtime caching, sliding window API rate limiting, and smart roaming routing configuration syncing.

### Module Architecture

* **[redis.service.ts](file:///Users/yangcanbo/hub/SimulatorHub/src/redis/redis.service.ts)**:
  Redis caching client.
  - Initializes a client connection via `ioredis` using environment parameters resolved from `REDIS_URL`.
  - Implements `isRateLimited(key, limit, windowSeconds)` to prevent request flooding.
  - Exposes standard redis clients utilized by `RoutingCacheService` to perform O(1) Redis Hash lookups on CPO configurations.
* **[redis.module.ts](file:///Users/yangcanbo/hub/SimulatorHub/src/redis/redis.module.ts)**:
  Cache module wrapper. Registers the `RedisService` as a global provider for rate limiting guards and caching managers.

