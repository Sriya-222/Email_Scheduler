# ReachInbox Cold Email Job Scheduler

A production-ready, restart-resilient full-stack cold email scheduler built with **React (Vite + TypeScript)** on the frontend and **Node.js (Express, Kysely, MySQL, Redis, BullMQ)** on the backend.

---

## 🚀 Quick Start

### 1. Prerequisites
Make sure you have [Docker Desktop](https://www.docker.com/products/docker-desktop/) and [Node.js (v18+)](https://nodejs.org/) installed on your machine.

### 2. Infrastructure Setup (MySQL & Redis)
In the `backend` directory, spin up the database and queue storage:
```bash
cd backend
docker-compose up -d
```
*Note: The Redis container is explicitly configured with `--appendonly yes` (AOF persistence) to ensure delayed jobs survive container restarts. MySQL data is saved on named volumes.*

### 3. Backend Setup
1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Create and fill `.env` (a template is available in `.env.example`). If you do not provide `SMTP_USER` and `SMTP_PASS`, the backend will **automatically generate** a test Ethereal SMTP account on startup and print the credentials to the console for you.
3. Start the dev server:
   ```bash
   npm run dev
   ```
   *Note: On startup, the server automatically reads `src/db/schema.sql` and loads the table structure if not present. It then executes the reconciliation service.*

### 4. Frontend Setup
1. Create a Google Cloud Console project, set up OAuth Web Credentials, and add `http://localhost:5173` as an Authorized Origin.
2. Install dependencies:
   ```bash
   cd ../frontend
   npm install
   ```
3. Create a `.env` file in the `frontend` folder containing your client ID:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```
4. Start the frontend dev server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🏗️ Architectural Overview

```
React (Vite) --HTTP--> Express API --insert--> MySQL (source of truth)
                             |
                             +--enqueue (delayed job, jobId=email.id)--> BullMQ Queue (Redis)
                                                                              |
                                                                    Worker pool picks up job
                                                                              |
                                                              check Redis hour-bucket counter
                                                                    | under limit      | over limit
                                                                    v                  v
                                                        send via Ethereal SMTP   moveToDelayed -> next hour
                                                                    |
                                                              update MySQL status
```

### 1. Idempotency & Deduplication
- **MySQL is the single source of truth.** When a campaign is submitted, all individual emails are staged in MySQL first in a single transaction with a status of `scheduled`.
- The `emails.id` (UUID) is used directly as the BullMQ `jobId`. BullMQ guarantees that only one job with a given `jobId` can exist in the queue at any time. Any concurrent or retry requests to schedule the same email will be discarded at the queue layer, preventing double-sends structurally.
- A secondary database-level check is performed in the worker: if the email status is already marked as `sent`, the job terminates immediately without sending.

### 2. Redis-Backed Atomic Throttling
- Hourly limits are tracked per sender in Redis using the key structure `rate:{senderId}:{YYYY-MM-DDTHH}`.
- To handle concurrent worker threads safely, we check limits using atomic Redis `INCR` + `EXPIRE` transactions. 
- If the incremented value exceeds the sender's hourly quota, the worker immediately decrements the counter (to avoid artificial inflation) and transitions the email state in MySQL to `rescheduled`. The BullMQ job is then programmatically moved back to the delayed status set to trigger at the beginning of the next hour boundary.

### 3. Restart-Safety & Reconciliation
- On server startup, `reconcilePendingEmails()` is executed. It scans the MySQL database for any records in `scheduled`, `processing`, or `rescheduled` states.
- It queries Redis for each active job. If a job is missing (e.g., Redis memory was cleared, or the server crashed before the job was enqueued), it is immediately re-added to BullMQ with the correct remaining delay calculated from its database `scheduled_at`.
- Stalled jobs that crashed in the middle of execution are automatically handled by BullMQ's built-in stalled-job detection and will be retried automatically.

---

## 🛠️ Verification & Testing

To test the queue and atomic rate-limiting logic in isolation:
1. Ensure your Docker containers are running.
2. Run the integration test suite in the `backend` folder:
   ```bash
   cd backend
   npm run test:integration
   ```
This integration test script creates a mock sender with an hourly limit of 2 emails, schedules a campaign for 4 recipients, and asserts that exactly 2 emails are sent immediately while the remaining 2 are correctly transitioned to `rescheduled` and delayed to the next hour.

---

## 📋 Feature Checklist Mapping

### Backend Requirements
- [x] **Job Scheduler**: BullMQ configuration with delayed jobs staggered sequentially based on campaigns delays. See [emailQueue.ts](file:///c:/Users/golla/OneDrive/Tài liệu/ReachInBox.ai/backend/src/queue/emailQueue.ts).
- [x] **Restart-Safety & Persistence**: Named Docker volumes, Redis AOF logs, and startup database scans. See [reconcile.ts](file:///c:/Users/golla/OneDrive/Tài liệu/ReachInBox.ai/backend/src/queue/reconcile.ts).
- [x] **Idempotency**: UUID binding at queue layer. See [emailWorker.ts](file:///c:/Users/golla/OneDrive/Tài liệu/ReachInBox.ai/backend/src/queue/emailWorker.ts).
- [x] **Rate Limiting**: Multi-worker safe Redis hourly caps. See [rateLimiter.ts](file:///c:/Users/golla/OneDrive/Tài liệu/ReachInBox.ai/backend/src/queue/rateLimiter.ts).
- [x] **Concurrency**: Configurable parallel workers using `WORKER_CONCURRENCY` env vars.

### Frontend Requirements
- [x] **Google Login**: Real client authentication via `@react-oauth/google` verified server-side. See [Login.tsx](file:///c:/Users/golla/OneDrive/Tài liệu/ReachInBox.ai/frontend/src/pages/Login.tsx).
- [x] **Dashboard**: Real-time statistics counters, auto-polling data sync every 5 seconds, and styled tab switches. See [Dashboard.tsx](file:///c:/Users/golla/OneDrive/Tài liệu/ReachInBox.ai/frontend/src/pages/Dashboard.tsx).
- [x] **Compose Campaign**: Forms supporting multi-lead CSV/TXT uploads, dynamic delay, and sender dropdowns. See [ComposeModal.tsx](file:///c:/Users/golla/OneDrive/Tài liệu/ReachInBox.ai/frontend/src/features/compose/ComposeModal.tsx).
- [x] **Tables**: Reusable paginated `Table` component displaying detailed send attempts and failure notices. See [Table.tsx](file:///c:/Users/golla/OneDrive/Tài liệu/ReachInBox.ai/frontend/src/components/ui/Table.tsx).

---

## ⚙️ Assumptions & Trade-offs
- **Worker Process Placement**: For ease of deployment, testing, and evaluation, the BullMQ worker runs in-process with the Express API. In a large production deployment, the workers would be compiled and deployed on dedicated background instances separate from the HTTP web-facing server.
- **Ethereal Mail Accounts**: To make evaluation seamless, when SMTP credentials are left empty, the server automatically generates test credentials. These links are printed directly to the server log on startup.
- **Google OAuth**: A valid client ID must be configured in `frontend/.env` to login. If not configured, the login screen displays a helpful configuration prompt rather than throwing errors.
