// National Council final votes on the objects put to the people (Parliamentary Services of the Federal Assembly).
// Positions are always for / against the object itself: for popular initiatives Parliament votes on its recommendation,
// so its "yes" is turned into "against" (the API does it from the vote's orientation).
import { get } from '../api';
import { date, esc, num, typo } from '../format';
import { lang, T, tr, type Lang } from '../i18n';
import { href } from '../router';

type Position = 'for' | 'against' | 'abstain' | 'absent' | 'excused' | 'president';
interface Member { person_number: number; first_name: string; last_name: string; canton: string | null; group_code: string | null;
  position: Position; party_code: string | null; party_color: string | null; party_label: string | null; candidate_id: number | null }
interface ParlVote { id: number; business: string; bill_title: string | null; voted_at: string | null; inverted: boolean;
  fetched_at: string | null; role: string; anr: string; members: Member[] }
export interface FinalVote { financing_id: number; event_date: string | null; title: string; role: string; outcome: string | null;
  position: Position; fetched_at: string | null }

const TEXT: Record<Lang, {
  title: string; lead: (d: string) => string; inverted: string; group: (p: string) => string; other_group: string; show_group: string; click_hint: string; show_pos: (p: string) => string;
  pos: Record<Position, string>; members: (n: number) => string; search: string; all: string; source: (d: string) => string;
  member_votes: string; member_lead: string; result: string; pending: string; position: string; vote: string;
}> = {
  fr: {
    title: 'Comment le Conseil national a voté', lead: (d) => `Vote final du ${d}, position de chaque conseiller·ère sur l'objet soumis au peuple.`,
    inverted: "Pour une initiative populaire, le Parlement vote sur sa recommandation : « oui » à l'arrêté signifie le plus souvent « non » à l'initiative. Les positions ci-dessous sont présentées pour ou contre l'objet lui-même.",
    group: (p) => `Groupe ${p}`, other_group: 'Autres', show_group: 'Afficher les membres du groupe', click_hint: 'Cliquez sur un groupe ou sur un nombre pour voir les personnes concernées.', show_pos: (p) => `Voir qui : ${p.toLowerCase()}`, members: (n) => `Voir les ${n} conseiller·ère·s`, search: 'Chercher un nom', all: 'Tous',
    pos: { for: 'Pour', against: 'Contre', abstain: 'Abstention', absent: 'Absent·e', excused: 'Excusé·e', president: 'Présidence (ne vote pas)' },
    source: (d) => `Source : Services du Parlement de l'Assemblée fédérale, Berne (données téléchargées le ${d}). Il ne s'agit pas d'une publication officielle.`,
    member_votes: 'Ses votes finaux au Conseil national', member_lead: 'Position sur les objets ensuite soumis au peuple.',
    result: 'Résultat', pending: 'à venir', position: 'Position', vote: 'Votation',
  },
  de: {
    title: 'Wie der Nationalrat abgestimmt hat', lead: (d) => `Schlussabstimmung vom ${d}, Position jedes Ratsmitglieds zur Vorlage, über die das Volk abstimmt.`,
    inverted: 'Bei einer Volksinitiative stimmt das Parlament über seine Empfehlung ab: «Ja» zum Bundesbeschluss heisst meist «Nein» zur Initiative. Die Positionen unten gelten für oder gegen die Vorlage selbst.',
    group: (p) => `Fraktion ${p}`, other_group: 'Andere', show_group: 'Mitglieder der Fraktion anzeigen', click_hint: 'Klicken Sie auf eine Fraktion oder eine Zahl, um die betreffenden Personen zu sehen.', show_pos: (p) => `Wer: ${p}`, members: (n) => `Alle ${n} Ratsmitglieder anzeigen`, search: 'Name suchen', all: 'Alle',
    pos: { for: 'Dafür', against: 'Dagegen', abstain: 'Enthaltung', absent: 'Abwesend', excused: 'Entschuldigt', president: 'Präsidium (stimmt nicht)' },
    source: (d) => `Quelle: Parlamentsdienste der Bundesversammlung, Bern (Daten heruntergeladen am ${d}). Keine offizielle Veröffentlichung.`,
    member_votes: 'Schlussabstimmungen im Nationalrat', member_lead: 'Position zu Vorlagen, über die danach das Volk abgestimmt hat.',
    result: 'Resultat', pending: 'noch offen', position: 'Position', vote: 'Abstimmung',
  },
  it: {
    title: 'Come ha votato il Consiglio nazionale', lead: (d) => `Votazione finale del ${d}, posizione di ogni consigliere sull'oggetto sottoposto al popolo.`,
    inverted: "Per un'iniziativa popolare il Parlamento vota sulla sua raccomandazione: «sì» al decreto significa di solito «no» all'iniziativa. Le posizioni qui sotto sono per o contro l'oggetto stesso.",
    group: (p) => `Gruppo ${p}`, other_group: 'Altri', show_group: 'Mostra i membri del gruppo', click_hint: 'Cliccate su un gruppo o su un numero per vedere le persone interessate.', show_pos: (p) => `Chi: ${p.toLowerCase()}`, members: (n) => `Mostra tutti i ${n} consiglieri`, search: 'Cerca un nome', all: 'Tutti',
    pos: { for: 'Favorevole', against: 'Contrario', abstain: 'Astensione', absent: 'Assente', excused: 'Scusato/a', president: 'Presidenza (non vota)' },
    source: (d) => `Fonte: Servizi del Parlamento dell'Assemblea federale, Berna (dati scaricati il ${d}). Non si tratta di una pubblicazione ufficiale.`,
    member_votes: 'Votazioni finali al Consiglio nazionale', member_lead: 'Posizione sugli oggetti poi sottoposti al popolo.',
    result: 'Risultato', pending: 'in sospeso', position: 'Posizione', vote: 'Votazione',
  },
  en: {
    title: 'How the National Council voted', lead: (d) => `Final vote of ${d}: each member's position on the proposal put to the people.`,
    inverted: 'For a popular initiative, Parliament votes on its recommendation: "yes" to the decree usually means "no" to the initiative. The positions below are for or against the proposal itself.',
    group: (p) => `${p} group`, other_group: 'Others', show_group: "Show the group's members", click_hint: 'Click a group or a number to see the people concerned.', show_pos: (p) => `Who: ${p.toLowerCase()}`, members: (n) => `Show all ${n} members`, search: 'Search a name', all: 'All',
    pos: { for: 'For', against: 'Against', abstain: 'Abstained', absent: 'Absent', excused: 'Excused', president: 'Chair (does not vote)' },
    source: (d) => `Source: Parliamentary Services of the Federal Assembly, Bern (data downloaded on ${d}). Not an official publication.`,
    member_votes: 'Final votes in the National Council', member_lead: 'Position on proposals later put to the people.',
    result: 'Result', pending: 'pending', position: 'Position', vote: 'Vote',
  },
};
const M = () => TEXT[lang()];

