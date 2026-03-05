// server.js – Node.js backend using pg (node-postgres)

'use strict';

require('dotenv').config();

const http   = require('http');
const url    = require('url');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { Pool } = require('pg');

// ------------------------------------------------------------
// Structured server logger
// ------------------------------------------------------------
function serverLog(level, context, message, detail) {
  const ts  = new Date().toISOString();
  const det = detail ? ` | ${detail}` : '';
  const line = `[${ts}] [${level.toUpperCase().padEnd(5)}] [${context}] ${message}${det}`;
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

// ------------------------------------------------------------
// PostgreSQL error-code mapping
// ------------------------------------------------------------
/**
 * Maps a pg Error to a structured { status, error, detail } response.
 * Covers connection errors, constraint violations, and common server codes.
 */
function mapDbError(e) {
  // Node.js / pg driver-level codes (not SQL state codes)
  if (e.code === 'ECONNREFUSED') {
    serverLog('error', 'db', 'Database connection refused.', e.message);
    return { status: 503, error: 'db_connection_refused',
      detail: 'The database server is not accepting connections. Please check if PostgreSQL is running.' };
  }
  if (e.code === 'ETIMEDOUT' || e.code === 'ECONNRESET') {
    serverLog('error', 'db', 'Database connection timed out or was reset.', e.message);
    return { status: 503, error: 'db_timeout',
      detail: 'The database connection timed out. The server may be overloaded.' };
  }
  if (e.code === 'ENOTFOUND') {
    serverLog('error', 'db', 'Database host not found.', e.message);
    return { status: 503, error: 'db_host_not_found',
      detail: 'The database host could not be resolved. Check your DATABASE_URL configuration.' };
  }

  // PostgreSQL SQLSTATE error codes
  switch (e.code) {
    // Integrity / constraint violations
    case '23505':
      serverLog('warn', 'db', 'Unique constraint violation.', e.detail);
      return { status: 409, error: 'user_exists',
        detail: 'A record with this value already exists (unique constraint violated).' };
    case '23502':
      serverLog('warn', 'db', 'Not-null constraint violation.', e.detail);
      return { status: 400, error: 'missing_fields',
        detail: `A required column is NULL: ${e.column || 'unknown'}.` };
    case '23503':
      serverLog('warn', 'db', 'Foreign key constraint violation.', e.detail);
      return { status: 400, error: 'invalid_reference',
        detail: 'A referenced record does not exist (foreign key violation).' };
    case '23514':
      serverLog('warn', 'db', 'Check constraint violation.', e.detail);
      return { status: 400, error: 'constraint_violation',
        detail: 'The provided value violates a database check constraint.' };

    // Schema / object errors
    case '42P01':
      serverLog('error', 'db', 'Undefined table.', e.message);
      return { status: 500, error: 'db_schema_error',
        detail: 'A required database table does not exist. Run database migrations.' };
    case '42703':
      serverLog('error', 'db', 'Undefined column.', e.message);
      return { status: 500, error: 'db_schema_error',
        detail: 'A required database column does not exist. Check your schema.' };
    case '42P02':
      serverLog('error', 'db', 'Undefined parameter in query.', e.message);
      return { status: 500, error: 'db_query_error',
        detail: 'An undefined query parameter was referenced.' };

    // Connection / authentication errors
    case '08006':
      serverLog('error', 'db', 'Database connection failure.', e.message);
      return { status: 503, error: 'db_connection_failure',
        detail: 'The database connection was lost unexpectedly.' };
    case '08003':
      serverLog('error', 'db', 'Connection does not exist.', e.message);
      return { status: 503, error: 'db_no_connection',
        detail: 'No active database connection is available.' };
    case '08001':
      serverLog('error', 'db', 'Unable to establish SQL connection.', e.message);
      return { status: 503, error: 'db_connection_refused',
        detail: 'Could not establish a connection to the database server.' };
    case '28000':
    case '28P01':
      serverLog('error', 'db', 'Invalid database authorization.', e.message);
      return { status: 503, error: 'db_auth_failed',
        detail: 'Database authentication failed. Check your DATABASE_URL credentials.' };
    case '3D000':
      serverLog('error', 'db', 'Invalid catalog (database) name.', e.message);
      return { status: 503, error: 'db_not_found',
        detail: 'The specified database does not exist. Check your DATABASE_URL.' };

    // Resource / capacity errors
    case '53300':
      serverLog('error', 'db', 'Too many database connections.', e.message);
      return { status: 503, error: 'db_too_many_connections',
        detail: 'The database has reached its maximum connection limit.' };
    case '53200':
      serverLog('error', 'db', 'Out of memory.', e.message);
      return { status: 503, error: 'db_out_of_memory',
        detail: 'The database server ran out of memory.' };
    case '53100':
      serverLog('error', 'db', 'Disk full.', e.message);
      return { status: 503, error: 'db_disk_full',
        detail: 'The database disk is full.' };

    // Transaction errors
    case '40001':
      serverLog('warn', 'db', 'Serialization failure / deadlock detected.', e.message);
      return { status: 503, error: 'db_serialization_failure',
        detail: 'A transaction conflict occurred. Please retry the request.' };
    case '40P01':
      serverLog('warn', 'db', 'Deadlock detected.', e.message);
      return { status: 503, error: 'db_deadlock',
        detail: 'A database deadlock was detected. Please retry the request.' };

    // Query cancellation / timeout
    case '57014':
      serverLog('warn', 'db', 'Query was cancelled (timeout or user cancel).', e.message);
      return { status: 503, error: 'db_query_cancelled',
        detail: 'The database query was cancelled, possibly due to a timeout.' };

    // Syntax / programming errors (should not reach production)
    case '42601':
      serverLog('error', 'db', 'SQL syntax error.', e.message);
      return { status: 500, error: 'db_syntax_error',
        detail: 'A SQL syntax error occurred. This is a server-side bug.' };
    case '42883':
      serverLog('error', 'db', 'Undefined function.', e.message);
      return { status: 500, error: 'db_query_error',
        detail: 'A SQL function referenced in the query does not exist.' };

    default:
      serverLog('error', 'db', `Unhandled database error (code: ${e.code || 'none'}).`, e.message);
      return { status: 500, error: 'db_error', detail: e.message };
  }
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
/**
 * Returns a copy of a database URL with the password replaced by '***',
 * so it can be safely included in log output.
 */
function maskDbUrl(raw) {
  if (!raw) return '(not set)';
  try {
    const parsed = new url.URL(raw);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '(invalid URL)';
  }
}

// ------------------------------------------------------------
// ENV
// ------------------------------------------------------------
const PORT           = process.env.PORT || 3000;
const DATABASE_URL   = process.env.DATABASE_URL || process.env.database_url;
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const JWT_SECRET     = process.env.JWT_SECRET || 'defaultsecret';

if (!DATABASE_URL) {
  serverLog('warn', 'startup', 'DATABASE_URL environment variable is not set.',
    'The server will start but all database operations will fail.');
}

if (JWT_SECRET === 'defaultsecret') {
  serverLog('warn', 'startup', 'JWT_SECRET is using the default insecure value.',
    'Set a strong random JWT_SECRET in production.');
}

// ------------------------------------------------------------
// Static file serving
// ------------------------------------------------------------
const FRONTEND_DIR = path.resolve(__dirname, '..', 'frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// ------------------------------------------------------------
// Database connection pool
// ------------------------------------------------------------
const pool = new Pool({ connectionString: DATABASE_URL });

pool.on('error', (err) => {
  serverLog('error', 'db-pool', 'Unexpected idle-client database error.', err.message);
});

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function respond(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true',
  });
  res.end(body);
}

function readJSON(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', () => {
      if (!raw.trim()) {
        return reject(new Error('empty_body'));
      }
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid_json')); }
    });
    req.on('error', (err) => {
      serverLog('error', 'request', 'Error reading request body.', err.message);
      reject(err);
    });
  });
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

