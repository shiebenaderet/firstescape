// Classroom Escape Hub — Worker API
//
// Public endpoints:
//   GET  /api/health                      -> { ok: true }
//   GET  /api/escapes                     -> published custom escapes [{ id, title, definition }]
//   POST /api/results   { escapeId, record } -> store a completion
//
// Auth:
//   POST /api/login     { password }      -> { token }  (JWT, ~12h)
//
// Admin (Authorization: Bearer <token>):
//   GET    /api/admin/results[?escapeId=] -> completions (newest first)
//   DELETE /api/admin/results/:id         -> delete one completion
//   GET    /api/admin/escapes             -> all escapes (incl. drafts)
//   PUT    /api/admin/escapes/:id  { title, definition, published } -> upsert
//   DELETE /api/admin/escapes/:id         -> delete
//
// Secrets (set via `wrangler secret put` / .dev.vars):
//   TEACHER_PASSWORD  — the teacher login passphrase
//   AUTH_SECRET       — HMAC key used to sign session tokens

const enc = new TextEncoder();

/* ------------------------------- helpers -------------------------------- */

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes(origin) ? origin : (allowed[0] || '*');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
  });
}

function b64urlFromBytes(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlFromString(str) {
  return b64urlFromBytes(enc.encode(str));
}
function bytesFromB64url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sha256(str) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(str)));
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function signToken(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const signingInput = `${b64urlFromString(JSON.stringify(header))}.${b64urlFromString(JSON.stringify(payload))}`;
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(signingInput)));
  return `${signingInput}.${b64urlFromBytes(sig)}`;
}

async function verifyToken(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const signingInput = `${parts[0]}.${parts[1]}`;
  const key = await hmacKey(secret);
  const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(signingInput)));
  const provided = bytesFromB64url(parts[2]);
  if (!constantTimeEqual(expected, provided)) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytesFromB64url(parts[1])));
  } catch {
    return null;
  }
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;
  return payload;
}

