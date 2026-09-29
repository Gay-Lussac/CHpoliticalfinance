import { get, type Financing } from '../api';
import { chf, date, esc, num } from '../format';
import { T, tr } from '../i18n';
import { PAGES, renderViews } from '../views';
import { ballotsCard, defaultPhase, phaseToggle, sideTotals, splitBar, statTiles, viewsGrid, voteCard, voteSentence } from './common';

export async function votesPage(main: HTMLElement) {
  const t = T();
  main.innerHTML = `<h1>${esc(t.all_votes)}</h1><div id="list"><p class="muted">${t.loading}</p></div>`;
  const votes = await get<Financing[]>('financings', { kind: 'vote' });
  const byDate = new Map<string, Financing[]>();
  for (const v of votes) {
    const k = v.event_date ?? '';
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)!.push(v);
  }
  document.getElementById('list')!.innerHTML = [...byDate.entries()].map(([d, vs]) =>
    `<section class="date-group"><h2>${date(d)}</h2><div class="cards">${vs.map(voteCard).join('')}</div></section>`).join('');
}

export async function votePage(main: HTMLElement, id: string | undefined, params: URLSearchParams) {
  const t = T();
  const f = await get<Financing>(`financings/${Number(id)}`).catch(() => null);
  if (!f || f.kind !== 'vote') { main.innerHTML = `<p>${t.not_found}</p>`; return; }
  const phase = ['budget', 'final'].includes(params.get('phase') ?? '') ? params.get('phase')! : defaultPhase(f);
  const { yes, no, nYes, nNo } = sideTotals(f, phase);
  const al = f.allowances[phase];
  const hasData = f.has_budget || f.has_final;
  main.innerHTML = `<header class="page-head">
      <div class="card-meta"><span>${t.vote} · ${date(f.event_date)}</span>${f.object_type && f.object_type !== 'other' ? `<span class="badge">${tr(f.object_type)}</span>` : ''}</div>
      <h1>${esc(f.title)}</h1>
      ${hasData ? `<p class="lead">${esc(voteSentence(f, phase))}</p>${phaseToggle(f, phase, `vote/${f.id}`)}` : `<p class="lead">${t.no_data_yet}</p>`}
    </header>`;
  main.insertAdjacentHTML('beforeend', ballotsCard(f));
  if (!hasData) return;
  main.insertAdjacentHTML('beforeend', `<div class="card">${splitBar(yes, no)}</div>` + statTiles([
    { label: t.for, value: chf(yes), sub: `${nYes} ${t.actors}` },
    { label: t.against, value: chf(no), sub: `${nNo} ${t.actors}` },
    { label: t.donations_total, value: chf(al?.total ?? 0), sub: `${num(al?.n ?? 0)} ${t.allowances}` },
  ]));
  renderViews(viewsGrid(main), PAGES.vote ?? [], { financing_id: f.id, phase });
}
