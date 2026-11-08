// "Orientation" tab of an actor page: what the actor did, not who paid it.
// Votes: its campaign side vs. each party's / federation's Yes/No recommendation (Swissvotes).
// Elections: parties of the candidates it backed; each campaign's amount split evenly between its candidates.
import { get } from '../api';
import { chf, chfShort, date, esc, num, typo } from '../format';
import { lang, locale, T, tr, type Lang } from '../i18n';
import { href } from '../router';

interface Rec { id: number; code: string; kind: 'party' | 'organisation'; label: string; color: string | null;
  agree: number; disagree: number; n: number; share: number }
interface VoteRow { financing_id: number; title: string; event_date: string; stance: 'for' | 'against';
  outcome: string | null; won: boolean | null }
interface PartyRow { code: string | null; label: string | null; color: string | null; n_candidates: number; est_chf: number; share: number }
export interface Orientation {
  votes: VoteRow[]; recommenders: Rec[];
  elections: { n_candidates: number; total_chf: number; parties: PartyRow[];
    campaigns: { campaign_id: number; financing_id: number; title: string; event_date: string; total: number | null; n_candidates: number }[] };
}

const TEXT: Record<Lang, {
  tab_money: string; tab_orientation: string; votes_title: string; votes_intro: (n: number) => string;
  parties: string; orgs: string; same: string; opposite: string; agree_sub: (a: number, n: number) => string;
  few: string; list_title: string; side: string; result: string; won: string; lost: string; pending: string;
  el_title: string; el_intro: (n: number) => string; el_note: string; col_party: string; col_cands: string; col_est: string;
  el_campaigns: string; with_n: (n: number) => string; none: string; unknown_party: string;
}> = {
  fr: {
    tab_money: 'Argent', tab_orientation: 'Orientation',
    votes_title: 'Votations : avec qui est-il d\'accord ?',
    votes_intro: (n) => `D'après le camp de ses campagnes (Oui ou Non) dans ${n} ${n > 1 ? 'votations' : 'votation'}, comparé aux mots d'ordre des partis et des fédérations (Swissvotes). Les montants n'entrent pas en compte.`,
    parties: 'Partis', orgs: 'Fédérations et organisations', same: 'Même camp que', opposite: 'Camp opposé à',
    agree_sub: (a, n) => `d'accord dans ${a} sur ${n}`,
    few: 'Trop peu de votations pour un pourcentage : voici simplement qui a recommandé le même camp.',
    list_title: 'Ses positions', side: 'Camp', result: 'Résultat', won: 'gagné', lost: 'perdu', pending: 'à venir',
    el_title: 'Élections : les partis des candidat·e·s soutenu·e·s',
    el_intro: (n) => `${n} ${n > 1 ? 'candidat·e·s soutenu·e·s' : 'candidat·e soutenu·e'}, par parti.`,
    el_note: "Estimation : une campagne déclare un seul montant pour tous les candidat·e·s qu'elle soutient. Le montant par personne n'étant pas connu, il est réparti à parts égales entre elles et eux.",
    col_party: 'Parti', col_cands: 'Candidat·e·s', col_est: 'Montant estimé',
    el_campaigns: 'Campagnes électorales', with_n: (n) => `${n} ${n > 1 ? 'candidat·e·s' : 'candidat·e'}`,
    none: "Pas encore de position connue : cet acteur n'a fait campagne ni pour ou contre un objet avec des mots d'ordre, ni pour des candidat·e·s nommé·e·s.",
    unknown_party: 'Sans parti connu',
  },
  de: {
    tab_money: 'Geld', tab_orientation: 'Ausrichtung',
    votes_title: 'Abstimmungen: Mit wem ist der Akteur einig?',
    votes_intro: (n) => `Nach der Seite seiner Kampagnen (Ja oder Nein) in ${n} ${n > 1 ? 'Abstimmungen' : 'Abstimmung'}, verglichen mit den Parolen der Parteien und Verbände (Swissvotes). Beträge zählen nicht.`,
    parties: 'Parteien', orgs: 'Verbände und Organisationen', same: 'Gleiche Seite wie', opposite: 'Gegenseite von',
    agree_sub: (a, n) => `einig in ${a} von ${n}`,
    few: 'Zu wenige Abstimmungen für einen Prozentwert: hier einfach, wer dieselbe Seite empfohlen hat.',
    list_title: 'Seine Positionen', side: 'Seite', result: 'Resultat', won: 'gewonnen', lost: 'verloren', pending: 'noch offen',
    el_title: 'Wahlen: Parteien der unterstützten Kandidierenden',
    el_intro: (n) => `${n} unterstützte ${n > 1 ? 'Kandidierende' : 'Kandidatur'}, nach Partei.`,
    el_note: 'Schätzung: Eine Kampagne deklariert einen einzigen Betrag für alle Kandidierenden, die sie unterstützt. Da der Betrag pro Person nicht bekannt ist, wird er zu gleichen Teilen aufgeteilt.',
    col_party: 'Partei', col_cands: 'Kandidierende', col_est: 'Geschätzter Betrag',
    el_campaigns: 'Wahlkampagnen', with_n: (n) => `${n} ${n > 1 ? 'Kandidierende' : 'Kandidatur'}`,
    none: 'Noch keine bekannte Position: Dieser Akteur hat weder für oder gegen eine Vorlage mit Parolen noch für namentlich genannte Kandidierende geworben.',
    unknown_party: 'Ohne bekannte Partei',
  },
  it: {
    tab_money: 'Soldi', tab_orientation: 'Orientamento',
    votes_title: 'Votazioni: con chi è d\'accordo?',
    votes_intro: (n) => `In base al campo delle sue campagne (Sì o No) in ${n} ${n > 1 ? 'votazioni' : 'votazione'}, confrontato con le raccomandazioni di voto dei partiti e delle associazioni (Swissvotes). Gli importi non contano.`,
    parties: 'Partiti', orgs: 'Associazioni e organizzazioni', same: 'Stesso campo di', opposite: 'Campo opposto a',
    agree_sub: (a, n) => `d'accordo in ${a} su ${n}`,
    few: 'Troppo poche votazioni per una percentuale: ecco semplicemente chi ha raccomandato lo stesso campo.',
    list_title: 'Le sue posizioni', side: 'Campo', result: 'Risultato', won: 'vinto', lost: 'perso', pending: 'in sospeso',
    el_title: 'Elezioni: i partiti dei candidati sostenuti',
    el_intro: (n) => `${n} ${n > 1 ? 'candidature sostenute' : 'candidatura sostenuta'}, per partito.`,
    el_note: "Stima: una campagna dichiara un solo importo per tutte le candidature che sostiene. Poiché l'importo per persona non è noto, viene ripartito in parti uguali.",
    col_party: 'Partito', col_cands: 'Candidature', col_est: 'Importo stimato',
    el_campaigns: 'Campagne elettorali', with_n: (n) => `${n} ${n > 1 ? 'candidature' : 'candidatura'}`,
    none: 'Nessuna posizione nota: questo attore non ha fatto campagna né per o contro un oggetto con raccomandazioni né per candidature nominate.',
    unknown_party: 'Senza partito noto',
  },
  en: {
    tab_money: 'Money', tab_orientation: 'Orientation',
    votes_title: 'Votes: who does it agree with?',
    votes_intro: (n) => `Based on the side of its campaigns (Yes or No) in ${n} ${n > 1 ? 'votes' : 'vote'}, compared with the voting recommendations of parties and federations (Swissvotes). Amounts are not taken into account.`,
    parties: 'Parties', orgs: 'Federations and organisations', same: 'Same side as', opposite: 'Opposite side to',
    agree_sub: (a, n) => `agreed in ${a} of ${n}`,
    few: 'Too few votes for a percentage: this simply shows who recommended the same side.',
    list_title: 'Its positions', side: 'Side', result: 'Result', won: 'won', lost: 'lost', pending: 'pending',
    el_title: 'Elections: parties of the candidates it backed',
    el_intro: (n) => `${n} ${n > 1 ? 'candidates' : 'candidate'} backed, by party.`,
    el_note: 'Estimate: a campaign declares one amount for all the candidates it backs. As the amount per person is not known, it is split evenly between them.',
    col_party: 'Party', col_cands: 'Candidates', col_est: 'Estimated amount',
    el_campaigns: 'Election campaigns', with_n: (n) => `${n} ${n > 1 ? 'candidates' : 'candidate'}`,
    none: 'No known position yet: this actor has neither campaigned for or against a proposal with voting recommendations nor for named candidates.',
    unknown_party: 'No known party',
  },
};
export const OT = () => TEXT[lang()];

