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

## 3. Architecture Constraints

To maintain a clean separation of concerns, the Orchestrator must strictly follow these rules:

- **No Direct Execution**: Do not execute module-specific business logic or skills directly. Pass the payload to the specific sub-agent.
- **No Data Processing**: It should never process raw data, calculate costs, map database models, or format/manipulate JSON payloads.
- **Pure Dispatcher**: It must remain a lightweight, deterministic router. If an incoming route is unknown, it must reject the request or throw an error immediately to prevent silent failures.
