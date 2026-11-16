/**
 * Entorno de PRUEBAS local: imita la API de Supabase (REST de PostgREST + Auth) sobre un
 * PostgreSQL real con la migración y las políticas RLS aplicadas. Sólo para pruebas de punta
 * a punta; en producción se usa Supabase de verdad.
 *
 *   node e2e/fake-supabase.mjs      (variables: PGURL, PORT)
 */
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

import pg from 'pg';

const PORT = Number(process.env.PORT ?? 54321);
const SECRET = 'e2e-secret';
const pool = new pg.Pool({ connectionString: process.env.PGURL ?? 'postgres://postgres:e2e@127.0.0.1:5432/vyro_e2e' });

// Tipos como los devuelve PostgREST: numeric → número, date/timestamp → texto.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1114, (v) => v);
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());
pg.types.setTypeParser(20, (v) => Number(v));

// Tipos de columna (para serializar bien jsonb frente a arrays de texto).
const colTypes = new Map();
async function typesOf(table) {
  if (!colTypes.has(table)) {
    const r = await pool.query(`select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = $1`, [table]);
    colTypes.set(table, new Map(r.rows.map((x) => [x.column_name, x.data_type])));
  }
  return colTypes.get(table);
}
const serialize = (types, col, v) => (v !== null && v !== undefined && types.get(col) === 'jsonb' ? JSON.stringify(v) : v);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sign(payload) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  return `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`;
}
function verify(token) {
  const [h, p, s] = String(token ?? '').split('.');
  if (!h || !p || !s) return null;
  if (createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null;
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  return payload.exp * 1000 > Date.now() ? payload : null;
}

const refreshTokens = new Map(); // token → user id
async function sessionFor(user) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = sign({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, session_id: randomUUID() });
  const refresh_token = randomUUID();
  refreshTokens.set(refresh_token, user.id);
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token, user: userJson(user) };
}
const userJson = (u) => ({
  id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
});

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const readBody = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch { ok({}); } }); });

// ---------------------------------------------------------------- Auth
async function auth(req, res, url, body) {
  const path = url.pathname.replace('/auth/v1', '');
  if (path === '/signup') {
    const { email, password } = body;
    const exists = await pool.query('select 1 from auth.users where email = $1', [email]);
    if (exists.rowCount) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
    const id = randomUUID();
    await pool.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
    await pool.query('insert into auth.e2e_passwords (id, password) values ($1, $2)', [id, password]);
    return send(res, 200, await sessionFor({ id, email }));
  }
  if (path === '/token') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const r = await pool.query('select u.id, u.email from auth.users u join auth.e2e_passwords p on p.id = u.id where u.email = $1 and p.password = $2', [body.email, body.password]);
      if (!r.rowCount) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return send(res, 200, await sessionFor(r.rows[0]));
    }
    if (grant === 'refresh_token') {
      const id = refreshTokens.get(body.refresh_token);
      if (!id) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
      const r = await pool.query('select id, email from auth.users where id = $1', [id]);
      return send(res, 200, await sessionFor(r.rows[0]));
    }
  }
  if (path === '/user') {
    const claims = verify((req.headers.authorization ?? '').replace(/^Bearer /, ''));
    if (!claims) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
    const r = await pool.query('select id, email from auth.users where id = $1', [claims.sub]);
    if (!r.rowCount) return send(res, 403, { code: 403, error_code: 'user_not_found', msg: 'User not found' });
    return send(res, 200, userJson(r.rows[0]));
  }
  if (path === '/logout') return send(res, 204);
  return send(res, 404, { msg: `auth ${path} no implementado` });
}

// ---------------------------------------------------------------- REST
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error(`identificador no válido: ${s}`);
  return `"${s}"`;
};

function where(params, values) {
  const out = [];
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
    const col = ident(key);
    const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|like|ilike|is|in|cs)\.(.*)$/s.exec(raw);
    if (!m) throw new Error(`filtro no soportado: ${key}=${raw}`);
    const [, not, op, val] = m;
    let sql;
    if (op === 'is') sql = `${col} is ${val === 'null' ? 'null' : val === 'true' ? 'true' : 'false'}`;
    else if (op === 'in') {
      const list = val.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, ''));
      values.push(list);
      sql = `${col}::text = any($${values.length}::text[])`;
    } else if (op === 'cs') {
      values.push(val.replace(/^\{|\}$/g, '').split(',').filter(Boolean));
      sql = `${col}::text[] @> $${values.length}::text[]`;
    } else {
      const sym = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' }[op];
      values.push(op === 'like' || op === 'ilike' ? val.replace(/\*/g, '%') : val);
      sql = `${col} ${sym} $${values.length}`;
    }
    out.push(not ? `not (${sql})` : sql);
  }
  return out.length ? ` where ${out.join(' and ')}` : '';
}

function selectList(sel) {
  if (!sel || sel === '*') return '*';
  return sel.split(',').map((c) => ident(c.trim())).join(', ');
}

