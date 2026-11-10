/**
 * MODO DEMO — sustituto local de Supabase para previsualizar la app sin backend.
 * Se activa con EXPO_PUBLIC_DEMO=1. Los datos viven sólo en este dispositivo/navegador
 * y empiezan VACÍOS: nada de lo que se ve es inventado.
 *
 * Implementa únicamente el subconjunto de la API de supabase-js que usa la app.
 * Aplica el mismo aislamiento por usuario que las políticas RLS.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;
type DB = { users: { id: string; email: string; password: string }[]; tables: Record<string, Row[]> };

const STORAGE_KEY = 'vyro-demo-db-v1';
const SESSION_KEY = 'vyro-demo-session-v1';

/** Tablas con catálogo público (user_id NULL) además de filas propias. */
const PUBLIC_CATALOG = new Set(['foods', 'exercises']);
/** Relaciones para los agregados embebidos `tabla(count)`. */
const FOREIGN_KEYS: Record<string, string> = { routine_exercises: 'routine_id', workout_sets: 'session_id' };

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

let memory: DB = { users: [], tables: {} };
function load(): DB {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (raw) memory = JSON.parse(raw) as DB;
  } catch {
    /* sin almacenamiento: seguimos en memoria */
  }
  return memory;
}
function save(db: DB) {
  memory = db;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* ignorado */
  }
}

let currentUser: { id: string; email: string } | null = null;
try {
  const raw = storage()?.getItem(SESSION_KEY);
  if (raw) currentUser = JSON.parse(raw);
} catch {
  /* ignorado */
}

