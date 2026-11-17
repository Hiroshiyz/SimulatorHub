# src/simulator/ - 虛擬充電網絡事件模擬模組 / Charging Network Event Simulator

---

## 繁體中文 (Traditional Chinese)

本模組為開發者提供測試接口，用於模擬底層充電樁（EVSE）的實時狀態改變、充電交易事件流與計費單據，以供對 HUB 核心轉發功能進行完整的端到端驗證。

### 模組核心結構

* **[simulator.controller.ts](file:///home/theodore/project/mock-hub/src/simulator/simulator.controller.ts)**：
  模擬器控制器。宣告供本地或測試環境呼叫的觸發接口：
  - `/simulator/simulate/locations/...`：發送充電樁實時狀態變更（例如：插槍空閒狀態切換為充電中）。
  - `/simulator/simulate/sessions/...`：模擬車子充電中的計量進程（增加 KWh 消耗讀數）。
  - `/simulator/simulate/cdrs`：生成計費明細並觸發結帳單據。
  - `/simulator/locations/sync-all`：向註冊的 EMSP 同步 CPO 擁有的全部充電站點。
* **[simulator.service.ts](file:///home/theodore/project/mock-hub/src/simulator/simulator.service.ts)**：
  模擬器業務服務。直接更新本地資料庫以記錄虛擬對象狀態，並模擬向標準外交接口發送 HTTP Webhook payload，以測試路由轉發和身分校驗管線的反應。
* **[simulator.module.ts](file:///home/theodore/project/mock-hub/src/simulator/simulator.module.ts)**：
  模擬器模組裝配。串接資料庫與快取模組，使其能在獨立的沙盒環境下模擬漫遊交易流。

---

## English

This module provides developer-friendly simulator interfaces to trigger mock EVSE state transitions, active charging sessions telemetry updates, and final invoice calculations (CDRs), allowing end-to-end integration test runs without physical charging station hardware.

### Module Architecture

* **[simulator.controller.ts](file:///home/theodore/project/mock-hub/src/simulator/simulator.controller.ts)**:
  Simulator router. Exposes API endpoints for development integrations and manual tests:
  - `/simulator/simulate/locations/...`: Triggers simulated status changes on remote EVSEs (e.g. state transition from AVAILABLE to CHARGING).
  - `/simulator/simulate/sessions/...`: Simulates charging energy updates (increments session energy usage reading KWh).
  - `/simulator/simulate/cdrs`: Emits mock final Charge Detail Records (CDRs) statements.
  - `/simulator/locations/sync-all`: Triggers manual locations synchronization catalogs to registered EMSPs.
* **[simulator.service.ts](file:///home/theodore/project/mock-hub/src/simulator/simulator.service.ts)**:
  Simulator database updater. Commits simulated transactions directly into schemas, and sends mock HTTP requests to the standard OCPI controller to test route forwarding validation logic.
* **[simulator.module.ts](file:///home/theodore/project/mock-hub/src/simulator/simulator.module.ts)**:
  Simulator module coordinator. Connects dependencies (databases, caching, controllers) inside a sandboxed testing layout.

## 後端充電模擬 / Backend charging runtime

`ChargingRuntimeService` owns charging timers and Session telemetry (MeterValues) forwarding. Closing the browser, navigating away, or opening multiple tabs does not create or stop simulation timers. The browser receives a complete `TELEMETRY_SNAPSHOT` immediately on each SSE connection/reconnection, then whenever a simulation changes.

- `GET /simulator/charging-runtime`: current simulation snapshot.
- `POST /simulator/charging-runtime`: register/start a simulation with `{ countryCode, partyId, state, payload, energyPrice?, realTime? }`. The backend initializes the EVSE and OCPI Session. Duplicate EVSE starts are rejected.
- `PATCH /simulator/charging-runtime/:evseUid`: `{ sessionId?, fields, push? }`. Editable fields are `soc`, `kwh`, `kw`, `current`, `voltage`, `status`, `isAuto`, and `energyPrice`. With `push: false` (default), edits are saved without forwarding. With `push: true`, the current readings are sent immediately. Set `isAuto: false` to stop periodic increments/forwarding; manual sends remain available.
- `POST /simulator/charging-runtime/:evseUid/stop`: stop and settle a standard session; SCT enters IDLE and remains ACTIVE.
- `POST /simulator/charging-runtime/:evseUid/unplug`: settle SCT charging plus idle fees. Stop/unplug accept `{ sessionId? }` to reject actions from a stale page.

CPO simulation retains the accelerated 1.5-second interval (one simulated charging minute per update). Remote starts from real eMSP channels use a 15-second interval at real elapsed charging speed; mock eMSP starts use the accelerated interval. Remote START_SESSION executes in the backend and sends its asynchronous CommandResult without needing a browser.

Runtime state and settlement checkpoints are stored in the existing Redis instance (`simulator:charging-runtime:v1`), separately from forwarded OCPI payloads. Server restart resumes saved simulations; charging pauses during server downtime, while SCT idle buffer deadlines continue in wall-clock time. Existing ACTIVE database sessions are adopted when no saved simulation exists. Failed settlement steps retry with the same CDR ID; SCT never sends the CDR before its COMPLETED PATCH succeeds. The existing BullMQ routing worker delivers queued updates to eMSPs.

Run **one application instance** for this runtime. Local action serialization prevents simultaneous browser commands/timer ticks from changing one simulation concurrently; distributed scheduling across multiple app replicas is not implemented. Redis persistence settings control recovery after Redis itself restarts. No database migration is required.
