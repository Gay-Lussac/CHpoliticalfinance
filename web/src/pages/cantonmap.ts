// Map of Switzerland for one vote: each canton's popular result (Federal Statistical Office) or how that canton's
// members of the National Council voted on it, plus a table. Colours: blue = yes / for, orange = no / against, three
// shades each by how clear the majority is. Outlines: public/geo/ch-cantons.json.
import * as Plot from '@observablehq/plot';

import { get } from '../api';
import { esc, num } from '../format';
import { lang, locale, type Lang } from '../i18n';
import { cssVar, wireSvgTips } from '../views';

interface NR { for: number; against: number; abstain: number; absent: number }
interface CantonRow { canton: string; yes_share: number | null; yes: number | null; no: number | null; turnout: number | null;
  provisional: boolean; nr: NR }
interface BallotCantons { anr: string; role: string; outcome: string | null; cantons: CantonRow[] }
type Mode = 'people' | 'nr';

const TEXT: Record<Lang, {
  title: string; lead: string; people: string; nr: string; col_canton: string; col_people: string; col_nr: string; col_gap: string;
  gap: string; same: string; none: string; tip_people: (p: string) => string; tip_nr: (f: number, a: number, o: number) => string;
  legend_yes: string; legend_no: string; legend_nr_for: string; legend_nr_against: string; no_members: string; source: string;
  upcoming: string; provisional: string; nr_short: string;
}> = {
  fr: {
    title: 'Les cantons et leurs élu·e·s', lead: 'Résultat dans chaque canton et vote final de ses conseiller·ère·s nationaux·ales sur le même objet.',
    people: 'Résultat dans le canton', nr: 'Ses conseiller·ère·s nationaux·ales', col_canton: 'Canton', col_people: 'Oui dans le canton',
    col_nr: 'Conseil national (pour / contre)', col_gap: 'Accord', gap: 'élu·e·s à contre-courant', same: 'même avis', none: '–',
    tip_people: (p) => `Peuple : ${p} de oui`, tip_nr: (f, a, o) => `Conseil national : ${f} pour, ${a} contre${o ? `, ${o} abstention ou absence` : ''}`,
    legend_yes: 'Oui', legend_no: 'Non', legend_nr_for: 'Pour', legend_nr_against: 'Contre', no_members: 'aucun vote ou égalité',
    source: 'Résultats : Office fédéral de la statistique (données ouvertes du jour de vote). Votes : Services du Parlement de l’Assemblée fédérale. Fond de carte : OFS / swisstopo, via swiss-maps.',
    upcoming: 'Le peuple n’a pas encore voté : la carte montre pour l’instant les votes des conseiller·ère·s nationaux·ales.',
    provisional: 'Résultats provisoires.', nr_short: 'Conseil national',
  },
  de: {
    title: 'Die Kantone und ihre Gewählten', lead: 'Resultat in jedem Kanton und Schlussabstimmung seiner Nationalratsmitglieder zur selben Vorlage.',
    people: 'Resultat im Kanton', nr: 'Seine Nationalratsmitglieder', col_canton: 'Kanton', col_people: 'Ja im Kanton',
    col_nr: 'Nationalrat (dafür / dagegen)', col_gap: 'Übereinstimmung', gap: 'Gewählte gegen die Kantonsmehrheit', same: 'gleiche Meinung', none: '–',
    tip_people: (p) => `Volk: ${p} Ja`, tip_nr: (f, a, o) => `Nationalrat: ${f} dafür, ${a} dagegen${o ? `, ${o} Enthaltung oder abwesend` : ''}`,
    legend_yes: 'Ja', legend_no: 'Nein', legend_nr_for: 'Dafür', legend_nr_against: 'Dagegen', no_members: 'keine Stimme oder Gleichstand',
    source: 'Resultate: Bundesamt für Statistik (Open Data am Abstimmungstag). Stimmen: Parlamentsdienste der Bundesversammlung. Kartengrundlage: BFS / swisstopo, via swiss-maps.',
    upcoming: 'Das Volk hat noch nicht abgestimmt: Die Karte zeigt vorerst die Stimmen der Nationalratsmitglieder.',
    provisional: 'Provisorische Resultate.', nr_short: 'Nationalrat',
  },
  it: {
    title: 'I cantoni e i loro eletti', lead: 'Risultato in ogni cantone e votazione finale dei suoi consiglieri nazionali sullo stesso oggetto.',
    people: 'Risultato nel cantone', nr: 'I suoi consiglieri nazionali', col_canton: 'Cantone', col_people: 'Sì nel cantone',
    col_nr: 'Consiglio nazionale (favorevoli / contrari)', col_gap: 'Accordo', gap: 'eletti controcorrente', same: 'stessa opinione', none: '–',
    tip_people: (p) => `Popolo: ${p} di sì`, tip_nr: (f, a, o) => `Consiglio nazionale: ${f} favorevoli, ${a} contrari${o ? `, ${o} astensioni o assenze` : ''}`,
    legend_yes: 'Sì', legend_no: 'No', legend_nr_for: 'Favorevoli', legend_nr_against: 'Contrari', no_members: 'nessun voto o parità',
    source: 'Risultati: Ufficio federale di statistica (dati aperti del giorno di voto). Voti: Servizi del Parlamento dell’Assemblea federale. Base cartografica: UST / swisstopo, tramite swiss-maps.',
    upcoming: 'Il popolo non ha ancora votato: per ora la carta mostra i voti dei consiglieri nazionali.',
    provisional: 'Risultati provvisori.', nr_short: 'Consiglio nazionale',
  },
  en: {
    title: 'The cantons and their representatives', lead: "Result in each canton, and the final vote of its National Council members on the same proposal.",
    people: 'Result in the canton', nr: 'Its National Council members', col_canton: 'Canton', col_people: 'Yes in the canton',
    col_nr: 'National Council (for / against)', col_gap: 'Agreement', gap: 'members against the canton majority', same: 'same view', none: '–',
    tip_people: (p) => `People: ${p} yes`, tip_nr: (f, a, o) => `National Council: ${f} for, ${a} against${o ? `, ${o} abstained or absent` : ''}`,
    legend_yes: 'Yes', legend_no: 'No', legend_nr_for: 'For', legend_nr_against: 'Against', no_members: 'no vote or tie',
    source: 'Results: Federal Statistical Office (voting-day open data). Votes: Parliamentary Services of the Federal Assembly. Base map: FSO / swisstopo, via swiss-maps.',
    upcoming: 'The people have not voted yet: for now the map shows the votes of the National Council members.',
    provisional: 'Provisional results.', nr_short: 'National Council',
  },
};
const M = () => TEXT[lang()];

