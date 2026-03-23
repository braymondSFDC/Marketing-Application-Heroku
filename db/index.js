'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

/**
 * Execute a parameterized query.
 * @param {string} text  — SQL query with $1, $2, ... placeholders
 * @param {Array}  params — parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  if (duration > 500) {
    console.warn(`[DB] Slow query (${duration}ms):`, text.slice(0, 120));
  }

  return result;
}

/**
 * Get a client from the pool for transactions.
 */
async function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
