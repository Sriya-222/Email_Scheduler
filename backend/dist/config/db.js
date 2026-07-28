"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.initializeDatabase = initializeDatabase;
const kysely_1 = require("kysely");
const mysql2_1 = require("mysql2");
const env_1 = require("./env");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pool = (0, mysql2_1.createPool)({
    host: env_1.env.DB_HOST,
    port: env_1.env.DB_PORT,
    user: env_1.env.DB_USER,
    password: env_1.env.DB_PASSWORD,
    database: env_1.env.DB_NAME,
    connectionLimit: 10,
});
exports.db = new kysely_1.Kysely({
    dialect: new kysely_1.MysqlDialect({ pool: pool }),
});
async function initializeDatabase() {
    try {
        // Test if the schema already exists
        await (0, kysely_1.sql) `SELECT 1 FROM senders LIMIT 1`.execute(exports.db);
        console.log('Database tables verified.');
    }
    catch (error) {
        console.log('Database tables not found. Executing schema.sql...');
        try {
            const schemaPath = path_1.default.resolve(__dirname, '../db/schema.sql');
            const schemaSql = fs_1.default.readFileSync(schemaPath, 'utf8');
            // Clean and split schema SQL statements
            const queries = schemaSql
                .split(';')
                .map(q => q.trim())
                .filter(q => q.length > 0);
            for (const query of queries) {
                await kysely_1.sql.raw(query).execute(exports.db);
            }
            console.log('Database schema loaded successfully.');
        }
        catch (schemaError) {
            console.error('Database schema loading failed:', schemaError);
            throw schemaError;
        }
    }
}
