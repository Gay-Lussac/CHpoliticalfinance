// Party levies on office holders: the share of their pay that federal councillors, members of parliament and federal
// judges hand over to their party, as declared in the national parties' annual accounts. Aggregated in the browser.
import { get } from '../api';
import { chf, chfShort, esc, num } from '../format';
import { lang, locale, setPageTitle, type Lang } from '../i18n';
import { href } from '../router';
import { statTiles } from './common';
import { meterRows } from './orientation';

interface Row { last_name: string; first_name: string | null; institution: string; institution_code: string; amount: number;
  year: number; actor_id: number; actor_name: string; party_code: string | null; party_color: string | null; party_label: string | null }

const INST: Record<Lang, Record<string, string>> = {
  fr: { CF: 'Conseil fédéral', CN: 'Conseil national', CE: 'Conseil des États', TF: 'Tribunal fédéral', TAF: 'Tribunal administratif fédéral',
    TPF: 'Tribunal pénal fédéral', TFB: 'Tribunal fédéral des brevets', CHA: 'Chancellerie fédérale', OTHER: 'Autres fonctions' },
  de: { CF: 'Bundesrat', CN: 'Nationalrat', CE: 'Ständerat', TF: 'Bundesgericht', TAF: 'Bundesverwaltungsgericht',
    TPF: 'Bundesstrafgericht', TFB: 'Bundespatentgericht', CHA: 'Bundeskanzlei', OTHER: 'Andere Ämter' },
  it: { CF: 'Consiglio federale', CN: 'Consiglio nazionale', CE: 'Consiglio degli Stati', TF: 'Tribunale federale', TAF: 'Tribunale amministrativo federale',
    TPF: 'Tribunale penale federale', TFB: 'Tribunale federale dei brevetti', CHA: 'Cancelleria federale', OTHER: 'Altre funzioni' },
  en: { CF: 'Federal Council', CN: 'National Council', CE: 'Council of States', TF: 'Federal Supreme Court', TAF: 'Federal Administrative Court',
    TPF: 'Federal Criminal Court', TFB: 'Federal Patent Court', CHA: 'Federal Chancellery', OTHER: 'Other offices' },
};

