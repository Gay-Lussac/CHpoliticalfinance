// Party pages: the party's current members of the Federal Assembly (both chambers), not only those with a Lobbywatch
// tie to the party organisation. List of members: Lobbywatch (CC BY-SA 4.0), from Parliament's data.
import { get } from '../api';
import { esc } from '../format';
import { lang, locale, type Lang } from '../i18n';
import { href } from '../router';
import { agreementTag, type Agreement } from './parliament';

interface Member { lw_id: number; first_name: string; last_name: string; canton: string | null; council: 'NR' | 'SR' | null;
  in_council_since: string | null; candidate_id: number | null; ties: number; paid_ties: number; canton_agreement: Agreement | null }

const TEXT: Record<Lang, {
  title: (p: string) => string; lead: (n: number, nr: number, sr: number) => string; council: Record<'NR' | 'SR', string>;
  all_cantons: string; canton: string; col_member: string; col_council: string; col_since: string; col_ties: string;
  ties: (n: number, p: number) => string; note: string; source: string;
}> = {
  fr: {
    title: (p) => `${p} à l'Assemblée fédérale`,
    lead: (n, nr, sr) => `${n} ${n > 1 ? 'parlementaires actuel·le·s' : 'parlementaire actuel·le'} : ${nr} au Conseil national, ${sr} au Conseil des États.`,
    council: { NR: 'Conseil national', SR: 'Conseil des États' }, all_cantons: 'Tous les cantons', canton: 'Canton',
    col_member: 'Parlementaire', col_council: 'Conseil', col_since: 'Depuis', col_ties: "Liens d'intérêts",
    ties: (n, p) => `${n}${p ? ` (${p} rémunérés)` : ''}`,
    note: "Tous les membres du parti, qu'ils aient ou non un lien déclaré avec cette organisation. Le pourcentage indique l'accord avec les électeur·rice·s de leur canton (Conseil national).",
    source: 'Liste des parlementaires et liens d\'intérêts : Lobbywatch.ch, CC BY-SA 4.0, d\'après les données du Parlement.',
  },
  de: {
    title: (p) => `${p} in der Bundesversammlung`,
    lead: (n, nr, sr) => `${n} aktuelle ${n > 1 ? 'Ratsmitglieder' : 'Ratsmitglied'}: ${nr} im Nationalrat, ${sr} im Ständerat.`,
    council: { NR: 'Nationalrat', SR: 'Ständerat' }, all_cantons: 'Alle Kantone', canton: 'Kanton',
    col_member: 'Ratsmitglied', col_council: 'Rat', col_since: 'Seit', col_ties: 'Interessenbindungen',
    ties: (n, p) => `${n}${p ? ` (${p} bezahlt)` : ''}`,
    note: 'Alle Mitglieder der Partei, ob sie eine Bindung an diese Organisation deklarieren oder nicht. Der Prozentwert zeigt die Übereinstimmung mit den Stimmberechtigten ihres Kantons (Nationalrat).',
    source: 'Ratsmitglieder und Interessenbindungen: Lobbywatch.ch, CC BY-SA 4.0, nach Daten des Parlaments.',
  },
  it: {
    title: (p) => `${p} nell'Assemblea federale`,
    lead: (n, nr, sr) => `${n} ${n > 1 ? 'parlamentari attuali' : 'parlamentare attuale'}: ${nr} al Consiglio nazionale, ${sr} al Consiglio degli Stati.`,
    council: { NR: 'Consiglio nazionale', SR: 'Consiglio degli Stati' }, all_cantons: 'Tutti i cantoni', canton: 'Cantone',
    col_member: 'Parlamentare', col_council: 'Consiglio', col_since: 'Dal', col_ties: "Relazioni d'interesse",
    ties: (n, p) => `${n}${p ? ` (${p} retribuite)` : ''}`,
    note: "Tutti i membri del partito, che dichiarino o no una relazione con questa organizzazione. La percentuale indica l'accordo con gli aventi diritto di voto del loro cantone (Consiglio nazionale).",
    source: "Parlamentari e relazioni d'interesse: Lobbywatch.ch, CC BY-SA 4.0, secondo i dati del Parlamento.",
  },
  en: {
    title: (p) => `${p} in the Federal Assembly`,
    lead: (n, nr, sr) => `${n} current ${n > 1 ? 'members' : 'member'}: ${nr} in the National Council, ${sr} in the Council of States.`,
    council: { NR: 'National Council', SR: 'Council of States' }, all_cantons: 'All cantons', canton: 'Canton',
    col_member: 'Member', col_council: 'Chamber', col_since: 'Since', col_ties: 'Declared ties',
    ties: (n, p) => `${n}${p ? ` (${p} paid)` : ''}`,
    note: "All of the party's members, whether or not they declare a tie to this organisation. The percentage is their agreement with their canton's registered voters (National Council).",
    source: 'Members and ties: Lobbywatch.ch, CC BY-SA 4.0, based on Parliament data.',
  },
};

