# src/redis/ - 快取與狀態儲存模組 / Cache & State Storage Module

---

## 繁體中文 (Traditional Chinese)

本模組封裝了連接 Redis 快取伺服器的連線管道與查詢操作，用於處理臨時狀態與快速防洪限流的邏輯。

### 模組核心結構

* **[redis.service.ts](file:///home/theodore/project/mock-hub/src/redis/redis.service.ts)**：
  Redis 服務核心。
  - 使用 `ioredis` 建立快取連線，讀取環境變數 `REDIS_URL` 解析主機密碼與地址。
  - 提供 `isRateLimited(key, limit, windowSeconds)` 滑動窗口計數方法：在 Redis 事務通道中原子地執行 `zremrangebyscore`（清除窗口外舊紀錄）、`zadd`（寫入當前時間戳）、`zcard`（計算當前時間區間內的累計次數）以及 `expire`（更新快取過期時間），在極低延遲下確認來訪者是否超出調用限制。
* **[redis.module.ts](file:///home/theodore/project/mock-hub/src/redis/redis.module.ts)**：
  快取模組配置。將 `RedisService` 導出為全域共用模組，以供身分驗證、限流守衛使用。

---

## English

This module manages connectivity and query executions targeting the **Redis** server for runtime caching and sliding window API rate limiting.

### Module Architecture

* **[redis.service.ts](file:///home/theodore/project/mock-hub/src/redis/redis.service.ts)**:
  Redis caching client.
  - Initializes a client connection via `ioredis` using environment parameters resolved from `REDIS_URL`.
  - Implements `isRateLimited(key, limit, windowSeconds)` to prevent request flooding:
    - Runs a Redis multi-transaction block containing atomic actions: `zremrangebyscore` (removes old logs), `zadd` (adds current timestamp), `zcard` (retrieves count in current window), and `expire` (extends cache TTL).
    - Enforces sliding window rate limits on endpoints with minimal overhead.
* **[redis.module.ts](file:///home/theodore/project/mock-hub/src/redis/redis.module.ts)**:
  Cache module wrapper. Registers the `RedisService` as a global provider for rate limiting guards and caching managers.
