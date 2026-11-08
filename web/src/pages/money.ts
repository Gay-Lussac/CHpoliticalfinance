// "Does money win votes?": for every decided federal vote with published accounts, the money declared by the
// Yes and No camps against the result (Swissvotes). Computed in the browser from /api/financings.
import * as Plot from '@observablehq/plot';

import { get, type Financing } from '../api';
import { chf, date, esc, typo } from '../format';
import { lang, locale, setPageTitle, T, type Lang } from '../i18n';
import { href } from '../router';
import { cssVar, plotTheme, wireSvgTips } from '../views';
import { defaultPhase, sideTotals, statTiles } from './common';

const TEXT: Record<Lang, {
  title: string; lead: (won: number, total: number) => string; coin: (pct: string) => string; plain: (pct: string) => string;
  tile_won: string; tile_both: string; tile_both_sub: string; tile_init: string; tile_init_sub: (n: number) => string;
  chart_title: string; x: string; y: string; table_title: string; col_vote: string; col_result: string; col_won: string;
  yes: string; no: string; tie: string; caveats_title: string; caveats: string[]; law_link: string; empty: string;
}> = {
  fr: {
    title: "L'argent fait-il gagner les votations ?",
    lead: (w, n) => `Le camp qui a déclaré le plus d'argent a remporté ${w} des ${n} votations fédérales dont les comptes sont publiés.`,
    coin: (p) => `Soit ${p} % : à lui seul, l'argent déclaré ne permet pas de prédire le résultat.`,
    plain: (p) => `Soit ${p} %.`,
    tile_won: 'Le camp le plus financé a gagné', tile_both: 'Quand les deux camps ont déclaré', tile_both_sub: 'votations avec des comptes pour et contre',
    tile_init: 'Initiatives populaires acceptées', tile_init_sub: (n) => `le Oui était le plus financé dans ${n} cas`,
    chart_title: "Part de l'argent du Oui et résultat dans les urnes",
    x: "Part de l'argent déclaré par le camp du Oui (%)", y: 'Oui dans les urnes (%)',
    table_title: 'Toutes les votations', col_vote: 'Votation', col_result: 'Résultat', col_won: 'Le plus financé a gagné ?',
    yes: 'oui', no: 'non', tie: 'égalité',
    caveats_title: 'À lire avec prudence',
    caveats: [
      "Une corrélation n'est pas une causalité : on donne souvent davantage quand l'enjeu est élevé ou l'issue serrée, et les initiatives populaires échouent le plus souvent, quel que soit l'argent engagé.",
      "Seul l'argent déclaré est compté : les campagnes de plus de 50 000 CHF. Les petites campagnes, le travail bénévole et ce que la loi ne couvre pas n'apparaissent pas.",
      "Montants : le décompte final s'il est publié, sinon le budget.",
      "Certaines campagnes couvrent plusieurs objets le même jour ; leur argent est alors compté pour chacun.",
      'Les votations à venir et les objets sans résultat Swissvotes ne sont pas inclus.',
    ],
    law_link: 'Ce que couvre la loi', empty: 'Pas encore de votation avec des comptes et un résultat.',
  },
  de: {
    title: 'Gewinnt, wer mehr Geld hat?',
    lead: (w, n) => `Das Lager, das mehr Geld deklariert hat, hat ${w} von ${n} eidgenössischen Abstimmungen mit veröffentlichten Abrechnungen gewonnen.`,
    coin: (p) => `Das sind ${p} %: Das deklarierte Geld allein sagt das Resultat nicht voraus.`,
    plain: (p) => `Das sind ${p} %.`,
    tile_won: 'Das finanzstärkere Lager gewann', tile_both: 'Wenn beide Lager deklariert haben', tile_both_sub: 'Abstimmungen mit Abrechnungen für Ja und Nein',
    tile_init: 'Angenommene Volksinitiativen', tile_init_sub: (n) => `in ${n} Fällen war das Ja-Lager finanzstärker`,
    chart_title: 'Geldanteil des Ja-Lagers und Abstimmungsresultat',
    x: 'Anteil des vom Ja-Lager deklarierten Geldes (%)', y: 'Ja-Stimmen (%)',
    table_title: 'Alle Abstimmungen', col_vote: 'Abstimmung', col_result: 'Resultat', col_won: 'Finanzstärkeres Lager gewann?',
    yes: 'ja', no: 'nein', tie: 'gleich viel',
    caveats_title: 'Mit Vorsicht zu lesen',
    caveats: [
      'Korrelation ist nicht Kausalität: Oft wird mehr gespendet, wenn viel auf dem Spiel steht oder es knapp wird, und Volksinitiativen scheitern meistens, unabhängig vom eingesetzten Geld.',
      'Gezählt wird nur deklariertes Geld: Kampagnen über 50 000 CHF. Kleine Kampagnen, Freiwilligenarbeit und was das Gesetz nicht erfasst, fehlen.',
      'Beträge: Schlussrechnung, falls veröffentlicht, sonst Budget.',
      'Manche Kampagnen betreffen mehrere Vorlagen am selben Tag; ihr Geld wird dann für jede gezählt.',
      'Künftige Abstimmungen und Vorlagen ohne Swissvotes-Resultat sind nicht enthalten.',
    ],
    law_link: 'Was das Gesetz erfasst', empty: 'Noch keine Abstimmung mit Abrechnung und Resultat.',
  },
  it: {
    title: 'Vince chi ha più soldi?',
    lead: (w, n) => `Il fronte che ha dichiarato più denaro ha vinto ${w} delle ${n} votazioni federali con conti pubblicati.`,
    coin: (p) => `Cioè il ${p} %: da solo, il denaro dichiarato non permette di prevedere il risultato.`,
    plain: (p) => `Cioè il ${p} %.`,
    tile_won: 'Il fronte più finanziato ha vinto', tile_both: 'Quando entrambi i fronti hanno dichiarato', tile_both_sub: 'votazioni con conti per il sì e per il no',
    tile_init: 'Iniziative popolari accettate', tile_init_sub: (n) => `il sì era più finanziato in ${n} casi`,
    chart_title: 'Quota di denaro del sì e risultato alle urne',
    x: 'Quota del denaro dichiarato dal fronte del sì (%)', y: 'Sì alle urne (%)',
    table_title: 'Tutte le votazioni', col_vote: 'Votazione', col_result: 'Risultato', col_won: 'Ha vinto il più finanziato?',
    yes: 'sì', no: 'no', tie: 'parità',
    caveats_title: 'Da leggere con prudenza',
    caveats: [
      "Correlazione non è causalità: si dona spesso di più quando la posta è alta o l'esito incerto, e le iniziative popolari falliscono per lo più, indipendentemente dal denaro impiegato.",
      'Conta solo il denaro dichiarato: campagne oltre 50 000 CHF. Piccole campagne, lavoro volontario e quanto la legge non copre non figurano.',
      'Importi: conto finale se pubblicato, altrimenti budget.',
      'Alcune campagne riguardano più oggetti lo stesso giorno; il loro denaro è allora contato per ciascuno.',
      'Le votazioni future e gli oggetti senza risultato Swissvotes non sono inclusi.',
    ],
    law_link: 'Cosa copre la legge', empty: 'Ancora nessuna votazione con conti e risultato.',
  },
  en: {
    title: 'Does money win votes?',
    lead: (w, n) => `The side that declared more money won ${w} of the ${n} federal votes with published accounts.`,
    coin: (p) => `That is ${p}%: on its own, declared money does not predict the result.`,
    plain: (p) => `That is ${p}%.`,
    tile_won: 'The better-funded side won', tile_both: 'When both sides declared', tile_both_sub: 'votes with accounts for and against',
    tile_init: 'Popular initiatives accepted', tile_init_sub: (n) => `Yes was better funded in ${n} cases`,
    chart_title: "Yes side's share of the money and the result",
    x: 'Share of declared money on the Yes side (%)', y: 'Yes at the ballot box (%)',
    table_title: 'All votes', col_vote: 'Vote', col_result: 'Result', col_won: 'Better-funded side won?',
    yes: 'yes', no: 'no', tie: 'tie',
    caveats_title: 'Read with care',
    caveats: [
      'Correlation is not causation: people often give more when the stakes are high or the race is close, and popular initiatives usually fail whatever the money.',
      'Only declared money counts: campaigns over CHF 50,000. Small campaigns, volunteer work and anything the law does not cover are missing.',
      'Amounts: final accounts if published, otherwise the budget.',
      'Some campaigns cover several proposals on the same day; their money then counts for each.',
      'Upcoming votes and proposals without a Swissvotes result are not included.',
    ],
    law_link: 'What the law covers', empty: 'No vote with accounts and a result yet.',
  },
};

