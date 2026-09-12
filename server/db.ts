import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import * as schema from './schema.js';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Use Replit or Vercel provided connection string or fallback to local PostgreSQL
const connectionString =
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/bountyrunner';

const hasDbEnv = !!(
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_PRISMA_URL
);

if (!hasDbEnv) {
  console.warn('⚠️  DATABASE_URL / POSTGRES_URL environment variable is not set. Falling back to default local PostgreSQL URL:');
  console.warn(`   ${connectionString}`);
}

export const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 4000,
  // If running on Vercel, Replit, or Render, SSL is required for external database connections.
  ssl: hasDbEnv && !connectionString.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

export const db = drizzle(pool, { schema });
