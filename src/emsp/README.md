# src/emsp/ - eMSP 漫遊通道模組 / eMSP Roaming Channel Module

---

## 繁體中文 (Traditional Chinese)

本模組專門負責與移動出行服務運營商（eMSP, e-Mobility Service Provider）進行漫遊數據的對接與連線狀態管理。

### 主要功能

1. **eMSP 租戶註冊與憑證管理 (`registerEmsp`)**
   - 支援在此 Mock Hub 中動態註冊外部真實的 eMSP 或模擬的 eMSP 節點。
   - 管理每個 eMSP 的 `tokenC`（漫遊認證憑證）與 API 連線端點。

2. **漫遊通道動態檢測與健康狀態遙測 (`getEmspStatus`)**
   - 系統會定期或手動針對已註冊的 eMSP 端點發送 HTTP GET 請求進行健康狀態檢測。
   - 對於外部真實 eMSP，請求目標為 `/ocpi/2.2.1/versions` 端點；對於本地模擬 eMSP，請求目標為 `/health`。
   - 即時計算並返還通道在線狀態（online/offline）以及網路延遲（latency ms）。

3. **雙向漫遊指令轉發與訊息中繼 (`forwardToEmsps`)**
   - 作為 CPO 與 eMSP 之間的中繼站，當 CPO 端有場站（Locations）或費率（Tariffs）異動時，本服務負責利用 HTTP PUT/PATCH/POST 方法將數據廣播至所有已啟用的 eMSP 漫遊通道。

4. **特定通道獨立場站補發 (`syncLocationsToEmsp`)**
   - 支援將資料庫中當前所有場站數據手動單獨補發同步給特定的 eMSP 通道，這在新增 eMSP 或是通道斷線重新上線後進行資料同步時非常有用。

---

## English

This module manages roaming data exchanges and connection statuses targeting Mobility Service Providers (eMSPs).

### Core Features

1. **eMSP Tenant Registration & Credentials Management (`registerEmsp`)**
   - Dynamically registers external live eMSPs or simulated eMSP nodes inside the Mock Hub.
   - Manages connection URL endpoints and `tokenC` roaming API credentials.

2. **Real-time Health Check & Connectivity Telemetry (`getEmspStatus`)**
   - Regularly or manually pings registered eMSP endpoints via HTTP GET.
   - Probes the `/ocpi/2.2.1/versions` endpoint for real eMSPs, or the `/health` endpoint for local mocks.
   - Dynamically measures online statuses and query latency times in milliseconds.

3. **Bi-directional Roaming Outbound Relays (`forwardToEmsps`)**
   - Relays CPO data (such as new locations, charge point statuses, or tariffs updates) to target eMSP endpoints using HTTP PUT/PATCH/POST requests carrying matching security tokens.

4. **Targeted Locations Catalog Sync (`syncLocationsToEmsp`)**
   - Supports manual one-to-one synchronization of the complete location catalog to a single specific eMSP, useful during new tenant registrations or post-outage recovery.
