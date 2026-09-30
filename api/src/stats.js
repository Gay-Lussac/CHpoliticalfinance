// Privacy-friendly visit statistics (docs/05 › Visit statistics).
// Stored: daily counts per page / language / referring site. Never stored: IP, user agent, cookies.
// Unique visitors: a daily-salted hash of IP + user agent lives in memory only, for the current day.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { LANGS } from './labels.js';

const PAGES_WITH_ID = new Set(['vote', 'election', 'actor', 'donor']);
const PAGES = new Set(['', 'votes', 'elections', 'parties', 'explore', 'about', ...PAGES_WITH_ID]);
const BOT = /bot|crawl|spider|slurp|preview|fetch|curl|wget|python|headless|monitor|lighthouse|scan/i;

/** '/fr/vote/30?phase=final' → { lang: 'fr', page: 'vote/30' }. Anything unexpected → 'other'. */
export function normalisePath(raw) {
  const path = String(raw ?? '').split(/[?#]/)[0].slice(0, 200);
  const [lang, page = '', id] = path.split('/').filter(Boolean);
  const l = LANGS.includes(lang) ? lang : 'xx';
  if (!PAGES.has(page)) return { lang: l, page: 'other' };
  if (PAGES_WITH_ID.has(page)) return { lang: l, page: /^\d{1,9}$/.test(id ?? '') ? `${page}/${id}` : 'other' };
  return { lang: l, page: page || 'home' };
}

/** External referrer host only ('' for direct visits or navigation within the site). */
export function referrerHost(raw, ownHost) {
  try {
    const h = new URL(String(raw)).hostname.toLowerCase().replace(/^www\./, '');
    const own = String(ownHost ?? '').toLowerCase().split(':')[0].replace(/^www\./, '');
    return h && h !== own ? h.slice(0, 100) : '';
  } catch {
    return '';
  }
}

export const isBot = (ua) => !ua || BOT.test(ua);

export class Stats {
  constructor(pool, db, log) {
    this.pool = pool;
    this.db = db;                 // stats database name (separate from the main DB)
    this.log = log;
    this.enabled = Boolean(db);
    this.day = null;
    this.salt = null;
    this.seen = new Set();
    this.rate = new Map();        // hashed client → hits this minute (anti-spam)
  }

  #today() {
    const day = new Date().toISOString().slice(0, 10);
    if (day !== this.day) {       // new day: new salt, forget yesterday's fingerprints
      this.day = day;
      this.salt = randomBytes(16);
      this.seen.clear();
    }
    return day;
  }

  async record({ path, ref, ip, ua, dnt, host }) {
    if (!this.enabled || dnt === '1' || isBot(ua)) return;
    const day = this.#today();
    const fp = createHash('sha256').update(this.salt).update(String(ip)).update(String(ua)).digest('base64url');
    const minute = Math.floor(Date.now() / 60_000);
    const r = this.rate.get(fp);
    const count = r && r.minute === minute ? r.count + 1 : 1;
    this.rate.set(fp, { minute, count });
    if (this.rate.size > 50_000) this.rate.clear();
    if (count > 60) return;                                   // >60 page views/minute from one client: ignore
    const { lang, page } = normalisePath(path);
    const referrer = referrerHost(ref, host);
    const t = (name) => `\`${this.db}\`.\`${name}\``;
    try {
      await this.pool.query(
        `INSERT INTO ${t('page_view_daily')} (day, page, lang, referrer, views) VALUES (?,?,?,?,1)
         ON DUPLICATE KEY UPDATE views = views + 1`, [day, page, lang, referrer]);
      if (!this.seen.has(fp)) {
        this.seen.add(fp);
        await this.pool.query(
          `INSERT INTO ${t('visitor_daily')} (day, visitors) VALUES (?,1) ON DUPLICATE KEY UPDATE visitors = visitors + 1`,
          [day]);
      }
    } catch (err) {
      // Stats must never break the site: a missing stats DB or grant just disables counting.
      if (['ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE', 'ER_TABLEACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR'].includes(err.code)) {
        this.enabled = false;
        this.log.warn(`visit statistics disabled: ${err.code} (see docs/05 › Visit statistics)`);
      } else {
        this.log.error(err);
      }
    }
  }

  async summary(days, lang, resolvePages) {
    const t = (name) => `\`${this.db}\`.\`${name}\``;
    const since = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
    const q = async (sql, args = []) => (await this.pool.query(sql, [since, ...args]))[0];
    const [perDay, visitors, pages, langs, referrers, [totals]] = await Promise.all([
      q(`SELECT day, SUM(views) AS views FROM ${t('page_view_daily')} WHERE day >= ? GROUP BY day ORDER BY day`),
      q(`SELECT day, visitors FROM ${t('visitor_daily')} WHERE day >= ? ORDER BY day`),
      q(`SELECT page, SUM(views) AS views FROM ${t('page_view_daily')} WHERE day >= ? GROUP BY page ORDER BY views DESC LIMIT 20`),
      q(`SELECT lang, SUM(views) AS views FROM ${t('page_view_daily')} WHERE day >= ? GROUP BY lang ORDER BY views DESC`),
      q(`SELECT referrer, SUM(views) AS views FROM ${t('page_view_daily')} WHERE day >= ? AND referrer <> ''
          GROUP BY referrer ORDER BY views DESC LIMIT 15`),
      q(`SELECT COALESCE(SUM(views),0) AS views,
                (SELECT COALESCE(SUM(visitors),0) FROM ${t('visitor_daily')} WHERE day >= ?) AS visitors
           FROM ${t('page_view_daily')} WHERE day >= ?`, [since]),
    ]);
    const byDay = new Map(perDay.map((d) => [String(d.day).slice(0, 10), { day: String(d.day).slice(0, 10), views: Number(d.views), visitors: 0 }]));
    for (const v of visitors) {
      const k = String(v.day).slice(0, 10);
      byDay.set(k, { ...(byDay.get(k) ?? { day: k, views: 0 }), visitors: Number(v.visitors) });
    }
    return {
      days, since,
      totals: { views: Number(totals.views), visitors: Number(totals.visitors) },
      per_day: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
      pages: await resolvePages(pages.map((p) => ({ page: p.page, views: Number(p.views) })), lang),
      langs: langs.map((l) => ({ lang: l.lang, views: Number(l.views) })),
      referrers: referrers.map((r) => ({ referrer: r.referrer, views: Number(r.views) })),
    };
  }
}

/** Constant-time comparison of the stats key. */
export function tokenOk(given, expected) {
  if (!expected || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}
