// View specs (config/views/*.yaml) → query → chart. See config/views/README.md.
import * as Plot from '@observablehq/plot';
import { parse as parseYaml } from 'yaml';

import { query, type QuerySpec, type Row } from './api';
import { chf, chfShort, date as fmtDate, esc } from './format';
import { lang, locale, T, tr } from './i18n';
import { href } from './router';

type Text = Record<string, string>;
export interface ViewSpec {
  id: string;
  title: Text;
  subtitle?: Text;
  note?: Text;                                   // disclaimer / method note shown above the chart
  query: QuerySpec;
  params?: Record<string, string>;
  show_if?: Record<string, unknown>;             // render only when every page-context key matches
  chart: {
    type: 'bars' | 'stacked' | 'columns' | 'dots' | 'table' | 'share';
    label?: string; value?: string; series?: string[]; color?: string; link?: string; columns?: string[];
  };
}

const files = import.meta.glob('../../config/views/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
export const PAGES: Record<string, ViewSpec[]> = Object.fromEntries(
  Object.entries(files).map(([path, raw]) => [path.split('/').pop()!.replace('.yaml', ''), parseYaml(raw) as ViewSpec[]]),
);

const txt = (t?: Text) => (t ? t[lang()] ?? t.fr ?? Object.values(t)[0] : '');

// ------------------------------------------------------------------ colours (resolved from CSS tokens)

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function colorOf(dim: string | undefined, row: Row): string {
  if (!dim) return cssVar('--series-1');
  const v = row[dim];
  if (dim === 'stance') return v === 'for' ? cssVar('--series-1') : v === 'against' ? cssVar('--series-2') : cssVar('--neutral');
  if (dim === 'phase') return v === 'budget' ? cssVar('--phase-budget') : cssVar('--phase-final');
  if (dim === 'party_id') return row.party_id_info?.color ?? cssVar('--neutral');
  if (dim === 'recommender_id') return row.recommender_id_info?.color ?? cssVar('--neutral');
  return cssVar('--series-1');
}
const seriesColor = (i: number) => cssVar(`--series-${(i % 7) + 1}`);

// ------------------------------------------------------------------ labels & links

function labelOf(col: string, row: Row): string {
  const v = row[col];
  if (row[`${col}_label`] != null) return String(row[`${col}_label`]);
  if (col === 'party_id' && v == null) return T().unknown_party;
  if (col === 'canton' && v == null) return T().national;
  if (col.endsWith('_date') || col === 'granted_on') return fmtDate(v);
  return tr(v);
}

function linkOf(entity: string | undefined, col: string, row: Row): string | null {
  const id = row[col];
  if (!entity || id == null) return null;
  if (entity === 'financing') {
    const kind = row[`${col}_info`]?.kind;
    if (kind === 'party_year') return href(`parties?year=${row[`${col}_info`]?.year}`);
    return href(`${kind === 'election' ? 'election' : 'vote'}/${id}`);
  }
  return href(`${entity}/${id}`);
}

function cell(col: string, row: Row, entityLinks = true): string {
  const v = row[col];
  if (v == null) return '—';
  if (/(^value_chf$|^total$|allowances$|^events$|^sales$|^equity$|fees$|contributions$|^amount_chf$|^sum_|^max_)/.test(col)) {
    return `<span class="num">${chf(v)}</span>`;
  }
  if (col === 'count' || col.startsWith('count_')) return `<span class="num">${v}</span>`;
  const label = esc(labelOf(col, row));
  const entity = { financing_id: 'financing', actor_id: 'actor', donor_id: 'donor' }[col];
  const link = entityLinks ? linkOf(entity, col, row) : null;
  return link ? `<a href="${link}" data-link>${label}</a>` : label;
}

function colTitle(col: string): string {
  const base = col.replace(/^(sum|count_distinct|max)_/, '').replace(/_id$/, '');
  const map: Record<string, string> = { financing: T().financing, value_chf: T().amount, amount_chf: T().amount,
    granted_on: T().date, event_date: T().date, count: T().count, canton: T().canton };
  return map[base] ?? map[col] ?? tr(base);
}

// ------------------------------------------------------------------ chart renderers

function legend(items: { label: string; color: string }[]): string {
  if (items.length < 2) return '';
  return `<ul class="legend">${items.map((i) => `<li><span class="swatch" style="background:${i.color}"></span>${esc(i.label)}</li>`).join('')}</ul>`;
}

const ORDER = ['for', 'against', 'candidates', 'none', 'budget', 'final', 'annual'];
const byCanonical = (dim: string | undefined) => (a: Row, b: Row) =>
  dim === 'party_id' ? 0 : ORDER.indexOf(String(a[dim!])) - ORDER.indexOf(String(b[dim!]));

function uniqueBy<T>(xs: T[], key: (x: T) => unknown): T[] {
  const seen = new Set();
  return xs.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)));
}