const posBadge = (p: Position) => {
  const m = M();
  const dot = p === 'for' ? '<i class="dot yes"></i>' : p === 'against' ? '<i class="dot no"></i>' : '';
  return `<span class="badge${p === 'for' || p === 'against' ? '' : ' muted'}">${dot}${esc(m.pos[p])}</span>`;
};

const ORDER: Record<string, number> = { for: 0, against: 1, abstain: 2, absent: 3, excused: 3, president: 4 };

/** One member as a list item: name (linked to their candidate page), canton or party, position. */
function memberItem(x: Member, withParty: boolean): string {
  const name = esc(`${x.first_name} ${x.last_name}`);
  const pos = x.position === 'excused' || x.position === 'president' ? 'absent' : x.position;
  const sub = withParty ? [x.party_label, x.canton] : [x.canton];
  return `<li data-name="${esc(`${x.first_name} ${x.last_name}`.toLowerCase())}" data-pos="${pos}">
    ${x.candidate_id ? `<a href="${href(`candidate/${x.candidate_id}`)}">${name}</a>` : name}
    <span class="muted small">${esc(sub.filter(Boolean).join(' · '))}</span> ${posBadge(x.position)}</li>`;
}

/** Result per parliamentary group; a click on a group opens its members right below (and closes them again). */
function groupsTable(members: Member[]): string {
  const m = M();
  const groups = new Map<string, { label: string; color: string | null; counts: Record<string, number>; n: number; members: Member[] }>();
  for (const x of members) {
    const key = x.party_label ?? x.group_code ?? '?';
    const g = groups.get(key) ?? { label: x.party_label ? m.group(x.party_label) : (x.group_code ? m.group(x.group_code) : m.other_group),
      color: x.party_color, counts: {}, n: 0, members: [] };
    const k = x.position === 'excused' || x.position === 'president' ? 'absent' : x.position;
    g.counts[k] = (g.counts[k] ?? 0) + 1;
    g.n += 1;
    g.members.push(x);
    groups.set(key, g);
  }
  const rows = [...groups.values()].sort((a, b) => b.n - a.n);
  const cols: Position[] = ['for', 'against', 'abstain', 'absent'];
  return `<div class="table-wrap"><table class="parl-groups">
    <thead><tr><th></th>${cols.map((c) => `<th>${esc(m.pos[c])}</th>`).join('')}<th></th></tr></thead>
    <tbody>${rows.map((g, i) => {
      const voted = (g.counts.for ?? 0) + (g.counts.against ?? 0);
      const pf = voted ? ((g.counts.for ?? 0) / voted) * 100 : 0;
      const id = `grp-${Math.random().toString(36).slice(2, 8)}-${i}`;
      const list = [...g.members].sort((a, b) => ORDER[a.position] - ORDER[b.position] || a.last_name.localeCompare(b.last_name));
      return `<tr class="grp-row" data-target="${id}">
          <td><button type="button" class="grp grp-toggle" aria-expanded="false" aria-controls="${id}" title="${esc(m.show_group)}">
            <i class="chev" aria-hidden="true"></i><i class="dot" style="background:${esc(g.color ?? 'var(--neutral)')}"></i>${esc(g.label)}</button></td>
          ${cols.map((c) => `<td>${g.counts[c] ? `<button type="button" class="num-btn" data-pos="${c}" title="${esc(m.show_pos(m.pos[c]))}"><span class="num">${num(g.counts[c])}</span></button>` : '<span class="num muted">0</span>'}</td>`).join('')}
          <td class="split-cell">${voted ? `<div class="split mini"><span class="yes" style="flex-basis:${pf}%"></span><span class="no" style="flex-basis:${100 - pf}%"></span></div>` : ''}</td></tr>
        <tr class="grp-members" id="${id}" hidden><td colspan="${cols.length + 2}">
          <ul class="parl-list">${list.map((x) => memberItem(x, false)).join('')}</ul></td></tr>`;
    }).join('')}</tbody></table></div>`;
}

