import { get, type Financing } from '../api';
import { chf, chfShort, date, esc, num } from '../format';
import { T, tr } from '../i18n';
import { href } from '../router';
import { PAGES, renderViews } from '../views';
import { defaultPhase, phaseToggle, statTiles, viewsGrid } from './common';

const electionTotal = (f: Financing, phase: string) => {
  const s = f.summary[phase] ?? {};
  return Object.values(s).reduce((a, x) => ({ total: a.total + x.total, n: a.n + x.n_actors }), { total: 0, n: 0 });
};

export async function electionsPage(main: HTMLElement) {
  const t = T();
  main.innerHTML = `<h1>${esc(t.all_elections)}</h1><div class="cards" id="list"><p class="muted">${t.loading}</p></div>`;
  const list = await get<Financing[]>('financings', { kind: 'election' });
  document.getElementById('list')!.innerHTML = list.map((f) => {
    const phase = defaultPhase(f);
    const { total, n } = electionTotal(f, phase);
    return `<a class="card vote-card" href="${href(`election/${f.id}`)}">
      <div class="card-meta"><span>${date(f.event_date)}</span><span class="badge ${phase}">${tr(phase)}</span></div>
      <h3>${esc(f.title)}</h3>
      <p class="big">${chfShort(total)}</p><p class="muted small">${n} ${t.actors}</p></a>`;
  }).join('');
}

export async function electionPage(main: HTMLElement, id: string | undefined, params: URLSearchParams) {
  const t = T();
  const f = await get<Financing>(`financings/${Number(id)}`).catch(() => null);
  if (!f || f.kind !== 'election') { main.innerHTML = `<p>${t.not_found}</p>`; return; }
  const phase = ['budget', 'final'].includes(params.get('phase') ?? '') ? params.get('phase')! : defaultPhase(f);
  const { total, n } = electionTotal(f, phase);
  const al = f.allowances[phase];
  main.innerHTML = `<header class="page-head">
      <div class="card-meta"><span>${t.election} · ${date(f.event_date)}</span>${f.council ? `<span class="badge">${tr(f.council)}</span>` : ''}</div>
      <h1>${esc(f.title)}</h1>
      <p class="lead">${esc(t.election_summary(chfShort(total), n))}</p>
      ${phaseToggle(f, phase, `election/${f.id}`)}
    </header>` + statTiles([
    { label: t.total, value: chf(total), sub: `${n} ${t.actors}` },
    { label: t.donations_total, value: chf(al?.total ?? 0), sub: `${num(al?.n ?? 0)} ${t.allowances}` },
  ]);
  renderViews(viewsGrid(main), PAGES.election ?? [], { financing_id: f.id, phase });
}
