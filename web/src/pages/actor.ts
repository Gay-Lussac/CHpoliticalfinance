import { get } from '../api';
import { esc } from '../format';
import { setPageTitle, T } from '../i18n';
import { href } from '../router';
import { PAGES, renderViews } from '../views';
import { statTiles, viewsGrid } from './common';
import { hasOrientation, loadOrientation, orientationHtml, OT } from './orientation';

export async function actorPage(main: HTMLElement, id: string | undefined, params?: URLSearchParams) {
  const t = T();
  const [a, o] = await Promise.all([get(`actors/${Number(id)}`).catch(() => null), loadOrientation(Number(id))]);
  if (!a) { main.innerHTML = `<p>${t.not_found}</p>`; return; }
  setPageTitle(a.name);
  const m = OT();
  const tab = params?.get('tab') === 'orientation' && hasOrientation(o) ? 'orientation' : 'money';
  const party = a.party_label
    ? `<span class="badge"><i class="dot" style="background:${esc(a.party_color)}"></i>${esc(a.party_label)}</span>` : '';
  // Tabs are plain links (?tab=orientation): shareable, and the back button works.
  const tabs = hasOrientation(o) ? `<nav class="segmented tabs" aria-label="${esc(a.name)}">
      <a href="${href(`actor/${a.id}`)}" class="${tab === 'money' ? 'active' : ''}"${tab === 'money' ? ' aria-current="page"' : ''}>${esc(m.tab_money)}</a>
      <a href="${href(`actor/${a.id}?tab=orientation`)}" class="${tab === 'orientation' ? 'active' : ''}"${tab === 'orientation' ? ' aria-current="page"' : ''}>${esc(m.tab_orientation)}</a>
    </nav>` : '';
  main.innerHTML = `<header class="page-head">
      <div class="card-meta"><span>${t.actor}</span>${party}</div>
      <h1>${esc(a.name)}</h1>
      <p class="muted">${esc([a.city, a.canton].filter(Boolean).join(', '))}</p>
      ${tabs}
    </header>`;
  if (tab === 'orientation') {
    main.insertAdjacentHTML('beforeend', `<div class="orient-wrap">${orientationHtml(o)}</div>`);
    return;
  }
  main.insertAdjacentHTML('beforeend', statTiles([
    { label: t.nav_votes + ' / ' + t.nav_elections, value: String(a.financings) },
    { label: t.campaigns, value: String(a.campaigns) },
  ]));
  renderViews(viewsGrid(main), PAGES.actor ?? [], { actor_id: a.id });
}