function membersBlock(v: ParlVote): string {
  const m = M();
  return `<details class="parl-members"><summary>${esc(m.members(v.members.length))}</summary>
    <form class="explore-form cand-filters" role="search">
      <label>${esc(m.search)}<input type="search" name="q" autocomplete="off" /></label>
      <label>${esc(m.position)}<select name="pos"><option value="">${esc(m.all)}</option>${(['for', 'against', 'abstain', 'absent'] as Position[])
        .map((p) => `<option value="${p}">${esc(m.pos[p])}</option>`).join('')}</select></label>
    </form>
    <ul class="parl-list">${v.members.map((x) => memberItem(x, true)).join('')}</ul></details>`;
}

/** Appends one card per ballot with a National Council final vote; nothing when there is none. */
export async function parliamentCard(container: HTMLElement, financingId: number) {
  const votes = await get<ParlVote[]>(`financings/${financingId}/parliament`).catch(() => [] as ParlVote[]);
  if (!votes.length) return;
  const m = M();
  const section = document.createElement('section');
  section.className = 'card parl';
  section.innerHTML = `<h2>${esc(m.title)}</h2>` + votes.map((v) => {
    const c = (p: Position) => v.members.filter((x) => x.position === p).length;
    return `<div class="parl-vote">
      ${votes.length > 1 ? `<h3>${esc([v.role === 'main' ? '' : tr(v.role), v.bill_title ? typo(v.bill_title) : ''].filter(Boolean).join(': '))}</h3>` : ''}
      <p>${esc(m.lead(date(v.voted_at)))}</p>
      <p class="parl-total">${(['for', 'against', 'abstain', 'absent'] as Position[]).map((p) => {
        const n = p === 'absent' ? c('absent') + c('excused') + c('president') : c(p);
        return n ? `<button type="button" class="pos-btn" data-pos="${p}" aria-expanded="false" title="${esc(m.show_pos(m.pos[p]))}">${posBadge(p)} <strong>${num(n)}</strong></button>`
          : `<span class="pos-btn off">${posBadge(p)} <strong>0</strong></span>`;
      }).join('')}</p>
      <div class="pos-panel" hidden><ul class="parl-list">${[...v.members].sort((a, b) => a.last_name.localeCompare(b.last_name))
        .map((x) => memberItem(x, true)).join('')}</ul></div>
      <p class="muted small">${esc(m.click_hint)}</p>
      ${groupsTable(v.members)}
      ${v.inverted ? `<p class="muted small">${esc(m.inverted)}</p>` : ''}
      ${membersBlock(v)}
    </div>`;
  }).join('') + `<p class="muted small">${esc(m.source(date(votes[0].fetched_at)))}</p>`;
  container.append(section);
  // Show only members with one position in a list; '' shows everyone.
  const showPos = (list: HTMLElement, pos: string) => list.querySelectorAll<HTMLElement>('li').forEach((li) => {
    li.hidden = !!pos && li.dataset.pos !== pos;
  });
  // Group rows: the group name opens all its members; a number opens only the members with that position.
  // Clicking what is already open closes it.
  section.querySelectorAll<HTMLTableRowElement>('.grp-row').forEach((row) => {
    const btn = row.querySelector<HTMLButtonElement>('.grp-toggle')!;
    const panel = section.querySelector<HTMLElement>(`#${row.dataset.target}`)!;
    const open = (pos: string | null) => {
      const isOpen = pos !== null;
      btn.setAttribute('aria-expanded', String(isOpen));
      row.classList.toggle('open', isOpen);
      panel.hidden = !isOpen;
      panel.dataset.pos = pos ?? '';
      row.querySelectorAll<HTMLElement>('.num-btn').forEach((b) => b.classList.toggle('active', isOpen && b.dataset.pos === pos));
      if (isOpen) showPos(panel, pos);
    };
    row.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('a')) return;
      const pos = target.closest<HTMLElement>('.num-btn')?.dataset.pos ?? '';
      open(!panel.hidden && panel.dataset.pos === pos ? null : pos);
    });
  });
  // Totals line: each number opens the list of all members with that position.
  section.querySelectorAll<HTMLElement>('.parl-vote').forEach((block) => {
    const panel = block.querySelector<HTMLElement>('.pos-panel')!;
    const buttons = block.querySelectorAll<HTMLButtonElement>('.pos-btn[data-pos]');
    buttons.forEach((b) => b.addEventListener('click', () => {
      const pos = b.dataset.pos!;
      const close = !panel.hidden && panel.dataset.pos === pos;
      panel.hidden = close;
      panel.dataset.pos = close ? '' : pos;
      buttons.forEach((x) => { const on = !close && x === b; x.classList.toggle('active', on); x.setAttribute('aria-expanded', String(on)); });
      if (!close) showPos(panel, pos);
    }));
  });
  section.querySelectorAll<HTMLFormElement>('.parl-members form').forEach((form) => {
    const list = form.parentElement!.querySelector('.parl-list')!;
    const filter = () => {
      const q = String(new FormData(form).get('q') ?? '').trim().toLowerCase();
      const pos = String(new FormData(form).get('pos') ?? '');
      list.querySelectorAll<HTMLElement>('li').forEach((li) => {
        li.hidden = !!(q && !li.dataset.name!.includes(q)) || !!(pos && li.dataset.pos !== pos);
      });
    };
    form.addEventListener('input', filter);
    form.addEventListener('submit', (e) => e.preventDefault());
  });
}

