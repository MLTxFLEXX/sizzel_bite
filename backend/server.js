// server.js — SizzleBite Express Backend Entry Point
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const menuRoutes    = require('./routes/menu');
const orderRoutes   = require('./routes/orders');
const serviceRoutes = require('./routes/services');

const app  = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

// ─── Middleware ──────────────────────────────────────────────────────────────

// CORS: Allow the frontend dev server (Live Server, etc.)
// FRONTEND_URL can hold one or more additional origins, comma-separated
// (e.g. your production Vercel URL).
const allowedOrigins = [
  ...(process.env.FRONTEND_URL || 'http://localhost:5500')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  // Null origin covers file:// opened directly in browser
  'null'
];

// Deployed frontends are hosted on *.vercel.app (covers the production
// domain and every preview deployment subdomain).
const allowedOriginPatterns = [ /^https?:\/\/[a-z0-9-]+\.vercel\.app$/i ];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, server-to-server) or matching allowed origins
    const ok = !origin 
      || allowedOrigins.includes(origin) 
      || allowedOriginPatterns.some(p => p.test(origin));
    if (ok) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));

// Request logger (dev-friendly)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── Static Serving (optional) ───────────────────────────────────────────────
// Uncomment to serve the frontend from Express directly:
// app.use(express.static(path.join(__dirname, '..')));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/menu',     menuRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/services', serviceRoutes);

// Health-check endpoint
app.get('/api/health', async (_req, res) => {
  try {
    const { sql } = require('./db/client');
    await sql`SELECT 1`;
    res.json({
      status:    'ok',
      database:  'connected',
      timestamp: new Date().toISOString(),
      version:   '1.0.0'
    });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n🔥 SizzleBite Backend running!');
  console.log(`   ➜  http://localhost:${PORT}/api/health`);
  console.log(`   ➜  http://localhost:${PORT}/api/menu`);
  console.log(`   ➜  http://localhost:${PORT}/api/orders`);
  console.log(`   ➜  http://localhost:${PORT}/api/services\n`);
});

module.exports = app;