function generateToken(userId) {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) {
    serverLog('warn', 'auth', 'Malformed JWT: expected 3 parts.');
    return null;
  }
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64url');
  if (sig !== parts[2]) {
    serverLog('warn', 'auth', 'JWT signature verification failed.');
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      serverLog('warn', 'auth', 'JWT has expired.', `exp=${payload.exp}`);
      return null;
    }
    return payload;
  } catch {
    serverLog('warn', 'auth', 'JWT payload could not be decoded.');
    return null;
  }
}

function getAuthToken(req) {
  const auth = req.headers['authorization'];
  if (!auth) return null;
  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || !token) {
    serverLog('warn', 'auth', 'Invalid Authorization header format.', auth);
    return null;
  }
  return token;
}

// Monkey ID validation pattern
const MONK_ID_RE = /^monk-\d{3}$/;

// Sort options whitelist (prevents ORDER BY injection)
const ORDER_BY = {
  'price-asc':   'm.price ASC',
  'price-desc':  'm.price DESC',
  'rarity-asc':  "CASE m.rarity WHEN 'Common' THEN 1 WHEN 'Rare' THEN 2 WHEN 'Epic' THEN 3 WHEN 'Legendary' THEN 4 WHEN 'Mythic' THEN 5 ELSE 99 END ASC",
  'rarity-desc': "CASE m.rarity WHEN 'Common' THEN 1 WHEN 'Rare' THEN 2 WHEN 'Epic' THEN 3 WHEN 'Legendary' THEN 4 WHEN 'Mythic' THEN 5 ELSE 99 END DESC",
};

