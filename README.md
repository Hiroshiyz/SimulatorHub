# OCPI 2.2.1 HUB Simulator (NestJS)

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Hiroshiyz/SimulatorHub)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.x-blue?style=flat&logo=node.js)](https://nodejs.org)
[![Prisma Version](https://img.shields.io/badge/prisma-7.8.0-blue?style=flat&logo=prisma)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue?style=flat&logo=postgresql)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/redis-7.2-red?style=flat&logo=redis)](https://redis.io)

---

## 語言選擇 / Language Selection / 言語選択 / 언어 선택

- [繁體中文 (Traditional Chinese)](#繁體中文-traditional-chinese)
- [English](#english)
- [日本語 (Japanese)](#日本語-japanese)
- [한국어 (Korean)](#한국어-korean)

---

## 繁體中文 (Traditional Chinese)

### 目錄
1. [專案簡介](#專案簡介)
2. [核心功能](#核心功能)
3. [快速入門 (Quickstart)](#快速入門-quickstart)
4. [本地模擬啟動](#本地模擬啟動)
5. [測試指令](#測試指令)

### 專案簡介
本專案是一個基於 **NestJS** 架構開發的 **OCPI 2.2.1 充電網路 HUB 模擬器**。主要用於模擬與測試電動車（EV）漫遊（Roaming）基礎設施中，CPO（充電站營運商）與 EMSP（能源服務提供商）之間的雙向資訊傳遞與數據路由。

### 核心功能
- **CPO & EMSP 雙向模擬**：模擬完整 handshake（Token A/B/C 驗證）與動態 onboarding 過程。
- **數據路由與轉發**：統一收集 CPO 的充電樁狀態、交易 Sessions、計費 CDRs，並精準轉發至對應的 EMSP。
- **多租戶限流與安全保護**：按 IP 或註冊的 tenant 身份進行動態限流，保證系統的可用性。

### 快速入門 (Quickstart)
1. **複製環境設定檔**：
   ```bash
   cp .env.example .env
   ```
2. **安裝專案依賴項**（根目錄與 client 目錄）：
   ```bash
   npm install
   npm install --prefix client
   ```
3. **本地開發編譯與啟動**（需先啟動本地 Postgres 與 Redis）：
   ```bash
   # 啟動開發伺服器
   npm run start:dev
   
   # 啟動 React 管理前台
   npm run client:dev
   ```

### 本地模擬啟動
本專案支援完全使用 Docker 容器化一鍵啟動以進行模擬：
```bash
# 1. 構建 Docker 鏡像
docker compose build

# 2. 一鍵啟動 Postgres、Redis 與 Mock Hub 服務
docker compose up -d

# 3. 查看運行日誌（系統將會自動執行 Migration 與 Idempotent 數據播種）
docker compose logs -f mock-hub
```
*模擬器前台與後端端點將可於 `http://localhost:3030` 進行訪問。*

### 測試指令
```bash
# 執行單元與整合測試
npm run test

# 測試覆蓋率報告
npm run test:cov
```

---

## English

### Table of Contents
1. [Project Overview](#project-overview)
2. [Key Features](#key-features)
3. [Quickstart](#quickstart-en)
4. [Local Docker Simulation](#local-docker-simulation)
5. [Testing Commands](#testing-commands)

### Project Overview
This project is an **OCPI 2.2.1 Charging Network HUB Simulator** built on **NestJS**. It is designed to simulate and test two-way routing, authentication, and communication between CPOs (Charge Point Operators) and EMSPs (e-Mobility Service Providers) in EV roaming infrastructures.

### Key Features
- **Bi-directional CPO & EMSP Roaming**: Full connection handshake (Token A/B/C validation) and onboarding simulation.
- **Data Routing & Telemetry Aggregation**: Aggregates CPO EVSE statuses, active Sessions, and CDR bills and forwards them to mapped EMSPs.
- **Multi-tenant Rate Limiting & Guards**: Dynamic rate limits (based on IP or registered tenant identity) to protect endpoints.

### <a name="quickstart-en"></a>Quickstart
1. **Copy Environmental Configuration**:
   ```bash
   cp .env.example .env
   ```
2. **Install Dependencies** (root and client):
   ```bash
   npm install
   npm install --prefix client
   ```
3. **Run Dev Environment Locally** (Postgres and Redis must be running):
   ```bash
   # Start the NestJS backend
   npm run start:dev
   
   # Start the React frontend client
   npm run client:dev
   ```

### Local Docker Simulation
You can simulate the entire backend, database, and cache environment locally using Docker:
```bash
# 1. Build Docker images
docker compose build

# 2. Boot up container services (Postgres, Redis, Mock Hub)
docker compose up -d

# 3. Inspect container execution logs (includes auto-migrations & idempotent seeding)
docker compose logs -f mock-hub
```
*Access the simulated routing server and portal at `http://localhost:3030`.*

### Testing Commands
```bash
# Run unit & integration tests
npm run test

# Generate test coverage reports
npm run test:cov
```

---

## 日本語 (Japanese)

### 目次
1. [プロジェクト概要](#プロジェクト概要)
2. [主な機能](#主な機能)
3. [クイックスタート](#クイックスタート-ja)
4. [Docker ローカルシミュレーション](#docker-ローカルシミュレーション)
5. [テスト実行](#テスト実行)

### プロジェクト概要
本プロジェクトは、**NestJS** フレームワーク上に構築された **OCPI 2.2.1 充電ネットワーク HUB シミュレータ**です。EVローミング環境におけるCPO（充電スタンド事業者）とEMSP（モビリティサービスプロバイダー）間の双方向通信、接続検証、およびデータルーティングのシミュレーションとテストを可能にします。

### 主な機能
- **双方向 CPO & EMSP シミュレーション**: コネクションハンドシェイク（Token A/B/C 検証）および動的オンボーディングのシミュレーション。
- **データルーティングと統合**: 充電スタンドのステータス、充電セッション（Sessions）、課金レコード（CDRs）を統合収集し、適切な EMSP へルーティングします。
- **マルチテナントレート制限と保護**: IPまたは登録テナントの認証トークンごとに動的なレート制限を適用し、APIを保護します。

### <a name="quickstart-ja"></a>クイックスタート
1. **環境設定ファイルのコピー**:
   ```bash
   cp .env.example .env
   ```
2. **依存関係의インストール** (ルートおよびクライアント):
   ```bash
   npm install
   npm install --prefix client
   ```
3. **ローカル開発環境の起動** (Postgres および Redis の起動が必要):
   ```bash
   # バックエンド (NestJS) の起動
   npm run start:dev
   
   # フロントエンド (React) クライアントの起動
   npm run client:dev
   ```

### Docker ローカルシミュレーション
Docker Compose を利用して、ワンコマンドでシミュレーションを実行できます。
```bash
# 1. Docker イメージのビルド
docker compose build

# 2. コンテナサービスの起動 (Postgres, Redis, Mock Hub)
docker compose up -d

# 3. 実行ログの確認 (自動マイグレーションと冪等なデータシードが実行されます)
docker compose logs -f mock-hub
```
*ブラウザから `http://localhost:3030` にアクセスして、管理画面とシミュレータにアクセスできます。*

### テスト実行
```bash
# テストの実行
npm run test

# カバレッジレポートの生成
npm run test:cov
```

---

## 한국어 (Korean)

### 목차
1. [프로젝트 소개](#프로젝트-소개)
2. [핵심 기능](#핵심-기능)
3. [빠른 시작](#빠른-시작-ko)
4. [로컬 Docker 시뮬레이션](#로컬-docker-시뮬레이션)
5. [테스트 명령어](#테스트-명령어)

### 프로젝트 소개
이 프로젝트는 **NestJS** 기반으로 개발된 **OCPI 2.2.1 충전 네트워크 HUB 시뮬레이터**입니다. EV 로밍 인프라에서 CPO(충전소 운영사)와 EMSP(모빌리티 서비스 제공사) 간의 양방향 정보 전송, 인증 및 데이터 라우팅을 테스트하고 시뮬레이션하도록 설계되었습니다.

### 핵심 기능
- **양방향 CPO & EMSP 로밍 시뮬레이션**: 커넥션 핸드셰이크(Token A/B/C 검증) 및 동적 온보딩 프로세스 시뮬레이션.
- **데이터 라우팅 및 통합**: 충전기 상태, 활성 세션(Sessions), 결제 데이터(CDRs)를 통합 수집하여 매핑된 EMSP로 전송합니다.
- **다중 테넌트 속도 제한 및 보안**: IP 또는 등록된 테넌트의 토큰에 따라 동적으로 API 요청 속도를 제안하고 보호합니다.

### <a name="quickstart-ko"></a>빠른 시작
1. **환경 설정 파일 복사**:
   ```bash
   cp .env.example .env
   ```
2. **종속성 설치** (루트 및 클라이언트):
   ```bash
   npm install
   npm install --prefix client
   ```
3. **로컬 개발 서버 실행** (Postgres 및 Redis 실행 필요):
   ```bash
   # NestJS 백엔드 실행
   npm run start:dev
   
   # React 프론트엔드 클라이언트 실행
   npm run client:dev
   ```

### 로컬 Docker 시뮬레이션
Docker Compose를 사용하여 전체 데이터베이스, 캐시 및 서버 환경을 한 번에 실행할 수 있습니다:
```bash
# 1. Docker 이미지 빌드
docker compose build

# 2. 컨테이너 서비스 일괄 실행 (Postgres, Redis, Mock Hub)
docker compose up -d

# 3. 컨테이너 실행 로그 확인 (자동 마이그레이션 및 멱등한 시드 데이터 주입이 실행됩니다)
docker compose logs -f mock-hub
```
*로컬 `http://localhost:3030` 포트를 통해 관리 대시보드 및 서버 엔드포인트에 접속할 수 있습니다.*

### 테스트 명령어
```bash
# 단위 및 통합 테스트 실행
npm run test

# 테스트 커버리지 리포트 생성
npm run test:cov
```
