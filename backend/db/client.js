// db/client.js — Neon PostgreSQL connection pool
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill in your Neon credentials.');
  process.exit(1);
}

// Neon's serverless driver — works great with Node.js too
const sql = neon(process.env.DATABASE_URL);

module.exports = { sql };
