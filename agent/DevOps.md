# docs/DEVOPS.md - DevOps & Testing Specification

This document outlines the Continuous Integration, Continuous Delivery (CI/CD) pipelines, containerization strategy, and the testing hierarchy for the OCPI HUB. To maintain modularity, infrastructure and testing structures remain fully decoupled from the core business logic.

---

## 1. Testing Hierarchy

Testing is divided into clear layers to match our modular architecture. No business logic code should cross these boundaries during testing.

### 1.1 Unit Tests
- **Location**: Co-located within each specific module or skill folder (e.g., `src/skills/billing-agent/__tests__/`).
- **Scope**: Isolated logic testing (e.g., tariff calculations inside `BillingAgent` or routing checks inside `Orchestrator`).
- **Constraint**: Must use Mocks/Stubs for all external dependencies (databases, HTTP clients, other agents). **No real I/O is allowed.**

### 1.2 Integration Tests
- **Location**: Located at the project root level (e.g., `tests/integration/`).
- **Scope**: Validates the end-to-end communication flow between the "Brain" (`Orchestrator`) and individual `Skills/Agents`.
- **Constraint**: Uses a local containerized database or an in-memory database. Verifies that webhooks correctly route to the specific agent and return the correct status codes.

---

## 2. CI/CD Pipeline Architecture

The pipeline is split into three deterministic phases, triggered automatically upon repository actions (e.g., Pull Requests, Merges to `main`/`dev`, and Git Tags).

### 2.1 Phase 1: Validate
Executed on every commit push or Pull Request to ensure code quality and prevent regression.
- **Linter & Formatter**: Run static analysis on the React client (via ESLint) and format checks.
- **Test Suite Execution**: Run all Unit Tests and Integration Tests. The pipeline will fail if any single test fails.

### 2.2 Phase 2: Build & Package
Package the application into an immutable Docker image using a multi-stage Docker build:
- **client-builder**: Compiles the React client application via Vite, saving assets into `public/`.
- **app-builder**: Compiles the NestJS backend application and copies the compiled client assets into the backend static folder.
- **runtime**: Generates a minimized runtime image with production dependencies, Prisma engine binaries, and globally installed `prisma` CLI for migrations.
- **Tagging Strategy**:
  - **Pre-releases**: For standard commits/merges on branches (`dev`, `main`), the image is tagged as a pre-release (`pre-release-<commit_sha>` and `pre-release-latest`).
  - **Tagged Releases**: Triggered exclusively by Git Tags (`v*.*.*`). The image is tagged with the release version (e.g., `v1.0.0`) and `latest`.

### 2.3 Phase 3: Deploy & Simulation (No Public Cloud Deployment)
Deploy images for runtime verification locally using Docker.
- **Local Launch**: Run images locally using Docker Compose (`docker compose up -d`) to simulate the production Hub routing system. The PostgreSQL host is healthchecked before launching the NestJS application to ensure stable startup.
- **Ephemeral PR Preview Deployments**: 
  - Triggered automatically on PR opening/syncing targeting `dev` or `main`.
  - Spins up an isolated instance of Postgres, Redis, and the Mock Hub inside a dedicated Docker Compose project (`pr-<number>`) by pulling pre-built PR images from GitHub Container Registry (`ghcr.io`) to optimize build times. Exposes services on dynamic non-conflicting host ports (mapped as `3000 + PR_NO`, etc.).
  - Comments the unique preview URL back onto the pull request for immediate E2E simulator testing.
  - **Tear Down**: Automatically stops and cleans up the isolated containers and volumes once the PR is merged or closed.

### 2.4 PR Merging & Release Robots
To govern PR mergers into the `main` production branch securely:
- **Nightly Merge at 2AM**: PRs targeting `main` containing the `ready-to-merge-2am` label are checked daily at 02:00 AM (Taipei Time). If the PR has been APPROVED, it is automatically merged and the source branch is deleted.
- **Immediate Hotfix Merge**: Critical updates bypass the nightly scheduler. If a PR targeting `main` is labeled `hotfix` or `urgent` and receives an APPROVED review decision, the robot immediately merges the PR and deletes the source branch.
- **Instant Production Release**: In both automated merge cases, the push to `main` instantly triggers the `build-and-package` CI/CD pipeline, building and publishing the `latest` production Docker image to GitHub Container Registry (`ghcr.io`).


---

## 3. Operations & Observability

While the Orchestrator routes traffic and Skills execute features, the infrastructure layers manage application health.

- **Centralized Logging**: All stdout/stderr logs from the Orchestrator and Agents are captured uniformly. Logs must include a unique transaction/correlation ID to trace a request from the Orchestrator through to the downstream agent.
- **Rate Limiting & Gateway**: Implemented at the Throttler Guard (default limit of `30` requests per `60` seconds for unauthenticated IP-based clients) to protect the infrastructure from traffic spikes and unauthorized webhook flooding.

