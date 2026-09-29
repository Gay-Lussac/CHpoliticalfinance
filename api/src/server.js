// CHpoliticalfinance read-only API. See docs/04-website.md.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import mysql from 'mysql2/promise';

import { buildQuery, QueryError } from './query.js';
import { attachLabels, i18nExpr, LANGS } from './labels.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function loadEnv() {
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv();

const config = JSON.parse(readFileSync(join(ROOT, 'config', 'datasets.json'), 'utf8'));

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? 'chpf',
  user: process.env.DB_API_USER,
  password: process.env.DB_API_PASSWORD,
  connectionLimit: 8,
  decimalNumbers: true,
  dateStrings: true,
  charset: 'utf8mb4',
});

// ------------------------------------------------------------------ cache (invalidated by new pipeline runs)
const cache = new Map();
let dataVersion = null;
let versionCheckedAt = 0;

async function currentVersion() {
  if (Date.now() - versionCheckedAt > 30_000) {
    const [[row]] = await pool.query(
      "SELECT MAX(id) AS id, MAX(finished_at) AS at FROM fetch_run WHERE status IN ('ok','partial')");
    versionCheckedAt = Date.now();
    const v = `${row.id}`;
    if (v !== dataVersion) {
      cache.clear();
      dataVersion = v;
    }
  }
  return dataVersion;
}

async function cached(key, fn) {
  await currentVersion();
  if (cache.has(key)) return cache.get(key);
  const value = await fn();
  if (cache.size > 1000) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
}

const langOf = (q) => (LANGS.includes(q.lang) ? q.lang : 'fr');

// ------------------------------------------------------------------ app
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

app.addHook('onSend', async (req, reply, payload) => {
  if (req.url.startsWith('/api/')) {
    reply.header('Cache-Control', 'public, max-age=60'); // data changes at most daily; server cache does the heavy lifting
    reply.header('Access-Control-Allow-Origin', '*');
  }
  return payload;
});

app.setErrorHandler((err, req, reply) => {
  if (err instanceof QueryError) return reply.code(400).send({ error: err.message });
  req.log.error(err);
  return reply.code(500).send({ error: 'internal error' });
});

app.get('/api/meta', async () => cached('meta', async () => {
  const [[run]] = await pool.query(
    "SELECT id, finished_at, status FROM fetch_run WHERE status IN ('ok','partial') ORDER BY id DESC LIMIT 1");
  const [[counts]] = await pool.query(`SELECT
      (SELECT COUNT(*) FROM financing WHERE kind='vote') AS votes,
      (SELECT COUNT(*) FROM financing WHERE kind='election') AS elections,
      (SELECT COUNT(*) FROM financing WHERE kind='party_year') AS party_years,
      (SELECT COUNT(*) FROM actor) AS actors,
      (SELECT COUNT(*) FROM donor) AS donors,
      (SELECT COUNT(*) FROM allowance) AS allowances`);
  return { last_run: run ?? null, counts, datasets: Object.fromEntries(
    Object.entries(config.datasets).map(([k, d]) => [k, { description: d.description, fields: d.fields,
      measures: Object.keys(d.measures) }])) };
}));

app.get('/api/query', async (req) => {
  const lang = langOf(req.query);
  return cached(`q:${lang}:${new URLSearchParams(req.query).toString()}`, async () => {
    const q = buildQuery(config, req.query);
    const [rows] = await pool.query(q.sql, q.args);
    const [[{ n }]] = await pool.query(q.countSql, q.args);
    await attachLabels(pool, config, q.columns, rows, lang);
    return { columns: q.columns, total: n, limit: q.limit, offset: q.offset, rows };
  });
});

const FINANCING_SELECT = (lang) => `
  SELECT f.id, f.kind, f.efk_id, f.event_date, f.year, f.has_budget, f.has_final,
         ${i18nExpr('financing', 'f.id', 'title', lang, 'f.name')} AS title,
         e.council, e.canton, v.object_type, v.bfs_vote_no
    FROM financing f
    LEFT JOIN election e ON e.financing_id = f.id
    LEFT JOIN vote_object v ON v.financing_id = f.id`;

