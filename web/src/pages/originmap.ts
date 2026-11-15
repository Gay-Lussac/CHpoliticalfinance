// Homepage map: where named donations come from, by the donor's canton (matched from the town in the declarations to
// the official municipality list), as a total or per registered voter. Single-hue sequential scale, five classes.
import * as Plot from '@observablehq/plot';

import { get } from '../api';
import { chf, chfShort, esc } from '../format';
import { lang, locale, type Lang } from '../i18n';
import { cssVar, wireSvgTips } from '../views';
import { hex, loadGeo, mix, toLab } from './cantonmap';

interface Origin { origin: string; total: number; donors: number; voters: number | null }
type Mode = 'total' | 'per_voter';

const TEXT: Record<Lang, {
  title: string; lead: string; total: string; per_voter: string; tip: (c: string, v: string, d: number, pv: string) => string;
  rest: (abroad: string, unknown: string, unnamed: string) => string; note: string; source: string; per: string;
}> = {
  fr: {
    title: "D'où vient l'argent", lead: 'Dons nommés (plus de 15 000 CHF) selon le canton de la donatrice ou du donateur, toutes votations, élections et années de partis confondues.',
    total: 'Total', per_voter: 'Par électeur·rice inscrit·e',
    tip: (c, v, d, pv) => `${c} : ${v} de ${d} ${d > 1 ? 'donateur·rice·s' : 'donateur·rice'}${pv ? ` · ${pv} par électeur·rice` : ''}`,
    rest: (a, u, n) => `En plus : ${a} de l'étranger, ${u} de localités qu'on ne peut pas attribuer à un canton${n ? `, ${n} de dons non nominatifs` : ''}.`,
    note: "Le canton est déduit de la localité indiquée dans la déclaration (siège pour une entreprise ou une association). Seuls les dons de plus de 15 000 CHF sont nommés : les petits dons n'y figurent pas.",
    source: 'Données : Contrôle fédéral des finances ; communes et électeur·rice·s inscrit·e·s : Office fédéral de la statistique. Fond de carte : OFS / swisstopo, via swiss-maps.', per: 'par électeur·rice',
  },
  de: {
    title: 'Woher das Geld kommt', lead: 'Namentliche Zuwendungen (über 15 000 CHF) nach Kanton der Spenderin oder des Spenders, über alle Abstimmungen, Wahlen und Parteijahre.',
    total: 'Total', per_voter: 'Pro stimmberechtigte Person',
    tip: (c, v, d, pv) => `${c}: ${v} von ${d} Zuwendenden${pv ? ` · ${pv} pro Stimmberechtigte` : ''}`,
    rest: (a, u, n) => `Dazu: ${a} aus dem Ausland, ${u} von Orten, die keinem Kanton zugeordnet werden können${n ? `, ${n} nicht namentliche Zuwendungen` : ''}.`,
    note: 'Der Kanton wird aus dem Ort in der Deklaration abgeleitet (Sitz bei Firmen und Verbänden). Nur Zuwendungen über 15 000 CHF sind namentlich: Kleinspenden fehlen hier.',
    source: 'Daten: Eidgenössische Finanzkontrolle; Gemeinden und Stimmberechtigte: Bundesamt für Statistik. Kartengrundlage: BFS / swisstopo, via swiss-maps.', per: 'pro Stimmberechtigte',
  },
  it: {
    title: 'Da dove vengono i soldi', lead: 'Liberalità nominative (oltre 15 000 CHF) secondo il cantone di chi dona, per tutte le votazioni, elezioni e anni dei partiti.',
    total: 'Totale', per_voter: 'Per avente diritto di voto',
    tip: (c, v, d, pv) => `${c}: ${v} da ${d} ${d > 1 ? 'donatori' : 'donatore'}${pv ? ` · ${pv} per avente diritto` : ''}`,
    rest: (a, u, n) => `Inoltre: ${a} dall'estero, ${u} da località non attribuibili a un cantone${n ? `, ${n} di liberalità non nominative` : ''}.`,
    note: "Il cantone è dedotto dalla località indicata nella dichiarazione (sede per aziende e associazioni). Solo le liberalità oltre 15 000 CHF sono nominative: le piccole donazioni non figurano.",
    source: 'Dati: Controllo federale delle finanze; comuni e aventi diritto di voto: Ufficio federale di statistica. Base cartografica: UST / swisstopo, tramite swiss-maps.', per: 'per avente diritto',
  },
  en: {
    title: 'Where the money comes from', lead: "Named donations (over CHF 15,000) by the donor's canton, across all votes, elections and party years.",
    total: 'Total', per_voter: 'Per registered voter',
    tip: (c, v, d, pv) => `${c}: ${v} from ${d} ${d > 1 ? 'donors' : 'donor'}${pv ? ` · ${pv} per registered voter` : ''}`,
    rest: (a, u, n) => `Also: ${a} from abroad, ${u} from places that cannot be attributed to a canton${n ? `, ${n} in unnamed donations` : ''}.`,
    note: 'The canton is derived from the town given in the declaration (head office for companies and associations). Only donations over CHF 15,000 are named: small donations are not included.',
    source: 'Data: Swiss Federal Audit Office; municipalities and registered voters: Federal Statistical Office. Base map: FSO / swisstopo, via swiss-maps.', per: 'per registered voter',
  },
};