const MIN_FOR_SHARE = 3;
const pct = (v: number) => (v > 0 && v < 0.005 ? '< 1 %' : `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(v * 100)} %`);
const dot = (color: string | null) => `<i class="dot" style="background:${esc(color ?? 'var(--neutral)')}"></i>`;

function meterRows(items: { label: string; color: string | null; share: number; value: string; sub: string }[]) {
  return `<div class="meters">${items.map((i) => `<div class="meter-row">
      <div class="meter-label">${dot(i.color)}${esc(i.label)}</div>
      <div class="meter" role="img" aria-label="${esc(`${i.label}: ${i.value}, ${i.sub}`)}"><span style="width:${Math.max(0, Math.min(1, i.share)) * 100}%;background:${esc(i.color ?? 'var(--neutral)')}"></span></div>
      <div class="meter-value"><strong>${esc(i.value)}</strong> <span class="muted small">${esc(i.sub)}</span></div></div>`).join('')}</div>`;
}

function votesSection(o: Orientation): string {
  const m = OT();
  const t = T();
  if (!o.votes.length) return '';
  const group = (title: string, recs: Rec[]) => {
    if (!recs.length) return '';
    if (o.votes.length < MIN_FOR_SHARE) {
      const chips = (list: Rec[]) => list.map((r) => `<li class="chip">${dot(r.color)}${esc(r.label)}</li>`).join('');
      const same = recs.filter((r) => r.agree === r.n);
      const opp = recs.filter((r) => r.agree === 0);
      const mixed = recs.filter((r) => r.agree > 0 && r.agree < r.n);
      return `<h3>${esc(title)}</h3>
        ${same.length ? `<p class="small muted">${esc(m.same)}</p><ul class="chips">${chips(same)}</ul>` : ''}
        ${mixed.length ? `<ul class="chips">${mixed.map((r) => `<li class="chip">${dot(r.color)}${esc(r.label)} <span class="muted">(${esc(m.agree_sub(r.agree, r.n))})</span></li>`).join('')}</ul>` : ''}
        ${opp.length ? `<p class="small muted">${esc(m.opposite)}</p><ul class="chips">${chips(opp)}</ul>` : ''}`;
    }
    return `<h3>${esc(title)}</h3>` + meterRows(recs.map((r) => ({ label: r.label, color: r.color, share: r.share,
      value: pct(r.share), sub: m.agree_sub(r.agree, r.n) })));
  };
  const outcome = (v: VoteRow) => (v.outcome == null ? m.pending
    : `${tr(v.outcome)}${v.won == null ? '' : ` · ${v.won ? m.won : m.lost}`}`);
  return `<section class="card orient">
      <h2>${esc(m.votes_title)}</h2>
      <p class="muted small">${esc(m.votes_intro(o.votes.length))}</p>
      ${o.votes.length < MIN_FOR_SHARE ? `<p class="small">${esc(m.few)}</p>` : ''}
      ${group(m.parties, o.recommenders.filter((r) => r.kind === 'party'))}
      ${group(m.orgs, o.recommenders.filter((r) => r.kind === 'organisation'))}
      <h3>${esc(m.list_title)}</h3>
      <div class="table-wrap m-compact"><table>
        <thead><tr><th>${esc(t.vote)}</th><th>${esc(t.date)}</th><th>${esc(m.result)}</th><th>${esc(m.side)}</th></tr></thead>
        <tbody>${o.votes.map((v) => `<tr>
          <td><a href="${href(`vote/${v.financing_id}`)}">${esc(typo(v.title))}</a>
            <div class="m-only muted small">${esc(`${date(v.event_date)} · ${outcome(v)}`)}</div></td>
          <td class="nowrap">${esc(date(v.event_date))}</td><td>${esc(outcome(v))}</td>
          <td><span class="badge"><i class="dot ${v.stance === 'for' ? 'yes' : 'no'}"></i>${esc(v.stance === 'for' ? t.for : t.against)}</span></td></tr>`).join('')}</tbody></table></div>
    </section>`;
}