const makeSession = (u: { id: string; email: string }) => ({
  access_token: 'demo',
  refresh_token: 'demo',
  token_type: 'bearer',
  expires_in: 3600 * 24 * 365,
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
  user: { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' },
});

type Listener = (event: string, session: ReturnType<typeof makeSession> | null) => void;
const listeners = new Set<Listener>();
function setUser(u: { id: string; email: string } | null, event: string) {
  currentUser = u;
  try {
    if (u) storage()?.setItem(SESSION_KEY, JSON.stringify(u));
    else storage()?.removeItem(SESSION_KEY);
  } catch {
    /* ignorado */
  }
  const s = u ? makeSession(u) : null;
  listeners.forEach((l) => l(event, s));
}

const err = (message: string) => ({ message, name: 'DemoError', status: 400 });

const auth = {
  async getSession() {
    return { data: { session: currentUser ? makeSession(currentUser) : null }, error: null };
  },
  onAuthStateChange(cb: Listener) {
    listeners.add(cb);
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const db = load();
    const u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (!u || u.password !== password) return { data: { session: null, user: null }, error: err('Invalid login credentials') };
    setUser({ id: u.id, email: u.email }, 'SIGNED_IN');
    return { data: { session: makeSession(u), user: makeSession(u).user }, error: null };
  },
  async signUp({ email, password }: { email: string; password: string }) {
    const db = load();
    if (db.users.some((x) => x.email.toLowerCase() === email.toLowerCase()))
      return { data: { session: null, user: null }, error: err('User already registered') };
    const u = { id: uuid(), email, password };
    db.users.push(u);
    // Igual que el trigger handle_new_user de la base de datos real.
    (db.tables.profiles ??= []).push({ id: u.id, display_name: null, onboarded_at: null, created_at: new Date().toISOString() });
    save(db);
    setUser({ id: u.id, email }, 'SIGNED_IN');
    return { data: { session: makeSession(u), user: makeSession(u).user }, error: null };
  },
  async signOut() {
    setUser(null, 'SIGNED_OUT');
    return { error: null };
  },
  startAutoRefresh() {},
  stopAutoRefresh() {},
};

type Filter = (r: Row) => boolean;
type Op = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

class Query implements PromiseLike<{ data: unknown; error: unknown; count: number | null }> {
  private op: Op = 'select';
  private filters: Filter[] = [];
  private embeddedFilters: Record<string, Filter[]> = {};
  private cols = '*';
  private orderBy: { col: string; asc: boolean } | null = null;
  private max: number | null = null;
  private single: 'maybe' | 'one' | null = null;
  private payload: Row[] = [];
  private conflict: string[] = [];
  private countMode = false;
  private head = false;

  constructor(private table: string) {}

  select(cols = '*', opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') this.cols = cols;
    this.countMode = !!opts?.count;
    this.head = !!opts?.head;
    return this;
  }
  insert(v: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(v) ? v : [v]; return this; }
  update(v: Row) { this.op = 'update'; this.payload = [v]; return this; }
  upsert(v: Row | Row[], o?: { onConflict?: string }) {
    this.op = 'upsert';
    this.payload = Array.isArray(v) ? v : [v];
    this.conflict = o?.onConflict?.split(',').map((s) => s.trim()) ?? ['id'];
    return this;
  }
  delete() { this.op = 'delete'; return this; }

  private add(col: string, f: (v: unknown) => boolean) {
    if (col.includes('.')) {
      const [t, c] = col.split('.');
      (this.embeddedFilters[t] ??= []).push((r) => f(r[c]));
    } else this.filters.push((r) => f(r[col]));
    return this;
  }
  eq(c: string, v: unknown) { return this.add(c, (x) => x === v); }
  lt(c: string, v: string | number) { return this.add(c, (x) => (x as string) < v); }
  lte(c: string, v: string | number) { return this.add(c, (x) => (x as string) <= v); }
  gte(c: string, v: string | number) { return this.add(c, (x) => (x as string) >= v); }
  contains(c: string, v: unknown[]) { return this.add(c, (x) => Array.isArray(x) && v.every((i) => x.includes(i))); }
  not(c: string, op: string, v: unknown) {
    if (op === 'is' && v === null) return this.add(c, (x) => x !== null && x !== undefined);
    return this.add(c, (x) => x !== v);
  }
  order(col: string, o?: { ascending?: boolean }) { this.orderBy = { col, asc: o?.ascending !== false }; return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { this.single = 'maybe'; return this; }

  then<A = unknown, B = never>(
    ok?: ((v: { data: unknown; error: unknown; count: number | null }) => A | PromiseLike<A>) | null,
    bad?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.run()).then(ok, bad);
  }

  /** Equivalente a las políticas RLS: sólo filas propias (o catálogo público al leer). */
  private visible(r: Row, forWrite: boolean) {
    if (!currentUser) return false;
    if (this.table === 'profiles') return r.id === currentUser.id;
    if (r.user_id === currentUser.id) return true;
    return !forWrite && PUBLIC_CATALOG.has(this.table) && r.user_id == null;
  }

  private run() {
    if (!currentUser) return { data: null, error: err('Sesión no iniciada'), count: null };
    const db = load();
    const rows = (db.tables[this.table] ??= []);
    const match = (r: Row, write: boolean) => this.visible(r, write) && this.filters.every((f) => f(r));
    const uid = currentUser.id;

    if (this.op === 'insert' || this.op === 'upsert') {
      for (const p of this.payload) {
        const owner = (p.user_id ?? uid) as string;
        if (this.table !== 'profiles' && owner !== uid) return { data: null, error: err('new row violates row-level security policy'), count: null };
        const existing = this.op === 'upsert' ? rows.find((r) => this.visible(r, true) && this.conflict.every((k) => r[k] === (k === 'user_id' ? owner : p[k]))) : undefined;
        if (existing) Object.assign(existing, p);
        else rows.push({ id: uuid(), created_at: new Date().toISOString(), ...p, user_id: owner });
      }
      save(db);
      return { data: null, error: null, count: null };
    }
    if (this.op === 'update') {
      rows.filter((r) => match(r, true)).forEach((r) => Object.assign(r, this.payload[0], { updated_at: new Date().toISOString() }));
      save(db);
      return { data: null, error: null, count: null };
    }
    if (this.op === 'delete') {
      db.tables[this.table] = rows.filter((r) => !match(r, true));
      save(db);
      return { data: null, error: null, count: null };
    }

    let out = rows.filter((r) => match(r, false));
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      out = [...out].sort((a, b) => ((a[col] as string) > (b[col] as string) ? 1 : (a[col] as string) < (b[col] as string) ? -1 : 0) * (asc ? 1 : -1));
    }
    const count = out.length;
    if (this.max !== null) out = out.slice(0, this.max);

    // Agregados embebidos: "routine_exercises(count)".
    const embeds = [...this.cols.matchAll(/(\w+)\(count\)/g)].map((m) => m[1]);
    const data = out.map((r) => {
      const copy: Row = { ...r };
      for (const t of embeds) {
        const fk = FOREIGN_KEYS[t];
        const extra = this.embeddedFilters[t] ?? [];
        const n = (db.tables[t] ?? []).filter((x) => x[fk] === r.id && extra.every((f) => f(x))).length;
        copy[t] = [{ count: n }];
      }
      return copy;
    });

    if (this.head) return { data: null, error: null, count };
    if (this.single) return { data: data[0] ?? null, error: null, count: this.countMode ? count : null };
    return { data, error: null, count: this.countMode ? count : null };
  }
}

export function createDemoClient(): SupabaseClient {
  return { auth, from: (t: string) => new Query(t) } as unknown as SupabaseClient;
}
