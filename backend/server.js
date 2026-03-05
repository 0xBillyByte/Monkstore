// server.js – Node.js backend using pg (node-postgres)

'use strict';

const http   = require('http');
const url    = require('url');
const crypto = require('crypto');
const { Pool } = require('pg');

// ------------------------------------------------------------
// ENV
// ------------------------------------------------------------
const PORT           = process.env.PORT || 3000;
const DATABASE_URL   = process.env.DATABASE_URL;
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const JWT_SECRET     = process.env.JWT_SECRET || 'defaultsecret';

// ------------------------------------------------------------
// Database connection pool
// ------------------------------------------------------------
const pool = new Pool({ connectionString: DATABASE_URL });

pool.on('error', (err) => {
  console.error('Unexpected database error:', err.message);
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
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
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
  if (parts.length !== 3) return null;
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64url');
  if (sig !== parts[2]) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function getAuthToken(req) {
  const auth = req.headers['authorization'];
  if (!auth) return null;
  const [scheme, token] = auth.split(' ');
  return scheme === 'Bearer' && token ? token : null;
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
      return respond(res, 200, { status: 'healthy' });
    }

    //------------------------------------------------------------------
    // POST /api/register
    //------------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/register') {
      let d;
      try { d = await readJSON(req); } catch { return respond(res, 400, { error: 'invalid_json' }); }

      if (!d.username || !d.email || !d.password) {
        return respond(res, 400, { error: 'missing_fields' });
      }

      try {
        const { rows } = await pool.query(
          'INSERT INTO profile (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email',
          [d.username, d.email, hashPassword(d.password)]
        );
        const user  = rows[0];
        const token = generateToken(user.id);
        return respond(res, 201, { user, token });
      } catch (e) {
        if (e.code === '23505') return respond(res, 409, { error: 'user_exists' });
        return respond(res, 500, { error: 'db_error', detail: e.message });
      }
    }

    //------------------------------------------------------------------
    // POST /api/login
    //------------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/login') {
      let d;
      try { d = await readJSON(req); } catch { return respond(res, 400, { error: 'invalid_json' }); }

      if (!d.username || !d.password) {
        return respond(res, 400, { error: 'missing_credentials' });
      }

      const { rows } = await pool.query(
        'SELECT id, username, email FROM profile WHERE username = $1 AND password = $2',
        [d.username, hashPassword(d.password)]
      );
      if (!rows.length) return respond(res, 401, { error: 'invalid_credentials' });
      const user  = rows[0];
      const token = generateToken(user.id);
      return respond(res, 200, { user, token });
    }

    //------------------------------------------------------------------
    // GET /api/profile
    //------------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/profile') {
      const payload = verifyToken(getAuthToken(req));
      if (!payload) return respond(res, 401, { error: 'unauthorized' });

      const { rows } = await pool.query(
        'SELECT id, username, email, joined_at FROM profile WHERE id = $1',
        [payload.userId]
      );
      if (!rows.length) return respond(res, 404, { error: 'user_not_found' });
      return respond(res, 200, { user: rows[0] });
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

      const where     = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

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
    }

    //------------------------------------------------------------------
    // GET /api/monkeys/:id
    //------------------------------------------------------------------
    if (req.method === 'GET' && pathname.startsWith('/api/monkeys/')) {
      const id = pathname.split('/').pop();
      if (!MONK_ID_RE.test(id)) return respond(res, 400, { error: 'invalid_id' });

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
      if (!rows.length) return respond(res, 404, { error: 'not_found' });
      return respond(res, 200, rows[0]);
    }

    //------------------------------------------------------------------
    // GET /api/cart
    //------------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/cart') {
      const payload = verifyToken(getAuthToken(req));
      if (!payload) return respond(res, 401, { error: 'unauthorized' });

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
    }

    //------------------------------------------------------------------
    // POST /api/cart  { nftId }
    //------------------------------------------------------------------
    if (req.method === 'POST' && pathname === '/api/cart') {
      const payload = verifyToken(getAuthToken(req));
      if (!payload) return respond(res, 401, { error: 'unauthorized' });

      let d;
      try { d = await readJSON(req); } catch { return respond(res, 400, { error: 'invalid_json' }); }
      if (!d.nftId) return respond(res, 400, { error: 'missing_nftId' });
      if (!MONK_ID_RE.test(d.nftId)) return respond(res, 400, { error: 'invalid_nftId' });

      await pool.query(
        `INSERT INTO shoppingcart (profile_id, monkey_id, quantity)
         VALUES ($1, $2, 1)
         ON CONFLICT (profile_id, monkey_id)
           DO UPDATE SET quantity = shoppingcart.quantity + 1`,
        [payload.userId, d.nftId]
      );
      return respond(res, 201, { ok: true });
    }

    //------------------------------------------------------------------
    // DELETE /api/cart/:id
    //------------------------------------------------------------------
    if (req.method === 'DELETE' && pathname.startsWith('/api/cart/')) {
      const payload = verifyToken(getAuthToken(req));
      if (!payload) return respond(res, 401, { error: 'unauthorized' });

      const id = pathname.split('/').pop();
      if (!MONK_ID_RE.test(id)) return respond(res, 400, { error: 'invalid_id' });

      await pool.query(
        'DELETE FROM shoppingcart WHERE profile_id = $1 AND monkey_id = $2',
        [payload.userId, id]
      );
      return respond(res, 204, {});
    }

    // 404 fallback
    respond(res, 404, { error: 'not_found' });

  } catch (e) {
    console.error('Unhandled error:', e.message);
    respond(res, 500, { error: 'internal_server_error' });
  }
});

// ------------------------------------------------------------
server.listen(PORT, () =>
  console.log(`Backend running on port ${PORT}`));