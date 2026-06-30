# Role: OCPI HUB Orchestrator

## Context

The `OCPIHubOrchestrator` acts as the central routing brain of the OCPI HUB. It is the single entry point for all incoming external stimuli—including webhooks from CPOs/eMSPs, simulator test events, and admin commands.

Its sole responsibility is to inspect the incoming payload and delegate it to the correct sub-agent.

---

## 2. Routing Rules

The Orchestrator dispatches traffic to specific downstream Agents based on the OCPI module type:

| Module / Topic                     | Target Sub-Agent   | Description                                                                                 |
| :--------------------------------- | :----------------- | :------------------------------------------------------------------------------------------ |
| Handshake, Versions, Tokens        | `CredentialsAgent` | Handles connection setup, version endpoints, and token authorization.                       |
| EVSE Status, Locations, Connectors | `TopologyAgent`    | Manages information about charging stations, charge points, and real-time status.           |
| Remote Start/Stop, Reservation     | `CommandsAgent`    | Triggers active command execution on remote chargers.                                       |
| Tariffs, Charging Sessions, CDRs   | `BillingAgent`     | Responsible for cost calculation rules, active session tracking, and Charge Detail Records. |
| Simulation events, registrations   | `SimulatorAgent`   | Handles mock configurations, manual syncs, and telemetry events (locations, sessions, CDRs).|

---

## 3. Stateless Smart Routing Pipeline & Circuit Breaker

Downstream event-driven roaming traffic (e.g. Locations, EVSEs, Tariffs, Sessions, CDRs) is routed through the [RoutingModule](file:///Users/yangcanbo/hub/SimulatorHub/src/ocpi/routing/routing.module.ts) using the following pipeline:

### 3.1 Routing Cache
- **Storage**: Routing rules are cached in a Redis Hash (`hub:routing:<cpo_country_code>:<cpo_party_id>`) for O(1) lookups.
- **Service**: Managed by [RoutingCacheService](file:///Users/yangcanbo/hub/SimulatorHub/src/ocpi/routing/routing-cache.service.ts).

### 3.2 Strategy Filter Engine
- **Engine**: [RoutingFilterEngine](file:///Users/yangcanbo/hub/SimulatorHub/src/ocpi/routing/filtering/filter.strategy.ts#L69-L87).
- **Geographic Filtering**: Matches country code, city, or postal code in payload against rules ([GeographicFilterStrategy](file:///Users/yangcanbo/hub/SimulatorHub/src/ocpi/routing/filtering/filter.strategy.ts#L7-L30)).
- **Power Type Filtering**: Matches EVSE connector types (e.g. `AC_3_PHASE`, `DC`) ([PowerTypeFilterStrategy](file:///Users/yangcanbo/hub/SimulatorHub/src/ocpi/routing/filtering/filter.strategy.ts#L32-L67)).

### 3.3 Message Queueing & Mock Handling
- **Enqueuing**: [RoutingProducerService](file:///Users/yangcanbo/hub/SimulatorHub/src/ocpi/routing/routing-producer.service.ts) fetches cached rules, executes the filters, and enqueues jobs to BullMQ `ocpi-routing-queue` under job name `forward-task` (3 attempts, 5s exponential backoff).
- **Mock Testing**: If `channelStatus` is `MOCK_TESTING`, endpoints and tokens are dynamically overwritten with local environment configurations.

### 3.4 Outbound Worker & Circuit Breaker
- **Execution**: [OcpiRoutingWorker](file:///Users/yangcanbo/hub/SimulatorHub/src/ocpi/routing/routing.worker.ts) consumes the queue and uses NestJS `HttpService` to forward requests.
- **Failures & Notion Incidents**: On final retry failure:
  1. Sets rule status to `ERROR_DISABLED` in the database inside a transaction.
  2. Evicts/Refreshes the Redis Cache.
  3. Creates an incident report ticket in the Notion Database.

---

## 4. Architecture Constraints

To maintain a clean separation of concerns, the Orchestrator must strictly follow these rules:

- **No Direct Execution**: Do not execute module-specific business logic or skills directly. Pass the payload to the specific sub-agent.
- **No Data Processing**: It should never process raw data, calculate costs, map database models, or format/manipulate JSON payloads.
- **Pure Dispatcher**: It must remain a lightweight, deterministic router. If an incoming route is unknown, it must reject the request or throw an error immediately to prevent silent failures.
