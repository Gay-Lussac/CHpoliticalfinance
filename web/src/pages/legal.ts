// Privacy statement (nFADP art. 19) and legal notice / terms of use, in 4 languages.
// Operator identity comes from config/legal.json.
import legal from '../../../config/legal.json';
import { esc } from '../format';
import { lang, type Lang } from '../i18n';

const contact = (): string => {
  const parts: string[] = [];
  if (legal.operator_name) parts.push(esc(legal.operator_name));
  if (legal.operator_address) parts.push(esc(legal.operator_address));
  if (legal.contact_email) parts.push(`<a href="mailto:${esc(legal.contact_email)}">${esc(legal.contact_email)}</a>`);
  if (!legal.contact_email && legal.contact_url) parts.push(`<a href="${esc(legal.contact_url)}" target="_blank" rel="noopener">${esc(legal.contact_url)}</a>`);
  return parts.join('<br>');
};

const CCBY = '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>';
const OPENUSE = '<a href="https://opendata.swiss/fr/terms-of-use#terms_open" target="_blank" rel="noopener">opendata.swiss – Open use</a>';
const FDPIC = '<a href="https://www.edoeb.admin.ch" target="_blank" rel="noopener">edoeb.admin.ch</a>';

type Doc = { title: string; html: () => string };

