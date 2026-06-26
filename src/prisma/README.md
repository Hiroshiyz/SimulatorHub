# src/prisma/ - 資料庫連線與持久化模組 / Database Persistence Module

---

## 繁體中文 (Traditional Chinese)

本模組封裝了基於 Prisma ORM 的 PostgreSQL 資料庫持久化連線與事務操作。

### 模組核心結構

* **[prisma.service.ts](file:///home/theodore/project/mock-hub/src/prisma/prisma.service.ts)**：
  資料庫客戶端服務。
  - 繼承自 `PrismaClient`，實現 `OnModuleInit` 與 `OnModuleDestroy` 生命週期接口，在服務啟動時建立資料庫連接，關機時優雅中斷。
  - 使用 `@prisma/adapter-pg` 驅動，內部配置連線池（Connection Pool）管理：限制連線逾時（`5000ms`）、空閒逾時（`30000ms`）與最大並行連線數（`20`），以避免極端高併發下資料庫資源被耗盡。
* **[prisma.module.ts](file:///home/theodore/project/mock-hub/src/prisma/prisma.module.ts)**：
  資料庫模組配置。將 `PrismaService` 導出為全域共享服務，讓後端各個業務模組能直接導入並執行資料庫操作。

### 相關配置檔案
* **[schema.prisma](file:///home/theodore/project/mock-hub/prisma/schema.prisma)**：資料庫 Schema 定義檔。
* **[prisma.config.js](file:///home/theodore/project/mock-hub/prisma.config.js)**：Prisma CLI 工具設定檔，宣告資料庫 URL 來源以及自動 Migrate 和 Seeding 規格。

---

## English

This module manages database connection initialization, transaction controls, and query executions targeting the **PostgreSQL** database via Prisma ORM.

### Module Architecture

* **[prisma.service.ts](file:///home/theodore/project/mock-hub/src/prisma/prisma.service.ts)**:
  Prisma Client service provider.
  - Implements NestJS's `OnModuleInit` and `OnModuleDestroy` hooks to manage startup connection setup and graceful connection shutdown.
  - Employs `@prisma/adapter-pg` to route database queries through an optimized PostgreSQL `pg` driver connection pool.
  - Configures pool parameters: Max concurrent connections (`20`), idle connections timeout (`30000ms`), and database query timeout limits (`5000ms`).
* **[prisma.module.ts](file:///home/theodore/project/mock-hub/src/prisma/prisma.module.ts)**:
  Database module wrapper. Registers the `PrismaService` as a global provider so all business modules can inject database interfaces.

### Configuration Layout
- **[schema.prisma](file:///home/theodore/project/mock-hub/prisma/schema.prisma)**: Prisma schema model declaring schemas mappings, database indexes, and foreign keys.
- **[prisma.config.js](file:///home/theodore/project/mock-hub/prisma.config.js)**: Global configuration setup defining migration folders path and seed execution triggers.
