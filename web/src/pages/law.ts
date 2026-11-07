// "What the law covers": plain-language summary of the federal transparency rules (LDP/BPR art. 76b ff., OFipo/VPofi)
// and of what they leave out, so that the figures on this site are read correctly. Not legal advice.
import { esc } from '../format';
import { lang, setPageTitle, type Lang } from '../i18n';
import { href } from '../router';

// Federal Office of Justice page (no English version: English readers get the German one).
const BJ = {
  fr: 'fr/transparence-du-financement-de-la-vie-politique', de: 'de/transparenz-bei-der-politikfinanzierung',
  it: 'it/trasparenza-nel-finanziamento-della-politica', en: 'de/transparenz-bei-der-politikfinanzierung',
} as const;
const sources = (l: Lang, label: string, efk: string, bj: string, law: string) => `
<h2>${label}</h2>
<ul>
<li><a href="https://politikfinanzierung.efk.admin.ch/app/${l === 'en' ? 'de' : l}" target="_blank" rel="noopener">${efk}</a></li>
<li><a href="https://www.bj.admin.ch/${BJ[l]}" target="_blank" rel="noopener">${bj}</a></li>
<li><a href="https://www.fedlex.admin.ch/eli/cc/1978/688_688_688/${l === 'en' ? 'de' : l}" target="_blank" rel="noopener">${law}</a></li>
</ul>`;

