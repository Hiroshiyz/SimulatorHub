# docs/ERRORS.md - Error Handling & HTTP Status Code Mapping

## 1. Overview
The OCPI (Open Charge Point Interface) protocol requires a custom response wrap mechanism that differs significantly from standard RESTful services. In OCPI, standard HTTP transport errors (e.g., HTTP 400, 401, 404, 500) **must not** return standard HTTP error pages or basic JSON error bodies.

Instead, almost all OCPI responses must return **HTTP 200 OK** (or **201 Created**), and details regarding business success or failure must be encoded inside the JSON payload using standard status codes defined by the OCPI standard.

This document specifies how downstream exceptions are caught, mapped, and formatted before being sent to external clients (CPOs/EMSPs).

---

## 2. Standard OCPI Response Envelope

Every response returned by the OCPI HUB must conform to the following JSON structure:

```json
{
  "status_code": 1000,
  "status_message": "Success",
  "timestamp": "2026-06-18T10:42:00Z",
  "data": { ... }
}
```

### Response Fields:
- **`status_code`** (Integer): The OCPI-specific business status code.
- **`status_message`** (String): A short, human-readable description of the status.
- **`timestamp`** (String): ISO 8601 representation of the server time when the response was generated.
- **`data`** (Object/Array): The actual business data payload (only present when `status_code` is `1000`).

---

## 3. Global Exception Filter (Outer Layer Responsibility)

To maintain a clean separation of concerns, individual sub-agents (e.g., `CommandsAgent`, `BillingAgent`) are **not** responsible for wrapping error messages. Sub-agents simply throw standard NestJS exceptions (e.g., `NotFoundException`, `BadRequestException`) or custom domain errors.

A **Global Exception Filter** (e.g., `OcpiExceptionFilter`) must be registered at the entry-point/middleware level of the NestJS application (surrounding the `Orchestrator`) to catch all exceptions and format them into standard OCPI JSON envelopes before they leave the server.

---

## 4. HTTP-to-OCPI Status Code Mapping Table

The Global Exception Filter interceptor translates standard HTTP/NestJS exceptions into the appropriate OCPI business status codes:

| HTTP Status | NestJS Exception | OCPI `status_code` | Description / Example Use Case |
| :--- | :--- | :--- | :--- |
| **200/201** | *None* | **1000** | Success. |
| **400** | `BadRequestException` | **2001** | Invalid or missing parameters (e.g., invalid JSON format). |
| **401** | `UnauthorizedException` | **2002** | Security credentials / API Token is missing or invalid. |
| **403** | `ForbiddenException` | **2002** | Token is valid, but the client does not have permissions for the resource. |
| **404** | `NotFoundException` | **2003** | Unknown endpoint or the requested object (e.g. Session, EVSE) does not exist. |
| **429** | `HttpException` (Too Many Requests)| **3000** | Client rate limit exceeded. |
| **500** | `InternalServerErrorException` | **3000** | Generic server/database error. |
| **501** | `NotImplementedException` | **3000** | Unsupported OCPI module or method. |

### Example Exception Mappings:

#### Scenario A: Invalid Token Provided by CPO
- **Action**: CPO calls versions endpoint with an invalid token.
- **Exception thrown by guard**: `UnauthorizedException("Invalid Token")`
- **Output response (HTTP 200 OK)**:
```json
{
  "status_code": 2002,
  "status_message": "Invalid Token",
  "timestamp": "2026-06-18T10:43:00Z"
}
```

#### Scenario B: Downstream Database Timeout
- **Action**: `BillingAgent` database query fails.
- **Exception thrown**: `PrismaClientKnownRequestError` / `InternalServerErrorException`
- **Output response (HTTP 200 OK)**:
```json
{
  "status_code": 3000,
  "status_message": "Internal Server Error - Database Timeout",
  "timestamp": "2026-06-18T10:43:05Z"
}
```
