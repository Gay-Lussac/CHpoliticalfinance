// Lobbywatch data (https://lobbywatch.ch, CC BY-SA 4.0): ties of members of parliament to organisations.
// Shown on candidate pages (the member's ties) and on actor / donor pages (members tied to that organisation).
import { get } from '../api';
import { esc, num } from '../format';
import { lang, locale, type Lang } from '../i18n';
import { href } from '../router';

export interface Tie { kind: string; role: string | null; pay: number | null; pay_year: number | null; must_declare: boolean;
  main_job: boolean; description: string | null; org_id: number; org_name: string; lobby_group: string | null;
  actor_id: number | null; donor_id: number | null }
export interface Parliament { final_votes?: import('./parliament').FinalVote[]; canton_agreement?: import('./parliament').Agreement | null; id: number; council: 'NR' | 'SR' | null; in_council_since: string | null; canton: string | null;
  party_code: string | null; party_color: string | null; party_label: string | null; ties: Tie[] }
interface Link { lw_id: number; last_name: string; first_name: string; canton: string | null; council: 'NR' | 'SR' | null;
  party_code: string | null; party_color: string | null; party_label: string | null; candidate_id: number | null;
  kind: string; role: string | null; pay: number | null; org_name: string }

type Words = {
  ties_title: string; ties_lead: (n: number, paid: number) => string; council: Record<'NR' | 'SR', string>; since: (y: string) => string;
  col_org: string; col_role: string; col_pay: string; col_group: string; more: (n: number) => string;
  kind: Record<string, string>; role: Record<string, string>; pay: (v: number | null) => string;
  source: string; open: string; col_member: string; links_title: (n: number) => string; links_lead: string; main_job: string;
};