export const moneyTitle = () => TEXT[lang()].title;

interface Row { f: Financing; yes: number; no: number; yesShare: number; outcome: string; won: boolean | null; initiative: boolean }

/** Decided votes with declared money on at least one side. */
function rows(votes: Financing[]): Row[] {
  return votes.flatMap((f) => {
    const b = f.ballots.find((x) => x.role === 'main');
    if (!b || b.yes_share == null || !b.outcome) return [];
    const { yes, no } = sideTotals(f, defaultPhase(f));
    if (yes + no <= 0) return [];
    return [{ f, yes, no, yesShare: Number(b.yes_share), outcome: b.outcome,
      won: yes === no ? null : (yes > no) === (b.outcome === 'accepted'), initiative: f.object_type === 'popular_initiative' }];
  });
}

const pct = (x: number) => new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(x);

export async function moneyPage(main: HTMLElement) {
  const t = T();
  const m = TEXT[lang()];
  setPageTitle(m.title);
  main.innerHTML = `<header class="page-head"><h1>${esc(typo(m.title))}</h1><p class="lead">${esc(t.loading)}</p></header>`;
  const data = rows(await get<Financing[]>('financings', { kind: 'vote' }));
  const decided = data.filter((r) => r.won !== null);
  if (!decided.length) { main.querySelector('.lead')!.textContent = m.empty; return; }

  const won = decided.filter((r) => r.won).length;
  const both = decided.filter((r) => r.yes > 0 && r.no > 0);
  const inits = data.filter((r) => r.initiative);
  const share = (won / decided.length) * 100;
  main.innerHTML = `<header class="page-head"><h1>${esc(typo(m.title))}</h1>
      <p class="lead">${esc(m.lead(won, decided.length))} ${esc(share >= 35 && share <= 65 ? m.coin(pct(share)) : m.plain(pct(share)))}</p>
    </header>`
    + statTiles([
      { label: m.tile_won, value: `${won} / ${decided.length}` },
      { label: m.tile_both, value: `${both.filter((r) => r.won).length} / ${both.length}`, sub: m.tile_both_sub },
      { label: m.tile_init, value: `${inits.filter((r) => r.outcome === 'accepted').length} / ${inits.length}`,
        sub: m.tile_init_sub(inits.filter((r) => r.yes > r.no).length) },
    ])
    + `<section class="card"><h2>${esc(m.chart_title)}</h2><div id="money-chart"></div></section>
    <section class="card"><h2>${esc(m.caveats_title)}</h2><ul>${m.caveats.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      <p><a href="${href('law')}">${esc(m.law_link)} →</a></p></section>
    <section class="card"><h2>${esc(m.table_title)}</h2><div class="table-wrap"><table>
      <thead><tr><th>${esc(t.date ?? 'Date')}</th><th>${esc(m.col_vote)}</th><th>${esc(t.for)}</th><th>${esc(t.against)}</th>
        <th>${esc(m.col_result)}</th><th>${esc(m.col_won)}</th></tr></thead>
      <tbody>${data.map((r) => `<tr><td>${esc(date(r.f.event_date))}</td><td><a href="${href(`vote/${r.f.id}`)}">${esc(typo(r.f.title))}</a></td>
        <td><span class="num">${esc(chf(r.yes))}</span></td><td><span class="num">${esc(chf(r.no))}</span></td>
        <td>${esc(t[r.outcome as 'accepted' | 'rejected'] ?? r.outcome)} (${esc(pct(r.yesShare))} %)</td>
        <td>${esc(r.won === null ? m.tie : r.won ? m.yes : m.no)}</td></tr>`).join('')}</tbody></table></div></section>`;
  drawChart(document.getElementById('money-chart')!, data, m);
}

