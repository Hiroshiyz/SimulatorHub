# OCPI 2.2.1 HUB Simulator (NestJS)

## 專案簡介 / Project Overview

本專案是一個基於 **NestJS** 架構開發的 **OCPI 2.2.1 充電網路 HUB 模擬器**。
主要用於模擬與測試電動車（EV）漫遊基礎設施中，CPO（充電站營運商）與 EMSP（能源服務提供商）之間的雙向資訊傳遞與數據路由。

This repository features an EV charging infrastructure HUB Simulator built with NestJS, fully compliant with the **OCPI 2.2.1** protocol. It acts as a central data router and aggregator to stress-test and simulate e-Roaming scenarios.

## 核心功能 / Key Features

- **CPO & EMSP 雙向模擬 (Asymmetric Roaming)**：完整模擬 CPO 與 EMSP 的連線握手（Token A/B/C 驗證）與模組通訊。
- **充電樁數據動態收集 (EVSE Telemetry Aggregation)**：模擬底層充電樁即時回傳的狀態（Status）、充電會話（Sessions）與充電明細（CDRs），並由 HUB 統一整合。
- **上層 EMSP 數據轉發 (Data Routing)**：將收集到的 CPO 數據，依據路由規則精準轉發或提供給指定的 EMSP。
- **架構 (Framework)**：內建全域 OCPI 請求/回應 Log 攔截器 (Interceptor)、多租戶動態限流 (Guard) 以及客製化身分上下文裝飾器 (`@CurrentParty()`)。

## 環境設置 / env set up

- **Env**

```bash
cp .env.example .env
```

## 資料庫與 ORM 管理 / Database & ORM Management

本專案使用 **Prisma ORM** 作為持久化層，搭配 **PostgreSQL** 與 **Redis** 提供高併發、多租戶的充電明細與會話管理。

### ORM 常用指令與啟動指令：

- **套用 migrations 變更至資料庫**：
  ```bash
  npm run db:migrate
  ```
- **重新產生 Prisma Client 型別**：
  ```bash
  #(如果改變了schema)
  npm run db:generate
  ```
- **匯入測試 Seed 資料**（預設建立 CPO `TW*CPO` 與 EMSP `TW*EMS`）：
  ```bash
  npm run db:seed
  ```
- **啟動資料庫 GUI 網頁管理後台 (Prisma Studio)**：
  ```bash
  npm run db:studio
  ```
  _啟動後可至瀏覽器開啟 [http://localhost:5555](http://localhost:5555) 視覺化查詢/編輯租戶與交易數據。_

---

## 啟動測試 / Start testing

```bash
# Testing
npm run test

# Coverage
npm run test:cov
```

```bash
# Server (Port 3030)
npm run start:dev

# Client (React Dashboard)
npm run client:dev
```

## 未來開發計畫 / To-Do List

### 1. 後端架構增強 (Backend Architecture Enhancements)

- [x] **資料持久化 (Persistence)**：導入 **Prisma ORM** 與 **PostgreSQL**，將漫遊拓撲（Locations）、充電樁（EVSEs）、費率（Tariffs）以及交易資料（Sessions, CDRs）進行實體資料庫持久化。
- [x] **高併發與快取 (Redis Caching)**：使用 **Redis** 快取熱點資料，並處理多租戶 Token A/B/C 的動態 Token 驗證與過期管理。
- [ ] **非同步事件隊列 (Message Queue)**：導入消息隊列（如 **BullMQ** 或 **RabbitMQ**），將 CPO 回傳的 Telemetry 數據以及漫遊指令轉發設計為非同步隊列，確保大流量下的可靠性與真實 HUB 模擬。

### 2. 前端介面與體驗優化 (Frontend UI/UX Improvements)

- [ ] **充電樁狀態動畫 (EVSE Telemetry Animation)**：在 Dashboard 上加入直觀且精美的充電樁主體狀態動畫（例如：閒置、充電中、異常），使模擬狀態更具視覺反饋。
- [ ] **版面佈局調整 (Fixed Terminal Layout)**：重構網頁版面，將 **Terminal/日誌主控台固定於畫面右側**，方便在發送模擬測試時即時對照右側日誌。
- [ ] **組件模組化重構 (Component Refactoring)**：將目前單一的 `App.tsx` 拆解重構為多個獨立的頁面元件（如 `Sidebar`、`Console`、`TelemetryTab`、`TransactionTab` 等），提升前端程式碼可維護性。