// ---- colours: OKLab mix between a neutral and the yes / no series colours (three steps each side)
const hex = (h: string) => { const v = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255); };
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function toLab([r, g, b]: number[]) {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363015264 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function toHex([L, a, b]: number[]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, gam(c))) * 255).toString(16).padStart(2, '0')).join('')}`;
}
const mix = (a: string, b: string, t: number) => { const A = toLab(hex(a)); const B = toLab(hex(b)); return toHex(A.map((x, i) => x + (B[i] - x) * t)); };

/** Six classes: no ≥ 65 %, 55–65, 50–55 | 50–55, 55–65, ≥ 65 % yes. Each side: a lighter shade, the series colour, and a
 *  stronger shade (towards the text colour). Validated per side with the dataviz checker, light and dark. */
function palette() {
  const neutral = cssVar('--surface-2') || '#f4f4f4';
  const ink = cssVar('--text-primary') || '#1a1a1a';
  const side = (c: string) => [mix(neutral, c, 0.7), c, mix(c, ink, 0.35)];
  const [no, yes] = [side(cssVar('--series-2')), side(cssVar('--series-1'))];
  return { no: [no[2], no[1], no[0]], yes, empty: neutral };
}
function colourOf(share: number | null, pal: ReturnType<typeof palette>) {
  if (share == null || share === 50) return pal.empty;          // no vote, or an exact tie
  if (share > 50) return share >= 65 ? pal.yes[2] : share >= 55 ? pal.yes[1] : pal.yes[0];
  return share <= 35 ? pal.no[0] : share <= 45 ? pal.no[1] : pal.no[2];
}

const pct = (v: number) => `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(v)} %`;
const nrShare = (n: NR) => (n.for + n.against ? (n.for / (n.for + n.against)) * 100 : null);

let geo: Promise<any> | null = null;
const loadGeo = () => (geo ??= fetch('/geo/ch-cantons.json').then((r) => (r.ok ? r.json() : null)).catch(() => null));

/** Appends the map card for a vote; nothing when there are neither canton results nor National Council votes. */
export async function cantonMapCard(container: HTMLElement, financingId: number) {
  const [ballots, fc] = await Promise.all([
    get<BallotCantons[]>(`financings/${financingId}/cantons`).catch(() => [] as BallotCantons[]), loadGeo()]);
  const b = ballots.find((x) => x.role === 'main') ?? ballots[0];
  if (!b || !fc) return;
  const m = M();
  const hasPeople = b.cantons.some((c) => c.yes_share != null);
  const hasNr = b.cantons.some((c) => c.nr.for + c.nr.against > 0);
  if (!hasPeople && !hasNr) return;
  let mode: Mode = hasPeople ? 'people' : 'nr';
  const byCode = new Map(b.cantons.map((c) => [c.canton, c]));
  const recent = b.cantons.some((c) => c.provisional);

  const section = document.createElement('section');
  section.className = 'card cmap';
  section.innerHTML = `<h2>${esc(m.title)}</h2><p>${esc(m.lead)}</p>
    ${hasPeople && hasNr ? `<div class="segmented" role="group" aria-label="${esc(m.title)}">
      <a href="#" data-mode="people" class="active">${esc(m.people)}</a><a href="#" data-mode="nr">${esc(m.nr)}</a></div>`
      : !hasPeople ? `<p class="muted small">${esc(m.upcoming)}</p>` : ''}
    <div class="cmap-figure"><div class="cmap-chart"></div><div class="cmap-legend"></div></div>
    <div class="table-wrap m-compact"><table class="cmap-table">
      <thead><tr><th>${esc(m.col_canton)}</th><th>${esc(m.col_people)}</th><th>${esc(m.col_nr)}</th><th>${esc(m.col_gap)}</th></tr></thead>
      <tbody></tbody></table></div>
    ${recent ? `<p class="muted small">${esc(m.provisional)}</p>` : ''}
    <p class="muted small">${esc(m.source)}</p>`;
  container.append(section);
  const chart = section.querySelector<HTMLElement>('.cmap-chart')!;
  const legend = section.querySelector<HTMLElement>('.cmap-legend')!;

  // Table: one row per canton, flagged when most of its members voted against the canton's majority.
  const rows = [...b.cantons].sort((a, c) => a.canton.localeCompare(c.canton));
  section.querySelector('tbody')!.innerHTML = rows.map((c) => {
    const share = nrShare(c.nr);
    const gap = c.yes_share != null && share != null && (c.yes_share >= 50) !== (share >= 50) && share !== 50;
    const people = c.yes_share == null ? m.none : pct(c.yes_share);
    const nr = c.nr.for + c.nr.against ? `${num(c.nr.for)} / ${num(c.nr.against)}` : m.none;
    return `<tr${gap ? ' class="gap"' : ''}><td><strong>${esc(c.canton)}</strong>
        <div class="m-only muted small"><span>${esc(people)}</span><span>${esc(`${m.nr_short}: ${nr}`)}</span></div></td>
      <td><span class="num">${esc(people)}</span></td><td><span class="num">${esc(nr)}</span></td>
      <td>${c.yes_share == null || share == null ? m.none : gap ? `<span class="gap-flag">${esc(m.gap)}</span>` : `<span class="muted">${esc(m.same)}</span>`}</td></tr>`;
  }).join('');

  const draw = () => {
    const pal = palette();
    const width = chart.clientWidth || 640;
    const cantons = fc.features.filter((f: any) => f.properties.layer === 'canton');
    const lakes = fc.features.filter((f: any) => f.properties.layer === 'lake');
    const value = (code: string) => {
      const c = byCode.get(code);
      return !c ? null : mode === 'people' ? c.yes_share : nrShare(c.nr);
    };
    const tip = (code: string) => {
      const c = byCode.get(code);
      if (!c) return code;
      const o = c.nr.abstain + c.nr.absent;
      return [code, c.yes_share != null ? m.tip_people(pct(c.yes_share)) : '',
        c.nr.for + c.nr.against + o ? m.tip_nr(c.nr.for, c.nr.against, o) : ''].filter(Boolean).join('\n');
    };
    chart.replaceChildren(Plot.plot({
      width, height: Math.round(width * 0.64), margin: 4,
      projection: { type: 'mercator', domain: { type: 'FeatureCollection', features: cantons } },
      style: { background: 'transparent', color: cssVar('--text-secondary'), fontFamily: 'inherit', fontSize: '11px' },
      marks: [
        Plot.geo(cantons, { fill: (f: any) => colourOf(value(f.properties.code), pal), stroke: cssVar('--surface'), strokeWidth: 1.2,
          title: (f: any) => tip(f.properties.code) }),
        Plot.geo(lakes, { fill: cssVar('--lake') || '#cfe0ef', stroke: 'none' }),
        Plot.text(cantons, Plot.centroid({ text: (f: any) => f.properties.code,
          // Label colour by the fill's lightness (OKLab L): white on dark shades, ink on light ones.
          fill: (f: any) => (toLab(hex(colourOf(value(f.properties.code), pal)))[0] < 0.62 ? '#ffffff' : '#1a1a1a'),
          fontWeight: 600, fontSize: width < 500 ? 8 : 10, pointerEvents: 'none' })),
      ],
    }) as unknown as Node);
    wireSvgTips(chart);
    const [lo, hi] = mode === 'people' ? [m.legend_no, m.legend_yes] : [m.legend_nr_against, m.legend_nr_for];
    const cls = [...pal.no, ...pal.yes];
    const labels = ['≥ 65 %', '55–65 %', '50–55 %', '50–55 %', '55–65 %', '≥ 65 %'];
    legend.innerHTML = `<span>${esc(lo)}</span>${cls.map((c, i) => `<i style="background:${c}" title="${esc(`${i < 3 ? lo : hi} ${labels[i]}`)}"></i>`).join('')}<span>${esc(hi)}</span>`
      + (mode === 'nr' ? `<span class="cmap-empty"><i style="background:${pal.empty}"></i>${esc(m.no_members)}</span>` : '');
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
