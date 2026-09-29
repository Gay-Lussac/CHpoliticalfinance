import { get } from '../api';
import { chf, date, esc, num } from '../format';
import { T, tr } from '../i18n';
import { PAGES, renderViews } from '../views';
import { statTiles, viewsGrid } from './common';

export async function donorPage(main: HTMLElement, id: string | undefined) {
  const t = T();
  const d = await get(`donors/${Number(id)}`).catch(() => null);
  if (!d) { main.innerHTML = `<p>${t.not_found}</p>`; return; }
  // Donor pages name private individuals: keep them out of search engines (docs/00-concept.md).
  let robots = document.querySelector('meta[name=robots]');
  if (!robots) { robots = Object.assign(document.createElement('meta'), { name: 'robots' }); document.head.append(robots); }
  robots.setAttribute('content', 'noindex');

  const aliases = (d.aliases as any[]).filter((x) => `${x.raw_name}` !== d.display_name && `${x.raw_name} ${x.raw_first_name ?? ''}`.trim() !== d.display_name);
  main.innerHTML = `<header class="page-head">
      <div class="card-meta"><span>${t.donor}</span><span class="badge">${tr(d.donor_type)}</span>${d.lives_abroad ? `<span class="badge">${t.lives_abroad}</span>` : ''}</div>
      <h1>${esc(d.display_name)}</h1>
      <p class="muted">${esc([d.city, d.country].filter(Boolean).join(', '))}</p>
      ${aliases.length ? `<p class="muted small">${t.known_as}: ${aliases.map((x) => esc([x.raw_name, x.raw_first_name, x.raw_city && `(${x.raw_city})`].filter(Boolean).join(' '))).join(' · ')}</p>` : ''}
    </header>` + statTiles([
    { label: t.donations_total, value: chf(d.total), sub: `${num(d.n)} ${t.allowances}` },
    { label: t.recipients, value: String(d.actors), sub: `${d.financings} ${t.nav_votes.toLowerCase()} / ${t.nav_elections.toLowerCase()}` },
    { label: t.first_last, value: `${date(d.first_date)}`, sub: date(d.last_date) },
  ]);
  renderViews(viewsGrid(main), PAGES.donor ?? [], { donor_id: d.id, donor_type: d.donor_type });
}
