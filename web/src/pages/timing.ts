// "When does the money arrive?": named donations (> CHF 15,000, the only ones with a date) by weeks before vote day,
// for all votes or for one. Week 0 = the last 7 days before the vote; -1 = dated after vote day (final accounts).
import * as Plot from '@observablehq/plot';

import { get } from '../api';
import { chf, chfShort, esc } from '../format';
import { lang, locale, T, type Lang } from '../i18n';
import { cssVar, plotTheme, wireSvgTips } from '../views';

interface Row { weeks: number; stance: 'for' | 'against'; total: number; n: number }
interface Revenue { total: number; own_funds: number; donations: number; events_sales: number; named: number;
  smaller_donations: number; other: number }
interface Timing { weeks: Row[]; undated_named: number; revenue: Revenue | null }

const TEXT: Record<Lang, {
  title: string; lead: (last4: string, after: string) => string; x: string; y: string; after: string; plus: string;
  week: (w: number) => string; note: string; donations: (n: number) => string;
  cover: (named: string, share: string, total: string) => string; rest: string; part_named: string; part_own: string;
  part_small: string; part_events: string; part_other: string;
}> = {
  fr: {
    title: "Quand l'argent arrive-t-il ?",
    lead: (a, b) => `${a} des dons nommés sont arrivés dans les 4 dernières semaines avant le scrutin, ${b} après le jour du vote.`,
    x: 'Semaines avant le jour du vote', y: 'Dons nommés (CHF)', after: 'après', plus: '26+',
    week: (w) => (w < 0 ? 'Après le jour du vote' : w >= 26 ? '26 semaines ou plus avant' : w === 0 ? 'Dernière semaine avant le vote' : `${w} semaine${w > 1 ? 's' : ''} avant`),
    note: "Seuls les dons de plus de 15 000 CHF sont datés. Les dons datés après le vote figurent dans les décomptes finaux (par exemple pour couvrir les frais de campagne).",
    donations: (n) => `${n} ${n > 1 ? 'dons' : 'don'}`,
    cover: (n, p, t) => `Ce graphique ne montre que les dons nommés : ${n}, soit ${p} des ${t} de recettes déclarées par les campagnes.`,
    rest: "Le reste n'a pas de date et n'apparaît donc pas ici :",
    part_named: 'Dons nommés (plus de 15 000 CHF), dans le graphique', part_own: 'Fonds propres des acteurs qui font campagne',
    part_small: 'Dons de 15 000 CHF ou moins (non nommés)', part_events: 'Manifestations et ventes', part_other: 'Autres recettes',
  },
  de: {
    title: 'Wann kommt das Geld?',
    lead: (a, b) => `${a} der namentlich genannten Zuwendungen kamen in den letzten 4 Wochen vor dem Abstimmungstag, ${b} danach.`,
    x: 'Wochen vor dem Abstimmungstag', y: 'Namentliche Zuwendungen (CHF)', after: 'danach', plus: '26+',
    week: (w) => (w < 0 ? 'Nach dem Abstimmungstag' : w >= 26 ? '26 Wochen oder mehr vorher' : w === 0 ? 'Letzte Woche vor der Abstimmung' : `${w} Woche${w > 1 ? 'n' : ''} vorher`),
    note: 'Nur Zuwendungen über 15 000 CHF sind datiert. Zuwendungen nach dem Abstimmungstag stehen in den Schlussrechnungen (zum Beispiel zur Deckung der Kampagnenkosten).',
    donations: (n) => `${n} ${n > 1 ? 'Zuwendungen' : 'Zuwendung'}`,
    cover: (n, p, t) => `Die Grafik zeigt nur die namentlich genannten Zuwendungen: ${n}, also ${p} der ${t} deklarierten Einnahmen der Kampagnen.`,
    rest: 'Der Rest ist nicht datiert und erscheint deshalb nicht:',
    part_named: 'Namentliche Zuwendungen (über 15 000 CHF), in der Grafik', part_own: 'Eigenmittel der Akteure, die Kampagne führen',
    part_small: 'Zuwendungen bis 15 000 CHF (nicht namentlich)', part_events: 'Veranstaltungen und Verkäufe', part_other: 'Andere Einnahmen',
  },
  it: {
    title: 'Quando arrivano i soldi?',
    lead: (a, b) => `${a} delle liberalità nominative sono arrivate nelle ultime 4 settimane prima della votazione, ${b} dopo il giorno del voto.`,
    x: 'Settimane prima del giorno del voto', y: 'Liberalità nominative (CHF)', after: 'dopo', plus: '26+',
    week: (w) => (w < 0 ? 'Dopo il giorno del voto' : w >= 26 ? '26 settimane o più prima' : w === 0 ? 'Ultima settimana prima del voto' : `${w} settiman${w > 1 ? 'e' : 'a'} prima`),
    note: 'Solo le liberalità superiori a 15 000 CHF sono datate. Quelle datate dopo il voto figurano nei conti finali (ad esempio per coprire i costi della campagna).',
    donations: (n) => `${n} ${n > 1 ? 'liberalità' : 'liberalità'}`,
    cover: (n, p, t) => `Il grafico mostra solo le liberalità nominative: ${n}, ossia ${p} dei ${t} di entrate dichiarate dalle campagne.`,
    rest: 'Il resto non è datato e quindi non compare qui:',
    part_named: 'Liberalità nominative (oltre 15 000 CHF), nel grafico', part_own: 'Fondi propri degli attori che fanno campagna',
    part_small: 'Liberalità fino a 15 000 CHF (non nominative)', part_events: 'Manifestazioni e vendite', part_other: 'Altre entrate',
  },
  en: {
    title: 'When does the money arrive?',
    lead: (a, b) => `${a} of named donations arrived in the last 4 weeks before the vote, ${b} after vote day.`,
    x: 'Weeks before vote day', y: 'Named donations (CHF)', after: 'after', plus: '26+',
    week: (w) => (w < 0 ? 'After vote day' : w >= 26 ? '26 weeks or more before' : w === 0 ? 'Last week before the vote' : `${w} week${w > 1 ? 's' : ''} before`),
    note: 'Only donations over CHF 15,000 are dated. Donations dated after the vote appear in final accounts (for example to cover campaign costs).',
    donations: (n) => `${n} ${n > 1 ? 'donations' : 'donation'}`,
    cover: (n, p, t) => `This chart only shows named donations: ${n}, i.e. ${p} of the ${t} the campaigns declared as revenue.`,
    rest: 'The rest has no date, so it is not shown here:',
    part_named: 'Named donations (over CHF 15,000), in the chart', part_own: "Campaigning actors' own funds",
    part_small: 'Donations of CHF 15,000 or less (not named)', part_events: 'Events and sales', part_other: 'Other revenue',
  },
};

