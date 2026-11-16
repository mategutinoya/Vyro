/**
 * Base de datos en memoria que imita el subconjunto de supabase-js usado por las
 * operaciones del servidor. Sólo para pruebas: aplica aislamiento por usuario como RLS.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

const DEFAULTS: Record<string, () => Row> = {
  planned_meals: () => ({ status: 'planned', replaced_by: null, ingredients: [], instructions: [], description: null }),
  meal_logs: () => ({ items: [], needs_details: false, followed_plan: false, planned_meal_id: null, source: 'manual' }),
  user_memories: () => ({ times_seen: 1, source: 'chat', last_seen_at: new Date().toISOString() }),
  body_measurements: () => ({ is_checkin: false, notes: null }),
};
const UNIQUE: Record<string, string[]> = {
  meal_plans: ['user_id', 'plan_date'],
  planned_meals: ['plan_id', 'slot'],
  body_measurements: ['user_id', 'measured_on'],
  favorite_meals: ['user_id', 'name'],
  nutrition_targets: ['user_id', 'effective_from'],
};

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

export class FakeDb {
  tables: Record<string, Row[]> = {};
  constructor(public userId: string) {}
  rows(t: string) {
    return (this.tables[t] ??= []);
  }
  client(): SupabaseClient {
    return { from: (t: string) => new Query(this, t) } as unknown as SupabaseClient;
  }
}

class Query implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private filters: Filter[] = [];
  private payload: Row[] = [];
  private conflict: string[] = [];
  private returning = false;
  private singleMode: 'one' | 'maybe' | null = null;
  private orderBy: { col: string; asc: boolean } | null = null;
  private max: number | null = null;

  constructor(private db: FakeDb, private table: string) {}

  select() { if (this.op !== 'select') this.returning = true; return this; }
  insert(v: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(v) ? v : [v]; return this; }
  update(v: Row) { this.op = 'update'; this.payload = [v]; return this; }
  upsert(v: Row | Row[], o?: { onConflict?: string }) { this.op = 'upsert'; this.payload = Array.isArray(v) ? v : [v]; this.conflict = o?.onConflict?.split(',') ?? ['id']; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, v: unknown[]) { this.filters.push((r) => v.includes(r[c])); return this; }
  is(c: string, v: null) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  lte(c: string, v: string) { this.filters.push((r) => String(r[c]) <= v); return this; }
  lt(c: string, v: string) { this.filters.push((r) => String(r[c]) < v); return this; }
  gte(c: string, v: string) { this.filters.push((r) => String(r[c]) >= v); return this; }
  ilike(c: string, v: string) { this.filters.push((r) => String(r[c]).toLowerCase() === v.toLowerCase()); return this; }
  order(col: string, o?: { ascending?: boolean }) { this.orderBy = { col, asc: o?.ascending !== false }; return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }
  single() { this.singleMode = 'one'; return this; }

  then<A, B = never>(ok?: ((v: { data: unknown; error: { message: string } | null }) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.run()).then(ok, bad);
  }

  private owns(r: Row) {
    return this.table === 'user_profiles' ? r.id === this.db.userId : r.user_id === this.db.userId;
  }

  private run(): { data: unknown; error: { message: string } | null } {
    const rows = this.db.rows(this.table);
    const match = (r: Row) => this.owns(r) && this.filters.every((f) => f(r));

    if (this.op === 'insert' || this.op === 'upsert') {
      const out: Row[] = [];
      for (const p of this.payload) {
        if (this.table !== 'user_profiles' && p.user_id !== undefined && p.user_id !== this.db.userId) return { data: null, error: { message: 'violates row-level security policy' } };
        const keys = this.op === 'upsert' ? this.conflict : UNIQUE[this.table];
        const existing = keys ? rows.find((r) => this.owns(r) && keys.every((k) => r[k] === (k === 'user_id' ? this.db.userId : p[k]))) : undefined;
        if (existing && this.op === 'insert') return { data: null, error: { message: `duplicate key value violates unique constraint on ${this.table}` } };
        if (existing) { Object.assign(existing, p); out.push(existing); continue; }
        const row = { id: uuid(), created_at: new Date().toISOString(), ...(DEFAULTS[this.table]?.() ?? {}), ...p, user_id: this.db.userId };
        rows.push(row);
        out.push(row);
      }
      if (!this.returning) return { data: null, error: null };
      return { data: this.singleMode ? out[0] ?? null : out, error: null };
    }
    if (this.op === 'update') {
      rows.filter(match).forEach((r) => Object.assign(r, this.payload[0]));
      return { data: null, error: null };
    }
    if (this.op === 'delete') {
      this.db.tables[this.table] = rows.filter((r) => !match(r));
      return { data: null, error: null };
    }
    let out = rows.filter(match);
    if (this.orderBy) {
      const { col, asc } = this.orderBy;
      out = [...out].sort((a, b) => (String(a[col]) > String(b[col]) ? 1 : -1) * (asc ? 1 : -1));
    }
    if (this.max !== null) out = out.slice(0, this.max);
    if (this.singleMode === 'maybe') return { data: out[0] ?? null, error: null };
    if (this.singleMode === 'one') return out[0] ? { data: out[0], error: null } : { data: null, error: { message: 'no rows' } };
    return { data: out, error: null };
  }
}