async function rest(req, res, url, body, claims) {
  const path = url.pathname.replace('/rest/v1/', '');
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${claims ? 'authenticated' : 'anon'}`);
    if (claims) await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [claims.sub]);

    const prefer = String(req.headers.prefer ?? '');
    const wantsObject = String(req.headers.accept ?? '').includes('vnd.pgrst.object');
    const params = [...url.searchParams.entries()];
    const values = [];
    let result;

    if (path.startsWith('rpc/')) {
      const fn = ident(path.slice(4));
      const args = Object.entries(body);
      const sql = `select public.${fn}(${args.map(([k], i) => `${ident(k)} := $${i + 1}`).join(', ')}) as r`;
      const r = await client.query(sql, args.map(([, v]) => v));
      await client.query('commit');
      return send(res, 200, r.rows[0]?.r ?? null);
    }

    const table = `public.${ident(path)}`;
    const types = await typesOf(path);
    const ret = url.searchParams.get('select') ? selectList(url.searchParams.get('select')) : '*';
    if (req.method === 'GET' || req.method === 'HEAD') {
      let sql = `select ${ret} from ${table}${where(params, values)}`;
      const order = url.searchParams.get('order');
      if (order) sql += ` order by ${order.split(',').map((o) => { const [c, dir] = o.split('.'); return `${ident(c)} ${dir === 'desc' ? 'desc' : 'asc'}`; }).join(', ')}`;
      const count = prefer.includes('count=exact') ? (await client.query(`select count(*)::int n from ${table}${where(params, [])}`.replace(/\$\d+/g, '$&'), values)).rows[0].n : null;
      if (url.searchParams.get('limit')) sql += ` limit ${Number(url.searchParams.get('limit'))}`;
      result = (await client.query(sql, values)).rows;
      await client.query('commit');
      const headers = count !== null ? { 'Content-Range': `0-${Math.max(0, result.length - 1)}/${count}` } : {};
      if (req.method === 'HEAD') return send(res, 200, undefined, headers);
      if (wantsObject) return result.length === 1 ? send(res, 200, result[0], headers) : send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${result.length} rows` });
      return send(res, 200, result, headers);
    }

    if (req.method === 'POST') {
      const rows = Array.isArray(body) ? body : [body];
      const out = [];
      const conflict = url.searchParams.get('on_conflict');
      const merge = prefer.includes('resolution=merge-duplicates');
      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = cols.map((c) => serialize(types, c, row[c]));
        let sql = `insert into ${table} (${cols.map(ident).join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`;
        if (merge) {
          const keys = (conflict ?? 'id').split(',').map(ident);
          const upd = cols.filter((c) => !(conflict ?? 'id').split(',').includes(c));
          sql += ` on conflict (${keys.join(', ')}) do ${upd.length ? `update set ${upd.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(', ')}` : 'nothing'}`;
        }
        sql += ` returning ${ret}`;
        out.push(...(await client.query(sql, vals)).rows);
      }
      await client.query('commit');
      if (!prefer.includes('return=representation')) return send(res, 201, undefined);
      return wantsObject ? send(res, 201, out[0] ?? null) : send(res, 201, out);
    }

    if (req.method === 'PATCH') {
      const cols = Object.keys(body);
      const vals = cols.map((c) => serialize(types, c, body[c]));
      const set = cols.map((c, i) => `${ident(c)} = $${i + 1}`).join(', ');
      values.push(...vals);
      const r = await client.query(`update ${table} set ${set}${where(params, values)} returning ${ret}`, values);
      await client.query('commit');
      return prefer.includes('return=representation') ? send(res, 200, r.rows) : send(res, 204);
    }

    if (req.method === 'DELETE') {
      const r = await client.query(`delete from ${table}${where(params, values)} returning ${ret}`, values);
      await client.query('commit');
      return prefer.includes('return=representation') ? send(res, 200, r.rows) : send(res, 204);
    }
    await client.query('rollback');
    return send(res, 405, { message: 'método no soportado' });
  } catch (err) {
    await client.query('rollback').catch(() => {});
    const status = err.code === '42501' ? 403 : err.code === '23505' ? 409 : err.code?.startsWith('23') || err.code?.startsWith('22') ? 400 : 400;
    return send(res, status, { code: err.code ?? 'PGRST', message: err.message, details: null, hint: null });
  } finally {
    client.release();
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'OPTIONS') return send(res, 204);
    const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};
    if (url.pathname.startsWith('/auth/v1')) return await auth(req, res, url, body);
    if (url.pathname.startsWith('/rest/v1')) {
      const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
      return await rest(req, res, url, body, verify(token));
    }
    return send(res, 404, { message: 'no encontrado' });
  } catch (err) {
    console.error(err);
    return send(res, 500, { message: String(err) });
  }
}).listen(PORT, () => console.log(`fake-supabase en http://127.0.0.1:${PORT}`));
