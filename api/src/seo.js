// Server-side page metadata for search engines and link previews (WhatsApp, LinkedIn, X…), which read the HTML
// before any JavaScript runs: per page and language title, description, canonical URL, hreflang alternates,
// Open Graph tags and preview image. The block between <!--seo--> and <!--/seo--> in web/index.html is replaced.
import { LANGS } from './labels.js';

const LOCALE = { fr: 'fr-CH', de: 'de-CH', it: 'it-CH', en: 'en-GB' };
const OG_LOCALE = { fr: 'fr_CH', de: 'de_CH', it: 'it_CH', en: 'en_GB' };

const TEXT = {
  fr: {
    site: 'Argent politique suisse',
    home: 'Qui finance la politique suisse ?',
    home_desc: "Recettes et dons déclarés pour chaque votation, élection et parti en Suisse, d'après les données officielles du Contrôle fédéral des finances, mis à jour chaque nuit.",
    votes: ['Toutes les votations', 'Toutes les votations fédérales avec les recettes et les dons déclarés des comités pour et contre.'],
    elections: ['Élections', 'Élections fédérales : recettes et dons déclarés des candidats, des listes et des partis.'],
    parties: ['Partis', 'Financement annuel des partis politiques suisses : recettes et dons déclarés.'],
    explore: ['Explorer les données', 'Explorer et filtrer toutes les données du financement politique en Suisse.'],
    about: ['À propos et méthodologie', 'Sources, méthode et limites des données sur le financement politique en Suisse.'],
    privacy: ['Protection des données', 'Comment polimoney.ch traite les données : pas de cookies, pas de traceurs, pas d\'adresses IP enregistrées.'],
    legal: ['Mentions légales', 'Mentions légales de polimoney.ch.'],
    not_found: 'Page introuvable',
    amount: (chf) => `CHF ${chf} de dons déclarés. `,
    financing: 'Budgets et comptes des acteurs engagés, d\'après les données officielles du Contrôle fédéral des finances.',
    actor: (n) => `recettes et dons déclarés pour ${n} ${n > 1 ? 'campagnes' : 'campagne'}, d'après les données officielles du Contrôle fédéral des finances.`,
    image_alt: 'polimoney.ch : qui finance la politique suisse ?',
  },
  de: {
    site: 'Politfinanzierung Schweiz',
    home: 'Wer finanziert die Schweizer Politik?',
    home_desc: 'Deklarierte Einnahmen und Zuwendungen für jede Abstimmung, Wahl und Partei in der Schweiz, nach offiziellen Daten der Eidgenössischen Finanzkontrolle, jede Nacht aktualisiert.',
    votes: ['Alle Abstimmungen', 'Alle eidgenössischen Abstimmungen mit den deklarierten Einnahmen und Zuwendungen der Pro- und Contra-Komitees.'],
    elections: ['Wahlen', 'Eidgenössische Wahlen: deklarierte Einnahmen und Zuwendungen von Kandidierenden, Listen und Parteien.'],
    parties: ['Parteien', 'Jährliche Finanzierung der Schweizer Parteien: deklarierte Einnahmen und Zuwendungen.'],
    explore: ['Daten erkunden', 'Alle Daten zur Politikfinanzierung in der Schweiz erkunden und filtern.'],
    about: ['Über das Projekt und Methodik', 'Quellen, Methode und Grenzen der Daten zur Politikfinanzierung in der Schweiz.'],
    privacy: ['Datenschutz', 'Wie polimoney.ch mit Daten umgeht: keine Cookies, keine Tracker, keine gespeicherten IP-Adressen.'],
    legal: ['Impressum', 'Impressum von polimoney.ch.'],
    not_found: 'Seite nicht gefunden',
    amount: (chf) => `CHF ${chf} deklarierte Zuwendungen. `,
    financing: 'Budgets und Schlussrechnungen der beteiligten Akteure, nach offiziellen Daten der Eidgenössischen Finanzkontrolle.',
    actor: (n) => `deklarierte Einnahmen und Zuwendungen für ${n} ${n > 1 ? 'Kampagnen' : 'Kampagne'}, nach offiziellen Daten der Eidgenössischen Finanzkontrolle.`,
    image_alt: 'polimoney.ch: Wer finanziert die Schweizer Politik?',
  },
  it: {
    site: 'Finanziamento della politica svizzera',
    home: 'Chi finanzia la politica svizzera?',
    home_desc: 'Entrate e liberalità dichiarate per ogni votazione, elezione e partito in Svizzera, secondo i dati ufficiali del Controllo federale delle finanze, aggiornati ogni notte.',
    votes: ['Tutte le votazioni', 'Tutte le votazioni federali con le entrate e le liberalità dichiarate dei comitati favorevoli e contrari.'],
    elections: ['Elezioni', 'Elezioni federali: entrate e liberalità dichiarate di candidati, liste e partiti.'],
    parties: ['Partiti', 'Finanziamento annuale dei partiti svizzeri: entrate e liberalità dichiarate.'],
    explore: ['Esplorare i dati', 'Esplorare e filtrare tutti i dati sul finanziamento della politica in Svizzera.'],
    about: ['Informazioni e metodologia', 'Fonti, metodo e limiti dei dati sul finanziamento della politica in Svizzera.'],
    privacy: ['Protezione dei dati', 'Come polimoney.ch tratta i dati: nessun cookie, nessun tracker, nessun indirizzo IP registrato.'],
    legal: ['Note legali', 'Note legali di polimoney.ch.'],
    not_found: 'Pagina non trovata',
    amount: (chf) => `CHF ${chf} di liberalità dichiarate. `,
    financing: 'Budget e conti finali degli attori coinvolti, secondo i dati ufficiali del Controllo federale delle finanze.',
    actor: (n) => `entrate e liberalità dichiarate per ${n} ${n > 1 ? 'campagne' : 'campagna'}, secondo i dati ufficiali del Controllo federale delle finanze.`,
    image_alt: 'polimoney.ch: chi finanzia la politica svizzera?',
  },
  en: {
    site: 'Swiss Political Money',
    home: 'Who funds Swiss politics?',
    home_desc: 'Declared revenue and donations for every vote, election and party in Switzerland, from official Swiss Federal Audit Office data, updated every night.',
    votes: ['All votes', 'Every Swiss federal vote with the declared revenue and donations of the committees for and against.'],
    elections: ['Elections', 'Swiss federal elections: declared revenue and donations of candidates, lists and parties.'],
    parties: ['Parties', 'Annual funding of Swiss political parties: declared revenue and donations.'],
    explore: ['Explore the data', 'Explore and filter all the data on political funding in Switzerland.'],
    about: ['About and methodology', 'Sources, method and limits of the data on political funding in Switzerland.'],
    privacy: ['Privacy', 'How polimoney.ch handles data: no cookies, no trackers, no stored IP addresses.'],
    legal: ['Legal notice', 'Legal notice of polimoney.ch.'],
    not_found: 'Page not found',
    amount: (chf) => `CHF ${chf} in declared donations. `,
    financing: 'Budgets and final accounts of those involved, from official Swiss Federal Audit Office data.',
    actor: (n) => `declared revenue and donations for ${n} ${n > 1 ? 'campaigns' : 'campaign'}, from official Swiss Federal Audit Office data.`,
    image_alt: 'polimoney.ch: who funds Swiss politics?',
  },
};

