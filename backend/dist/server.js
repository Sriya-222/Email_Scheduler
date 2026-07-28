"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const db_1 = require("./config/db");
const reconcile_1 = require("./queue/reconcile");
// Import the worker to start the BullMQ worker process in-process 
require("./queue/emailWorker");
async function startServer() {
    try {
        console.log('Initializing database connection...');
        await (0, db_1.initializeDatabase)();
        console.log('Running startup reconciliation check...');
        await (0, reconcile_1.reconcilePendingEmails)();
        app_1.default.listen(env_1.env.PORT, () => {
            console.log(`Server successfully started on port ${env_1.env.PORT} in ${env_1.env.NODE_ENV} mode.`);
        });
    }
    catch (error) {
        console.error('Critical failure starting server:', error);
        process.exit(1);
    }
}
startServer();
