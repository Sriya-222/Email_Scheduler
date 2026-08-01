import app from './app';
import { env } from './config/env';
import { initializeDatabase } from './config/db';
import { reconcilePendingEmails } from './queue/reconcile';
// Import the worker to start the BullMQ worker process in-process
import './queue/emailWorker';

const MAX_DB_RETRIES = 10;
const DB_RETRY_DELAY_MS = 5000;

async function connectDatabaseWithRetry(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_DB_RETRIES; attempt++) {
    try {
      console.log(`[DB] Connection attempt ${attempt}/${MAX_DB_RETRIES}...`);
      await initializeDatabase();
      console.log('[DB] Connected and schema verified.');
      return;
    } catch (err: any) {
      console.error(`[DB] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_DB_RETRIES) {
        console.log(`[DB] Retrying in ${DB_RETRY_DELAY_MS / 1000}s...`);
        await new Promise(r => setTimeout(r, DB_RETRY_DELAY_MS));
      }
    }
  }
  throw new Error(`[DB] Could not connect after ${MAX_DB_RETRIES} attempts. Aborting.`);
}

async function startServer() {
  // Always bind the port first so Render health-checks pass immediately
  const server = app.listen(env.PORT, () => {
    console.log(`Server listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  try {
    await connectDatabaseWithRetry();
    console.log('[Startup] Running reconciliation check...');
    await reconcilePendingEmails();
    console.log('[Startup] Ready. All systems operational.');
  } catch (error: any) {
    console.error('[Startup] Database initialization failed — server is running but emails cannot be processed:', error.message);
    // Do NOT exit — keep the server alive so Render does not mark it as crashed.
    // The /health endpoint still responds; fix your DB env vars and redeploy.
  }
}

startServer();