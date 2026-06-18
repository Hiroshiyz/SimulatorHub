# agent/ - OCPI 路由子代理與發布規範指南

本目錄包含了 OCPI HUB 大腦與各個子代理人（Sub-agents）的角色定義、行為準則、API 路由邏輯以及自動化發布規範。

這套設計旨在將業務分流規則與底層 NestJS 程式碼解耦，讓 LLM 代理人能依據本目錄的 Markdown 規範，精準地引導與處理 CPO 及 EMSP 的漫遊業務。

---

## 1. 核心大腦與子代理人職責

大腦與子代理人的詳細規則文件分布如下：

### 1.1 大腦中樞：[Orchestrator (agent.md)](file:///home/theodore/project/mock-hub/agent/agent.md)
* **角色**：OCPI HUB Orchestrator（中央分流大腦）。
* **核心職責**：作為所有外部請求（Webhook、模擬器事件、管理員指令）的唯一接收點。
* **約束條件**：
  * **純分流器**：僅負責檢查 Payload 並將其分發給正確的子代理，不得執行任何具體的業務運算、資料處理或資料庫寫入。
  * **快速失敗**：遇到未定義的路由時必須立即拋出錯誤拒絕，防止無效請求污染內部。

### 1.2 子代理人 (Sub-agents)
* **[CredentialsAgent (CredentialsAgent.md)](file:///home/theodore/project/mock-hub/agent/CredentialsAgent.md) (憑證與握手代理)**：
  * 處理 CPO 與 EMSP 的連線握手（Handshake）與動態上線（Onboarding）驗證。
  * 負責產出安全的 32 字元 API Token（UUID v4 去除連字號 `-`）。
* **[TopologyAgent (TopologyAgent.md)](file:///home/theodore/project/mock-hub/agent/TopologyAgent.md) (地圖與拓樸代理)**：
  * 管理充電站點（Locations）、充電槍（EVSEs）與槍頭狀態。
  * 支援將充電站地圖同步給所有 EMSP，或指定**單一 EMSP** 進行手動資料同步。
* **[CommandsAgent (CommandsAgent.md)](file:///home/theodore/project/mock-hub/agent/CommandsAgent.md) (指令與控制代理)**：
  * 轉發遠端啟動充電（`START_SESSION`）與停止充電（`STOP_SESSION`）指令。
  * 處理充電槍頭的預約（Reserve）與取消預約。
* **[BillingAgent (BillingAgent.md)](file:///home/theodore/project/mock-hub/agent/BillingAgent.md) (計費與交易代理)**：
  * 管理費率計算模板（Tariffs）、追蹤即時充電計量進程（Sessions）。
  * 處理充電結束後所開立的結帳帳單明細（CDRs）。

---

## 2. CI/CD 與發布規範：[DevOps (DevOps.md)](file:///home/theodore/project/mock-hub/agent/DevOps.md)

本專案實施全自動化的 CI/CD 驗證與容器化發布流程，並設有排程與即時合併機制：

### 2.1 自動化流水線階段
1. **Validate（驗證）**：自動執行代碼 ESLint 靜態分析與 Jest 單元測試，確保代碼無 Regression。
2. **Build & Package（編譯與打包）**：將 NestJS 後端與編譯好的 React 前端靜態資源打包成單一 Docker 鏡像，並自動推送到 GitHub Container Registry (`ghcr.io`)。
   * **預發布 (Pre-releases)**：推送到 `dev`/`main` 分支時，打包成 `pre-release-<commit_sha>` 與 `pre-release-latest` 鏡像。
   * **正式發布 (Tagged Releases)**：推送 Git tag `v*` 時，打包成正式版鏡像。
3. **PR Preview（預部署測試）**：建立 PR 時，自動拉起獨立的 Docker Compose 專案（動態 Port），並將預覽 URL 自動貼至 PR 留言，供 Simulator 串接測試。PR 關閉時自動銷毀容器與 Volume 資源。

### 2.2 PR 自動合併機器人
為保障生產環境 (`main` 分支) 的穩定，我們設立了兩套合併機器人：
* **凌晨兩點排程合併**：對於貼有 `ready-to-merge-2am` 標籤且通過代碼審查（Approved）的 PR，機器人會在每日台灣時間凌晨 02:00 自動執行 Merge。
* **緊急熱修即時合併**：若 PR 被貼上 `hotfix` 或 `urgent` 標籤，一旦審查通過（Approved），機器人會立刻繞過排程直接執行 Merge，更新正式環境。