/** Ranked horizontal bars in HTML: readable labels on any width, value at the tip. */
function renderBars(spec: ViewSpec, rows: Row[]): string {
  const { label = '', value = '', color, link } = spec.chart;
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = String(r[label]);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const max = Math.max(...rows.map((r) => Number(r[value]) || 0), 1);
  const showSub = !!color && color !== label;
  const legendItems = showSub
    ? uniqueBy([...rows].sort(byCanonical(color)), (r) => r[color!]).map((r) => ({ label: labelOf(color!, r), color: colorOf(color, r) }))
    : [];
  const html = [...groups.values()].map((grp) => {
    const first = grp[0];
    const name = esc(labelOf(label, first));
    const url = linkOf(link, label, first);
    const bars = [...grp].sort(byCanonical(color)).map((r) => {
      const v = Number(r[value]) || 0;
      const w = Math.max(0.004, v / max); // fraction of (row width − room for the value label)
      const extra = r.count != null ? ` · ${r.count} ${T().allowances}` : '';
      const tip = `${labelOf(label, r)}${showSub ? ` — ${labelOf(color!, r)}` : ''}: ${chf(v)}${extra}`;
      return `<div class="bar-row" data-tip="${esc(tip)}" tabindex="0">
        <span class="bar" style="width:calc((100% - var(--label-room)) * ${w.toFixed(4)});background:${colorOf(color, r)}"></span>
        <span class="bar-value">${chfShort(v)}</span></div>`;
    }).join('');
    return `<li><div class="bar-label">${url ? `<a href="${url}" data-link>${name}</a>` : name}</div>${bars}</li>`;
  }).join('');
  return legend(legendItems) + `<ol class="bars">${html}</ol>`;
}

/** Percentages (0–100) on a fixed scale, e.g. alignment. `value` is the % column; the tip adds the base amount. */
function renderShare(spec: ViewSpec, rows: Row[]): string {
  const { label = '', value = '', color } = spec.chart;
  const html = rows.map((r) => {
    const v = Math.max(0, Math.min(100, Number(r[value]) || 0));
    const pctTxt = `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(v)} %`;
    const base = r.sum_value_chf != null ? chf(r.sum_value_chf) : '';
    const n = r.count_distinct_financing_id;
    const tipText = `${labelOf(label, r)}: ${pctTxt}${base ? ` — ${T().alignment_of} ${base}` : ''}${n ? ` · ${T().votes_n(n)}` : ''}`;
    return `<li><div class="bar-label">${esc(labelOf(label, r))}${n ? ` <span class="muted small">· ${esc(T().votes_n(n))}</span>` : ''}</div>
      <div class="bar-row" data-tip="${esc(tipText)}" tabindex="0">
        <span class="share-track"><span class="bar" style="width:${v}%;background:${colorOf(color, r)}"></span></span>
        <span class="bar-value">${pctTxt}</span></div></li>`;
  }).join('');
  return `<ol class="bars share">${html}</ol>`;
}

/** Horizontal stacked bars, one segment per measure (fixed categorical order). */
function renderStacked(spec: ViewSpec, rows: Row[]): string {
  const { label = '', series = [], link } = spec.chart;
  if (label === 'stance' || label === 'phase') rows = [...rows].sort(byCanonical(label));
  const totals = rows.map((r) => series.reduce((s, k) => s + (Number(r[k]) || 0), 0));
  const max = Math.max(...totals, 1);
  const legendItems = series.map((s, i) => ({ label: tr(s), color: seriesColor(i) }));
  const html = rows.map((r, idx) => {
    const url = linkOf(link, label, r);
    const name = esc(labelOf(label, r));
    const segs = series.map((s, i) => {
      const v = Number(r[s]) || 0;
      if (v <= 0) return '';
      return `<span class="seg" tabindex="0" style="flex:${v} 1 0;background:${seriesColor(i)}"
        data-tip="${esc(`${labelOf(label, r)} — ${tr(s)}: ${chf(v)}`)}"></span>`;
    }).join('');
    return `<li><div class="bar-label">${url ? `<a href="${url}" data-link>${name}</a>` : name}</div>
      <div class="bar-row"><span class="stack" style="width:calc((100% - var(--label-room)) * ${(totals[idx] / max).toFixed(4)})">${segs}</span>
      <span class="bar-value">${chfShort(totals[idx])}</span></div></li>`;
  }).join('');
  return legend(legendItems) + `<ol class="bars">${html}</ol>`;
}

