// server.js – minimalistischer Node-Backend-Server ohne npm

const http        = require('http');
const url         = require('url');
const { exec }    = require('child_process');
const crypto      = require('crypto');

// ------------------------------------------------------------
// ENV
// ------------------------------------------------------------
const PORT           = process.env.PORT || 3000;
const DATABASE_URL   = process.env.DATABASE_URL;
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const JWT_SECRET     = process.env.JWT_SECRET || 'defaultsecret';

// ------------------------------------------------------------
// Hilfsfunktionen
// ------------------------------------------------------------
function escapeSQL(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value.toString();
  // Escape single quotes by doubling them
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runQuery(sql, cb) {
  // Escape the entire SQL command for shell
  const escapedSQL = sql.replace(/'/g, "'\\''");
  const cmd  = `psql "${DATABASE_URL}" -t -A -F '' -c '${escapedSQL}'`;
  exec(cmd, (err, out) => (err ? cb(err) : cb(null, out.trim())));
}

function respond(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true'
  });
  res.end(body);
}

// Hash password using crypto
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

// Generate JWT token
function generateToken(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({ 
    userId, 
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
  })).toString('base64');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64');
  return `${header}.${payload}.${signature}`;
}

// Verify JWT token
function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64');
    
  if (signature !== parts[2]) return null;
  
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// Extract auth token from headers
function getAuthToken(req) {
  const auth = req.headers['authorization'];
  if (!auth) return null;
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

// ------------------------------------------------------------
// HTTP-Server
// ------------------------------------------------------------
const server = http.createServer((req, res) => {
  // CORS-Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': 86400
    });
    return res.end();
  }

  const { pathname } = url.parse(req.url, true);

  //------------------------------------------------------------------
  // GET /health  –  Health check endpoint
  //------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/health') {
    return respond(res, 200, { status: 'healthy' });
  }

  //------------------------------------------------------------------
  // POST /api/register  –  Register new user
  //------------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/register') {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      let d;
      try { d = JSON.parse(raw); } catch { return respond(res, 400, { error: 'invalid_json' }); }
      
      if (!d.username || !d.email || !d.password) {
        return respond(res, 400, { error: 'missing_fields' });
      }
      
      const hashedPassword = hashPassword(d.password);
      const sql = `
        INSERT INTO profile (username, email, password)
        VALUES (${escapeSQL(d.username)}, ${escapeSQL(d.email)}, ${escapeSQL(hashedPassword)})
        RETURNING id, username, email;`;
      
      runQuery(sql, (e, result) => {
        if (e) {
          if (e.message.includes('duplicate key')) {
            return respond(res, 409, { error: 'user_exists' });
          }
          return respond(res, 500, { error: 'db_error', detail: e.message });
        }
        
        try {
          const user = JSON.parse(result);
          const token = generateToken(user.id);
          respond(res, 201, { user, token });
        } catch {
          respond(res, 500, { error: 'parse_error' });
        }
      });
    });
    return;
  }

  //------------------------------------------------------------------
  // POST /api/login  –  Login user
  //------------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/login') {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      let d;
      try { d = JSON.parse(raw); } catch { return respond(res, 400, { error: 'invalid_json' }); }
      
      if (!d.username || !d.password) {
        return respond(res, 400, { error: 'missing_credentials' });
      }
      
      const hashedPassword = hashPassword(d.password);
      const sql = `
        SELECT row_to_json(u) FROM (
          SELECT id, username, email
          FROM profile
          WHERE username = ${escapeSQL(d.username)}
            AND password = ${escapeSQL(hashedPassword)}
        ) u;`;
      
      runQuery(sql, (e, result) => {
        if (e) return respond(res, 500, { error: 'db_error', detail: e.message });
        
        if (!result) {
          return respond(res, 401, { error: 'invalid_credentials' });
        }
        
        try {
          const user = JSON.parse(result);
          const token = generateToken(user.id);
          respond(res, 200, { user, token });
        } catch {
          respond(res, 500, { error: 'parse_error' });
        }
      });
    });
    return;
  }

  //------------------------------------------------------------------
  // GET /api/profile  –  Get current user profile
  //------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/profile') {
    const token = getAuthToken(req);
    const payload = verifyToken(token);
    
    if (!payload) {
      return respond(res, 401, { error: 'unauthorized' });
    }
    
    const sql = `
      SELECT row_to_json(u) FROM (
        SELECT id, username, email, joined_at
        FROM profile
        WHERE id = ${escapeSQL(payload.userId)}
      ) u;`;
    
    runQuery(sql, (e, result) => {
      if (e) return respond(res, 500, { error: 'db_error', detail: e.message });
      if (!result) return respond(res, 404, { error: 'user_not_found' });
      
      try {
        const user = JSON.parse(result);
        respond(res, 200, { user });
      } catch {
        respond(res, 500, { error: 'parse_error' });
      }
    });
    return;
  }

  //------------------------------------------------------------------
  // GET /api/monkeys  –  Liste mit Traits
  //------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/monkeys') {
  const { query } = url.parse(req.url, true);

  const filters = [];
  if (query.search) {
    filters.push(`LOWER(m.name) LIKE LOWER('%${query.search.replace(/'/g, "''")}%')`);
  }
  if (query.rarity) {
    filters.push(`m.rarity = '${query.rarity.replace(/'/g, "''")}'`);
  }
  if (query.maxPrice) {
    const price = parseInt(query.maxPrice, 10);
    if (!isNaN(price)) {
      filters.push(`m.price <= ${price}`);
    }
  }

  let orderBy = 'm.id'; // default fallback
  if (query.sortBy) {
    switch (query.sortBy) {
      case 'price-asc':
        orderBy = 'm.price ASC';
        break;
      case 'price-desc':
        orderBy = 'm.price DESC';
        break;
      case 'rarity-asc':
        orderBy = `
          CASE m.rarity
            WHEN 'Common' THEN 1
            WHEN 'Rare' THEN 2
            WHEN 'Epic' THEN 3
            WHEN 'Legendary' THEN 4
            WHEN 'Mythic' THEN 5
            ELSE 99
          END ASC`;
        break;
      case 'rarity-desc':
        orderBy = `
          CASE m.rarity
            WHEN 'Common' THEN 1
            WHEN 'Rare' THEN 2
            WHEN 'Epic' THEN 3
            WHEN 'Legendary' THEN 4
            WHEN 'Mythic' THEN 5
            ELSE 99
          END DESC`;
        break;
    }
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const sql = `
    SELECT COALESCE(JSON_AGG(row_to_json(x)), '[]'::json)
    FROM (
      SELECT m.id,
             m.name,
             m.image_url   AS image,
             m.rarity,
             (m.price) AS price,
             json_build_object(
               'background', t.background,
               'fur',        t.fur,
               'headgear',   t.headgear,
               'prop',       t.prop
             ) AS traits
      FROM monkeys m
      JOIN monkey_traits t ON t.monkey_id = m.id
      ${whereClause}
      ORDER BY ${orderBy}
    ) x;`;

  return runQuery(sql, (e, j) =>
    e ? respond(res, 500, { error: 'db_error', detail: e.message })
      : respond(res, 200, JSON.parse(j || '[]')));
}



  //------------------------------------------------------------------
  // GET /api/monkeys/:id
  //------------------------------------------------------------------
  if (req.method === 'GET' && pathname.startsWith('/api/monkeys/')) {
    const id  = pathname.split('/').pop();
    // Validate ID is numeric
    if (!/^monk-\d{3}$/.test(id)) {
  return respond(res, 400, { error: 'invalid_id' });
}

    
    const sql = `
      SELECT row_to_json(x) FROM (
        SELECT m.id,
               m.name,
               m.image_url   AS image,
               m.rarity,
               (m.price) AS price,
               json_build_object(
                 'background', t.background,
                 'fur',        t.fur,
                 'headgear',   t.headgear,
                 'prop',       t.prop
               ) AS traits
        FROM monkeys m
        JOIN monkey_traits t ON t.monkey_id = m.id
        WHERE m.id = ${escapeSQL(id)}
      ) x;`;
    return runQuery(sql, (e, j) =>
      e ? respond(res, 500, { error: 'db_error', detail: e.message })
        : j ? respond(res, 200, JSON.parse(j))
            : respond(res, 404, { error: 'not_found' })
    );
  }

  //------------------------------------------------------------------
  // GET /api/cart  –  Warenkorb (Authenticated User)
  //------------------------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/cart') {
    const token = getAuthToken(req);
    const payload = verifyToken(token);
    
    if (!payload) {
      return respond(res, 401, { error: 'unauthorized' });
    }
    
    const sql = `
      SELECT COALESCE(JSON_AGG(row_to_json(x)), '[]'::json)
      FROM (
        SELECT m.id,
               m.name,
               m.image_url   AS image,
               (m.price) AS price,
               c.quantity
        FROM shoppingcart c
        JOIN monkeys m ON m.id = c.monkey_id
        WHERE c.profile_id = ${escapeSQL(payload.userId)}
      ) x;`;
    return runQuery(sql, (e, j) =>
      e ? respond(res, 500, { error: 'db_error', detail: e.message })
        : respond(res, 200, JSON.parse(j || '[]')));
  }

  //------------------------------------------------------------------
  // POST /api/cart   { nftId }
  //------------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/cart') {
    const token = getAuthToken(req);
    const payload = verifyToken(token);
    
    if (!payload) {
      return respond(res, 401, { error: 'unauthorized' });
    }
    
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      let d;
      try { d = JSON.parse(raw); } catch { return respond(res, 400, { error: 'invalid_json' }); }
      if (!d.nftId) return respond(res, 400, { error: 'missing_nftId' });
      
      // Validate nftId format (monk-XXXX)
      if (!/^monk-\d{3}$/.test(d.nftId)) {
        return respond(res, 400, { error: 'invalid_nftId' });
      }

      const sql = `
        INSERT INTO shoppingcart (profile_id, monkey_id, quantity)
        VALUES (${escapeSQL(payload.userId)}, ${escapeSQL(d.nftId)}, 1)
        ON CONFLICT (profile_id, monkey_id)
          DO UPDATE SET quantity = shoppingcart.quantity + 1;`;
      runQuery(sql, e =>
        e ? respond(res, 500, { error: 'db_error', detail: e.message })
          : respond(res, 201, { ok: true }));
    });
    return;
  }

  //------------------------------------------------------------------
  // DELETE /api/cart/:id
  //------------------------------------------------------------------
  if (req.method === 'DELETE' && pathname.startsWith('/api/cart/')) {
    const token = getAuthToken(req);
    const payload = verifyToken(token);
    
    if (!payload) {
      return respond(res, 401, { error: 'unauthorized' });
    }
    
    const id = pathname.split('/').pop();
    // Validate ID is numeric
    if (!/^monk-\d{3}$/.test(id)) {
      return respond(res, 400, { error: 'invalid_id' });
    }
    
    const sql = `
      DELETE FROM shoppingcart
      WHERE profile_id = ${escapeSQL(payload.userId)} AND monkey_id = ${escapeSQL(id)};`;
    return runQuery(sql, e =>
      e ? respond(res, 500, { error: 'db_error', detail: e.message })
        : respond(res, 204, {}));
  }

  // Fallback 404
  respond(res, 404, { error: 'not_found' });
});

// ------------------------------------------------------------
server.listen(PORT, () =>
  console.log(`Backend läuft auf Port ${PORT}`));