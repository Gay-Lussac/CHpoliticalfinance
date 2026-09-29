import { get, type Financing } from '../api';
import { esc } from '../format';
import { T } from '../i18n';
import { href } from '../router';
import { PAGES, renderViews } from '../views';
import { viewsGrid } from './common';

export async function partiesPage(main: HTMLElement, _id: string | undefined, params: URLSearchParams) {
  const t = T();
  const years = (await get<Financing[]>('financings', { kind: 'party_year' })).filter((f) => f.has_final)
    .map((f) => f.year).sort((a, b) => b - a);
  const year = Number(params.get('year')) || years[0];
  main.innerHTML = `<header class="page-head"><h1>${esc(t.party_year)}</h1>
      <p class="lead">${esc(t.party_income_note)}</p>
      <div class="segmented" role="group" aria-label="${t.year}">${years.map((y) =>
        `<a href="${href(`parties?year=${y}`)}" class="${y === year ? 'active' : ''}">${y}</a>`).join('')}</div>
    </header>`;
  renderViews(viewsGrid(main), PAGES.parties ?? [], { year });
}