function plotTheme(width: number) {
  return {
    width, height: Math.max(220, Math.min(360, width * 0.5)),
    marginLeft: 64, marginBottom: 56,
    style: { background: 'transparent', color: cssVar('--text-secondary'), fontFamily: 'inherit', fontSize: '12px' },
  };
}

/** Vertical columns (Observable Plot), stacked by the colour dimension. */
function renderColumns(spec: ViewSpec, rows: Row[], el: HTMLElement) {
  const { label = '', value = '', color, link } = spec.chart;
  const isFinancing = label === 'financing_id';
  const data = [...rows].sort(byCanonical(color)).map((r) => ({
    ...r,
    _x: isFinancing ? `${r.financing_id_info?.date ?? ''}|${r.financing_id}` : String(r[label]),
    _v: Number(r[value]) || 0,
    _c: color ? labelOf(color, r) : '',
    _fill: colorOf(color, r),
    _tip: `${labelOf(label, r)}${color ? ` — ${labelOf(color, r)}` : ''}\n${chf(Number(r[value]))}`,
  }));
  const xs = [...new Set(data.map((d) => d._x))].sort();
  const width = el.clientWidth || 640;
  const chart = Plot.plot({
    ...plotTheme(width),
    x: { domain: xs, label: null, tickFormat: (d: string) => (isFinancing ? fmtShortDate(d.split('|')[0]) : d),
      tickRotate: isFinancing && xs.length > 8 ? -45 : 0 },
    y: { grid: true, label: null, tickFormat: (d: number) => chfShort(d).replace('CHF ', '') },
    marks: [
      Plot.barY(data, Plot.stackY({ x: '_x', y: '_v', fill: '_fill', inset: 1, rx: 2, title: '_tip' })),
      Plot.ruleY([0], { stroke: cssVar('--axis') }),
    ],
  });
  const legendItems = color ? uniqueBy(data, (d) => d._c).map((d) => ({ label: d._c, color: d._fill })) : [];
  el.innerHTML = legend(legendItems);
  el.append(chart);
  wireSvgTips(chart);
  if (link) {
    chart.querySelectorAll('rect').forEach((rect, i) => {
      const d = data[(rect as any).__data__ ?? i];
      const url = d ? linkOf(link, label, d) : null;
      if (url) { rect.setAttribute('style', 'cursor:pointer'); rect.addEventListener('click', () => navigateTo(url)); }
    });
  }
}

function renderDots(spec: ViewSpec, rows: Row[], el: HTMLElement) {
  const { label = 'granted_on', value = 'value_chf', color } = spec.chart;
  const data = rows.filter((r) => r[label]).map((r) => ({ d: new Date(r[label]), v: Number(r[value]), fill: colorOf(color, r),
    tip: `${fmtDate(r[label])}\n${chf(Number(r[value]))}` }));
  const chart = Plot.plot({
    ...plotTheme(el.clientWidth || 640),
    y: { grid: true, label: null, tickFormat: (d: number) => chfShort(d).replace('CHF ', '') },
    x: { label: null },
    marks: [Plot.dot(data, { x: 'd', y: 'v', fill: 'fill', r: 5, stroke: cssVar('--surface'), strokeWidth: 2, title: 'tip' })],
  });
  el.innerHTML = '';
  el.append(chart);
  wireSvgTips(chart);
}

const fmtShortDate = (iso: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}` : '');

function renderTable(columns: string[], rows: Row[]): string {
  if (!rows.length) return `<p class="muted">${T().no_rows}</p>`;
  return `<div class="table-wrap"><table><thead><tr>${columns.map((c) => `<th>${esc(colTitle(c))}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td>${cell(c, r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// ------------------------------------------------------------------ CSV

export function toCsv(columns: string[], rows: Row[]): string {
  const q = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cols = columns.flatMap((c) => (rows.some((r) => r[`${c}_label`] != null) ? [c, `${c}_label`] : [c]));
  return [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n');
}

export function downloadCsv(name: string, columns: string[], rows: Row[]) {
  const blob = new Blob(['﻿' + toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${name}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

// ------------------------------------------------------------------ tooltips

let tipEl: HTMLDivElement | null = null;
function tip(): HTMLDivElement {
  if (!tipEl) {
    tipEl = Object.assign(document.createElement('div'), { className: 'tooltip', role: 'tooltip' });
    document.body.append(tipEl);
  }
  return tipEl;
}
function showTip(text: string, x: number, y: number) {
  const t = tip();
  t.textContent = text;
  t.style.display = 'block';
  const w = t.offsetWidth;
  t.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2))}px`;
  t.style.top = `${y - t.offsetHeight - 12 + window.scrollY}px`;
}
const hideTip = () => { if (tipEl) tipEl.style.display = 'none'; };

export function wireTips(root: HTMLElement) {
  root.addEventListener('pointerover', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (t) { const r = t.getBoundingClientRect(); showTip(t.dataset.tip!, e.clientX || r.left + r.width / 2, r.top); }
  });
  root.addEventListener('pointerout', hideTip);
  root.addEventListener('focusin', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (t) { const r = t.getBoundingClientRect(); showTip(t.dataset.tip!, r.left + r.width / 2, r.top); }
  });
  root.addEventListener('focusout', hideTip);
}

