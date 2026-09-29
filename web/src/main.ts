import './style.css';

import { get } from './api';
import { date, esc } from './format';
import { LANGS, T, setLang, type Lang } from './i18n';
import { href, navigate, parseLocation, startRouter } from './router';
import { setNavigator, wireTips } from './views';

import { aboutPage } from './pages/about';
import { actorPage } from './pages/actor';
import { donorPage } from './pages/donor';
import { electionPage, electionsPage } from './pages/elections';
import { explorePage } from './pages/explore';
import { homePage } from './pages/home';
import { partiesPage } from './pages/parties';
import { votePage, votesPage } from './pages/votes';

export type Page = (main: HTMLElement, id: string | undefined, params: URLSearchParams) => void | Promise<void>;

const PAGES: Record<string, Page> = {
  '': homePage,
  votes: votesPage,
  vote: votePage,
  elections: electionsPage,
  election: electionPage,
  parties: partiesPage,
  actor: actorPage,
  donor: donorPage,
  explore: explorePage,
  about: aboutPage,
};

const app = document.getElementById('app')!;
wireTips(document.body);
setNavigator((url) => navigate(url));

function shell(page: string) {
  const t = T();
  const nav = [['votes', t.nav_votes], ['elections', t.nav_elections], ['parties', t.nav_parties],
    ['explore', t.nav_explore], ['about', t.nav_about]];
  const route = parseLocation();
  const otherLangs = LANGS.map((l) => {
    const path = `/${l}/${[route.page, route.id].filter(Boolean).join('/')}${location.search}`;
    return `<a href="${path}" class="${l === route.lang ? 'active' : ''}" hreflang="${l}" data-lang="${l}">${l.toUpperCase()}</a>`;
  }).join('');
  app.innerHTML = `
    <header class="site-header">
      <div class="wrap header-row">
        <a class="brand" href="${href('')}"><span class="flag" aria-hidden="true"></span>${esc(t.site_title)}</a>
        <nav class="main-nav">${nav.map(([p, l]) => `<a href="${href(p)}" class="${page === p || (page === p.slice(0, -1)) ? 'active' : ''}">${esc(l)}</a>`).join('')}</nav>
        <div class="lang-switch">${otherLangs}</div>
      </div>
      <div class="wrap search-row">
        <input type="search" id="search" placeholder="${esc(t.search_placeholder)}" autocomplete="off" aria-label="${esc(t.search_placeholder)}" />
        <div id="search-results" class="search-results" hidden></div>
      </div>
    </header>
    <main class="wrap" id="main"></main>
    <footer class="site-footer wrap">
      <p>${esc(t.source_efk)} — <a href="https://politikfinanzierung.efk.admin.ch/app/${route.lang === 'en' ? 'de' : route.lang}" target="_blank" rel="noopener">politikfinanzierung.efk.admin.ch</a>
      · ${esc(t.source_swissvotes)} — <a href="https://swissvotes.ch" target="_blank" rel="noopener">swissvotes.ch</a>
      · <span id="updated"></span></p>
    </footer>`;
  wireSearch();
  get('meta').then((m) => {
    if (m.last_run) document.getElementById('updated')!.textContent = `${t.data_updated} ${date(m.last_run.finished_at)}`;
  }).catch(() => {});
}

let searchTimer = 0;
function wireSearch() {
  const input = document.getElementById('search') as HTMLInputElement;
  const box = document.getElementById('search-results')!;
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value.trim();
    if (q.length < 2) { box.hidden = true; return; }
    searchTimer = window.setTimeout(async () => {
      const r = await get('search', { q });
      const t = T();
      const group = (title: string, items: any[], link: (x: any) => string, sub: (x: any) => string) =>
        items.length ? `<h3>${esc(title)}</h3><ul>${items.map((x) => `<li><a href="${link(x)}">${esc(x.label)}</a> <span class="muted">${esc(sub(x))}</span></li>`).join('')}</ul>` : '';
      const html = group(t.search_votes, r.financings,
        (x) => href(x.kind === 'party_year' ? `parties?year=${x.year}` : `${x.kind === 'election' ? 'election' : 'vote'}/${x.id}`),
        (x) => (x.event_date ? date(x.event_date) : String(x.year)))
        + group(t.search_actors, r.actors, (x) => href(`actor/${x.id}`), (x) => x.city ?? '')
        + group(t.search_donors, r.donors, (x) => href(`donor/${x.id}`), (x) => x.city ?? '');
      box.innerHTML = html || `<p class="muted">${t.search_none}</p>`;
      box.hidden = false;
    }, 200);
  });
  box.addEventListener('click', () => { box.hidden = true; input.value = ''; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') box.hidden = true; });
}

let currentShell = '';
async function render() {
  const route = parseLocation();
  if (!LANGS.includes(route.lang as Lang)) {
    const browser = navigator.language.toLowerCase().slice(0, 2) as Lang;
    const preferred = LANGS.includes(browser) ? browser : 'fr';
    navigate(`/${preferred}/${location.pathname.replace(/^\/+/, '')}${location.search}`, true);
    return;
  }
  setLang(route.lang as Lang);
  document.title = T().site_title;
  const shellKey = `${route.lang}:${route.page}:${route.id ?? ''}${location.search}`;
  if (shellKey !== currentShell) shell(route.page);
  currentShell = shellKey;
  const main = document.getElementById('main')!;
  const page = PAGES[route.page];
  if (!page) { main.innerHTML = `<p>${T().not_found}</p>`; return; }
  main.innerHTML = '';
  document.querySelector('meta[name=robots]')?.remove(); // donor pages re-add noindex
  await page(main, route.id, route.params);
}

startRouter(render);