// ------------------------------------------------------------
// HTTP Server
// ------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': 86400,
    });
    return res.end();
  }

  const { pathname, query } = url.parse(req.url, true);

  try {
    //------------------------------------------------------------------
    // GET /health
    //------------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/health') {
      // Verify database connectivity as part of the health check
      try {
        await pool.query('SELECT 1');
        return respond(res, 200, { status: 'healthy', db: 'connected' });
      } catch (e) {
        serverLog('error', 'health', 'Health check: database is unreachable.', e.message);
        return respond(res, 503, { status: 'unhealthy', db: 'unreachable', detail: e.message });
      }
    }

    //------------------------------------------------------------------
    // GET /api/config – returns non-sensitive runtime configuration
    //------------------------------------------------------------------
    if (req.method === 'GET' && (pathname === '/api/config' || pathname === '/api/config/')) {
      serverLog('info', 'config', 'Config endpoint called.', `DATABASE_URL present: ${!!DATABASE_URL}`);
      return respond(res, 200, { dbUrl: maskDbUrl(DATABASE_URL) });
    }

    //------------------------------------------------------------------
    // POST /api/register
    //------------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/register') {
      let d;
      try {
        d = await readJSON(req);
      } catch (parseErr) {
        serverLog('warn', 'register', 'Could not parse request body.', parseErr.message);
        return respond(res, 400, { error: parseErr.message === 'empty_body' ? 'empty_body' : 'invalid_json' });
      }

      if (!d.username || !d.email || !d.password) {
        serverLog('warn', 'register', 'Registration attempt with missing fields.');
        return respond(res, 400, { error: 'missing_fields',
          detail: 'username, email and password are all required.' });
      }

      if (typeof d.username !== 'string' || d.username.trim().length < 2) {
        return respond(res, 400, { error: 'invalid_username',
          detail: 'Username must be at least 2 characters.' });
      }

      try {
        const { rows } = await pool.query(
          'INSERT INTO profile (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
          [d.username.trim(), d.email.trim(), hashPassword(d.password)]
        );
        const user  = rows[0];
        const token = generateToken(user.id);
        serverLog('info', 'register', `New user registered: "${user.username}" (id=${user.id}).`);
        return respond(res, 201, { user, token });
      } catch (e) {
        const mapped = mapDbError(e);
        return respond(res, mapped.status, { error: mapped.error, detail: mapped.detail });
      }
    }

    //------------------------------------------------------------------
    // POST /api/login
    //------------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/login') {
      let d;
      try {
        d = await readJSON(req);
      } catch (parseErr) {
        serverLog('warn', 'login', 'Could not parse request body.', parseErr.message);
        return respond(res, 400, { error: 'invalid_json' });
      }

      if (!d.username || !d.password) {
        serverLog('warn', 'login', 'Login attempt with missing credentials.');
        return respond(res, 400, { error: 'missing_credentials',
          detail: 'Both username and password are required.' });
      }

      try {
        const { rows } = await pool.query(
          'SELECT id, username, email FROM profile WHERE username = $1 AND password = $2',
          [d.username, hashPassword(d.password)]
        );
        if (!rows.length) {
          serverLog('warn', 'login', `Failed login attempt for username "${d.username}".`);
          return respond(res, 401, { error: 'invalid_credentials',
            detail: 'No account found matching these credentials.' });
        }
        const user  = rows[0];
        const token = generateToken(user.id);
        serverLog('info', 'login', `User logged in: "${user.username}" (id=${user.id}).`);
        return respond(res, 200, { user, token });
      } catch (e) {
        const mapped = mapDbError(e);
        return respond(res, mapped.status, { error: mapped.error, detail: mapped.detail });
      }
    }

    //------------------------------------------------------------------
    // GET /api/profile
    //------------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/profile') {
      const payload = verifyToken(getAuthToken(req));
      if (!payload) return respond(res, 401, { error: 'unauthorized',
        detail: 'A valid Bearer token is required.' });

      try {
        const { rows } = await pool.query(
          'SELECT id, username, email, joined_at FROM profile WHERE id = $1',
          [payload.userId]
        );
        if (!rows.length) {
          serverLog('warn', 'profile', `User id=${payload.userId} not found in database.`);
          return respond(res, 404, { error: 'user_not_found',
            detail: 'The authenticated user no longer exists.' });
        }
        return respond(res, 200, { user: rows[0] });
      } catch (e) {
        const mapped = mapDbError(e);
        return respond(res, mapped.status, { error: mapped.error, detail: mapped.detail });
      }
    }

    //------------------------------------------------------------------
    // GET /api/monkeys  – list with optional filters
    //------------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/monkeys') {
      const params  = [];
      const filters = [];

      if (query.search) {
        params.push(`%${query.search}%`);
        filters.push(`LOWER(m.name) LIKE LOWER($${params.length})`);
      }
      if (query.rarity) {
        params.push(query.rarity);
        filters.push(`m.rarity = $${params.length}`);
      }
      if (query.maxPrice) {
        const price = parseInt(query.maxPrice, 10);
        if (!isNaN(price)) {
          params.push(price);
          filters.push(`m.price <= $${params.length}`);
        }
      }

      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

      try {
        const { rows } = await pool.query(
          `SELECT m.id,
                  m.name,
                  m.image_url AS image,
                  m.rarity,
                  m.price,
                  json_build_object(
                    'background', t.background,
                    'fur',        t.fur,
                    'headgear',   t.headgear,
                    'prop',       t.prop
                  ) AS traits
           FROM monkeys m
           JOIN monkey_traits t ON t.monkey_id = m.id
           ${where}
           ORDER BY ${ORDER_BY[query.sortBy] || 'm.id'}`,
          params
        );
        return respond(res, 200, rows);
      } catch (e) {
        const mapped = mapDbError(e);
        return respond(res, mapped.status, { error: mapped.error, detail: mapped.detail });
      }
    }

    //------------------------------------------------------------------
    // GET /api/monkeys/:id
    //------------------------------------------------------------------
    if (req.method === 'GET' && pathname.startsWith('/api/monkeys/')) {
      const id = pathname.split('/').pop();
      if (!MONK_ID_RE.test(id)) {
        serverLog('warn', 'monkeys', `Invalid monkey ID requested: "${id}".`);
        return respond(res, 400, { error: 'invalid_id',
          detail: 'Monkey IDs must match the pattern monk-XXX (e.g. monk-001).' });
      }

      try {
        const { rows } = await pool.query(
          `SELECT m.id,
                  m.name,
                  m.image_url AS image,
                  m.rarity,
                  m.price,
                  json_build_object(
                    'background', t.background,
                    'fur',        t.fur,
                    'headgear',   t.headgear,
                    'prop',       t.prop
                  ) AS traits
           FROM monkeys m
           JOIN monkey_traits t ON t.monkey_id = m.id
           WHERE m.id = $1`,
          [id]
        );
        if (!rows.length) {
          serverLog('warn', 'monkeys', `NFT "${id}" not found.`);
          return respond(res, 404, { error: 'not_found',
            detail: `No monkey NFT with ID "${id}" exists in the database.` });
        }
        return respond(res, 200, rows[0]);
      } catch (e) {
        const mapped = mapDbError(e);
        return respond(res, mapped.status, { error: mapped.error, detail: mapped.detail });
      }
    }

    //------------------------------------------------------------------
    // GET /api/cart
    //------------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/cart') {
      const payload = verifyToken(getAuthToken(req));
      if (!payload) return respond(res, 401, { error: 'unauthorized',
        detail: 'A valid Bearer token is required to access the cart.' });

      try {
        const { rows } = await pool.query(
          `SELECT m.id,
                  m.name,
                  m.image_url AS image,
                  m.price,
                  c.quantity
           FROM shoppingcart c
           JOIN monkeys m ON m.id = c.monkey_id
           WHERE c.profile_id = $1`,
          [payload.userId]
        );
        return respond(res, 200, rows);
      } catch (e) {
        const mapped = mapDbError(e);
        return respond(res, mapped.status, { error: mapped.error, detail: mapped.detail });
      }
    }

    //------------------------------------------------------------------
    // POST /api/cart  { nftId }
    //------------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/cart') {
      const payload = verifyToken(getAuthToken(req));
      if (!payload) return respond(res, 401, { error: 'unauthorized',
        detail: 'A valid Bearer token is required to modify the cart.' });

      let d;
      try {
        d = await readJSON(req);
      } catch (parseErr) {
        return respond(res, 400, { error: 'invalid_json' });
      }
      if (!d.nftId) {
        serverLog('warn', 'cart', 'POST /api/cart called without nftId.');
        return respond(res, 400, { error: 'missing_nftId',
          detail: 'A valid nftId must be supplied in the request body.' });
      }
      if (!MONK_ID_RE.test(d.nftId)) {
        serverLog('warn', 'cart', `Invalid nftId supplied: "${d.nftId}".`);
        return respond(res, 400, { error: 'invalid_nftId',
          detail: 'nftId must match the pattern monk-XXX (e.g. monk-001).' });
      }

      try {
        await pool.query(
          `INSERT INTO shoppingcart (profile_id, monkey_id, quantity)
           VALUES ($1, $2, 1)
           ON CONFLICT (profile_id, monkey_id)
             DO UPDATE SET quantity = shoppingcart.quantity + 1`,
          [payload.userId, d.nftId]
        );
        return respond(res, 201, { ok: true });
      } catch (e) {
        const mapped = mapDbError(e);
        return respond(res, mapped.status, { error: mapped.error, detail: mapped.detail });
      }
    }

    //------------------------------------------------------------------
    // DELETE /api/cart/:id
    //------------------------------------------------------------------
    if (req.method === 'DELETE' && pathname.startsWith('/api/cart/')) {
      const payload = verifyToken(getAuthToken(req));
      if (!payload) return respond(res, 401, { error: 'unauthorized',
        detail: 'A valid Bearer token is required to modify the cart.' });

      const id = pathname.split('/').pop();
      if (!MONK_ID_RE.test(id)) {
        serverLog('warn', 'cart', `Invalid cart item ID: "${id}".`);
        return respond(res, 400, { error: 'invalid_id',
          detail: 'The cart item ID must match the pattern monk-XXX.' });
      }

      try {
        await pool.query(
          'DELETE FROM shoppingcart WHERE profile_id = $1 AND monkey_id = $2',
          [payload.userId, id]
        );
        return respond(res, 204, {});
      } catch (e) {
        const mapped = mapDbError(e);
        return respond(res, mapped.status, { error: mapped.error, detail: mapped.detail });
      }
    }

    // Static file fallback – serve files from the frontend directory
    let filePath = path.join(FRONTEND_DIR, pathname);

    // Prevent path traversal outside the frontend directory
    if (!filePath.startsWith(FRONTEND_DIR + path.sep) && filePath !== FRONTEND_DIR) {
      serverLog('warn', 'static', `Path traversal attempt blocked: "${pathname}".`);
      return respond(res, 403, { error: 'forbidden',
        detail: 'Access to this path is not permitted.' });
    }

    // Default to index.html for directory requests
    if (pathname === '/' || pathname.endsWith('/')) {
      filePath = path.join(filePath, 'index.html');
    }

    // If no extension, try appending .html
    if (!path.extname(filePath)) {
      filePath = filePath + '.html';
    }

    return serveStatic(res, filePath);

  } catch (e) {
    serverLog('error', 'server', 'Unhandled exception in request handler.', e.message);
    respond(res, 500, { error: 'internal_server_error',
      detail: 'An unexpected error occurred. Please try again later.' });
  }
});

// ------------------------------------------------------------
// Process-level error handlers
// ------------------------------------------------------------
process.on('uncaughtException', (err) => {
  serverLog('error', 'process', 'Uncaught exception – server will continue running.', err.message);
});

process.on('unhandledRejection', (reason) => {
  const detail = reason instanceof Error ? reason.message : String(reason);
  serverLog('error', 'process', 'Unhandled promise rejection.', detail);
});

// ------------------------------------------------------------
server.listen(PORT, () =>
  serverLog('info', 'startup', `Backend running on port ${PORT}.`, `DATABASE_URL: ${maskDbUrl(DATABASE_URL)}`));