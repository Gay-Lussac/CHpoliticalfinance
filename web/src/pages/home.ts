import { get, type Financing } from '../api';
import { date, esc, num } from '../format';
import { T } from '../i18n';
import { href } from '../router';
import { PAGES, renderViews } from '../views';
import { viewsGrid, voteCard } from './common';

export async function homePage(main: HTMLElement) {
  const t = T();
  main.innerHTML = `<section class="hero"><h1>${esc(t.site_title)}</h1><p class="lead">${esc(t.tagline)}</p><div id="counts" class="muted"></div></section>
    <section><div class="section-head"><h2>${esc(t.recent_votes)}</h2><a href="${href('votes')}">${esc(t.all_votes)} →</a></div>
    <div class="cards" id="vote-cards"><p class="muted">${t.loading}</p></div></section>`;
  get('meta').then((m) => {
    const c = m.counts;
    document.getElementById('counts')!.textContent =
      `${num(c.votes)} ${t.nav_votes.toLowerCase()} · ${num(c.elections)} ${t.nav_elections.toLowerCase()} · ${num(c.actors)} ${t.actors} · ${num(c.allowances)} ${t.allowances}`;
  }).catch(() => {});
  const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  renderViews(viewsGrid(main), PAGES.home ?? [], { since });

  const votes = await get<Financing[]>('financings', { kind: 'vote' });
  // Votes with published declarations first (most recent first); upcoming votes without data are listed compactly.
  const withData = votes.filter((v) => v.has_budget || v.has_final).slice(0, 6);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = votes.filter((v) => !v.has_budget && !v.has_final && (v.event_date ?? '') >= today);
  document.getElementById('vote-cards')!.innerHTML = withData.map(voteCard).join('');
  if (upcoming.length) {
    document.getElementById('vote-cards')!.insertAdjacentHTML('afterend',
      `<p class="muted small upcoming">${esc(t.upcoming_no_data)} ${upcoming.map((v) =>
        `<a href="${href(`vote/${v.id}`)}">${esc(v.title)}</a> (${date(v.event_date)})`).join(' · ')}</p>`);
  }
}