const DOC: Record<Lang, { title: string; html: () => string }> = {
  fr: { title: 'Ce que couvre la loi', html: () => `
<p class="lead">Depuis le 23 octobre 2022, des règles fédérales obligent les partis et les campagnes à rendre public leur financement. Voici ce qu'elles couvrent, et ce qu'elles laissent de côté : à garder en tête en lisant les chiffres de ce site.</p>
<h2>Qui doit déclarer ?</h2>
<ul>
<li><strong>Les partis représentés à l'Assemblée fédérale</strong> : chaque année, leurs recettes et les libéralités de plus de 15 000 CHF par donateur.</li>
<li><strong>Toute personne ou organisation qui dépense plus de 50 000 CHF</strong> pour une campagne de votation fédérale ou d'élection au Conseil national : un budget avant le scrutin, puis le décompte final après.</li>
</ul>
<h2>Quels dons sont nommés ?</h2>
<p>Les libéralités de plus de 15 000 CHF par donateur et par campagne, reçues dans les 12 mois avant le scrutin, sont publiées avec le nom du donateur. Les dons en nature (annonces offertes, services gratuits) comptent aussi. Les montants plus petits sont seulement inclus dans le total des recettes, sans nom.</p>
<h2>Ce qui est interdit</h2>
<p>Accepter des libéralités anonymes ou venant de l'étranger est en principe interdit. Les dons de Suisses de l'étranger sont autorisés.</p>
<h2>Contrôle et sanctions</h2>
<p>Le Contrôle fédéral des finances (CDF) reçoit les déclarations et les publie. Les montants sont ceux déclarés par les acteurs eux-mêmes. Les infractions peuvent être punies d'une amende allant jusqu'à 40 000 CHF.</p>
<h2>Ce qui n'est pas couvert</h2>
<ul>
<li>Les campagnes qui dépensent 50 000 CHF ou moins.</li>
<li>Le nom des donateurs qui ont donné 15 000 CHF ou moins (leur argent reste dans les totaux).</li>
<li>Les votations et élections cantonales et communales. Certains cantons ont leurs propres règles de transparence.</li>
<li>Le travail bénévole des militants et des membres.</li>
</ul>
<h2>Ce que cela signifie pour les chiffres de ce site</h2>
<ul>
<li>Ce sont des <strong>minimums</strong> : l'argent réellement engagé peut être plus élevé.</li>
<li>Un camp sans déclaration n'a pas forcément dépensé zéro : il peut être resté sous le seuil de 50 000 CHF.</li>
<li>Le budget et le décompte final sont deux photos prises à des moments différents ; ils ne s'additionnent pas.</li>
</ul>
<p><a href="${href('money')}">L'argent fait-il gagner les votations ? →</a></p>
${sources('fr', 'Sources', 'Plateforme de transparence du CDF', 'Office fédéral de la justice : transparence du financement de la vie politique', 'Loi fédérale sur les droits politiques, art. 76b ss')}
<p class="muted">Résumé simplifié, sans valeur juridique. Seuls les textes officiels font foi.</p>` },
  de: { title: 'Was das Gesetz erfasst', html: () => `
<p class="lead">Seit dem 23. Oktober 2022 verpflichten Bundesregeln Parteien und Kampagnen, ihre Finanzierung offenzulegen. Hier steht, was sie erfassen und was nicht: wichtig, um die Zahlen auf dieser Website richtig zu lesen.</p>
<h2>Wer muss offenlegen?</h2>
<ul>
<li><strong>Die in der Bundesversammlung vertretenen Parteien</strong>: jedes Jahr ihre Einnahmen und Zuwendungen über 15 000 CHF pro Zuwender·in.</li>
<li><strong>Alle Personen und Organisationen, die mehr als 50 000 CHF</strong> für eine eidgenössische Abstimmungskampagne oder eine Kampagne für die Nationalratswahlen aufwenden: ein Budget vor dem Urnengang, danach die Schlussrechnung.</li>
</ul>
<h2>Welche Spenden werden namentlich genannt?</h2>
<p>Zuwendungen über 15 000 CHF pro Zuwender·in und Kampagne, die in den 12 Monaten vor dem Urnengang eingegangen sind, werden mit Namen veröffentlicht. Auch Sachleistungen (geschenkte Inserate, Gratisdienstleistungen) zählen. Kleinere Beträge sind nur in den Gesamteinnahmen enthalten, ohne Namen.</p>
<h2>Was verboten ist</h2>
<p>Anonyme Zuwendungen und Zuwendungen aus dem Ausland anzunehmen, ist grundsätzlich verboten. Spenden von Auslandschweizerinnen und Auslandschweizern sind erlaubt.</p>
<h2>Kontrolle und Sanktionen</h2>
<p>Die Eidgenössische Finanzkontrolle (EFK) nimmt die Offenlegungen entgegen und veröffentlicht sie. Die Beträge sind die von den Akteuren selbst deklarierten. Verstösse können mit einer Busse bis zu 40 000 CHF bestraft werden.</p>
<h2>Was nicht erfasst ist</h2>
<ul>
<li>Kampagnen, die 50 000 CHF oder weniger aufwenden.</li>
<li>Die Namen von Zuwendenden mit 15 000 CHF oder weniger (ihr Geld bleibt in den Gesamtbeträgen).</li>
<li>Kantonale und kommunale Abstimmungen und Wahlen. Einige Kantone haben eigene Transparenzregeln.</li>
<li>Die Freiwilligenarbeit von Aktiven und Mitgliedern.</li>
</ul>
<h2>Was das für die Zahlen auf dieser Website bedeutet</h2>
<ul>
<li>Es sind <strong>Mindestbeträge</strong>: Tatsächlich eingesetztes Geld kann höher sein.</li>
<li>Ein Lager ohne Offenlegung hat nicht unbedingt nichts ausgegeben: Es kann unter der Schwelle von 50 000 CHF geblieben sein.</li>
<li>Budget und Schlussrechnung sind zwei Momentaufnahmen zu verschiedenen Zeitpunkten; sie werden nicht addiert.</li>
</ul>
<p><a href="${href('money')}">Gewinnt, wer mehr Geld hat? →</a></p>
${sources('de', 'Quellen', 'Transparenzplattform der EFK', 'Bundesamt für Justiz: Transparenz bei der Politikfinanzierung', 'Bundesgesetz über die politischen Rechte, Art. 76b ff.')}
<p class="muted">Vereinfachte Zusammenfassung ohne Rechtswirkung. Massgebend sind allein die amtlichen Texte.</p>` },
  it: { title: 'Cosa copre la legge', html: () => `
<p class="lead">Dal 23 ottobre 2022 regole federali obbligano partiti e campagne a rendere pubblico il loro finanziamento. Ecco cosa coprono e cosa lasciano fuori: da tenere a mente leggendo le cifre di questo sito.</p>
<h2>Chi deve dichiarare?</h2>
<ul>
<li><strong>I partiti rappresentati nell'Assemblea federale</strong>: ogni anno le loro entrate e le liberalità superiori a 15 000 CHF per donatore.</li>
<li><strong>Chiunque spenda più di 50 000 CHF</strong> per una campagna di votazione federale o per l'elezione del Consiglio nazionale: un budget prima dello scrutinio, poi il conto finale.</li>
</ul>
<h2>Quali donazioni sono nominative?</h2>
<p>Le liberalità superiori a 15 000 CHF per donatore e per campagna, ricevute nei 12 mesi prima dello scrutinio, sono pubblicate con il nome del donatore. Contano anche le prestazioni in natura (inserzioni offerte, servizi gratuiti). Gli importi minori sono inclusi solo nel totale delle entrate, senza nome.</p>
<h2>Cosa è vietato</h2>
<p>Accettare liberalità anonime o provenienti dall'estero è in linea di principio vietato. Le donazioni di Svizzeri all'estero sono ammesse.</p>
<h2>Controllo e sanzioni</h2>
<p>Il Controllo federale delle finanze (CDF) riceve le dichiarazioni e le pubblica. Gli importi sono quelli dichiarati dagli attori stessi. Le infrazioni possono essere punite con una multa fino a 40 000 CHF.</p>
<h2>Cosa non è coperto</h2>
<ul>
<li>Le campagne che spendono 50 000 CHF o meno.</li>
<li>Il nome dei donatori con 15 000 CHF o meno (il loro denaro resta nei totali).</li>
<li>Le votazioni e le elezioni cantonali e comunali. Alcuni cantoni hanno regole di trasparenza proprie.</li>
<li>Il lavoro volontario di militanti e membri.</li>
</ul>
<h2>Cosa significa per le cifre di questo sito</h2>
<ul>
<li>Sono <strong>importi minimi</strong>: il denaro effettivamente impiegato può essere maggiore.</li>
<li>Un fronte senza dichiarazione non ha per forza speso zero: può essere rimasto sotto la soglia di 50 000 CHF.</li>
<li>Budget e conto finale sono due istantanee prese in momenti diversi; non si sommano.</li>
</ul>
<p><a href="${href('money')}">Vince chi ha più soldi? →</a></p>
${sources('it', 'Fonti', 'Piattaforma di trasparenza del CDF', 'Ufficio federale di giustizia: trasparenza del finanziamento della politica', 'Legge federale sui diritti politici, art. 76b segg.')}
<p class="muted">Sintesi semplificata, senza valore giuridico. Fanno fede unicamente i testi ufficiali.</p>` },
  en: { title: 'What the law covers', html: () => `
<p class="lead">Since 23 October 2022, federal rules require parties and campaigns to disclose their funding. Here is what they cover and what they leave out: worth keeping in mind when reading the figures on this site.</p>
<h2>Who has to disclose?</h2>
<ul>
<li><strong>Parties represented in the Federal Assembly</strong>: every year, their revenue and any donations over CHF 15,000 per donor.</li>
<li><strong>Anyone spending more than CHF 50,000</strong> on a federal vote campaign or a National Council election campaign: a budget before the vote, then the final accounts afterwards.</li>
</ul>
<h2>Which donations are named?</h2>
<p>Donations over CHF 15,000 per donor and campaign, received in the 12 months before the vote, are published with the donor's name. In-kind contributions (free adverts, free services) count too. Smaller amounts are only included in total revenue, without names.</p>
<h2>What is banned</h2>
<p>Accepting anonymous donations or donations from abroad is banned in principle. Donations from Swiss citizens living abroad are allowed.</p>
<h2>Checks and penalties</h2>
<p>The Swiss Federal Audit Office (SFAO) receives the declarations and publishes them. The amounts are those declared by the campaigns and parties themselves. Breaches can be fined up to CHF 40,000.</p>
<h2>What is not covered</h2>
<ul>
<li>Campaigns spending CHF 50,000 or less.</li>
<li>The names of donors giving CHF 15,000 or less (their money stays in the totals).</li>
<li>Cantonal and communal votes and elections. Some cantons have their own transparency rules.</li>
<li>Volunteer work by activists and members.</li>
</ul>
<h2>What this means for the figures on this site</h2>
<ul>
<li>They are <strong>minimums</strong>: the money actually spent can be higher.</li>
<li>A side with no declaration did not necessarily spend nothing: it may have stayed under the CHF 50,000 threshold.</li>
<li>The budget and the final accounts are two snapshots taken at different times; they are never added up.</li>
</ul>
<p><a href="${href('money')}">Does money win votes? →</a></p>
${sources('en', 'Sources', 'SFAO transparency platform (German, French, Italian)', 'Federal Office of Justice: transparency in political financing (German)', 'Federal Act on Political Rights, art. 76b ff. (German)')}
<p class="muted">Simplified summary with no legal force. Only the official texts are authoritative.</p>` },
};

export const lawTitle = () => DOC[lang()].title;

export function lawPage(main: HTMLElement) {
  const d = DOC[lang()];
  setPageTitle(d.title);
  main.innerHTML = `<article class="prose card"><h1>${esc(d.title)}</h1>${d.html()}</article>`;
}