function electionsSection(o: Orientation): string {
  const e = o.elections;
  if (!e.n_candidates) return '';
  const m = OT();
  const hasMoney = e.total_chf > 0;
  return `<section class="card orient">
      <h2>${esc(m.el_title)}</h2>
      <p class="muted small">${esc(m.el_intro(e.n_candidates))}</p>
      ${meterRows(e.parties.map((p) => ({ label: p.label ?? m.unknown_party, color: p.color, share: p.share,
        value: hasMoney ? pct(p.share) : num(p.n_candidates),
        sub: hasMoney ? `${chfShort(p.est_chf)} · ${m.with_n(p.n_candidates)}` : m.with_n(p.n_candidates) })))}
      <p class="muted small">${esc(m.el_note)}</p>
      <h3>${esc(m.el_campaigns)}</h3>
      <ul class="plain-list">${e.campaigns.map((c) => `<li><a href="${href(`election/${c.financing_id}`)}">${esc(typo(c.title))}</a>
        <span class="muted small">· ${esc(m.with_n(c.n_candidates))}${c.total != null ? ` · ${esc(chf(c.total))}` : ''}</span></li>`).join('')}</ul>
    </section>`;
}

export const hasOrientation = (o: Orientation | null) => !!o && (o.votes.length > 0 || o.elections.n_candidates > 0);

export function orientationHtml(o: Orientation | null): string {
  if (!hasOrientation(o)) return `<p class="muted">${esc(OT().none)}</p>`;
  return votesSection(o!) + electionsSection(o!);
}

export const loadOrientation = (id: number) => get<Orientation>(`actors/${id}/orientation`).catch(() => null);