// Class breaks: totals in CHF, and CHF per registered voter.
const BREAKS: Record<Mode, number[]> = { total: [250_000, 1_000_000, 3_000_000, 10_000_000], per_voter: [1, 3, 10, 30] };

export async function originMapCard(container: HTMLElement) {
  const [rows, fc] = await Promise.all([get<Origin[]>('money-origin').catch(() => [] as Origin[]), loadGeo()]);
  const cantons = rows.filter((r) => /^[A-Z]{2}$/.test(r.origin));
  if (!cantons.length || !fc) return;
  const m = TEXT[lang()];
  const by = new Map(cantons.map((r) => [r.origin, r]));
  const sum = (o: string) => rows.filter((r) => r.origin === o).reduce((s, r) => s + r.total, 0);
  const perVoter = (r: Origin) => (r.voters ? r.total / r.voters : null);
  const chf2 = (v: number) => `CHF ${new Intl.NumberFormat(locale(), { maximumFractionDigits: v < 10 ? 2 : 0 }).format(v)}`;
  let mode: Mode = 'total';

  const section = document.createElement('section');
  section.className = 'card cmap origin-map';
  section.innerHTML = `<h2>${esc(m.title)}</h2><p>${esc(m.lead)}</p>
    <div class="segmented" role="group" aria-label="${esc(m.title)}"><a href="#" data-mode="total" class="active">${esc(m.total)}</a><a href="#" data-mode="per_voter">${esc(m.per_voter)}</a></div>
    <div class="cmap-figure"><div class="cmap-chart"></div><div class="cmap-legend"></div></div>
    <p class="small">${esc(m.rest(chfShort(sum('abroad')), chfShort(sum('unknown')), sum('unnamed') ? chfShort(sum('unnamed')) : ''))}</p>
    <p class="muted small">${esc(m.note)}</p><p class="muted small">${esc(m.source)}</p>`;
  container.append(section);
  const chart = section.querySelector<HTMLElement>('.cmap-chart')!;
  const legend = section.querySelector<HTMLElement>('.cmap-legend')!;

  const draw = () => {
    const neutral = cssVar('--surface-2') || '#f4f4f4';
    const hue = cssVar('--series-7') || '#4a3aa7';
    const ink = cssVar('--text-primary') || '#1a1a1a';
    // Five steps of one hue, light -> dark (dark -> light in dark mode, where the ink is light).
    const ramp = [mix(neutral, hue, 0.42), mix(neutral, hue, 0.62), mix(neutral, hue, 0.82), hue, mix(hue, ink, 0.35)];   // validated, light + dark
    const breaks = BREAKS[mode];
    const value = (code: string) => { const r = by.get(code); return !r ? null : mode === 'total' ? r.total : perVoter(r); };
    const colour = (v: number | null) => (v == null || v <= 0 ? neutral : ramp[breaks.filter((b) => v >= b).length]);
    const fmt = (v: number) => (mode === 'total' ? chfShort(v) : chf2(v));
    const width = chart.clientWidth || 640;
    const shapes = fc.features.filter((f: any) => f.properties.layer === 'canton');
    const lakes = fc.features.filter((f: any) => f.properties.layer === 'lake');
    chart.replaceChildren(Plot.plot({
      width, height: Math.round(width * 0.64), margin: 4,
      projection: { type: 'mercator', domain: { type: 'FeatureCollection', features: shapes } },
      style: { background: 'transparent', color: cssVar('--text-secondary'), fontFamily: 'inherit', fontSize: '11px' },
      marks: [
        Plot.geo(shapes, { fill: (f: any) => colour(value(f.properties.code)), stroke: cssVar('--surface'), strokeWidth: 1.2,
          title: (f: any) => { const r = by.get(f.properties.code); const pv = r && perVoter(r);
            return r ? m.tip(f.properties.code, chf(r.total), r.donors, pv != null ? chf2(pv) : '') : f.properties.code; } }),
        Plot.geo(lakes, { fill: cssVar('--lake') || '#cfe0ef', stroke: 'none' }),
        Plot.text(shapes, Plot.centroid({ text: (f: any) => f.properties.code,
          fill: (f: any) => (toLab(hex(colour(value(f.properties.code))))[0] < 0.62 ? '#ffffff' : '#1a1a1a'),
          fontWeight: 600, fontSize: width < 500 ? 8 : 10, pointerEvents: 'none' })),
      ],
    }) as unknown as Node);
    wireSvgTips(chart);
    const labels = [`< ${fmt(breaks[0])}`, ...breaks.slice(0, -1).map((b, i) => `${fmt(b)}–${fmt(breaks[i + 1])}`), `≥ ${fmt(breaks[breaks.length - 1])}`];
    legend.innerHTML = ramp.map((c, i) => `<span class="lg-item"><i style="background:${c}"></i>${esc(labels[i])}</span>`).join('')
      + (mode === 'per_voter' ? `<span class="muted small">${esc(m.per)}</span>` : '');
  };
  draw();
  section.querySelectorAll<HTMLAnchorElement>('[data-mode]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    mode = a.dataset.mode as Mode;
    section.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('active', x === a));
    draw();
  }));
  let w = chart.clientWidth;
  new ResizeObserver(() => { if (Math.abs(chart.clientWidth - w) > 40) { w = chart.clientWidth; draw(); } }).observe(chart);
}
