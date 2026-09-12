import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import * as schema from './schema.js';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Use Replit-provided DATABASE_URL or fallback to a standard local PostgreSQL address for local development.
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bountyrunner';

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL environment variable is not set. Falling back to default local PostgreSQL URL:');
  console.warn(`   ${connectionString}`);
}

export const pool = new Pool({
  connectionString,
  // If running on Replit or Render/Heroku, they often require SSL for external database connections.
  ssl: process.env.DATABASE_URL && !connectionString.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

export const db = drizzle(pool, { schema });