/** Card with a member's final votes (candidate page); '' when none. */
export function memberVotesCard(votes: FinalVote[] | undefined): string {
  if (!votes?.length) return '';
  const m = M();
  const t = T();
  return `<section class="card m-compact parl">
    <h2>${esc(m.member_votes)}</h2><p class="muted small">${esc(m.member_lead)}</p>
    <div class="table-wrap"><table>
      <thead><tr><th>${esc(m.vote)}</th><th>${esc(t.date)}</th><th>${esc(m.result)}</th><th>${esc(m.position)}</th></tr></thead>
      <tbody>${votes.map((v) => `<tr>
        <td><a href="${href(`vote/${v.financing_id}`)}">${esc(typo(v.title))}</a>${v.role !== 'main' ? ` <span class="muted small">(${esc(tr(v.role))})</span>` : ''}
          <div class="m-only muted small"><span>${esc(date(v.event_date))}</span><span>${esc(v.outcome ? tr(v.outcome) : m.pending)}</span></div></td>
        <td class="nowrap">${esc(date(v.event_date))}</td><td>${esc(v.outcome ? tr(v.outcome) : m.pending)}</td>
        <td>${posBadge(v.position)}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted small">${esc(m.source(date(votes[0].fetched_at)))}</p></section>`;
}
