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
  connectionLimit: 10,
  ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
});
export const db = new Kysely<Database>({
  dialect: new MysqlDialect({ pool: pool as any }),
});
export async function initializeDatabase() {
  try {
    // Test if the schema already exists
    await sql`SELECT 1 FROM senders LIMIT 1`.execute(db);
    console.log('Database tables verified.');
  } catch (error: any) {
    console.log('Database tables not found. Executing schema.sql...');
    try {
      // Try multiple possible locations for the schema file
      const candidates = [
        path.resolve(process.cwd(), 'src/db/schema.sql'),
        path.resolve(__dirname, '../../src/db/schema.sql'),
        path.resolve(__dirname, '../db/schema.sql'),
      ];
      const schemaPath = candidates.find(p => fs.existsSync(p)) || candidates[0];
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      
      // Clean and split schema SQL statements
      const queries = schemaSql
        .split(';')
        .map(q => q.trim())
        .filter(q => q.length > 0);
        
      for (const query of queries) {
        await sql.raw(query).execute(db);
      }
      console.log('Database schema loaded successfully.');
    } catch (schemaError) {
      console.error('Database schema loading failed:', schemaError);
      throw schemaError;
    }
  }
}