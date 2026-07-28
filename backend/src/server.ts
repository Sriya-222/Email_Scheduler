import app from './app'; 
import { env } from './config/env'; 
import { initializeDatabase } from './config/db'; 
import { reconcilePendingEmails } from './queue/reconcile'; 
// Import the worker to start the BullMQ worker process in-process 
import './queue/emailWorker'; 
async function startServer() { 
  try { 
    console.log('Initializing database connection...'); 
    await initializeDatabase(); 
    console.log('Running startup reconciliation check...'); 
    await reconcilePendingEmails(); 
    app.listen(env.PORT, () => { 
      console.log(`Server successfully started on port ${env.PORT} in ${env.NODE_ENV} mode.`); 
    }); 
  } catch (error) { 
    console.error('Critical failure starting server:', error); 
      process.exit(1); 
    } 
  } 
startServer();