async function withSummary(rows) {
  if (!rows.length) return rows;
  const [sums] = await pool.query(
    `SELECT financing_id, phase, stance, n_actors, total_chf FROM v_financing_summary WHERE financing_id IN (?)`,
    [rows.map((r) => r.id)]);
  const [donations] = await pool.query(
    `SELECT financing_id, phase, SUM(value_chf) AS total, COUNT(*) AS n FROM v_flow WHERE financing_id IN (?)
      GROUP BY financing_id, phase`, [rows.map((r) => r.id)]);
  for (const r of rows) {
    r.has_budget = !!r.has_budget;
    r.has_final = !!r.has_final;
    r.summary = {};
    for (const s of sums.filter((x) => x.financing_id === r.id)) {
      (r.summary[s.phase] ??= {})[s.stance] = { total: s.total_chf, n_actors: s.n_actors };
    }
    r.allowances = Object.fromEntries(donations.filter((d) => d.financing_id === r.id)
      .map((d) => [d.phase, { total: d.total, n: d.n }]));
  }
  return rows;
}

/** Swissvotes ballots (result + recommendations) for vote financings; `detail` adds recommendations. */
async function withBallots(rows, lang, detail) {
  const ids = rows.filter((r) => r.kind === 'vote').map((r) => r.id);
  for (const r of rows) r.ballots = [];
  if (!ids.length) return rows;
  let ballots;
  try {
    [ballots] = await pool.query(
      `SELECT b.id, b.financing_id, b.anr, b.role, b.legal_form, b.yes_share, b.turnout, b.outcome, b.cantons_yes,
              ${i18nExpr('ballot', 'b.id', 'title', lang, 'NULL')} AS title
         FROM ballot b WHERE b.financing_id IN (?) ORDER BY b.financing_id, FIELD(b.role,'main','counter_proposal','tie_break')`,
      [ids]);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return rows;   // migration 002 not applied yet: serve votes without results
    throw err;
  }
  let recs = [];
  if (detail && ballots.length) {
    [recs] = await pool.query(
      `SELECT br.ballot_id, br.recommendation, r.code, r.kind, p.code AS party_code, p.color,
              COALESCE(${i18nExpr('party', 'p.id', 'name', lang, 'NULL')}, ${i18nExpr('recommender', 'r.id', 'name', lang, 'r.code')}) AS label
         FROM ballot_recommendation br JOIN recommender r ON r.id = br.recommender_id
         LEFT JOIN party p ON p.id = r.party_id
        WHERE br.ballot_id IN (?) ORDER BY r.sort_order`, [ballots.map((b) => b.id)]);
  }
  const byFin = new Map(rows.map((r) => [r.id, r]));
  for (const b of ballots) {
    const { id, financing_id, ...rest } = b;
    const entry = { ...rest };
    if (detail) entry.recommendations = recs.filter((x) => x.ballot_id === id).map(({ ballot_id, ...x }) => x);
    byFin.get(financing_id)?.ballots.push(entry);
  }
  return rows;
}

app.get('/api/financings', async (req) => {
  const lang = langOf(req.query);
  const kind = ['vote', 'election', 'party_year'].includes(req.query.kind) ? req.query.kind : null;
  return cached(`fin:${lang}:${kind}`, async () => {
    const [rows] = await pool.query(
      `${FINANCING_SELECT(lang)} ${kind ? 'WHERE f.kind = ?' : ''} ORDER BY f.event_date DESC, f.year DESC, f.id`,
      kind ? [kind] : []);
    return withBallots(await withSummary(rows), lang, false);
  });
});

app.get('/api/financings/:id', async (req, reply) => {
  const lang = langOf(req.query);
  const id = Number(req.params.id);
  const rows = await cached(`fin1:${lang}:${id}`, async () => {
    const [r] = await pool.query(`${FINANCING_SELECT(lang)} WHERE f.id = ?`, [id]);
    return withBallots(await withSummary(r), lang, true);
  });
  return rows[0] ?? reply.code(404).send({ error: 'not found' });
});