const TEXT: Record<Lang, {
  title: string; lead: string; tile_total: (y: number) => string; tile_people: string; tile_people_sub: string; tile_parties: string;
  avg_title: (y: number) => string; avg_note: string; members: (n: number) => string; inst_title: (y: number) => string; people: (n: number) => string;
  table_title: string; search: string; office: string; party: string; all: string; person: string; total: string; none: string;
  shown: (a: number, b: number) => string; more: (n: number) => string; caveats_title: string; caveats: string[]; unknown_party: string;
  law_link: string; parties_link: string;
}> = {
  fr: {
    title: 'Ce que les élu·e·s et les juges reversent à leur parti',
    lead: "Les partis prélèvent une part de l'indemnité des conseillères et conseillers fédéraux, des parlementaires et des juges fédéraux qu'ils ont fait élire. Ces « contributions liées à un mandat » figurent nommément dans leurs comptes annuels.",
    tile_total: (y) => `Total ${y}`, tile_people: 'Personnes', tile_people_sub: 'au moins une contribution déclarée', tile_parties: 'Partis qui déclarent',
    avg_title: (y) => `Contribution moyenne par parlementaire fédéral·e, ${y}`, avg_note: 'Conseil national et Conseil des États, par parti.',
    members: (n) => `${n} ${n > 1 ? 'parlementaires' : 'parlementaire'}`, inst_title: (y) => `Par fonction, ${y}`, people: (n) => `${n} ${n > 1 ? 'personnes' : 'personne'}`,
    table_title: 'Toutes les contributions', search: 'Chercher un nom', office: 'Fonction', party: 'Parti', all: 'Tous', person: 'Personne',
    total: 'Total', none: 'Aucune personne trouvée.', shown: (a, b) => `${a} sur ${b}`, more: (n) => `Afficher ${n} de plus`,
    caveats_title: 'À savoir',
    caveats: [
      'Seuls les comptes des partis nationaux sont publiés : les contributions versées aux sections cantonales ou locales, et celles liées à des mandats cantonaux ou communaux, ne figurent pas ici.',
      "Les noms et les fonctions sont repris tels que les partis les ont écrits ; une même personne peut apparaître sous deux orthographes.",
      "Une contribution de 0 franc signifie que le parti a déclaré la personne sans montant pour l'année.",
      "Les montants sont ceux de l'année des comptes du parti, pas forcément l'année civile du mandat.",
    ],
    unknown_party: 'Autre parti', law_link: 'Ce que couvre la loi', parties_link: 'Comptes des partis',
  },
  de: {
    title: 'Was Gewählte und Richter·innen ihrer Partei abgeben',
    lead: 'Die Parteien erheben einen Teil der Entschädigung von Bundesrätinnen und Bundesräten, Parlamentsmitgliedern und Bundesrichter·innen, die sie ins Amt gebracht haben. Diese «Mandatsbeiträge» stehen namentlich in ihren Jahresrechnungen.',
    tile_total: (y) => `Total ${y}`, tile_people: 'Personen', tile_people_sub: 'mit mindestens einem deklarierten Beitrag', tile_parties: 'Deklarierende Parteien',
    avg_title: (y) => `Durchschnittlicher Beitrag pro Mitglied der Bundesversammlung, ${y}`, avg_note: 'Nationalrat und Ständerat, nach Partei.',
    members: (n) => `${n} ${n > 1 ? 'Ratsmitglieder' : 'Ratsmitglied'}`, inst_title: (y) => `Nach Amt, ${y}`, people: (n) => `${n} ${n > 1 ? 'Personen' : 'Person'}`,
    table_title: 'Alle Beiträge', search: 'Name suchen', office: 'Amt', party: 'Partei', all: 'Alle', person: 'Person',
    total: 'Total', none: 'Keine Person gefunden.', shown: (a, b) => `${a} von ${b}`, more: (n) => `${n} weitere anzeigen`,
    caveats_title: 'Gut zu wissen',
    caveats: [
      'Veröffentlicht werden nur die Rechnungen der nationalen Parteien: Beiträge an Kantonal- oder Ortsparteien und solche aus kantonalen oder kommunalen Ämtern fehlen hier.',
      'Namen und Ämter stehen so, wie die Parteien sie geschrieben haben; dieselbe Person kann in zwei Schreibweisen vorkommen.',
      'Ein Beitrag von 0 Franken heisst, dass die Partei die Person ohne Betrag für das Jahr deklariert hat.',
      'Die Beträge gelten für das Rechnungsjahr der Partei, nicht unbedingt für das Kalenderjahr des Amtes.',
    ],
    unknown_party: 'Andere Partei', law_link: 'Was das Gesetz erfasst', parties_link: 'Parteirechnungen',
  },
  it: {
    title: 'Quanto eletti e giudici versano al loro partito',
    lead: "I partiti trattengono una parte dell'indennità dei consiglieri federali, dei parlamentari e dei giudici federali che hanno fatto eleggere. Questi «contributi legati a un mandato» figurano nominativamente nei loro conti annuali.",
    tile_total: (y) => `Totale ${y}`, tile_people: 'Persone', tile_people_sub: 'con almeno un contributo dichiarato', tile_parties: 'Partiti che dichiarano',
    avg_title: (y) => `Contributo medio per parlamentare federale, ${y}`, avg_note: 'Consiglio nazionale e Consiglio degli Stati, per partito.',
    members: (n) => `${n} ${n > 1 ? 'parlamentari' : 'parlamentare'}`, inst_title: (y) => `Per funzione, ${y}`, people: (n) => `${n} ${n > 1 ? 'persone' : 'persona'}`,
    table_title: 'Tutti i contributi', search: 'Cerca un nome', office: 'Funzione', party: 'Partito', all: 'Tutti', person: 'Persona',
    total: 'Totale', none: 'Nessuna persona trovata.', shown: (a, b) => `${a} su ${b}`, more: (n) => `Mostra altri ${n}`,
    caveats_title: 'Da sapere',
    caveats: [
      'Sono pubblicati solo i conti dei partiti nazionali: i contributi alle sezioni cantonali o locali e quelli legati a mandati cantonali o comunali non figurano qui.',
      'Nomi e funzioni sono ripresi come li hanno scritti i partiti; la stessa persona può comparire con due grafie.',
      "Un contributo di 0 franchi significa che il partito ha dichiarato la persona senza importo per l'anno.",
      "Gli importi sono quelli dell'anno contabile del partito, non necessariamente dell'anno civile del mandato.",
    ],
    unknown_party: 'Altro partito', law_link: 'Cosa copre la legge', parties_link: 'Conti dei partiti',
  },
  en: {
    title: 'What office holders hand over to their party',
    lead: 'Parties take a share of the pay of the federal councillors, members of parliament and federal judges they got elected. These "mandate contributions" are listed by name in their annual accounts.',
    tile_total: (y) => `Total ${y}`, tile_people: 'People', tile_people_sub: 'with at least one declared contribution', tile_parties: 'Parties declaring',
    avg_title: (y) => `Average contribution per member of parliament, ${y}`, avg_note: 'National Council and Council of States, by party.',
    members: (n) => `${n} ${n > 1 ? 'members' : 'member'}`, inst_title: (y) => `By office, ${y}`, people: (n) => `${n} ${n > 1 ? 'people' : 'person'}`,
    table_title: 'All contributions', search: 'Search a name', office: 'Office', party: 'Party', all: 'All', person: 'Person',
    total: 'Total', none: 'No one found.', shown: (a, b) => `${a} of ${b}`, more: (n) => `Show ${n} more`,
    caveats_title: 'Good to know',
    caveats: [
      'Only national parties publish accounts: contributions to cantonal or local sections, and those tied to cantonal or municipal offices, are not included.',
      'Names and offices are shown as the parties wrote them; the same person may appear under two spellings.',
      'A contribution of CHF 0 means the party listed the person with no amount for that year.',
      "Amounts are for the party's accounting year, not necessarily the calendar year of the office.",
    ],
    unknown_party: 'Other party', law_link: 'What the law covers', parties_link: 'Party accounts',
  },
};
const M = () => TEXT[lang()];
export const mandatesTitle = () => M().title;

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const PAGE_SIZE = 50;

