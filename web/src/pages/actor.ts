import { get } from '../api';
import { esc } from '../format';
import { T } from '../i18n';
import { PAGES, renderViews } from '../views';
import { statTiles, viewsGrid } from './common';

export async function actorPage(main: HTMLElement, id: string | undefined) {
  const t = T();
  const a = await get(`actors/${Number(id)}`).catch(() => null);
  if (!a) { main.innerHTML = `<p>${t.not_found}</p>`; return; }
  const party = a.party_label
    ? `<span class="badge"><i class="dot" style="background:${esc(a.party_color)}"></i>${esc(a.party_label)}</span>` : '';
  main.innerHTML = `<header class="page-head">
      <div class="card-meta"><span>${t.actor}</span>${party}</div>
      <h1>${esc(a.name)}</h1>
      <p class="muted">${esc([a.city, a.canton].filter(Boolean).join(', '))}</p>
    </header>` + statTiles([
    { label: t.nav_votes + ' / ' + t.nav_elections, value: String(a.financings) },
    { label: t.campaigns, value: String(a.campaigns) },
  ]);
  renderViews(viewsGrid(main), PAGES.actor ?? [], { actor_id: a.id });
}
