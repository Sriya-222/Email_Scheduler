import { Kysely, MysqlDialect, sql } from 'kysely';
import { createPool } from 'mysql2';
import { env } from './env';
import { Database } from '../types';
import fs from 'fs';
import path from 'path';

// Cloud databases like Aiven require SSL; local/docker hosts do not
const isLocalDb = ['localhost', '127.0.0.1', 'mysql'].includes(env.DB_HOST);

const pool = createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: 5,
  connectTimeout: 15_000,        // Fail fast on DNS/network errors (ms)
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});

export const db = new Kysely<Database>({
  dialect: new MysqlDialect({ pool: pool as any }),
});

/**
 * Resolve the schema.sql file at runtime across all environments:
 *   - Local dev (ts-node):         src/config/  → ../../src/db/
 *   - Docker prod (compiled):      dist/config/ → /app/src/db/schema.sql
 *   - process.cwd() = /app always in Docker
 */
function resolveSchemaPath(): string {
  const candidates = [
    // Works in Docker: /app/src/db/schema.sql (copied by Dockerfile)
    path.resolve(process.cwd(), 'src/db/schema.sql'),
    // Works in ts-node dev: relative to this source file
    path.resolve(__dirname, '../../src/db/schema.sql'),
    // Compiled dist layout: dist/config → ../../src/db
    path.resolve(__dirname, '../db/schema.sql'),
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) {
    throw new Error(
      `schema.sql not found. Tried:\n${candidates.join('\n')}`
    );
  }
  return found;
}

export async function initializeDatabase() {
  // Test connection and schema presence
  try {
    await sql`SELECT 1 FROM senders LIMIT 1`.execute(db);
    console.log('Database tables verified.');
  } catch {
    console.log('Database tables not found. Executing schema.sql...');
    const schemaPath = resolveSchemaPath();
    console.log(`Loading schema from: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    const queries = schemaSql
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.startsWith('--'));

    for (const query of queries) {
      await sql.raw(query).execute(db);
    }
    console.log('Database schema loaded successfully.');
  }
}