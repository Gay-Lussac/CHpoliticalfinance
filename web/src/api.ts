import { lang } from './i18n';

export type Row = Record<string, any>;
export interface QueryResult { columns: string[]; total: number; limit: number; offset: number; rows: Row[] }

export interface Financing {
  id: number; kind: 'vote' | 'election' | 'party_year'; efk_id: number; event_date: string | null; year: number;
  title: string; council: string | null; canton: string | null; object_type: string | null;
  has_budget: boolean; has_final: boolean;
  summary: Record<string, Record<string, { total: number; n_actors: number }>>;
  allowances: Record<string, { total: number; n: number }>;
  ballots: Ballot[];
}

export interface Recommendation { code: string; kind: 'party' | 'organisation'; party_code: string | null;
  color: string | null; label: string; recommendation: string }
export interface Ballot {
  anr: string; role: 'main' | 'counter_proposal' | 'tie_break'; legal_form: string; title: string | null;
  yes_share: number | null; turnout: number | null; outcome: string | null; cantons_yes: number | null;
  recommendations?: Recommendation[];
}

const cache = new Map<string, Promise<any>>();

export async function get<T = any>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  qs.set('lang', lang());
  const url = `/api/${path}?${qs}`;
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then(async (r) => {
      if (!r.ok) {
        cache.delete(url);
        throw new Error(`${r.status} ${(await r.json().catch(() => ({}))).error ?? ''}`);
      }
      return r.json();
    }));
  }
  return cache.get(url)!;
}

export interface QuerySpec {
  dataset: string; group_by?: string[]; measure?: string[]; columns?: string[];
  filter?: Record<string, unknown>; order?: string; limit?: number; offset?: number;
}

export function query(spec: QuerySpec): Promise<QueryResult> {
  const params: Record<string, unknown> = {
    dataset: spec.dataset, group_by: spec.group_by, measure: spec.measure, columns: spec.columns,
    order: spec.order, limit: spec.limit, offset: spec.offset,
  };
  for (const [k, v] of Object.entries(spec.filter ?? {})) {
    const [field, op] = k.split(':');
    params[op ? `filter[${field}][${op}]` : `filter[${field}]`] = v;
  }
  return get<QueryResult>('query', params);
}
