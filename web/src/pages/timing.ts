// "When does the money arrive?": named donations (> CHF 15,000, the only ones with a date) by weeks before vote day,
// for all votes or for one. Week 0 = the last 7 days before the vote; -1 = dated after vote day (final accounts).
import * as Plot from '@observablehq/plot';

import { get } from '../api';
import { chf, chfShort, esc } from '../format';
import { lang, locale, T, type Lang } from '../i18n';
import { cssVar, plotTheme, wireSvgTips } from '../views';

interface Row { weeks: number; stance: 'for' | 'against'; total: number; n: number }

const TEXT: Record<Lang, {
  title: string; lead: (last4: string, after: string) => string; x: string; y: string; after: string; plus: string;
  week: (w: number) => string; note: string; donations: (n: number) => string;
}> = {
  fr: {
    title: "Quand l'argent arrive-t-il ?",
    lead: (a, b) => `${a} des dons nommés sont arrivés dans les 4 dernières semaines avant le scrutin, ${b} après le jour du vote.`,
    x: 'Semaines avant le jour du vote', y: 'Dons nommés (CHF)', after: 'après', plus: '26+',
    week: (w) => (w < 0 ? 'Après le jour du vote' : w >= 26 ? '26 semaines ou plus avant' : w === 0 ? 'Dernière semaine avant le vote' : `${w} semaine${w > 1 ? 's' : ''} avant`),
    note: "Seuls les dons de plus de 15 000 CHF sont datés. Les dons datés après le vote figurent dans les décomptes finaux (par exemple pour couvrir les frais de campagne).",
    donations: (n) => `${n} ${n > 1 ? 'dons' : 'don'}`,
  },
  de: {
    title: 'Wann kommt das Geld?',
    lead: (a, b) => `${a} der namentlich genannten Zuwendungen kamen in den letzten 4 Wochen vor dem Abstimmungstag, ${b} danach.`,
    x: 'Wochen vor dem Abstimmungstag', y: 'Namentliche Zuwendungen (CHF)', after: 'danach', plus: '26+',
    week: (w) => (w < 0 ? 'Nach dem Abstimmungstag' : w >= 26 ? '26 Wochen oder mehr vorher' : w === 0 ? 'Letzte Woche vor der Abstimmung' : `${w} Woche${w > 1 ? 'n' : ''} vorher`),
    note: 'Nur Zuwendungen über 15 000 CHF sind datiert. Zuwendungen nach dem Abstimmungstag stehen in den Schlussrechnungen (zum Beispiel zur Deckung der Kampagnenkosten).',
    donations: (n) => `${n} ${n > 1 ? 'Zuwendungen' : 'Zuwendung'}`,
  },
  it: {
    title: 'Quando arrivano i soldi?',
    lead: (a, b) => `${a} delle liberalità nominative sono arrivate nelle ultime 4 settimane prima della votazione, ${b} dopo il giorno del voto.`,
    x: 'Settimane prima del giorno del voto', y: 'Liberalità nominative (CHF)', after: 'dopo', plus: '26+',
    week: (w) => (w < 0 ? 'Dopo il giorno del voto' : w >= 26 ? '26 settimane o più prima' : w === 0 ? 'Ultima settimana prima del voto' : `${w} settiman${w > 1 ? 'e' : 'a'} prima`),
    note: 'Solo le liberalità superiori a 15 000 CHF sono datate. Quelle datate dopo il voto figurano nei conti finali (ad esempio per coprire i costi della campagna).',
    donations: (n) => `${n} ${n > 1 ? 'liberalità' : 'liberalità'}`,
  },
  en: {
    title: 'When does the money arrive?',
    lead: (a, b) => `${a} of named donations arrived in the last 4 weeks before the vote, ${b} after vote day.`,
    x: 'Weeks before vote day', y: 'Named donations (CHF)', after: 'after', plus: '26+',
    week: (w) => (w < 0 ? 'After vote day' : w >= 26 ? '26 weeks or more before' : w === 0 ? 'Last week before the vote' : `${w} week${w > 1 ? 's' : ''} before`),
    note: 'Only donations over CHF 15,000 are dated. Donations dated after the vote appear in final accounts (for example to cover campaign costs).',
    donations: (n) => `${n} ${n > 1 ? 'donations' : 'donation'}`,
  },
};

const pct = (v: number) => `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(v * 100)} %`;

/** Appends the timing card to `container`; renders nothing when there are no dated donations. */
export async function timingCard(container: HTMLElement, financingId?: number) {
  const rows = await get<Row[]>('timing', financingId ? { financing_id: financingId } : {}).catch(() => [] as Row[]);
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
