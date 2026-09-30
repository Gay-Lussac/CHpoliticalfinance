// Private visit statistics (not in the navigation). Needs the STATS_TOKEN key, kept in this browser only.
import * as Plot from '@observablehq/plot';

import { esc, num } from '../format';
import { lang, T } from '../i18n';
import { href } from '../router';

const KEY = 'chpf-stats-key';
const storage = {
  get: () => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } },
  set: (v: string) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* private mode */ } },
};

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export async function statsPage(main: HTMLElement, _id: string | undefined, params: URLSearchParams) {
  const t = T();
  const days = [7, 30, 90, 365].includes(Number(params.get('days'))) ? Number(params.get('days')) : 30;
  let key = storage.get();

  const renderKeyForm = (message = '') => {
    main.innerHTML = `<header class="page-head"><h1>${esc(t.stats_title)}</h1><p class="lead">${esc(t.stats_intro)}</p></header>
      <form class="card stats-key" id="key-form">
        <label>${esc(t.stats_key)} <input type="password" name="key" autocomplete="current-password" required /></label>
        <button type="submit">${esc(t.stats_open)}</button>
        ${message ? `<p class="error">${esc(message)}</p>` : ''}
      </form>`;
    main.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      storage.set(String(new FormData(e.target as HTMLFormElement).get('key') ?? '').trim());
      statsPage(main, _id, params);
    });
  };
  if (!key) return renderKeyForm();

  main.innerHTML = `<p class="muted">${t.loading}</p>`;
  const res = await fetch(`/api/stats?days=${days}&lang=${lang()}`, { headers: { Authorization: `Bearer ${key}` } });
  if (res.status === 401) { storage.set(''); return renderKeyForm(t.stats_bad_key); }
  if (!res.ok) { main.innerHTML = `<p class="error">${esc(res.status === 503 ? t.stats_not_configured : t.error)}</p>`; return; }
  const s = await res.json();

  const pageLabel = (p: { page: string; label: string | null }) => {
    if (p.label) return p.label;
    const names: Record<string, string> = { home: t.site_title, votes: t.nav_votes, elections: t.nav_elections,
      parties: t.nav_parties, explore: t.nav_explore, about: t.nav_about, other: t.stats_other };
    return names[p.page] ?? p.page;
  };
  const pageLink = (p: { page: string }) => (p.page === 'other' ? null : href(p.page === 'home' ? '' : p.page));
  const table = (head: string[], rows: string[][]) => rows.length
    ? `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
       <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    : `<p class="muted">${esc(t.no_rows)}</p>`;

  main.innerHTML = `<header class="page-head"><h1>${esc(t.stats_title)}</h1>
      <p class="muted small">${esc(t.stats_intro)}</p>
      <div class="segmented" role="group">${[7, 30, 90, 365].map((d) =>
        `<a href="${href(`stats?days=${d}`)}" class="${d === days ? 'active' : ''}">${esc(t.stats_days(d))}</a>`).join('')}</div>
      <button class="link-btn" id="forget">${esc(t.stats_forget)}</button>
    </header>
    <div class="stats">
      <div class="stat"><div class="stat-label">${esc(t.stats_visitors)}</div><div class="stat-value">${num(s.totals.visitors)}</div>
        <div class="stat-sub muted">${esc(t.stats_visitors_hint)}</div></div>
      <div class="stat"><div class="stat-label">${esc(t.stats_views)}</div><div class="stat-value">${num(s.totals.views)}</div></div>
    </div>
    <section class="card view"><header><h2>${esc(t.stats_per_day)}</h2></header><div id="per-day"></div></section>
    <div class="views-grid">
      <section class="card view"><header><h2>${esc(t.stats_top_pages)}</h2></header>
        ${table([t.stats_page, t.stats_views], s.pages.map((p: any) => {
          const link = pageLink(p);
          return [link ? `<a href="${link}">${esc(pageLabel(p))}</a>` : esc(pageLabel(p)), `<span class="num">${num(p.views)}</span>`];
        }))}</section>
      <section class="card view"><header><h2>${esc(t.stats_referrers)}</h2><p class="muted">${esc(t.stats_referrers_hint)}</p></header>
        ${table([t.stats_site, t.stats_views], s.referrers.map((r: any) => [esc(r.referrer), `<span class="num">${num(r.views)}</span>`]))}</section>
      <section class="card view"><header><h2>${esc(t.stats_languages)}</h2></header>
        ${table([t.stats_language, t.stats_views], s.langs.map((l: any) => [esc(l.lang.toUpperCase()), `<span class="num">${num(l.views)}</span>`]))}</section>
    </div>`;

  main.querySelector('#forget')!.addEventListener('click', () => { storage.set(''); renderKeyForm(); });

  // Views (bars) and visitors (line) per day, same unit, one axis
  const el = main.querySelector<HTMLElement>('#per-day')!;
  // One entry per calendar day of the period, so gaps show as zero instead of disappearing
  const byDay = new Map<string, any>(s.per_day.map((d: any) => [d.day, d]));
  const data: { date: Date; views: number; visitors: number }[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(`${s.since}T00:00:00`);
    date.setDate(date.getDate() + i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    data.push({ date, views: byDay.get(key)?.views ?? 0, visitors: byDay.get(key)?.visitors ?? 0 });
  }
  const legend = `<ul class="legend"><li><span class="swatch" style="background:${css('--series-1')}"></span>${esc(t.stats_views)}</li>
    <li><span class="swatch" style="background:${css('--series-2')}"></span>${esc(t.stats_visitors)}</li></ul>`;
  const chart = Plot.plot({
    width: el.clientWidth || 640, height: 240, marginLeft: 40,
    style: { background: 'transparent', color: css('--text-secondary'), fontFamily: 'inherit', fontSize: '12px' },
    x: { type: 'band', label: null, tickFormat: (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`,
      ticks: data.filter((_, i) => i % Math.max(1, Math.ceil(data.length / 10)) === 0).map((d) => d.date), padding: 0.25 },
    y: { grid: true, label: null, domain: [0, Math.max(5, ...data.map((d) => d.views))], nice: true },
    marks: [
      Plot.barY(data, { x: 'date', y: 'views', fill: css('--series-1'), rx: 2, title: (d: any) => `${d.date.toLocaleDateString()}\n${t.stats_views}: ${d.views}\n${t.stats_visitors}: ${d.visitors}` }),
      Plot.line(data, { x: 'date', y: 'visitors', stroke: css('--series-2'), strokeWidth: 2 }),
      Plot.dot(data, { x: 'date', y: 'visitors', fill: css('--series-2'), r: 4, stroke: css('--surface'), strokeWidth: 2 }),
      Plot.ruleY([0], { stroke: css('--axis') }),
    ],
  });
  el.innerHTML = legend;
  el.append(chart);
}