app.get('/api/actors/:id', async (req, reply) => {
  const lang = langOf(req.query);
  const id = Number(req.params.id);
  const row = await cached(`actor:${lang}:${id}`, async () => {
    const [[a]] = await pool.query(
      `SELECT a.id, a.efk_id, a.name, a.city, a.canton, a.actor_type, ap.level AS party_level,
              p.id AS party_id, p.code AS party_code, p.color AS party_color,
              ${i18nExpr('party', 'p.id', 'name', lang, 'p.code')} AS party_label
         FROM actor a LEFT JOIN actor_party ap ON ap.actor_id = a.id LEFT JOIN party p ON p.id = ap.party_id
        WHERE a.id = ?`, [id]);
    if (!a) return null;
    const [[t]] = await pool.query(
      `SELECT COUNT(DISTINCT financing_id) AS financings, COUNT(DISTINCT campaign_id) AS campaigns
         FROM declaration WHERE actor_id = ?`, [id]);
    return { ...a, ...t };
  });
  return row ?? reply.code(404).send({ error: 'not found' });
});

app.get('/api/donors/:id', async (req, reply) => {
  const id = Number(req.params.id);
  const row = await cached(`donor:${id}`, async () => {
    const [[d]] = await pool.query(
      'SELECT id, donor_type, display_name, city, lives_abroad, country FROM donor WHERE id = ?', [id]);
    if (!d) return null;
    const [[t]] = await pool.query(
      `SELECT COUNT(*) AS n, SUM(value_chf) AS total, COUNT(DISTINCT financing_id) AS financings,
              COUNT(DISTINCT actor_id) AS actors, MIN(granted_on) AS first_date, MAX(granted_on) AS last_date
         FROM v_flow WHERE donor_id = ? AND is_latest`, [id]);
    const [aliases] = await pool.query(
      'SELECT raw_name, raw_first_name, raw_city FROM donor_alias WHERE donor_id = ?', [id]);
    return { ...d, ...t, aliases };
  });
  return row ?? reply.code(404).send({ error: 'not found' });
});

app.get('/api/parties', async (req) => {
  const lang = langOf(req.query);
  return cached(`parties:${lang}`, async () => {
    const [rows] = await pool.query(
      `SELECT p.id, p.code, p.color, ${i18nExpr('party', 'p.id', 'name', lang, 'p.code')} AS label
         FROM party p ORDER BY p.sort_order`);
    return rows;
  });
});

app.get('/api/search', async (req) => {
  const lang = langOf(req.query);
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return { financings: [], actors: [], donors: [] };
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return cached(`search:${lang}:${q.toLowerCase()}`, async () => {
    const [financings] = await pool.query(
      `SELECT f.id, f.kind, f.event_date, f.year, ${i18nExpr('financing', 'f.id', 'title', lang, 'f.name')} AS label
         FROM financing f
        WHERE f.name LIKE ? OR EXISTS (SELECT 1 FROM i18n_label l WHERE l.entity='financing' AND l.entity_id=f.id AND l.text LIKE ?)
        ORDER BY f.event_date DESC LIMIT 8`, [like, like]);
    const [actors] = await pool.query(
      'SELECT id, name AS label, city FROM actor WHERE name LIKE ? ORDER BY name LIMIT 8', [like]);
    const [donors] = await pool.query(
      'SELECT id, display_name AS label, city, donor_type FROM donor WHERE display_name LIKE ? ORDER BY display_name LIMIT 8',
      [like]);
    return { financings, actors, donors };
  });
});

app.get('/api/*', async (req, reply) => reply.code(404).send({ error: 'unknown endpoint' }));

// Serve the built front-end (web/dist) with SPA fallback, if present.
const dist = join(ROOT, 'web', 'dist');
if (existsSync(dist)) {
  await app.register(fastifyStatic, { root: dist, wildcard: false });
  app.setNotFoundHandler((req, reply) => reply.sendFile('index.html'));
}

const port = Number(process.env.API_PORT ?? 8787);
await app.listen({ port, host: process.env.API_HOST ?? '127.0.0.1' });
