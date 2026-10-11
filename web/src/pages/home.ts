import { get, type Financing } from '../api';
import { chfShort, date, esc, num, typo } from '../format';
import { T } from '../i18n';
import { href } from '../router';
import { PAGES, renderViews } from '../views';
import { viewsGrid, voteCard } from './common';

const skeletonCards = (n: number) => Array.from({ length: n }, () =>
  `<div class="card" aria-hidden="true"><div class="skeleton"><span></span><span></span><span></span><span></span></div></div>`).join('');

export async function homePage(main: HTMLElement) {
  const t = T();
  main.innerHTML = `<section class="hero">
      <h1>${esc(t.hero_title)}</h1>
      <p class="lead">${esc(t.hero_lead)}</p>
      <ul class="hero-figures" id="figures" aria-live="polite"></ul>
    </section>
    <section>
      <div class="section-head"><h2>${esc(t.recent_votes)}</h2><a href="${href('votes')}">${esc(t.all_votes)} →</a></div>
      <div class="cards" id="vote-cards" aria-busy="true">${skeletonCards(6)}<span class="sr-only">${esc(t.loading)}</span></div>
      <div id="upcoming"></div>
    </section>`;
  get('meta').then((m) => {
    const c = m.counts;
    document.getElementById('figures')!.innerHTML = [
      [chfShort(c.donations_chf), t.fig_donations], [num(c.votes), t.fig_votes], [num(c.donors), t.fig_donors],
    ].map(([v, l]) => `<li><strong>${esc(v)}</strong><span>${esc(l)}</span></li>`).join('');
  }).catch(() => {});
  const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  renderViews(viewsGrid(main), PAGES.home ?? [], { since });

  const votes = await get<Financing[]>('financings', { kind: 'vote' });
  // Votes with published declarations first (most recent first); upcoming votes without data listed compactly.
  const withData = votes.filter((v) => v.has_budget || v.has_final).slice(0, 6);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = votes.filter((v) => !v.has_budget && !v.has_final && (v.event_date ?? '') >= today)
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''));
  const cards = document.getElementById('vote-cards')!;
  cards.innerHTML = withData.map(voteCard).join('');
  cards.removeAttribute('aria-busy');
  if (upcoming.length) {
    document.getElementById('upcoming')!.innerHTML = `<div class="upcoming"><h3>${esc(t.upcoming_title)}</h3><ul>${upcoming.map((v) =>
      `<li><time datetime="${esc(v.event_date)}">${esc(date(v.event_date))}</time><a href="${href(`vote/${v.id}`)}">${esc(typo(v.title))}</a></li>`).join('')}</ul></div>`;
  }
}
