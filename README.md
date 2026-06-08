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
