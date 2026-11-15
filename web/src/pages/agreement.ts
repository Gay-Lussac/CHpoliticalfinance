// "Do representatives vote like their canton?": how the agreement score is computed, its limits, and the score of every
// National Council member who voted on proposals later put to the people.
import { get } from '../api';
import { esc, num } from '../format';
import { lang, locale, setPageTitle, type Lang } from '../i18n';
import { href } from '../router';

interface Row { person_number: number; first_name: string; last_name: string; canton: string | null; party_code: string | null;
  party_color: string | null; party_label: string | null; candidate_id: number | null; score: number; n: number;
  majority: number; majority_n: number }

const TEXT: Record<Lang, {
  title: string; lead: string; how: string; steps: string[]; example_title: string; example: string[]; limits_title: string;
  limits: string[]; table_title: string; search: string; canton: string; party: string; all: string; col_member: string;
  col_score: string; col_votes: string; col_majority: string; few: string; none: string; source: string; more: string;
}> = {
  fr: {
    title: 'Les élu·e·s votent-ils comme leur canton ?',
    lead: "Pour chaque membre du Conseil national, la part des électrices et électeurs inscrits de son canton qui ont voté comme elle ou lui sur les objets soumis au peuple.",
    how: 'Comment le chiffre est calculé',
    steps: [
      "On prend chaque objet soumis au peuple sur lequel le Conseil national a voté (vote final) et dont on connaît le résultat par canton.",
      "Si l'élu·e a voté pour, on compte les oui de son canton ; s'il ou elle a voté contre, les non.",
      "On divise ce nombre par le nombre d'électrices et électeurs inscrits du canton, et non par les seuls votants : la participation compte donc. Si seuls 45 % des inscrits ont voté, au plus 45 % peuvent être du même avis.",
      "Le chiffre affiché est la moyenne de ces parts sur tous les votes de l'élu·e. Les abstentions et absences ne comptent pas.",
    ],
    example_title: 'Exemple',
    example: ["Un canton compte 400 000 électrices et électeurs inscrits. 140 000 votent oui, 100 000 non (participation 60 %).",
      "Une conseillère qui avait voté pour : 140 000 / 400 000 = 35 %. Un conseiller qui avait voté contre : 100 000 / 400 000 = 25 %.",
      "On fait la moyenne de ces pourcentages sur toutes les votations de la personne."],
    limits_title: 'À lire avec prudence',
    limits: [
      "Le chiffre dépend autant de la participation du canton que de l'accord avec ses votants : à Schaffhouse, où voter est obligatoire, les chiffres sont plus élevés.",
      "Le Parlement vote des mois avant le peuple, souvent sur un texte que la campagne fera ensuite connaître autrement.",
      "Un·e élu·e représente aussi son parti, son programme et ses convictions ; ce n'est pas une note, ni une mesure de la qualité du travail parlementaire.",
      "Avec peu de votes, le chiffre varie beaucoup : on l'indique.",
      "Seul le Conseil national est couvert pour l'instant ; on indique aussi combien de fois la personne était du côté de la majorité de son canton.",
    ],
    table_title: 'Tous les membres', search: 'Chercher un nom', canton: 'Canton', party: 'Groupe', all: 'Tous', col_member: 'Membre',
    col_score: 'Électeur·rice·s du même avis', col_votes: 'Votations', col_majority: 'Avec la majorité', few: 'peu de votes', none: 'Aucun résultat.', more: 'Afficher plus',
    source: "Votes : Services du Parlement de l'Assemblée fédérale. Résultats par canton et électeur·rice·s inscrit·e·s : Office fédéral de la statistique.",
  },
  de: {
    title: 'Stimmen die Gewählten wie ihr Kanton?',
    lead: 'Für jedes Mitglied des Nationalrats der Anteil der Stimmberechtigten im eigenen Kanton, die bei Volksabstimmungen gleich gestimmt haben.',
    how: 'Wie die Zahl berechnet wird',
    steps: [
      'Berücksichtigt wird jede Vorlage, über die der Nationalrat abgestimmt hat (Schlussabstimmung) und deren Kantonsresultat bekannt ist.',
      'Hat das Ratsmitglied dafür gestimmt, zählen die Ja-Stimmen seines Kantons; hat es dagegen gestimmt, die Nein-Stimmen.',
      'Diese Zahl wird durch die Zahl der Stimmberechtigten im Kanton geteilt, nicht nur durch die Stimmenden: Die Beteiligung zählt also. Haben nur 45 % abgestimmt, können höchstens 45 % gleicher Meinung sein.',
      'Angezeigt wird der Durchschnitt dieser Anteile über alle Abstimmungen des Ratsmitglieds. Enthaltungen und Abwesenheiten zählen nicht.',
    ],
    example_title: 'Beispiel',
    example: ['Ein Kanton hat 400 000 Stimmberechtigte. 140 000 stimmen Ja, 100 000 Nein (Beteiligung 60 %).',
      'Eine Nationalrätin, die dafür gestimmt hat: 140 000 / 400 000 = 35 %. Ein Nationalrat, der dagegen gestimmt hat: 100 000 / 400 000 = 25 %.',
      'Diese Prozente werden über alle Abstimmungen der Person gemittelt.'],
    limits_title: 'Mit Vorsicht zu lesen',
    limits: [
      'Die Zahl hängt ebenso von der Beteiligung im Kanton ab wie von der Übereinstimmung: In Schaffhausen, wo Stimmpflicht gilt, sind die Werte höher.',
      'Das Parlament stimmt Monate vor dem Volk ab, oft über einen Text, den der Abstimmungskampf später anders bekannt macht.',
      'Gewählte vertreten auch ihre Partei, ihr Programm und ihre Überzeugungen; das ist keine Note und kein Mass für die Qualität der Parlamentsarbeit.',
      'Bei wenigen Abstimmungen schwankt die Zahl stark: Das wird angezeigt.',
      'Vorerst nur der Nationalrat; zusätzlich steht, wie oft die Person auf der Seite der Kantonsmehrheit war.',
    ],
    table_title: 'Alle Mitglieder', search: 'Name suchen', canton: 'Kanton', party: 'Fraktion', all: 'Alle', col_member: 'Mitglied',
    col_score: 'Stimmberechtigte gleicher Meinung', col_votes: 'Abstimmungen', col_majority: 'Mit der Mehrheit', few: 'wenige Abstimmungen', none: 'Keine Treffer.', more: 'Mehr anzeigen',
    source: 'Stimmen: Parlamentsdienste der Bundesversammlung. Kantonsresultate und Stimmberechtigte: Bundesamt für Statistik.',
  },
  it: {
    title: 'Gli eletti votano come il loro cantone?',
    lead: "Per ogni membro del Consiglio nazionale, la quota di aventi diritto di voto del suo cantone che hanno votato come lui o lei sugli oggetti sottoposti al popolo.",
    how: 'Come si calcola il numero',
    steps: [
      "Si considera ogni oggetto sottoposto al popolo su cui il Consiglio nazionale ha votato (votazione finale) e di cui si conosce il risultato per cantone.",
      "Se l'eletto ha votato a favore, si contano i sì del suo cantone; se ha votato contro, i no.",
      "Questo numero è diviso per il numero di aventi diritto di voto del cantone, non solo per i votanti: la partecipazione conta. Se ha votato solo il 45 %, al massimo il 45 % può essere della stessa opinione.",
      "Il numero mostrato è la media di queste quote su tutte le votazioni dell'eletto. Astensioni e assenze non contano.",
    ],
    example_title: 'Esempio',
    example: ['Un cantone conta 400 000 aventi diritto di voto. 140 000 votano sì, 100 000 no (partecipazione 60 %).',
      'Una consigliera che aveva votato a favore: 140 000 / 400 000 = 35 %. Un consigliere che aveva votato contro: 100 000 / 400 000 = 25 %.',
      'Si fa la media di queste percentuali su tutte le votazioni della persona.'],
    limits_title: 'Da leggere con prudenza',
    limits: [
      "Il numero dipende dalla partecipazione nel cantone quanto dall'accordo con i votanti: a Sciaffusa, dove votare è obbligatorio, i valori sono più alti.",
      'Il Parlamento vota mesi prima del popolo, spesso su un testo che la campagna farà poi conoscere in altro modo.',
      "Un eletto rappresenta anche il suo partito, il suo programma e le sue convinzioni; non è un voto in pagella né una misura della qualità del lavoro parlamentare.",
      'Con poche votazioni il numero varia molto: lo indichiamo.',
      'Per ora solo il Consiglio nazionale; indichiamo anche quante volte la persona era dalla parte della maggioranza del suo cantone.',
    ],
    table_title: 'Tutti i membri', search: 'Cerca un nome', canton: 'Cantone', party: 'Gruppo', all: 'Tutti', col_member: 'Membro',
    col_score: 'Aventi diritto della stessa opinione', col_votes: 'Votazioni', col_majority: 'Con la maggioranza', few: 'poche votazioni', none: 'Nessun risultato.', more: 'Mostra altri',
    source: "Voti: Servizi del Parlamento dell'Assemblea federale. Risultati per cantone e aventi diritto di voto: Ufficio federale di statistica.",
  },
  en: {
    title: 'Do representatives vote like their canton?',
    lead: "For each member of the National Council, the share of their canton's registered voters who voted the same way on proposals put to the people.",
    how: 'How the number is calculated',
    steps: [
      'We take every proposal put to the people on which the National Council held a final vote and whose result by canton is known.',
      "If the member voted for, we count their canton's yes votes; if against, its no votes.",
      "We divide that number by the canton's registered voters, not just those who voted: turnout counts. If only 45% voted, at most 45% can have agreed.",
      "The number shown is the average of these shares over all the member's votes. Abstentions and absences are left out.",
    ],
    example_title: 'Example',
    example: ['A canton has 400,000 registered voters. 140,000 vote yes, 100,000 no (turnout 60%).',
      'A member who voted for: 140,000 / 400,000 = 35%. A member who voted against: 100,000 / 400,000 = 25%.',
      "These percentages are averaged over all of the person's votes."],
    limits_title: 'Read with care',
    limits: [
      'The number depends as much on the canton’s turnout as on agreement with its voters: in Schaffhausen, where voting is compulsory, values are higher.',
      'Parliament votes months before the people, often on a text the campaign later presents differently.',
      'Members also represent their party, platform and convictions; this is not a score, nor a measure of the quality of their work.',
      'With few votes the number varies a lot: we flag it.',
      'Only the National Council for now; we also show how often the person was on the side of their canton’s majority.',
    ],
    table_title: 'All members', search: 'Search a name', canton: 'Canton', party: 'Group', all: 'All', col_member: 'Member',
    col_score: 'Registered voters who agreed', col_votes: 'Votes', col_majority: 'With the majority', few: 'few votes', none: 'No results.', more: 'Show more',
    source: 'Votes: Parliamentary Services of the Federal Assembly. Canton results and registered voters: Federal Statistical Office.',
  },
};
export const agreementTitle = () => TEXT[lang()].title;