const pct = (v: number) => (v > 0 && v < 0.005 ? '< 1 %' : `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(v * 100)} %`);

/** Appends the timing card to `container`; renders nothing when there are no dated donations. */
export async function timingCard(container: HTMLElement, financingId?: number) {
  const res = await get<Timing>('timing', financingId ? { financing_id: financingId } : {}).catch(() => null);
  const rows = res?.weeks ?? [];
  const total = rows.reduce((s, r) => s + r.total, 0);
  if (!rows.length || total <= 0) return;
  const m = TEXT[lang()];
  const t = T();
  const last4 = rows.filter((r) => r.weeks >= 0 && r.weeks < 4).reduce((s, r) => s + r.total, 0) / total;
  const after = rows.filter((r) => r.weeks < 0).reduce((s, r) => s + r.total, 0) / total;
  const section = document.createElement('section');
  section.className = 'card';
  section.innerHTML = `<h2>${esc(m.title)}</h2><p>${esc(m.lead(pct(last4), pct(after)))}</p>
    <div class="timing-chart"></div>
    <div class="split-legend"><span><i class="dot yes"></i>${esc(t.for)}</span><span><i class="dot no"></i>${esc(t.against)}</span></div>
    ${coverage(res?.revenue ?? null, m)}
    <p class="muted small">${esc(m.note)}</p>`;
  container.append(section);
  const el = section.querySelector<HTMLElement>('.timing-chart')!;

  const weeks = [26, ...Array.from({ length: 26 }, (_, i) => 25 - i), -1];   // left = long before, right = after
  const tick = (w: number) => (w < 0 ? m.after : w >= 26 ? m.plus : w % 4 === 0 ? String(w) : '');
  const data = rows.map((r) => ({ ...r, x: r.weeks,
    tip: `${m.week(r.weeks)}\n${r.stance === 'for' ? t.for : t.against}: ${chf(r.total)} (${m.donations(r.n)})` }));
  const draw = () => {
    const width = el.clientWidth || 640;
    el.replaceChildren(Plot.plot({
      ...plotTheme(width),
      height: Math.max(220, Math.min(320, width * 0.45)),
      x: { domain: weeks, tickFormat: tick, label: m.x, labelAnchor: 'center', tickSize: 0, padding: 0.15 },
      y: { label: m.y, labelAnchor: 'center', grid: true, tickFormat: (v: number) => chfShort(v).replace(/^CHF\s*/, '') },
      color: { domain: ['for', 'against'], range: [cssVar('--series-1'), cssVar('--series-2')] },
      marks: [
        Plot.barY(data, Plot.stackY({ x: 'x', y: 'total', fill: 'stance', order: ['for', 'against'], title: 'tip',
          inset: 1, rx: 2 })),
        Plot.ruleY([0], { stroke: cssVar('--axis') }),
      ],
    }) as unknown as Node);
    wireSvgTips(el);
  };
  draw();
  let w = el.clientWidth;
  new ResizeObserver(() => { if (Math.abs(el.clientWidth - w) > 40) { w = el.clientWidth; draw(); } }).observe(el);
}

/** How much of the declared revenue the chart covers, and where the rest comes from. */
function coverage(r: Revenue | null, m: (typeof TEXT)[Lang]): string {
  if (!r || r.total <= 0) return '';
  const share = (v: number) => pct(v / r.total);
  const parts = [
    [m.part_named, r.named, true], [m.part_small, r.smaller_donations, false], [m.part_own, r.own_funds, false],
    [m.part_events, r.events_sales, false], [m.part_other, r.other, false],
  ].filter(([, v]) => (v as number) > 0) as [string, number, boolean][];
  return `<div class="coverage">
      <p>${esc(m.cover(chf(r.named), share(r.named), chf(r.total)))} ${esc(m.rest)}</p>
      <div class="coverage-bar" role="img" aria-label="${esc(parts.map(([l, v]) => `${l}: ${chf(v)}`).join(', '))}">${parts.map(([l, v, inChart], i) =>
        `<span class="${inChart ? 'in-chart' : `rest r${i}`}" style="flex-basis:${(v / r.total) * 100}%" data-tip="${esc(`${l}: ${chf(v)} (${share(v)})`)}"></span>`).join('')}</div>
      <ul class="coverage-list">${parts.map(([l, v, inChart], i) =>
        `<li><i class="sw ${inChart ? 'in-chart' : `rest r${i}`}"></i><span>${esc(l)}</span><span class="num">${esc(chf(v))} · ${esc(share(v))}</span></li>`).join('')}</ul>
    </div>`;
}