export const STATIC = ['votes', 'elections', 'parties', 'explore', 'about', 'privacy', 'legal'];
const PRIVATE = ['donor', 'stats'];          // reachable, but kept out of search engines (robots.txt too)
const DETAIL = ['vote', 'election', 'actor'];

/**
 * Splits a URL path into { lang, page, id, canonicalLang }. Returns null when the path cannot be a page.
 * Paths without a language ('/votes') are valid: the browser redirects them to the visitor's language.
 */
export function parsePath(rawPath) {
  const parts = String(rawPath).split('?')[0].split('/').filter(Boolean);
  if (!parts.length) return { lang: 'fr', page: '', id: undefined, bare: true };
  let bare = false;
  if (!LANGS.includes(parts[0])) {
    if (![...STATIC, ...PRIVATE, ...DETAIL].includes(parts[0])) return null;
    parts.unshift('fr');
    bare = true;
  }
  const [lang, page = '', id, ...extra] = parts;
  if (extra.length) return null;
  const known = page === '' || STATIC.includes(page) ? id === undefined
    : PRIVATE.includes(page) ? (page === 'stats' ? id === undefined : /^\d{1,9}$/.test(id ?? ''))
      : DETAIL.includes(page) && /^\d{1,9}$/.test(id ?? '');
  return known ? { lang, page, id, bare } : null;
}