const FEW = 5;
const PAGE = 60;
const pct = (v: number) => new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 1 }).format(v);
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export async function agreementPage(main: HTMLElement) {
  const m = TEXT[lang()];
  setPageTitle(m.title);
  main.innerHTML = `<header class="page-head"><h1>${esc(m.title)}</h1><p class="lead">${esc(m.lead)}</p></header>
    <div class="prose">
      <h2>${esc(m.how)}</h2><ol>${m.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      <h3>${esc(m.example_title)}</h3>${m.example.map((x) => `<p>${esc(x)}</p>`).join('')}
      <h2>${esc(m.limits_title)}</h2><ul>${m.limits.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </div>
    <section class="card m-compact" id="agree-list"><h2>${esc(m.table_title)}</h2><p class="muted">…</p></section>`;
  const rows = await get<Row[]>('parliament/agreement').catch(() => [] as Row[]);
  const box = document.getElementById('agree-list')!;
  if (!rows.length) { box.querySelector('p')!.textContent = m.none; return; }
  const max = Math.max(...rows.map((r) => r.score));
  const cantons = [...new Set(rows.map((r) => r.canton).filter(Boolean) as string[])].sort();
  const parties = [...new Set(rows.map((r) => r.party_label).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, locale()));
  box.innerHTML = `<h2>${esc(m.table_title)}</h2>
    <form class="explore-form cand-filters" role="search">
      <label>${esc(m.search)}<input type="search" name="q" autocomplete="off" /></label>
      <label>${esc(m.canton)}<select name="canton"><option value="">${esc(m.all)}</option>${cantons.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
      <label>${esc(m.party)}<select name="party"><option value="">${esc(m.all)}</option>${parties.map((p) => `<option>${esc(p)}</option>`).join('')}</select></label>
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th>${esc(m.col_member)}</th><th>${esc(m.canton)}</th><th>${esc(m.col_votes)}</th><th>${esc(m.col_majority)}</th><th>${esc(m.col_score)}</th></tr></thead>
      <tbody></tbody></table></div>
    <p class="cand-foot"><span class="muted small" data-shown></span> <button type="button" class="more-btn" hidden></button></p>
    <p class="muted small">${esc(m.source)}</p>`;
  const form = box.querySelector('form')!;
  const body = box.querySelector('tbody')!;
  const more = box.querySelector<HTMLButtonElement>('.more-btn')!;
  let limit = PAGE;
  const render = () => {
    const fd = new FormData(form);
    const q = fold(String(fd.get('q') ?? '').trim());
    const canton = String(fd.get('canton') ?? '');
    const party = String(fd.get('party') ?? '');
    const hits = rows.filter((r) => (!q || fold(`${r.first_name} ${r.last_name}`).includes(q)) && (!canton || r.canton === canton)
      && (!party || r.party_label === party));
    body.innerHTML = hits.slice(0, limit).map((r) => {
      const name = esc(`${r.first_name} ${r.last_name}`);
      const party = r.party_label ? `<span class="grp"><i class="dot" style="background:${esc(r.party_color ?? 'var(--neutral)')}"></i>${esc(r.party_label)}</span>` : '';
      return `<tr><td>${r.candidate_id ? `<a href="${href(`candidate/${r.candidate_id}`)}">${name}</a>` : name}
          <div class="m-only muted small"><span>${esc(r.canton ?? '')}</span><span>${num(r.n)} ${esc(m.col_votes.toLowerCase())}</span></div>
          <div class="muted small">${party}</div></td>
        <td>${esc(r.canton ?? '')}</td><td><span class="num">${num(r.n)}${r.n < FEW ? ` <span class="muted small">(${esc(m.few)})</span>` : ''}</span></td>
        <td><span class="num">${r.majority_n ? `${num(r.majority)} / ${num(r.majority_n)}` : '–'}</span></td>
        <td class="score-cell"><span class="num">${esc(pct(r.score))}</span><span class="score-bar"><i style="width:${(r.score / max) * 100}%"></i></span></td></tr>`;
    }).join('') || `<tr><td colspan="5" class="muted">${esc(m.none)}</td></tr>`;
    box.querySelector('[data-shown]')!.textContent = `${Math.min(limit, hits.length)} / ${hits.length}`;
    more.hidden = hits.length <= limit;
    more.textContent = m.more;
  };
  form.addEventListener('input', () => { limit = PAGE; render(); });
  form.addEventListener('submit', (e) => e.preventDefault());
  more.addEventListener('click', () => { limit += PAGE; render(); });
  render();
}
