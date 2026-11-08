// Election candidates: the list on an election page and one page per candidate (who backed them, with how much).
// A campaign's declared revenue covers every candidate it names together, so money is attributed to a candidate
// only for campaigns backing that candidate alone; shared campaigns are listed with their size, never split.
import { get } from '../api';
import { chf, chfShort, date, esc, num, typo } from '../format';
import { lang, locale, setPageTitle, T, type Lang } from '../i18n';
import { href } from '../router';
import { statTiles } from './common';

export interface CandidateRow {
  id: number; name: string; canton: string | null; party_code: string | null; party_color: string | null;
  party_label: string | null; n_backers: number; n_dedicated: number; dedicated_total: number;
}

interface Backer {
  campaign_id: number; financing_id: number; event_date: string | null; council: string | null; financing_title: string;
  actor_id: number; actor_name: string; actor_type: string; n_candidates: number; total: number | null; is_final: boolean;
}
interface DonorRow { donor_id: number | null; display_name: string | null; donor_type: string; total: number; n: number;
  is_anonymous: number; suppressed?: boolean }
interface Candidate { id: number; name: string; canton: string | null; party_code: string | null; party_color: string | null;
  party_label: string | null; backers: Backer[]; donors: DonorRow[] }

const TEXT: Record<Lang, {
  section: string; intro: string; search: string; canton: string; party: string; all: string;
  col_name: string; col_backers: string; n_backers: (n: number) => string; col_own: string; none: string; more: (n: number) => string; shown: (a: number, b: number) => string;
  candidate: string; own_title: string; own_sub: (n: number) => string; backers_title: string; backers_sub: string;
  shared_title: string; shared_sub: (n: number) => string; dedicated: string; shared: (n: number) => string;
  col_campaign: string; col_scope: string; col_declared: string; donors_title: string; donors_note: string;
  donors_none: string; col_n: string; anonymous: string; masked: string; budget_note: string; method: string; own_campaign: string;
}> = {
  fr: {
    section: 'Candidat·e·s et leurs soutiens',
    intro: "Chaque campagne déclare les candidat·e·s qu'elle soutient. Son argent couvre tous ces candidat·e·s ensemble : il n'est attribué à une personne que si la campagne ne soutient qu'elle.",
    search: 'Chercher un nom', canton: 'Canton', party: 'Parti', all: 'Tous',
    col_name: 'Candidat·e', col_backers: 'Campagnes de soutien', n_backers: (n) => `${n} ${n > 1 ? 'campagnes de soutien' : 'campagne de soutien'}`, col_own: 'Campagne propre', none: 'Aucun·e candidat·e trouvé·e.',
    more: (n) => `Afficher ${n} de plus`, shown: (a, b) => `${a} sur ${b}`,
    candidate: 'Candidat·e', own_title: 'Campagne propre', own_sub: (n) => `${n} ${n > 1 ? 'campagnes' : 'campagne'} pour elle ou lui seul·e`,
    backers_title: 'Campagnes de soutien', backers_sub: 'qui la ou le nomment',
    shared_title: 'Soutiens partagés', shared_sub: (n) => `${n} ${n > 1 ? 'campagnes' : 'campagne'} pour plusieurs candidat·e·s`,
    dedicated: 'pour elle ou lui seul·e', shared: (n) => `avec ${n - 1} ${n - 1 > 1 ? 'autres candidat·e·s' : 'autre candidat·e'}`,
    col_campaign: 'Qui soutient', col_scope: 'Pour qui', col_declared: 'Recettes déclarées de la campagne',
    donors_title: 'Dons à sa campagne propre', donors_note: 'Dons de plus de 15 000 CHF, nommés dans les déclarations.',
    donors_none: 'Aucun don déclaré pour une campagne propre.', col_n: 'Dons', anonymous: 'Dons non nominatifs', masked: 'Donateur masqué',
    budget_note: '(budget)',
    method: "Les recettes d'une campagne qui soutient plusieurs candidat·e·s ne sont pas réparties entre elles et eux : c'est le montant de toute la campagne. Montants : le décompte final s'il est publié, sinon le budget.",
    own_campaign: 'sa propre campagne',
  },
  de: {
    section: 'Kandidierende und ihre Unterstützung',
    intro: 'Jede Kampagne gibt an, welche Kandidierenden sie unterstützt. Ihr Geld gilt für alle diese Kandidierenden zusammen: Einer Person zugerechnet wird es nur, wenn die Kampagne nur sie unterstützt.',
    search: 'Name suchen', canton: 'Kanton', party: 'Partei', all: 'Alle',
    col_name: 'Kandidatur', col_backers: 'Unterstützende Kampagnen', n_backers: (n) => `${n} ${n > 1 ? 'unterstützende Kampagnen' : 'unterstützende Kampagne'}`, col_own: 'Eigene Kampagne', none: 'Keine Kandidierenden gefunden.',
    more: (n) => `${n} weitere anzeigen`, shown: (a, b) => `${a} von ${b}`,
    candidate: 'Kandidatur', own_title: 'Eigene Kampagne', own_sub: (n) => `${n} ${n > 1 ? 'Kampagnen' : 'Kampagne'} nur für diese Person`,
    backers_title: 'Unterstützende Kampagnen', backers_sub: 'die diese Person nennen',
    shared_title: 'Geteilte Unterstützung', shared_sub: (n) => `${n} ${n > 1 ? 'Kampagnen' : 'Kampagne'} für mehrere Kandidierende`,
    dedicated: 'nur für diese Person', shared: (n) => `mit ${n - 1} ${n - 1 > 1 ? 'weiteren Kandidierenden' : 'weiteren Kandidatur'}`,
    col_campaign: 'Wer unterstützt', col_scope: 'Für wen', col_declared: 'Deklarierte Einnahmen der Kampagne',
    donors_title: 'Zuwendungen an die eigene Kampagne', donors_note: 'Zuwendungen über 15 000 CHF, in den Deklarationen namentlich genannt.',
    donors_none: 'Keine deklarierten Zuwendungen an eine eigene Kampagne.', col_n: 'Zuwendungen', anonymous: 'Nicht namentliche Zuwendungen', masked: 'Maskierte Person',
    budget_note: '(Budget)',
    method: 'Die Einnahmen einer Kampagne, die mehrere Kandidierende unterstützt, werden nicht auf sie aufgeteilt: Es ist der Betrag der ganzen Kampagne. Beträge: Schlussrechnung, falls veröffentlicht, sonst Budget.',
    own_campaign: 'eigene Kampagne',
  },
  it: {
    section: 'Candidati/e e chi li ha sostenuti',
    intro: 'Ogni campagna dichiara i candidati e le candidate che sostiene. I suoi soldi valgono per tutti insieme: sono attribuiti a una persona solo se la campagna sostiene solo lei.',
    search: 'Cerca un nome', canton: 'Cantone', party: 'Partito', all: 'Tutti',
    col_name: 'Candidatura', col_backers: 'Campagne di sostegno', n_backers: (n) => `${n} ${n > 1 ? 'campagne di sostegno' : 'campagna di sostegno'}`, col_own: 'Campagna propria', none: 'Nessuna candidatura trovata.',
    more: (n) => `Mostra altri ${n}`, shown: (a, b) => `${a} su ${b}`,
    candidate: 'Candidatura', own_title: 'Campagna propria', own_sub: (n) => `${n} ${n > 1 ? 'campagne' : 'campagna'} solo per questa persona`,
    backers_title: 'Campagne di sostegno', backers_sub: 'che nominano questa persona',
    shared_title: 'Sostegni condivisi', shared_sub: (n) => `${n} ${n > 1 ? 'campagne' : 'campagna'} per più candidature`,
    dedicated: 'solo per questa persona', shared: (n) => `con ${n - 1} ${n - 1 > 1 ? 'altre candidature' : 'altra candidatura'}`,
    col_campaign: 'Chi sostiene', col_scope: 'Per chi', col_declared: 'Entrate dichiarate della campagna',
    donors_title: 'Liberalità alla campagna propria', donors_note: 'Liberalità superiori a 15 000 CHF, nominate nelle dichiarazioni.',
    donors_none: 'Nessuna liberalità dichiarata per una campagna propria.', col_n: 'Liberalità', anonymous: 'Liberalità non nominative', masked: 'Persona mascherata',
    budget_note: '(budget)',
    method: "Le entrate di una campagna che sostiene più candidature non vengono ripartite: è l'importo dell'intera campagna. Importi: conto finale se pubblicato, altrimenti il budget.",
    own_campaign: 'campagna propria',
  },
  en: {
    section: 'Candidates and who backed them',
    intro: "Each campaign declares the candidates it supports. Its money covers all of them together: it is attributed to one person only when the campaign backs that person alone.",
    search: 'Search a name', canton: 'Canton', party: 'Party', all: 'All',
    col_name: 'Candidate', col_backers: 'Backing campaigns', n_backers: (n) => `${n} ${n > 1 ? 'backing campaigns' : 'backing campaign'}`, col_own: 'Own campaign', none: 'No candidates found.',
    more: (n) => `Show ${n} more`, shown: (a, b) => `${a} of ${b}`,
    candidate: 'Candidate', own_title: 'Own campaign', own_sub: (n) => `${n} ${n > 1 ? 'campaigns' : 'campaign'} for this person alone`,
    backers_title: 'Backing campaigns', backers_sub: 'naming this person',
    shared_title: 'Shared backing', shared_sub: (n) => `${n} ${n > 1 ? 'campaigns' : 'campaign'} for several candidates`,
    dedicated: 'for this person alone', shared: (n) => `with ${n - 1} other ${n - 1 > 1 ? 'candidates' : 'candidate'}`,
    col_campaign: 'Who backs', col_scope: 'For whom', col_declared: "Campaign's declared revenue",
    donors_title: 'Donations to their own campaign', donors_note: 'Donations over CHF 15,000, named in the declarations.',
    donors_none: 'No declared donations to an own campaign.', col_n: 'Donations', anonymous: 'Unnamed donations', masked: 'Masked donor',
    budget_note: '(budget)',
    method: "The revenue of a campaign backing several candidates is not split between them: it is the whole campaign's amount. Amounts: final accounts when published, otherwise the budget.",
    own_campaign: 'own campaign',
  },
};
const M = () => TEXT[lang()];

