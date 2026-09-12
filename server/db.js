"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.pool = void 0;
var node_postgres_1 = require("drizzle-orm/node-postgres");
var pg_1 = require("pg");
var schema = require("./schema.js");
var dotenv_1 = require("dotenv");
dotenv_1.default.config();
var Pool = pg_1.default.Pool;
// Use Replit-provided DATABASE_URL or fallback to a standard local PostgreSQL address for local development.
var connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bountyrunner';
if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL environment variable is not set. Falling back to default local PostgreSQL URL:');
    console.warn("   ".concat(connectionString));
}
exports.pool = new Pool({
    connectionString: connectionString,
    // If running on Replit or Render/Heroku, they often require SSL for external database connections.
    ssl: process.env.DATABASE_URL && !connectionString.includes('localhost')
        ? { rejectUnauthorized: false }
        : false,
});
exports.db = (0, node_postgres_1.drizzle)(exports.pool, { schema: schema });