const PRIVACY: Record<Lang, Doc> = {
  fr: { title: 'Protection des données', html: () => `
<p><em>Version du 11 octobre 2026.</em> Cette déclaration informe sur le traitement de données personnelles par ce site, conformément à la loi fédérale sur la protection des données (LPD).</p>
<h2>1. Responsable</h2><p>${contact()}</p>
<h2>2. Visiteurs du site</h2>
<ul>
<li><strong>Pas de cookies, pas de traceurs, aucun service tiers</strong> (ni Google, ni Facebook, ni Amazon). Les polices et tous les fichiers sont servis par notre propre serveur.</li>
<li><strong>Statistiques de visite anonymes :</strong> nous comptons les pages vues par jour, la langue et le site d’origine (p. ex. un journal qui renvoie vers nous). Aucune adresse IP, aucune donnée de navigateur n’est enregistrée. Pour compter les visiteurs uniques, une empreinte temporaire (hachage avec une clé changée chaque jour) est gardée uniquement en mémoire vive le jour même, puis oubliée. Les navigateurs qui envoient « Do Not Track » ne sont pas comptés.</li>
<li><strong>Journaux techniques :</strong> notre application n’enregistre pas les adresses IP. Notre hébergeur (Infomaniak Network SA, Genève, serveurs en Suisse) peut conserver brièvement des journaux techniques à des fins de sécurité et d’exploitation, selon sa propre déclaration de protection des données.</li>
<li>Pour éviter les abus, le nombre de requêtes par client est limité ; ce compteur est gardé uniquement en mémoire, quelques minutes.</li>
</ul>
<h2>3. Personnes figurant dans les données</h2>
<p>Le site présente les déclarations publiées par le Contrôle fédéral des finances (CDF) en vertu des règles fédérales de transparence du financement politique (art. 76b ss LDP) : acteurs politiques, comités, candidat·e·s et auteurs de libéralités de plus de 15 000 CHF (nom, prénom, commune, montant, date). S’y ajoutent les résultats et recommandations de vote publiés par Swissvotes.</p>
<ul>
<li><strong>But :</strong> rendre compréhensible le financement de la vie politique suisse et contribuer au débat public. Nous invoquons l’intérêt public prépondérant à la transparence du financement politique, voulu par le législateur.</li>
<li><strong>Traitements :</strong> les données sont reprises telles que publiées, regroupées et agrégées. Les donateurs portant le même nom (et, pour les personnes physiques, le même prénom et la même commune) sont regroupés automatiquement ; un même nom ne signifie pas nécessairement une même personne. L’« alignement avec les recommandations de vote » est un calcul sur l’argent déclaré et ne reflète pas les opinions de la personne.</li>
<li><strong>Durée :</strong> les données sont synchronisées chaque nuit ; ce que le CDF corrige ou retire est corrigé ou retiré ici aussi.</li>
<li><strong>Moteurs de recherche :</strong> les pages des donateurs sont exclues de l’indexation.</li>
<li><strong>Communication à l’étranger :</strong> aucune. Les données sont hébergées en Suisse.</li>
</ul>
<h2>4. Vos droits</h2>
<p>Vous pouvez demander l’accès à vos données, leur rectification, ou vous opposer à leur affichage nominatif sur ce site (masquage du nom). Écrivez-nous (point 1) ; nous répondons dans les 30 jours. Les erreurs dans les déclarations elles-mêmes doivent aussi être signalées au CDF, qui les publie. Vous pouvez saisir le Préposé fédéral à la protection des données et à la transparence (${FDPIC}).</p>` },
  de: { title: 'Datenschutz', html: () => `
<p><em>Fassung vom 11. Oktober 2026.</em> Diese Erklärung informiert über die Bearbeitung von Personendaten durch diese Website gemäss dem Bundesgesetz über den Datenschutz (DSG).</p>
<h2>1. Verantwortlich</h2><p>${contact()}</p>
<h2>2. Besuchende der Website</h2>
<ul>
<li><strong>Keine Cookies, keine Tracker, keine Drittdienste</strong> (weder Google noch Facebook noch Amazon). Schriften und alle Dateien kommen von unserem eigenen Server.</li>
<li><strong>Anonyme Besuchsstatistik:</strong> Wir zählen Seitenaufrufe pro Tag, Sprache und Herkunftsseite (z. B. eine Zeitung, die auf uns verlinkt). Es werden keine IP-Adressen und keine Browserdaten gespeichert. Für eindeutige Besuchende wird ein temporärer Fingerabdruck (Hash mit täglich wechselndem Schlüssel) nur am selben Tag im Arbeitsspeicher gehalten und danach vergessen. Browser mit «Do Not Track» werden nicht gezählt.</li>
<li><strong>Technische Protokolle:</strong> Unsere Anwendung speichert keine IP-Adressen. Unser Hoster (Infomaniak Network AG, Genf, Server in der Schweiz) kann technische Protokolle kurz für Sicherheit und Betrieb aufbewahren, gemäss seiner eigenen Datenschutzerklärung.</li>
<li>Zum Schutz vor Missbrauch ist die Zahl der Anfragen pro Client begrenzt; dieser Zähler liegt nur einige Minuten im Arbeitsspeicher.</li>
</ul>
<h2>3. Personen in den Daten</h2>
<p>Die Website zeigt die von der Eidgenössischen Finanzkontrolle (EFK) gestützt auf die Transparenzregeln zur Politikfinanzierung (Art. 76b ff. BPR) veröffentlichten Offenlegungen: politische Akteure, Komitees, Kandidierende und Zuwendende über 15 000 CHF (Name, Vorname, Wohnort, Betrag, Datum). Dazu kommen die von Swissvotes veröffentlichten Abstimmungsergebnisse und Parolen.</p>
<ul>
<li><strong>Zweck:</strong> die Finanzierung der Schweizer Politik verständlich machen und zur öffentlichen Debatte beitragen. Wir stützen uns auf das überwiegende öffentliche Interesse an der vom Gesetzgeber gewollten Transparenz der Politikfinanzierung.</li>
<li><strong>Bearbeitung:</strong> Die Daten werden wie veröffentlicht übernommen, zusammengeführt und aggregiert. Zuwendende mit gleichem Namen (und bei natürlichen Personen gleichem Vornamen und Wohnort) werden automatisch zusammengeführt; gleicher Name bedeutet nicht zwingend dieselbe Person. Die «Übereinstimmung mit den Abstimmungsparolen» ist eine Berechnung auf Basis des deklarierten Geldes und gibt nicht die Meinung der Person wieder.</li>
<li><strong>Dauer:</strong> Die Daten werden jede Nacht abgeglichen; was die EFK korrigiert oder entfernt, wird auch hier korrigiert oder entfernt.</li>
<li><strong>Suchmaschinen:</strong> Die Seiten der Zuwendenden sind von der Indexierung ausgeschlossen.</li>
<li><strong>Bekanntgabe ins Ausland:</strong> keine. Die Daten liegen in der Schweiz.</li>
</ul>
<h2>4. Ihre Rechte</h2>
<p>Sie können Auskunft über Ihre Daten, deren Berichtigung verlangen oder der namentlichen Anzeige auf dieser Website widersprechen (Maskierung des Namens). Schreiben Sie uns (Punkt 1); wir antworten innert 30 Tagen. Fehler in den Offenlegungen selbst sollten auch der EFK gemeldet werden, die sie veröffentlicht. Sie können sich an den Eidgenössischen Datenschutz- und Öffentlichkeitsbeauftragten wenden (${FDPIC}).</p>` },
  it: { title: 'Protezione dei dati', html: () => `
<p><em>Versione dell’11 ottobre 2026.</em> La presente dichiarazione informa sul trattamento di dati personali da parte di questo sito, conformemente alla legge federale sulla protezione dei dati (LPD).</p>
<h2>1. Titolare</h2><p>${contact()}</p>
<h2>2. Visitatori del sito</h2>
<ul>
<li><strong>Nessun cookie, nessun tracciamento, nessun servizio di terzi</strong> (né Google, né Facebook, né Amazon). I caratteri e tutti i file sono serviti dal nostro server.</li>
<li><strong>Statistiche di visita anonime:</strong> contiamo le pagine viste al giorno, la lingua e il sito di provenienza (p. es. un giornale che rimanda a noi). Nessun indirizzo IP e nessun dato del browser vengono salvati. Per contare i visitatori unici, un’impronta temporanea (hash con una chiave cambiata ogni giorno) è tenuta solo in memoria il giorno stesso, poi dimenticata. I browser che inviano «Do Not Track» non vengono contati.</li>
<li><strong>Registri tecnici:</strong> la nostra applicazione non registra indirizzi IP. Il nostro hosting (Infomaniak Network SA, Ginevra, server in Svizzera) può conservare brevemente registri tecnici per sicurezza e gestione, secondo la propria dichiarazione sulla protezione dei dati.</li>
<li>Per evitare abusi, il numero di richieste per client è limitato; questo contatore resta solo in memoria per pochi minuti.</li>
</ul>
<h2>3. Persone presenti nei dati</h2>
<p>Il sito presenta le dichiarazioni pubblicate dal Controllo federale delle finanze (CDF) in virtù delle regole federali sulla trasparenza del finanziamento politico (art. 76b segg. LDP): attori politici, comitati, candidati e autori di liberalità superiori a 15 000 CHF (nome, cognome, comune, importo, data), oltre ai risultati e alle raccomandazioni di voto pubblicati da Swissvotes.</p>
<ul>
<li><strong>Scopo:</strong> rendere comprensibile il finanziamento della politica svizzera e contribuire al dibattito pubblico. Ci basiamo sull’interesse pubblico preponderante alla trasparenza del finanziamento politico, voluta dal legislatore.</li>
<li><strong>Trattamenti:</strong> i dati sono ripresi così come pubblicati, raggruppati e aggregati. I donatori con lo stesso nome (e, per le persone fisiche, lo stesso cognome e comune) sono raggruppati automaticamente; lo stesso nome non significa necessariamente la stessa persona. L’«allineamento con le raccomandazioni di voto» è un calcolo sul denaro dichiarato e non riflette le opinioni della persona.</li>
<li><strong>Durata:</strong> i dati sono sincronizzati ogni notte; ciò che il CDF corregge o ritira è corretto o ritirato anche qui.</li>
<li><strong>Motori di ricerca:</strong> le pagine dei donatori sono escluse dall’indicizzazione.</li>
<li><strong>Comunicazione all’estero:</strong> nessuna. I dati sono ospitati in Svizzera.</li>
</ul>
<h2>4. I vostri diritti</h2>
<p>Potete chiedere l’accesso ai vostri dati, la loro rettifica o opporvi alla loro visualizzazione nominativa su questo sito (mascheramento del nome). Scriveteci (punto 1); rispondiamo entro 30 giorni. Gli errori nelle dichiarazioni stesse vanno segnalati anche al CDF, che le pubblica. Potete rivolgervi all’Incaricato federale della protezione dei dati e della trasparenza (${FDPIC}).</p>` },
  en: { title: 'Privacy', html: () => `
<p><em>Version of 11 October 2026.</em> This statement explains how this site processes personal data, in accordance with the Swiss Federal Act on Data Protection (FADP).</p>
<h2>1. Controller</h2><p>${contact()}</p>
<h2>2. Visitors</h2>
<ul>
<li><strong>No cookies, no trackers, no third-party services</strong> (no Google, Facebook or Amazon). Fonts and all files are served from our own server.</li>
<li><strong>Anonymous visit statistics:</strong> we count page views per day, language and referring site (e.g. a newspaper linking to us). No IP addresses and no browser data are stored. To count unique visitors, a temporary fingerprint (a hash with a key that changes every day) is kept in memory only, for the same day, then forgotten. Browsers sending "Do Not Track" are not counted.</li>
<li><strong>Technical logs:</strong> our application does not log IP addresses. Our host (Infomaniak Network SA, Geneva, servers in Switzerland) may keep technical logs briefly for security and operations, under its own privacy policy.</li>
<li>To prevent abuse, the number of requests per client is limited; this counter is kept in memory only, for a few minutes.</li>
</ul>
<h2>3. People in the data</h2>
<p>The site presents the declarations published by the Swiss Federal Audit Office (SFAO/EFK) under the federal transparency rules for political financing (art. 76b ff. Federal Act on Political Rights): political actors, committees, candidates and donors above CHF 15,000 (name, first name, municipality, amount, date), plus the vote results and recommendations published by Swissvotes.</p>
<ul>
<li><strong>Purpose:</strong> making Swiss political financing understandable and contributing to public debate. We rely on the overriding public interest in the transparency of political financing intended by the legislator.</li>
<li><strong>Processing:</strong> data are taken as published, grouped and aggregated. Donors with the same name (and, for individuals, the same first name and municipality) are grouped automatically; the same name does not necessarily mean the same person. The "alignment with voting recommendations" is a calculation on declared money and does not reflect anyone's opinions.</li>
<li><strong>Retention:</strong> data are synchronised every night; what the SFAO corrects or removes is corrected or removed here too.</li>
<li><strong>Search engines:</strong> donor pages are excluded from indexing.</li>
<li><strong>Transfers abroad:</strong> none. Data are hosted in Switzerland.</li>
</ul>
<h2>4. Your rights</h2>
<p>You may request access to your data, their correction, or object to being shown by name on this site (name masking). Contact us (section 1); we reply within 30 days. Errors in the declarations themselves should also be reported to the SFAO, which publishes them. You may contact the Federal Data Protection and Information Commissioner (${FDPIC}).</p>` },
};

