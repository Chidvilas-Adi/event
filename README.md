# VENTURE CITY (OS v0.1 - Phase 1)
> **Build. Trade. Survive. Scale.**  
> The operating system for an 8-hour live startup economy simulation at PES University.

---

## 1. Quick Start Setup (Under 10 Steps)

1. **Clone & enter repository:**
   ```bash
   cd venture-city
   ```

2. **Verify Node & Docker prerequisites:**
   - Node.js `v20+` (tested on `v26`)
   - Docker & Docker Compose (or existing PostgreSQL 16)

3. **Start PostgreSQL database:**
   ```bash
   docker compose up -d
   ```
   *Database will be accessible at `localhost:5432` (`postgres:postgres`).*

4. **Install dependencies:**
   ```bash
   npm install
   ```

5. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

6. **Run database migration and seed in one command:**
   ```bash
   npm run setup
   ```
   *Creates all relational tables, RLS append-only triggers, views, and seeds 7 companies, 8 institutions, 100 citizens, operators, and initial ledger balances.*

7. **Execute automated tests (CI check):**
   ```bash
   npm run check
   ```

8. **Start local development server:**
   ```bash
   npm run dev
   ```
   *Open [http://localhost:3000](http://localhost:3000) in your browser.*

---

## 2. Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@localhost:5432/venturecity` |
| `JWT_SECRET` | Secret key for signing session tokens (min 32 chars) | `venture_city_super_secret_jwt_key_2026_at_least_32_characters_long` |
| `EVENT_CODE` | Participant global event entry code | `VC2026` |
| `PORT` | Web server port | `3000` |
| `NEXT_PUBLIC_APP_URL`| Base application URL | `http://localhost:3000` |

---

## 3. Database Commands

- **Run migrations only:**
  ```bash
  npm run migrate
  ```
- **Run seed data only:**
  ```bash
  npm run seed
  ```
- **Full reset and seed (one command):**
  ```bash
  npm run setup
  ```

---

## 4. Test Suite Execution

Run the complete test suite (20 tests covering balance maths, overspend rejection, idempotency, 50-transfer concurrency, role-based access matrix, database triggers, freeze state, and seed reconciliation):

```bash
npm test
```

Or run CI checks (linting + tests):
```bash
npm run check
```

---

## 5. Evaluation & Demo Logins

### A. Citizens (Mobile-First Portal at `/portal`)
- **Login:** Citizen Code + Event Code (`VC2026`)
- **Presets available on login screen:**
  - Citizen `VC-001` (Aether Dynamics Founder) · Starting Balance: 500 VB
  - Citizen `VC-014` (Kavach Defense Member) · Starting Balance: 500 VB
  - Citizen `VC-095` (Independent Free Agent) · Starting Balance: 500 VB

### B. Operators (Game Master & Staff Console at `/gm`)
- **Login:** Username + Password + MFA Code
- **Game Master (GM):**
  - Username: `gm`
  - Password: `gm-password-2026`
  - Elevated Code: `000000`
- **Tech Admin:**
  - Username: `admin`
  - Password: `admin-password-2026`
  - Elevated Code: `111111`
- **Bank Volunteer:**
  - Username: `volunteer_bank`
  - Password: `bank-volunteer-2026`
  - Code: *(blank)*

---

## 6. Architecture & Hard Security Invariants

1. **Calculated Balances Only:**
   - No table contains an editable `balance` column.
   - All balances are dynamically calculated on the server from `ledger_entries` (sum of credits minus sum of debits) and the database view `v_entity_balances`.
2. **Database Engine Append-Only Enforcement:**
   - PostgreSQL triggers `trg_ledger_entries_append_only` and `trg_audit_log_append_only` strictly block all SQL `UPDATE` and `DELETE` commands at the engine level.
3. **Counterparty Confirmation Deal Pipeline:**
   - Transfers between citizens create a pending transaction in `transactions`. The recipient must review and click "Accept" in `/portal/inbox` before funds are atomically committed.
4. **Advisory Transaction Locks:**
   - Transfers use `pg_advisory_xact_lock(hashtext(sender_id))` to serialize debit operations and prevent overdraft even under high concurrency.
5. **Freeze State Lock:**
   - When the GM triggers `freeze`, all non-GM transactions and writes are rejected.
6. **Field-Level Serialization Layer:**
   - Non-GM users have private data (cap tables, other citizens' wallets, secret missions, GM notes) stripped before responses are serialized.