/** Appends the party's members of parliament (actor page of a party); nothing for other actors. */
export async function partyMembersCard(container: HTMLElement, actorId: number, partyLabel: string, actorCanton: string | null) {
  const rows = await get<Member[]>(`actors/${actorId}/members`).catch(() => [] as Member[]);
  if (!rows.length) return;
  const m = TEXT[lang()];
  const nr = rows.filter((r) => r.council === 'NR').length;
  const sr = rows.filter((r) => r.council === 'SR').length;
  const cantons = [...new Set(rows.map((r) => r.canton).filter(Boolean) as string[])].sort();
  // A cantonal section opens on its own canton's members.
  const start = actorCanton && cantons.includes(actorCanton) ? actorCanton : '';
  const year = (d: string | null) => (d ? new Intl.DateTimeFormat(locale(), { year: 'numeric' }).format(new Date(d)) : '');
  const name = (r: Member) => {
    const n = esc(`${r.first_name} ${r.last_name}`);
    return r.candidate_id ? `<a href="${href(`candidate/${r.candidate_id}`)}">${n}</a>` : n;
  };
  const order = (r: Member) => (r.council === 'SR' ? 1 : 0);
  const sorted = [...rows].sort((a, b) => order(a) - order(b) || a.last_name.localeCompare(b.last_name, locale()));

  const section = document.createElement('section');
  section.className = 'card m-compact party-members';
  section.innerHTML = `<h2>${esc(m.title(partyLabel))}</h2>
    <p>${esc(m.lead(rows.length, nr, sr))}</p>
    <form class="explore-form cand-filters"><label>${esc(m.canton)}<select data-canton>
      <option value="">${esc(m.all_cantons)}</option>${cantons.map((c) => `<option value="${c}"${c === start ? ' selected' : ''}>${c}</option>`).join('')}
    </select></label></form>
    <div class="table-wrap"><table>
      <thead><tr><th>${esc(m.col_member)}</th><th>${esc(m.canton)}</th><th>${esc(m.col_council)}</th><th>${esc(m.col_since)}</th><th>${esc(m.col_ties)}</th></tr></thead>
      <tbody>${sorted.map((r) => `<tr data-canton="${esc(r.canton ?? '')}">
        <td>${name(r)}${agreementTag(r.canton_agreement)}<div class="m-only muted small"><span>${esc([r.canton, r.council ? m.council[r.council] : ''].filter(Boolean).join(' · '))}</span></div></td>
        <td>${esc(r.canton ?? '')}</td>
        <td>${r.council ? esc(m.council[r.council]) : ''}</td>
        <td>${esc(year(r.in_council_since))}</td>
        <td class="num">${r.ties ? esc(m.ties(r.ties, r.paid_ties)) : '–'}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted small">${esc(m.note)}</p><p class="muted small">${esc(m.source)}</p>`;
  container.append(section);
  const select = section.querySelector<HTMLSelectElement>('[data-canton]')!;
  const apply = () => section.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => {
    tr.hidden = !!select.value && tr.dataset.canton !== select.value;
  });
  section.querySelector('form')!.addEventListener('submit', (e) => e.preventDefault());
  select.addEventListener('change', apply);
  apply();
}