async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return verifyToken(token, env.AUTH_SECRET);
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/* -------------------------------- routes -------------------------------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      if (pathname === '/api/health') {
        return json({ ok: true, service: 'escape-hub-api' }, 200, request, env);
      }

      // ---- Public: which built-in rooms are hidden from the hub ----
      if (pathname === '/api/visibility' && method === 'GET') {
        const hidden = await getHiddenEscapes(env);
        return json({ hidden }, 200, request, env);
      }

      // ---- Public: list published custom escapes ----
      if (pathname === '/api/escapes' && method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT id, title, definition FROM escapes WHERE published = 1 ORDER BY updated_at DESC'
        ).all();
        const escapes = (results || []).map((r) => ({ id: r.id, title: r.title, definition: safeParse(r.definition) }));
        return json({ escapes }, 200, request, env);
      }

      // ---- Public: submit a completion ----
      if (pathname === '/api/results' && method === 'POST') {
        const body = await readJson(request);
        if (!body || !body.escapeId || typeof body.record !== 'object') {
          return json({ error: 'escapeId and record are required' }, 400, request, env);
        }
        const rec = body.record || {};
        const id = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO completions (id, escape_id, escape_title, period, team, completion_time, data)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            id,
            String(body.escapeId).slice(0, 128),
            str(rec.escape || rec.escapeTitle),
            str(rec.period),
            str(rec.team || rec.members),
            str(rec.completionTime),
            JSON.stringify(rec).slice(0, 100000)
          )
          .run();
        return json({ ok: true, id }, 201, request, env);
      }

      // ---- Teacher login ----
      if (pathname === '/api/login' && method === 'POST') {
        const body = await readJson(request);
        const provided = body && typeof body.password === 'string' ? body.password : '';
        if (!env.TEACHER_PASSWORD || !env.AUTH_SECRET) {
          return json({ error: 'Server auth is not configured' }, 500, request, env);
        }
        const ok = constantTimeEqual(await sha256(provided), await sha256(env.TEACHER_PASSWORD));
        if (!ok) return json({ error: 'Incorrect password' }, 401, request, env);
        const now = Math.floor(Date.now() / 1000);
        const token = await signToken({ sub: 'teacher', iat: now, exp: now + 12 * 3600 }, env.AUTH_SECRET);
        return json({ token }, 200, request, env);
      }

      // ---- Admin routes ----
      if (pathname.startsWith('/api/admin/')) {
        const claims = await requireAuth(request, env);
        if (!claims) return json({ error: 'Unauthorized' }, 401, request, env);

        // Results
        if (pathname === '/api/admin/results' && method === 'GET') {
          const escapeId = url.searchParams.get('escapeId');
          const q = escapeId
            ? env.DB.prepare('SELECT * FROM completions WHERE escape_id = ? ORDER BY created_at DESC LIMIT 2000').bind(escapeId)
            : env.DB.prepare('SELECT * FROM completions ORDER BY created_at DESC LIMIT 2000');
          const { results } = await q.all();
          return json({ results: results || [] }, 200, request, env);
        }
        const delResult = pathname.match(/^\/api\/admin\/results\/([^/]+)$/);
        if (delResult && method === 'DELETE') {
          await env.DB.prepare('DELETE FROM completions WHERE id = ?').bind(delResult[1]).run();
          return json({ ok: true }, 200, request, env);
        }

        // Visibility of built-in rooms
        if (pathname === '/api/admin/visibility' && method === 'PUT') {
          const body = await readJson(request);
          const hidden = Array.isArray(body && body.hidden) ? body.hidden.map((x) => String(x).slice(0, 128)) : [];
          await setSetting(env, 'hidden_escapes', JSON.stringify(hidden));
          return json({ ok: true, hidden }, 200, request, env);
        }

        // Escapes
        if (pathname === '/api/admin/escapes' && method === 'GET') {
          const { results } = await env.DB.prepare('SELECT id, title, definition, published, updated_at FROM escapes ORDER BY updated_at DESC').all();
          const escapes = (results || []).map((r) => ({
            id: r.id, title: r.title, published: !!r.published, updatedAt: r.updated_at, definition: safeParse(r.definition),
          }));
          return json({ escapes }, 200, request, env);
        }
        const escapeMatch = pathname.match(/^\/api\/admin\/escapes\/([^/]+)$/);
        if (escapeMatch && method === 'PUT') {
          const id = slugify(escapeMatch[1]);
          const body = await readJson(request);
          if (!body || !body.title || typeof body.definition !== 'object') {
            return json({ error: 'title and definition are required' }, 400, request, env);
          }
          const def = { ...body.definition, id, title: body.title };
          await env.DB.prepare(
            `INSERT INTO escapes (id, title, definition, published, updated_at)
             VALUES (?, ?, ?, ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET title=excluded.title, definition=excluded.definition, published=excluded.published, updated_at=datetime('now')`
          )
            .bind(id, body.title, JSON.stringify(def), body.published ? 1 : 0)
            .run();
          return json({ ok: true, id }, 200, request, env);
        }
        if (escapeMatch && method === 'DELETE') {
          await env.DB.prepare('DELETE FROM escapes WHERE id = ?').bind(escapeMatch[1]).run();
          return json({ ok: true }, 200, request, env);
        }
      }

      return json({ error: 'Not found' }, 404, request, env);
    } catch (err) {
      console.error('API error', { message: err && err.message, path: pathname });
      return json({ error: 'Server error' }, 500, request, env);
    }
  },
};

/* ------------------------------ settings -------------------------------- */
async function getSetting(env, key) {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return row ? row.value : null;
}
async function setSetting(env, key, value) {
  await env.DB.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).bind(key, value).run();
}
async function getHiddenEscapes(env) {
  const raw = await getSetting(env, 'hidden_escapes');
  return raw ? safeParse(raw) || [] : [];
}

/* ------------------------------ small utils ----------------------------- */
function str(v) {
  return v == null ? null : String(v).slice(0, 2000);
}
function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
function slugify(s) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'escape';
}