const TEXT: Record<Lang, Words> = {
  fr: {
    ties_title: 'Liens d\'intérêts au Parlement', ties_lead: (n, p) => `${n} ${n > 1 ? 'liens actuels' : 'lien actuel'} avec des entreprises, associations et organisations, dont ${p} ${p > 1 ? 'rémunérés' : 'rémunéré'}.`,
    council: { NR: 'Conseil national', SR: 'Conseil des États' }, since: (y) => `depuis ${y}`,
    col_org: 'Organisation', col_role: 'Fonction', col_pay: 'Rémunération', col_group: 'Domaine', more: (n) => `Afficher les ${n} autres`,
    kind: { mitglied: 'Membre', vorstand: 'Comité / conseil d\'administration', beirat: 'Conseil consultatif', taetig: 'Activité', geschaeftsfuehrend: 'Direction', gesellschafter: 'Associé·e', finanziell: 'Intérêt financier' },
    role: { praesident: 'président·e', vizepraesident: 'vice-président·e', mitglied: '', geschaeftsfuehrend: 'direction', co_praesident: 'coprésident·e' },
    pay: (v) => (v == null ? '–' : v < 0 ? 'membre cotisant' : v === 0 ? 'bénévole' : v === 1 ? 'rémunéré (montant non publié)' : `CHF ${num(v)} par an`),
    source: 'Source : Lobbywatch.ch, licence CC BY-SA 4.0. Données déclarées au Parlement et complétées par Lobbywatch.', open: 'Voir sur Lobbywatch', col_member: 'Parlementaire',
    links_title: (n) => `${n} ${n > 1 ? 'parlementaires liés' : 'parlementaire lié·e'} à cette organisation`,
    links_lead: 'Membres de l\'Assemblée fédérale qui déclarent un lien actuel avec cette organisation.', main_job: 'activité principale',
  },
  de: {
    ties_title: 'Interessenbindungen im Parlament', ties_lead: (n, p) => `${n} aktuelle ${n > 1 ? 'Bindungen' : 'Bindung'} an Firmen, Verbände und Organisationen, davon ${p} bezahlt.`,
    council: { NR: 'Nationalrat', SR: 'Ständerat' }, since: (y) => `seit ${y}`,
    col_org: 'Organisation', col_role: 'Funktion', col_pay: 'Vergütung', col_group: 'Bereich', more: (n) => `Die ${n} weiteren anzeigen`,
    kind: { mitglied: 'Mitglied', vorstand: 'Vorstand / Verwaltungsrat', beirat: 'Beirat', taetig: 'Tätigkeit', geschaeftsfuehrend: 'Geschäftsführung', gesellschafter: 'Gesellschafter·in', finanziell: 'Finanzielle Beteiligung' },
    role: { praesident: 'Präsident·in', vizepraesident: 'Vizepräsident·in', mitglied: '', geschaeftsfuehrend: 'Geschäftsführung', co_praesident: 'Co-Präsident·in' },
    pay: (v) => (v == null ? '–' : v < 0 ? 'zahlendes Mitglied' : v === 0 ? 'ehrenamtlich' : v === 1 ? 'bezahlt (Betrag nicht offengelegt)' : `CHF ${num(v)} pro Jahr`),
    source: 'Quelle: Lobbywatch.ch, Lizenz CC BY-SA 4.0. Dem Parlament deklarierte und von Lobbywatch ergänzte Angaben.', open: 'Auf Lobbywatch ansehen', col_member: 'Ratsmitglied',
    links_title: (n) => `${n} mit dieser Organisation ${n > 1 ? 'verbundene Ratsmitglieder' : 'verbundenes Ratsmitglied'}`,
    links_lead: 'Mitglieder der Bundesversammlung, die eine aktuelle Bindung an diese Organisation deklarieren.', main_job: 'Hauptberuf',
  },
  it: {
    ties_title: 'Relazioni d\'interesse in Parlamento', ties_lead: (n, p) => `${n} ${n > 1 ? 'relazioni attuali' : 'relazione attuale'} con aziende, associazioni e organizzazioni, di cui ${p} ${p > 1 ? 'retribuite' : 'retribuita'}.`,
    council: { NR: 'Consiglio nazionale', SR: 'Consiglio degli Stati' }, since: (y) => `dal ${y}`,
    col_org: 'Organizzazione', col_role: 'Funzione', col_pay: 'Retribuzione', col_group: 'Settore', more: (n) => `Mostra gli altri ${n}`,
    kind: { mitglied: 'Membro', vorstand: 'Comitato / consiglio d\'amministrazione', beirat: 'Comitato consultivo', taetig: 'Attività', geschaeftsfuehrend: 'Direzione', gesellschafter: 'Socio/a', finanziell: 'Interesse finanziario' },
    role: { praesident: 'presidente', vizepraesident: 'vicepresidente', mitglied: '', geschaeftsfuehrend: 'direzione', co_praesident: 'copresidente' },
    pay: (v) => (v == null ? '–' : v < 0 ? 'membro pagante' : v === 0 ? 'a titolo onorifico' : v === 1 ? 'retribuito (importo non pubblicato)' : `CHF ${num(v)} all'anno`),
    source: 'Fonte: Lobbywatch.ch, licenza CC BY-SA 4.0. Dati dichiarati al Parlamento e completati da Lobbywatch.', open: 'Vedi su Lobbywatch', col_member: 'Parlamentare',
    links_title: (n) => `${n} ${n > 1 ? 'parlamentari legati' : 'parlamentare legato/a'} a questa organizzazione`,
    links_lead: "Membri dell'Assemblea federale che dichiarano una relazione attuale con questa organizzazione.", main_job: 'attività principale',
  },
  en: {
    ties_title: 'Ties declared in Parliament', ties_lead: (n, p) => `${n} current ${n > 1 ? 'ties' : 'tie'} to companies, associations and organisations, ${p} of them paid.`,
    council: { NR: 'National Council', SR: 'Council of States' }, since: (y) => `since ${y}`,
    col_org: 'Organisation', col_role: 'Role', col_pay: 'Pay', col_group: 'Field', more: (n) => `Show the other ${n}`,
    kind: { mitglied: 'Member', vorstand: 'Board', beirat: 'Advisory board', taetig: 'Works for', geschaeftsfuehrend: 'Management', gesellschafter: 'Partner', finanziell: 'Financial interest' },
    role: { praesident: 'chair', vizepraesident: 'vice-chair', mitglied: '', geschaeftsfuehrend: 'management', co_praesident: 'co-chair' },
    pay: (v) => (v == null ? '–' : v < 0 ? 'paying member' : v === 0 ? 'unpaid' : v === 1 ? 'paid (amount not disclosed)' : `CHF ${num(v)} a year`),
    source: 'Source: Lobbywatch.ch, licence CC BY-SA 4.0. Declared to Parliament and completed by Lobbywatch.', open: 'See on Lobbywatch', col_member: 'Member',
    links_title: (n) => `${n} ${n > 1 ? 'members of parliament' : 'member of parliament'} tied to this organisation`,
    links_lead: 'Members of the Federal Assembly who declare a current tie to this organisation.', main_job: 'main job',
  },
};
const W = () => TEXT[lang()];

/** Lobbywatch pages exist in German and French. */
const lwUrl = (id: number) => `https://daten.lobbywatch.ch/${lang() === 'fr' ? 'fr' : 'de'}/parlamentarier/${id}`;

function roleText(kind: string, role: string | null): string {
  const w = W();
  const r = role && role !== 'mitglied' ? (w.role[role] ?? role) : '';
  return [w.kind[kind] ?? kind, r].filter(Boolean).join(', ');
}