const fmtDate = (lang, iso) => {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d)));
};
const fmtChf = (lang, v) => new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 0 }).format(v);
const withSite = (lang, title) => `${title} · ${TEXT[lang].site}`;

/** Metadata for a parsed page; `data` holds the financing or actor row for detail pages. */
export function pageMeta({ lang, page, id }, data) {
  const t = TEXT[lang];
  const path = [page, id].filter(Boolean).join('/');
  if (page === '') return { lang, path, title: `${t.home} · ${t.site}`, description: t.home_desc };
  if (STATIC.includes(page)) return { lang, path, title: withSite(lang, t[page][0]), description: t[page][1] };
  if (PRIVATE.includes(page)) return { lang, path, title: t.site, description: t.home_desc, noindex: true };
  if (page === 'vote' || page === 'election') {
    const when = fmtDate(lang, data.event_date);
    const allow = data.allowances?.final ?? data.allowances?.budget;
    const amount = allow?.total > 0 ? t.amount(fmtChf(lang, allow.total)) : '';
    const title = data.title ?? '';
    return { lang, path, title: withSite(lang, when ? `${title} (${when})` : title),
      description: `${when ? `${when} · ` : ''}${title}. ${amount}${t.financing}` };
  }
  // actor
  const where = data.canton ? ` (${data.canton})` : '';
  return { lang, path, title: withSite(lang, data.name), description: `${data.name}${where}: ${t.actor(Math.max(1, data.campaigns ?? 1))}` };
}

export function notFoundMeta(lang) {
  const l = LANGS.includes(lang) ? lang : 'fr';
  return { lang: l, path: null, title: withSite(l, TEXT[l].not_found), description: TEXT[l].home_desc, noindex: true };
}

const attr = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SEO_BLOCK = /<!--seo-->[\s\S]*?<!--\/seo-->/;

/** Returns the page HTML with language, title and meta tags filled in. */
export function renderHead(template, meta, siteUrl) {
  const root = siteUrl.replace(/\/+$/, '');
  const url = (l) => `${root}/${l}/${meta.path ?? ''}`;
  const tags = [
    `<title>${attr(meta.title)}</title>`,
    `<meta name="description" content="${attr(meta.description)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex" />' : '',
    ...(meta.path !== null && !meta.noindex ? [
      `<link rel="canonical" href="${attr(url(meta.lang))}" />`,
      ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${attr(url(l))}" />`),
      `<link rel="alternate" hreflang="x-default" href="${attr(url('fr'))}" />`,
      `<meta property="og:url" content="${attr(url(meta.lang))}" />`,
    ] : []),
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="polimoney.ch" />',
    `<meta property="og:locale" content="${OG_LOCALE[meta.lang]}" />`,
    `<meta property="og:title" content="${attr(meta.title)}" />`,
    `<meta property="og:description" content="${attr(meta.description)}" />`,
    `<meta property="og:image" content="${attr(`${root}/og/og-${meta.lang}.png`)}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${attr(TEXT[meta.lang].image_alt)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
  ].filter(Boolean);
  return template
    .replace(/<html lang="[a-z]{2}">/, `<html lang="${meta.lang}">`)
    .replace(SEO_BLOCK, `<!--seo-->\n    ${tags.join('\n    ')}\n    <!--/seo-->`);
}