interface Person { key: string; name: string; inst: string; party: string; color: string | null; byYear: Map<number, number>; total: number }

export async function mandatesPage(main: HTMLElement) {
  const m = M();
  const inst = INST[lang()];
  setPageTitle(m.title);
  main.innerHTML = `<header class="page-head"><h1>${esc(m.title)}</h1><p class="lead">${esc(m.lead)}</p></header><p class="muted">…</p>`;
  const rows = await get<Row[]>('mandates').catch(() => [] as Row[]);
  if (!rows.length) { main.querySelector('p.muted')!.textContent = ''; return; }

  const partyOf = (r: Row) => r.party_label ?? r.actor_name ?? m.unknown_party;
  const years = [...new Set(rows.map((r) => r.year))].sort();
  const last = years[years.length - 1];
  const lastRows = rows.filter((r) => r.year === last);

  // People: same name and party across years.
  const people = new Map<string, Person>();
  for (const r of rows) {
    const name = [r.last_name, r.first_name].filter(Boolean).join(' ');
    const key = `${fold(name).replace(/[^a-z]/g, '')}|${r.actor_id}`;
    const p = people.get(key) ?? { key, name, inst: r.institution_code, party: partyOf(r), color: r.party_color, byYear: new Map(), total: 0 };
    p.byYear.set(r.year, (p.byYear.get(r.year) ?? 0) + r.amount);
    p.total += r.amount;
    if (r.year >= Math.max(...p.byYear.keys())) p.inst = r.institution_code;
    people.set(key, p);
  }
  const list = [...people.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, locale()));

  // Average per member of parliament (CN + CE), latest year, by party.
  const parl = new Map<string, { label: string; color: string | null; sum: number; people: Set<string> }>();
  for (const r of lastRows.filter((x) => x.institution_code === 'CN' || x.institution_code === 'CE')) {
    const k = partyOf(r);
    const e = parl.get(k) ?? { label: k, color: r.party_color, sum: 0, people: new Set() };
    e.sum += r.amount;
    e.people.add(fold(`${r.last_name} ${r.first_name ?? ''}`));
    parl.set(k, e);
  }
  const avg = [...parl.values()].map((e) => ({ ...e, avg: e.sum / e.people.size })).sort((a, b) => b.avg - a.avg);
  const maxAvg = Math.max(...avg.map((a) => a.avg), 1);

  const byInst = new Map<string, { sum: number; people: Set<string> }>();
  for (const r of lastRows) {
    const e = byInst.get(r.institution_code) ?? { sum: 0, people: new Set() };
    e.sum += r.amount;
    e.people.add(fold(`${r.last_name} ${r.first_name ?? ''}`));
    byInst.set(r.institution_code, e);
  }
  const insts = [...byInst.entries()].sort((a, b) => b[1].sum - a[1].sum);
  const instTotal = insts.reduce((s, [, e]) => s + e.sum, 0);

  const offices = [...new Set(list.map((p) => p.inst))].sort((a, b) => Object.keys(inst).indexOf(a) - Object.keys(inst).indexOf(b));
  const partyNames = [...new Set(list.map((p) => p.party))].sort((a, b) => a.localeCompare(b, locale()));

  main.innerHTML = `<header class="page-head"><h1>${esc(m.title)}</h1><p class="lead">${esc(m.lead)}</p></header>`
    + statTiles([
      { label: m.tile_total(last), value: chfShort(lastRows.reduce((s, r) => s + r.amount, 0)), sub: m.people(new Set(lastRows.map((r) => fold(`${r.last_name} ${r.first_name ?? ''}`))).size) },
      { label: m.tile_people, value: num(list.length), sub: `${m.tile_people_sub} (${years[0]}–${last})` },
      { label: m.tile_parties, value: num(new Set(rows.map((r) => r.actor_id)).size) },
    ])
    + `<div class="orient-wrap">
      <section class="card orient"><h2>${esc(m.avg_title(last))}</h2><p class="muted small">${esc(m.avg_note)}</p>
        ${meterRows(avg.map((a) => ({ label: a.label, color: a.color, share: a.avg / maxAvg, value: chf(Math.round(a.avg)), sub: m.members(a.people.size) })))}</section>
      <section class="card orient"><h2>${esc(m.inst_title(last))}</h2>
        ${meterRows(insts.map(([code, e]) => ({ label: inst[code] ?? code, color: null, share: instTotal ? e.sum / instTotal : 0,
          value: chfShort(e.sum), sub: m.people(e.people.size) })))}</section>
      <section class="card candidates m-compact" id="mandate-list"><h2>${esc(m.table_title)}</h2>
        <form class="explore-form cand-filters" role="search">
          <label>${esc(m.search)}<input type="search" name="q" autocomplete="off" /></label>
          <label>${esc(m.office)}<select name="office"><option value="">${esc(m.all)}</option>${offices.map((o) => `<option value="${esc(o)}">${esc(inst[o] ?? o)}</option>`).join('')}</select></label>
          <label>${esc(m.party)}<select name="party"><option value="">${esc(m.all)}</option>${partyNames.map((p) => `<option>${esc(p)}</option>`).join('')}</select></label>
        </form>
        <div class="table-wrap"><table>
          <thead><tr><th>${esc(m.person)}</th><th>${esc(m.office)}</th><th>${esc(m.party)}</th>${years.map((y) => `<th>${y}</th>`).join('')}<th>${esc(m.total)}</th></tr></thead>
          <tbody></tbody></table></div>
        <p class="cand-foot"><span class="muted small" data-shown></span> <button type="button" class="more-btn" hidden></button></p>
      </section>
      <section class="card"><h2>${esc(m.caveats_title)}</h2><ul>${m.caveats.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        <p class="muted small"><a href="${href('law')}">${esc(m.law_link)}</a> · <a href="${href('parties')}">${esc(m.parties_link)}</a></p></section>
    </div>`;

  const section = document.getElementById('mandate-list')!;
  const form = section.querySelector('form')!;
  const body = section.querySelector('tbody')!;
  const shown = section.querySelector('[data-shown]')!;
  const more = section.querySelector<HTMLButtonElement>('.more-btn')!;
  let limit = PAGE_SIZE;
  const cell = (v: number | undefined) => `<td><span class="num">${v === undefined ? '–' : chf(v)}</span></td>`;
  const render = () => {
    const fd = new FormData(form);
    const q = fold(String(fd.get('q') ?? '').trim());
    const office = String(fd.get('office') ?? '');
    const party = String(fd.get('party') ?? '');
    const hits = list.filter((p) => (!q || fold(p.name).includes(q)) && (!office || p.inst === office) && (!party || p.party === party));
    body.innerHTML = hits.slice(0, limit).map((p) => `<tr>
        <td>${esc(p.name)}<div class="m-only muted small"><span class="badge"><i class="dot" style="background:${esc(p.color ?? 'var(--neutral)')}"></i>${esc(p.party)}</span><span>${esc(inst[p.inst] ?? p.inst)}</span></div></td>
        <td>${esc(inst[p.inst] ?? p.inst)}</td>
        <td><span class="badge"><i class="dot" style="background:${esc(p.color ?? 'var(--neutral)')}"></i>${esc(p.party)}</span></td>
        ${years.map((y) => cell(p.byYear.get(y))).join('')}${cell(p.total)}</tr>`).join('')
      || `<tr><td colspan="${4 + years.length}" class="muted">${esc(m.none)}</td></tr>`;
    shown.textContent = m.shown(Math.min(limit, hits.length), hits.length);
    more.hidden = hits.length <= limit;
    more.textContent = m.more(Math.min(hits.length - limit, PAGE_SIZE));
  };
  form.addEventListener('input', () => { limit = PAGE_SIZE; render(); });
  form.addEventListener('submit', (e) => e.preventDefault());
  more.addEventListener('click', () => { limit += PAGE_SIZE; render(); });
  render();
}
