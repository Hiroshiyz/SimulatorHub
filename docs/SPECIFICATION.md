# OCPI 2.2.1 Mock Hub Simulator 規格說明書

本專案是一個基於 **NestJS** 架構開發的 **OCPI 2.2.1 充電網路 HUB 模擬器**。
主要用於模擬與測試電動車（EV）漫遊基礎設施中，CPO（充電站營運商）與 EMSP（能源服務提供商）之間的雙向資訊傳遞與數據路由。

---

## 1. 系統架構與角色運作

本模擬器在 e-Roaming 測試中主要扮演兩種角色：

```mermaid
graph TD
    TestRunner[測試人員 / API 測試工具] -->|1. 觸發模擬資料 POST /simulate/...| MockHub[OCPI Mock Hub (Port: 3030)]
    MockHub -->|2. 轉發標準 OCPI 請求 (PUT/PATCH/POST)| TargetCPO[目標 CPO / EMSP 主系統]
    
    TargetCPO -->|3. 發送控制指令 (POST /ocpi/2.2.1/commands/...)| MockHub
```

1. **Receiver（接收端，模擬 Hub/CPO）**：
   * 接收來自外部主要系統或 EMSP 傳入的遠端充電指令（例如：開始充電、停止充電）。
2. **Sender/Simulator（發送/模擬端）**：
   * 提供一系列開發測試用 API（以 `/simulate/` 開頭）。
   * 當測試人員呼叫這些端點時，模擬器會將測試數據轉換成標準 OCPI 格式，發送至目標主系統（`CPO_BASE_URL`）。

---

## 2. 環境變數配置

模擬器啟動時會讀取以下環境變數（或使用預設值）：

*   **`PORT`** (預設: `3030`)：模擬器運行的本機埠號。
*   **`CPO_BASE_URL`** (預設: `http://localhost:3000`)：目標 CPO/EMSP 系統的基礎 API 網址。
*   **`CREDENTIALS_TOKEN_B`** (預設: `mock_token_b_12345`)：發送 OCPI 請求時的 `Authorization: Bearer <TOKEN_B>` 標頭憑證。

---

## 3. API 端點詳細規格

### 3.1 模擬器接收端 API (OCPI Receiver Endpoints)
這些 API 用於接收來自目標系統的指令。

#### 3.1.1 查詢支援版本 (Version Information)
*   **Method**: `GET`
*   **Endpoint**: `/ocpi/versions`
*   **說明**: 取得此 Mock 服務支援的 OCPI 版本。
*   **回應**:
    ```json
    {
      "data": [
        {
          "version": "2.2.1",
          "url": "http://localhost:3030/ocpi/2.2.1"
        }
      ],
      "status_code": 1000,
      "status_message": "Success",
      "timeStamp": "2026-06-10T07:29:52.000Z"
    }
    ```

#### 3.1.2 查詢版本詳細資訊 (Version Details)
*   **Method**: `GET`
*   **Endpoint**: `/ocpi/2.2.1`
*   **說明**: 取得版本 2.2.1 下支援的端點與角色配置。

#### 3.1.3 遠端啟動充電會話 (Remote Start Session Command)
*   **Method**: `POST`
*   **Endpoint**: `/ocpi/2.2.1/commands/START_SESSION`
*   **說明**: 接收啟動充電指令，並回傳 `ACCEPTED` 狀態。

#### 3.1.4 遠端停止充電會話 (Remote Stop Session Command)
*   **Method**: `POST`
*   **Endpoint**: `/ocpi/2.2.1/commands/STOP_SESSION`
*   **說明**: 接收停止充電指令，並回傳 `ACCEPTED` 狀態。

---

### 3.2 模擬發送端 API (Simulation Trigger Endpoints)
這些端點供開發或測試工具調用，用以推送測試數據至目標主系統。

#### 3.2.1 模擬發送充電站資訊 (Simulate Location)
*   **Method**: `POST`
*   **Endpoint**: `/simulate/locations/:countryCode/:partyId/:locationId`
*   **轉發動作**: `PUT ${CPO_BASE_URL}/ocpi/2.2.1/locations/:countryCode/:partyId/:locationId`

#### 3.2.2 模擬發送費率資訊 (Simulate Tariff)
*   **Method**: `POST`
*   **Endpoint**: `/simulate/tariffs/:countryCode/:partyId/:tariffId`
*   **轉發動作**: `PUT ${CPO_BASE_URL}/ocpi/2.2.1/tariffs/:countryCode/:partyId/:tariffId`

#### 3.2.3 模擬更新充電樁狀態 (Simulate EVSE Status Patch)
*   **Method**: `POST`
*   **Endpoint**: `/simulate/locations/:countryCode/:partyId/:locationId/:evseUid`
*   **轉發動作**: `PATCH ${CPO_BASE_URL}/ocpi/2.2.1/locations/:countryCode/:partyId/:locationId/:evseUid`

#### 3.2.4 模擬發送充電會話資訊 (Simulate Session)
*   **Method**: `POST`
*   **Endpoint**: `/simulate/sessions/:countryCode/:partyId/:sessionId`
*   **轉發動作**: `PUT ${CPO_BASE_URL}/ocpi/2.2.1/sessions/:countryCode/:partyId/:sessionId`

#### 3.2.5 模擬發送充電結束明細 (Simulate CDR)
*   **Method**: `POST`
*   **Endpoint**: `/simulate/cdrs`
*   **轉發動作**: `POST ${CPO_BASE_URL}/ocpi/2.2.1/cdrs`

#### 3.2.6 模擬遠端取消充電會話 (Simulate Cancel Session)
*   **Method**: `POST`
*   **Endpoint**: `/simulate/sessions/cancel/:countryCode/:partyId/:transactionNo`
*   **轉發動作**: `POST ${CPO_BASE_URL}/ocpi/2.2.1/sessions/:countryCode/:partyId/:transactionNo`

---

## 4. 未來擴充計畫 (Roadmap)

1.  **動態多租戶路由管理 (Dynamic Multi-Tenant Routing)**：
    *   支援依據 OCPI Header 中的 `OCPI-to-party-id` 與 `OCPI-to-country-code` 查表，動態轉發請求給不同的 CPO 或 EMSP。
2.  **完整握手驗證流程 (Auth Handshake Simulation)**：
    *   支援標準的 Token A / B / C 交換與動態註冊流程。
3.  **狀態機生命週期模擬 (State Machine Flow)**：
    *   提供一鍵觸發的場景測試 API，自動模擬從插槍、啟動、充電更新、停止到產生 CDR 的完整時序流程。
4.  **視覺化測試控制台 (Web Console)**：
    *   新增簡易的 Web 前端頁面，讓測試人員可直接透過瀏覽器發送模擬訊號。