const partyChip = (c: { party_color: string | null; party_label: string | null }) => (c.party_label
  ? `<span class="badge"><i class="dot" style="background:${esc(c.party_color ?? 'var(--neutral)')}"></i>${esc(c.party_label)}</span>` : '');

const PAGE_SIZE = 50;

/** Searchable candidate list, appended to an election page. Renders nothing when the election has no candidates. */
export async function candidatesSection(main: HTMLElement, financingId: number) {
  const rows = await get<CandidateRow[]>(`financings/${financingId}/candidates`).catch(() => []);
  if (!rows.length) return;
  const m = M();
  const cantons = [...new Set(rows.map((r) => r.canton).filter(Boolean) as string[])].sort();
  const parties = [...new Map(rows.filter((r) => r.party_label).map((r) => [r.party_label!, r])).keys()]
    .sort((a, b) => a.localeCompare(b, locale()));
  const section = document.createElement('section');
  section.className = 'card candidates m-compact';
  section.innerHTML = `<h2>${esc(m.section)} <span class="muted small">(${num(rows.length)})</span></h2>
    <p class="muted small">${esc(m.intro)}</p>
    <form class="explore-form cand-filters" role="search">
      <label>${esc(m.search)}<input type="search" name="q" autocomplete="off" /></label>
      ${cantons.length > 1 ? `<label>${esc(m.canton)}<select name="canton"><option value="">${esc(m.all)}</option>${cantons.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>` : ''}
      ${parties.length > 1 ? `<label>${esc(m.party)}<select name="party"><option value="">${esc(m.all)}</option>${parties.map((p) => `<option>${esc(p)}</option>`).join('')}</select></label>` : ''}
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th>${esc(m.col_name)}</th><th>${esc(m.canton)}</th><th>${esc(m.party)}</th><th>${esc(m.col_backers)}</th><th>${esc(m.col_own)}</th></tr></thead>
      <tbody></tbody></table></div>
    <p class="cand-foot"><span class="muted small" data-shown></span> <button type="button" class="more-btn" hidden></button></p>`;
  main.append(section);

  const form = section.querySelector('form')!;
  const body = section.querySelector('tbody')!;
  const shown = section.querySelector('[data-shown]')!;
  const more = section.querySelector<HTMLButtonElement>('.more-btn')!;
  const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  let limit = PAGE_SIZE;

  const render = () => {
    const fd = new FormData(form);
    const q = fold(String(fd.get('q') ?? '').trim());
    const canton = String(fd.get('canton') ?? '');
    const party = String(fd.get('party') ?? '');
    const hits = rows.filter((r) => (!q || fold(r.name).includes(q)) && (!canton || r.canton === canton)
      && (!party || r.party_label === party));
    body.innerHTML = hits.slice(0, limit).map((r) => `<tr>
        <td><a href="${href(`candidate/${r.id}`)}">${esc(r.name)}</a>
          <div class="m-only muted small">${partyChip(r)}<span>${esc([r.canton, m.n_backers(r.n_backers)].filter(Boolean).join(' · '))}</span></div></td>
        <td>${esc(r.canton ?? '')}</td><td>${partyChip(r)}</td>
        <td><span class="num">${num(r.n_backers)}</span></td>
        <td><span class="num">${r.n_dedicated ? chf(r.dedicated_total) : '–'}</span></td></tr>`).join('')
      || `<tr><td colspan="5" class="muted">${esc(m.none)}</td></tr>`;
    shown.textContent = m.shown(Math.min(limit, hits.length), hits.length);
    const rest = hits.length - limit;
    more.hidden = rest <= 0;
    more.textContent = m.more(Math.min(rest, PAGE_SIZE));
  };
  form.addEventListener('input', () => { limit = PAGE_SIZE; render(); });
  form.addEventListener('submit', (e) => e.preventDefault());
  more.addEventListener('click', () => { limit += PAGE_SIZE; render(); });
  render();
}

export async function candidatePage(main: HTMLElement, id: string | undefined) {
  const t = T();
  const m = M();
  const c = await get<Candidate>(`candidates/${Number(id)}`).catch(() => null);
  if (!c) { main.innerHTML = `<p>${t.not_found}</p>`; return; }
  setPageTitle(c.canton ? `${c.name} (${c.canton})` : c.name);

  const own = c.backers.filter((b) => b.n_candidates === 1);
  const shared = c.backers.filter((b) => b.n_candidates > 1);
  const ownTotal = own.reduce((s, b) => s + (b.total ?? 0), 0);
  const elections = [...new Map(c.backers.map((b) => [b.financing_id, b])).values()];

  const backerRow = (b: Backer) => `<tr>
      <td><a href="${href(`actor/${b.actor_id}`)}">${esc(b.actor_name)}</a>${b.n_candidates === 1 && b.actor_type === 'natural_person' && b.actor_name === c.name ? ` <span class="muted small">(${esc(m.own_campaign)})</span>` : ''}
        <div class="m-only muted small">${esc(b.n_candidates === 1 ? m.dedicated : m.shared(b.n_candidates))}</div></td>
      <td>${esc(b.n_candidates === 1 ? m.dedicated : m.shared(b.n_candidates))}</td>
      <td><span class="num">${b.total == null ? '–' : chf(b.total)}</span>${b.total != null && !b.is_final ? ` <span class="muted small">${esc(m.budget_note)}</span>` : ''}</td></tr>`;

  const byElection = elections.map((e) => {
    const list = c.backers.filter((b) => b.financing_id === e.financing_id);
    return `<section class="card m-compact"><h2><a href="${href(`election/${e.financing_id}`)}">${esc(typo(e.financing_title))}</a>
        <span class="muted small">${esc(date(e.event_date))}</span></h2>
      <div class="table-wrap"><table>
        <thead><tr><th>${esc(m.col_campaign)}</th><th>${esc(m.col_scope)}</th><th>${esc(m.col_declared)}</th></tr></thead>
        <tbody>${list.map(backerRow).join('')}</tbody></table></div></section>`;
  }).join('');

  const donorName = (d: DonorRow) => (d.suppressed ? esc(m.masked)
    : d.donor_id ? `<a href="${href(`donor/${d.donor_id}`)}">${esc(d.display_name ?? '')}</a>`
      : esc(d.is_anonymous ? m.anonymous : (d.display_name ?? m.anonymous)));
  const donors = own.length ? `<section class="card"><h2>${esc(m.donors_title)}</h2>
      <p class="muted small">${esc(m.donors_note)}</p>
      ${c.donors.length ? `<div class="table-wrap"><table>
        <thead><tr><th>${esc(t.donor)}</th><th>${esc(m.col_n)}</th><th>${esc(t.total)}</th></tr></thead>
        <tbody>${c.donors.map((d) => `<tr><td>${donorName(d)}</td><td><span class="num">${num(d.n)}</span></td>
          <td><span class="num">${chf(d.total)}</span></td></tr>`).join('')}</tbody></table></div>`
        : `<p class="muted">${esc(m.donors_none)}</p>`}</section>` : '';

  main.innerHTML = `<header class="page-head">
      <div class="card-meta"><span>${esc(m.candidate)}</span>${c.canton ? `<span class="badge">${esc(c.canton)}</span>` : ''}${partyChip(c)}</div>
      <h1>${esc(c.name)}</h1>
    </header>` + statTiles([
    { label: m.backers_title, value: num(c.backers.length), sub: m.backers_sub },
    { label: m.own_title, value: own.length ? chfShort(ownTotal) : '–', sub: m.own_sub(own.length) },
    { label: m.shared_title, value: num(shared.length), sub: m.shared_sub(shared.length) },
  ]) + byElection + donors + `<p class="muted small">${esc(m.method)}</p>`;
}