function drawChart(el: HTMLElement, data: Row[], m: (typeof TEXT)[Lang]) {
  const t = T();
  const colour = { accepted: cssVar('--series-1'), rejected: cssVar('--series-2') } as Record<string, string>;
  const points = data.map((r) => ({
    x: (r.yes / (r.yes + r.no)) * 100, y: r.yesShare, fill: colour[r.outcome] ?? cssVar('--text-muted'),
    tip: `${typo(r.f.title)}\n${date(r.f.event_date)}\n${t.for}: ${chf(r.yes)} · ${t.against}: ${chf(r.no)}\n${t[r.outcome as 'accepted' | 'rejected'] ?? r.outcome} (${pct(r.yesShare)} %)`,
    id: r.f.id,
  }));
  const width = el.clientWidth || 640;
  const chart = Plot.plot({
    ...plotTheme(width),
    height: Math.max(280, Math.min(460, width * 0.62)),
    x: { domain: [0, 100], label: m.x, labelAnchor: 'center', grid: true },
    y: { domain: [0, 100], label: m.y, labelAnchor: 'center', grid: true },
    marks: [
      Plot.ruleX([50], { stroke: cssVar('--axis'), strokeDasharray: '4 3' }),
      Plot.ruleY([50], { stroke: cssVar('--axis'), strokeDasharray: '4 3' }),
      Plot.dot(points, { x: 'x', y: 'y', fill: 'fill', r: 6, stroke: cssVar('--surface'), strokeWidth: 1.5, title: 'tip' }),
    ],
  });
  el.innerHTML = `<ul class="legend"><li><span class="swatch" style="background:${colour.accepted}"></span>${esc(t.accepted)}</li>
    <li><span class="swatch" style="background:${colour.rejected}"></span>${esc(t.rejected)}</li></ul>`;
  el.append(chart);
  wireSvgTips(chart);
}