function wireSvgTips(svg: Element) {
  // Move Plot's <title> into data-tip so SVG marks share the HTML tooltip.
  svg.querySelectorAll('title').forEach((t) => {
    const parent = t.parentElement;
    if (parent) { parent.setAttribute('data-tip', t.textContent ?? ''); t.remove(); }
  });
}

let navigateTo: (url: string) => void = (url) => { location.href = url; };
export const setNavigator = (fn: (url: string) => void) => { navigateTo = fn; };

// ------------------------------------------------------------------ view

export function buildQuery(spec: ViewSpec, context: Record<string, unknown>): QuerySpec | null {
  const filter: Record<string, unknown> = { ...(spec.query.filter ?? {}) };
  for (const [field, key] of Object.entries(spec.params ?? {})) {
    if (context[key] !== undefined && context[key] !== null) filter[field] = context[key];
  }
  return { ...spec.query, filter };
}

export async function renderView(spec: ViewSpec, context: Record<string, unknown>): Promise<HTMLElement> {
  const section = document.createElement('section');
  section.className = 'view card';
  section.id = spec.id;
  section.innerHTML = `<header><h2>${esc(txt(spec.title))}</h2>${spec.subtitle ? `<p class="muted">${esc(txt(spec.subtitle))}</p>` : ''}</header>
    ${spec.note ? `<aside class="view-note" role="note">ⓘ ${esc(txt(spec.note))}</aside>` : ''}
    <div class="view-body"><p class="muted">${T().loading}</p></div>
    <footer class="view-footer"></footer>`;
  const body = section.querySelector<HTMLElement>('.view-body')!;
  const footer = section.querySelector<HTMLElement>('.view-footer')!;
  const q = buildQuery(spec, context)!;
  try {
    const res = await query(q);
    const rows = res.rows;
    if (!rows.length) {
      body.innerHTML = `<p class="muted">${T().no_rows}</p>`;
      return section;
    }
    const draw = () => {
      switch (spec.chart.type) {
        case 'bars': body.innerHTML = renderBars(spec, rows); break;
        case 'stacked': body.innerHTML = renderStacked(spec, rows); break;
        case 'share': body.innerHTML = renderShare(spec, rows); break;
        case 'columns': renderColumns(spec, rows, body); break;
        case 'dots': renderDots(spec, rows, body); break;
        default: body.innerHTML = renderTable(spec.chart.columns ?? res.columns, rows);
      }
    };
    draw();
    if (spec.chart.type === 'columns' || spec.chart.type === 'dots') {
      let w = 0;
      new ResizeObserver(() => { if (Math.abs(body.clientWidth - w) > 40) { w = body.clientWidth; draw(); } }).observe(body);
    }
    const tableCols = res.columns;
    footer.innerHTML = `${spec.chart.type !== 'table' ? `<button class="link-btn" data-toggle>${T().show_data}</button>` : ''}
      <button class="link-btn" data-csv>${T().download_csv}</button>
      ${res.total > rows.length ? `<span class="muted">${T().rows_shown(rows.length, res.total)}</span>` : ''}
      <div class="data-table" hidden></div>`;
    footer.querySelector('[data-toggle]')?.addEventListener('click', (e) => {
      const box = footer.querySelector<HTMLElement>('.data-table')!;
      box.hidden = !box.hidden;
      if (!box.hidden && !box.innerHTML) box.innerHTML = renderTable(tableCols, rows);
      (e.target as HTMLElement).textContent = box.hidden ? T().show_data : T().hide_data;
    });
    footer.querySelector('[data-csv]')!.addEventListener('click', () => downloadCsv(spec.id, tableCols, rows));
  } catch (e) {
    body.innerHTML = `<p class="error">${T().error} (${esc((e as Error).message)})</p>`;
  }
  return section;
}

/** Render a list of views into a container, in order, without waiting for each other. */
export function renderViews(container: HTMLElement, allSpecs: ViewSpec[], context: Record<string, unknown>) {
  const specs = allSpecs.filter((s) => !s.show_if || Object.entries(s.show_if).every(([k, v]) => context[k] === v));
  const slots = specs.map(() => container.appendChild(document.createElement('div')));
  specs.forEach((s, i) => renderView(s, context).then((el) => slots[i].replaceWith(el)));
}

export { renderTable, cell, colTitle, labelOf };
