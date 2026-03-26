'use strict';

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const fs = require('fs');
const { initializeWebSocket } = require('./src/websocket');
const db = require('./db');
const authRoutes = require('./src/api/routes/auth');
const journeyRoutes = require('./src/api/routes/journeys');
const nodeRoutes = require('./src/api/routes/nodes');
const launchRoutes = require('./src/api/routes/launch');
const fieldRoutes = require('./src/api/routes/fields');
const segmentRoutes = require('./src/api/routes/segments');
const webhookRoutes = require('./src/api/routes/webhooks');

const app = express();
const server = http.createServer(app);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(morgan('combined'));
app.use(compression());

// Helmet — standalone mode (no iframe embedding needed)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
        fontSrc: ["'self'", 'fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'wss:', 'ws:'],
      },
    },
  })
);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin and localhost in dev
      if (!origin || /localhost/.test(origin)) {
        cb(null, true);
      } else {
        cb(null, true); // Standalone mode — accept all origins
      }
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session — standalone mode
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Rate limiting — global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Auth routes (standalone session management)
app.use('/auth', authRoutes);

// REST API
app.use('/api/journeys', journeyRoutes);
app.use('/api/journeys', nodeRoutes);
app.use('/api/journeys', launchRoutes);
app.use('/api/fields', fieldRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check
app.get('/api/health', async (_req, res) => {
  let dbStatus = 'unknown';
  try {
    const result = await db.query('SELECT 1 as ok');
    dbStatus = result.rows[0]?.ok === 1 ? 'connected' : 'error';
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }
  res.json({ status: 'ok', timestamp: new Date().toISOString(), db: dbStatus });
});

// DB debug endpoint — check tables and migration status
app.get('/api/health/db', async (_req, res) => {
  try {
    const tables = await db.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    const migrations = await db.query('SELECT * FROM _migrations ORDER BY id').catch(() => ({ rows: [] }));
    res.json({
      tables: tables.rows.map(r => r.table_name),
      migrations: migrations.rows,
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Serve React SPA in production
// ---------------------------------------------------------------------------

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client', 'build')));

  // All non-API routes → React index.html
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) return;
    res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
  });
}

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message, err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ---------------------------------------------------------------------------
// Auto-migrate database on startup
// ---------------------------------------------------------------------------

async function runMigrations() {
  const client = await db.getClient();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get already-applied migrations
    const applied = await client.query('SELECT filename FROM _migrations ORDER BY id');
    const appliedSet = new Set(applied.rows.map((r) => r.filename));

    // Read migration files
    const migrationsDir = path.join(__dirname, 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[DB] ✓ Already applied: ${file}`);
        continue;
      }

      console.log(`[DB] ▶ Applying: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[DB] ✓ Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[DB] ✗ Failed: ${file}`, err.message);
        throw err;
      }
    }

    console.log('[DB] ✅ All migrations applied successfully.');
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Start server + WebSocket
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 3001;

const io = initializeWebSocket(server);
app.set('io', io);

// Start server immediately (Heroku requires binding to PORT quickly)
server.listen(PORT, () => {
  console.log(`🚀 Marketing Journey Builder running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Mode: Standalone`);

  // Run migrations in the background after server is listening
  runMigrations()
    .then(() => console.log('[DB] Migrations complete — app fully ready.'))
    .catch((err) => console.error('[DB] Migration failed:', err.message));
});

module.exports = { app, server };
