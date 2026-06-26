# docs/LOCKING.md - Distributed Locking & Re-entrancy Specification

## 1. Overview
OCPI (Open Charge Point Interface) is heavily reliant on asynchronous webhooks. Examples of concurrent events include:
- Multiple quick status updates for a single Charge Point/EVSE.
- Simultaneous session update webhooks (e.g. metering updates) received close together.
- A CDR (Charge Detail Record) update and a Session closure webhook arriving at the same time.

Without synchronization, concurrent webhook requests routed to downstream agents (e.g., `BillingAgent`, `TopologyAgent`) can trigger race conditions in database transactions, resulting in double billing, corrupted states, or database write conflicts.

To protect resource state consistency, the OCPI HUB implements a **Redis-based Distributed Locking** mechanism.

---

## 2. Distributed Lock Design

The system utilizes Redis to coordinate lock acquisition across all running Hub instances.

### 2.1 Lock Key Format
Lock keys must be structured uniformly using colon separators:
```
lock:{module_name}:{unique_resource_identifier}
```

#### Examples:
- **Session Billing**: `lock:billing:session_TW-NPT-E1002-S1`
- **EVSE Status Synchronization**: `lock:topology:evse_TW-NPT-E1002`

### 2.2 Lock Parameters & Constraints
- **Acquisition Algorithm**: Redis `SET key value NX PX ttl` is used for single Redis instances. For cluster modes, standard Redlock is applied.
- **Lock Value**: A cryptographically secure random token (e.g., UUID) unique to the request thread, allowing safe release (preventing a thread from accidentally releasing a lock held by another thread).
- **TTL (Time to Live)**: Default to `5000ms` (5 seconds). This duration prevents deadlocks if a server process crashes, while leaving plenty of time for typical database operations (which should complete in under 500ms).

---

## 3. Core Use Cases

### 3.1 BillingAgent - Session Calculations & CDR Processing
- **Trigger**: Incoming `PUT /ocpi/2.2.1/sessions/:country_code/:party_id/:session_id` or `POST /ocpi/2.2.1/cdrs`.
- **Key**: `lock:billing:session_{session_id}`
- **Behavior**:
  1. The `BillingAgent` attempts to acquire the lock using the `session_id`.
  2. If successful, it performs energy calculations, updates the database, and releases the lock.
  3. If locked, the request is retried (see backoff rules below).

### 3.2 TopologyAgent - EVSE Status Updates
- **Trigger**: Incoming `PATCH /ocpi/2.2.1/locations/:country_code/:party_id/:location_id/:evse_uid`.
- **Key**: `lock:topology:evse_{evse_uid}`
- **Behavior**:
  1. Prevents out-of-order execution of EVSE status changes.
  2. Guarantees that write operations to the database for a specific charger run sequentially.

---

## 4. Retry Policy & Re-entrancy Protection

### 4.1 Exponential Backoff Retry
When a thread fails to acquire a lock (because another instance/request is currently holding it), it must not fail immediately. It will execute a retry loop:
- **Max Retries**: 3
- **Wait Intervals**:
  - 1st Retry: Wait `100ms`
  - 2nd Retry: Wait `250ms`
  - 3rd Retry: Wait `500ms`
- **Failure Handling**: If the lock cannot be acquired after all retries, the system must abort the transaction and throw an error. In OCPI, this translates to returning an OCPI JSON response with status code `3000` (Generic Client/Server Error) to invite the remote sender to retry the webhook later.

### 4.2 Re-entrancy Protection
- Downstream sub-agents must execute tasks in a single database transaction context per lock wherever possible.
- If a sub-agent calls another function that requires the same resource lock, it must verify if it already holds the lock by checking the unique thread-level lock token before attempting to re-lock. This avoids self-deadlocks.