const LEGAL: Record<Lang, Doc> = {
  fr: { title: 'Mentions légales', html: () => `
<h2>Éditeur</h2><p>${contact()}</p>
<h2>Indépendance</h2><p>Ce site est un projet indépendant et non commercial. Il n’est <strong>pas lié</strong> au Contrôle fédéral des finances, à la Confédération, à la Chancellerie fédérale ni à Swissvotes, et ne prend pas position dans les votations et élections.</p>
<h2>Exactitude et responsabilité</h2><p>Les montants sont ceux déclarés au CDF, repris sans modification ; ils peuvent contenir des erreurs des déclarants. Les regroupements de donateurs, le rattachement d’organisations à des partis et l’alignement avec les recommandations sont des traitements automatiques présentés comme tels. Malgré le soin apporté, aucune garantie n’est donnée quant à l’exactitude, l’exhaustivité ou l’actualité des informations. Dans la mesure permise par la loi, toute responsabilité pour des dommages résultant de l’utilisation du site est exclue. Pour signaler une erreur : voir « Éditeur ».</p>
<h2>Sources et licences</h2><ul>
<li>Déclarations : Contrôle fédéral des finances, politikfinanzierung.efk.admin.ch, conditions ${OPENUSE}.</li>
<li>Résultats, recommandations, titres anglais : Swissvotes – Année politique suisse, Université de Berne, licence ${CCBY}. Données appariées et agrégées par nos soins.</li>
<li>Code du site : licence MIT, <a href="https://github.com/Gay-Lussac/CHpoliticalfinance" target="_blank" rel="noopener">GitHub</a>.</li></ul>
<h2>Accessibilité</h2><p>Le site vise la conformité aux WCAG 2.1 niveau AA : navigation au clavier, contrastes suffisants, chaque graphique est accompagné de ses données en tableau. Signalez-nous tout obstacle.</p>
<h2>Droit applicable</h2><p>Droit suisse.</p>` },
  de: { title: 'Impressum', html: () => `
<h2>Herausgeber</h2><p>${contact()}</p>
<h2>Unabhängigkeit</h2><p>Diese Website ist ein unabhängiges, nicht kommerzielles Projekt. Sie ist <strong>nicht verbunden</strong> mit der Eidgenössischen Finanzkontrolle, dem Bund, der Bundeskanzlei oder Swissvotes und nimmt zu Abstimmungen und Wahlen keine Stellung.</p>
<h2>Richtigkeit und Haftung</h2><p>Die Beträge entsprechen den bei der EFK deklarierten Angaben und werden unverändert übernommen; sie können Fehler der Deklarierenden enthalten. Zusammenführungen von Zuwendenden, die Zuordnung von Organisationen zu Parteien und die Übereinstimmung mit Parolen sind automatische, als solche gekennzeichnete Bearbeitungen. Trotz Sorgfalt wird keine Gewähr für Richtigkeit, Vollständigkeit oder Aktualität übernommen. Soweit gesetzlich zulässig, ist jede Haftung für Schäden aus der Nutzung der Website ausgeschlossen. Fehler melden: siehe «Herausgeber».</p>
<h2>Quellen und Lizenzen</h2><ul>
<li>Offenlegungen: Eidgenössische Finanzkontrolle, politikfinanzierung.efk.admin.ch, Bedingungen ${OPENUSE}.</li>
<li>Ergebnisse, Parolen, englische Titel: Swissvotes – Année politique suisse, Universität Bern, Lizenz ${CCBY}. Von uns zugeordnet und aggregiert.</li>
<li>Code der Website: MIT-Lizenz, <a href="https://github.com/Gay-Lussac/CHpoliticalfinance" target="_blank" rel="noopener">GitHub</a>.</li></ul>
<h2>Barrierefreiheit</h2><p>Die Website strebt Konformität mit WCAG 2.1 Stufe AA an: Tastaturbedienung, ausreichende Kontraste, jede Grafik mit ihren Daten als Tabelle. Melden Sie uns Hindernisse.</p>
<h2>Anwendbares Recht</h2><p>Schweizer Recht.</p>` },
  it: { title: 'Note legali', html: () => `
<h2>Editore</h2><p>${contact()}</p>
<h2>Indipendenza</h2><p>Questo sito è un progetto indipendente e non commerciale. <strong>Non è legato</strong> al Controllo federale delle finanze, alla Confederazione, alla Cancelleria federale né a Swissvotes, e non prende posizione nelle votazioni ed elezioni.</p>
<h2>Esattezza e responsabilità</h2><p>Gli importi sono quelli dichiarati al CDF, ripresi senza modifiche; possono contenere errori dei dichiaranti. I raggruppamenti dei donatori, l’attribuzione di organizzazioni ai partiti e l’allineamento con le raccomandazioni sono trattamenti automatici presentati come tali. Nonostante la cura, non si garantisce l’esattezza, la completezza o l’attualità delle informazioni. Nella misura consentita dalla legge, è esclusa ogni responsabilità per danni derivanti dall’uso del sito. Per segnalare un errore: vedi «Editore».</p>
<h2>Fonti e licenze</h2><ul>
<li>Dichiarazioni: Controllo federale delle finanze, politikfinanzierung.efk.admin.ch, condizioni ${OPENUSE}.</li>
<li>Risultati, raccomandazioni, titoli inglesi: Swissvotes – Année politique suisse, Università di Berna, licenza ${CCBY}. Dati abbinati e aggregati da noi.</li>
<li>Codice del sito: licenza MIT, <a href="https://github.com/Gay-Lussac/CHpoliticalfinance" target="_blank" rel="noopener">GitHub</a>.</li></ul>
<h2>Accessibilità</h2><p>Il sito mira alla conformità WCAG 2.1 livello AA: navigazione da tastiera, contrasti sufficienti, ogni grafico è accompagnato dai suoi dati in tabella. Segnalateci eventuali ostacoli.</p>
<h2>Diritto applicabile</h2><p>Diritto svizzero.</p>` },
  en: { title: 'Legal notice', html: () => `
<h2>Publisher</h2><p>${contact()}</p>
<h2>Independence</h2><p>This site is an independent, non-commercial project. It is <strong>not affiliated</strong> with the Swiss Federal Audit Office, the Swiss Confederation, the Federal Chancellery or Swissvotes, and takes no position in votes or elections.</p>
<h2>Accuracy and liability</h2><p>Amounts are those declared to the SFAO, taken over unchanged; they may contain errors made by the declarants. Donor grouping, linking organisations to parties and the alignment with recommendations are automatic processing, presented as such. Despite our care, no guarantee is given as to accuracy, completeness or timeliness. To the extent permitted by law, any liability for damage arising from use of the site is excluded. To report an error: see "Publisher".</p>
<h2>Sources and licences</h2><ul>
<li>Declarations: Swiss Federal Audit Office, politikfinanzierung.efk.admin.ch, terms ${OPENUSE}.</li>
<li>Results, recommendations, English titles: Swissvotes – Année politique suisse, University of Bern, licence ${CCBY}. Matched and aggregated by us.</li>
<li>Site code: MIT licence, <a href="https://github.com/Gay-Lussac/CHpoliticalfinance" target="_blank" rel="noopener">GitHub</a>.</li></ul>
<h2>Accessibility</h2><p>The site aims for WCAG 2.1 level AA conformance: keyboard navigation, sufficient contrast, every chart comes with its data as a table. Please report any barrier.</p>
<h2>Governing law</h2><p>Swiss law.</p>` },
};

export const privacyTitle = () => PRIVACY[lang()].title;
export const legalTitle = () => LEGAL[lang()].title;

export function privacyPage(main: HTMLElement) {
  const d = PRIVACY[lang()];
  main.innerHTML = `<article class="prose card"><h1>${esc(d.title)}</h1>${d.html()}</article>`;
}

export function legalPage(main: HTMLElement) {
  const d = LEGAL[lang()];
  main.innerHTML = `<article class="prose card"><h1>${esc(d.title)}</h1>${d.html()}</article>`;
}
