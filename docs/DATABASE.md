# docs/DATABASE.md - Database Migrations & Seed Data Management

## 1. Overview
The OCPI HUB utilizes **Prisma ORM** for database schema design, migration, and data seeding. Since the system is designed to run in multiple environments—including local developer environments, GitHub Actions CI runners, and isolated PR Preview environments—database migrations and reference seed data must be automated, predictable, and idempotent.

---

## 2. Database Migrations

### 2.1 Schema Definition
All database tables, constraints, indexes, and relations are declared in [schema.prisma](file:///home/theodore/project/mock-hub/prisma/schema.prisma).

### 2.2 Local Development Migrations
Developers must use Prisma CLI's development flow to apply changes and auto-generate SQL migration scripts:
```bash
# Generate and apply new migrations locally
npx prisma migrate dev --name <migration_name>
```

### 2.3 Runtime & Container Deployments
In containerized and production-like simulated environments (e.g. docker-compose, Kubernetes, PR Preview deployments), developers **must not** run interactive commands. Instead, use the non-interactive Prisma engine deploy command:
```bash
# Apply pending migrations in a production-safe manner
npx prisma migrate deploy
```
This is configured to run automatically as the first step of the Docker container startup process.

---

## 3. Seed Data Specification

The mock-hub requires pre-configured reference data to function. Without this seed data, the OCPI simulator and EMSP/CPO client nodes will immediately fail handshakes due to missing tenants or invalid API keys.

### 3.1 Seeding Tooling
The seeding logic is located in [seed.js](file:///home/theodore/project/mock-hub/prisma/seed.js).
It is defined in [package.json](file:///home/theodore/project/mock-hub/package.json) under the `"prisma"` configuration block:
```json
  "prisma": {
    "seed": "node prisma/seed.js"
  }
```

### 3.2 Idempotency Rules
Because seeding runs automatically on every container spin-up, the script **must be fully idempotent**.
- **Rule**: Never use Prisma's `create` method directly for seed entities unless checking if they exist first.
- **Implementation**: Use Prisma's `upsert` command to define the unique lookup condition, the `update` block (if entity exists), and the `create` block (if entity does not exist).

### 3.3 Seed Entities
The seed script populates:
1. **Parties (Tenants)**:
   - A mock CPO party (`TW*CPO`)
   - A mock EMSP party (`TW*EMSP`)
2. **Credentials (API Tokens)**:
   - Sets Token B (incoming client-side token) and Token C (outgoing server-side token) for credentials validation.
   - Sets default redirection endpoints (e.g. EMSP URL targeting `http://localhost:5053`).

---

## 4. Automation Flow in Containers

To ensure a functional system upon launch, the Docker container combines migration and seeding into its final command line:

```dockerfile
# Dockerfile CMD sequence
CMD ["sh", "-c", "prisma migrate deploy && node prisma/seed.js && node dist/main.js"]
```

When Docker Compose spins up the `mock-hub` container:
1. The postgres healthcheck blocks startup until the database is ready.
2. The `mock-hub` container launches.
3. `prisma migrate deploy` runs to execute any new schema migrations.
4. `node prisma/seed.js` runs to insert or update the static lookup records.
5. The NestJS application server starts serving request traffic.
