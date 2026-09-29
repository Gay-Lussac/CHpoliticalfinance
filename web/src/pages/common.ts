import type { Financing } from '../api';
import { chf, chfShort, date, esc } from '../format';
import { locale, T, tr } from '../i18n';
import { href } from '../router';

/** Phase shown by default: final accounts when published, else the budget. */
export const defaultPhase = (f: Financing) => (f.has_final ? 'final' : f.has_budget ? 'budget' : 'final');

export function sideTotals(f: Financing, phase: string) {
  const s = f.summary[phase] ?? {};
  return { yes: s.for?.total ?? 0, no: s.against?.total ?? 0, nYes: s.for?.n_actors ?? 0, nNo: s.against?.n_actors ?? 0 };
}

export function voteSentence(f: Financing, phase: string): string {
  const t = T();
  const { yes, no } = sideTotals(f, phase);
  if (!yes && !no) return t.no_data_yet;
  let ratio = '';
  if (yes && no) {
    const r = yes > no ? yes / no : no / yes;
    if (r >= 1.2) ratio = t.ratio_more(yes > no ? t.for : t.against, new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(r));
  }
  return t.vote_summary(chfShort(yes), chfShort(no), ratio);
}

/** Yes/No split bar used on cards and in page headers. */
export function splitBar(yes: number, no: number): string {
  const total = yes + no;
  if (!total) return `<div class="split empty"></div>`;
  const t = T();
  const py = (yes / total) * 100;
  return `<div class="split" role="img" aria-label="${esc(`${t.for} ${chf(yes)}, ${t.against} ${chf(no)}`)}">
      ${yes ? `<span class="yes" style="flex-basis:${py}%" data-tip="${esc(`${t.for}: ${chf(yes)}`)}"></span>` : ''}
      ${no ? `<span class="no" style="flex-basis:${100 - py}%" data-tip="${esc(`${t.against}: ${chf(no)}`)}"></span>` : ''}
    </div>
    <div class="split-legend"><span><i class="dot yes"></i>${t.for} ${chfShort(yes)}</span><span><i class="dot no"></i>${t.against} ${chfShort(no)}</span></div>`;
}

export function voteCard(f: Financing): string {
  const phase = defaultPhase(f);
  const { yes, no } = sideTotals(f, phase);
  const hasData = f.has_budget || f.has_final;
  return `<a class="card vote-card" href="${href(`vote/${f.id}`)}">
      <div class="card-meta"><span>${date(f.event_date)}</span>${hasData ? `<span class="badge ${phase}">${tr(phase)}</span>` : ''}</div>
      <h3>${esc(f.title)}</h3>
      ${hasData ? splitBar(yes, no) : `<p class="muted small">${T().no_data_yet}</p>`}
    </a>`;
}

export function phaseToggle(f: Financing, phase: string, base: string): string {
  const t = T();
  const opt = (p: 'budget' | 'final', enabled: boolean) => enabled
    ? `<a href="${href(`${base}?phase=${p}`)}" class="${p === phase ? 'active' : ''}" title="${esc(p === 'budget' ? t.phase_budget_hint : t.phase_final_hint)}">${t[p]}</a>`
    : `<span class="disabled" title="${esc(t.no_data_yet)}">${t[p]}</span>`;
  return `<div class="segmented" role="group" aria-label="${t.phase}">${opt('budget', f.has_budget)}${opt('final', f.has_final)}</div>`;
}

export function statTiles(items: { label: string; value: string; sub?: string }[]): string {
  return `<div class="stats">${items.map((i) => `<div class="stat"><div class="stat-label">${esc(i.label)}</div>
    <div class="stat-value">${esc(i.value)}</div>${i.sub ? `<div class="stat-sub muted">${esc(i.sub)}</div>` : ''}</div>`).join('')}</div>`;
}

export const viewsGrid = (main: HTMLElement) => {
  const grid = document.createElement('div');
  grid.className = 'views-grid';
  main.append(grid);
  return grid;
};