const FIRST = 15;

/** Card with a member of parliament's ties (candidate page). */
export function tiesCard(p: Parliament): string {
  const w = W();
  if (!p) return '';
  const paid = p.ties.filter((t) => (t.pay ?? 0) >= 1).length;
  const year = p.in_council_since ? new Intl.DateTimeFormat(locale(), { year: 'numeric' }).format(new Date(p.in_council_since)) : '';
  const orgLink = (t: Tie) => (t.actor_id ? `<a href="${href(`actor/${t.actor_id}`)}">${esc(t.org_name)}</a>`
    : t.donor_id ? `<a href="${href(`donor/${t.donor_id}`)}">${esc(t.org_name)}</a>` : esc(t.org_name));
  const row = (t: Tie, i: number) => `<tr${i >= FIRST ? ' hidden data-more' : ''}>
      <td>${orgLink(t)}<div class="m-only muted small"><span>${esc(roleText(t.kind, t.role))}</span></div></td>
      <td>${esc(roleText(t.kind, t.role))}${t.main_job ? ` <span class="muted small">(${esc(w.main_job)})</span>` : ''}</td>
      <td>${esc(t.lobby_group ?? '')}</td>
      <td>${esc(w.pay(t.pay))}</td></tr>`;
  return `<section class="card m-compact lobby">
      <h2>${esc(w.ties_title)}</h2>
      <p class="card-meta">${p.council ? `<span class="badge">${esc(w.council[p.council])}</span>` : ''}${year ? `<span>${esc(w.since(year))}</span>` : ''}</p>
      <p>${esc(w.ties_lead(p.ties.length, paid))}</p>
      ${p.ties.length ? `<div class="table-wrap"><table>
        <thead><tr><th>${esc(w.col_org)}</th><th>${esc(w.col_role)}</th><th>${esc(w.col_group)}</th><th>${esc(w.col_pay)}</th></tr></thead>
        <tbody>${p.ties.map(row).join('')}</tbody></table></div>
        ${p.ties.length > FIRST ? `<p class="cand-foot"><button type="button" class="more-btn" data-show-more>${esc(w.more(p.ties.length - FIRST))}</button></p>` : ''}` : ''}
      <p class="muted small">${esc(w.source)} <a href="${lwUrl(p.id)}" target="_blank" rel="noopener">${esc(w.open)} ↗</a></p>
    </section>`;
}

/** Wires the "show more" button of cards rendered by tiesCard. */
export function wireLobby(root: HTMLElement) {
  root.querySelectorAll<HTMLButtonElement>('[data-show-more]').forEach((b) => b.addEventListener('click', () => {
    b.closest('section')!.querySelectorAll<HTMLElement>('[data-more]').forEach((r) => { r.hidden = false; });
    b.parentElement!.remove();
  }));
}

/** Appends "members of parliament tied to this organisation" (actor or donor page); nothing when there are none. */
export async function lobbyLinksCard(container: HTMLElement, kind: 'actors' | 'donors', id: number) {
  const rows = await get<Link[]>(`${kind}/${id}/lobby`).catch(() => [] as Link[]);
  if (!rows.length) return;
  const w = W();
  const people = new Set(rows.map((r) => r.lw_id)).size;
  const name = (r: Link) => {
    const n = esc(`${r.first_name} ${r.last_name}`);
    return r.candidate_id ? `<a href="${href(`candidate/${r.candidate_id}`)}">${n}</a>` : n;
  };
  const party = (r: Link) => (r.party_label ? `<span class="badge"><i class="dot" style="background:${esc(r.party_color ?? 'var(--neutral)')}"></i>${esc(r.party_label)}</span>` : '');
  const section = document.createElement('section');
  section.className = 'card m-compact lobby';
  section.innerHTML = `<h2>${esc(w.links_title(people))}</h2><p class="muted small">${esc(w.links_lead)}</p>
    <div class="table-wrap"><table>
      <thead><tr><th>${esc(w.col_member)}</th><th>${esc(w.col_role)}</th><th></th><th>${esc(w.col_pay)}</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td>${name(r)}<div class="m-only muted small">${party(r)}<span>${esc(roleText(r.kind, r.role))}</span></div></td>
        <td>${esc(roleText(r.kind, r.role))}</td>
        <td>${party(r)} <span class="muted small">${esc([r.canton, r.council ? w.council[r.council] : ''].filter(Boolean).join(' · '))}</span></td>
        <td>${esc(w.pay(r.pay))}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted small">${esc(w.source)}</p>`;
  container.append(section);
}
