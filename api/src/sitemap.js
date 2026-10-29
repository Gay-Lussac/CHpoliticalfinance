// sitemap.xml for search engines: every public page in each language, with hreflang alternates.
// Donor and stats pages are left out on purpose (robots.txt keeps them out of search engines too).
import { LANGS } from './labels.js';

export const STATIC_PAGES = ['', 'votes', 'elections', 'parties', 'explore', 'about', 'privacy', 'legal'];

const xmlEsc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

/** paths: language-less page paths such as '', 'votes', 'vote/12'. */
export function buildSitemap(base, paths) {
  const root = base.replace(/\/+$/, '');
  const url = (lang, path) => xmlEsc(`${root}/${lang}/${path}`);
  const entries = paths.map((path) => {
    const alternates = LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${url(l, path)}"/>`).join('')
      + `<xhtml:link rel="alternate" hreflang="x-default" href="${url('fr', path)}"/>`;
    return LANGS.map((l) => `<url><loc>${url(l, path)}</loc>${alternates}</url>`).join('\n');
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
    + `${entries.join('\n')}\n</urlset>\n`;
}
