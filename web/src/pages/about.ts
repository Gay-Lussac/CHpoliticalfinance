import { esc } from '../format';
import { lang, T } from '../i18n';

const TEXT = {
  fr: `
<h2>D'où viennent les données ?</h2>
<p>Toutes les données proviennent de la plateforme de transparence du <a href="https://politikfinanzierung.efk.admin.ch/app/fr" target="_blank" rel="noopener">Contrôle fédéral des finances (CDF)</a>.
Depuis 2023, les partis représentés à l'Assemblée fédérale, ainsi que les personnes et organisations qui dépensent plus de 50 000 CHF pour une campagne de votation ou d'élection fédérale, doivent déclarer leurs recettes.
Les libéralités (dons) de plus de 15 000 CHF par donateur doivent être déclarées nominativement.</p>
<p>Ce site récupère automatiquement ces déclarations, les archive et les rassemble dans une base de données. Il ne les modifie pas : les montants sont ceux déclarés.</p>
<p>Les résultats des votations et les recommandations des partis et associations proviennent de <a href="https://swissvotes.ch" target="_blank" rel="noopener">Swissvotes</a> (Année politique suisse, Université de Berne), sous licence CC BY 4.0.</p>
<h2>Budget et décompte final</h2>
<p>Pour chaque campagne, deux déclarations existent : les <strong>recettes budgétées</strong>, publiées avant le scrutin, et le <strong>décompte final</strong>, publié après. Elles sont présentées séparément et ne sont jamais additionnées.</p>
<h2>Limites</h2>
<ul>
<li>Seules les libéralités de plus de 15 000 CHF sont nominatives : le total des « libéralités » listées est donc inférieur au total des recettes.</li>
<li>Les donateurs sont regroupés automatiquement lorsque leur nom (et, pour les personnes physiques, leur prénom et leur commune) sont identiques. Des doublons ou des regroupements erronés restent possibles.</li>
<li>Le rattachement d'une organisation à un parti est une estimation fondée sur son nom (ou sur le parti des candidat·e·s soutenu·e·s pour les élections).</li>
<li>Les campagnes cantonales et communales ne sont pas couvertes.</li>
</ul>
<h2>Alignement avec les recommandations de vote</h2>
<p>Pour les organisations et entreprises donatrices, le site calcule la part de leur argent versée au camp (Oui ou Non) que chaque parti ou association avait recommandé, sur les votations où celui-ci a recommandé Oui ou Non. C’est un simple constat sur l’argent déclaré, pas un positionnement politique. Il n’est <strong>pas</strong> calculé pour les personnes physiques, car il révélerait leurs opinions politiques.</p>
<h2>Données personnelles</h2>
<p>Les noms des donateurs sont publiés par le CDF en vertu de la loi. Ce site n'ajoute aucune information provenant d'autres sources et n'indexe pas les pages des donateurs dans les moteurs de recherche. Toute correction publiée par le CDF est reprise automatiquement.</p>`,
  de: `
<h2>Woher stammen die Daten?</h2>
<p>Alle Daten stammen von der Transparenzplattform der <a href="https://politikfinanzierung.efk.admin.ch/app/de" target="_blank" rel="noopener">Eidgenössischen Finanzkontrolle (EFK)</a>.
Seit 2023 müssen die in der Bundesversammlung vertretenen Parteien sowie Personen und Organisationen, die mehr als 50 000 CHF für eine eidgenössische Abstimmungs- oder Wahlkampagne aufwenden, ihre Einnahmen offenlegen.
Zuwendungen über 15 000 CHF pro Zuwender·in müssen namentlich deklariert werden.</p>
<p>Diese Website ruft die Offenlegungen automatisch ab, archiviert sie und führt sie in einer Datenbank zusammen. Die Beträge werden nicht verändert.</p>
<p>Abstimmungsergebnisse und Parolen der Parteien und Verbände stammen von <a href="https://swissvotes.ch" target="_blank" rel="noopener">Swissvotes</a> (Année politique suisse, Universität Bern), Lizenz CC BY 4.0.</p>
<h2>Budget und Schlussrechnung</h2>
<p>Für jede Kampagne gibt es zwei Offenlegungen: die <strong>budgetierten Einnahmen</strong> vor dem Urnengang und die <strong>Schlussrechnung</strong> danach. Sie werden getrennt dargestellt und nie addiert.</p>
<h2>Grenzen</h2>
<ul>
<li>Nur Zuwendungen über 15 000 CHF sind namentlich: Die Summe der aufgeführten Zuwendungen ist daher kleiner als die Gesamteinnahmen.</li>
<li>Zuwendende werden automatisch zusammengeführt, wenn Name (und bei natürlichen Personen Vorname und Wohnort) übereinstimmen. Doppelte oder falsche Zusammenführungen sind möglich.</li>
<li>Die Zuordnung einer Organisation zu einer Partei ist eine Schätzung anhand des Namens (bei Wahlen anhand der Partei der unterstützten Kandidierenden).</li>
<li>Kantonale und kommunale Kampagnen sind nicht erfasst.</li>
</ul>
<h2>Übereinstimmung mit den Abstimmungsparolen</h2>
<p>Für zuwendende Organisationen und Unternehmen berechnet die Website den Anteil ihres Geldes, der an das von einer Partei oder einem Verband empfohlene Lager (Ja oder Nein) ging, bei Abstimmungen mit Ja- oder Nein-Parole. Das ist eine reine Feststellung zum deklarierten Geld, keine politische Einordnung. Für natürliche Personen wird sie <strong>nicht</strong> berechnet, da sie deren politische Ansichten offenlegen würde.</p>
<h2>Personendaten</h2>
<p>Die Namen der Zuwendenden werden von der EFK gestützt auf das Gesetz veröffentlicht. Diese Website ergänzt sie nicht mit anderen Quellen und lässt die Seiten der Zuwendenden nicht von Suchmaschinen indexieren. Korrekturen der EFK werden automatisch übernommen.</p>`,
  it: `
<h2>Da dove provengono i dati?</h2>
<p>Tutti i dati provengono dalla piattaforma di trasparenza del <a href="https://politikfinanzierung.efk.admin.ch/app/it" target="_blank" rel="noopener">Controllo federale delle finanze (CDF)</a>.
Dal 2023 i partiti rappresentati nell'Assemblea federale, nonché le persone e le organizzazioni che spendono più di 50 000 CHF per una campagna di votazione o di elezione federale, devono dichiarare le loro entrate.
Le liberalità (donazioni) superiori a 15 000 CHF per donatore devono essere dichiarate nominativamente.</p>
<p>Questo sito recupera automaticamente queste dichiarazioni, le archivia e le riunisce in una banca dati. Non le modifica: gli importi sono quelli dichiarati.</p>
<p>I risultati delle votazioni e le raccomandazioni dei partiti e delle associazioni provengono da <a href="https://swissvotes.ch" target="_blank" rel="noopener">Swissvotes</a> (Année politique suisse, Università di Berna), licenza CC BY 4.0.</p>
<h2>Preventivo e conto finale</h2>
<p>Per ogni campagna esistono due dichiarazioni: le <strong>entrate preventivate</strong>, pubblicate prima del voto, e il <strong>conto finale</strong>, pubblicato dopo. Sono presentate separatamente e non vengono mai sommate.</p>
<h2>Limiti</h2>
<ul>
<li>Solo le liberalità superiori a 15 000 CHF sono nominative: il totale delle liberalità elencate è quindi inferiore al totale delle entrate.</li>
<li>I donatori vengono raggruppati automaticamente quando il nome (e, per le persone fisiche, il nome, il cognome e il comune) sono identici. Doppioni o raggruppamenti errati restano possibili.</li>
<li>L'attribuzione di un'organizzazione a un partito è una stima basata sul suo nome (o, per le elezioni, sul partito dei candidati sostenuti).</li>
<li>Le campagne cantonali e comunali non sono coperte.</li>
<li>I titoli ufficiali sono quelli del CDF; alcune designazioni (ad es. istituzioni, descrizioni di prestazioni) sono disponibili solo nella lingua della dichiarazione.</li>
</ul>
<h2>Allineamento con le raccomandazioni di voto</h2>
<p>Per le organizzazioni e le aziende donatrici, il sito calcola la quota del loro denaro versata al fronte (Sì o No) raccomandato da ciascun partito o associazione, nelle votazioni in cui questo ha raccomandato Sì o No. È una semplice constatazione sul denaro dichiarato, non un posizionamento politico. <strong>Non</strong> viene calcolato per le persone fisiche, perché rivelerebbe le loro opinioni politiche.</p>
<h2>Dati personali</h2>
<p>I nomi dei donatori sono pubblicati dal CDF in virtù della legge. Questo sito non aggiunge informazioni provenienti da altre fonti e non fa indicizzare le pagine dei donatori dai motori di ricerca. Ogni correzione pubblicata dal CDF viene ripresa automaticamente.</p>`,
  en: `
<h2>Where does the data come from?</h2>
<p>All data comes from the transparency platform of the <a href="https://politikfinanzierung.efk.admin.ch/app/de" target="_blank" rel="noopener">Swiss Federal Audit Office (SFAO)</a>.
Since 2023, parties represented in the Federal Assembly, as well as people and organisations spending more than CHF 50,000 on a federal vote or election campaign, must declare their revenue.
Donations above CHF 15,000 per donor must be declared by name.</p>
<p>This site collects these declarations automatically, archives them and brings them together in a database. It does not alter them: amounts are as declared.</p>
<p>The SFAO publishes in French, German and Italian only. Titles of votes and other official labels are shown in French on the English version.</p>
<p>Vote results and the recommendations of parties and federations come from <a href="https://swissvotes.ch" target="_blank" rel="noopener">Swissvotes</a> (Année politique suisse, University of Bern), licensed CC BY 4.0.</p>
<h2>Budget and final accounts</h2>
<p>Each campaign files two declarations: <strong>budgeted revenue</strong>, published before the vote, and the <strong>final accounts</strong>, published afterwards. They are shown separately and never added together.</p>
<h2>Limitations</h2>
<ul>
<li>Only donations above CHF 15,000 are named, so the total of listed donations is lower than total revenue.</li>
<li>Donors are grouped automatically when their name (and, for individuals, first name and municipality) match. Duplicates or wrong groupings remain possible.</li>
<li>Linking an organisation to a party is an estimate based on its name (or, for elections, on the party of the candidates it supports).</li>
<li>Cantonal and municipal campaigns are not covered.</li>
</ul>
<h2>Alignment with voting recommendations</h2>
<p>For donor organisations and companies, the site computes the share of their money that went to the side (Yes or No) each party or federation recommended, on votes where it recommended Yes or No. It is a plain observation about declared money, not a political positioning. It is <strong>not</strong> computed for private individuals, as it would reveal their political opinions.</p>
<h2>Personal data</h2>
<p>Donor names are published by the SFAO as required by law. This site adds no information from other sources and keeps donor pages out of search engines. Any correction published by the SFAO is picked up automatically.</p>`,
};

export function aboutPage(main: HTMLElement) {
  main.innerHTML = `<article class="prose card"><h1>${esc(T().about_title)}</h1>${TEXT[lang()]}</article>`;
}
